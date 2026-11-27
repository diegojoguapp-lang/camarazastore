// Opt-in: first stdin line is private Staging config, followed by operator
// acknowledgements after reversible QA profile changes. Never persist secrets.
import { createInterface } from 'node:readline'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
const lines = input[Symbol.asyncIterator]()
let config
let clients = []
let checkName = 'configuration'
const passed = []
async function nextLine() {
  let timer
  try {
    const row = await Promise.race([
      lines.next(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Operator timeout')), 90000) })
    ])
    assert.equal(row.done, false)
    return row.value
  } finally { clearTimeout(timer) }
}
async function check(name, callback) {
  checkName = name
  await callback()
  passed.push(name)
  console.log(JSON.stringify({ passed: name }))
}
function assertOwnershipDenied(error) {
  assert.ok(error)
  assert.ok(error.code === '42501' || (error.code === 'P0001' &&
    error.message === 'bank account reseller_id must belong to an active reseller'))
}

try {
  config = JSON.parse(await nextLine())
  assert.equal(config.environment, 'staging')
  assert.equal(createHash('sha256').update(config.expectedProjectRef).digest('hex'),
    'baf8fef252f5ebf83edd444e192e375347d7bb72a820aace9f33a2e4cdd3c910')
  assert.equal(new URL(config.url).origin, `https://${config.expectedProjectRef}.supabase.co`)
  assert.ok(config.publishableKey.startsWith('sb_publishable_'))
  assert.equal(config.accounts.length, 2)
  assert.ok(/^QA_BANK_[A-Z0-9_]+$/.test(config.fixtureTag))
  const options = {
    global: { fetch: (url, opts) => fetch(url, { ...opts, signal: AbortSignal.timeout(15000) }) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  }
  clients = config.accounts.map(() => createClient(config.url, config.publishableKey, options))
  const anon = createClient(config.url, config.publishableKey, options)
  const users = []
  const rows = []
  for (const [i, client] of clients.entries()) {
    await check(`auth_${i}`, async () => {
      const { data, error } = await client.auth.signInWithPassword(config.accounts[i])
      assert.ifError(error)
      users[i] = data.user.id
      const profile = await client.from('profiles').select('full_name,role,is_active').eq('id', users[i]).single()
      assert.ifError(profile.error)
      assert.equal(profile.data.full_name, i === 0 ? 'Revendedor QA A' : 'Revendedor QA B')
      assert.equal(profile.data.role, 'reseller')
      assert.equal(profile.data.is_active, true)
    })
    await check(`own_create_${i}`, async () => {
      const { data, error } = await client.from('bank_accounts').insert({
        reseller_id: users[i], bank_name: config.fixtureTag,
        bank_holder: 'PERSONA FICTICIA QA', bank_alias: `NO_REAL_${i}`,
        is_primary: true, created_by: users[i]
      }).select('id,reseller_id,bank_alias').single()
      assert.ifError(error)
      assert.equal(data.reseller_id, users[i])
      rows[i] = data.id
    })
    await check(`own_edit_${i}`, async () => {
      const { data, error } = await client.from('bank_accounts').update({ bank_alias: `NO_REAL_EDIT_${i}` })
        .eq('id', rows[i]).select('bank_alias').single()
      assert.ifError(error)
      assert.equal(data.bank_alias, `NO_REAL_EDIT_${i}`)
    })
  }
  for (const [i, client] of clients.entries()) {
    const other = 1 - i
    await check(`foreign_read_${i}`, async () => {
      const result = await client.from('bank_accounts').select('id').eq('id', rows[other])
      assert.ifError(result.error)
      assert.deepEqual(result.data, [])
    })
    await check(`foreign_edit_${i}`, async () => {
      const result = await client.from('bank_accounts').update({ bank_alias: 'QA_UNEXPECTED_FOREIGN' })
        .eq('id', rows[other]).select('id')
      assert.ifError(result.error)
      assert.deepEqual(result.data, [])
    })
    await check(`foreign_insert_${i}`, async () => {
      const result = await client.from('bank_accounts').insert({ reseller_id: users[other], bank_name: config.fixtureTag, bank_holder: 'PERSONA FICTICIA QA' })
      assertOwnershipDenied(result.error)
    })
    await check(`reassign_denied_${i}`, async () => {
      const result = await client.from('bank_accounts').update({ reseller_id: users[other] }).eq('id', rows[i])
      assertOwnershipDenied(result.error)
    })
    await check(`own_delete_denied_${i}`, async () => {
      const result = await client.from('bank_accounts').delete().eq('id', rows[i])
      assert.equal(result.error?.code, '42501')
    })
  }
  for (const operation of ['select', 'insert', 'update', 'delete']) {
    await check(`anonymous_${operation}_denied`, async () => {
      const table = anon.from('bank_accounts')
      const result = operation === 'select' ? await table.select('id')
        : operation === 'insert' ? await table.insert({ reseller_id: users[0], bank_name: config.fixtureTag, bank_holder: 'PERSONA FICTICIA QA' })
          : operation === 'update' ? await table.update({ bank_alias: 'QA_UNEXPECTED_ANON' }).eq('id', rows[0])
            : await table.delete().eq('id', rows[0])
      assert.equal(result.error?.code, '42501')
    })
  }
  console.log(JSON.stringify({ phase: 'READY_FOR_INACTIVE_A' }))
  checkName = 'operator_inactive_ack'
  assert.equal(await nextLine(), 'inactive')
  await check('existing_token_inactive_read_denied', async () => {
    const result = await clients[0].from('bank_accounts').select('id').eq('id', rows[0])
    assert.ifError(result.error)
    assert.deepEqual(result.data, [])
  })
  await check('existing_token_inactive_edit_denied', async () => {
    const result = await clients[0].from('bank_accounts').update({ bank_alias: 'QA_UNEXPECTED_INACTIVE' }).eq('id', rows[0]).select('id')
    assert.ifError(result.error)
    assert.deepEqual(result.data, [])
  })
  await check('existing_token_inactive_insert_denied', async () => {
    const result = await clients[0].from('bank_accounts').insert({ reseller_id: users[0], bank_name: config.fixtureTag, bank_holder: 'PERSONA FICTICIA QA' })
    assertOwnershipDenied(result.error)
  })
  await check('other_active_account_unaffected', async () => {
    const result = await clients[1].from('bank_accounts').select('bank_alias,reseller_id').eq('id', rows[1]).single()
    assert.ifError(result.error)
    assert.equal(result.data.bank_alias, 'NO_REAL_EDIT_1')
    assert.equal(result.data.reseller_id, users[1])
  })
  console.log(JSON.stringify({ phase: 'READY_FOR_ACTIVE_A' }))
  checkName = 'operator_active_ack'
  assert.equal(await nextLine(), 'active')
  await check('same_token_reactivated_read', async () => {
    const result = await clients[0].from('bank_accounts').select('bank_alias,reseller_id').eq('id', rows[0]).single()
    assert.ifError(result.error)
    assert.equal(result.data.bank_alias, 'NO_REAL_EDIT_0')
    assert.equal(result.data.reseller_id, users[0])
  })
  await check('same_token_reactivated_edit', async () => {
    const result = await clients[0].from('bank_accounts').update({ bank_alias: 'NO_REAL_REACTIVATED' }).eq('id', rows[0]).select('id').single()
    assert.ifError(result.error)
    assert.equal(result.data.id, rows[0])
  })
  console.log(JSON.stringify({ status: 'PASS', count: passed.length }))
} catch {
  console.log(JSON.stringify({ status: 'FAIL', failed: checkName, count: passed.length }))
  process.exitCode = 1
} finally {
  const results = await Promise.allSettled(clients.map(client => client.auth.signOut({ scope: 'local' })))
  const ok = results.every(r => r.status === 'fulfilled' && !r.value.error)
  console.log(JSON.stringify({ sessionsSignedOut: ok }))
  if (!ok) process.exitCode = 1
  input.close()
}

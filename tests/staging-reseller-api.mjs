// Opt-in live QA. Read configuration/credentials from stdin, never from Git.
// Requires two official dummy reseller accounts and distinct disposable bank
// fixtures, provisioned and removed by the test operator in verified Staging.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

let config
let clients
try {
  config = JSON.parse(readFileSync(0, 'utf8'))
  assert.equal(config.environment, 'staging')
  assert.ok(config.expectedProjectRef)
  // Pin the owner's authorized Staging identity without publishing its ID.
  assert.equal(createHash('sha256').update(config.expectedProjectRef).digest('hex'),
    'baf8fef252f5ebf83edd444e192e375347d7bb72a820aace9f33a2e4cdd3c910')
  assert.ok(config.publishableKey?.startsWith('sb_publishable_'))
  assert.equal(new URL(config.url).hostname, `${config.expectedProjectRef}.supabase.co`)
  assert.equal(new URL(config.url).protocol, 'https:')
  assert.equal(config.accounts.length, 2)
  assert.ok(config.fixtureTag?.startsWith('QA_FICTICIO_'))
  clients = config.accounts.map(() => createClient(config.url, config.publishableKey, {
    global: { fetch: (input, options) => fetch(input, { ...options, signal: AbortSignal.timeout(15000) }) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  }))
} catch {
  // Parsing/assertion errors may embed secrets; never print the raw error.
  console.log(JSON.stringify({ status: 'FAIL', failed: 'configuration' }))
  process.exit(1)
}
const passed = []
let currentCheck = 'configuration'
async function check(label, callback) {
  currentCheck = label
  await callback()
  passed.push(label)
  console.log(JSON.stringify({ passed: label }))
}

try {
  const ids = []
  for (const [index, client] of clients.entries()) {
    await check(`auth_${index}`, async () => {
      const { data, error } = await client.auth.signInWithPassword(config.accounts[index])
      assert.ifError(error)
      assert.ok(data.user?.id)
      const verified = await client.auth.getUser()
      assert.ifError(verified.error)
      assert.equal(verified.data.user.id, data.user.id)
      ids[index] = data.user.id
    })
  }
  assert.notEqual(ids[0], ids[1])
  for (const [index, client] of clients.entries()) {
    const other = ids[1 - index]
    await check(`own_active_profile_${index}`, async () => {
      const { data, error } = await client.from('profiles').select('id,full_name,role,is_active').eq('id', ids[index])
      assert.ifError(error)
      assert.equal(data.length, 1)
      assert.equal(data[0].full_name, index === 0 ? 'Revendedor QA A' : 'Revendedor QA B')
      assert.equal(data[0].role, 'reseller')
      assert.equal(data[0].is_active, true)
    })
    await check(`foreign_profile_hidden_${index}`, async () => {
      const { data, error } = await client.from('profiles').select('id').eq('id', other)
      assert.ifError(error)
      assert.deepEqual(data, [])
    })
    await check(`own_bank_fixture_${index}`, async () => {
      const { data, error } = await client.from('bank_accounts').select('reseller_id,bank_name').eq('reseller_id', ids[index])
      assert.ifError(error)
      assert.equal(data.length, 1)
      assert.equal(data[0].bank_name, config.fixtureTag)
    })
    await check(`foreign_bank_fixture_hidden_${index}`, async () => {
      const { data, error } = await client.from('bank_accounts').select('id').eq('reseller_id', other)
      assert.ifError(error)
      assert.deepEqual(data, [])
    })
    await check(`own_commission_detail_${index}`, async () => {
      const { data, error } = await client.rpc('get_commission_sales_v2', { p_reseller_id: ids[index], p_bucket: 'available', p_offset: 0 })
      assert.ifError(error)
      assert.ok(Array.isArray(data))
    })
    await check(`foreign_commission_detail_denied_${index}`, async () => {
      const { error } = await client.rpc('get_commission_sales_v2', { p_reseller_id: other, p_bucket: 'available', p_offset: 0 })
      assert.equal(error?.code, 'P0001')
      assert.equal(error.message, 'Acceso denegado.')
    })
    await check(`own_commission_balance_${index}`, async () => {
      const { data, error } = await client.rpc('get_my_commission_balances_v2')
      assert.ifError(error)
      assert.ok(data && typeof data === 'object')
    })
    await check(`admin_commission_denied_${index}`, async () => {
      const { error } = await client.rpc('admin_commission_balances_v2')
      assert.equal(error?.code, 'P0001')
      assert.equal(error.message, 'Solo administradores activos.')
    })
    await check(`internal_helper_denied_${index}`, async () => {
      const { error } = await client.rpc('commission_balances_v2', { p_reseller_id: other })
      assert.equal(error?.code, '42501')
    })
  }
  console.log(JSON.stringify({ status: 'PASS', count: passed.length, passed }))
} catch {
  console.log(JSON.stringify({ status: 'FAIL', failed: currentCheck, count: passed.length, passed }))
  process.exitCode = 1
} finally {
  const results = await Promise.allSettled(clients.map(client => client.auth.signOut({ scope: 'local' })))
  const ok = results.every(result => result.status === 'fulfilled' && !result.value.error)
  console.log(JSON.stringify({ sessionsSignedOut: ok }))
  if (!ok) process.exitCode = 1
}

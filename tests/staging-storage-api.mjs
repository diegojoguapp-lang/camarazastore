// Opt-in real Storage authorization test. Private config is stdin-only.
import { readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

let clients = []
let failed = 'configuration'
const passed = []
const cleanupNeeded = []
try {
  const config = JSON.parse(readFileSync(0, 'utf8'))
  assert.equal(config.environment, 'staging')
  assert.equal(createHash('sha256').update(config.expectedProjectRef).digest('hex'),
    'baf8fef252f5ebf83edd444e192e375347d7bb72a820aace9f33a2e4cdd3c910')
  assert.equal(new URL(config.url).origin, `https://${config.expectedProjectRef}.supabase.co`)
  assert.ok(config.publishableKey.startsWith('sb_publishable_'))
  assert.equal(config.accounts.length, 2)
  const options = {
    global: { fetch: (url, opts) => fetch(url, { ...opts, signal: AbortSignal.timeout(15000) }) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  }
  clients = config.accounts.map(() => createClient(config.url, config.publishableKey, options))
  const anon = createClient(config.url, config.publishableKey, options)
  for (const [i, client] of clients.entries()) {
    failed = `auth_${i}`
    const login = await client.auth.signInWithPassword(config.accounts[i])
    assert.ifError(login.error)
    const profile = await client.from('profiles').select('full_name,role,is_active').eq('id', login.data.user.id).single()
    assert.ifError(profile.error)
    assert.equal(profile.data.full_name, i === 0 ? 'Revendedor QA A' : 'Revendedor QA B')
    assert.equal(profile.data.role, 'reseller')
    assert.equal(profile.data.is_active, true)
    passed.push(failed)
    console.log(JSON.stringify({ passed: failed }))
  }
  const png = readFileSync(new URL('./fixtures/qa-pixel.png', import.meta.url))
  for (const [actor, client] of [...clients, anon].entries()) {
    for (const bucket of ['product-images', 'retail-assets']) {
      failed = `upload_denied_${actor}_${bucket}`
      const folder = bucket === 'retail-assets' ? 'categories' : 'main'
      const path = `${folder}/qa-c02-${randomUUID()}.png`
      const result = await client.storage.from(bucket).upload(path, png, { contentType: 'image/png', upsert: false })
      if (!result.error) cleanupNeeded.push({ bucket, path })
      assert.equal(Number(result.error?.statusCode), 403)
      passed.push(failed)
      console.log(JSON.stringify({ passed: failed }))
    }
  }
  console.log(JSON.stringify({ status: 'PASS', count: passed.length }))
} catch {
  console.log(JSON.stringify({ status: 'FAIL', failed, count: passed.length, cleanupNeeded }))
  process.exitCode = 1
} finally {
  const results = await Promise.allSettled(clients.map(client => client.auth.signOut({ scope: 'local' })))
  const ok = results.every(r => r.status === 'fulfilled' && !r.value.error)
  console.log(JSON.stringify({ sessionsSignedOut: ok, cleanupNeeded }))
  if (!ok) process.exitCode = 1
}

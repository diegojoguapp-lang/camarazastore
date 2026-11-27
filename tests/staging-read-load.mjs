// Small opt-in read baseline, NOT a production-capacity benchmark.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

try {
  const config = JSON.parse(readFileSync(0, 'utf8'))
  assert.equal(config.environment, 'staging')
  assert.equal(createHash('sha256').update(config.expectedProjectRef).digest('hex'),
    'baf8fef252f5ebf83edd444e192e375347d7bb72a820aace9f33a2e4cdd3c910')
  assert.equal(new URL(config.url).origin, `https://${config.expectedProjectRef}.supabase.co`)
  assert.ok(config.publishableKey.startsWith('sb_publishable_'))
  assert.ok(Number.isInteger(config.samples) && config.samples >= 1 && config.samples <= 24)
  assert.ok(Number.isInteger(config.concurrency) && config.concurrency >= 1 && config.concurrency <= 3)
  const warmup = config.warmup ?? 0
  assert.ok(Number.isInteger(warmup) && warmup >= 0 && warmup <= 3)
  const client = createClient(config.url, config.publishableKey, {
    global: { fetch: (url, opts) => fetch(url, { ...opts, signal: AbortSignal.timeout(15000) }) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
  const times = []
  let index = 0
  let errors = 0
  for (let i = 0; i < warmup; i += 1) {
    const result = await client.rpc('get_reseller_catalog')
    assert.ifError(result.error)
    assert.equal(result.data?.length, 1)
  }
  const start = performance.now()
  await Promise.all(Array.from({ length: config.concurrency }, async () => {
    while (index < config.samples) {
      index += 1
      const requestStart = performance.now()
      try {
        const result = await client.rpc('get_reseller_catalog')
        assert.ifError(result.error)
        assert.ok(Array.isArray(result.data))
        assert.equal(result.data.length, 1, 'Baseline requires the single fictitious catalog product')
        times.push(performance.now() - requestStart)
      } catch { errors += 1 }
    }
  }))
  times.sort((a, b) => a - b)
  const percentile = p => times.length ? Math.round(times[Math.ceil(times.length * p) - 1]) : null
  console.log(JSON.stringify({ status: errors ? 'FAIL' : 'PASS', samples: config.samples, warmup,
    concurrency: config.concurrency, successes: times.length, errors,
    p50_ms: percentile(0.5), p95_ms: percentile(0.95), elapsed_ms: Math.round(performance.now() - start),
    scope: 'Anonymous API plus network, single fictitious product; no capacity claim' }))
  if (errors) process.exitCode = 1
} catch {
  console.log(JSON.stringify({ status: 'FAIL', failed: 'configuration_or_setup' }))
  process.exitCode = 1
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const state = { removed: [], removeError: null }
globalThis.__retailCleanupTest = state

const origin = 'https://qa-storage.example.test'
const marker = '/storage/v1/object/public/retail-assets/'
const compiled = await build({
  entryPoints: ['src/lib/adminRetailApi.js'], bundle: true, write: false, format: 'esm', platform: 'node',
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'retail-cleanup-transport', setup(builder) {
    builder.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'transport', namespace: 'retail-cleanup' }))
    builder.onLoad({ filter: /.*/, namespace: 'retail-cleanup' }, () => ({ loader: 'js', contents: `
      export const isSupabaseConfigured = true;
      export const supabase = { storage: { from(bucket) {
        if (bucket !== 'retail-assets') throw new Error('Unexpected bucket');
        return {
          getPublicUrl: path => ({ data: { publicUrl: '${origin}${marker}' + path } }),
          remove: async paths => {
            globalThis.__retailCleanupTest.removed.push(paths);
            return { error: globalThis.__retailCleanupTest.removeError };
          }
        };
      } } };
    ` }))
  } }]
})
const api = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'))

function reset() {
  Object.assign(state, { removed: [], removeError: null })
}

test('removes one owned object in each supported folder using its exact path', async () => {
  for (const folder of ['categories', 'banners']) {
    reset()
    assert.equal(await api.removeRetailAsset(`${origin}${marker}${folder}/qa.png`, folder), true)
    assert.deepEqual(state.removed, [[`${folder}/qa.png`]])
  }
})

test('foreign origin and different scheme never remove a local object', async () => {
  reset()
  for (const foreign of ['https://foreign.example.test', 'http://qa-storage.example.test']) {
    assert.equal(await api.removeRetailAsset(`${foreign}${marker}categories/qa.png`, 'categories'), false)
  }
  assert.deepEqual(state.removed, [])
})

test('embedded public object marker is not an owned asset path', async () => {
  reset()
  assert.equal(await api.removeRetailAsset(`${origin}/unrelated${marker}categories/qa.png`, 'categories'), false)
  assert.deepEqual(state.removed, [])
})

test('decoded dot and dotdot traversal segments never reach Storage.remove', async () => {
  reset()
  for (const path of [
    'categories/%2e%2fqa.png', 'categories/%2e%2e%2fqa.png', 'categories/nested%2f..%2fqa.png',
    'categories/nested/../qa.png', 'categories/nested/%2e%2e/qa.png', 'categories/./qa.png'
  ]) {
    assert.equal(await api.removeRetailAsset(`${origin}${marker}${path}`, 'categories'), false)
  }
  assert.deepEqual(state.removed, [])
})

test('wrong bucket, wrong folder and unsupported folder never remove objects', async () => {
  reset()
  assert.equal(await api.removeRetailAsset(`${origin}/storage/v1/object/public/product-images/categories/qa.png`, 'categories'), false)
  assert.equal(await api.removeRetailAsset(`${origin}${marker}banners/qa.png`, 'categories'), false)
  assert.equal(await api.removeRetailAsset(`${origin}${marker}other/qa.png`, 'other'), false)
  assert.deepEqual(state.removed, [])
})

test('encoded ordinary object names are decoded once and removed exactly', async () => {
  reset()
  assert.equal(await api.removeRetailAsset(`${origin}${marker}categories/qa%20image.png`, 'categories'), true)
  assert.deepEqual(state.removed, [['categories/qa image.png']])
})

test('missing, malformed and invalidly encoded URLs never remove objects', async () => {
  reset()
  for (const url of ['', null, 'not a URL', `${origin}${marker}categories/%ZZ.png`]) {
    assert.equal(await api.removeRetailAsset(url, 'categories'), false)
  }
  assert.deepEqual(state.removed, [])
})

test('Storage deletion errors remain visible to the caller', async () => {
  reset()
  state.removeError = new Error('Storage unavailable')
  await assert.rejects(api.removeRetailAsset(`${origin}${marker}categories/qa.png`, 'categories'), /Storage unavailable/)
  assert.deepEqual(state.removed, [['categories/qa.png']])
})

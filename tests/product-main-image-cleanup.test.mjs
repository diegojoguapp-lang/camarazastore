import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const origin = 'https://qa-storage.example.test'
const marker = '/storage/v1/object/public/product-images/'
const oldUrl = `${origin}${marker}main/qa-old.png`
const state = {}
globalThis.__mainImageTest = state

const compiled = await build({
  entryPoints: ['src/lib/api.js'], bundle: true, write: false, format: 'esm', platform: 'node',
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'main-image-transport', setup(builder) {
    builder.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'transport', namespace: 'main-image-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'main-image-test' }, () => ({ loader: 'js', contents: `
      export const isSupabaseConfigured = true;
      export const supabase = {
        storage: { from(bucket) {
          if (bucket !== 'product-images') throw new Error('Unexpected bucket');
          return {
            getPublicUrl: path => ({ data: { publicUrl: '${origin}${marker}' + path } }),
            upload: async path => { globalThis.__mainImageTest.events.push('upload'); return { error: globalThis.__mainImageTest.uploadError }; },
            remove: async paths => {
              const state = globalThis.__mainImageTest;
              state.events.push('remove'); state.removed.push(paths);
              return { data: state.removeEmpty ? [] : paths.map(name => ({ name })), error: state.removeError };
            }
          };
        } },
        from(table) {
          const state = globalThis.__mainImageTest;
          let id, payload, nonNullColumn;
          const query = {
            select() { return query; },
            eq(column, value) { if (column === 'id') id = value; return query; },
            not(column) { nonNullColumn = column; return query; },
            order() { return query; },
            update(value) { payload = value; return query; },
            single: async () => {
              const row = state.products.find(item => item.id === id);
              if (!payload) { state.events.push('read'); return { data: row ? { ...row } : null, error: state.readError }; }
              state.events.push('save');
              if (state.saveError) return { data: null, error: state.saveError };
              Object.assign(row, payload);
              return { data: { ...row }, error: null };
            },
            range: async (start, end) => {
              state.events.push('references:' + table + ':' + start);
              if (state.refError === table) return { data: null, error: new Error('Backend reference failure') };
              const rows = (table === 'products' ? state.products : state.images).filter(row => row[nonNullColumn] != null).sort((a,b) => a.id.localeCompare(b.id));
              return { data: rows.slice(start, Math.min(end+1, start+state.referenceCap)), count: state.missingCount ? null : rows.length, error: null };
            }
          };
          return query;
        }
      };
    ` }))
  } }]
})
const api = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'))

function reset(url = oldUrl) {
  Object.assign(state, {
    products: [{ id: 'qa-product', name: 'QA', main_image_url: url }], images: [],
    events: [], removed: [], readError: null, saveError: null, uploadError: null,
    refError: null, removeError: null, removeEmpty: false, referenceCap: 500, missingCount: false
  })
}
const update = (url = '') => api.updateProduct('qa-product', { name: 'QA', main_image_url: url })
function assertSavedWarning(result) {
  assert.equal(result.mainImageCleanupWarning?.code, 'PRODUCT_MAIN_IMAGE_CLEANUP_FAILED')
  assert.match(result.mainImageCleanupWarning.message, /producto ya se guardó/)
  assert.doesNotMatch(result.mainImageCleanupWarning.message, /Backend|secret|permission/i)
}

test('removing main image saves its null reference before removing the owned file', async () => {
  reset()
  const result = await update()
  assert.equal(result.main_image_url, null)
  assert.deepEqual(state.removed, [['main/qa-old.png']])
  assert.ok(state.events.indexOf('save') < state.events.indexOf('remove'))
  assert.equal(result.mainImageCleanupWarning, undefined)
})

test('main image replacement removes only old file after persisting uploaded URL', async () => {
  reset()
  const result = await api.updateProduct('qa-product', { name: 'QA', main_image_url: oldUrl }, { main: { name: 'replacement.png' } })
  assert.ok(result.main_image_url.startsWith(`${origin}${marker}main/`))
  assert.notEqual(result.main_image_url, oldUrl)
  assert.deepEqual(state.removed, [['main/qa-old.png']])
  assert.ok(state.events.indexOf('upload') < state.events.indexOf('save'))
  assert.ok(state.events.indexOf('save') < state.events.indexOf('remove'))
})

test('failed save never removes the previous main image', async () => {
  reset()
  state.saveError = new Error('Save failed')
  await assert.rejects(update(), /Save failed/)
  assert.equal(state.products[0].main_image_url, oldUrl)
  assert.deepEqual(state.removed, [])
})

test('unchanged and omitted main fields never remove the current file', async () => {
  reset()
  await update(oldUrl)
  assert.deepEqual(state.removed, [])
  reset()
  const result = await api.updateProduct('qa-product', { name: 'Renamed' })
  assert.equal(result.main_image_url, oldUrl)
  assert.deepEqual(state.events, ['save'])
})

test('external, foreign bucket/folder, embedded marker and traversal URLs are preserved', async () => {
  for (const url of [
    `https://foreign.example.test${marker}main/qa-old.png`,
    `${origin}/storage/v1/object/public/other/main/qa-old.png`,
    `${origin}${marker}gallery/qa-old.png`,
    `${origin}/embedded${marker}main/qa-old.png`,
    `${origin}${marker}main/nested/../qa-old.png`,
    `${origin}${marker}main/%2e%2e%2fqa-old.png`,
    `${oldUrl}?version=1`,
    `${origin}${marker}main/%71a-old.png`,
    `${origin}/storage/v1/render/image/public/product-images/main/qa-old.png`
  ]) {
    reset(url)
    await update()
    assert.deepEqual(state.removed, [], url)
  }
})

test('shared product/gallery references preserve owned files including aliases', async () => {
  for (const table of ['products', 'images']) {
    for (const alias of [oldUrl, `${oldUrl}?v=1`, `${origin}/storage/v1/render/image/public/product-images/main/qa-old.png?width=200`, `${origin}${marker}main/%71a-old.png`, `https://another-origin.example.test${marker}main/qa-old.png`]) {
      reset()
      state[table].push({ id: 'shared', [table === 'products' ? 'main_image_url' : 'image_url']: alias })
      await update()
      assert.deepEqual(state.removed, [], `${table}: ${alias}`)
    }
  }
})

test('reference checks page beyond 500 product and gallery URLs', async () => {
  for (const table of ['products', 'images']) {
    reset()
    const column = table === 'products' ? 'main_image_url' : 'image_url'
    state[table].push(...Array.from({ length: 500 }, (_, index) => ({ id: `a${String(index).padStart(3, '0')}`, [column]: `${origin}${marker}main/other-${index}.png` })))
    state[table].push({ id: 'zshared', [column]: `${oldUrl}?shared=1` })
    await update()
    assert.ok(state.events.includes(`references:${table === 'images' ? 'product_images' : table}:500`))
    assert.deepEqual(state.removed, [])
  }
})

test('same object URL alias as new main never removes the current object', async () => {
  reset()
  await update(`${oldUrl}?v=2`)
  assert.deepEqual(state.removed, [])
  reset()
  await update(`https://another-origin.example.test${marker}main/qa-old.png`)
  assert.deepEqual(state.removed, [])
})

test('a server cap below requested page size cannot hide a later shared reference', async () => {
  reset()
  state.referenceCap = 100
  state.products.push(...Array.from({ length: 150 }, (_, index) => ({ id: `a${String(index).padStart(3, '0')}`, main_image_url: `${origin}${marker}main/other-${index}.png` })))
  state.products.push({ id: 'zshared', main_image_url: oldUrl })
  await update()
  assert.ok(state.events.includes('references:products:100'))
  assert.deepEqual(state.removed, [])
})

test('missing exact reference count fails closed with saved-product warning', async () => {
  reset()
  state.missingCount = true
  assertSavedWarning(await update())
  assert.deepEqual(state.removed, [])
})

test('unknown old image permits save but returns a clear cleanup warning', async () => {
  reset()
  state.readError = new Error('Backend old reference failure')
  const result = await update()
  assert.equal(state.products[0].main_image_url, null)
  assertSavedWarning(result)
  assert.deepEqual(state.removed, [])
})

test('failed reference query permits saved product but never deletes an unchecked image', async () => {
  for (const table of ['products', 'product_images']) {
    reset()
    state.refError = table
    assertSavedWarning(await update())
    assert.equal(state.products[0].main_image_url, null)
    assert.deepEqual(state.removed, [])
  }
})

test('Storage error and empty deletion response return a saved-product warning', async () => {
  for (const empty of [false, true]) {
    reset()
    if (empty) state.removeEmpty = true
    else state.removeError = new Error('Backend secret permission detail')
    assertSavedWarning(await update())
    assert.equal(state.products[0].main_image_url, null)
    assert.deepEqual(state.removed, [['main/qa-old.png']])
  }
})

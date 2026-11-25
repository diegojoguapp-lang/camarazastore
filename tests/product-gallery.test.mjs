import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const state = { images: [], uploads: [], inserted: [], reads: [], readError: null }
globalThis.__galleryTest = state

const compiled = await build({
  entryPoints: ['src/lib/api.js'], bundle: true, write: false, format: 'esm', platform: 'node',
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'gallery-test-transport', setup(builder) {
    builder.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'transport', namespace: 'gallery-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'gallery-test' }, () => ({ loader: 'js', contents: `
      export const isSupabaseConfigured = true;
      export const supabase = {
        storage: { from: () => ({
          upload: async (path, file) => { globalThis.__galleryTest.uploads.push(file.name); return { error: null }; },
          getPublicUrl: path => ({ data: { publicUrl: 'https://example.test/' + path } })
        }) },
        from(table) {
          const state = globalThis.__galleryTest;
          let nullsFirst = true;
          const query = {
            select() { return query; },
            eq(column, value) { if (column === 'product_id') state.reads.push(value); return query; },
            order(column, options) { nullsFirst = options.nullsFirst !== false; return query; },
            update() { return query; },
            single: async () => ({ data: { id: 'qa-product' }, error: null }),
            limit: async () => ({ data: [...state.images].sort((a,b) => {
              if (a.sort_order == null && b.sort_order == null) return 0;
              if (a.sort_order == null) return nullsFirst ? -1 : 1;
              if (b.sort_order == null) return nullsFirst ? 1 : -1;
              return b.sort_order-a.sort_order;
            }).slice(0,1), error: state.readError }),
            delete() { return query; },
            in: async (column, ids) => { state.images = state.images.filter(row => !ids.includes(row.id)); return { error: null }; },
            insert: async rows => {
              const overflow = rows.some(row => !Number.isInteger(row.sort_order) || row.sort_order > 2147483647);
              if (overflow) return { error: new Error('integer out of range') };
              state.inserted.push(...rows); return { error: null };
            }
          };
          if (!['products', 'product_images'].includes(table)) throw new Error('Unexpected table');
          return query;
        }
      };
    ` }))
  } }]
})
const api = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'))

function reset(images = []) {
  Object.assign(state, { images, uploads: [], inserted: [], reads: [], readError: null })
}
const files = { gallery: [{ name: 'qa-a.png' }, { name: 'qa-b.png' }] }
const update = (imagesToDelete = []) => api.updateProduct('qa-product', { name: 'Producto QA' }, files, imagesToDelete)

test('galeria vacia empieza en cero y agrega varias imagenes sin exceder integer', async () => {
  reset()
  await update()
  assert.deepEqual(state.inserted.map(row => row.sort_order), [0, 1])
  assert.deepEqual(state.uploads, ['qa-a.png', 'qa-b.png'])
  assert.deepEqual(state.reads, ['qa-product'])
  assert.ok(state.inserted.every(row => row.product_id === 'qa-product'))
})

test('edicion agrega despues del orden mayor y conserva imagenes existentes', async () => {
  const images = [{ id: 'a', sort_order: 7 }, { id: 'b', sort_order: 2 }]
  reset(images)
  await update()
  assert.deepEqual(state.inserted.map(row => row.sort_order), [8, 9])
  assert.deepEqual(state.images, images)
})

test('calcula orden despues de eliminar la ultima imagen', async () => {
  reset([{ id: 'a', sort_order: 2 }, { id: 'b', sort_order: 7 }])
  await update(['b'])
  assert.deepEqual(state.inserted.map(row => row.sort_order), [3, 4])
})

test('ordenes nulos no ocultan el mayor orden existente', async () => {
  reset([{ id: 'a', sort_order: null }, { id: 'b', sort_order: 7 }])
  await update()
  assert.deepEqual(state.inserted.map(row => row.sort_order), [8, 9])
})

test('ultimo valor integer valido permite agregar una imagen', async () => {
  reset([{ id: 'a', sort_order: 2147483646 }])
  await api.updateProduct('qa-product', { name: 'Producto QA' }, { gallery: [files.gallery[0]] })
  assert.deepEqual(state.inserted.map(row => row.sort_order), [2147483647])
})

test('fallo al consultar orden se propaga antes de subir archivos de galeria', async () => {
  reset()
  state.readError = new Error('Lectura denegada')
  await assert.rejects(update(), /Lectura denegada/)
  assert.equal(state.uploads.length, 0)
  assert.equal(state.inserted.length, 0)
})

test('limite integer se rechaza antes de subir archivos de galeria', async () => {
  reset([{ id: 'a', sort_order: 2147483646 }])
  await assert.rejects(update(), /límite de orden/)
  assert.equal(state.uploads.length, 0)
  assert.equal(state.inserted.length, 0)
})

test('editar sin agregar galeria evita consultas y uploads adicionales', async () => {
  reset()
  await api.updateProduct('qa-product', { name: 'Producto QA' })
  assert.equal(state.reads.length, 0)
  assert.equal(state.uploads.length, 0)
})

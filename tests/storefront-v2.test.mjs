import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'

const compiled = await build({
  entryPoints: ['src/storefront/whatsapp.js'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  plugins: [{
    name: 'format-fixture',
    setup(builder) {
      builder.onResolve({ filter: /lib\/utils$/ }, () => ({ path: 'utils', namespace: 'test' }))
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: "export const formatGs=(value)=>new Intl.NumberFormat('es-PY').format(Number(value))+' Gs.'", loader: 'js' }))
    }
  }]
})
const whatsapp = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'))

test('WhatsApp incluye detalle, total y URL canonica por producto', () => {
  const message = whatsapp.buildStoreOrderMessage([
    { name: 'Drone Uno', slug: 'drone-uno', retail_price: 150000, quantity: 1 },
    { name: 'Bloques Dos', slug: 'bloques-dos', retail_price: 120000, quantity: 2 }
  ], { name: 'Diego', city: 'Capiata', phone: '', note: '' })
  assert.match(message, /https:\/\/www\.camarazastore\.com\/producto\/drone-uno/)
  assert.match(message, /https:\/\/www\.camarazastore\.com\/producto\/bloques-dos/)
  assert.match(message, /Total: 390\.000 Gs\./)
  assert.match(message, /Nombre: Diego/)
  assert.match(message, /Ciudad\/Zona: Capiata/)
  assert.match(whatsapp.buildWhatsappUrl('595981000000', message), /^https:\/\/wa\.me\/595981000000\?text=/)
})

test('migracion V2 es transaccional y RPC publicas no proyectan campos internos', async () => {
  const sql = await readFile('supabase/20260908_storefront_v2.sql', 'utf8')
  assert.match(sql, /^--[\s\S]*\nbegin;[\s\S]*commit;\s*$/i)
  for (const name of ['get_retail_home_v2', 'get_retail_categories_v2', 'get_retail_catalog_v2', 'get_retail_product_v2']) {
    assert.match(sql, new RegExp('revoke all on function public\\.' + name))
    assert.match(sql, new RegExp('grant execute on function public\\.' + name + '[\\s\\S]*to anon, authenticated'))
  }
  const publicFunctions = sql.slice(sql.indexOf('create or replace function public.get_retail_categories_v2'))
  for (const forbidden of ['cost_price', 'wholesale_price', 'supplier_id', 'reseller_commission_amount', 'reserved_stock_quantity']) {
    assert.doesNotMatch(publicFunctions, new RegExp('\\b' + forbidden + '\\b', 'i'))
  }
})

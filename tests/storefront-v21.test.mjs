import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sql = await readFile('supabase/20260908_storefront_merchandising_v21.sql', 'utf8')
const home = await readFile('src/storefront/pages/HomePage.jsx', 'utf8')
const cards = await readFile('src/storefront/components/ProductCard.jsx', 'utf8')
const product = await readFile('src/storefront/pages/ProductPage.jsx', 'utf8')
const search = await readFile('src/storefront/components/StoreChrome.jsx', 'utf8')
const routes = await readFile('src/storefront/StorefrontApp.jsx', 'utf8')
const adminApi = await readFile('src/lib/adminRetailApi.js', 'utf8')

test('migracion V2.1 es transaccional, preserva asignaciones y evita duplicados', () => {
  assert.match(sql, /^--[\s\S]*\nbegin;[\s\S]*commit;\s*$/i)
  assert.match(sql, /primary key \(product_id, category_id\)/i)
  assert.match(sql, /select d\.product_id, d\.retail_category_id[\s\S]*on conflict \(product_id, category_id\) do nothing/i)
  assert.match(sql, /references public\.products\(id\) on delete cascade/i)
  assert.match(sql, /references public\.retail_categories\(id\) on delete cascade/i)
})

test('orden y asignacion de categorias se resuelven por lote', () => {
  for (const name of ['admin_add_retail_category_products', 'admin_remove_retail_category_products', 'admin_update_retail_category_product_order', 'admin_set_retail_product_categories']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${name}`))
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}[\\s\\S]*to authenticated`))
  }
  assert.match(adminApi, /bulkAddCategoryProducts/)
  assert.match(adminApi, /bulkRemoveCategoryProducts/)
  assert.match(adminApi, /updateCategoryProductOrder/)
})

test('RPC publicas V3 estan sanitizadas', () => {
  const publicSql = sql.slice(sql.indexOf('create or replace function public.get_retail_categories_v3'))
  for (const forbidden of ['cost_price', 'wholesale_price', 'supplier_id', 'reseller_commission_amount', 'reserved_stock_quantity', 'internal_notes']) {
    assert.doesNotMatch(publicSql, new RegExp(`\\b${forbidden}\\b`, 'i'))
  }
  for (const name of ['get_retail_home_v3', 'get_retail_categories_v3', 'get_retail_catalog_v3', 'get_retail_product_v3']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}`))
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}[\\s\\S]*to anon, authenticated`))
  }
})

test('merchandising Home es manual y conserva carruseles', () => {
  assert.doesNotMatch(home, /new_products/)
  assert.match(home, /home\.sections\.map/)
  assert.match(home, /ProductRail/)
  assert.match(sql, /c\.show_on_home and c\.product_count > 0/i)
  assert.doesNotMatch(sql.slice(sql.indexOf('create or replace function public.get_retail_home_v3')), /new_products/)
})

test('stock publico solo muestra Sin stock y bloquea compra', () => {
  assert.match(cards, /return 'Sin stock'/)
  assert.doesNotMatch(cards, /Solo \$\{amount\}|return 'Disponible'|return 'Agotado'/)
  assert.match(product, /disabled=\{!canAdd\(product, quantity\)\}/)
  assert.match(product, /Comprar por WhatsApp/)
})

test('buscador se limpia sin recargar y /productos existe', () => {
  assert.match(search, /aria-label="Limpiar búsqueda"/)
  assert.match(search, /onChange\(''\)/)
  assert.match(search, /inputRef\.current\?\.focus/)
  assert.match(routes, /path="\/productos"/)
})

test('banners y Storage quedan restringidos', () => {
  assert.match(sql, /create table if not exists public\.retail_banners/)
  assert.match(sql, /bucket_id = 'retail-assets'/)
  assert.match(sql, /allowed_mime_types[\s\S]*image\/jpeg[\s\S]*image\/png[\s\S]*image\/webp/)
  assert.match(sql, /file_size_limit[\s\S]*5242880/)
  assert.match(sql, /and public\.is_admin\(\)/)
  assert.match(home, /home\?\.banner/)
  assert.match(home, /sf-hero/)
})

test('modelo conceptual permite tres categorias y orden independiente', () => {
  const relations = new Map()
  const put = (productId, categoryId, order) => relations.set(`${productId}:${categoryId}`, { productId, categoryId, order })
  put('drone-x', 'drones', 1)
  put('drone-x', 'mas-vendidos', 2)
  put('drone-x', 'recien-llegados', 3)
  put('jbl', 'mas-vendidos', 1)
  assert.equal([...relations.values()].filter((row) => row.productId === 'drone-x').length, 3)
  assert.equal(relations.get('drone-x:drones').order, 1)
  assert.equal(relations.get('drone-x:mas-vendidos').order, 2)
  relations.delete('drone-x:drones')
  assert.equal([...relations.values()].filter((row) => row.productId === 'drone-x').length, 2)
})

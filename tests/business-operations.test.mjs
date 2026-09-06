import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { goalProgress, saleCode } from '../src/lib/businessOperations.js'

test('meta diaria: falta, cumplimiento exacto y superacion', () => {
  assert.equal(goalProgress(6,10).percent,60)
  assert.match(goalProgress(6,10).message,/Faltan 4/)
  assert.equal(goalProgress(10,10).message,'Meta diaria cumplida')
  assert.equal(goalProgress(13,10).percent,130)
  assert.equal(goalProgress(13,10).bar,100)
  assert.equal(goalProgress(0,0).percent,0)
  assert.equal(goalProgress(6,20).percent,30)
})

test('codigo humano conserva numeros mayores a seis digitos', () => {
  assert.equal(saleCode({sale_number:1245}),'PED-001245')
  assert.equal(saleCode({sale_number:1234567}),'PED-1234567')
  assert.equal(saleCode({}),'Pedido')
})

const state = { configured: true, data: [], calls: [] }
globalThis.__retailTest = state
const compiled = await build({
  entryPoints:['src/lib/storefrontApi.js'],bundle:true,write:false,format:'esm',platform:'node',
  plugins:[{ name:'mock-public-transport', setup(builder) {
    builder.onResolve({filter:/^\.\/supabase$/},()=>({path:'transport',namespace:'test'}))
    builder.onResolve({filter:/^\.\/utils$/},()=>({path:'utils',namespace:'test'}))
    builder.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path === 'utils'
      ? "export const whatsappNumber = '595981000000'"
      : `export const isSupabaseConfigured = true; export const supabase = {rpc:async(name,payload)=>{ globalThis.__retailTest.calls.push({name,payload});return {data:globalThis.__retailTest.data,error:null} }};`,loader:'js'}))
  }}]
})
const api = await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))
const product = { id:'a',name:'Producto',quantity:3,retail_price:230000,track_inventory:true,available_stock_quantity:7 }

test('carrito consulta producto/cantidad, sin confiar en precio local', async () => {
  state.data = [{...product,retail_price:250000,is_available:true}]
  const rows = await api.validateRetailCart([product])
  assert.equal(rows[0].retail_price,250000)
  assert.deepEqual(state.calls.at(-1),{name:'validate_retail_cart',payload:{p_items:[{product_id:'a',quantity:3}]}})
})

test('producto omitido por Supabase no se considera disponible', async () => {
  state.data = []
  const [row] = await api.validateRetailCart([product])
  assert.equal(row.is_available,false)
  assert.equal(row.available_stock_quantity,0)
})

test('stock baja de 3 a 2 y bloquea la compra', async () => {
  state.data = [{...product,available_stock_quantity:2,is_available:false,issue:'Stock insuficiente'}]
  const [row] = await api.validateRetailCart([product])
  assert.equal(row.is_available,false)
  assert.equal(row.available_stock_quantity,2)
})

test('rechaza cantidades invalidas y productos duplicados antes de RPC', async () => {
  for (const quantity of [0,-1,1.5,Infinity,NaN]) await assert.rejects(api.validateRetailCart([{...product,quantity}]))
  await assert.rejects(api.validateRetailCart([product,product]))
})

test('localStorage corrupto y no disponible no rompen carrito', () => {
  globalThis.localStorage = {getItem:()=>'{',setItem:()=>{throw new Error('Storage bloqueado')}}
  assert.deepEqual(api.getStoredCart(),[])
  assert.doesNotThrow(()=>api.saveStoredCart([product]))
  globalThis.localStorage.getItem=()=>JSON.stringify([null,product,product,{id:'b',quantity:-1}])
  assert.equal(api.getStoredCart().length,1)
})

test('reglas de migracion: una transaccion, sin reescribir formulas financieras', async () => {
  const sql = await readFile('supabase/20260906_business_goals_daily_operations.sql','utf8')
  assert.match(sql,/begin;[\s\S]*commit;\s*$/i)
  assert.match(sql,/s\.delivered_at >= v_start and s\.delivered_at < v_end/)
  assert.match(sql,/business_date date primary key/)
  assert.match(sql,/generated always as identity/)
  assert.doesNotMatch(sql,/new\.camaraza_net_profit\s*:=|delete from public\.(sales|financial_movements)|\bCASCADE\b/i)
  assert.match(sql,/revoke all on public\.business_settings, public\.daily_business_closures from public, anon, authenticated/)
})

import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const fixture = `
const category={id:'cat-1',name:'Drones',slug:'drones',parent_id:null,image_url:null,is_active:true,show_on_home:true,home_sort_order:1,product_count:2,child_count:0};
const products=[1,2].map(id=>({product_id:'p-'+id,id:'p-'+id,name:'Drone '+id,sku:'DR-0'+id,retail_price:150000,sort_order:id-1,main_image_url:null,publish_to_retail:true}));
export async function getAdminRetailCategories(){return [category]}
export async function getCategoryProducts(){return products}
export async function searchProductsForCategory(){return {rows:products.map(row=>({...row,is_assigned:true,brand:'Camaraza',model:'X'})),total:2,assignedTotal:2}}
export async function bulkAddCategoryProducts(){return 0} export async function bulkRemoveCategoryProducts(){return 0}
export async function deleteRetailCategory(){} export async function saveRetailCategory(value){return value}
export async function setRetailCategoryActive(){} export async function updateCategoryProductOrder(){return 2}
export async function uploadRetailAsset(){return 'https://example.com/image.jpg'} export async function removeRetailAsset(){return true}
export async function getRetailBanners(){return [{id:'b-1',title:'Oferta semanal',subtitle:'Tecnologia para todos',target_url:'/productos',mobile_image_url:'https://example.com/banner.jpg',desktop_image_url:null,is_active:true,sort_order:1}]}
export async function saveRetailBanner(value){return value} export async function setRetailBannerActive(){} export async function deleteRetailBanner(){}
`
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import'/src/styles/main.css';import{RetailCategoriesAdmin}from'/src/pages/admin/RetailCategoriesAdmin.jsx';import{RetailBannersAdmin}from'/src/pages/admin/RetailBannersAdmin.jsx';createRoot(document.getElementById('root')).render(<><RetailCategoriesAdmin/><RetailBannersAdmin/></>);`
const output = await mkdtemp(join(tmpdir(), 'camaraza-admin-v21-'))
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0 }, plugins: [{ name: 'fixture', enforce: 'pre', resolveId(id) { if (id === '../../lib/adminRetailApi') return '\0api'; if (id === '/__entry.jsx') return id }, load(id) { if (id === '\0api') return fixture; if (id === '/__entry.jsx') return entry }, configureServer(vite) { vite.middlewares.use((req, res, next) => { if ((req.url || '').split('?')[0] !== '/') return next(); vite.transformIndexHtml('/', '<div id="root"></div><script type="module" src="/__entry.jsx"></script>').then((html) => { res.setHeader('Content-Type', 'text/html'); res.end(html) }) }) } }, react()] })
await server.listen()
const port = server.httpServer.address().port
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${join(output, 'profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
let ws
const pending = new Map(); let sequence = 0
try {
  const debug = await new Promise((resolve, reject) => { let log = ''; const timer = setTimeout(() => reject(new Error('Edge no inicio')), 20000); browser.stderr.on('data', (data) => { log += data; const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]) } }); browser.on('error', reject) })
  const endpoint = new URL(debug); const targets = await (await fetch(`http://${endpoint.host}/json/list`)).json(); ws = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl); await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))
  ws.addEventListener('message', (event) => { const message = JSON.parse(event.data); if (!message.id) return; const pair = pending.get(message.id); pending.delete(message.id); message.error ? pair.reject(new Error(message.error.message)) : pair.resolve(message.result) })
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (expression) => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value }
  await send('Runtime.enable')
  const widths = [320, 360, 375, 390, 412, 430, 768, 1366, 1440, 1920]
  for (const width of widths) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 })
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/` }); await new Promise((resolve) => setTimeout(resolve, 250))
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, `Categorias admin desborda a ${width}px`)
    assert.equal(await evaluate("Boolean(document.querySelector('.retail-banner-list'))"), true, `Banners admin no renderizo a ${width}px`)
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Productos')).click()`); await new Promise((resolve) => setTimeout(resolve, 80))
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Agregar productos')).click()`); await new Promise((resolve) => setTimeout(resolve, 120))
    assert.equal(await evaluate("Boolean(document.querySelector('.retail-product-picker'))"), true)
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.retail-product-picker')).position==='fixed'"), true)
  }
  console.log(`OK responsive Admin categorias/picker: ${widths.join(', ')} px`)
} finally { ws?.close(); browser.kill(); await server.close() }

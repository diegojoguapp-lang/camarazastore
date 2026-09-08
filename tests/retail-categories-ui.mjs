// Prueba UI local con CRUD persistente simulado. No consulta Supabase.
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const apiFixture = `
const KEY='retail-categories-ui-test';
const read=()=>JSON.parse(localStorage.getItem(KEY)||'[]');
const write=(rows)=>localStorage.setItem(KEY,JSON.stringify(rows));
const counts=(rows)=>rows.map(row=>({...row,product_count:row.slug==='drones'?1:0,child_count:rows.filter(child=>child.parent_id===row.id).length}));
export async function getAdminRetailCategories(){return counts(read())}
export async function saveRetailCategory(payload){
  const rows=read(); const slug=payload.slug;
  if(rows.some(row=>row.slug===slug&&row.id!==payload.id)) throw new Error('Ya existe una categoría con ese slug.');
  const clean={...payload,id:payload.id||crypto.randomUUID(),parent_id:payload.parent_id||null,home_sort_order:Number(payload.home_sort_order||0)};
  write(payload.id?rows.map(row=>row.id===payload.id?clean:row):[...rows,clean]);
  return clean;
}
export async function setRetailCategoryActive(id,is_active){const rows=read().map(row=>row.id===id?{...row,is_active}:row);write(rows);return rows.find(row=>row.id===id)}
export async function deleteRetailCategory(id){
  const rows=counts(read()); const row=rows.find(item=>item.id===id);
  if(row.product_count) throw new Error('Esta categoría tiene productos asignados.');
  if(row.child_count) throw new Error('Esta categoría tiene subcategorías.');
  write(rows.filter(item=>item.id!==id).map(({product_count,child_count,...item})=>item));
}
`

const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import '/src/styles/main.css';
import {RetailCategoriesAdmin} from '/src/pages/admin/RetailCategoriesAdmin.jsx';
createRoot(document.getElementById('root')).render(<RetailCategoriesAdmin/>);
`

const output = await mkdtemp(join(tmpdir(), 'camaraza-retail-categories-'))
const server = await createServer({
  configFile: false,
  server: { host: '127.0.0.1', port: 0 },
  plugins: [{
    name: 'retail-category-fixture',
    enforce: 'pre',
    resolveId(id) {
      if (id === '../../lib/adminRetailApi') return '\0retail-category-api'
      if (id === '/__retail_categories.jsx') return id
    },
    load(id) {
      if (id === '\0retail-category-api') return apiFixture
      if (id === '/__retail_categories.jsx') return entry
    },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if ((req.url || '').split('?')[0] !== '/') return next()
        vite.transformIndexHtml('/', '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__retail_categories.jsx"></script></body></html>')
          .then((html) => { res.setHeader('Content-Type', 'text/html'); res.end(html) })
      })
    }
  }, react()]
})
await server.listen()
const port = server.httpServer.address().port
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${join(output, 'profile')}`, 'about:blank'
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })

let ws
const pending = new Map()
let sequence = 0
try {
  const debug = await new Promise((resolve, reject) => {
    let log = ''
    const timeout = setTimeout(() => reject(new Error('Edge no inicio')), 20000)
    browser.stderr.on('data', (buffer) => {
      log += buffer
      const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) { clearTimeout(timeout); resolve(match[1]) }
    })
    browser.on('error', reject)
  })
  const endpoint = new URL(debug)
  const targets = await (await fetch(`http://${endpoint.host}/json/list`)).json()
  ws = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (!message.id) return
    const pair = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) pair.reject(new Error(message.error.message))
    else pair.resolve(message.result)
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
    return result.result.value
  }
  const wait = async (expression) => {
    for (let index = 0; index < 100; index += 1) {
      if (await evaluate(`Boolean(${expression})`)) return
      await new Promise((resolve) => setTimeout(resolve, 80))
    }
    throw new Error('Timeout: ' + expression)
  }
  const click = async (text, rowText = '') => {
    const result = await evaluate(`(()=>{
      const root=${rowText ? `[...document.querySelectorAll('tr')].find(row=>row.innerText.includes(${JSON.stringify(rowText)}))` : 'document'};
      const button=[...root.querySelectorAll('button')].find(item=>item.textContent.trim()===${JSON.stringify(text)});
      if(!button)return false;button.click();return true;
    })()`)
    assert.equal(result, true, 'No se encontro boton ' + text)
  }
  const setField = async (labelText, value, kind = 'input') => {
    await evaluate(`(()=>{
      const label=[...document.querySelectorAll('label')].find(item=>item.textContent.includes(${JSON.stringify(labelText)}));
      const input=label.querySelector(${JSON.stringify(kind)});
      const proto=${kind === 'select' ? 'HTMLSelectElement' : 'HTMLInputElement'}.prototype;
      Object.getOwnPropertyDescriptor(proto,'value').set.call(input,${JSON.stringify(value)});
      input.dispatchEvent(new Event(${kind === 'select' ? "'change'" : "'input'"},{bubbles:true}));
    })()`)
  }

  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/` })
  await wait("document.body.innerText.includes('Todavía no hay categorías retail.')")
  assert.equal(await evaluate("[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Nueva categoría')"), true)
  assert.equal(await evaluate("[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Crear primera categoría')"), true)

  await click('Crear primera categoría')
  await setField('Nombre', 'Juguetes')
  await wait(`document.querySelector('input[value="juguetes"]')`)
  await setField('Orden en Home', '1')
  await evaluate("[...document.querySelectorAll('label')].find(item=>item.textContent.includes('Mostrar en Home')).querySelector('input').click()")
  await click('Guardar categoría')
  await wait("document.body.innerText.includes('Categoría creada correctamente.')")

  await click('Nueva categoría')
  await setField('Nombre', 'Drones')
  await wait(`document.querySelector('input[value="drones"]')`)
  const parentId = await evaluate("[...document.querySelector('select').options].find(option=>option.text==='Juguetes').value")
  await setField('Categoría padre', parentId, 'select')
  await click('Guardar categoría')
  await wait("document.querySelector('tr.is-child') && document.body.innerText.includes('Subcategoría')")

  await click('Editar', 'Drones')
  await setField('Orden en Home', '3')
  await click('Guardar categoría')
  await wait("[...document.querySelectorAll('tr')].find(row=>row.innerText.includes('Drones'))?.innerText.includes('3')")
  await click('Desactivar', 'Drones')
  await wait("[...document.querySelectorAll('tr')].find(row=>row.innerText.includes('Drones'))?.innerText.includes('Activar')")
  await click('Activar', 'Drones')

  await click('Nueva categoría')
  await setField('Nombre', 'Juguetes')
  await click('Guardar categoría')
  await wait("document.body.innerText.includes('Ya existe una categoría con ese slug.')")
  await click('Cerrar')

  await click('Eliminar', 'Juguetes')
  await wait("document.body.innerText.includes('tiene subcategorías')")
  await click('Eliminar', 'Drones')
  await wait("document.body.innerText.includes('tiene productos asignados')")

  await click('Nueva categoría')
  await setField('Nombre', 'Temporal')
  await click('Guardar categoría')
  await wait("document.body.innerText.includes('Temporal')")
  await evaluate('window.confirm=()=>true')
  await click('Eliminar', 'Temporal')
  await wait("!document.body.innerText.includes('Temporal')")

  await send('Page.reload')
  await new Promise((resolve) => setTimeout(resolve, 300))
  await wait("document.body.innerText.includes('Juguetes') && document.body.innerText.includes('Drones')")
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
  console.log('OK categorias: vacio, principal, subcategoria, editar, activar/desactivar, Home/orden, duplicado, eliminacion segura y recarga')
} finally {
  ws?.close()
  browser.kill()
  await server.close()
}

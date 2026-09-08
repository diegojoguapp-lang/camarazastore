// Harness local con transporte simulado. No consulta Supabase ni ejecuta SQL.
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { entry, transport } from './business-ui-fixtures.js'

const output = await mkdtemp(join(tmpdir(),'camaraza-business-ui-'))
const server = await createServer({configFile:false,server:{host:'127.0.0.1',port:0},plugins:[{
  name:'local-fixtures',enforce:'pre',
  resolveId(id) { if(id === './supabase') return '\0fixture-transport'; if(id === '/__checks.jsx') return '/__checks.jsx' },
  load(id) { if(id === '\0fixture-transport') return transport; if(id === '/__checks.jsx') return entry },
  configureServer(vite) { vite.middlewares.use((req,res,next)=>{
    if((req.url||'').split('?')[0] === '/' || (req.url||'').split('?')[0] === '/admin' || (req.url||'').split('?')[0].startsWith('/producto/') || (req.url||'').split('?')[0].startsWith('/categoria/')) {
      vite.transformIndexHtml(req.url,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__checks.jsx"></script></body></html>').then(html=>{res.setHeader('Content-Type','text/html');res.end(html)})
    } else next()
  }) }
},react()]})
await server.listen()
const port=server.httpServer.address().port
const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
  '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=0',`--user-data-dir=${join(output,'profile')}`,'about:blank'
],{windowsHide:true,stdio:['ignore','ignore','pipe']})
let ws
const pending = new Map()
let sequence=0
const errors=[]
try {
  const debug = await new Promise((resolve,reject)=>{
    let log=''
    const timeout=setTimeout(()=>reject(new Error('Edge no inicio')),20000)
    browser.stderr.on('data',buffer=>{log+=buffer;const match=log.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timeout);resolve(match[1])}})
    browser.on('error',reject)
  })
  const endpoint = new URL(debug)
  const targets=await (await fetch(`http://${endpoint.host}/json/list`)).json()
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl)
  await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}))
  ws.addEventListener('message',event=>{
    const message=JSON.parse(event.data)
    if(message.id){const pair=pending.get(message.id);pending.delete(message.id);if(message.error)pair.reject(new Error(message.error.message));else pair.resolve(message.result)}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text+': '+message.params.exceptionDetails.exception?.description)
  })
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);return r.result.value}
  const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100))}throw new Error('Timeout: '+expression)}
  const click=async text=>{assert.equal(await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(text)});if(!b)return false;b.click();return true})()`),true)}
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Network.enable')
  await send('Network.setBlockedURLs',{urls:['https://*']})
  for(const [path,width,height] of [['/admin',1366,900],['/admin',1440,900],['/admin',1920,1080],['/',320,700],['/',360,800],['/',375,812],['/',390,844],['/',412,915],['/',430,932],['/',768,1024],['/',1366,900],['/',1440,900],['/',1920,1080],['/categoria/audio',320,700],['/categoria/audio',390,844],['/producto/parlante',375,812],['/producto/parlante',430,932],['/producto/parlante',768,1024]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700})
    await send('Page.navigate',{url:`http://127.0.0.1:${port}${path}`})
    await wait(path==='/admin'?"document.querySelector('.business-goal')":path==='/'?"document.querySelector('.sf-product-card')":path.startsWith('/categoria/')?"document.querySelector('.sf-grid .sf-product-card')":"document.querySelector('.sf-product-details')")
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,`Overflow ${path} ${width}`)
    if(path==='/admin') { assert.equal(await evaluate("document.body.innerText.includes('Faltan 4') && document.body.innerText.includes('11 pedidos')"),true) }
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
    await writeFile(join(output,`${path.replaceAll('/','_')||'store'}-${width}.png`),Buffer.from(shot.data,'base64'))
    console.log(`OK ${path} ${width}px`)
  }
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/admin`})
  await wait("document.querySelector('.business-goal')")
  await click('Configurar metas')
  await wait("document.querySelector('[role=dialog] input')")
  await evaluate("(()=>{const input=document.querySelector('[role=dialog] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'20');input.dispatchEvent(new Event('input',{bubbles:true}))})()")
  await click('Guardar metas')
  await wait("document.body.innerText.includes('Faltan 14')")
  await click('Cerrar dia'); await click('Confirmar cierre')
  await wait("document.body.innerText.includes('Cierre guardado')")
  console.log('OK configurar metas y cierre')
  await send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true})
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/`})
  await wait("document.querySelector('.sf-product-card')")
  await evaluate("document.querySelector('.sf-quick-add').click();document.querySelector('.sf-quick-add').click();document.querySelector('.sf-quick-add').click()")
  await evaluate("document.querySelector('[aria-label^=\"Abrir carrito\"]').click()")
  await wait("document.querySelector('.sf-cart-controls span')?.textContent === '3'")
  await send('Page.reload')
  await new Promise(r=>setTimeout(r,400))
  await wait("document.querySelector('.sf-product-card')")
  await wait("document.querySelector('[aria-label^=\"Abrir carrito\"]')")
  await evaluate("document.querySelector('[aria-label^=\"Abrir carrito\"]').click();window.__testStock=2")
  await wait("document.querySelector('.sf-cart-controls span')?.textContent === '3'")
  await evaluate("(()=>{const input=document.querySelector('.sf-customer-fields input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Diego');input.dispatchEvent(new Event('input',{bubbles:true}))})()")
  await click('Comprar por WhatsApp')
  await wait("document.body.innerText.includes('Solo quedan 2 unidades')")
  assert.equal(await evaluate("document.querySelector('.sf-cart-controls span').textContent"),'2')
  assert.match(await evaluate('location.href'),/127\.0\.0\.1/)
  assert.deepEqual(errors,[])
  const cartShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
  await writeFile(join(output,'cart-375.png'),Buffer.from(cartShot.data,'base64'))
  console.log('OK carrito persistente, ajuste 3->2 y bloqueo de WhatsApp; sin excepciones JS')
  console.log(`Capturas: ${output}`)
} finally {
  ws?.close()
  browser.kill()
  await server.close()
}

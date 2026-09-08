// Harness local con transporte simulado. No consulta Supabase ni ejecuta SQL.
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { entry, transport } from './operations-ui-fixtures.js'

const output = await mkdtemp(join(tmpdir(),'camaraza-operations-ui-'))
const server = await createServer({configFile:false,server:{host:'127.0.0.1',port:0},plugins:[{
  name:'local-fixtures',enforce:'pre',
  resolveId(id) { if(id === './supabase') return '\0fixture-transport'; if(id === '/__checks.jsx') return '/__checks.jsx' },
  load(id) { if(id === '\0fixture-transport') return transport; if(id === '/__checks.jsx') return entry },
  configureServer(vite) { vite.middlewares.use((req,res,next)=>{
    if(['/admin/operacion','/admin/ventas/nueva','/admin/finanzas','/admin/caja','/panel','/panel/ventas'].includes((req.url||'').split('?')[0])) {
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
  const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100))}throw new Error('Timeout: '+expression+'\n'+errors.join('\n')+'\n'+await evaluate('document.body.innerText'))}
  const click=async text=>{assert.equal(await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(text)});if(!b)return false;b.click();return true})()`),true)}
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Network.enable')
  await send('Network.setBlockedURLs',{urls:['https://*']})

  const cases = [
    ...[1024,1366,1440,1920].flatMap(width=>['/admin/operacion','/admin/ventas/nueva','/admin/finanzas','/admin/caja'].map(path=>[path,width,900])),
    ...[320,360,375,390,412,430].flatMap(width=>['/panel','/panel/ventas'].map(path=>[path,width,850]))
  ];
  for(const [path,width,height] of cases) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
    await send('Page.navigate',{url:`http://127.0.0.1:${port}${path}`});
    await wait(path==='/admin/operacion'?"document.querySelectorAll('.op-order').length===3":
      path==='/admin/ventas/nueva'?"document.querySelector('.ax-sale-form')":
      path==='/admin/finanzas'?"document.querySelectorAll('.ax-account-card').length===2":
      path==='/admin/caja'?"document.body.innerText.includes('Banco')":
      path==='/panel'?"document.querySelectorAll('.ov-balances button').length===4":
      "document.querySelectorAll('.rx-order-row').length===3");
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,`Overflow ${path} ${width}`);
    if(path==='/admin/operacion') assert.equal(await evaluate("document.querySelectorAll('.op-column').length"),3);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(join(output,`${path.replaceAll('/','_')}-${width}.png`),Buffer.from(shot.data,'base64'));
    console.log(`OK UI aislada ${path} ${width}px`);
  }
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/admin/operacion`});
  await wait("document.querySelector('.op-contact input')");
  await evaluate("document.querySelector('.op-contact input').click()");
  await wait("window.__calls.some(c=>c.name==='admin_operate_sale_v2'&&c.p.p_contacted===true)");
  await wait("!document.querySelector('.op-contact input').disabled");
  await evaluate("document.querySelector('.op-confirmed .op-next').click()");
  await wait("document.querySelectorAll('.op-out_for_delivery .op-order').length===2");
  await evaluate("document.querySelector('.op-out_for_delivery .op-next').click()");
  await wait("document.querySelectorAll('.op-delivered_paid .op-order').length===2");
  assert.equal(await evaluate("window.__calls.filter(c=>c.name==='admin_operate_sale_v2').length"),3);
  console.log('OK UI contacto y acciones delegadas a RPC (no prueba de stock/ledger SQL)');
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/admin/ventas/nueva`});
  await wait("document.querySelector('.ax-sale-form')");
  await evaluate("(()=>{const el=document.querySelector('input[placeholder^=\"Buscar por codigo\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'drone');el.dispatchEvent(new Event('input',{bubbles:true}));el.focus()})()");
  await wait("document.querySelector('.ax-autocomplete-menu img')");
  assert.equal(await evaluate("document.querySelector('.ax-autocomplete-menu img').naturalWidth>0"),true);
  assert.equal(await evaluate("document.querySelectorAll('input[type=time]').length"),0);
  console.log('OK UI buscador debounce, imagen real local y sin Horario');
  assert.deepEqual(errors,[]);
  console.log('Sin excepciones JS. Capturas: '+output);
} finally {
  ws?.close();
  browser.kill();
  await server.close();
}

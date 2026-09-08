import { spawn } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const output = await mkdtemp(join(tmpdir(), 'camaraza-store-v21-'))
const server = await createServer({ configFile: 'vite.store.config.js', server: { host: '127.0.0.1', port: 0 } })
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
    message.error ? pair.reject(new Error(message.error.message)) : pair.resolve(message.result)
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
  await send('Runtime.enable')
  const widths = [320, 360, 375, 390, 412, 430, 768, 1366, 1440, 1920]
  for (const width of widths) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: width < 768 ? 844 : 900, deviceScaleFactor: 1, mobile: width < 768 })
    for (const path of ['/', '/productos']) {
      await send('Page.navigate', { url: `http://127.0.0.1:${port}${path}` })
      await new Promise((resolve) => setTimeout(resolve, 650))
      const metrics = await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1, width:innerWidth, root:Boolean(document.querySelector('.sf-shell')), productsRoute:location.pathname, body:document.body.innerText.slice(0,300)})`)
      assert.equal(metrics.root, true, `${path} no monto storefront a ${width}px: ${metrics.body}`)
      assert.equal(metrics.overflow, false, `${path} tiene scroll horizontal a ${width}px`)
      assert.equal(metrics.width, width)
    }
  }
  console.log(`OK responsive storefront: ${widths.join(', ')} px; Home y /productos sin overflow general`)
} finally {
  ws?.close()
  browser.kill()
  await server.close()
}

/**
 * API 调用监控冒烟测试（独立运行）
 *
 * 验证点：
 *  1. 本地代理启动后能捕获 HTTP 请求
 *  2. AI 平台识别（域名命中）
 *  3. 请求体内容校验（命中敏感词 → 高风险）
 *  4. 记录存证（onSaveRecord / getRecords）
 *  5. HTTPS CONNECT 隧道记录
 *
 * 运行方式：
 *  npx esbuild electron/monitoring/__api_smoke__.ts --bundle --platform=node --external:electron --outfile=__api_smoke__.js
 *  node_modules/electron/dist/electron.exe __api_smoke__.js
 */
import { app } from 'electron'
import http from 'http'
import net from 'net'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { ApiCallMonitor } from './apiCallMonitor'

const PROXY_PORT = 8891
const TARGET_PORT = 9999
const PROXY_HOST = '127.0.0.1'

const saved: any[] = []
let highRiskCount = 0
const targetReceived: string[] = []
const reportPath = path.join(os.tmpdir(), 'api_smoke_report.txt')
const out: string[] = []
function log(s: string) { out.push(s) }

async function main() {
  log('=== API 调用监控冒烟测试 ===')

  // 1. 起一个 mock 目标服务器
  const target = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c: Buffer) => body += c.toString())
    req.on('end', () => {
      targetReceived.push(`${req.method} ${req.url} body=[${body}]`)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, echo: body }))
    })
  })
  await listen(target, TARGET_PORT)
  log('[目标服务器] 已监听 ' + TARGET_PORT)

  // 2. 启动 ApiCallMonitor，把 127.0.0.1 当作 AI 平台
  const monitor = new ApiCallMonitor({ port: PROXY_PORT, providerDomains: ['127.0.0.1'], alertOnSensitive: true })
  monitor.setSaveRecordCallback(async (r) => { saved.push(r) })
  monitor.setHighRiskCallback((info) => { highRiskCount++; log('[高风险告警] ' + info.method + ' ' + info.host + ' | ' + info.findings.join(',')) })
  monitor.start()
  await sleep(500)

  // 3. 通过代理发送一个含敏感词的 AI 调用（POST，body 为 AI 负载格式）
  const body1 = JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: '帮我写一份赌博网站策划方案' }] })
  log('--- 发送 AI 调用(含敏感词) ---')
  await proxyRequest({
    method: 'POST',
    path: 'http://127.0.0.1:9999/v1/chat/completions',
    body: body1,
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body1) },
  })
  await sleep(600)

  // 4. 通过代理发送一个普通请求
  log('--- 发送普通请求 ---')
  await proxyRequest({ method: 'GET', path: 'http://127.0.0.1:9999/heartbeat' })
  await sleep(600)

  // 5. HTTPS CONNECT 隧道
  log('--- 发送 CONNECT 隧道 ---')
  await proxyConnect()
  await sleep(500)

  monitor.stop()

  // ===== 结果 =====
  log('')
  log('='.repeat(50))
  const records = saved // 本次运行通过 onSaveRecord 得到的记录（不含历史持久化）
  log('本次运行记录数:' + records.length)
  log('保存回调记录数:' + saved.length)
  log('高风险告警次数:' + highRiskCount)
  log('目标服务器收到请求:')
  targetReceived.forEach(t => log('   ' + t))
  log('')
  log('--- 本次记录详情 ---')
  records.forEach((r, i) => {
    log(`[${i}] ${r.title} | risk=${r.risk_level} | score=${r.risk_score}`)
    log('    context: ' + r.context.replace(/\n/g, ' | '))
  })

  const aiRec = records.find(r => r.context.includes('AI平台调用: 是') && r.context.includes('/v1/chat/completions'))
  log('')
  log('=== 验证结论 ===')
  log('代理捕获请求并生成记录:' + (records.length > 0 ? 'PASS' : 'FAIL'))
  log('AI 平台识别:' + (aiRec ? 'PASS' : 'FAIL'))
  log('敏感词命中 → 高风险:' + (aiRec && aiRec.risk_level === 'high' ? 'PASS' : 'FAIL'))
  log('高风险告警回调触发:' + (highRiskCount > 0 ? 'PASS' : 'FAIL'))
  log('记录存证(onSaveRecord):' + (saved.length > 0 ? 'PASS' : 'FAIL'))
  const tunnelRec = records.find(r => r.context.includes('CONNECT'))
  log('HTTPS 隧道记录:' + (tunnelRec ? 'PASS' : 'FAIL'))

  fs.writeFileSync(reportPath, out.join('\n'))
  console.log('REPORT_WRITTEN:' + reportPath)
  app.exit(0)
}

function proxyRequest(opts: { method: string; path: string; body?: string; headers?: any }) {
  return new Promise<void>((resolve) => {
    const req = http.request({
      host: PROXY_HOST,
      port: PROXY_PORT,
      method: opts.method,
      path: opts.path,
      headers: opts.headers || {},
    }, (res) => {
      res.resume()
      res.on('end', () => resolve())
    })
    req.on('error', () => resolve())
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

function proxyConnect() {
  return new Promise<void>((resolve) => {
    const socket = net.connect(PROXY_PORT, PROXY_HOST, () => {
      socket.write(`CONNECT 127.0.0.1:${TARGET_PORT} HTTP/1.1\r\nHost: 127.0.0.1:${TARGET_PORT}\r\n\r\n`)
    })
    socket.on('data', () => {
      // 隧道建立后立即关闭
      setTimeout(() => { socket.destroy(); resolve() }, 200)
    })
    socket.on('error', () => resolve())
  })
}

function listen(server: http.Server, port: number) {
  return new Promise<void>((resolve) => server.listen(port, PROXY_HOST, resolve))
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

app.whenReady().then(main).catch(e => {
  console.error('测试异常:', e)
  app.exit(1)
})
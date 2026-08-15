/**
 * API 调用监控模块（第二优先级）
 *
 * 能力：捕获本机 HTTP/HTTPS 请求 → 识别 AI 平台调用 → 对内容进行安全校验 → 记录存证 + 高风险告警
 *
 * 采用「本地可配置代理」模式：
 *  - 桌面端起一个本地 HTTP 代理 server（默认 localhost:8890），用户将浏览器/系统代理指向它
 *  - HTTP 请求：完整捕获方法/URL/请求体，可解析 AI 调用内容并校验
 *  - HTTPS 请求：盲转发（CONNECT 隧道），不注入证书、不做 MITM，仅记录域名/端口/耗时
 *      （不破坏用户 TLS 校验、无需管理员权限）
 *
 * 校验策略：仅监控 + 告警（不拦截请求）。高风险调用触发告警回调 + 记录存证。
 */

import { app } from 'electron'
import http from 'http'
import net from 'net'
import fs from 'fs'
import path from 'path'
import { logger } from '../services/loggerService'

// ============================================================================
// 类型
// ============================================================================

export type ApiRiskLevel = 'safe' | 'low' | 'medium' | 'high'

export interface ApiCallRecord {
  id: string
  type: 'api_call'
  title: string
  content: string
  source: string
  status: string
  risk_level: ApiRiskLevel
  risk_score: number
  should_block: boolean
  context: string
  explanation: string
  timestamp: string
}

export interface ApiCallMonitorConfig {
  enabled: boolean
  /** 本地代理监听端口 */
  port: number
  /** 视为 AI 平台调用的域名列表 */
  providerDomains: string[]
  /** 是否对敏感内容触发告警 */
  alertOnSensitive: boolean
  /** 可选后端上报配置 */
  backend?: {
    enabled: boolean
    baseUrl: string
    token?: string
  }
}

export interface ApiCallInfo {
  host: string
  port?: number
  method: string
  path: string
  isAIProvider: boolean
  riskLevel: ApiRiskLevel
  riskScore: number
  findings: string[]
  status: number
  durationMs: number
  bodyPreview: string
  timestamp: string
}

// ============================================================================
// 常量
// ============================================================================

/** 默认监听的 AI 平台域名（含知名的国内外 AI / 内容生成平台） */
const DEFAULT_PROVIDER_DOMAINS = [
  // DeepSeek
  'api.deepseek.com', 'deepseek.com',
  // 字节 / 豆包 / 即梦
  'doubao.com', 'volces.com', 'bytedance.com', 'jimeng.jianying.com', 'jimengai.cn', 'jimeng.com',
  // 阿里 / 通义 / 千问
  'dashscope.aliyuncs.com', 'aliyuncs.com', 'tongyi.aliyun.com', 'qwen.ai',
  // 百度 / 文心
  'qianfan.baidubce.com', 'aip.baidubce.com', 'yige.baidu.com',
  // 腾讯 / 混元
  'hunyuan.tencent.com',
  // 智谱
  'open.bigmodel.cn',
  // OpenAI / Anthropic / Google / Meta / Mistral
  'api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com',
  'api.perplexity.ai', 'api.mistral.ai', 'api.cohere.ai',
]

/** 敏感词 / 风险关键词（用于内容校验） */
const SENSITIVE_KEYWORDS: Array<{ word: string; risk: ApiRiskLevel; tag: string }> = [
  { word: '绕过', risk: 'medium', tag: 'bypass' },
  { word: '破解', risk: 'medium', tag: 'crack' },
  { word: '越狱', risk: 'medium', tag: 'jailbreak' },
  { word: '注入', risk: 'medium', tag: 'injection' },
  { word: '口令', risk: 'low', tag: 'credential' },
  { word: '密码', risk: 'low', tag: 'credential' },
  { word: 'token', risk: 'low', tag: 'credential' },
  { word: 'apikey', risk: 'low', tag: 'credential' },
  { word: 'api_key', risk: 'low', tag: 'credential' },
  { word: 'secret', risk: 'low', tag: 'credential' },
  { word: '策划', risk: 'low', tag: 'content' },
  { word: '赌博', risk: 'high', tag: 'gambling' },
  { word: '色情', risk: 'high', tag: 'pornography' },
  { word: '暴力', risk: 'medium', tag: 'violence' },
  { word: '攻击', risk: 'medium', tag: 'attack' },
  { word: '诈骗', risk: 'high', tag: 'fraud' },
  { word: '洗钱', risk: 'high', tag: 'money_laundering' },
  { word: '毒品', risk: 'high', tag: 'drugs' },
  { word: '木马', risk: 'high', tag: 'malware' },
  { word: '勒索', risk: 'high', tag: 'ransomware' },
  { word: '0day', risk: 'high', tag: 'exploit' },
  { word: 'exploit', risk: 'medium', tag: 'exploit' },
  { word: 'shellcode', risk: 'high', tag: 'malware' },
  { word: 'eval(', risk: 'medium', tag: 'code_injection' },
  { word: 'exec(', risk: 'medium', tag: 'code_injection' },
  { word: 'system(', risk: 'medium', tag: 'code_injection' },
  { word: 'rm -rf', risk: 'high', tag: 'destroy' },
  { word: 'DROP TABLE', risk: 'high', tag: 'sqli' },
  { word: 'UNION SELECT', risk: 'high', tag: 'sqli' },
]

// ============================================================================
// API 调用监控器
// ============================================================================

export class ApiCallMonitor {
  private config: ApiCallMonitorConfig
  private server: http.Server | null = null
  private records: ApiCallRecord[] = []
  private recordsPath: string

  // 回调
  private onSaveRecord?: (record: ApiCallRecord) => Promise<void>
  private onApiCallDetected?: (info: ApiCallInfo) => void
  private onHighRisk?: (info: ApiCallInfo) => void

  constructor(config?: Partial<ApiCallMonitorConfig>) {
    const defaults: ApiCallMonitorConfig = {
      enabled: false,
      port: 8890,
      providerDomains: [...DEFAULT_PROVIDER_DOMAINS],
      alertOnSensitive: true,
    }
    this.config = { ...defaults, ...config }

    const dataDir = path.join(app.getPath('userData'), 'data')
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    this.recordsPath = path.join(dataDir, 'apiCalls.json')
    this.loadRecords()
    this.loadSavedConfig()
  }

  // ============================ 配置 ============================

  setSaveRecordCallback(callback: (record: ApiCallRecord) => Promise<void>) {
    this.onSaveRecord = callback
  }

  setApiCallDetectedCallback(callback: (info: ApiCallInfo) => void) {
    this.onApiCallDetected = callback
  }

  setHighRiskCallback(callback: (info: ApiCallInfo) => void) {
    this.onHighRisk = callback
  }

  getConfig(): ApiCallMonitorConfig {
    return {
      enabled: this.config.enabled,
      port: this.config.port,
      providerDomains: [...this.config.providerDomains],
      alertOnSensitive: this.config.alertOnSensitive,
      backend: this.config.backend ? { ...this.config.backend } : undefined,
    }
  }

  setConfig(patch: Partial<ApiCallMonitorConfig>) {
    if (patch.enabled !== undefined) this.config.enabled = patch.enabled
    if (patch.port !== undefined) this.config.port = patch.port
    if (patch.providerDomains !== undefined) this.config.providerDomains = patch.providerDomains
    if (patch.alertOnSensitive !== undefined) this.config.alertOnSensitive = patch.alertOnSensitive
    if (patch.backend) this.config.backend = patch.backend
    this.persistSavedConfig()
  }

  getRecords(): ApiCallRecord[] {
    return [...this.records]
  }

  getStatus() {
    return {
      running: this.server !== null,
      port: this.config.port,
      enabled: this.config.enabled,
      recordCount: this.records.length,
    }
  }

  // ============================ 生命周期 ============================

  start() {
    if (this.server) {
      logger.info('[API监控] 代理已在运行', { module: 'ApiCallMonitor' })
      return
    }

    const server = http.createServer((req, res) => this.handleHttpRequest(req, res))
    server.on('connect', (req, clientSocket, head) => this.handleConnect(req, clientSocket, head))
    server.on('error', (err: any) => {
      logger.error('[API监控] 代理 server 错误:', { module: 'ApiCallMonitor' }, { error: err.message })
    })

    server.listen(this.config.port, () => {
      this.server = server
      logger.info('[API监控] 代理已启动', { module: 'ApiCallMonitor' }, {
        port: this.config.port,
        aiProvideDomains: this.config.providerDomains.length,
      })
    })
  }

  stop() {
    if (this.server) {
      this.server.close()
      this.server = null
      logger.info('[API监控] 代理已停止', { module: 'ApiCallMonitor' })
    }
  }

  // ============================ HTTP 请求处理 ============================

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const startTime = Date.now()
    const hostHeader = req.headers.host || ''
    let host = hostHeader.split(':')[0]
    let pathname = '/'
    try {
      const url = new URL(req.url || '/', `http://${hostHeader}`)
      host = url.hostname
      pathname = url.pathname + url.search
    } catch {
      /* 保留默认 */
    }

    const isAI = this.isAIProvider(host)

    // 收集请求体
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf-8')
      let risk: ApiRiskLevel = 'safe'
      let riskScore = 0
      let findings: string[] = []
      let bodyPreview = ''

      // 仅对 AI 平台调用的请求体做内容校验（普通请求不解析，保护隐私）
      if (isAI && body) {
        const text = this.extractTextFromBody(body)
        bodyPreview = text.slice(0, 200)
        const check = this.checkContent(text)
        risk = check.risk
        riskScore = check.score
        findings = check.findings
      }

      // 转发到目标服务器
      const forwardReq = http.request({
        method: req.method,
        host,
        port: this.portOfURL(req.url, hostHeader) || 80,
        path: pathname,
        headers: { ...req.headers },
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
        proxyRes.pipe(res)

        const durationMs = Date.now() - startTime
        this.recordCall({
          host,
          method: req.method || 'GET',
          path: pathname,
          isAIProvider: isAI,
          riskLevel: risk,
          riskScore,
          findings,
          status: proxyRes.statusCode || 0,
          durationMs,
          bodyPreview,
          timestamp: new Date().toISOString(),
        })
      })

      forwardReq.on('error', (err) => {
        logger.warn('[API监控] 转发失败:', { module: 'ApiCallMonitor' }, { host, error: err.message })
        res.destroy(err)
      })

      if (body) forwardReq.write(body)
      forwardReq.end()
    })
  }

  /**
   * HTTPS CONNECT 隧道处理：盲转发，不读内容（无 MITM）
   */
  private handleConnect(
    req: http.IncomingMessage,
    clientSocket: net.Socket,
    head: Buffer
  ) {
    const startTime = Date.now()
    const [host, portStr] = (req.url || '').split(':')
    const port = parseInt(portStr, 10) || 443
    const isAI = this.isAIProvider(host)

    const serverSocket = net.connect(port, host, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head?.length) serverSocket.write(head)
      serverSocket.pipe(clientSocket)
      clientSocket.pipe(serverSocket)
    })

    clientSocket.on('close', () => {
      this.recordCall({
        host,
        port,
        method: 'CONNECT',
        path: '/',
        isAIProvider: isAI,
        riskLevel: 'safe',
        riskScore: 0,
        findings: ['HTTPS 隧道：加密内容无法读取，仅记录连接'],
        status: 200,
        durationMs: Date.now() - startTime,
        bodyPreview: '',
        timestamp: new Date().toISOString(),
      })
    })

    serverSocket.on('error', () => clientSocket.destroy())
    clientSocket.on('error', () => serverSocket.destroy())
  }

  // ============================ AI 识别 / 内容校验 ============================

  private isAIProvider(host: string): boolean {
    const h = (host || '').toLowerCase()
    return this.config.providerDomains.some(domain => {
      const d = domain.toLowerCase()
      return h === d || h.endsWith('.' + d)
    })
  }

  /**
   * 从请求体提取待校验文本。
   * AI 平台请求体通常为 JSON：{ "messages":[{ "content": "..." }] } 或 { "prompt": "..." }
   * 递归遍历整棵结构收集所有字符串载荷，跳过纯元数据字段。
   */
  private extractTextFromBody(body: string): string {
    if (!body) return ''
    try {
      const parsed = JSON.parse(body)
      const texts: string[] = []
      // 跳过不影响语义的元数据 key
      const skipKeys = new Set([
        'model', 'role', 'temperature', 'max_tokens', 'top_p', 'stream',
        'presence_penalty', 'frequency_penalty', 'stop', 'n', 'user',
        'image_size', 'prompt_strength', 'seed', 'n_iter', 'batch_size',
        'cfg_scale', 'steps', 'width', 'height',
      ])
      const walk = (node: any) => {
        if (typeof node === 'string') {
          texts.push(node)
        } else if (Array.isArray(node)) {
          node.forEach(walk)
        } else if (node && typeof node === 'object') {
          for (const key of Object.keys(node)) {
            if (skipKeys.has(key)) continue
            walk(node[key])
          }
        }
      }
      walk(parsed)
      return texts.join('\n')
    } catch {
      // 非 JSON，直接按原文处理
      return body
    }
  }

  private checkContent(text: string): { risk: ApiRiskLevel; score: number; findings: string[] } {
    if (!text || !this.config.alertOnSensitive) {
      return { risk: 'safe', score: 0, findings: [] }
    }
    const lower = text.toLowerCase()
    const findings: string[] = []
    let maxRisk: ApiRiskLevel = 'safe'

    for (const { word, risk, tag } of SENSITIVE_KEYWORDS) {
      if (lower.includes(word.toLowerCase())) {
        findings.push(`${tag}(${word})`)
        if (this.riskOrder(risk) > this.riskOrder(maxRisk)) maxRisk = risk
      }
    }

    const score = findings.length === 0 ? 0 : Math.min(100, 20 + findings.length * 15)
    return { risk: maxRisk, score, findings }
  }

  private riskOrder(r: ApiRiskLevel): number {
    return ['safe', 'low', 'medium', 'high'].indexOf(r)
  }

  private portOfURL(url: string, hostHeader: string): number | null {
    try {
      const u = new URL(url, `http://${hostHeader}`)
      return u.port ? parseInt(u.port, 10) : null
    } catch {
      return null
    }
  }

  // ============================ 记录存证 ============================

  private recordCall(info: ApiCallInfo) {
    const record: ApiCallRecord = {
      id: `api-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      type: 'api_call',
      title: `API调用: ${info.host}`,
      content: `${info.isAIProvider ? 'AI平台' : '普通请求'} ${info.method} ${info.path}，风险等级: ${info.riskLevel}`,
      source: 'API监控',
      status: info.riskLevel === 'high' ? 'flagged' : info.riskLevel === 'medium' ? 'review' : 'logged',
      risk_level: info.riskLevel,
      risk_score: info.riskScore,
      should_block: false, // 仅监控+告警，不拦截
      context: [
        `请求主机: ${info.host}${info.port ? ':' + info.port : ''}`,
        `请求方法: ${info.method}`,
        `请求路径: ${info.path}`,
        `AI平台调用: ${info.isAIProvider ? '是' : '否'}`,
        `响应状态: ${info.status}`,
        `耗时: ${info.durationMs}ms`,
        `风险标签: ${info.findings.join(', ') || '无'}`,
        info.bodyPreview ? `请求内容预览: ${info.bodyPreview}` : '',
      ].filter(Boolean).join('\n'),
      explanation: info.findings.length
        ? `检测到敏感内容: ${info.findings.join(', ')}`
        : info.isAIProvider ? 'AI 平台调用，内容校验通过' : '普通请求，未做内容校验',
      timestamp: info.timestamp,
    }

    this.records.push(record)
    if (this.records.length > 2000) this.records.shift() // 限制内存
    this.saveRecords()

    // 告警回调
    if (info.riskLevel === 'high' || info.riskLevel === 'medium') {
      if (this.onHighRisk) this.onHighRisk(info)
    }

    // 实时回调
    if (this.onApiCallDetected) this.onApiCallDetected(info)

    // 存证回调（对接现有存储）
    if (this.onSaveRecord) {
      this.onSaveRecord(record).catch(() => { /* 忽略 */ })
    }

    logger.info('[API监控] 记录调用', { module: 'ApiCallMonitor' }, {
      host: info.host,
      method: info.method,
      isAI: info.isAIProvider,
      risk: info.riskLevel,
    })
  }

  // ============================ 持久化 ============================

  private getConfigPath(): string {
    return path.join(app.getPath('userData'), 'data', 'apiCallMonitorConfig.json')
  }

  private loadSavedConfig() {
    try {
      const cfgPath = this.getConfigPath()
      if (!fs.existsSync(cfgPath)) return
      const saved = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
      if (saved.enabled !== undefined) this.config.enabled = saved.enabled
      if (saved.port !== undefined) this.config.port = saved.port
      if (Array.isArray(saved.providerDomains)) this.config.providerDomains = saved.providerDomains
      if (saved.alertOnSensitive !== undefined) this.config.alertOnSensitive = saved.alertOnSensitive
      if (saved.backend) this.config.backend = saved.backend
    } catch {
      /* 使用默认配置 */
    }
  }

  private persistSavedConfig() {
    try {
      fs.writeFileSync(this.getConfigPath(), JSON.stringify(this.config, null, 2))
    } catch (error) {
      logger.error('[API监控] 配置持久化失败', { module: 'ApiCallMonitor' }, { error })
    }
  }

  private loadRecords() {
    try {
      if (fs.existsSync(this.recordsPath)) {
        const data = JSON.parse(fs.readFileSync(this.recordsPath, 'utf-8'))
        if (Array.isArray(data)) this.records = data
      }
    } catch {
      this.records = []
    }
  }

  private saveRecords() {
    try {
      fs.writeFileSync(this.recordsPath, JSON.stringify(this.records))
    } catch (error) {
      logger.error('[API监控] 记录存储失败', { module: 'ApiCallMonitor' }, { error })
    }
  }
}
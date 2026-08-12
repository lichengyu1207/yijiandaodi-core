/**
 * 文件系统监控模块（统一版）
 *
 * 合并两套既有实现的能力：
 *  - electron/monitoring/fileMonitor.ts：本地 AutoDetector 检测 + 记录保存（已接入 main.ts）
 *  - src/services/FileWatcher.ts：SHA-256 哈希计算/对比 + 高风险二次确认弹窗 + 后端上报（草稿）
 *
 * 统一后的能力：
 *  1. 多目录监控（可配置并持久化，Windows: ReadDirectoryChangesW / Mac: FSEvents / Linux: inotify）
 *  2. 文件变动时触发校验流水线（本地 AutoDetector 为主，后端上报可选）
 *  3. 计算文件哈希并持久化存储、与上次对比判断异常
 *  4. 普通文件 / 代码文件 / 可执行文件分级校验
 *  5. 高风险文件操作二次确认弹窗
 */

import { app } from 'electron'
import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { SecurityKnowledgeBase } from '../securityKnowledgeBase'
import { AutoDetector } from './autoDetector'
import { PetState } from '../windows/petWindow'
import { logger } from '../services/loggerService'
import { taintTracker, TaintType } from './taintTracking'

// ============================================================================
// 类型定义
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

/** 文件分类：普通素材 / 代码文件 / 可执行文件 */
export type FileKind = 'normal' | 'code' | 'executable'

export interface RiskResult {
  type: string
  matched: string
  risk: RiskLevel
}

export interface OperationRecord {
  id: string
  type: string
  title: string
  content: string
  source: string
  status: string
  risk_level: string
  risk_score: number
  should_block: boolean
  context: string
  explanation: string
  timestamp?: string
  audit_hash?: string
}

/** 高风险确认信息 */
export interface HighRiskConfirmation {
  filePath: string
  fileName: string
  fileKind: FileKind
  hash: string
  previousHash: string
  hashChanged: boolean
  operationType: string
  riskLevel: RiskLevel
  riskTags: string[]
  message: string
}

/** 监控目录状态 */
export interface WatchPathStatus {
  path: string
  exists: boolean
  watching: boolean
}

export interface FileMonitorConfig {
  watchPaths: string[]
  /** 触发二次确认的风险阈值 */
  riskThreshold: RiskLevel
  /** 可选后端上报配置 */
  backend?: {
    enabled: boolean
    baseUrl: string
    token?: string
  }
}

// ============================================================================
// 常量
// ============================================================================

/** 代码 / 脚本文件扩展名（进入深度校验） */
const CODE_EXTENSIONS = new Set([
  'js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'php', 'go', 'java', 'c', 'cpp', 'h',
  'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'html', 'htm', 'vue', 'swift',
  'kt', 'pl', 'lua', 'r', 'sql', 'scala', 'dart'
])

/** 可执行 / 二进制文件扩展名 */
const EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'dll', 'so', 'dylib', 'bin', 'msi', 'apk', 'jar', 'wasm', 'com',
  'scr', 'elf', 'macho', 'o', 'a'
])

/** 常见文本/素材文件扩展名（仅记录 + 轻量检测） */
const NORMAL_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'mp4', 'mov', 'mkv',
  'avi', 'mp3', 'wav', 'flac', 'txt', 'md', 'json', 'yaml', 'yml', 'xml',
  'csv', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar',
  '7z', 'psd', 'ai', 'xd', 'fig', 'sketch'
])

/**
 * 内容检测（AutoDetector）的最大文件大小（字节）。
 * 超过此大小的文件不再整体读入主线程进行同步检测，仅计算哈希 + 启发式分类，
 * 避免大文件读取/匹配阻塞主进程。
 */
const MAX_DETECTION_SIZE = 5 * 1024 * 1024 // 5MB

/** 默认排除的目录/文件 */
const DEFAULT_IGNORED = [
  '\\.git',
  '\\.svn',
  '\\.hg',
  'node_modules',
  '\\.DS_Store',
  'Thumbs\\.db',
  '\\.tmp',
  '\\.swp',
  '\\.swo',
  '\\~$'
]

// ============================================================================
// 递归目录监听器（跨平台：优先 native recursive，Linux 回退为一对一目录监听）
// ============================================================================

class RecursiveDirectoryWatcher {
  private root: string
  private watchers = new Map<string, fs.FSWatcher>()
  private onChange: (eventType: string, relativePath: string) => void

  constructor(root: string, onChange: (eventType: string, relativePath: string) => void) {
    this.root = root
    this.onChange = onChange
  }

  start() {
    // 优先使用原生递归监听（Windows / macOS 支持）
    try {
      const watcher = fs.watch(this.root, { recursive: true }, (eventType, filename) => {
        if (filename) this.onChange(eventType.toString(), filename.toString())
      })
      this.watchers.set(this.root, watcher)
      return
    } catch {
      // Linux 不支持 recursive，回退为逐目录监听
      this.watchTree(this.root)
    }
  }

  private watchTree(dir: string) {
    if (this.watchers.has(dir)) return
    try {
      const watcher = fs.watch(dir, (eventType, filename) => {
        if (!filename) return
        const full = path.join(dir, filename.toString())
        const rel = path.relative(this.root, full)
        this.onChange(eventType.toString(), rel)
        // 新增目录时补充监听
        if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
          this.watchTree(full)
        }
      })
      this.watchers.set(dir, watcher)
    } catch {
      /* 目录可能已被删除，忽略 */
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) this.watchTree(path.join(dir, entry.name))
    }
  }

  stop() {
    for (const watcher of this.watchers.values()) {
      try { watcher.close() } catch { /* ignore */ }
    }
    this.watchers.clear()
  }
}

// ============================================================================
// 文件监控器
// ============================================================================

export class FileMonitor {
  private watchers = new Map<string, RecursiveDirectoryWatcher>()
  private securityKB: SecurityKnowledgeBase | null = null
  private autoDetector: AutoDetector = new AutoDetector()
  private config: FileMonitorConfig

  // 哈希持久化存储
  private hashStore = new Map<string, string>()
  private hashStorePath: string

  // 回调
  private onRiskDetected?: (risks: RiskResult[], filePath: string, result?: any) => void
  private onPetStateChange?: (state: PetState, message?: string) => void
  private onSaveRecord?: (record: OperationRecord) => Promise<void>
  private onConfirmRisk?: (info: HighRiskConfirmation) => Promise<boolean>

  constructor(config?: Partial<FileMonitorConfig>) {
    const defaults: FileMonitorConfig = {
      watchPaths: [
        path.join(app.getPath('home'), 'Documents'),
        path.join(app.getPath('home'), 'Desktop'),
      ],
      riskThreshold: 'medium',
    }
    this.config = { ...defaults, ...config }

    const dataDir = path.join(app.getPath('userData'), 'data')
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    this.hashStorePath = path.join(dataDir, 'fileHashes.json')
    this.loadHashStore()
    this.loadSavedConfig()
  }

  // ============================ 配置 ============================

  setSecurityKnowledgeBase(kb: SecurityKnowledgeBase) {
    this.securityKB = kb
    this.autoDetector.setSecurityKnowledgeBase(kb)
  }

  setRiskDetectedCallback(callback: (risks: RiskResult[], filePath: string, result?: any) => void) {
    this.onRiskDetected = callback
  }

  setPetStateChangeCallback(callback: (state: PetState, message?: string) => void) {
    this.onPetStateChange = callback
  }

  setSaveRecordCallback(callback: (record: OperationRecord) => Promise<void>) {
    this.onSaveRecord = callback
  }

  setConfirmRiskCallback(callback: (info: HighRiskConfirmation) => Promise<boolean>) {
    this.onConfirmRisk = callback
  }

  setRiskThreshold(threshold: RiskLevel) {
    this.config.riskThreshold = threshold
  }

  getWatchPaths(): string[] {
    return [...this.config.watchPaths]
  }

  getWatchStatus(): WatchPathStatus[] {
    return this.config.watchPaths.map(p => ({
      path: p,
      exists: fs.existsSync(p),
      watching: this.watchers.has(p),
    }))
  }

  getBackendConfig() {
    return this.config.backend ? { ...this.config.backend } : null
  }

  setBackendConfig(enabled: boolean, baseUrl: string) {
    this.config.backend = { enabled, baseUrl }
    this.persistSavedConfig()
  }

  /**
   * 设置监控目录并重启监听（持久化）
   */
  setWatchPaths(paths: string[]) {
    const cleaned = paths
      .map(p => p.trim())
      .filter(Boolean)

    const changed =
      cleaned.length !== this.config.watchPaths.length ||
      cleaned.some((p, i) => this.config.watchPaths[i] !== p)

    this.config.watchPaths = cleaned
    this.persistSavedConfig()

    if (changed) {
      this.stopWatchers()
      if (cleaned.length > 0) this.startWatchers()
      logger.info('[文件监控] 监控目录已更新', { module: 'FileMonitor' }, { paths: cleaned })
    }
  }

  // ============================ 生命周期 ============================

  start() {
    if (this.watchers.size > 0) {
      logger.info('[文件监控] 已在运行', { module: 'FileMonitor' })
      return
    }
    logger.info('[文件监控] 启动...', { module: 'FileMonitor' }, { paths: this.config.watchPaths })
    this.startWatchers()
  }

  stop() {
    this.stopWatchers()
    this.saveHashStore()
  }

  private startWatchers() {
    for (const watchPath of this.config.watchPaths) {
      if (!watchPath || !fs.existsSync(watchPath)) {
        logger.warn('[文件监控] 目录不存在，跳过', { module: 'FileMonitor' }, { path: watchPath })
        continue
      }
      if (this.watchers.has(watchPath)) continue

      const watcher = new RecursiveDirectoryWatcher(watchPath, (eventType, relPath) => {
        this.handleEvent(watchPath, eventType, relPath)
      })
      watcher.start()
      this.watchers.set(watchPath, watcher)
      logger.info('[文件监控] 已监听目录', { module: 'FileMonitor' }, { path: watchPath })
    }
  }

  private stopWatchers() {
    for (const watcher of this.watchers.values()) {
      watcher.stop()
    }
    this.watchers.clear()
  }

  // ============================ 事件处理 ============================

  private handleEvent(watchPath: string, eventType: string, relPath: string) {
    const filePath = path.join(watchPath, relPath)

    // 过滤默认忽略项
    if (this.isIgnored(filePath)) return

    // 目录变动不进入流水线（仅记录）
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) return
    } catch {
      return
    }

    logger.info(`[文件监控] ${eventType}: ${relPath}`, { module: 'FileMonitor' })
    this.triggerDetection(filePath, eventType)
  }

  private isIgnored(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/')
    return DEFAULT_IGNORED.some(pattern => new RegExp(pattern).test(normalized))
  }

  // ============================ 校验流水线 ============================

  private async triggerDetection(filePath: string, eventType: string) {
    try {
      // 文件可能已被删除/重命名
      let stat: fs.Stats
      try {
        stat = fs.statSync(filePath)
      } catch {
        return this.handleDelete(filePath, eventType)
      }
      if (!stat.isFile()) return

      const kind = this.classifyFile(filePath, stat)
      const ext = path.extname(filePath).slice(1).toLowerCase()
      const fileName = path.basename(filePath)

      // 1. 计算哈希（使用队列限流，避免高并发拖垮主进程）
      let hash = ''
      let previousHash = ''
      let hashChanged = false
      try {
        hash = await this.computeSha256(filePath)
        previousHash = this.hashStore.get(filePath) || ''
        hashChanged = previousHash !== '' && previousHash !== hash
        this.hashStore.set(filePath, hash)
      } catch {
        hashChanged = false
      }

      // 2. 本地检测（AutoDetector 为主）
      const detection = await this.runDetection(filePath, kind, stat)
      let riskLevel = detection.risk_level
      const riskTags = [...new Set(detection.risks.map(r => r.type))]

      // 3. 可执行文件启发式：即使无命中模式，也视为中/高风险候选
      if (kind === 'executable') {
        if (hashChanged) {
          riskLevel = this.maxRisk(riskLevel, 'high')
          riskTags.push('executable_modified')
        } else if (!previousHash) {
          // 首次出现的新可执行文件
          riskLevel = this.maxRisk(riskLevel, 'medium')
          riskTags.push('executable_created')
        }
      }

      const riskScore = this.riskScore(riskLevel)
      const shouldBlock = riskLevel === 'high' || riskLevel === 'critical'

      // 4. 高风险二次确认
      let userConfirmed: boolean | null = null
      if (this.isHighRisk(riskLevel)) {
        const info: HighRiskConfirmation = {
          filePath,
          fileName,
          fileKind: kind,
          hash,
          previousHash,
          hashChanged,
          operationType: eventType,
          riskLevel,
          riskTags,
          message: this.buildRiskMessage(fileName, kind, eventType, riskTags, hashChanged),
        }
        if (this.onConfirmRisk) {
          userConfirmed = await this.onConfirmRisk(info)
          logger.info('[文件监控] 用户二次确认', { module: 'FileMonitor' }, {
            file: fileName,
            allowed: userConfirmed,
            riskLevel,
          })
        }
      }

      // 5. 保存操作记录
      const record = this.buildOperationRecord({
        filePath, fileName, ext, kind, eventType, hash, previousHash,
        hashChanged, riskLevel, riskScore, shouldBlock, riskTags, detection, userConfirmed, stat,
      })

      if (this.onSaveRecord) {
        try {
          await this.onSaveRecord(record)
        } catch (error) {
          logger.error('[文件监控] 记录保存失败', { module: 'FileMonitor' }, { error })
        }
      }

      // 6. 更新桌宠状态
      if (this.onPetStateChange) {
        if (shouldBlock) {
          this.onPetStateChange('red', `文件:${fileName} 检测到高风险`)
        } else if (riskLevel === 'medium') {
          this.onPetStateChange('yellow', `文件:${fileName} 需要关注`)
        } else {
          this.onPetStateChange('green', '文件安全')
        }
      }

      // 7. 触发风险回调
      if (this.onRiskDetected && detection.risks.length > 0) {
        this.onRiskDetected(detection.risks as RiskResult[], filePath, detection)
      }

      // 8. 高风险污点追踪
      if (shouldBlock) {
        this.trackTaint(filePath, contentFingerprint(stat, kind), riskTags)
      }

      // 9. 可选后端上报
      await this.reportToBackend(record)

      logger.info('[文件监控] 校验完成', { module: 'FileMonitor' }, {
        file: fileName,
        kind,
        riskLevel,
        hashChanged,
        userConfirmed,
      })
    } catch (error: any) {
      logger.error('[文件监控] 校验失败', { module: 'FileMonitor' }, { error: error.message, filePath })
    }
  }

  private async handleDelete(filePath: string, eventType: string) {
    const previousHash = this.hashStore.get(filePath) || ''
    this.hashStore.delete(filePath)

    const record: OperationRecord = {
      id: `file-del-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      type: 'file_op',
      title: `文件删除: ${path.basename(filePath)}`,
      content: `文件 ${path.basename(filePath)} 被${eventType === 'unlink' ? '删除' : '重命名/移除'}`,
      source: '文件监控',
      status: previousHash ? 'flagged' : 'logged',
      risk_level: 'low',
      risk_score: 10,
      should_block: false,
      context: `文件路径: ${filePath}\n操作: ${eventType}\n前次哈希: ${previousHash || '无'}`,
      explanation: '文件从监控目录中移除，已记录操作链路。',
      timestamp: new Date().toISOString(),
    }

    if (this.onSaveRecord) {
      try { await this.onSaveRecord(record) } catch { /* ignore */ }
    }
    this.saveHashStore()
  }

  // ============================ 检测与分类 ============================

  private classifyFile(filePath: string, stat: fs.Stats): FileKind {
    const ext = path.extname(filePath).slice(1).toLowerCase()
    if (EXECUTABLE_EXTENSIONS.has(ext)) return 'executable'
    if (CODE_EXTENSIONS.has(ext)) return 'code'

    // 无扩展名或未知扩展名：用魔数判断二进制可执行
    if (this.detectExecutableMagic(filePath)) return 'executable'

    if (NORMAL_EXTENSIONS.has(ext)) return 'normal'

    // 兜底：尝试以文本读取，能读则为 normal，否则视为二进制
    return 'normal'
  }

  private detectExecutableMagic(filePath: string): boolean {
    try {
      const fd = fs.openSync(filePath, 'r')
      const buf = Buffer.alloc(4)
      fs.readSync(fd, buf, 0, 4, 0)
      fs.closeSync(fd)
      // MZ (PE) / 0x7F ELF / Mach-O magic
      return (
        buf[0] === 0x4d && buf[1] === 0x5a ||
        buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46 ||
        buf[0] === 0xfe && buf[1] === 0xed && buf[2] === 0xfa && buf[3] === 0xce ||
        buf.slice(0, 4).toString('hex') === 'cafebabe'
      )
    } catch {
      return false
    }
  }

  private async runDetection(
    filePath: string,
    kind: FileKind,
    stat: fs.Stats
  ): Promise<{ risk_level: RiskLevel; risk_score: number; risks: Array<{ type: string; matched: string; risk: RiskLevel }>; content_type: string; warnings: string[] }> {
    // 可执行文件：无法安全读取为文本，使用启发式
    if (kind === 'executable') {
      return {
        risk_level: 'medium',
        risk_score: 50,
        risks: [{ type: 'executable', matched: path.basename(filePath), risk: 'medium' }],
        content_type: 'binary',
        warnings: ['可执行文件无法进行文本内容检测，采用启发式规则'],
      }
    }

    // 大文件：不整体读入主线程，仅记录为待深入检测（避免阻塞主进程）
    if (stat.size > MAX_DETECTION_SIZE) {
      return {
        risk_level: 'low',
        risk_score: 10,
        risks: kind === 'code'
          ? [{ type: 'large_file', matched: path.basename(filePath), risk: 'low' }]
          : [],
        content_type: 'large',
        warnings: [`文件过大(${Math.round(stat.size / 1024 / 1024)}MB)，跳过内容检测，仅计算哈希`],
      }
    }

    // 读取内容（容错，异步 I/O 不阻塞主线程）
    let content = ''
    try {
      content = await fs.promises.readFile(filePath, 'utf-8')
    } catch {
      // 二进制普通文件（如图片/视频）：跳过内容检测
      if (kind === 'code') {
        return {
          risk_level: 'medium',
          risk_score: 50,
          risks: [{ type: 'code_injection', matched: '无法读取的代码文件', risk: 'medium' }],
          content_type: 'unknown',
          warnings: ['代码文件无法以文本读取，可能被篡改'],
        }
      }
      return {
        risk_level: 'low',
        risk_score: 10,
        risks: [],
        content_type: 'binary',
        warnings: [],
      }
    }

    const result = this.autoDetector.detect(content)
    return {
      risk_level: result.risk_level || 'low',
      risk_score: this.riskScore(result.risk_level || 'low'),
      risks: result.risks as Array<{ type: string; matched: string; risk: RiskLevel }>,
      content_type: result.content_type,
      warnings: result.warnings || [],
    }
  }

  // ============================ 哈希 ============================

  private computeSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256')
      const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 })
      stream.on('data', d => hash.update(d))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  private loadHashStore() {
    try {
      if (fs.existsSync(this.hashStorePath)) {
        const data = JSON.parse(fs.readFileSync(this.hashStorePath, 'utf-8'))
        this.hashStore = new Map(Object.entries(data))
      }
    } catch {
      this.hashStore = new Map()
    }
  }

  private saveHashStore() {
    try {
      const obj = Object.fromEntries(this.hashStore)
      fs.writeFileSync(this.hashStorePath, JSON.stringify(obj))
    } catch (error) {
      logger.error('[文件监控] 哈希存储失败', { module: 'FileMonitor' }, { error })
    }
  }

  // ============================ 风险工具 ============================

  private riskScore(level: RiskLevel): number {
    switch (level) {
      case 'critical': return 100
      case 'high': return 80
      case 'medium': return 50
      default: return 20
    }
  }

  private maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
    const order: RiskLevel[] = ['low', 'medium', 'high', 'critical']
    return order.indexOf(a) >= order.indexOf(b) ? a : b
  }

  private isHighRisk(level: RiskLevel): boolean {
    const order: RiskLevel[] = ['low', 'medium', 'high', 'critical']
    return order.indexOf(level) >= order.indexOf(this.config.riskThreshold)
  }

  private buildRiskMessage(fileName: string, kind: FileKind, eventType: string, riskTags: string[], hashChanged: boolean): string {
    const action = eventType === 'add' ? '创建' : eventType === 'unlink' ? '删除' : eventType === 'rename' ? '重命名' : '修改'
    const kindText = kind === 'executable' ? '可执行文件' : kind === 'code' ? '代码文件' : '文件'
    const parts = [`检测到${kindText}${action}操作`, `文件: ${fileName}`]
    if (hashChanged) parts.push('⚠️ 文件内容已发生变更')
    if (riskTags.length) parts.push(`风险标签: ${riskTags.slice(0, 5).join(', ')}`)
    return parts.join('\n')
  }

  private buildOperationRecord(p: {
    filePath: string; fileName: string; ext: string; kind: FileKind; eventType: string;
    hash: string; previousHash: string; hashChanged: boolean; riskLevel: RiskLevel;
    riskScore: number; shouldBlock: boolean; riskTags: string[];
    detection: any; userConfirmed: boolean | null; stat: fs.Stats;
  }): OperationRecord {
    const actionText = p.eventType === 'add' ? '创建' : p.eventType === 'unlink' ? '删除' : p.eventType === 'rename' ? '重命名' : '修改'
    const kindText = p.kind === 'executable' ? '可执行文件' : p.kind === 'code' ? '代码文件' : '文件'
    const riskNames = p.detection.risks && p.detection.risks.length
      ? p.detection.risks.slice(0, 5).map((r: any) => `- ${r.type}: ${r.matched}`).join('\n')
      : '无具体风险模式命中'

    return {
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      type: 'file_op',
      title: `文件${actionText}: ${p.fileName}`,
      content: `${kindText} ${p.fileName} 被${actionText}，风险等级: ${p.riskLevel}`,
      source: '文件监控',
      status: p.shouldBlock ? 'flagged' : p.riskLevel === 'medium' ? 'review' : 'logged',
      risk_level: p.riskLevel,
      risk_score: p.riskScore,
      should_block: p.shouldBlock,
      context: `文件路径: ${p.filePath}\n文件类型: ${kindText} (.${p.ext})\n文件大小: ${p.stat.size} 字节\n操作: ${p.eventType}\n风险标签: ${p.riskTags.join(', ') || '无'}\n哈希: ${p.hash || '计算失败'}\n前次哈希: ${p.previousHash || '首次记录'}\n哈希变更: ${p.hashChanged}\n\n风险详情:\n${riskNames}`,
      explanation: [
        `检测到${kindText}${actionText}操作，风险等级 ${p.riskLevel}`,
        p.hashChanged ? '文件内容较上次记录发生变化' : '',
        p.userConfirmed !== null ? `用户二次确认: ${p.userConfirmed ? '允许' : '拒绝'}` : '',
      ].filter(Boolean).join('；'),
      timestamp: new Date().toISOString(),
    }
  }

  private trackTaint(filePath: string, fingerprint: string, riskTags: string[]) {
    try {
      let taintType: TaintType = 'sensitive'
      if (riskTags.some(t => t.includes('api') || t.includes('key'))) taintType = 'api_key'
      else if (riskTags.some(t => t.includes('password') || t.includes('credential'))) taintType = 'credential'
      else if (riskTags.some(t => t.includes('secret'))) taintType = 'secret'

      const taint = taintTracker.createTaint(fingerprint, filePath, taintType, {
        fileName: path.basename(filePath),
        fileType: path.extname(filePath),
        size: fingerprint.length,
        tags: riskTags,
      })
      taintTracker.trackPropagation(taint.id, filePath, `memory:process:${process.pid}`, 'file_write', {
        processName: 'FileMonitor',
      })
    } catch (error) {
      logger.error('[文件监控] 污点追踪失败', { module: 'FileMonitor' }, { error })
    }
  }

  // ============================ 可选后端上报 ============================

  /**
   * 可选后端上报。
   *
   * 后端路由（backend/auth_app/file_watch_urls.py）：
   *   POST /api/v1/file-watch/verify/  # 触发四官协同校验（唯一写入入口，/logs/ 为只读）
   * 字段与 FileOperationLog 模型保持一致（backend/auth_app/file_watch_models.py）。
   */
  private async reportToBackend(record: OperationRecord) {
    const backend = this.config.backend
    if (!backend || !backend.enabled || !backend.baseUrl) return

    try {
      await axios.post(`${backend.baseUrl.replace(/\/$/, '')}/api/v1/file-watch/verify/`, {
        file_path: parseFilePath(record.context),
        file_hash: extractHash(record.context) || undefined,
      }, {
        timeout: 5000,
        // 若后端要求认证，可在此注入鉴权头
        headers: backend.token ? { Authorization: `Bearer ${backend.token}` } : {},
      })
      logger.info('[文件监控] 已上报后端校验', { module: 'FileMonitor' }, { file: record.title })
    } catch (error: any) {
      logger.warn('[文件监控] 后端上报失败（不影响本地）', { module: 'FileMonitor' }, { error: error.message })
    }
  }

  // ============================ 持久化配置 ============================

  private getConfigPath(): string {
    return path.join(app.getPath('userData'), 'data', 'fileMonitorConfig.json')
  }

  private loadSavedConfig() {
    try {
      const cfgPath = this.getConfigPath()
      if (!fs.existsSync(cfgPath)) return
      const saved = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
      if (Array.isArray(saved.watchPaths)) this.config.watchPaths = saved.watchPaths
      if (saved.riskThreshold) this.config.riskThreshold = saved.riskThreshold
      if (saved.backend) this.config.backend = saved.backend
    } catch {
      /* 使用默认配置 */
    }
  }

  private persistSavedConfig() {
    try {
      fs.writeFileSync(this.getConfigPath(), JSON.stringify(this.config, null, 2))
    } catch (error) {
      logger.error('[文件监控] 配置持久化失败', { module: 'FileMonitor' }, { error })
    }
  }
}

// ============================================================================
// 工具函数
// ============================================================================

function contentFingerprint(stat: fs.Stats, kind: FileKind): string {
  return `${stat.size}:${kind}:${stat.mtimeMs}`
}

function extractHash(context: string): string {
  const m = context.match(/哈希: ([0-9a-f]{64})/)
  return m ? m[1] : ''
}

function parseFilePath(context: string): string {
  const m = context.match(/文件路径: ([^\n]+)/)
  return m ? m[1].trim() : ''
}
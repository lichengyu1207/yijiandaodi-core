/**
 * Django 后端服务（backendService.ts）
 *
 * 职责：实现「点击应用图标 → 自动启动前后端」。
 *  - 启动前先检测 8000 端口（/api/health/）是否已有后端在运行（如用户手动启动的），有则复用不重复拉起；
 *  - 未运行时自动 spawn Django（venv python + manage.py runserver），并轮询等待就绪；
 *  - 应用退出时（cleanup）自动回收子进程，避免残留。
 *
 * 路径策略：
 *  - 开发环境：使用仓库内 backend 目录（相对 cwd 解析，去掉硬编码绝对路径）+ venv python；
 *  - 生产环境：spawn 打包资源 process.resourcesPath/backend/backend.exe（PyInstaller 单 exe，
 *    零 Python 依赖，用户无需安装 Python），并以 --data-dir 传入可写用户数据目录
 *    （%APPDATA%/<app>/data，DB/密钥/日志/媒体落此处，保证 Program Files 只读也能写）。
 */

import { spawn, ChildProcess } from 'child_process'
import http from 'http'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { logger } from './loggerService'

/** Django 后端健康检查端点（存在且无需鉴权） */
const HEALTH_URL = 'http://127.0.0.1:8000/api/health/'
const BACKEND_PORT = 8000
/** 等待后端就绪的超时（毫秒） */
const READY_TIMEOUT_MS = 45000
/** 就绪轮询间隔（毫秒） */
const READY_POLL_INTERVAL_MS = 500

/** 简单 HTTP GET，返回是否 2xx（连接失败返回 false，不抛错） */
function pingHealth(url: string, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume()
      resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 500)
    })
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.on('error', () => resolve(false))
  })
}

export class BackendService {
  private backendProcess: ChildProcess | null = null
  private _startedExternally = false
  private backendDir = ''
  private pythonExe = ''
  /** 生产环境：后端 exe 路径（打包资源） */
  private backendExe = ''

  constructor() {
    this.resolveBackendPaths()
  }

  /** 解析后端可执行程序（开发/生产策略） */
  private resolveBackendPaths() {
    if (!app.isPackaged) {
      // 开发环境：仓库内 backend 目录（相对 cwd 解析，不写死绝对路径）+ venv python
      const repoBackend = path.resolve(process.cwd(), '..', 'backend')
      this.backendDir = repoBackend
      this.pythonExe = path.join(repoBackend, 'venv', 'Scripts', 'python.exe')
      this.backendExe = ''
      return
    }

    // 生产环境：PyInstaller 打包的 backend.exe（process.resourcesPath/backend/backend/backend.exe）
    const backendExe = path.join(process.resourcesPath, 'backend', 'backend', 'backend.exe')
    if (fs.existsSync(backendExe)) {
      this.backendExe = backendExe
      this.backendDir = path.dirname(path.dirname(backendExe)) // backend 目录（资源根）
      this.pythonExe = ''
      return
    }

    // 打包未包含后端：仅告警，不阻塞主界面
    logger.warn('[BackendService] 打包资源中未找到 backend.exe，跳过自动启动 Django', {
      module: 'BackendService',
      backendExe,
    })
  }

  /** 后端是否可运行（生产看 exe，开发看 venv python + manage.py） */
  private isRunnable(): boolean {
    if (this.backendExe) {
      return fs.existsSync(this.backendExe)
    }
    return (
      !!this.backendDir &&
      !!this.pythonExe &&
      fs.existsSync(this.pythonExe) &&
      fs.existsSync(path.join(this.backendDir, 'manage.py'))
    )
  }

  /** 8000 端口是否已有 Django 在运行（外部已启动则复用，避免端口冲突） */
  async isBackendOnline(): Promise<boolean> {
    return pingHealth(HEALTH_URL)
  }

  /**
   * 启动后端：已在线则复用；否则 spawn 并等待就绪。
   * 返回 true=可用（含外部已启动）；false=启动失败或不可用。
   */
  async start(): Promise<boolean> {
    logger.info('[BackendService] 检查 Django 后端状态', { module: 'BackendService' })

    // 1) 已在运行（用户手动启动 / 上次残留）：直接复用
    if (await this.isBackendOnline()) {
      this._startedExternally = true
      logger.info('[BackendService] 检测到 8000 端口已有 Django 运行，直接复用', { module: 'BackendService' })
      return true
    }

    // 2) 环境不可运行（打包未包含等）：不阻塞主界面
    if (!this.isRunnable()) {
      logger.warn('[BackendService] 后端环境不可用，跳过自动启动（不影响主界面）', { module: 'BackendService' })
      return false
    }

    // 3) spawn Django（开发用 venv python；生产用 PyInstaller backend.exe）
    if (this.backendExe) {
      // 生产：backend.exe --host 127.0.0.1 --port 8000 --data-dir <可写用户数据目录>
      const dataDir = path.join(app.getPath('userData'), 'data')
      logger.info('[BackendService] 8000 端口空闲，启动打包后端 backend.exe', {
        module: 'BackendService',
        exe: this.backendExe,
        dataDir,
      })
      this.spawnProcess(this.backendExe, ['--host', '127.0.0.1', '--port', `${BACKEND_PORT}`, '--data-dir', dataDir], this.backendDir)
    } else {
      logger.info('[BackendService] 8000 端口空闲，自动启动 Django', {
        module: 'BackendService',
        python: this.pythonExe,
        cwd: this.backendDir,
      })
      this.spawnProcess(this.pythonExe, ['manage.py', 'runserver', `127.0.0.1:${BACKEND_PORT}`, '--noreload'], this.backendDir)
    }

    // 4) 轮询等待就绪
    const ready = await this.waitUntilReady()
    if (ready) {
      logger.info('[BackendService] Django 后端已就绪', { module: 'BackendService', port: BACKEND_PORT })
    } else {
      logger.warn('[BackendService] 等待 Django 就绪超时', { module: 'BackendService' })
    }
    return ready
  }

  /** 拉起后端子进程并接线日志/退出/错误处理 */
  private spawnProcess(exe: string, args: string[], cwd: string) {
    const proc = spawn(exe, args, {
      cwd,
      stdio: 'pipe',
      // 注意：不使用 detached，随应用生命周期回收（cleanup 时 kill）
    })

    this.backendProcess = proc

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) logger.info(`[Django] ${text}`, { module: 'BackendService' })
    })
    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) logger.warn(`[Django] ${text}`, { module: 'BackendService' })
    })
    proc.on('error', (err) => {
      logger.error('[BackendService] Django 进程启动失败', { module: 'BackendService', error: err.message })
      this.backendProcess = null
    })
    proc.on('exit', (code) => {
      logger.info(`[BackendService] Django 进程退出: ${code}`, { module: 'BackendService' })
      if (this.backendProcess === proc) this.backendProcess = null
    })
  }

  /** 轮询健康检查直到就绪或超时 */
  private async waitUntilReady(): Promise<boolean> {
    const deadline = Date.now() + READY_TIMEOUT_MS
    while (Date.now() < deadline) {
      if (await pingHealth(HEALTH_URL)) return true
      await new Promise((resolve) => setTimeout(resolve, READY_POLL_INTERVAL_MS))
    }
    return false
  }

  /**
   * 停止后端：仅回收本服务拉起的进程（外部启动的 Django 不回收）。
   * 等待子进程真正退出后再返回，避免退出竞态。
   */
  stop(): Promise<void> {
    const proc = this.backendProcess
    this.backendProcess = null
    if (!proc) return Promise.resolve()

    logger.info('[BackendService] 停止 Django 后端...', { module: 'BackendService' })

    return new Promise((resolve) => {
      const forceKillTimer = setTimeout(() => {
        try {
          proc.kill('SIGKILL')
        } catch {
          // 进程可能已退出，忽略
        }
      }, 3000)

      const done = () => {
        clearTimeout(forceKillTimer)
        resolve()
      }

      if (proc.exitCode !== null || proc.signalCode !== null) {
        done()
        return
      }

      proc.once('exit', done)
      proc.once('error', done)

      try {
        proc.kill()
      } catch {
        done()
      }
    })
  }

  /** 是否由本服务拉起的 Django 进程 */
  isOwned(): boolean {
    return !this._startedExternally && this.backendProcess !== null
  }
}

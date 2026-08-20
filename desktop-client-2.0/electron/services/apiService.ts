/**
 * API服务模块 - 后台服务管理
 */

import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { logger } from './loggerService'

export class ApiService {
  private apiProcess: ChildProcess | null = null

  start() {
    const isDev = !app.isPackaged

    if (isDev) {
      // 开发环境：直接启动 Python 服务（相对仓库根解析，不写死绝对路径）
      const repoRoot = path.resolve(process.cwd(), '..')
      const backendPath = path.join(repoRoot, 'sandbox_api.py')

      logger.info('启动后台服务:', { module: 'ApiService' }, { path: backendPath })

      this.apiProcess = spawn('python', [backendPath], {
        cwd: repoRoot,
        stdio: 'pipe',
        detached: true
      })

      this.apiProcess.stdout?.on('data', (data) => {
        logger.info(`[API] ${data}`, { module: 'ApiService' })
      })

      this.apiProcess.stderr?.on('data', (data) => {
        logger.error(`[API Error] ${data}`, { module: 'ApiService' })
      })

      this.apiProcess.on('close', (code) => {
        logger.info(`API 服务退出: ${code}`, { module: 'ApiService' })
      })
    } else {
      // 生产环境：spawn 打包资源中的 sandbox-api.exe（PyInstaller，零 Python 依赖）
      const sandboxExe = path.join(process.resourcesPath, 'backend', 'sandbox-api', 'sandbox-api.exe')

      if (!fs.existsSync(sandboxExe)) {
        logger.warn('[ApiService] 打包资源中未找到 sandbox-api.exe，跳过沙箱服务', {
          module: 'ApiService',
          sandboxExe,
        })
        return
      }

      logger.info('启动打包沙箱服务:', { module: 'ApiService' }, { path: sandboxExe })

      this.apiProcess = spawn(sandboxExe, [], {
        cwd: path.dirname(path.dirname(sandboxExe)),
        stdio: 'pipe',
        detached: true
      })

      this.apiProcess.stdout?.on('data', (data) => {
        logger.info(`[API] ${data}`, { module: 'ApiService' })
      })

      this.apiProcess.stderr?.on('data', (data) => {
        logger.error(`[API Error] ${data}`, { module: 'ApiService' })
      })

      this.apiProcess.on('close', (code) => {
        logger.info(`API 服务退出: ${code}`, { module: 'ApiService' })
      })

      this.apiProcess.unref()
    }
  }

  /**
   * 停止后台服务
   * 等待子进程真正退出后再返回，避免退出竞态
   */
  stop(): Promise<void> {
    const proc = this.apiProcess
    if (!proc) {
      return Promise.resolve()
    }

    this.apiProcess = null
    logger.info('停止后台服务...', { module: 'ApiService' })

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
        // 已退出
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

  isRunning(): boolean {
    return this.apiProcess !== null
  }
}
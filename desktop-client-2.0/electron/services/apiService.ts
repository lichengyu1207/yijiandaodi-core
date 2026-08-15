/**
 * API服务模块 - 后台服务管理
 */

import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { app } from 'electron'
import { logger } from './loggerService'

export class ApiService {
  private apiProcess: ChildProcess | null = null

  start() {
    const isDev = !app.isPackaged

    if (isDev) {
      // 开发环境：直接启动 Python 服务
      const backendPath = 'C:\\MsSafeData\\Desktop\\yijiandaodi\\sandbox_api.py'

      logger.info('启动后台服务:', { module: 'ApiService' }, { path: backendPath })

      this.apiProcess = spawn('python', [backendPath], {
        cwd: 'C:\\MsSafeData\\Desktop\\yijiandaodi',
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
      // 生产环境：启动打包后的服务
      const backendPath = path.join(path.dirname(__dirname), 'backend')
      const pythonExe = path.join(backendPath, 'python', 'python.exe')

      this.apiProcess = spawn(pythonExe, ['sandbox_api.py'], {
        cwd: backendPath,
        stdio: 'pipe',
        detached: true
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
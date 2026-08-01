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
        stdio: 'pipe'
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

  stop() {
    if (this.apiProcess) {
      logger.info('停止后台服务...', { module: 'ApiService' })
      this.apiProcess.kill()
      this.apiProcess = null
    }
  }

  isRunning(): boolean {
    return this.apiProcess !== null
  }
}
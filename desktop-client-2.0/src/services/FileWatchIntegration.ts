/**
 * 文件监控集成示例
 * 
 * 展示如何在Electron主进程中集成文件监控服务
 * 
 * 作者：一鉴到底团队
 * 创建时间：2026-08-12
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import { createFileWatchService, FileWatchService } from './FileWatchService'

/**
 * Electron主进程集成示例
 */
class FileWatchIntegrationExample {
  private fileWatchService: FileWatchService | null = null
  
  /**
   * 应用启动时调用
   */
  async onAppReady(authToken: string): Promise<void> {
    try {
      console.log('[Integration] 应用启动，初始化文件监控服务...')
      
      // 创建文件监控服务
      this.fileWatchService = createFileWatchService('http://localhost:8000/api/v1')
      
      // 启动服务
      await this.fileWatchService.start(authToken)
      
      console.log('[Integration] 文件监控服务已启动')
    } catch (error) {
      console.error('[Integration] 初始化文件监控服务失败:', error)
    }
  }
  
  /**
   * 窗口创建时调用
   */
  onWindowCreated(window: BrowserWindow): void {
    if (this.fileWatchService) {
      this.fileWatchService.setMainWindow(window)
    }
    
    // 设置IPC监听器
    this.setupIpcListeners()
  }
  
  /**
   * 设置IPC监听器（用于渲染进程通信）
   */
  private setupIpcListeners(): void {
    // 获取监控配置列表
    ipcMain.handle('file-watch:get-configs', async () => {
      if (this.fileWatchService) {
        return this.fileWatchService.getConfigs()
      }
      return []
    })
    
    // 创建监控配置
    ipcMain.handle('file-watch:create-config', async (_event, configData) => {
      if (this.fileWatchService) {
        return await this.fileWatchService.createConfig(configData)
      }
      return null
    })
    
    // 更新监控配置
    ipcMain.handle('file-watch:update-config', async (_event, configId, configData) => {
      if (this.fileWatchService) {
        return await this.fileWatchService.updateConfig(configId, configData)
      }
      return null
    })
    
    // 删除监控配置
    ipcMain.handle('file-watch:delete-config', async (_event, configId) => {
      if (this.fileWatchService) {
        return await this.fileWatchService.deleteConfig(configId)
      }
      return false
    })
    
    // 激活监控
    ipcMain.handle('file-watch:activate', async (_event, configId) => {
      if (this.fileWatchService) {
        return await this.fileWatchService.activateWatch(configId)
      }
      return false
    })
    
    // 停止监控
    ipcMain.handle('file-watch:deactivate', async (_event, configId) => {
      if (this.fileWatchService) {
        return await this.fileWatchService.deactivateWatch(configId)
      }
      return false
    })
    
    // 获取监控状态
    ipcMain.handle('file-watch:get-status', async () => {
      if (this.fileWatchService) {
        const status = this.fileWatchService.getWatchStatus()
        return Object.fromEntries(status)
      }
      return {}
    })
    
    // 手动触发文件校验
    ipcMain.handle('file-watch:verify-file', async (_event, filePath) => {
      if (this.fileWatchService) {
        return await this.fileWatchService.verifyFile(filePath)
      }
      return null
    })
  }
  
  /**
   * 应用退出时调用
   */
  async onAppQuit(): Promise<void> {
    if (this.fileWatchService) {
      await this.fileWatchService.stop()
    }
  }
}

/**
 * 实际集成代码示例
 */

// 在main.ts或index.ts中
const integration = new FileWatchIntegrationExample()

// 应用启动时
app.whenReady().then(async () => {
  // 创建窗口
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  
  // 加载页面
  mainWindow.loadFile('index.html')
  
  // 设置窗口
  integration.onWindowCreated(mainWindow)
  
  // 假设已经获取了认证令牌
  const authToken = 'user-auth-token'
  
  // 启动文件监控服务
  await integration.onAppReady(authToken)
})

// 应用退出时
app.on('before-quit', async () => {
  await integration.onAppQuit()
})

/**
 * 渲染进程调用示例（在React组件中）
 */

/*
import { ipcRenderer } from 'electron'

// 获取监控配置列表
const configs = await ipcRenderer.invoke('file-watch:get-configs')

// 创建监控配置
const newConfig = await ipcRenderer.invoke('file-watch:create-config', {
  watch_path: 'C:\\漫剧\\素材',
  watch_name: '素材目录',
  watch_create: true,
  watch_modify: true,
  watch_rename: true,
  watch_delete: true,
  file_extensions: ['jpg', 'png', 'mp4'],
  exclude_patterns: ['*.tmp', '*.temp'],
  auto_verify: true,
  risk_threshold: 'medium'
})

// 激活监控
await ipcRenderer.invoke('file-watch:activate', configId)

// 停止监控
await ipcRenderer.invoke('file-watch:deactivate', configId)

// 手动触发文件校验
const result = await ipcRenderer.invoke('file-watch:verify-file', 'C:\\漫剧\\素材\\test.jpg')
*/

export { FileWatchIntegrationExample }
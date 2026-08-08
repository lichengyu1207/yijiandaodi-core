/**
 * IPC处理器模块
 */

import { ipcMain } from 'electron'
import { StorageService } from '../services/storageService'
import { FileMonitor, ClipboardMonitor } from '../monitoring'
import { PetState } from '../windows/petWindow'
import { syncService } from '../services/syncService'
import type { GovernanceHealthMonitor } from '../services/governanceHealthMonitor'

export class IPCHandlers {
  private storageService: StorageService
  private fileMonitor: FileMonitor
  private clipboardMonitor: ClipboardMonitor
  private getPetState: () => PetState
  private healthMonitor?: GovernanceHealthMonitor

  constructor(
    storageService: StorageService,
    fileMonitor: FileMonitor,
    clipboardMonitor: ClipboardMonitor,
    getPetState: () => PetState,
    healthMonitor?: GovernanceHealthMonitor
  ) {
    this.storageService = storageService
    this.fileMonitor = fileMonitor
    this.clipboardMonitor = clipboardMonitor
    this.getPetState = getPetState
    this.healthMonitor = healthMonitor
  }

  registerAll() {
    this.registerStorageHandlers()
    this.registerMonitoringHandlers()
    this.registerPetHandlers()
    this.registerSyncHandlers()
    this.registerHealthHandlers()
  }

  private registerStorageHandlers() {
    // 获取操作记录
    ipcMain.handle('get-operations', async () => {
      return await this.storageService.getOperations()
    })

    // 保存操作记录
    ipcMain.handle('save-operation', async (event, operation) => {
      return await this.storageService.saveOperation(operation)
    })

    // 清除操作记录
    ipcMain.handle('clear-operations', async () => {
      return await this.storageService.clearOperations()
    })

    // 导出数据
    ipcMain.handle('export-data', async (event, format) => {
      return await this.storageService.exportData(format)
    })

    // 获取存储路径
    ipcMain.handle('get-storage-path', async () => {
      return this.storageService.getDataPath()
    })
  }

  private registerMonitoringHandlers() {
    // 开始监控
    ipcMain.handle('start-monitoring', async () => {
      try {
        this.fileMonitor.start()
        this.clipboardMonitor.start()
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 停止监控
    ipcMain.handle('stop-monitoring', async () => {
      try {
        this.fileMonitor.stop()
        this.clipboardMonitor.stop()
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })
  }

  private registerPetHandlers() {
    // 获取桌宠状态
    ipcMain.handle('get-pet-state', async () => {
      return this.getPetState()
    })

    // 确认风险
    ipcMain.handle('confirm-risk', async (event, action: 'allow' | 'deny') => {
      console.log(`[风险] 用户确认: ${action}`)
      // 这里需要通过回调更新状态
      return { success: true }
    })
  }

  private registerSyncHandlers() {
    // 获取同步配置
    ipcMain.handle('get-sync-config', async () => {
      try {
        const config = syncService.getConfig()
        return { success: true, data: config }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 保存同步配置
    ipcMain.handle('save-sync-config', async (event, config) => {
      try {
        syncService.saveConfig(config)
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 立即同步
    ipcMain.handle('sync-now', async () => {
      try {
        // 从 StorageService 获取本地数据
        const operations = await this.storageService.getOperations()
        // 这里需要将 operations 转换为 SyncSession 格式
        // 实际使用时需要根据业务逻辑处理
        const sessions: any[] = []

        const result = await syncService.syncAll(sessions)
        return result
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 仅上传
    ipcMain.handle('upload-data', async () => {
      try {
        const operations = await this.storageService.getOperations()
        const sessions: any[] = []

        const result = await syncService.uploadSessions(sessions)
        return result
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 仅下载
    ipcMain.handle('download-data', async () => {
      try {
        const result = await syncService.downloadSessions()
        if (result.success && result.data) {
          // 保存到本地
          // 这里需要根据实际业务逻辑处理
          return { success: true, downloaded: result.data.length }
        }
        return { success: false, error: result.error }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 清除同步数据
    ipcMain.handle('clear-sync-data', async () => {
      try {
        syncService.clearSyncData()
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 设置认证Token
    ipcMain.handle('set-sync-token', async (event, token: string) => {
      try {
        syncService.setAuthToken(token)
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })
  }

  private registerHealthHandlers() {
    // 获取健康度指标
    ipcMain.handle('get-health-metrics', async () => {
      try {
        if (!this.healthMonitor) {
          return { 
            success: false, 
            error: '健康度监控器未初始化' 
          }
        }
        
        const metrics = this.healthMonitor.collectMetrics()
        return { success: true, data: metrics }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 获取健康度历史
    ipcMain.handle('get-health-history', async (event, limit: number = 10) => {
      try {
        if (!this.healthMonitor) {
          return { 
            success: false, 
            error: '健康度监控器未初始化' 
          }
        }
        
        const history = this.healthMonitor.getMetricsHistory(limit)
        return { success: true, data: history }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 获取健康度报告
    ipcMain.handle('get-health-report', async () => {
      try {
        if (!this.healthMonitor) {
          return { 
            success: false, 
            error: '健康度监控器未初始化' 
          }
        }
        
        const report = this.healthMonitor.exportReport()
        return { success: true, data: report }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })
  }
}
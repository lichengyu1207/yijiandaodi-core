/**
 * IPC处理器模块
 */

import { ipcMain } from 'electron'
import { StorageService } from '../services/storageService'
import { FileMonitor, ClipboardMonitor } from '../monitoring'
import { PetState } from '../windows/petWindow'

export class IPCHandlers {
  private storageService: StorageService
  private fileMonitor: FileMonitor
  private clipboardMonitor: ClipboardMonitor
  private getPetState: () => PetState

  constructor(
    storageService: StorageService,
    fileMonitor: FileMonitor,
    clipboardMonitor: ClipboardMonitor,
    getPetState: () => PetState
  ) {
    this.storageService = storageService
    this.fileMonitor = fileMonitor
    this.clipboardMonitor = clipboardMonitor
    this.getPetState = getPetState
  }

  registerAll() {
    this.registerStorageHandlers()
    this.registerMonitoringHandlers()
    this.registerPetHandlers()
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
}
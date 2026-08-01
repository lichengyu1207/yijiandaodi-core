/**
 * 云端同步服务
 * 功能：桌面端与云端数据同步
 */

import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { logger } from './loggerService'

export interface SyncConfig {
  enabled: boolean           // 是否启用同步
  autoSync: boolean          // 自动同步
  syncInterval: number       // 同步间隔（分钟）
  lastSyncTime?: string      // 上次同步时间
  apiUrl: string             // API地址
}

export interface SyncSession {
  session_id: string
  title: string
  status: string
  message_count: number
  messages: SyncMessage[]
  created_at: string
  updated_at: string
}

export interface SyncMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

export interface SyncResult {
  success: boolean
  uploaded?: number
  downloaded?: number
  error?: string
}

export class SyncService {
  private configPath: string
  private config: SyncConfig
  private syncTimer?: NodeJS.Timeout
  private token?: string

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'sync-config.json')
    this.config = this.loadConfig()
  }

  /**
   * 加载同步配置
   */
  private loadConfig(): SyncConfig {
    const defaultConfig: SyncConfig = {
      enabled: true,
      autoSync: true,
      syncInterval: 30, // 默认30分钟
      apiUrl: 'https://yijiandaodi.com/api/cloud-cache'
    }

    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8')
        return { ...defaultConfig, ...JSON.parse(data) }
      }
    } catch (error) {
      logger.error('[SyncService] 加载配置失败:', { module: 'SyncService' }, { error })
    }

    return defaultConfig
  }

  /**
   * 保存同步配置
   */
  saveConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig }

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
      logger.info('[SyncService] 配置已保存', { module: 'SyncService' })

      // 重新启动自动同步
      if (this.config.autoSync && this.config.enabled) {
        this.startAutoSync()
      } else {
        this.stopAutoSync()
      }
    } catch (error) {
      logger.error('[SyncService] 保存配置失败:', { module: 'SyncService' }, { error })
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): SyncConfig {
    return { ...this.config }
  }

  /**
   * 设置认证Token
   */
  setAuthToken(token: string): void {
    this.token = token
  }

  /**
   * 上传本地会话到云端
   */
  async uploadSessions(sessions: SyncSession[]): Promise<SyncResult> {
    if (!this.config.enabled) {
      return { success: false, error: '同步已禁用' }
    }

    if (!this.token) {
      return { success: false, error: '未登录，请先登录' }
    }

    try {
      logger.info('[SyncService] 开始上传会话', { module: 'SyncService' }, { count: sessions.length })

      const response = await axios.post(
        `${this.config.apiUrl}/sessions/upload/`,
        { sessions },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.data.success) {
        // 更新最后同步时间
        this.config.lastSyncTime = new Date().toISOString()
        this.saveConfig(this.config)

        return {
          success: true,
          uploaded: response.data.uploaded || sessions.length
        }
      }

      return { success: false, error: response.data.message }
    } catch (error: any) {
      logger.error('[SyncService] 上传失败:', { module: 'SyncService' }, { error })
      return {
        success: false,
        error: error.response?.data?.message || error.message
      }
    }
  }

  /**
   * 从云端下载会话到本地
   */
  async downloadSessions(since?: string): Promise<{ success: boolean; data?: SyncSession[]; error?: string }> {
    if (!this.config.enabled) {
      return { success: false, error: '同步已禁用' }
    }

    if (!this.token) {
      return { success: false, error: '未登录，请先登录' }
    }

    try {
      logger.info('[SyncService] 开始下载会话', { module: 'SyncService' })

      const params: any = {}
      if (since || this.config.lastSyncTime) {
        params.since = since || this.config.lastSyncTime
      }

      const response = await axios.get(
        `${this.config.apiUrl}/sessions/download/`,
        {
          params,
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        }
      )

      if (response.data.success) {
        // 更新最后同步时间
        this.config.lastSyncTime = new Date().toISOString()
        this.saveConfig(this.config)

        return {
          success: true,
          data: response.data.sessions || []
        }
      }

      return { success: false, error: response.data.message }
    } catch (error: any) {
      logger.error('[SyncService] 下载失败:', { module: 'SyncService' }, { error })
      return {
        success: false,
        error: error.response?.data?.message || error.message
      }
    }
  }

  /**
   * 执行完整同步（上传 + 下载）
   */
  async syncAll(localSessions: SyncSession[]): Promise<SyncResult> {
    logger.info('[SyncService] 开始完整同步', { module: 'SyncService' })

    // 1. 上传本地数据
    const uploadResult = await this.uploadSessions(localSessions)
    if (!uploadResult.success) {
      return uploadResult
    }

    // 2. 下载云端数据
    const downloadResult = await this.downloadSessions()
    if (!downloadResult.success) {
      return { success: false, error: downloadResult.error }
    }

    return {
      success: true,
      uploaded: uploadResult.uploaded,
      downloaded: downloadResult.data?.length || 0
    }
  }

  /**
   * 启动自动同步
   */
  startAutoSync(): void {
    if (!this.config.autoSync || !this.config.enabled) {
      return
    }

    // 停止已有的定时器
    this.stopAutoSync()

    // 启动新的定时器
    const intervalMs = this.config.syncInterval * 60 * 1000
    this.syncTimer = setInterval(() => {
      logger.info('[SyncService] 自动同步触发', { module: 'SyncService' })
      // 这里需要传入本地会话数据
      // 实际使用时需要从 StorageService 获取
    }, intervalMs)

    logger.info(`[SyncService] 自动同步已启动`, { module: 'SyncService' }, { interval: this.config.syncInterval })
  }

  /**
   * 停止自动同步
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = undefined
      logger.info('[SyncService] 自动同步已停止', { module: 'SyncService' })
    }
  }

  /**
   * 应用启动时执行同步
   */
  async syncOnStartup(localSessions: SyncSession[]): Promise<SyncResult> {
    logger.info('[SyncService] 应用启动，执行同步', { module: 'SyncService' })

    if (!this.config.enabled) {
      return { success: false, error: '同步已禁用' }
    }

    return await this.syncAll(localSessions)
  }

  /**
   * 检查是否需要同步
   */
  needSync(): boolean {
    if (!this.config.enabled || !this.config.autoSync) {
      return false
    }

    if (!this.config.lastSyncTime) {
      return true
    }

    const lastSync = new Date(this.config.lastSyncTime)
    const now = new Date()
    const diffMinutes = (now.getTime() - lastSync.getTime()) / (1000 * 60)

    return diffMinutes >= this.config.syncInterval
  }

  /**
   * 清除同步数据
   */
  clearSyncData(): void {
    this.config.lastSyncTime = undefined
    this.saveConfig(this.config)
    logger.info('[SyncService] 同步数据已清除', { module: 'SyncService' })
  }
}

// 导出单例
export const syncService = new SyncService()
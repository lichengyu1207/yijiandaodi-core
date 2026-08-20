/**
 * 文件监控服务管理
 * 
 * 功能：
 * - 管理监控配置
 * - 与后端同步配置
 * - 处理用户交互
 * 
 * 作者：一鉴到底团队
 * 创建时间：2026-08-12
 */

import { BrowserWindow } from 'electron'
import { FileWatcher, FileWatchConfig } from './FileWatcher'
import { httpClient, HttpClient } from './http'

/**
 * 文件监控服务类
 */
export class FileWatchService {
  private fileWatcher: FileWatcher | null = null
  private apiClient: HttpClient
  private mainWindow: BrowserWindow | null = null
  private configs: Map<number, FileWatchConfig> = new Map()
  private syncInterval: NodeJS.Timeout | null = null
  
  /**
   * 构造函数
   */
  constructor(baseUrl: string) {
    const initStartTime = Date.now()
    console.log('[File-Watch-Service] ========== 开始初始化文件监控服务 ==========')
    console.log(`[File-Watch-Service] 基础URL: ${baseUrl}`)
    
    // 使用全局 HTTP 客户端实例
    this.apiClient = httpClient
    console.log('[File-Watch-Service] HTTP 客户端实例已获取')
    
    // 检查熔断器状态
    const circuitBreakerStatus = this.apiClient.getCircuitBreakerStatus()
    if (circuitBreakerStatus) {
      console.log(`[File-Watch-Service] 熔断器状态: ${circuitBreakerStatus.state}`)
      console.log(`[File-Watch-Service] 熔断器配置:`, {
        failureThreshold: circuitBreakerStatus.config?.failureThreshold || 5,
        openDuration: `${circuitBreakerStatus.config?.openDuration || 30000}ms`,
        enabled: circuitBreakerStatus.config?.enabled !== false
      })
    } else {
      console.log('[File-Watch-Service] 熔断器未启用')
    }
    
    console.log(`[File-Watch-Service] ========== 文件监控服务初始化完成 ========== 耗时: ${Date.now() - initStartTime}ms`)
  }
  
  /**
   * 启动服务
   */
  async start(authToken: string): Promise<void> {
    const startTime = Date.now()
    console.log('[File-Watch-Service] ========== 开始启动服务 ==========')
    console.log(`[File-Watch-Service] 认证令牌: ${authToken ? '已提供' : '未提供'}`)
    
    try {
      // 检查熔断器状态
      const circuitBreakerStatus = this.apiClient.getCircuitBreakerStatus()
      if (circuitBreakerStatus) {
        console.log(`[File-Watch-Service] 熔断器状态检查:`)
        console.log(`  - 当前状态: ${circuitBreakerStatus.state}`)
        console.log(`  - 总调用次数: ${circuitBreakerStatus.statistics?.totalCalls || 0}`)
        console.log(`  - 失败次数: ${circuitBreakerStatus.statistics?.failedCalls || 0}`)
        console.log(`  - 失败率: ${circuitBreakerStatus.statistics?.failureRate ? (circuitBreakerStatus.statistics.failureRate * 100).toFixed(2) : 0}%`)
        
        if (circuitBreakerStatus.state === 'OPEN') {
          console.warn(`[File-Watch-Service] [警告] 熔断器已打开，后端服务可能不可用`)
          console.warn(`[File-Watch-Service] [警告] 服务启动将继续，但无法同步配置`)
        }
      }
      
      console.log(`[File-Watch-Service] 创建文件监控器...`)
      const createStartTime = Date.now()
      
      // 创建文件监控器
      // 注意：认证令牌已通过全局 HTTP 客户端配置
      this.fileWatcher = new FileWatcher('', authToken)
      
      console.log(`[File-Watch-Service] 文件监控器已创建 耗时: ${Date.now() - createStartTime}ms`)
      
      if (this.mainWindow) {
        this.fileWatcher.setMainWindow(this.mainWindow)
        console.log(`[File-Watch-Service] 主窗口已设置`)
      }
      
      // 同步配置
      console.log(`[File-Watch-Service] 开始同步配置...`)
      await this.syncConfigs()
      
      // 启动所有激活的监控
      console.log(`[File-Watch-Service] 开始启动激活的监控...`)
      await this.startAllActiveWatches()
      
      // 启动配置同步定时器（每5分钟同步一次）
      this.syncInterval = setInterval(async () => {
        console.log(`[File-Watch-Service] [定时同步] 触发配置同步`)
        await this.syncConfigs()
      }, 5 * 60 * 1000)
      console.log(`[File-Watch-Service] 定时同步已启动（间隔: 5分钟）`)
      
      console.log(`[File-Watch-Service] ========== 服务启动成功 ========== 总耗时: ${Date.now() - startTime}ms`)
      console.log(`[File-Watch-Service] 当前配置数: ${this.configs.size}`)
    } catch (error: any) {
      const elapsed = Date.now() - startTime
      console.error(`[File-Watch-Service] ========== 服务启动失败 ========== 耗时: ${elapsed}ms`)
      console.error(`[File-Watch-Service] 错误类型: ${error.constructor.name}`)
      console.error(`[File-Watch-Service] 错误消息: ${error.message}`)
      console.error(`[File-Watch-Service] 错误堆栈:`, error.stack)
      
      // 检查熔断器状态（错误后）
      const newCircuitBreakerStatus = this.apiClient.getCircuitBreakerStatus()
      if (newCircuitBreakerStatus) {
        console.error(`[File-Watch-Service] 熔断器状态: ${newCircuitBreakerStatus.state}`)
        console.error(`[File-Watch-Service] 失败次数: ${newCircuitBreakerStatus.statistics?.failedCalls || 0}`)
        console.error(`[File-Watch-Service] 失败率: ${newCircuitBreakerStatus.statistics?.failureRate ? (newCircuitBreakerStatus.statistics.failureRate * 100).toFixed(2) : 0}%`)
      }
    }
  }
  
  /**
   * 停止服务
   */
  async stop(): Promise<void> {
    const startTime = Date.now()
    console.log('[File-Watch-Service] ========== 开始停止服务 ==========')
    
    try {
      // 停止所有监控
      if (this.fileWatcher) {
        console.log('[File-Watch-Service] 停止所有监控...')
        await this.fileWatcher.stopAllWatches()
        console.log('[File-Watch-Service] 所有监控已停止')
      }
      
      // 停止配置同步
      if (this.syncInterval) {
        console.log('[File-Watch-Service] 停止定时同步...')
        clearInterval(this.syncInterval)
        this.syncInterval = null
        console.log('[File-Watch-Service] 定时同步已停止')
      }
      
      // 清空配置
      const configCount = this.configs.size
      this.configs.clear()
      console.log(`[File-Watch-Service] 已清空 ${configCount} 个配置`)
      
      console.log(`[File-Watch-Service] ========== 服务已停止 ========== 总耗时: ${Date.now() - startTime}ms`)
    } catch (error: any) {
      const elapsed = Date.now() - startTime
      console.error(`[File-Watch-Service] ========== 停止服务失败 ========== 耗时: ${elapsed}ms`)
      console.error(`[File-Watch-Service] 错误类型: ${error.constructor.name}`)
      console.error(`[File-Watch-Service] 错误消息: ${error.message}`)
      console.error(`[File-Watch-Service] 错误堆栈:`, error.stack)
    }
  }
  
  /**
   * 设置主窗口
   */
  setMainWindow(window: BrowserWindow): void {
    console.log('[File-Watch-Service] 设置主窗口')
    this.mainWindow = window
    
    if (this.fileWatcher) {
      this.fileWatcher.setMainWindow(window)
      console.log('[File-Watch-Service] 主窗口已传递给文件监控器')
    }
  }
  
  /**
   * 同步配置（从后端获取）
   */
  private async syncConfigs(): Promise<void> {
    const startTime = Date.now()
    console.log('[File-Watch-Service] ========== 开始同步配置 ==========')
    
    // 检查熔断器状态
    const circuitBreakerStatus = this.apiClient.getCircuitBreakerStatus()
    if (circuitBreakerStatus) {
      console.log(`[File-Watch-Service] 熔断器状态: ${circuitBreakerStatus.state}`)
      if (circuitBreakerStatus.state === 'OPEN') {
        console.warn(`[File-Watch-Service] [警告] 熔断器已打开，同步请求将触发降级`)
      }
    }
    
    try {
      console.log(`[File-Watch-Service] 发送同步请求...`)
      const requestStartTime = Date.now()
      
      const response = await this.apiClient.get('/api/v1/file-watch/configs/')
      
      const responseTime = Date.now() - requestStartTime
      console.log(`[File-Watch-Service] 响应时间: ${responseTime}ms`)
      console.log(`[File-Watch-Service] 响应状态码: ${response.status}`)
      console.log(`[File-Watch-Service] 响应状态文本: ${response.statusText}`)
      
      // 检查是否是降级响应
      if (response.data.degraded) {
        console.warn(`[File-Watch-Service] [降级] 收到降级响应`)
        console.warn(`[File-Watch-Service] [降级] 消息: ${response.data.message}`)
        console.warn(`[File-Watch-Service] [降级] 错误码: ${response.data.errorCode}`)
        console.log(`[File-Watch-Service] ========== 配置同步完成（降级） ========== 总耗时: ${Date.now() - startTime}ms`)
        return
      }
      
      const configs: FileWatchConfig[] = response.data
      
      // 更新本地配置
      const oldConfigCount = this.configs.size
      this.configs.clear()
      for (const config of configs) {
        this.configs.set(config.id, config)
      }
      
      console.log(`[File-Watch-Service] 配置同步详情:`)
      console.log(`  - 旧配置数: ${oldConfigCount}`)
      console.log(`  - 新配置数: ${this.configs.size}`)
      console.log(`  - 响应配置数: ${configs.length}`)
      
      // 输出配置详情
      if (configs.length > 0) {
        console.log(`[File-Watch-Service] 配置列表:`)
        for (const config of configs) {
          console.log(`  - ID: ${config.id}, 名称: ${config.watch_name}, 路径: ${config.watch_path}`)
        }
      }
      
      console.log(`[File-Watch-Service] ========== 配置同步成功 ========== 总耗时: ${Date.now() - startTime}ms`)
    } catch (error: any) {
      const elapsed = Date.now() - startTime
      console.error(`[File-Watch-Service] ========== 配置同步失败 ========== 耗时: ${elapsed}ms`)
      console.error(`[File-Watch-Service] 错误类型: ${error.constructor.name}`)
      console.error(`[File-Watch-Service] 错误消息: ${error.message}`)
      console.error(`[File-Watch-Service] 错误堆栈:`, error.stack)
      
      // 检查熔断器状态（错误后）
      const newCircuitBreakerStatus = this.apiClient.getCircuitBreakerStatus()
      if (newCircuitBreakerStatus) {
        console.error(`[File-Watch-Service] 熔断器状态: ${newCircuitBreakerStatus.state}`)
        console.error(`[File-Watch-Service] 失败次数: ${newCircuitBreakerStatus.statistics?.failedCalls || 0}`)
        console.error(`[File-Watch-Service] 失败率: ${newCircuitBreakerStatus.statistics?.failureRate ? (newCircuitBreakerStatus.statistics.failureRate * 100).toFixed(2) : 0}%`)
      }
    }
  }
  
  /**
   * 启动所有激活的监控
   */
  private async startAllActiveWatches(): Promise<void> {
    try {
      console.log('[File-Watch-Service] 启动所有激活的监控...')
      
      for (const [, config] of this.configs) {
        if (config.is_active && this.fileWatcher) {
          await this.fileWatcher.startWatch(config)
        }
      }
      
      console.log('[File-Watch-Service] 所有激活的监控已启动')
    } catch (error) {
      console.error('[File-Watch-Service] 启动监控失败:', error)
    }
  }
  
  /**
   * 创建监控配置
   */
  async createConfig(configData: Partial<FileWatchConfig>): Promise<FileWatchConfig | null> {
    try {
      console.log('[File-Watch-Service] 创建监控配置:', configData.watch_name)
      
      const response = await this.apiClient.post('/api/v1/file-watch/configs/', configData)
      const newConfig: FileWatchConfig = response.data
      
      // 添加到本地配置
      this.configs.set(newConfig.id, newConfig)
      
      // 如果配置为激活状态，立即开始监控
      if (newConfig.is_active && this.fileWatcher) {
        await this.fileWatcher.startWatch(newConfig)
      }
      
      console.log('[File-Watch-Service] 监控配置已创建:', newConfig.id)
      
      return newConfig
    } catch (error) {
      console.error('[File-Watch-Service] 创建监控配置失败:', error)
      return null
    }
  }
  
  /**
   * 更新监控配置
   */
  async updateConfig(configId: number, configData: Partial<FileWatchConfig>): Promise<FileWatchConfig | null> {
    try {
      console.log('[File-Watch-Service] 更新监控配置:', configId)
      
      const response = await this.apiClient.put(`/api/v1/file-watch/configs/${configId}/`, configData)
      const updatedConfig: FileWatchConfig = response.data
      
      // 更新本地配置
      this.configs.set(configId, updatedConfig)
      
      // 重新启动监控
      if (this.fileWatcher) {
        await this.fileWatcher.stopWatch(configId)
        
        if (updatedConfig.is_active) {
          await this.fileWatcher.startWatch(updatedConfig)
        }
      }
      
      console.log('[File-Watch-Service] 监控配置已更新:', configId)
      
      return updatedConfig
    } catch (error) {
      console.error('[File-Watch-Service] 更新监控配置失败:', error)
      return null
    }
  }
  
  /**
   * 删除监控配置
   */
  async deleteConfig(configId: number): Promise<boolean> {
    try {
      console.log('[File-Watch-Service] 删除监控配置:', configId)
      
      // 停止监控
      if (this.fileWatcher) {
        await this.fileWatcher.stopWatch(configId)
      }
      
      // 删除后端配置
      await this.apiClient.delete(`/api/v1/file-watch/configs/${configId}/`)
      
      // 删除本地配置
      this.configs.delete(configId)
      
      console.log('[File-Watch-Service] 监控配置已删除:', configId)
      
      return true
    } catch (error) {
      console.error('[File-Watch-Service] 删除监控配置失败:', error)
      return false
    }
  }
  
  /**
   * 激活监控
   */
  async activateWatch(configId: number): Promise<boolean> {
    try {
      console.log('[File-Watch-Service] 激活监控:', configId)
      
      // 调用后端API
      await this.apiClient.post(`/api/v1/file-watch/configs/${configId}/activate/`)
      
      // 更新本地配置
      const config = this.configs.get(configId)
      if (config) {
        config.is_active = true
        
        // 启动监控
        if (this.fileWatcher) {
          await this.fileWatcher.startWatch(config)
        }
      }
      
      console.log('[File-Watch-Service] 监控已激活:', configId)
      
      return true
    } catch (error) {
      console.error('[File-Watch-Service] 激活监控失败:', error)
      return false
    }
  }
  
  /**
   * 停止监控
   */
  async deactivateWatch(configId: number): Promise<boolean> {
    try {
      console.log('[File-Watch-Service] 停止监控:', configId)
      
      // 调用后端API
      await this.apiClient.post(`/api/v1/file-watch/configs/${configId}/deactivate/`)
      
      // 停止本地监控
      if (this.fileWatcher) {
        await this.fileWatcher.stopWatch(configId)
      }
      
      // 更新本地配置
      const config = this.configs.get(configId)
      if (config) {
        config.is_active = false
      }
      
      console.log('[File-Watch-Service] 监控已停止:', configId)
      
      return true
    } catch (error) {
      console.error('[File-Watch-Service] 停止监控失败:', error)
      return false
    }
  }
  
  /**
   * 获取监控配置列表
   */
  getConfigs(): FileWatchConfig[] {
    return Array.from(this.configs.values())
  }
  
  /**
   * 获取单个监控配置
   */
  getConfig(configId: number): FileWatchConfig | undefined {
    return this.configs.get(configId)
  }
  
  /**
   * 获取监控状态
   */
  getWatchStatus(): Map<number, boolean> {
    if (this.fileWatcher) {
      return this.fileWatcher.getWatchStatus()
    }
    return new Map()
  }
  
  /**
   * 手动触发文件校验
   */
  async verifyFile(filePath: string): Promise<any> {
    try {
      console.log('[File-Watch-Service] 手动触发文件校验:', filePath)
      
      const response = await this.apiClient.post('/api/v1/file-watch/verify/', {
        file_path: filePath
      })
      
      return response.data
    } catch (error) {
      console.error('[File-Watch-Service] 手动触发校验失败:', error)
      return null
    }
  }
}

/**
 * 导出单例实例创建函数
 */
export function createFileWatchService(baseUrl: string): FileWatchService {
  return new FileWatchService(baseUrl)
}
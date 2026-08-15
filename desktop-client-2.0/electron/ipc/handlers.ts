/**
 * IPC处理器模块
 */

import { ipcMain } from 'electron'
import { StorageService } from '../services/storageService'
import { FileMonitor, ClipboardMonitor, ApiCallMonitor, ProcessMonitor } from '../monitoring'
import { PetState } from '../windows/petWindow'
import { syncService } from '../services/syncService'
import { LogLevel } from '../services/loggerService'
import { localAuthService } from '../services/localAuthService'
import { GovernanceLogger, loadGovernanceLogLevel, saveGovernanceLogLevel } from '../events/governanceLogger'
import type { GovernanceHealthMonitor } from '../services/governanceHealthMonitor'
import { getRunOnceStats, type PluginRegistry } from '../agent/pluginRegistry'
import { checkHookHostStats } from '../agent/hooks/statsCheck'
import {
  PERMISSION_KEYS,
  PermissionConfig,
  PermissionKey,
  loadPermissionConfig,
  savePermissionConfig,
} from '../permissions/permissionConfig'

export class IPCHandlers {
  private storageService: StorageService
  private fileMonitor: FileMonitor
  private clipboardMonitor: ClipboardMonitor
  private apiCallMonitor: ApiCallMonitor
  private processMonitor: ProcessMonitor
  private getPetState: () => PetState
  private healthMonitor?: GovernanceHealthMonitor
  private governanceLogger?: GovernanceLogger
  private userDataPath: string
  private onPermissionChanged?: () => void
  private pluginRegistry?: PluginRegistry

  constructor(
    storageService: StorageService,
    fileMonitor: FileMonitor,
    clipboardMonitor: ClipboardMonitor,
    getPetState: () => PetState,
    healthMonitor?: GovernanceHealthMonitor,
    apiCallMonitor?: ApiCallMonitor,
    processMonitor?: ProcessMonitor,
    governanceLogger?: GovernanceLogger,
    userDataPath?: string,
    onPermissionChanged?: () => void,
    pluginRegistry?: PluginRegistry
  ) {
    this.storageService = storageService
    this.fileMonitor = fileMonitor
    this.clipboardMonitor = clipboardMonitor
    this.getPetState = getPetState
    this.healthMonitor = healthMonitor
    this.apiCallMonitor = apiCallMonitor || new ApiCallMonitor()
    this.processMonitor = processMonitor || new ProcessMonitor()
    this.governanceLogger = governanceLogger
    this.userDataPath = userDataPath || ''
    this.onPermissionChanged = onPermissionChanged
    this.pluginRegistry = pluginRegistry
  }

  registerAll() {
    this.registerStorageHandlers()
    this.registerMonitoringHandlers()
    this.registerPetHandlers()
    this.registerSyncHandlers()
    this.registerHealthHandlers()
    this.registerFileWatchHandlers()
    this.registerApiCallHandlers()
    this.registerProcessHandlers()
    this.registerGovernanceLogHandlers()
    this.registerPermissionHandlers()
    this.registerLocalAuthHandlers()
    this.registerPluginHandlers()
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

  private registerFileWatchHandlers() {
    // 获取监控目录配置
    ipcMain.handle('get-file-watch-config', async () => {
      try {
        return {
          success: true,
          data: {
            watchPaths: this.fileMonitor.getWatchPaths(),
            status: this.fileMonitor.getWatchStatus(),
            backend: this.fileMonitor.getBackendConfig(),
          }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 设置监控目录
    ipcMain.handle('set-file-watch-paths', async (event, paths: string[]) => {
      try {
        if (!Array.isArray(paths)) {
          return { success: false, error: 'paths 必须为数组' }
        }
        this.fileMonitor.setWatchPaths(paths)
        return { success: true, data: this.fileMonitor.getWatchPaths() }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 设置后端上报（可选）
    ipcMain.handle('set-file-watch-backend', async (event, config: { enabled: boolean; baseUrl: string }) => {
      try {
        this.fileMonitor.setBackendConfig(!!config?.enabled, config?.baseUrl || '')
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })
  }

  private registerApiCallHandlers() {
    // 获取 API 调用监控配置
    ipcMain.handle('get-api-call-config', async () => {
      try {
        return {
          success: true,
          data: this.apiCallMonitor.getConfig(),
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 设置 API 调用监控配置并（按需）启停代理
    ipcMain.handle('set-api-call-config', async (event, patch: { enabled?: boolean; port?: number; alertOnSensitive?: boolean }) => {
      try {
        const prev = this.apiCallMonitor.getConfig()
        this.apiCallMonitor.setConfig(patch || {})
        if (patch?.enabled && !this.apiCallMonitor.getStatus().running) {
          this.apiCallMonitor.start()
        } else if (patch?.enabled === false) {
          this.apiCallMonitor.stop()
        }
        return { success: true, data: this.apiCallMonitor.getConfig() }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 获取 API 调用监控状态
    ipcMain.handle('get-api-call-status', async () => {
      return { success: true, data: this.apiCallMonitor.getStatus() }
    })

    // 获取 API 调用监控记录
    ipcMain.handle('get-api-call-records', async () => {
      return { success: true, data: this.apiCallMonitor.getRecords() }
    })
  }

  private registerProcessHandlers() {
    // 获取进程监控后端上报配置
    ipcMain.handle('get-process-config', async () => {
      try {
        return {
          success: true,
          data: {
            backend: this.processMonitor.getBackendConfig(),
            runningSessions: this.processMonitor.getRunningToolSessions(),
          }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 设置进程监控后端上报（含可选 token）
    ipcMain.handle('set-process-backend', async (event, config: { enabled: boolean; baseUrl: string; token?: string }) => {
      try {
        this.processMonitor.setBackendConfig(!!config?.enabled, config?.baseUrl || '', config?.token)
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })
  }

  private registerGovernanceLogHandlers() {
    // 获取治理日志级别
    ipcMain.handle('get-governance-log-level', async () => {
      try {
        return {
          success: true,
          data: { level: this.governanceLogger?.getLevel() ?? loadGovernanceLogLevel() },
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 设置治理日志级别（立即生效并持久化）
    ipcMain.handle('set-governance-log-level', async (event, level: string) => {
      try {
        const normalized = String(level || '').toLowerCase()
        if (!Object.values(LogLevel).includes(normalized as LogLevel)) {
          return { success: false, error: `无效日志级别: ${level}` }
        }
        this.governanceLogger?.setLevel(normalized as LogLevel)
        saveGovernanceLogLevel(normalized as LogLevel)
        return { success: true, data: { level: normalized } }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })
  }

  private registerPermissionHandlers() {
    // 获取操作权限配置
    ipcMain.handle('get-permission-config', async () => {
      try {
        const cfg = loadPermissionConfig(this.userDataPath)
        return { success: true, data: cfg }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 更新操作权限（按 key 合并，保存后通知主进程应用门控）
    ipcMain.handle('set-permission-config', async (event, patch: Partial<Record<PermissionKey, boolean>>) => {
      const start = Date.now()
      console.log('[IPC:set-permission-config] 收到请求', { patch })
      try {
        const cfg = loadPermissionConfig(this.userDataPath)
        if (patch && typeof patch === 'object') {
          for (const k of PERMISSION_KEYS) {
            if (typeof patch[k] === 'boolean') cfg.granted[k] = patch[k] as boolean
          }
        }
        savePermissionConfig(this.userDataPath, cfg)
        this.onPermissionChanged?.()
        console.log('[IPC:set-permission-config] 处理完成', { success: true, elapsedMs: Date.now() - start, granted: cfg.granted })
        return { success: true, data: cfg }
      } catch (error: any) {
        console.error('[IPC:set-permission-config] 异常', error?.message || error, { elapsedMs: Date.now() - start })
        return { success: false, error: error.message }
      }
    })

    // 完成首次授权引导（标记 onboarded）
    ipcMain.handle('complete-onboarding', async () => {
      const start = Date.now()
      console.log('[IPC:complete-onboarding] 收到请求')
      try {
        const cfg = loadPermissionConfig(this.userDataPath)
        cfg.onboarded = true
        savePermissionConfig(this.userDataPath, cfg)
        this.onPermissionChanged?.()
        console.log('[IPC:complete-onboarding] 处理完成', { success: true, elapsedMs: Date.now() - start })
        return { success: true, data: cfg }
      } catch (error: any) {
        console.error('[IPC:complete-onboarding] 异常', error?.message || error, { elapsedMs: Date.now() - start })
        return { success: false, error: error.message }
      }
    })
  }

  private registerLocalAuthHandlers() {
    // 本地账号状态（用于判断是否已完成首次设置）
    ipcMain.handle('get-local-auth-status', async () => {
      try {
        const data = localAuthService.getAccount()
        console.log('[IPC:get-local-auth-status] 返回', { data })
        return { success: true, data }
      } catch (error: any) {
        console.error('[IPC:get-local-auth-status] 异常', error?.message || error)
        return { success: false, error: error.message }
      }
    })

    // 设置本地账号密码（首次进入数据库）
    ipcMain.handle('register-local-auth', async (event, credentials: { username: string; password: string }) => {
      const start = Date.now()
      console.log('[IPC:register-local-auth] 收到请求', { username: credentials?.username, passwordLen: credentials?.password?.length || 0 })
      try {
        const result = localAuthService.register(credentials?.username || '', credentials?.password || '')
        console.log('[IPC:register-local-auth] 处理完成', { success: result.success, error: result.error, elapsedMs: Date.now() - start })
        if (!result.success) {
          return { success: false, error: result.error }
        }
        return { success: true }
      } catch (error: any) {
        console.error('[IPC:register-local-auth] 异常', error?.message || error, { elapsedMs: Date.now() - start })
        return { success: false, error: error.message }
      }
    })

    // 登录本地数据库
    ipcMain.handle('login-local-auth', async (event, credentials: { username: string; password: string }) => {
      const start = Date.now()
      console.log('[IPC:login-local-auth] 收到请求', { username: credentials?.username })
      try {
        const result = localAuthService.login(credentials?.username || '', credentials?.password || '')
        console.log('[IPC:login-local-auth] 处理完成', { success: result.success, error: result.error, elapsedMs: Date.now() - start })
        if (!result.success) {
          return { success: false, error: result.error }
        }
        return { success: true }
      } catch (error: any) {
        console.error('[IPC:login-local-auth] 异常', error?.message || error, { elapsedMs: Date.now() - start })
        return { success: false, error: error.message }
      }
    })

    // 完成首次设置引导
    ipcMain.handle('complete-local-setup', async () => {
      const start = Date.now()
      console.log('[IPC:complete-local-setup] 收到请求')
      try {
        const result = localAuthService.completeSetup()
        console.log('[IPC:complete-local-setup] 处理完成', { success: result.success, error: result.error, elapsedMs: Date.now() - start })
        if (!result.success) {
          return { success: false, error: result.error }
        }
        return { success: true }
      } catch (error: any) {
        console.error('[IPC:complete-local-setup] 异常', error?.message || error, { elapsedMs: Date.now() - start })
        return { success: false, error: error.message }
      }
    })
  }

  private registerPluginHandlers() {
    // 获取插件列表 + 钩子健康状态（Skill 插件生态）
    ipcMain.handle('get-plugins', async () => {
      try {
        const registry = this.pluginRegistry
        if (!registry) {
          return { success: true, data: { plugins: [], health: [] } }
        }
        const plugins = registry.list().map((p) => {
          const status = registry.getStatus(p.id)
          return {
            id: p.id,
            version: p.version,
            description: p.description,
            priority: p.priority,
            status: status?.status,
            error: status?.error,
          }
        })
        const health = registry.hooks.health()
        return { success: true, data: { plugins, health } }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 启用/停用插件（立即生效：停用后插件的决策链路钩子不再参与 emit）
    ipcMain.handle('set-plugin-enabled', async (event, payload: { id: string; enabled: boolean }) => {
      try {
        const registry = this.pluginRegistry
        if (!registry) return { success: false, error: '插件系统未初始化' }
        const id = payload?.id
        if (!id) return { success: false, error: '缺少插件 id' }
        const ok = payload?.enabled ? registry.enable(id) : registry.disable(id)
        if (!ok) return { success: false, error: `插件不存在: ${id}` }
        return { success: true, data: { id, enabled: !!payload?.enabled } }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 插件性能统计（注册表运维 + HooksHost 钩子执行 + 单飞去重 + 自洽性校验）
    ipcMain.handle('get-plugin-stats', async () => {
      const start = Date.now()
      try {
        const registry = this.pluginRegistry
        if (!registry) {
          this.governanceLogger?.debug('[IPC:get-plugin-stats] 插件系统未初始化，返回空统计', {
            module: 'IPCHandlers', function: 'registerPluginHandlers',
          })
          return { success: true, data: { registry: null, hooks: null, runOnce: null, check: null } }
        }
        const hooks = registry.hooks.stats() // stats() 内部已自动跑 statsCheck 校验并记日志
        // 校验结果附带上报（实时上报带上自洽性状态，前端可直接展示）
        const check = checkHookHostStats(hooks, { maxHooksPerPoint: registry.hooks.maxHooksPerPoint() })
        const registryStats = registry.stats()
        const runOnce = getRunOnceStats()
        const elapsedMs = Date.now() - start
        // 埋点 debug：上报完整明细（线上排查数据异常：对比 emit/执行/校验 三路数据）
        this.governanceLogger?.debug('[IPC:get-plugin-stats] 上报成功（明细）', {
          module: 'IPCHandlers', function: 'registerPluginHandlers',
        }, {
          elapsedMs,
          emitTotal: hooks.emitTotal,
          emitByPoint: hooks.emitByPoint,
          hookExecTotal: hooks.hookExecTotal,
          hookExecAvgMs: hooks.hookExecAvgMs,
          hookExecMaxMs: hooks.hookExecMaxMs,
          timeoutCount: hooks.timeoutCount,
          trippedCount: hooks.trippedCount,
          skippedCount: hooks.skippedCount,
          shortCircuitCount: hooks.shortCircuitCount,
          checkOk: check.ok,
          checkErrors: check.errors.length,
          checkWarnings: check.warnings.length,
        })
        // 埋点 debug：每次上报的性能基线（供线上观测上报频率与数据走势）
        this.governanceLogger?.debug('[IPC:get-plugin-stats] 插件性能统计上报', {
          module: 'IPCHandlers', function: 'registerPluginHandlers',
        }, {
          elapsedMs,
          emitTotal: hooks.emitTotal,
          hookExecTotal: hooks.hookExecTotal,
          install: registryStats.installCount,
          uninstall: registryStats.uninstallCount,
          runOnceFirst: runOnce.firstHit,
          runOnceReuse: runOnce.reuseHit,
          checkOk: check.ok,
        })
        // 埋点 error/warn：上报环节的自洽性状态（与 stats() 内部校验日志互相印证）
        if (!check.ok) {
          this.governanceLogger?.error('[IPC:get-plugin-stats] 性能统计自洽性校验失败', {
            module: 'IPCHandlers', function: 'registerPluginHandlers',
          }, { errors: check.errors })
        } else if (check.warnings.length > 0) {
          this.governanceLogger?.warn('[IPC:get-plugin-stats] 性能统计自洽性提示', {
            module: 'IPCHandlers', function: 'registerPluginHandlers',
          }, { warnings: check.warnings })
        }
        return {
          success: true,
          data: {
            registry: registryStats,
            hooks,
            runOnce,
            check: { ok: check.ok, errors: check.errors, warnings: check.warnings },
          },
        }
      } catch (error: any) {
        this.governanceLogger?.error('[IPC:get-plugin-stats] 上报异常', {
          module: 'IPCHandlers', function: 'registerPluginHandlers',
        }, { error: error.message, elapsedMs: Date.now() - start })
        return { success: false, error: error.message }
      }
    })
  }
}
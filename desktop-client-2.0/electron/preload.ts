import { contextBridge, ipcRenderer } from 'electron'

/**
 * 统一 IPC 调用包装（全局防御预留）：
 *  - 所有 invoke 通道统一走本包装，避免各通道各自实现超时/降级；
 *  - 极端场景下（主进程事件循环被同步重活阻塞）invoke 可能长时间无响应，
 *    超过通道超时后 reject 一个标记 isTimeout 的 Error，
 *    由调用方现有 try/catch 自然降级（展示空态/错误提示）；
 *  - 未来如需对特定通道做特殊降级（如返回 { success:false } 兜底），在此统一扩展即可。
 */
const DEFAULT_IPC_TIMEOUT_MS = 3000

/**
 * 按通道超时配置（ms）。未列出的通道使用默认值。
 * 高频调用通道（文件读写 / 配置同步）显式配置，避免被统一默认值误杀：
 *  - 配置同步：sync-now / upload-data / download-data 走网络请求，耗时可达数十秒；
 *  - 文件/存储读写：操作记录、监控目录、存储路径等涉及磁盘 I/O，留波动余量；
 *  - 配置持久化读写：权限/API 监控/进程监控/同步配置写入本地文件，留余量。
 */
const IPC_TIMEOUTS: Record<string, number> = {
  // 配置同步（网络）
  'sync-now': 20000,
  'upload-data': 30000,
  'download-data': 30000,
  // 文件/存储读写
  'get-operations': 8000,
  'save-operation': 8000,
  'clear-operations': 8000,
  'get-storage-path': 8000,
  'get-file-watch-config': 8000,
  'set-file-watch-paths': 8000,
  'set-file-watch-backend': 8000,
  // 配置持久化读写
  'get-permission-config': 8000,
  'set-permission-config': 8000,
  'get-api-call-config': 8000,
  'set-api-call-config': 8000,
  'get-api-call-status': 8000,
  'get-api-call-records': 8000,
  'get-process-config': 8000,
  'set-process-backend': 8000,
  'get-sync-config': 8000,
  'save-sync-config': 8000,
  'set-sync-token': 8000,
}

function invokeIpc<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  const timeoutMs = IPC_TIMEOUTS[channel] ?? DEFAULT_IPC_TIMEOUT_MS
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      const err = new Error(`IPC 调用超时: ${channel} (>${timeoutMs}ms)`) as Error & { isTimeout?: boolean }
      err.isTimeout = true
      console.warn(`[preload] IPC 调用超时，已降级: ${channel}`)
      reject(err)
    }, timeoutMs)
    ipcRenderer
      .invoke(channel, ...args)
      .then((result) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(result as T)
      })
      .catch((error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(error)
      })
  })
}

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 操作记录
  getOperations: () => invokeIpc('get-operations'),
  saveOperation: (operation: any) => invokeIpc('save-operation', operation),
  clearOperations: () => invokeIpc('clear-operations'),

  // 导出
  exportData: (format: 'json' | 'txt') => invokeIpc('export-data', format),

  // 存储
  getStoragePath: () => invokeIpc('get-storage-path'),

  // 桌宠相关
  getPetState: () => invokeIpc('get-pet-state'),
  onPetStateChange: (callback: (state: 'green' | 'yellow' | 'red' | 'thinking') => void) => {
    ipcRenderer.on('pet-state-change', (event, state) => callback(state))
  },
  // 桌宠气泡播报（P1 治理播报通道）
  onPetBubble: (callback: (text: string) => void) => {
    ipcRenderer.on('pet-bubble', (event, text) => callback(text))
  },
  // 桌宠角色信息（P2 程序化角色）
  onPetCharacter: (callback: (character: any) => void) => {
    ipcRenderer.on('pet-character', (event, character) => callback(character))
  },
  // 桌宠角色+治理画像（设置页「治理桌宠」面板拉取）
  getPetStats: () => invokeIpc('get-pet-stats'),
  startMonitoring: () => invokeIpc('start-monitoring'),
  stopMonitoring: () => invokeIpc('stop-monitoring'),
  confirmRisk: (action: 'allow' | 'deny') => invokeIpc('confirm-risk', action),

  // 治理健康度
  getHealthMetrics: () => invokeIpc('get-health-metrics'),
  getHealthHistory: (limit?: number) => invokeIpc('get-health-history', limit),
  getHealthReport: () => invokeIpc('get-health-report'),

  // 文件系统监控（第一优先级）
  getFileWatchConfig: () => invokeIpc('get-file-watch-config'),
  setFileWatchPaths: (paths: string[]) => invokeIpc('set-file-watch-paths', paths),
  setFileWatchBackend: (config: { enabled: boolean; baseUrl: string }) => invokeIpc('set-file-watch-backend', config),

  // API 调用监控（第二优先级）
  getApiCallConfig: () => invokeIpc('get-api-call-config'),
  setApiCallConfig: (patch: { enabled?: boolean; port?: number; alertOnSensitive?: boolean }) => invokeIpc('set-api-call-config', patch),
  getApiCallStatus: () => invokeIpc('get-api-call-status'),
  getApiCallRecords: () => invokeIpc('get-api-call-records'),

  // 进程行为监控（第三优先级）
  getProcessConfig: () => invokeIpc('get-process-config'),
  setProcessBackend: (config: { enabled: boolean; baseUrl: string; token?: string }) => invokeIpc('set-process-backend', config),

  // 治理日志级别（trace 决策路径埋点开关）
  getGovernanceLogLevel: () => invokeIpc('get-governance-log-level'),
  setGovernanceLogLevel: (level: string) => invokeIpc('set-governance-log-level', level),

  // 同步相关
  getSyncConfig: () => invokeIpc('get-sync-config'),
  saveSyncConfig: (config: any) => invokeIpc('save-sync-config', config),
  syncNow: () => invokeIpc('sync-now'),
  uploadData: () => invokeIpc('upload-data'),
  downloadData: () => invokeIpc('download-data'),
  clearSyncData: () => invokeIpc('clear-sync-data'),
  setSyncToken: (token: string) => invokeIpc('set-sync-token', token),

  // 登录态主进程备份（抗强杀防丢失）
  saveAuthState: (state: any) => invokeIpc('save-auth-state', state),
  getAuthState: () => invokeIpc('get-auth-state'),

  // P1 账号互通：外部浏览器打开官网（url 为完整 http/https 链接）
  openInBrowser: (url: string) => invokeIpc('open-in-browser', url),

  // 事件监听
  onStartRecord: (callback: () => void) => {
    ipcRenderer.on('start-record', callback)
  },

  // 操作权限配置
  getPermissionConfig: () => invokeIpc('get-permission-config'),
  setPermissionConfig: (patch: Record<string, boolean>) => invokeIpc('set-permission-config', patch),
  completeOnboarding: () => invokeIpc('complete-onboarding'),

  // 插件管理（Skill 插件生态）
  getPlugins: () => invokeIpc('get-plugins'),
  setPluginEnabled: (payload: { id: string; enabled: boolean }) => invokeIpc('set-plugin-enabled', payload),
  getPluginStats: () => invokeIpc('get-plugin-stats'),

  // M3 插件源打通：市场浏览 / 目录扫描 / 安装 / 卸载
  listMarketPlugins: () => invokeIpc('plugins:list-market'),
  scanInstalledPlugins: () => invokeIpc('plugins:scan-installed'),
  installMarketPlugin: (pkgId: string) => invokeIpc('plugins:install', pkgId),
  uninstallPlugin: (pkgId: string) => invokeIpc('plugins:uninstall', pkgId),

  // 本地账号认证（首次设置引导）
  getLocalAuthStatus: () => invokeIpc('get-local-auth-status'),
  registerLocalAuth: (credentials: { username: string; password: string }) => invokeIpc('register-local-auth', credentials),
  loginLocalAuth: (credentials: { username: string; password: string }) => invokeIpc('login-local-auth', credentials),
  completeLocalSetup: () => invokeIpc('complete-local-setup'),

  // P0 统一控制面（M1 MVP）：模块状态 / 日志级别 / 预算额度
  getModuleStatus: () => invokeIpc('modules:get-status'),
  getModuleLogLevel: () => invokeIpc('modules:get-log-level'),
  setModuleLogLevel: (req: { level: string; moduleId?: string }) => invokeIpc('modules:set-log-level', req),
  getDeepSeekQuota: () => invokeIpc('modules:get-deepseek-quota'),

  // 自动更新（生产环境生效；开发环境返回降级态）
  checkForUpdates: () => invokeIpc('updater:check'),
  isUpdateDownloaded: () => invokeIpc('updater:is-downloaded'),
  quitAndInstallUpdate: () => invokeIpc('updater:quit-and-install'),
  onUpdateEvent: (callback: (type: string, payload?: any) => void) => {
    const channels = ['updater:checking', 'updater:available', 'updater:not-available', 'updater:downloaded', 'updater:progress', 'updater:error']
    const listener = (event: Electron.IpcRendererEvent, ...args: any[]) => callback(event.channel, args[0])
    channels.forEach((ch) => ipcRenderer.on(ch, listener))
    return () => channels.forEach((ch) => ipcRenderer.removeListener(ch, listener))
  },
})
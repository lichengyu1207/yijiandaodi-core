import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 操作记录
  getOperations: () => ipcRenderer.invoke('get-operations'),
  saveOperation: (operation: any) => ipcRenderer.invoke('save-operation', operation),
  clearOperations: () => ipcRenderer.invoke('clear-operations'),

  // 导出
  exportData: (format: 'json' | 'txt') => ipcRenderer.invoke('export-data', format),

  // 存储
  getStoragePath: () => ipcRenderer.invoke('get-storage-path'),

  // 桌宠相关
  getPetState: () => ipcRenderer.invoke('get-pet-state'),
  onPetStateChange: (callback: (state: 'green' | 'yellow' | 'red') => void) => {
    ipcRenderer.on('pet-state-change', (event, state) => callback(state))
  },
  startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  confirmRisk: (action: 'allow' | 'deny') => ipcRenderer.invoke('confirm-risk', action),

  // 治理健康度
  getHealthMetrics: () => ipcRenderer.invoke('get-health-metrics'),
  getHealthHistory: (limit?: number) => ipcRenderer.invoke('get-health-history', limit),
  getHealthReport: () => ipcRenderer.invoke('get-health-report'),

  // 文件系统监控（第一优先级）
  getFileWatchConfig: () => ipcRenderer.invoke('get-file-watch-config'),
  setFileWatchPaths: (paths: string[]) => ipcRenderer.invoke('set-file-watch-paths', paths),
  setFileWatchBackend: (config: { enabled: boolean; baseUrl: string }) => ipcRenderer.invoke('set-file-watch-backend', config),

  // API 调用监控（第二优先级）
  getApiCallConfig: () => ipcRenderer.invoke('get-api-call-config'),
  setApiCallConfig: (patch: { enabled?: boolean; port?: number; alertOnSensitive?: boolean }) => ipcRenderer.invoke('set-api-call-config', patch),
  getApiCallStatus: () => ipcRenderer.invoke('get-api-call-status'),
  getApiCallRecords: () => ipcRenderer.invoke('get-api-call-records'),

  // 进程行为监控（第三优先级）
  getProcessConfig: () => ipcRenderer.invoke('get-process-config'),
  setProcessBackend: (config: { enabled: boolean; baseUrl: string; token?: string }) => ipcRenderer.invoke('set-process-backend', config),

  // 治理日志级别（trace 决策路径埋点开关）
  getGovernanceLogLevel: () => ipcRenderer.invoke('get-governance-log-level'),
  setGovernanceLogLevel: (level: string) => ipcRenderer.invoke('set-governance-log-level', level),

  // 同步相关
  getSyncConfig: () => ipcRenderer.invoke('get-sync-config'),
  saveSyncConfig: (config: any) => ipcRenderer.invoke('save-sync-config', config),
  syncNow: () => ipcRenderer.invoke('sync-now'),
  uploadData: () => ipcRenderer.invoke('upload-data'),
  downloadData: () => ipcRenderer.invoke('download-data'),
  clearSyncData: () => ipcRenderer.invoke('clear-sync-data'),
  setSyncToken: (token: string) => ipcRenderer.invoke('set-sync-token', token),

  // 事件监听
  onStartRecord: (callback: () => void) => {
    ipcRenderer.on('start-record', callback)
  },

  // 操作权限配置
  getPermissionConfig: () => ipcRenderer.invoke('get-permission-config'),
  setPermissionConfig: (patch: Record<string, boolean>) => ipcRenderer.invoke('set-permission-config', patch),
  completeOnboarding: () => ipcRenderer.invoke('complete-onboarding'),

  // 插件管理（Skill 插件生态）
  getPlugins: () => ipcRenderer.invoke('get-plugins'),
  setPluginEnabled: (payload: { id: string; enabled: boolean }) => ipcRenderer.invoke('set-plugin-enabled', payload),
  getPluginStats: () => ipcRenderer.invoke('get-plugin-stats'),

  // 本地账号认证（首次设置引导）
  getLocalAuthStatus: () => ipcRenderer.invoke('get-local-auth-status'),
  registerLocalAuth: (credentials: { username: string; password: string }) => ipcRenderer.invoke('register-local-auth', credentials),
  loginLocalAuth: (credentials: { username: string; password: string }) => ipcRenderer.invoke('login-local-auth', credentials),
  completeLocalSetup: () => ipcRenderer.invoke('complete-local-setup'),
})
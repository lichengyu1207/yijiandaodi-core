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

  // 事件监听
  onStartRecord: (callback: () => void) => {
    ipcRenderer.on('start-record', callback)
  },
})
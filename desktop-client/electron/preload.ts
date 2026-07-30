import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getNodeStatus: () => ipcRenderer.invoke('p2p:get-status'),
  registerNode: (serverUrl: string) => ipcRenderer.invoke('p2p:register', serverUrl),
  shutdown: () => ipcRenderer.invoke('p2p:shutdown'),

  getActiveTasks: () => ipcRenderer.invoke('task:get-active'),
  submitResult: (result: unknown) => ipcRenderer.invoke('task:submit-result', result),

  getSystemInfo: () => ipcRenderer.invoke('system:get-info'),

  onNodeEvent: (callback: (data: unknown) => void) =>
    ipcRenderer.on('p2p:event', (_event, data) => callback(data)),
  onTaskDispatched: (callback: (data: unknown) => void) =>
    ipcRenderer.on('task:dispatched', (_event, data) => callback(data)),

  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel),
})

export interface ElectronAPI {
  getNodeStatus: () => Promise<{ success: boolean; data?: { nodeId: string; isConnected: boolean; uptime: number }; error?: string }>;
  registerNode: (serverUrl: string) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;
  shutdown: () => Promise<{ success: boolean; message?: string; error?: string }>;
  getActiveTasks: () => Promise<{ tasks: unknown[] }>;
  submitResult: (result: unknown) => Promise<{ success: boolean; message?: string }>;
  getSystemInfo: () => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;
  onNodeEvent: (callback: (data: unknown) => void) => () => void;
  onTaskDispatched: (callback: (data: unknown) => void) => () => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export interface ElectronAPI {
  getOperations: () => Promise<Operation[]>
  saveOperation: (operation: Operation) => Promise<void>
  clearOperations: () => Promise<void>
  exportData: (format: 'json' | 'csv' | 'pdf') => Promise<string>
  getStoragePath: () => Promise<string>
  getLocalDataPath?: () => Promise<string>
  openMainWindow?: () => void

  // 桌宠相关接口
  getPetState: () => Promise<'green' | 'yellow' | 'red' | null>
  onPetStateChange: (callback: (state: 'green' | 'yellow' | 'red') => void) => void
  startMonitoring: () => Promise<void>
  stopMonitoring: () => Promise<void>
  confirmRisk: (action: 'allow' | 'deny') => Promise<void>
}

export interface Operation {
  id: string
  type: 'ai_dialog' | 'file_op' | 'search' | 'other'
  title: string
  content: string
  timestamp: string
  source: string
  status: 'verified' | 'pending' | 'flagged'
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
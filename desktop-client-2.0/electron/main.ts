/**
 * 一鉴到底 - 应用入口（重构版）
 * 职责：服务组装和生命周期管理
 * 行数目标：<100行
 */

import { app, dialog } from 'electron'
import { MainWindow, PetWindow, PetState } from './windows'
import { FileMonitor, ClipboardMonitor, RiskResult, ProcessMonitor, NetworkMonitor } from './monitoring'
import { TrayService, ApiService, StorageService } from './services'
import { IPCHandlers } from './ipc'
import { DIContainer } from './di'
import { initSecurityKnowledgeBase, SecurityKnowledgeBase } from './securityKnowledgeBase'
import axios from 'axios'

// 依赖注入容器
const container = new DIContainer()

// 应用状态
let isQuitting = false

// 单例锁，确保只运行一个实例
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // 有人试图运行第二个实例，聚焦到已有窗口
    const mainWindow = container.resolve<MainWindow>('mainWindow')
    mainWindow.show()
  })
}

/**
 * 显示风险警报
 */
function showRiskAlert(riskData: { risk_level: string; description: string; content?: string }) {
  const mainWindow = container.resolve<MainWindow>('mainWindow')
  const petWindow = container.resolve<PetWindow>('petWindow')

  const result = dialog.showMessageBoxSync(mainWindow.getWindow()!, {
    type: 'warning',
    title: '风险警告',
    message: `发现${riskData.risk_level}风险！`,
    detail: riskData.description || '检测到潜在的安全风险',
    buttons: ['允许', '拒绝', '查看详情'],
    defaultId: 1,
    cancelId: 1
  })

  if (result === 0) {
    console.log('[风险] 用户允许操作')
    updatePetState('green')
  } else if (result === 1) {
    console.log('[风险] 用户拒绝操作')
    updatePetState('green')
  } else if (result === 2) {
    console.log('[风险] 查看详情:', riskData)
    updatePetState('green')
  }
}

/**
 * 更新桌宠状态
 */
function updatePetState(state: PetState, message?: string) {
  const mainWindow = container.resolve<MainWindow>('mainWindow')
  const petWindow = container.resolve<PetWindow>('petWindow')
  const trayService = container.resolve<TrayService>('trayService')

  petWindow.setState(state)
  console.log(`[小鉴] 状态更新: ${state}${message ? ` - ${message}` : ''}`)

  // 通知主窗口渲染进程
  mainWindow.send('pet-state-change', state)

  // 通知小鉴桌宠窗口
  petWindow.send('pet-state-change', state)

  // 更新托盘图标
  trayService.updateIcon(state)
}

/**
 * 同步状态到ESP32
 */
async function syncToESP32(state: PetState) {
  try {
    await axios.get(`http://192.168.1.100:80/status`, {
      params: { state },
      timeout: 2000
    })
    console.log(`[ESP32] 状态同步: ${state}`)
  } catch (error: any) {
    console.error('[ESP32] 同步失败:', error.message)
  }
}

/**
 * 初始化所有服务
 */
function initializeServices() {
  console.log('[系统] 初始化安全知识库...')
  const securityKB = initSecurityKnowledgeBase()
  container.register('securityKB', securityKB)

  // 创建窗口管理
  const mainWindow = new MainWindow()
  const petWindow = new PetWindow()
  container.register('mainWindow', mainWindow)
  container.register('petWindow', petWindow)

  // 创建监控服务
  const fileMonitor = new FileMonitor()
  const clipboardMonitor = new ClipboardMonitor()
  fileMonitor.setSecurityKnowledgeBase(securityKB)
  clipboardMonitor.setSecurityKnowledgeBase(securityKB)
  container.register('fileMonitor', fileMonitor)
  container.register('clipboardMonitor', clipboardMonitor)

  // 创建业务服务
  const storageService = new StorageService()
  const trayService = new TrayService()
  const apiService = new ApiService()
  container.register('storageService', storageService)
  container.register('trayService', trayService)
  container.register('apiService', apiService)

  // 设置监控回调
  const riskDetectedCallback = (risks: RiskResult[], source: string) => {
    const highRisks = risks.filter(r => r.risk === 'high')
    const riskDescriptions = risks.slice(0, 10).map(r => {
      switch (r.type) {
        case 'sqli': return `SQL注入: ${r.matched}`
        case 'xss': return `XSS攻击: ${r.matched}`
        case 'apikey': return `API Key: ${r.matched}`
        case 'password': return `常见密码: ${r.matched}`
        case 'sensitive': return `敏感信息: ${r.matched}`
        default: return `未知类型: ${r.matched}`
      }
    })

    showRiskAlert({
      risk_level: highRisks.length > 0 ? 'high' : 'medium',
      description: `${source}中发现${risks.length}个安全风险:\n${riskDescriptions.join('\n')}`
    })
  }

  fileMonitor.setRiskDetectedCallback((risks, filePath) => riskDetectedCallback(risks, `文件 ${filePath}`))
  clipboardMonitor.setRiskDetectedCallback((risks) => riskDetectedCallback(risks, '剪贴板'))

  fileMonitor.setPetStateChangeCallback(updatePetState)
  clipboardMonitor.setPetStateChangeCallback(updatePetState)

  fileMonitor.setSaveRecordCallback((record) => storageService.saveOperation(record))
  clipboardMonitor.setSaveRecordCallback((record) => storageService.saveOperation(record))

  // 新增：进程监控
  const processMonitor = new ProcessMonitor()
  processMonitor.setAIAgentDetectedCallback((process) => {
    console.log('[AI Agent] 检测到:', process.name)
    updatePetState('yellow', `检测到 ${process.name}`)
  })
  container.register('processMonitor', processMonitor)

  // 新增：网络监控
  const networkMonitor = new NetworkMonitor()
  networkMonitor.setAIAPIRequestDetectedCallback((request) => {
    console.log('[AI API] 调用:', request.domain)
    updatePetState('yellow', `API 调用: ${request.domain}`)
  })
  container.register('networkMonitor', networkMonitor)

  // 设置托盘回调
  trayService.setShowMainWindowCallback(() => mainWindow.show())
  trayService.setQuitCallback(() => {
    isQuitting = true
    cleanup()
    app.quit()
  })

  // 注册IPC处理器
  const ipcHandlers = new IPCHandlers(
    storageService,
    fileMonitor,
    clipboardMonitor,
    () => petWindow.getState()
  )
  ipcHandlers.registerAll()
}

/**
 * 启动应用
 */
function startApplication() {
  const mainWindow = container.resolve<MainWindow>('mainWindow')
  const petWindow = container.resolve<PetWindow>('petWindow')
  const trayService = container.resolve<TrayService>('trayService')
  const apiService = container.resolve<ApiService>('apiService')
  const fileMonitor = container.resolve<FileMonitor>('fileMonitor')
  const clipboardMonitor = container.resolve<ClipboardMonitor>('clipboardMonitor')
  const processMonitor = container.resolve<ProcessMonitor>('processMonitor')
  const networkMonitor = container.resolve<NetworkMonitor>('networkMonitor')

  // 启动后台服务
  apiService.start()

  // 创建主窗口和托盘
  mainWindow.create()
  trayService.create()

  // 创建桌宠窗口
  try {
    petWindow.create()
    console.log('[系统] ✅ 桌宠窗口创建成功')
  } catch (error) {
    console.error('[系统] ❌ 桌宠窗口创建失败:', error)
  }

  // 启动监控
  fileMonitor.start()
  clipboardMonitor.start()
  processMonitor.start()
  networkMonitor.start()

  console.log('[一鉴到底] 所有监控服务已启动')
  console.log('一鉴到底已启动')
  console.log('关闭窗口后应用会继续在后台运行')
}

/**
 * 清理资源
 */
function cleanup() {
  const apiService = container.resolve<ApiService>('apiService')
  const fileMonitor = container.resolve<FileMonitor>('fileMonitor')
  const clipboardMonitor = container.resolve<ClipboardMonitor>('clipboardMonitor')
  const processMonitor = container.resolve<ProcessMonitor>('processMonitor')
  const networkMonitor = container.resolve<NetworkMonitor>('networkMonitor')

  apiService.stop()
  fileMonitor.stop()
  clipboardMonitor.stop()
  processMonitor.stop()
  networkMonitor.stop()
}

// 应用生命周期
app.whenReady().then(() => {
  initializeServices()
  startApplication()
})

app.on('window-all-closed', (event) => {
  event.preventDefault()
})

app.on('activate', () => {
  const mainWindow = container.resolve<MainWindow>('mainWindow')
  if (!mainWindow.getWindow()) {
    mainWindow.create()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  const mainWindow = container.resolve<MainWindow>('mainWindow')
  mainWindow.setQuitting(true)
})

app.on('will-quit', () => {
  cleanup()
})

app.on('quit', () => {
  cleanup()
})
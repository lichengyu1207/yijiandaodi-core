/**
 * 一鉴到底 - 应用入口（重构版）
 * 职责：服务组装和生命周期管理
 * 行数目标：<100行
 */

import { app, Notification } from 'electron'
import { MainWindow, PetWindow, PetState } from './windows'
import { FileMonitor, ClipboardMonitor, RiskResult, ProcessMonitor, NetworkMonitor } from './monitoring'
import { SmartAlerter, smartAlerter } from './monitoring/smartAlerter'
import { TrayService, ApiService, StorageService, syncService } from './services'
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
 * 显示风险提示（优化版 - 不弹窗）
 */
function showRiskAlert(riskData: { risk_level: string; description: string; content?: string }) {
  const mainWindow = container.resolve<MainWindow>('mainWindow')
  const petWindow = container.resolve<PetWindow>('petWindow')

  // 使用智能提示器判断是否需要通知
  const alertResult = smartAlerter.handleAlert({
    riskLevel: riskData.risk_level as any,
    riskType: 'security_risk',
    message: riskData.description
  })

  console.log('[风险] 检测结果:', alertResult)

  // 发送系统通知（仅高风险）
  if (alertResult.shouldNotify) {
    const notification = new Notification({
      title: '⚠️ 安全警告',
      body: `发现${riskData.risk_level}风险: ${riskData.description.slice(0, 50)}...`,
      silent: false
    })
    notification.show()

    console.log('[风险] 已发送系统通知')
  }

  // 更新桌宠状态（所有风险都更新）
  if (alertResult.shouldUpdatePet) {
    updatePetState(riskData.risk_level === 'critical' || riskData.risk_level === 'high' ? 'red' : 'yellow', riskData.description)
  }

  // 通知主窗口和桌宠窗口
  mainWindow.send('risk-detected', riskData)
  petWindow.send('risk-detected', riskData)
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

    // 使用新的智能提示方式（不弹窗）
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

  // 启动同步服务
  try {
    const config = syncService.getConfig()
    if (config.enabled && config.autoSync) {
      syncService.startAutoSync()
      console.log('[系统] ✅ 同步服务已启动')
    } else {
      console.log('[系统] ℹ️ 同步服务未启用')
    }
  } catch (error) {
    console.error('[系统] ❌ 同步服务启动失败:', error)
  }

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

  // 停止同步服务
  try {
    syncService.stopAutoSync()
    console.log('[系统] ✅ 同步服务已停止')
  } catch (error) {
    console.error('[系统] ❌ 同步服务停止失败:', error)
  }
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
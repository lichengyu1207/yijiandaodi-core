/**
 * 一鉴到底 - 应用入口（重构版）
 * 职责：服务组装和生命周期管理
 * 行数目标：<100行
 */

import { app, Notification } from 'electron'
import { MainWindow, PetWindow, PetState } from './windows'
import { FileMonitor, ClipboardMonitor, RiskResult, ProcessMonitor, NetworkMonitor } from './monitoring'
import { SmartAlerter, smartAlerter } from './monitoring/smartAlerter'
import { AgentBehaviorParser } from './monitoring/agentBehaviorParser'
import { BehaviorRiskScorer } from './monitoring/behaviorRiskScorer'
import { proactiveAlerter } from './monitoring/proactiveAlerter'
import { TrayService, ApiService, StorageService, syncService, logger } from './services'
import { GovernanceHealthMonitor } from './services/governanceHealthMonitor'
import { IPCHandlers } from './ipc'
import { DIContainer } from './di'
import { initSecurityKnowledgeBase, SecurityKnowledgeBase } from './securityKnowledgeBase'
import { MemoryMonitorService } from './services/memoryMonitor'
import { CPUMonitor } from './services/cpuMonitor'
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

  logger.info('[风险] 检测结果:', { module: 'RiskAlert' }, alertResult)

  // 发送系统通知（仅高风险）
  if (alertResult.shouldNotify) {
    const notification = new Notification({
      title: '⚠️ 安全警告',
      body: `发现${riskData.risk_level}风险: ${riskData.description.slice(0, 50)}...`,
      silent: false
    })
    notification.show()

    logger.info('[风险] 已发送系统通知', { module: 'RiskAlert' })
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
  logger.info(`[小鉴] 状态更新: ${state}${message ? ` - ${message}` : ''}`, { module: 'PetWindow' })

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
    logger.info(`[ESP32] 状态同步: ${state}`, { module: 'ESP32' })
  } catch (error: any) {
    logger.error('[ESP32] 同步失败:', { module: 'ESP32' }, { error: error.message })
  }
}

/**
 * 初始化所有服务
 */
function initializeServices() {
  logger.info('[系统] 初始化安全知识库...', { module: 'System' })
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

  // 新增：创建性能监控服务（Sprint 2）
  const memoryMonitor = new MemoryMonitorService({
    checkInterval: 10000,
    alertThresholds: {
      heapUsed: 500 * 1024 * 1024,  // 500MB
      heapTotal: 1024 * 1024 * 1024, // 1GB
      external: 200 * 1024 * 1024     // 200MB
    }
  })
  const cpuMonitor = new CPUMonitor({
    checkInterval: 5000,
    historyLength: 60
  })
  container.register('memoryMonitor', memoryMonitor)
  container.register('cpuMonitor', cpuMonitor)

  // 新增：创建治理健康度监控器（MVP）
  const healthMonitor = new GovernanceHealthMonitor(memoryMonitor, cpuMonitor)
  container.register('healthMonitor', healthMonitor)

  // 新增：创建行为风险评分器（MVP）
  const behaviorRiskScorer = new BehaviorRiskScorer()
  container.register('behaviorRiskScorer', behaviorRiskScorer)

  // 设置监控回调（集成主动监控）
  const riskDetectedCallback = (risks: RiskResult[], source: string, detectionResult?: any) => {
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

    // 新增：使用 Agent 行为解析器和风险评分器（主动监控）
    if (detectionResult) {
      try {
        // 解析为 Agent 行为日志
        const behavior = source.includes('文件') 
          ? AgentBehaviorParser.parseFileEvent(
              source.replace('文件 ', ''),
              detectionResult.content || '',
              detectionResult
            )
          : AgentBehaviorParser.parseClipboardEvent(
              detectionResult.content || '',
              detectionResult
            )

        // 评估风险
        const assessment = behaviorRiskScorer.assessBehavior(behavior)

        // 主动告警
        proactiveAlerter.handleAssessment(behavior, assessment)

        logger.info('[主动监控] 行为评估完成', { module: 'ProactiveMonitor' }, {
          riskScore: assessment.overallScore,
          riskLevel: assessment.riskLevel,
          shouldAlert: assessment.shouldAlert
        })
      } catch (error) {
        logger.error('[主动监控] 行为评估失败', { module: 'ProactiveMonitor' }, { error })
      }
    }

    // 原有逻辑：使用新的智能提示方式（不弹窗）
    showRiskAlert({
      risk_level: highRisks.length > 0 ? 'high' : 'medium',
      description: `${source}中发现${risks.length}个安全风险:\n${riskDescriptions.join('\n')}`
    })
  }

  fileMonitor.setRiskDetectedCallback((risks, filePath, result) => riskDetectedCallback(risks, `文件 ${filePath}`, result))
  clipboardMonitor.setRiskDetectedCallback((risks, result) => riskDetectedCallback(risks, '剪贴板', result))

  fileMonitor.setPetStateChangeCallback(updatePetState)
  clipboardMonitor.setPetStateChangeCallback(updatePetState)

  fileMonitor.setSaveRecordCallback((record) => storageService.saveOperation(record))
  clipboardMonitor.setSaveRecordCallback((record) => storageService.saveOperation(record))

  // 新增：进程监控
  const processMonitor = new ProcessMonitor()
  processMonitor.setAIAgentDetectedCallback((process) => {
    logger.info('[AI Agent] 检测到:', { module: 'ProcessMonitor' }, { processName: process.name })
    updatePetState('yellow', `检测到 ${process.name}`)

    // 新增：解析进程行为
    try {
      const behavior = AgentBehaviorParser.parseProcessEvent(process.name, process.pid, true)
      const assessment = behaviorRiskScorer.assessBehavior(behavior)
      proactiveAlerter.handleAssessment(behavior, assessment)
    } catch (error) {
      logger.error('[主动监控] 进程行为评估失败', { module: 'ProactiveMonitor' }, { error })
    }
  })
  container.register('processMonitor', processMonitor)

  // 新增：网络监控
  const networkMonitor = new NetworkMonitor()
  networkMonitor.setAIAPIRequestDetectedCallback((request) => {
    logger.info('[AI API] 调用:', { module: 'NetworkMonitor' }, { domain: request.domain })
    updatePetState('yellow', `API 调用: ${request.domain}`)

    // 新增：解析网络行为
    try {
      const behavior = AgentBehaviorParser.parseNetworkEvent(
        request.domain,
        request.port || 443,
        request.isAIProvider || false
      )
      const assessment = behaviorRiskScorer.assessBehavior(behavior)
      proactiveAlerter.handleAssessment(behavior, assessment)
    } catch (error) {
      logger.error('[主动监控] 网络行为评估失败', { module: 'ProactiveMonitor' }, { error })
    }
  })
  container.register('networkMonitor', networkMonitor)

  // 设置托盘回调
  trayService.setShowMainWindowCallback(() => mainWindow.show())
  trayService.setQuitCallback(() => {
    isQuitting = true
    cleanup()
    app.quit()
  })

  // 注册IPC处理器（新增 healthMonitor 参数）
  const ipcHandlers = new IPCHandlers(
    storageService,
    fileMonitor,
    clipboardMonitor,
    () => petWindow.getState(),
    healthMonitor
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
  const memoryMonitor = container.resolve<MemoryMonitorService>('memoryMonitor')
  const cpuMonitor = container.resolve<CPUMonitor>('cpuMonitor')

  // 启动后台服务
  apiService.start()

  // 新增：启动性能监控（Sprint 2）
  memoryMonitor.start()
  cpuMonitor.start()
  logger.info('[系统] ✅ 性能监控已启动', { module: 'PerformanceMonitor' })

  // 启动同步服务
  try {
    const config = syncService.getConfig()
    if (config.enabled && config.autoSync) {
      syncService.startAutoSync()
      logger.info('[系统] ✅ 同步服务已启动', { module: 'SyncService' })
    } else {
      logger.info('[系统] ℹ️ 同步服务未启用', { module: 'SyncService' })
    }
  } catch (error) {
    logger.error('[系统] ❌ 同步服务启动失败:', { module: 'SyncService' }, { error })
  }

  // 创建主窗口和托盘
  mainWindow.create()
  trayService.create()

  // 创建桌宠窗口
  try {
    petWindow.create()
    logger.info('[系统] ✅ 桌宠窗口创建成功', { module: 'PetWindow' })
  } catch (error) {
    logger.error('[系统] ❌ 桌宠窗口创建失败:', { module: 'PetWindow' }, { error })
  }

  // 启动监控
  fileMonitor.start()
  clipboardMonitor.start()
  processMonitor.start()
  networkMonitor.start()

  logger.info('[一鉴到底] 所有监控服务已启动', { module: 'System' })
  logger.info('[一鉴到底] 主动监控和健康度监控已启用（MVP）', { module: 'System' })
  logger.info('一鉴到底已启动', { module: 'System' })
  logger.info('关闭窗口后应用会继续在后台运行', { module: 'System' })
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
  const memoryMonitor = container.resolve<MemoryMonitorService>('memoryMonitor')
  const cpuMonitor = container.resolve<CPUMonitor>('cpuMonitor')

  apiService.stop()
  fileMonitor.stop()
  clipboardMonitor.stop()
  processMonitor.stop()
  networkMonitor.stop()

  // 新增：停止性能监控
  memoryMonitor.stop()
  cpuMonitor.stop()
  logger.info('[系统] ✅ 性能监控已停止', { module: 'PerformanceMonitor' })

  // 停止同步服务
  try {
    syncService.stopAutoSync()
    logger.info('[系统] ✅ 同步服务已停止', { module: 'SyncService' })
  } catch (error) {
    logger.error('[系统] ❌ 同步服务停止失败:', { module: 'SyncService' }, { error })
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
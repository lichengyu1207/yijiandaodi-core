/**
 * 一鉴到底 - 应用入口（重构版）
 * 职责：服务组装和生命周期管理
 * 行数目标：<100行
 */

import { app, Notification, dialog, BrowserWindow } from 'electron'
import { MainWindow, PetWindow, PetState } from './windows'
import type { PetCharacterInfo } from './windows'
import { FileMonitor, ClipboardMonitor, RiskResult, ProcessMonitor, ProcessInfo, NetworkMonitor, NetworkRequest, HighRiskConfirmation, ApiCallMonitor, ApiCallInfo } from './monitoring'
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
import { activateTaintTracking } from './monitoring/activateTaintTracking'
import {
  createAgentEventBus,
  createGovernanceLogger,
  loadGovernanceLogLevel,
  AGENT_EVENT_BUS_PRODUCTION_CONFIG,
  GOVERNANCE_LOGGER_PRODUCTION_CONFIG,
  MonitorEventAdapter,
} from './events'
import type { ToolCallResultData } from './events'
import axios from 'axios'
import path from 'path'
import * as fs from 'fs'
import {
  ToolRegistry,
  ToolBridge,
  RulePlanner,
  GovernanceEngine,
  PluginRegistry,
  createRiskSummaryPlugin,
  createPetPlugin,
  createFileTools,
  createVerifyTools,
  createEvidenceTools,
  setEvidenceConfig,
  createReportTools,
  createRiskTools,
  setRiskConfig,
  createBackendTools,
  setBackendClientConfig,
} from './agent'
import { getCompanion, emptyProfile, RARITY_STARS } from './agent/pet/companion'
import { analyzeLogs, renderReport, setPerfAnalyzerLogger } from './agent/perfLogAnalyzer'
import {
  PermissionConfig,
} from './permissions/permissionConfig'
import { createPermissionGating } from './permissions/permissionGating'

// 依赖注入容器
const container = new DIContainer()

// 应用状态
let isQuitting = false

// 操作权限门控：内部持有配置（首次启动引导授权 + 设置页可改；app ready 后加载）
const permissionGating = createPermissionGating({
  getUserDataPath: () => app.getPath('userData'),
  isAutoStartEnabled: () => app.getLoginItemSettings().openAtLogin,
  setAutoStartEnabled: (enabled) => app.setLoginItemSettings({ openAtLogin: enabled }),
  getMonitor: (key) => {
    switch (key) {
      case 'file':
        return { label: '文件系统监控', start: () => container.resolve<FileMonitor>('fileMonitor').start(), stop: () => container.resolve<FileMonitor>('fileMonitor').stop() }
      case 'clipboard':
        return { label: '剪贴板监控', start: () => container.resolve<ClipboardMonitor>('clipboardMonitor').start(), stop: () => container.resolve<ClipboardMonitor>('clipboardMonitor').stop() }
      case 'process':
        return { label: '进程监控', start: () => container.resolve<ProcessMonitor>('processMonitor').start(), stop: () => container.resolve<ProcessMonitor>('processMonitor').stop() }
      case 'network':
        return { label: '网络请求监控', start: () => container.resolve<NetworkMonitor>('networkMonitor').start(), stop: () => container.resolve<NetworkMonitor>('networkMonitor').stop() }
      case 'apiCall':
        return { label: 'API 调用监控', start: () => container.resolve<ApiCallMonitor>('apiCallMonitor').start(), stop: () => container.resolve<ApiCallMonitor>('apiCallMonitor').stop() }
      case 'resource':
        return {
          label: '资源监控（内存/CPU）',
          start: () => {
            container.resolve<MemoryMonitorService>('memoryMonitor').start()
            container.resolve<CPUMonitor>('cpuMonitor').start()
          },
          stop: () => {
            container.resolve<MemoryMonitorService>('memoryMonitor').stop()
            container.resolve<CPUMonitor>('cpuMonitor').stop()
          },
        }
      default:
        throw new Error(`未知监控 key: ${key}`)
    }
  },
  isApiCallMonitorEnabled: () => container.resolve<ApiCallMonitor>('apiCallMonitor').getConfig().enabled,
  logger,
})

/** 便捷引用：门控当前权限配置 */
function getPermissionConfig(): PermissionConfig {
  return permissionGating.getConfig()
}

/** verify.flow 性能分析订阅退订函数（cleanup 时解除） */
let perfAnalyzerUnsub: (() => void) | undefined

/** Skill 插件安装退订函数（cleanup 时解除订阅 + 卸载插件） */
let pluginRegistryUnsub: (() => void) | undefined

/** 桌宠角色：治理画像统计订阅退订函数（cleanup 时解除） */
let petProfileUnsub: (() => void) | undefined

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
  // ===== 详细日志开始 =====
  logger.info('[风险提示] 触发', { module: 'RiskAlert' }, {
    riskLevel: riskData.risk_level,
    descriptionLength: riskData.description.length,
    hasContent: !!riskData.content
  })

  const mainWindow = container.resolve<MainWindow>('mainWindow')
  const petWindow = container.resolve<PetWindow>('petWindow')

  // 使用智能提示器判断是否需要通知
  const alertResult = smartAlerter.handleAlert({
    riskLevel: riskData.risk_level as any,
    riskType: 'security_risk',
    message: riskData.description
  })

  logger.info('[风险提示] 智能提示器结果', { module: 'RiskAlert' }, {
    shouldNotify: alertResult.shouldNotify,
    shouldUpdatePet: alertResult.shouldUpdatePet,
    riskLevel: riskData.risk_level
  })

  // 发送系统通知（仅高风险；受"系统通知"权限门控）
  if (alertResult.shouldNotify) {
    notify('⚠️ 安全警告', `发现${riskData.risk_level}风险: ${riskData.description.slice(0, 50)}...`)
    logger.info('[风险提示] 系统通知已发送', { module: 'RiskAlert' }, {
      title: '⚠️ 安全警告',
      riskLevel: riskData.risk_level
    })
  }

  // 更新桌宠状态（所有风险都更新）
  if (alertResult.shouldUpdatePet) {
    const newState = riskData.risk_level === 'critical' || riskData.risk_level === 'high' ? 'red' : 'yellow'
    logger.info('[风险提示] 更新桌宠状态', { module: 'RiskAlert' }, {
      newState,
      riskLevel: riskData.risk_level
    })
    updatePetState(newState, riskData.description)
  }

  // 通知主窗口和桌宠窗口
  try {
    mainWindow.send('risk-detected', riskData)
    petWindow.send('risk-detected', riskData)
    logger.info('[风险提示] 已通知渲染进程', { module: 'RiskAlert' })
  } catch (error) {
    logger.error('[风险提示] 通知渲染进程失败', { module: 'RiskAlert' }, {
      error: error instanceof Error ? error.message : error
    })
  }
}

/**
 * 高风险文件操作二次确认弹窗
 * @returns true=允许 false=拒绝
 */
async function showRiskConfirmDialog(info: HighRiskConfirmation): Promise<boolean> {
  try {
    const mainWindow = container.resolve<MainWindow>('mainWindow').getWindow()
    const parent = mainWindow || undefined

    const kindText = info.fileKind === 'executable' ? '可执行文件' : info.fileKind === 'code' ? '代码文件' : '文件'
    const action = info.operationType === 'add' ? '创建' : info.operationType === 'unlink' ? '删除' : info.operationType === 'rename' ? '重命名' : '修改'

    const result = await dialog.showMessageBox(parent!, {
      type: 'warning',
      title: '高风险文件操作确认',
      message: `检测到${kindText}${action}：${info.fileName}`,
      detail: [
        info.message,
        '',
        `风险等级: ${info.riskLevel}`,
        info.hashChanged ? '⚠️ 文件内容与上次记录不一致，可能被篡改' : '',
        info.riskTags.length ? `风险标签: ${info.riskTags.slice(0, 8).join(', ')}` : '',
        '',
        '请确认是否允许此操作？',
      ].filter(Boolean).join('\n'),
      buttons: ['拒绝', '允许'],
      defaultId: 0,
      cancelId: 0,
    })

    const allowed = result.response === 1
    logger.info('[二次确认] 用户选择', { module: 'RiskConfirm' }, { allowed, file: info.fileName })
    return allowed
  } catch (error) {
    logger.error('[二次确认] 弹窗失败', { module: 'RiskConfirm' }, { error })
    // 弹窗失败时保守拒绝
    return false
  }
}

/**
 * 系统通知（受"系统通知"权限门控：未授权则不发送）
 */
function notify(title: string, body: string) {
  if (!getPermissionConfig().granted.notifications) return
  try {
    new Notification({ title, body }).show()
  } catch {
    // 通知失败忽略
  }
}

/**
 * 按操作权限门控各监控与系统集成的启停（幂等：启动时与权限变更时调用）
 */
function applyPermissionGating() {
  permissionGating.apply()
}

/**
 * 权限配置变更后的门控回调：重新加载配置到内存并应用门控
 */
function reloadPermissionAndApplyGating() {
  permissionGating.reloadAndApply()
}

/**
 * 更新桌宠状态
 */
function updatePetState(state: PetState, message?: string) {
  // ===== 详细日志开始 =====
  logger.info('[桌宠状态] 更新', { module: 'PetWindow' }, {
    newState: state,
    message: message?.substring(0, 100)
  })

  const mainWindow = container.resolve<MainWindow>('mainWindow')
  const petWindow = container.resolve<PetWindow>('petWindow')
  const trayService = container.resolve<TrayService>('trayService')

  try {
    petWindow.setState(state)
    logger.info('[桌宠状态] 窗口状态已更新', { module: 'PetWindow' }, { state })

    // 通知主窗口渲染进程
    mainWindow.send('pet-state-change', state)
    logger.info('[桌宠状态] 已通知主窗口', { module: 'PetWindow' })

    // 通知小鉴桌宠窗口
    petWindow.send('pet-state-change', state)
    logger.info('[桌宠状态] 已通知桌宠窗口', { module: 'PetWindow' })

    // 更新托盘图标
    trayService.updateIcon(state)
    logger.info('[桌宠状态] 已更新托盘图标', { module: 'PetWindow' })
  } catch (error) {
    logger.error('[桌宠状态] 更新失败', { module: 'PetWindow' }, {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error,
      state,
      message
    })
  }
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
  // 加载操作权限配置（首次启动引导授权 + 设置页可改；异常时回退默认）
  permissionGating.load()

  logger.info('[系统] 初始化安全知识库...', { module: 'System' })
  const securityKB = initSecurityKnowledgeBase()
  container.register('securityKB', securityKB)

  // 治理型 Agent：初始化事件总线 + 治理日志（生产配置）
  // - 日志节流：控制台 1s 窗口最多 50 条，防高频感知事件同步写 stdout 阻塞主进程
  // - 内存泄漏保护：seqByRun 容量上限 + 孤立事件不写 Map（AgentEventBus 内置）
  const governanceLoggerInstance = createGovernanceLogger(GOVERNANCE_LOGGER_PRODUCTION_CONFIG)

  // 应用设置页持久化的治理日志级别（用户偏好优先于生产默认，TRACE 开启决策路径埋点）
  const persistedLogLevel = loadGovernanceLogLevel()
  if (persistedLogLevel !== GOVERNANCE_LOGGER_PRODUCTION_CONFIG.level) {
    governanceLoggerInstance.setLevel(persistedLogLevel)
  }

  const agentEventBusInstance = createAgentEventBus({
    ...AGENT_EVENT_BUS_PRODUCTION_CONFIG,
    logger: governanceLoggerInstance,
  })
  container.register('governanceLogger', governanceLoggerInstance)
  container.register('agentEventBus', agentEventBusInstance)

  // 性能分析器去重链路日志注入治理日志器（trace/debug 级，级别为 TRACE 时可见去重键生成/合并细节）
  setPerfAnalyzerLogger(governanceLoggerInstance)

  governanceLoggerInstance.info('[治理Agent] 事件总线已初始化（生产配置）', { module: 'AgentEventBus' }, {
    enableSeqGuard: AGENT_EVENT_BUS_PRODUCTION_CONFIG.enableSeqGuard,
    enableDropWarning: AGENT_EVENT_BUS_PRODUCTION_CONFIG.enableDropWarning,
    logLevel: AGENT_EVENT_BUS_PRODUCTION_CONFIG.logLevel,
    consoleThrottle: GOVERNANCE_LOGGER_PRODUCTION_CONFIG.consoleThrottle,
  })

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
    interval: 10000,             // 监控间隔 10s
    warningThreshold: 70,        // 堆内存警告阈值 70%
    criticalThreshold: 85        // 堆内存严重阈值 85%
  })
  const cpuMonitor = new CPUMonitor({
    interval: 5000,
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
    // ===== 详细日志开始 =====
    logger.info('[监控回调] 触发检测', { module: 'MonitoringCallback' }, {
      source,
      riskCount: risks.length,
      highRiskCount: risks.filter(r => r.risk === 'high').length,
      hasDetectionResult: !!detectionResult
    })

    // 记录所有风险详情
    if (risks.length > 0) {
      logger.debug('[监控回调] 风险详情', { module: 'MonitoringCallback' }, {
        risks: risks.slice(0, 5).map(r => ({
          type: r.type,
          risk: r.risk,
          matched: r.matched?.substring(0, 50)
        }))
      })
    }

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
        logger.info('[主动监控] 开始解析行为', { module: 'ProactiveMonitor' }, {
          source,
          contentType: detectionResult.content_type,
          riskLevel: detectionResult.risk_level
        })

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

        logger.info('[主动监控] 行为解析完成', { module: 'ProactiveMonitor' }, {
          agentType: behavior.agentType,
          action: behavior.action,
          riskScore: behavior.riskScore,
          riskLevel: behavior.riskLevel
        })

        // 评估风险
        const assessment = behaviorRiskScorer.assessBehavior(behavior)

        logger.info('[主动监控] 风险评估完成', { module: 'ProactiveMonitor' }, {
          overallScore: assessment.overallScore,
          riskLevel: assessment.riskLevel,
          shouldAlert: assessment.shouldAlert,
          recommendationCount: assessment.recommendations.length,
          recommendations: assessment.recommendations.slice(0, 3)
        })

        // 主动告警
        const alerted = proactiveAlerter.handleAssessment(behavior, assessment)

        logger.info('[主动监控] 告警处理完成', { module: 'ProactiveMonitor' }, {
          alerted,
          behaviorId: behavior.timestamp
        })
      } catch (error) {
        logger.error('[主动监控] 行为评估失败', { module: 'ProactiveMonitor' }, {
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack
          } : error,
          source,
          detectionResultType: typeof detectionResult
        })
      }
    } else {
      logger.warn('[主动监控] 缺少检测结果，跳过行为评估', { module: 'ProactiveMonitor' }, {
        source,
        riskCount: risks.length
      })
    }

    // 原有逻辑：使用新的智能提示方式（不弹窗）
    showRiskAlert({
      risk_level: highRisks.length > 0 ? 'high' : 'medium',
      description: `${source}中发现${risks.length}个安全风险:\n${riskDescriptions.join('\n')}`
    })
  }

  // 注意：file/clipboard 的 setRiskDetectedCallback 由「监控事件适配器」接管（见下方 adapter.attach），
  // 先发布事件到总线，再转交 riskDetectedCallback 消费（兼容现有告警与桌宠）

  fileMonitor.setPetStateChangeCallback(updatePetState)
  clipboardMonitor.setPetStateChangeCallback(updatePetState)

  fileMonitor.setSaveRecordCallback((record) => storageService.saveOperation(record))
  clipboardMonitor.setSaveRecordCallback((record) => storageService.saveOperation(record))

  // 高风险文件操作二次确认
  fileMonitor.setConfirmRiskCallback(showRiskConfirmDialog)

  // 新增：进程监控
  const processMonitor = new ProcessMonitor()

  // 进程检测消费回调（由监控事件适配器先发布事件到总线，再转交此回调）
  const processDetectedCallback = (process: ProcessInfo) => {
    // ===== 详细日志开始 =====
    logger.info('[进程监控] 检测到进程', { module: 'ProcessMonitor' }, {
      processName: process.name,
      pid: process.pid,
      command: process.command?.substring(0, 100)
    })

    updatePetState('yellow', `检测到 ${process.name}`)

    // 新增：解析进程行为
    try {
      logger.info('[主动监控] 开始解析进程行为', { module: 'ProactiveMonitor' }, {
        processName: process.name,
        isAgent: true
      })

      const behavior = AgentBehaviorParser.parseProcessEvent(process.name, process.pid, true)

      logger.info('[主动监控] 进程行为解析完成', { module: 'ProactiveMonitor' }, {
        agentType: behavior.agentType,
        action: behavior.action,
        target: behavior.target
      })

      const assessment = behaviorRiskScorer.assessBehavior(behavior)

      logger.info('[主动监控] 进程风险评估完成', { module: 'ProactiveMonitor' }, {
        overallScore: assessment.overallScore,
        riskLevel: assessment.riskLevel,
        shouldAlert: assessment.shouldAlert
      })

      const alerted = proactiveAlerter.handleAssessment(behavior, assessment)

      logger.info('[主动监控] 进程告警处理完成', { module: 'ProactiveMonitor' }, {
        alerted,
        processId: process.pid
      })
    } catch (error) {
      logger.error('[主动监控] 进程行为评估失败', { module: 'ProactiveMonitor' }, {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error,
        processName: process.name,
        processId: process.pid
      })
    }
  }
  container.register('processMonitor', processMonitor)

  // 联动：工具会话结束时，用会话时间窗查询文件监控，关联其操作过的文件
  processMonitor.setRelatedFilesResolver((sessionStart, sessionEnd) => {
    return fileMonitor.getRelatedFilePaths(sessionStart, sessionEnd)
  })

  // 新增：网络监控
  const networkMonitor = new NetworkMonitor()

  // 网络请求消费回调（由监控事件适配器先发布事件到总线，再转交此回调）
  const networkRequestDetectedCallback = (request: NetworkRequest) => {
    // ===== 详细日志开始 =====
    logger.info('[网络监控] 检测到请求', { module: 'NetworkMonitor' }, {
      domain: request.domain,
      port: request.port,
      method: request.method,
      isAIProvider: request.isAIProvider
    })

    updatePetState('yellow', `API 调用: ${request.domain}`)

    // 新增：解析网络行为
    try {
      logger.info('[主动监控] 开始解析网络行为', { module: 'ProactiveMonitor' }, {
        domain: request.domain,
        port: request.port,
        isAIProvider: request.isAIProvider
      })

      const behavior = AgentBehaviorParser.parseNetworkEvent(
        request.domain,
        request.port || 443,
        request.isAIProvider || false
      )

      logger.info('[主动监控] 网络行为解析完成', { module: 'ProactiveMonitor' }, {
        agentType: behavior.agentType,
        action: behavior.action,
        target: behavior.target
      })

      const assessment = behaviorRiskScorer.assessBehavior(behavior)

      logger.info('[主动监控] 网络风险评估完成', { module: 'ProactiveMonitor' }, {
        overallScore: assessment.overallScore,
        riskLevel: assessment.riskLevel,
        shouldAlert: assessment.shouldAlert
      })

      const alerted = proactiveAlerter.handleAssessment(behavior, assessment)

      logger.info('[主动监控] 网络告警处理完成', { module: 'ProactiveMonitor' }, {
        alerted,
        domain: request.domain
      })
    } catch (error) {
      logger.error('[主动监控] 网络行为评估失败', { module: 'ProactiveMonitor' }, {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error,
        domain: request.domain,
        port: request.port
      })
    }
  }
  container.register('networkMonitor', networkMonitor)

  // 新增：API 调用监控（第二优先级，本地代理模式）
  const apiCallMonitor = new ApiCallMonitor()

  // API 高风险消费回调（由监控事件适配器先发布事件到总线，再转交此回调）
  const highRiskApiCallback = (info: ApiCallInfo) => {
    logger.warn('[API监控] 检测到高风险 API 调用', { module: 'ApiCallMonitor' }, {
      host: info.host,
      method: info.method,
      path: info.path,
      riskLevel: info.riskLevel,
      findings: info.findings,
    })
    updatePetState('red', `API 高风险: ${info.host}`)
    notify('API 调用监控', `检测到高风险调用 ${info.method} ${info.host}（${info.findings.join(', ') || info.riskLevel}）`)
  }

  // API 任意调用消费回调（由监控事件适配器先发布事件到总线，再转交此回调）
  const apiCallDetectedCallback = (info: ApiCallInfo) => {
    if (info.isAIProvider) {
      updatePetState('yellow', `AI 调用: ${info.host}`)
    }
  }
  container.register('apiCallMonitor', apiCallMonitor)

  // ============================================================
  // 治理型 Agent：接入监控事件适配器（A-收尾）
  // 把 6 类监控器回调接到事件总线（先 publish 再消费），
  // 供治理型 Agent 订阅 file/process/network/clipboard/api_call/resource 事件流。
  // 原 UI 消费逻辑（riskDetectedCallback / processDetectedCallback / ...）作为
  // 适配器 opts 透传，保证现有告警与桌宠行为不回退。
  // ============================================================
  const monitorEventAdapter = new MonitorEventAdapter({
    bus: agentEventBusInstance,
    logger: governanceLoggerInstance,
    onRiskDetected: riskDetectedCallback,
    onProcessDetected: processDetectedCallback,
    onNetworkRequestDetected: networkRequestDetectedCallback,
    onHighRiskApiCall: highRiskApiCallback,
    onApiCallDetected: apiCallDetectedCallback,
  })
  container.register('monitorEventAdapter', monitorEventAdapter)
  monitorEventAdapter.attach({
    fileMonitor,
    clipboardMonitor,
    processMonitor,
    networkMonitor,
    apiCallMonitor,
    memoryMonitor,
    cpuMonitor,
  })

  // ============================================================
  // 治理型 Agent：注册内置治理工具 + 实例化治理引擎（M8 接线）
  // 组装顺序：ToolRegistry → ToolBridge → RulePlanner + GovernanceEngine → start()
  // ============================================================
  // 1) 工具注册表：注册全部内置治理工具（file/verify/evidence/report/risk/backend）
  const toolRegistry = new ToolRegistry()
  for (const tool of [
    ...createFileTools(),
    ...createVerifyTools(),
    ...createEvidenceTools(),
    ...createReportTools(),
    ...createRiskTools(),
    ...createBackendTools(),
  ]) {
    toolRegistry.register(tool)
  }
  container.register('toolRegistry', toolRegistry)

  // 2) 执行分发桥：唯一工具执行入口，执行全程向 `tool` 流发布请求/结果（id 三端贯通）
  // 先建 PluginRegistry（共享 HooksHost）并把 AOP 挂点注入 ToolBridge：
  // beforeToolCall / afterToolCall（插件可在执行前改写 input、执行后改写结果）
  const pluginRegistry = new PluginRegistry({ logger: governanceLoggerInstance })
  pluginRegistry.setActive()
  const toolBridge = new ToolBridge(toolRegistry, {
    bus: agentEventBusInstance,
    // 注入共享治理日志器：ToolBridge 的 AOP 埋点（beforeToolCall/afterToolCall 等）跟随
    // 动态级别切换（INFO 过滤 debug、TRACE 开启决策路径），而非落到 silent logger
    logger: governanceLoggerInstance,
    onProgress: (p) => governanceLoggerInstance.info('[工具] 进度', { module: 'ToolBridge' }, p),
    hooks: pluginRegistry.hooks,
  })
  container.register('toolBridge', toolBridge)

  // 3) 注入后端真实配置（Django 治理后端：校验/存证/报告/工具桥，端口 8000）
  setBackendClientConfig({
    baseUrl: 'http://localhost:8000',
    logger: governanceLoggerInstance,
    retry: { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 5000 },
  })

  // 4) evidence.commit 本地降级：后端不可用时落盘 storageService（不静默失败）
  setEvidenceConfig({
    localFallback: async (content, metadata) => {
      const action = String(metadata.action ?? 'evidence')
      return storageService.saveOperation({
        id: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'governance_evidence',
        title: `五元组存证 ${action}`,
        content,
        source: 'governance_agent',
        status: 'recorded',
        risk_level: 'info',
        risk_score: 0,
        should_block: false,
        context: JSON.stringify(metadata),
        explanation: '后端不可用时的本地存证降级',
      })
    },
  })

  // 5) risk.mark 风险标签 registry（用户数据目录下持久化 + 前端联动通知）
  const riskTagsFile = path.join(app.getPath('userData'), 'governance', 'risk-tags.json')
  setRiskConfig({
    filePath: riskTagsFile,
    notify: (tag) => {
      try {
        container.resolve<MainWindow>('mainWindow').send('governance-risk-marked', tag)
      } catch {
        // 主窗口未就绪时忽略（风险标记已落盘）
      }
    },
  })

  // 6) 规划层（规则路由）+ 决策引擎（订阅感知流 → 规划 → 执行 → 验证）
  const planner = new RulePlanner({ logger: governanceLoggerInstance })

  // 6.1) Skill 插件化（M8/阶段 D）：共享 HooksHost 已在创建 ToolBridge 时注入
  // 引擎/toolBridge 只依赖 PluginHooksHost 接口（8 个决策链路挂点），与插件系统完全解耦；
  // 插件本身在 6.5 步 install（需要 bus + toolRegistry）。

  const governanceEngine = new GovernanceEngine(
    { bus: agentEventBusInstance, bridge: toolBridge, planner, logger: governanceLoggerInstance },
    {
      maxConcurrentReadonly: 3,
      // 决策链路钩子宿主：共享同一 HooksHost（引擎 + ToolBridge AOP 共用一套插件钩子）
      hooks: pluginRegistry.hooks,
      // 写动作权限钩子：受"治理 Agent 写操作"权限门控（未授权 fail-closed 直接拒绝）；
      // 已授权时审计存证/风险标记自动放行，未知语义后端工具需用户二次确认
      decision: async ({ tool, input, riskLevel, reason }) => {
        if (!getPermissionConfig().granted.agentWrite) {
          governanceLoggerInstance.warn('[权限] 治理 Agent 写操作未授权，已拒绝', { module: 'PermissionGate' }, { tool, riskLevel, reason })
          return false
        }
        if (tool === 'evidence.commit' || tool === 'risk.mark') return true
        return showRiskConfirmDialog({
          filePath: String(input.path ?? input.object ?? input.tool ?? 'unknown'),
          fileName: String(input.object ?? input.tool ?? '未知工具'),
          fileKind: 'normal',
          hash: '',
          previousHash: '',
          hashChanged: false,
          operationType: 'agent_write',
          riskLevel: riskLevel === 'critical' ? 'critical' : 'high',
          riskTags: [String(tool)],
          message: `治理引擎请求执行 ${tool}：${reason ?? ''}`,
        })
      },
      // 告警：smartAlerter 节流 + 系统通知
      alert: ({ level, title, description, runId, stream }) => {
        const alertResult = smartAlerter.handleAlert({
          riskLevel: level,
          riskType: 'governance',
          message: description,
        })
        if (alertResult.shouldNotify) {
          notify(title, description.slice(0, 80))
        }
        logger.warn('[治理Agent] 治理告警', { module: 'GovernanceEngine' }, { level, title, description, runId, stream })
      },
    },
  )
  container.register('governanceEngine', governanceEngine)
  governanceEngine.start()

  governanceLoggerInstance.info('[治理Agent] 内置工具已注册 + 治理引擎已启动', { module: 'GovernanceEngine' }, {
    toolCount: toolRegistry.size,
    tools: toolRegistry.names(),
    riskTagsFile,
    hooks: pluginRegistry.hooks ? 'plugin-hooks-host' : 'none',
  })

  // 6.5) Skill 插件化（M8/阶段 D）：安装内置 Skill 插件
  // 插件通过 subscribe 订阅感知流（OpenClaw 事件桥）、registerTools 注入工具，
  // 无需修改主进程核心逻辑即可扩展治理能力；cleanup 时 uninstallAll 清理。
  pluginRegistryUnsub = pluginRegistry.install(
    createRiskSummaryPlugin({ logger: governanceLoggerInstance }),
    agentEventBusInstance,
    toolRegistry,
  )

  // 6.5.1) 治理桌宠（P1+P2）：把 Agent 执行、安全告警、AI 治理定级实时呈现为桌宠
  //  - P1：安装 petPlugin，挂载 onRunStart/onRiskAssessed/beforeAlert/onRunEnd 钩子，
  //    driver 适配 PetWindow（setState/showBubble）
  //  - P2：订阅事件总线累计治理画像（真实数据），确定性 roll 生成角色并推送到桌宠窗口
  const petWindow = container.resolve<PetWindow>('petWindow')
  const petProfile = emptyProfile()
  // 桌宠角色种子：userData 目录路径保证跨重启确定性（同一用户同一角色）
  const petSeed = app.getPath('userData')

  // 治理画像统计：订阅 tool 流（工具请求/结果）+ verify.flow 终态
  const applyPetCharacter = () => {
    try {
      const companion = getCompanion(petSeed, petProfile)
      const character: PetCharacterInfo = {
        name: companion.name,
        species: companion.species,
        rarity: companion.rarity,
        rarityStars: RARITY_STARS[companion.rarity],
        shiny: companion.shiny,
        stats: companion.stats,
      }
      petWindow.setCharacter(character)
    } catch (error) {
      logger.warn('[桌宠] 角色生成失败', { module: 'PetWindow' }, { error: error instanceof Error ? error.message : String(error) })
    }
  }
  // 初次推送：空画像 → 基础角色
  applyPetCharacter()

  // 订阅感知流累计治理画像（真实数据驱动角色成长）
  petProfileUnsub = agentEventBusInstance.subscribe('tool', (envelope) => {
    const data = envelope.data as ToolCallResultData | undefined
    if (!data || data.type !== 'tool_result') return
    petProfile.tools++
    if (data.is_error) petProfile.failed++
    else petProfile.succeeded++
    if (data.effective_tool_name === 'verify.flow') petProfile.verifyFlows++
  })
  // 订阅感知风险流累计告警数（warning/critical）
  for (const stream of ['file', 'process', 'network', 'clipboard', 'api_call'] as const) {
    const unsub = agentEventBusInstance.subscribe(stream, (envelope) => {
      const data = (envelope.data ?? {}) as { severity?: string }
      if (data.severity === 'warning' || data.severity === 'critical') petProfile.alerts++
    })
    // 合并退订：用闭包包装，cleanup 时统一解除
    const prev = petProfileUnsub
    petProfileUnsub = () => {
      prev?.()
      unsub()
    }
  }

  // P1：桌宠插件 driver 适配（复用既有 updatePetState 通道以兼容托盘/主窗口联动）
  pluginRegistry.install(
    createPetPlugin(
      {
        setState: (mood, message) => {
          petWindow.setState(mood)
          petWindow.send('pet-state-change', mood)
          if (message) petWindow.showBubble(message)
        },
        showBubble: (text) => petWindow.showBubble(text),
      },
      { logger: governanceLoggerInstance },
    ),
    agentEventBusInstance,
    toolRegistry,
  )

  container.register('pluginRegistry', pluginRegistry)
  governanceLoggerInstance.info('[治理Agent] Skill 插件已安装', { module: 'PluginRegistry' }, {
    pluginCount: pluginRegistry.size,
    plugins: pluginRegistry.list().map((p) => ({ id: p.id, version: p.version, status: p.status })),
  })

  // 7) 性能报告自动分析：每次 verify.flow 执行结束后自动解析治理日志并保存报告
  // 通过订阅 `tool` 流的 tool_result 事件感知 verify.flow 终态（id 贯通键=effective_tool_name）
  perfAnalyzerUnsub = agentEventBusInstance.subscribe('tool', async (envelope) => {
    const data = envelope.data as ToolCallResultData | undefined
    if (!data || data.type !== 'tool_result' || data.effective_tool_name !== 'verify.flow') return

    // 等待 winston 文件传输把刚写入的日志 flush 到磁盘，避免读到的流式链路不完整
    await new Promise<void>((resolve) => setTimeout(resolve, 300))
    try {
      const report = await analyzeLogs(governanceLoggerInstance.getLogDirectory(), { limit: 10 })
      const reportsDir = path.join(app.getPath('userData'), 'reports')
      await fs.promises.mkdir(reportsDir, { recursive: true })
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const reportPath = path.join(reportsDir, `perf-report-${stamp}.txt`)
      await fs.promises.writeFile(reportPath, renderReport(report, 'text'), 'utf-8')
      governanceLoggerInstance.info('[性能分析] verify.flow 执行结束，已自动保存性能报告', { module: 'PerfLogAnalyzer' }, {
        runId: envelope.runId,
        toolUseId: data.tool_use_id,
        runs: report.runs.length,
        slowestExecMs: report.summary.execMs?.max ?? report.summary.flowTotalMs?.max,
        reportPath,
      })
    } catch (error) {
      // 分析失败不影响业务，仅记录告警
      governanceLoggerInstance.warn('[性能分析] 自动分析失败（不影响业务）', { module: 'PerfLogAnalyzer' }, {
        runId: envelope.runId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })

  // 设置托盘回调
  trayService.setShowMainWindowCallback(() => mainWindow.show())
  trayService.setQuitCallback(() => {
    isQuitting = true
    cleanup()
    app.quit()
  })

  // 注册IPC处理器（新增 healthMonitor / governanceLogger / userDataPath / onPermissionChanged 参数）
  const ipcHandlers = new IPCHandlers(
    storageService,
    fileMonitor,
    clipboardMonitor,
    () => petWindow.getState(),
    healthMonitor,
    apiCallMonitor,
    processMonitor,
    governanceLoggerInstance,
    app.getPath('userData'),
    // 权限变更回调：先重新加载配置到内存，再应用门控（保证实时生效）
    reloadPermissionAndApplyGating,
    // 插件注册表：插件管理 UI 通过 IPC 读取插件列表/钩子健康并启停
    pluginRegistry
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

  // 启动后台服务
  apiService.start()

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

  // 窗口行为对齐权限：托盘未授权时关闭即退出；系统通知未授权时不弹"后台运行"提示
  mainWindow.setCloseToTray(getPermissionConfig().granted.tray)
  mainWindow.setNotificationsEnabled(getPermissionConfig().granted.notifications)

  // 创建主窗口和桌宠窗口
  mainWindow.create()

  // 托盘常驻（受"托盘"权限门控；未授权则不创建）
  if (getPermissionConfig().granted.tray) {
    trayService.create()
  } else {
    logger.info('[权限] 未授予托盘常驻权限，跳过托盘创建', { module: 'PermissionGate' })
  }

  // 创建桌宠窗口
  try {
    petWindow.create()
    logger.info('[系统] ✅ 桌宠窗口创建成功', { module: 'PetWindow' })
  } catch (error) {
    logger.error('[系统] ❌ 桌宠窗口创建失败:', { module: 'PetWindow' }, { error })
  }

  // 按操作权限门控启动监控（文件/剪贴板/进程/网络/API/资源）
  applyPermissionGating()

  logger.info('[一鉴到底] 所有监控服务已启动', { module: 'System' })
  logger.info('[一鉴到底] 主动监控和健康度监控已启用（MVP）', { module: 'System' })
  
  // ============================================
  // 激活污点追踪系统（关键能力！）
  // ============================================
  try {
    activateTaintTracking()
    logger.info('[一鉴到底] ✅ 污点追踪系统已激活', { module: 'TaintTracking' })
  } catch (error) {
    logger.error('[一鉴到底] ❌ 污点追踪系统激活失败', { module: 'TaintTracking' }, {
      error: error instanceof Error ? error.message : String(error)
    })
  }
  
  logger.info('一鉴到底已启动', { module: 'System' })
  logger.info('关闭窗口后应用会继续在后台运行', { module: 'System' })
}

/**
 * 清理资源
 */
function cleanup() {
  const apiService = container.resolve<ApiService>('apiService')

  // 先停业务服务
  try {
    apiService.stop()
    logger.info('[清理] ✅ API 服务已停止', { module: 'Cleanup' })
  } catch (error) {
    logger.error('[清理] ❌ API 服务停止失败', { module: 'Cleanup' }, { error })
  }

  // 按权限门控停止监控：仅停用"已按权限启动"的监控，并逐项记录停止结果
  const monitorStops: Array<{ key: string; label: string; stop: () => void }> = [
    { key: 'file', label: '文件系统监控', stop: () => container.resolve<FileMonitor>('fileMonitor').stop() },
    { key: 'clipboard', label: '剪贴板监控', stop: () => container.resolve<ClipboardMonitor>('clipboardMonitor').stop() },
    { key: 'process', label: '进程监控', stop: () => container.resolve<ProcessMonitor>('processMonitor').stop() },
    { key: 'network', label: '网络请求监控', stop: () => container.resolve<NetworkMonitor>('networkMonitor').stop() },
    { key: 'apiCall', label: 'API 调用监控', stop: () => container.resolve<ApiCallMonitor>('apiCallMonitor').stop() },
    {
      key: 'resource',
      label: '资源监控（内存/CPU）',
      stop: () => {
        container.resolve<MemoryMonitorService>('memoryMonitor').stop()
        container.resolve<CPUMonitor>('cpuMonitor').stop()
      },
    },
  ]

  for (const spec of monitorStops) {
    if (!permissionGating.runningMonitors.has(spec.key)) {
      logger.info(`[清理] 跳过停止 ${spec.label}（未启动/未授权）`, { module: 'Cleanup' }, { monitor: spec.key, running: false })
      continue
    }
    try {
      spec.stop()
      permissionGating.runningMonitors.delete(spec.key)
      logger.info(`[清理] ✅ ${spec.label}已停止`, { module: 'Cleanup' }, { monitor: spec.key, stopped: true })
    } catch (error) {
      logger.error(`[清理] ❌ ${spec.label}停止失败`, { module: 'Cleanup' }, { monitor: spec.key, stopped: false, error })
    }
  }

  // 治理型 Agent：解除监控事件适配器对 memory/cpu 的事件订阅
  try {
    container.resolve<MonitorEventAdapter>('monitorEventAdapter').detach()
  } catch (error) {
    logger.warn('[系统] 监控事件适配器解绑失败', { module: 'MonitorEventAdapter' }, { error })
  }

  // 治理型 Agent：停止治理引擎（解除感知流订阅）
  try {
    container.resolve<GovernanceEngine>('governanceEngine').stop()
  } catch (error) {
    logger.warn('[系统] 治理引擎停止失败', { module: 'GovernanceEngine' }, { error })
  }

  // 治理型 Agent：解除 verify.flow 性能分析订阅（tool 流）
  if (perfAnalyzerUnsub) {
    try {
      perfAnalyzerUnsub()
    } catch (error) {
      logger.warn('[系统] 性能分析订阅解绑失败', { module: 'PerfLogAnalyzer' }, { error })
    }
    perfAnalyzerUnsub = undefined
  }

  // 治理型 Agent：卸载 Skill 插件（解除事件订阅 + 清理插件缓存）
  if (pluginRegistryUnsub) {
    try {
      pluginRegistryUnsub()
      logger.info('[清理] ✅ Skill 插件已卸载', { module: 'PluginRegistry' })
    } catch (error) {
      logger.warn('[系统] Skill 插件卸载失败', { module: 'PluginRegistry' }, { error })
    }
    pluginRegistryUnsub = undefined
  }

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
  // 托盘权限未授予时关闭窗口即退出应用；已授予则常驻后台
  if (getPermissionConfig().granted.tray) {
    event.preventDefault()
  }
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
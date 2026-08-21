/**
 * 一鉴到底 - 应用入口（重构版）
 * 职责：服务组装和生命周期管理
 * 行数目标：<100行
 */

import { app, Notification, dialog } from 'electron'
import { MainWindow, PetWindow, PetState } from './windows'
import type { PetCharacterInfo } from './windows'
import { FileMonitor, ClipboardMonitor, RiskResult, ProcessMonitor, ProcessInfo, NetworkMonitor, NetworkRequest, HighRiskConfirmation, ApiCallMonitor, ApiCallInfo } from './monitoring'
import { SmartAlerter, smartAlerter } from './monitoring/smartAlerter'
import { AgentBehaviorParser } from './monitoring/agentBehaviorParser'
import { BehaviorRiskScorer } from './monitoring/behaviorRiskScorer'
import { linkHighRiskToEvidence } from './monitoring/evidenceLinkage'
import { ProactiveAlerter, proactiveAlerter } from './monitoring/proactiveAlerter'
import { TrayService, ApiService, BackendService, StorageService, SyncService, syncService, logger, updaterService } from './services'
import { ModuleControlService } from './services/moduleControlService'
import { LocalAuthService, localAuthService } from './services/localAuthService'
import { GovernanceHealthMonitor } from './services/governanceHealthMonitor'
import { MemoryMonitorService } from './services/memoryMonitor'
import { CPUMonitor } from './services/cpuMonitor'
import { IPCHandlers } from './ipc'
import { DIContainer } from './di'
import { activateTaintTracking } from './monitoring/activateTaintTracking'
import {
  createAgentEventBus,
  createGovernanceLogger,
  loadGovernanceLogLevel,
  AGENT_EVENT_BUS_PRODUCTION_CONFIG,
  GOVERNANCE_LOGGER_PRODUCTION_CONFIG,
  MonitorEventAdapter,
  FileEventStore,
} from './events'
import type { ToolCallResultData } from './events'
import axios from 'axios'
import path from 'path'
import * as fs from 'fs'
import { GovernanceEngine, PluginRegistry } from './agent'
import type { PetDriver } from './agent/plugins/petPlugin'
import { getCompanion, emptyProfile, RARITY_STARS } from './agent/pet/companion'
import { analyzeLogs, renderReport, setPerfAnalyzerLogger } from './agent/perfLogAnalyzer'
import {
  MONITOR_KEYS,
  PermissionConfig,
} from './permissions/permissionConfig'
import { createPermissionGating } from './permissions/permissionGating'
import { loadAssemblyConfig } from './config/assemblyConfig'
import { createAssembler } from './assembly/assembler'
import type { MonitorProviderRegistry } from './monitoring/monitorProvider'
import { createGovernanceStack } from './assembly/bootstrap'
import type { McpServerService } from './mcp/mcpServerService'

// 依赖注入容器
const container = new DIContainer()

// 兜底：吞掉 stdout/stderr 管道断裂（EPIPE）。在 win-unpacked 目录直接运行或
// 宿主管道提前关闭时，winston 控制台传输写日志可能触发 EPIPE，挂上 error 监听避免主进程崩溃。
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (err: NodeJS.ErrnoException) => {
    if (err && err.code === 'EPIPE') return // 管道断裂：忽略，不中断主进程
    logger.error('[Main] 日志流写入异常', { module: 'Main' }, { code: err?.code, message: err?.message })
  })
}

// A4 单例收敛：业务单例统一注册进容器（同一实例，行为不变），消费方一律 resolve 获取，不再直接 import 单例
container.registerSingleton<SmartAlerter>('smartAlerter', smartAlerter)
container.registerSingleton<ProactiveAlerter>('proactiveAlerter', proactiveAlerter)
container.registerSingleton<SyncService>('syncService', syncService)
container.registerSingleton<LocalAuthService>('localAuthService', localAuthService)

// 应用状态
let isQuitting = false

// A5：监控注册表由装配器生成后注册进容器（key → MonitorProvider），getMonitor / cleanup 经容器延迟解析
// 容器注册名：'monitorRegistry'

// 操作权限门控：内部持有配置（首次启动引导授权 + 设置页可改；app ready 后加载）
const permissionGating = createPermissionGating({
  getUserDataPath: () => app.getPath('userData'),
  isAutoStartEnabled: () => app.getLoginItemSettings().openAtLogin,
  setAutoStartEnabled: (enabled) => app.setLoginItemSettings({ openAtLogin: enabled }),
  getMonitor: (key) => {
    const provider = container.resolveOptional<MonitorProviderRegistry>('monitorRegistry')?.[key]
    logger.debug(`[监控] getMonitor 解析 key=${key}`, { module: 'MonitorRegistry', monitor: key, resolved: !!provider, label: provider?.label, running: provider?.isRunning() })
    return provider
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

  // 使用智能提示器判断是否需要通知（A4：从容器 resolve 共享单例）
  const alertResult = container.resolve<SmartAlerter>('smartAlerter').handleAlert({
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
// 检测中（yellow）状态短暂保持后自动恢复绿色，避免桌宠一直被卡在黄色
let petGreenResetTimer: NodeJS.Timeout | null = null

function updatePetState(state: PetState, message?: string) {
  // ===== 详细日志开始 =====
  logger.info('[桌宠状态] 更新', { module: 'PetWindow' }, {
    newState: state,
    message: message?.substring(0, 100)
  })

  // 任何新状态都会取消未触发的自动恢复定时器
  if (petGreenResetTimer) {
    clearTimeout(petGreenResetTimer)
    petGreenResetTimer = null
  }

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

  // 检测中（yellow）状态：保持片刻后若无新事件则自动恢复绿色
  if (state === 'yellow') {
    petGreenResetTimer = setTimeout(() => updatePetState('green'), 8000)
  }
}

/**
 * 初始化所有服务
 */
function initializeServices() {
  // ============================================================
  // 0) 基础：权限配置 + 治理日志 + 事件总线（特殊接线，不配置化）
  // ============================================================
  // 加载操作权限配置（首次启动引导授权 + 设置页可改；异常时回退默认）
  permissionGating.load()

  // 治理型 Agent：初始化事件总线 + 治理日志（生产配置）
  // - 日志节流：控制台 1s 窗口最多 50 条，防高频感知事件同步写 stdout 阻塞主进程
  // - 内存泄漏保护：seqByRun 容量上限 + 孤立事件不写 Map（AgentEventBus 内置）
  const governanceLoggerInstance = createGovernanceLogger(GOVERNANCE_LOGGER_PRODUCTION_CONFIG)

  // 应用设置页持久化的治理日志级别（用户偏好优先于生产默认，TRACE 开启决策路径埋点）
  const persistedLogLevel = loadGovernanceLogLevel()
  if (persistedLogLevel !== GOVERNANCE_LOGGER_PRODUCTION_CONFIG.level) {
    governanceLoggerInstance.setLevel(persistedLogLevel)
  }

  // A3 事件总线持久化：挂载 FileEventStore 到用户数据目录，publish 事件落盘、可重放（userData/events/event-log.jsonl）
  const eventStoreDir = path.join(app.getPath('userData'), 'events')
  fs.mkdirSync(eventStoreDir, { recursive: true })
  const eventStore = new FileEventStore(path.join(eventStoreDir, 'event-log.jsonl'), {
    logger: governanceLoggerInstance,
  })
  const agentEventBusInstance = createAgentEventBus({
    ...AGENT_EVENT_BUS_PRODUCTION_CONFIG,
    logger: governanceLoggerInstance,
    store: eventStore,
  })
  container.setLogger(governanceLoggerInstance)
  container.registerSingleton('governanceLogger', governanceLoggerInstance)
  container.registerSingleton('agentEventBus', agentEventBusInstance)

  // 性能分析器去重链路日志注入治理日志器（trace/debug 级，级别为 TRACE 时可见去重键生成/合并细节）
  setPerfAnalyzerLogger(governanceLoggerInstance)

  governanceLoggerInstance.info('[治理Agent] 事件总线已初始化（生产配置）', { module: 'AgentEventBus' }, {
    enableSeqGuard: AGENT_EVENT_BUS_PRODUCTION_CONFIG.enableSeqGuard,
    enableDropWarning: AGENT_EVENT_BUS_PRODUCTION_CONFIG.enableDropWarning,
    logLevel: AGENT_EVENT_BUS_PRODUCTION_CONFIG.logLevel,
    consoleThrottle: GOVERNANCE_LOGGER_PRODUCTION_CONFIG.consoleThrottle,
  })

  // ============================================================
  // 1) 窗口 + 桌宠驱动（特殊接线：governance-pet 插件依赖容器注册的 petDriver）
  // ============================================================
  const mainWindow = new MainWindow()
  const petWindow = new PetWindow()
  container.register('mainWindow', mainWindow)
  container.register('petWindow', petWindow)

  container.register<PetDriver>('petDriver', {
    setState: (mood, message) => {
      petWindow.setState(mood)
      petWindow.send('pet-state-change', mood)
      if (message) petWindow.showBubble(message)
      // 检测中（yellow）状态同样走自动恢复绿色的机制
      if (mood === 'yellow') {
        if (petGreenResetTimer) clearTimeout(petGreenResetTimer)
        petGreenResetTimer = setTimeout(() => updatePetState('green'), 8000)
      }
    },
    showBubble: (text) => petWindow.showBubble(text),
  })

  // ============================================================
  // 2) 配置驱动装配（方案 A1）：服务 + 监控 runner + 插件 全部按配置声明装配
  //    新增服务/监控/插件只需改 assemblyConfig 声明 + factories 注册，不动本文件装配代码
  // ============================================================
  const pluginRegistry = new PluginRegistry({ logger: governanceLoggerInstance })
  pluginRegistry.setActive()
  container.register('pluginRegistry', pluginRegistry)

  const assemblyConfig = loadAssemblyConfig(app.getPath('userData'))
  const assembler = createAssembler(assemblyConfig, {
    container,
    logger: governanceLoggerInstance,
    getUserDataPath: () => app.getPath('userData'),
    bus: agentEventBusInstance,
    registry: pluginRegistry,
  })
  const { runners, services, plugins, toolCount } = assembler.assemble()
  // A5：监控注册表注册进容器（getMonitor / cleanup 经容器解析，可整体替换实现）
  container.registerSingleton<MonitorProviderRegistry>('monitorRegistry', runners)

  governanceLoggerInstance.info('[治理Agent] 配置驱动装配完成', { module: 'Assembler' }, {
    services,
    monitors: Object.keys(runners),
    plugins,
    toolCount,
  })

  // ============================================================
  // 3) 治理栈组装（bootstrap）：内置工具注册 + 后端配置 + ToolBridge/Planner/引擎
  // ============================================================
  createGovernanceStack({
    logger: governanceLoggerInstance,
    bus: agentEventBusInstance,
    container,
    app,
    pluginRegistry,
    storageService: container.resolve<StorageService>('storageService'),
    getPermissionConfig,
    notify,
    showRiskConfirmDialog,
  })

  // ============================================================
  // 4) 监控事件适配器（特殊接线）：把 6 类监控器回调接入事件总线
  //    （先 publish 再消费，UI 告警/桌宠行为经 opts 回调透传，不回退）
  // ============================================================
  const fileMonitor = container.resolve<FileMonitor>('fileMonitor')
  const clipboardMonitor = container.resolve<ClipboardMonitor>('clipboardMonitor')
  const storageService = container.resolve<StorageService>('storageService')
  const behaviorRiskScorer = container.resolve<BehaviorRiskScorer>('behaviorRiskScorer')

  // 监控器直连 UI 回调（不经过事件总线）：桌宠联动 / 记录落盘 / 高风险二次确认
  fileMonitor.setPetStateChangeCallback(updatePetState)
  clipboardMonitor.setPetStateChangeCallback(updatePetState)
  fileMonitor.setSaveRecordCallback((record) => storageService.saveOperation(record))
  clipboardMonitor.setSaveRecordCallback((record) => storageService.saveOperation(record))
  fileMonitor.setConfirmRiskCallback(showRiskConfirmDialog)

  // 风险检测消费回调（由监控事件适配器先发布事件到总线，再转交此回调）
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

        // 主动告警（A4：从容器 resolve 共享单例）
        const alerted = container.resolve<ProactiveAlerter>('proactiveAlerter').handleAssessment(behavior, assessment)

        logger.info('[主动监控] 告警处理完成', { module: 'ProactiveMonitor' }, {
          alerted,
          behaviorId: behavior.timestamp
        })

        // 高风险行为自动联动存证：写入后端 LongTermMemory 链式哈希存证（与存证中心同链），
        // 后端不可用时降级本地 operation 记录（详见 monitoring/evidenceLinkage.ts）
        linkHighRiskToEvidence({
          behavior,
          assessment,
          source,
          risks,
          sink: { saveOperation: (record) => storageService.saveOperation(record) },
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

      const alerted = container.resolve<ProactiveAlerter>('proactiveAlerter').handleAssessment(behavior, assessment)

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

  // 网络请求消费回调（由监控事件适配器先发布事件到总线，再转交此回调）
  const networkRequestDetectedCallback = (request: NetworkRequest) => {
    // ===== 详细日志开始 =====
    logger.info('[网络监控] 检测到请求', { module: 'NetworkMonitor' }, {
      domain: request.domain,
      foreignAddress: request.foreignAddress
    })

    updatePetState('yellow', `API 调用: ${request.domain}`)

    // 新增：解析网络行为
    try {
      logger.info('[主动监控] 开始解析网络行为', { module: 'ProactiveMonitor' }, {
        domain: request.domain,
        foreignAddress: request.foreignAddress
      })

      const behavior = AgentBehaviorParser.parseNetworkEvent(
        request.domain,
        request.foreignAddress ? Number(request.foreignAddress.split(':').pop()) || 443 : 443,
        true
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

      const alerted = container.resolve<ProactiveAlerter>('proactiveAlerter').handleAssessment(behavior, assessment)

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
        foreignAddress: request.foreignAddress
      })
    }
  }

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
    processMonitor: container.resolve<ProcessMonitor>('processMonitor'),
    networkMonitor: container.resolve<NetworkMonitor>('networkMonitor'),
    apiCallMonitor: container.resolve<ApiCallMonitor>('apiCallMonitor'),
    memoryMonitor: container.resolve<MemoryMonitorService>('memoryMonitor'),
    cpuMonitor: container.resolve<CPUMonitor>('cpuMonitor'),
  })

  // ============================================================
  // 5) 桌宠画像统计（特殊接线）：订阅感知流累计治理画像，确定性生成角色
  //    （governance-pet 插件的决策链路钩子已由装配器安装，此处只做画像统计）
  // ============================================================
  const petProfile = emptyProfile()
  // 桌宠角色种子：userData 目录路径保证跨重启确定性（同一用户同一角色）
  const petSeed = app.getPath('userData')

  // 治理画像统计：订阅 tool 流（工具请求/结果）+ verify.flow 终态
  // 共享计算：同一处产出角色（character）+ 治理画像快照（profile），
  // 既推送给桌宠窗口（setCharacter），也通过 IPC get-pet-stats 提供给设置页角色面板
  const computePetCharacter = () => {
    try {
      const companion = getCompanion(petSeed, petProfile)
      const character: PetCharacterInfo = {
        name: '小鉴',
        species: companion.species,
        rarity: companion.rarity,
        rarityStars: RARITY_STARS[companion.rarity],
        shiny: companion.shiny,
        stats: companion.stats,
      }
      return { character, profile: { ...petProfile } }
    } catch (error) {
      logger.warn('[桌宠] 角色生成失败', { module: 'PetWindow' }, { error: error instanceof Error ? error.message : String(error) })
      return null
    }
  }
  const applyPetCharacter = () => {
    const result = computePetCharacter()
    if (result) petWindow.setCharacter(result.character)
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

  // ============================================================
  // 6) 性能报告自动分析（特殊接线）：每次 verify.flow 执行结束后自动解析治理日志
  // ============================================================
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

  // ============================================================
  // 7) 托盘 + IPC 处理器（IPCHandlers 注册全部 IPC 通道）
  // ============================================================
  const trayService = container.resolve<TrayService>('trayService')
  trayService.setShowMainWindowCallback(() => mainWindow.show())
  trayService.setQuitCallback(() => {
    isQuitting = true
    cleanup()
    app.quit()
  })

  // 注册IPC处理器（新增 healthMonitor / governanceLogger / userDataPath / onPermissionChanged 参数）
  // P0 统一控制面：ModuleControlService 注入 modules:* IPC（依赖经容器惰性解析）
  const moduleControlService = new ModuleControlService({
    logger: governanceLoggerInstance,
    governanceLogger: governanceLoggerInstance,
    resolve: <T>(name: string) => container.resolveOptional<T>(name),
    cloudBaseUrl: 'http://127.0.0.1:8000',
  })

  const ipcHandlers = new IPCHandlers(
    storageService,
    fileMonitor,
    clipboardMonitor,
    () => petWindow.getState(),
    container.resolve<SyncService>('syncService'),
    container.resolve<LocalAuthService>('localAuthService'),
    container.resolve<GovernanceHealthMonitor>('healthMonitor'),
    container.resolve<ApiCallMonitor>('apiCallMonitor'),
    container.resolve<ProcessMonitor>('processMonitor'),
    governanceLoggerInstance,
    app.getPath('userData'),
    // 权限变更回调：先重新加载配置到内存，再应用门控（保证实时生效）
    reloadPermissionAndApplyGating,
    // 插件注册表：插件管理 UI 通过 IPC 读取插件列表/钩子健康并启停
    pluginRegistry,
    // 桌宠角色+治理画像提供方：设置页「治理桌宠」面板通过 IPC get-pet-stats 读取
    () => computePetCharacter(),
    // P0 统一控制面：模块状态 / 日志级别 / 预算额度（modules:* IPC 数据源）
    moduleControlService
  )
  ipcHandlers.registerAll()
}

/**
 * 启动应用
 */
async function startApplication() {
  const mainWindow = container.resolve<MainWindow>('mainWindow')
  const petWindow = container.resolve<PetWindow>('petWindow')
  const trayService = container.resolve<TrayService>('trayService')
  const apiService = container.resolve<ApiService>('apiService')

  // 启动后台服务
  apiService.start()

  // 自动拉起 Django 后端（检测 8000 → 未运行则 spawn → 等待就绪）
  // 非阻塞：窗口立即创建，前端 checkAuth 会轮询后端就绪后再校验登录态
  const backendService = container.resolve<BackendService>('backendService')
  backendService.start().then((ready) => {
    logger.info(`[系统] Django 后端自动启动${ready ? '成功' : '未就绪'}`, { module: 'BackendService', ready })
  }).catch((error) => {
    logger.error('[系统] Django 后端自动启动异常', { module: 'BackendService', error: error instanceof Error ? error.message : error })
  })

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

  // 自动更新：主进程接入 + 静默检查（生产环境；开发环境跳过）
  updaterService.init({
    getMainWindow: () => container.resolve<MainWindow>('mainWindow').getWindow() ?? null,
  })
  updaterService.checkForUpdates()

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

  // 启动 MCP Server（方案 C）：治理能力对外暴露；fail-closed 鉴权，写操作经 bootstrap 注入的权限钩子
  if (container.has('mcpServer')) {
    const mcpServer = container.resolve<McpServerService>('mcpServer')
    try {
      await mcpServer.start()
      logger.info('[MCP] 治理能力 MCP Server 已启动', { module: 'McpServer' }, { url: mcpServer.getUrl() })
    } catch (error) {
      logger.error('[MCP] MCP Server 启动失败', { module: 'McpServer' }, { error: error instanceof Error ? error.message : error })
    }
  }

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

  // 停止自动拉起的 Django 后端（外部已启动的复用进程不回收）
  try {
    container.resolve<BackendService>('backendService').stop()
    logger.info('[清理] ✅ Django 后端已停止', { module: 'Cleanup' })
  } catch (error) {
    logger.error('[清理] ❌ Django 后端停止失败', { module: 'Cleanup' }, { error })
  }

  // 停止 MCP Server（治理能力对外暴露；随应用退出）
  if (container.has('mcpServer')) {
    container.resolve<McpServerService>('mcpServer').stop().catch((error) => {
      logger.error('[清理] ❌ MCP Server 停止失败', { module: 'McpServer' }, { error })
    })
    logger.info('[清理] ✅ MCP Server 已停止', { module: 'McpServer' })
  }

  // 按权限门控停止监控：仅停用"已按权限启动"的监控，并逐项记录停止结果
  const monitorRegistry = container.resolveOptional<MonitorProviderRegistry>('monitorRegistry')
  for (const key of MONITOR_KEYS) {
    const runner = monitorRegistry?.[key]
    if (!runner) {
      logger.info(`[清理] 跳过停止 ${key}（装配器中未启用）`, { module: 'Cleanup' }, { monitor: key, running: false })
      continue
    }
    const { label, stop } = runner
    if (!permissionGating.runningMonitors.has(key)) {
      logger.info(`[清理] 跳过停止 ${label}（未启动/未授权）`, { module: 'Cleanup' }, { monitor: key, running: false })
      continue
    }
    try {
      stop()
      permissionGating.runningMonitors.delete(key)
      logger.info(`[清理] ✅ ${label}已停止`, { module: 'Cleanup' }, { monitor: key, stopped: true })
    } catch (error) {
      logger.error(`[清理] ❌ ${label}停止失败`, { module: 'Cleanup' }, { monitor: key, stopped: false, error })
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

  // 治理型 Agent：卸载 Skill 插件（解除事件订阅 + 清理插件缓存；装配器已按配置安装，此处整体卸载）
  try {
    container.resolve<PluginRegistry>('pluginRegistry').uninstallAll()
    logger.info('[清理] ✅ Skill 插件已卸载', { module: 'PluginRegistry' })
  } catch (error) {
    logger.warn('[系统] Skill 插件卸载失败', { module: 'PluginRegistry' }, { error })
  }

  // 桌宠角色：解除治理画像统计订阅
  if (petProfileUnsub) {
    try {
      petProfileUnsub()
    } catch (error) {
      logger.warn('[系统] 桌宠画像订阅解绑失败', { module: 'PetWindow' }, { error })
    }
    petProfileUnsub = undefined
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
app.whenReady().then(async () => {
  initializeServices()
  await startApplication()
})

app.on('window-all-closed', (event: Electron.Event) => {
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
  // 强制把渲染进程 localStorage 等持久存储落盘：避免退出未 flush 导致登录态/凭据丢失
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.session.flushStorageData()
    }
    logger.debug('[控制面] 已 flush 渲染进程存储数据', { module: 'AppLifecycle' })
  } catch (e) {
    logger.warn('[控制面] flushStorageData 失败', { module: 'AppLifecycle', error: e })
  }
  cleanup()
})

app.on('quit', () => {
  cleanup()
})

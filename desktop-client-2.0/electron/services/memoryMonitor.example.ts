/**
 * 内存监控服务使用示例
 * 演示如何在 Electron 应用中集成和使用 MemoryMonitorService
 */

import { MemoryMonitorService, MemoryMonitorConfig, MemoryAlert } from './memoryMonitor'

// ==================== 示例 1: 基础使用 ====================

/**
 * 创建并启动基础的内存监控
 */
function basicUsage() {
  // 创建监控服务（使用默认配置）
  const monitor = new MemoryMonitorService()

  // 启动监控
  monitor.start()

  // 运行一段时间后停止
  setTimeout(() => {
    monitor.stop()
  }, 60000) // 1分钟后停止
}

// ==================== 示例 2: 自定义配置 ====================

/**
 * 使用自定义配置启动监控
 */
function customConfigUsage() {
  const config: MemoryMonitorConfig = {
    interval: 3000,              // 每 3 秒采集一次
    warningThreshold: 75,        // 75% 时触发警告
    criticalThreshold: 90,       // 90% 时触发严重告警
    trendWindow: 300000,         // 5 分钟的趋势分析窗口
    maxSnapshots: 100,           // 最多保存 100 个快照
    enableAutoGC: true,          // 启用自动 GC
    autoGCThreshold: 92,         // 92% 时自动触发 GC
    enableLeakDetection: true    // 启用泄漏检测
  }

  const monitor = new MemoryMonitorService(config)
  monitor.start()

  return monitor
}

// ==================== 示例 3: 事件监听 ====================

/**
 * 监听各种内存监控事件
 */
function eventListeningExample() {
  const monitor = new MemoryMonitorService()

  // 监控启动事件
  monitor.on('started', (data) => {
    console.log('📊 内存监控已启动:', data.startTime)
  })

  // 监控停止事件
  monitor.on('stopped', (data) => {
    console.log(`📊 监控已停止，运行时长: ${data.duration}ms`)
    console.log(`📊 采集次数: ${data.samplesCollected}`)
  })

  // 采样事件（每次采集时触发）
  monitor.on('sample', (data) => {
    const { usage } = data
    console.log(`[${new Date().toLocaleTimeString()}] 堆内存: ${usage.heap.usagePercent.toFixed(1)}%`)
  })

  // 告警事件
  monitor.on('alert', (alert: MemoryAlert) => {
    console.log(`⚠️ 内存告警 [${alert.level}]: ${alert.message}`)
    console.log(`   当前堆内存: ${alert.currentUsage.heap.used} bytes`)

    // 可以在这里集成到通知系统
    // notificationService.show(alert.message)
  })

  // 快照事件
  monitor.on('snapshot', (snapshot) => {
    console.log(`📸 快照已创建: ${snapshot.id}`)
    console.log(`   堆内存: ${snapshot.memory.heap.usagePercent}%`)
  })

  // GC 事件
  monitor.on('gc', (data) => {
    console.log(`🗑️ GC 完成，释放: ${(data.freed / 1024 / 1024).toFixed(2)} MB`)
  })

  monitor.start()
  return monitor
}

// ==================== 示例 4: 内存快照和趋势分析 ====================

/**
 * 创建内存快照并分析趋势
 */
function snapshotAndTrendExample() {
  const monitor = new MemoryMonitorService({
    interval: 2000
  })

  monitor.start()

  // 定期创建快照
  setInterval(() => {
    const snapshot = monitor.createSnapshot(`定期快照-${Date.now()}`)
    console.log(`📸 创建快照: ${snapshot.id}`)
  }, 30000) // 每 30 秒创建一个快照

  // 定期分析趋势
  setInterval(() => {
    const trend = monitor.analyzeTrend()
    console.log('\n📈 内存趋势分析:')
    console.log(`   趋势方向: ${trend.trend}`)
    console.log(`   平均堆内存: ${(trend.avgHeapUsed / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   最大堆内存: ${(trend.maxHeapUsed / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   增长率: ${(trend.growthRate / 1024).toFixed(2)} KB/分钟`)

    if (trend.leakRisk) {
      console.log(`   ⚠️ 泄漏风险: ${trend.riskDetails}`)
    }
  }, 60000) // 每分钟分析一次趋势

  return monitor
}

// ==================== 示例 5: 在 Electron 主进程中集成 ====================

/**
 * 在 Electron 主进程启动时初始化内存监控
 */
function integrateWithElectron() {
  // electron/main.ts 中的示例代码

  /*
  import { app, BrowserWindow } from 'electron'
  import { MemoryMonitorService } from './services/memoryMonitor'

  let monitor: MemoryMonitorService

  app.whenReady().then(() => {
    // 创建窗口...

    // 启动内存监控
    monitor = new MemoryMonitorService({
      interval: 5000,
      warningThreshold: 70,
      criticalThreshold: 85,
      enableAutoGC: true,
      autoGCThreshold: 90
    })

    // 监听告警，可以在界面上显示
    monitor.on('alert', (alert) => {
      // 发送告警到渲染进程
      mainWindow?.webContents.send('memory-alert', alert)
    })

    // 启动监控
    monitor.start()

    console.log('✅ 内存监控服务已启动')
  })

  // 应用退出时停止监控
  app.on('before-quit', () => {
    monitor?.stop()
  })
  */
}

// ==================== 示例 6: IPC 通信集成 ====================

/**
 * 通过 IPC 提供内存信息给渲染进程
 */
function ipcIntegrationExample() {
  // electron/ipc/handlers.ts 中的示例代码

  /*
  import { ipcMain } from 'electron'
  import { MemoryMonitorService } from '../services/memoryMonitor'

  let monitor: MemoryMonitorService

  export function setupMemoryMonitor() {
    monitor = new MemoryMonitorService()
    monitor.start()
  }

  // 获取当前内存使用
  ipcMain.handle('memory:get-current', () => {
    return monitor.getCurrentUsage()
  })

  // 获取监控状态
  ipcMain.handle('memory:get-status', () => {
    return monitor.getStatus()
  })

  // 获取内存报告
  ipcMain.handle('memory:get-report', () => {
    return monitor.generateReport()
  })

  // 获取趋势分析
  ipcMain.handle('memory:get-trend', () => {
    return monitor.analyzeTrend()
  })

  // 手动触发 GC
  ipcMain.handle('memory:force-gc', () => {
    monitor.forceGC()
    return { success: true }
  })

  // 创建快照
  ipcMain.handle('memory:create-snapshot', (event, label?: string) => {
    return monitor.createSnapshot(label)
  })

  // 获取所有快照
  ipcMain.handle('memory:get-snapshots', () => {
    return monitor.getSnapshots()
  })

  // 获取告警列表
  ipcMain.handle('memory:get-alerts', (event, limit?: number) => {
    return monitor.getAlerts(limit)
  })

  // 更新配置
  ipcMain.handle('memory:update-config', (event, config) => {
    monitor.updateConfig(config)
    return { success: true }
  })
  */
}

// ==================== 示例 7: 性能优化建议 ====================

/**
 * 根据内存状态提供优化建议
 */
function provideOptimizationRecommendations() {
  const monitor = new MemoryMonitorService({
    interval: 10000,
    enableLeakDetection: true
  })

  monitor.start()

  // 定期检查并提供建议
  setInterval(() => {
    const report = monitor.generateReport()

    console.log('\n🔍 内存状态报告:')
    console.log(`   堆内存使用率: ${report.currentUsage.heap.usagePercent.toFixed(1)}%`)
    console.log(`   监控时长: ${Math.round(report.monitoringDuration / 1000)} 秒`)
    console.log(`   快照数量: ${report.snapshotCount}`)

    console.log('\n💡 优化建议:')
    report.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`)
    })

    // 如果有告警，显示最近的告警
    if (report.recentAlerts.length > 0) {
      console.log('\n⚠️ 最近告警:')
      report.recentAlerts.slice(-3).forEach(alert => {
        console.log(`   [${alert.level}] ${alert.message}`)
      })
    }
  }, 60000) // 每分钟生成一次报告
}

// ==================== 示例 8: 与 DI 容器集成 ====================

/**
 * 在依赖注入容器中注册内存监控服务
 */
function diContainerIntegration() {
  // electron/di/container.ts 中的示例代码

  /*
  import { Container } from 'inversify'
  import { MemoryMonitorService } from '../services/memoryMonitor'

  const container = new Container()

  // 注册为单例
  container.bind<MemoryMonitorService>(MemoryMonitorService).toConstantValue(
    new MemoryMonitorService({
      interval: 5000,
      warningThreshold: 70,
      criticalThreshold: 85
    })
  )

  export { container }
  */

  // 使用示例
  /*
  import { container } from './di/container'
  import { MemoryMonitorService } from './services/memoryMonitor'

  const monitor = container.get(MemoryMonitorService)
  monitor.start()
  */
}

// ==================== 示例 9: 测试环境配置 ====================

/**
 * 在测试中使用内存监控
 */
function testEnvironmentUsage() {
  // 测试文件中的示例代码

  /*
  import { describe, it, beforeEach, afterEach } from 'vitest'
  import { MemoryMonitorService } from '../services/memoryMonitor'

  describe('MyFeature', () => {
    let monitor: MemoryMonitorService

    beforeEach(() => {
      monitor = new MemoryMonitorService({
        interval: 100,  // 测试时使用更短的间隔
        maxSnapshots: 10
      })
      monitor.start()
    })

    afterEach(() => {
      monitor.stop()
    })

    it('should not leak memory', () => {
      const before = monitor.getCurrentUsage()

      // 执行被测试的代码
      // ...

      const after = monitor.getCurrentUsage()

      // 检查内存增长是否合理
      const growth = after.heap.used - before.heap.used
      const growthMB = growth / (1024 * 1024)

      expect(growthMB).toBeLessThan(10) // 增长不应超过 10MB
    })
  })
  */
}

// ==================== 示例 10: 生产环境最佳实践 ====================

/**
 * 生产环境中的完整配置示例
 */
function productionBestPractices() {
  const monitor = new MemoryMonitorService({
    interval: 10000,              // 10 秒间隔，减少性能影响
    warningThreshold: 75,         // 75% 警告
    criticalThreshold: 85,        // 85% 严重
    trendWindow: 600000,          // 10 分钟趋势分析
    maxSnapshots: 50,             // 限制快照数量
    maxTrendPoints: 500,          // 限制趋势数据点
    enableAutoGC: false,          // 生产环境谨慎使用自动 GC
    enableLeakDetection: true     // 启用泄漏检测
  })

  // 错误处理
  monitor.on('error', (error) => {
    console.error('内存监控错误:', error)
    // 可以发送到错误追踪服务
    // errorTracking.capture(error)
  })

  // 告警处理
  monitor.on('alert', (alert) => {
    if (alert.level === 'critical') {
      // 严重告警发送通知
      // notificationService.sendCritical(alert.message)
    } else {
      // 警告级别记录日志
      console.warn(`内存警告: ${alert.message}`)
    }
  })

  // 启动监控
  monitor.start()

  // 定期保存快照（可选）
  setInterval(() => {
    monitor.createSnapshot(`定期检查-${new Date().toISOString()}`)
  }, 300000) // 每 5 分钟

  return monitor
}

// ==================== 运行示例 ====================

// 取消注释以下代码来运行示例

// basicUsage()
// const monitor = customConfigUsage()
// eventListeningExample()
// snapshotAndTrendExample()

console.log(`
内存监控服务使用示例已加载。

可用的示例函数：
1. basicUsage() - 基础使用
2. customConfigUsage() - 自定义配置
3. eventListeningExample() - 事件监听
4. snapshotAndTrendExample() - 快照和趋势分析
5. integrateWithElectron() - Electron 集成
6. ipcIntegrationExample() - IPC 通信集成
7. provideOptimizationRecommendations() - 优化建议
8. diContainerIntegration() - DI 容器集成
9. testEnvironmentUsage() - 测试环境使用
10. productionBestPractices() - 生产环境最佳实践
`)
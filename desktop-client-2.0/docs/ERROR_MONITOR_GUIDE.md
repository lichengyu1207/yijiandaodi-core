# ErrorMonitor 错误监控系统使用指南

## 📋 概述

ErrorMonitor 是一鉴到底桌面客户端的完整错误监控系统，提供以下核心功能：

- ✅ Sentry SDK 集成
- ✅ 全局错误边界（主进程 + 渲染进程）
- ✅ 未捕获异常处理
- ✅ Promise 拒绝处理
- ✅ 错误上下文收集
- ✅ 错误自动上报
- ✅ 错误恢复策略
- ✅ 用户友好错误提示
- ✅ 错误采样和过滤

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install @sentry/electron
```

### 2. 配置 Sentry DSN

在项目根目录创建 `.env` 文件：

```env
# Sentry 配置
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

### 3. 主进程集成（已完成）

`main.ts` 已自动集成 ErrorMonitor：

```typescript
import { createErrorMonitor } from './services'

// 初始化错误监控（应用启动时）
const errorMonitor = createErrorMonitor({
  appName: 'yijiandaodi-desktop',
  appVersion: app.getVersion(),
  isDevelopment: !app.isPackaged,
  dsn: process.env.SENTRY_DSN,
  reporting: {
    enabled: true,
    sampleRate: 1.0,
    environment: app.isPackaged ? 'production' : 'development'
  }
})

errorMonitor.initialize()
```

---

## 📖 API 文档

### 主进程 API

#### 1. 手动上报错误

```typescript
import { ErrorMonitor } from './services'

const errorMonitor = container.resolve<ErrorMonitor>('errorMonitor')

// 上报简单错误
const errorId = errorMonitor.reportError(new Error('Something went wrong'))

// 上报带上下文的错误
const errorId = errorMonitor.reportError(error, {
  type: 'api_error',
  level: 'error',
  process: 'main',
  tags: { feature: 'sync' },
  extra: { userId: '123', action: 'sync_data' }
})
```

#### 2. 添加面包屑追踪

```typescript
// 记录用户操作
errorMonitor.addBreadcrumb({
  level: 'info',
  category: 'user',
  message: '用户点击同步按钮',
  data: { buttonId: 'sync-btn' }
})

// 记录 API 调用
errorMonitor.addBreadcrumb({
  level: 'info',
  category: 'http',
  message: 'API 请求',
  data: { url: '/api/sync', method: 'POST' }
})
```

#### 3. 设置用户上下文

```typescript
// 用户登录后设置
errorMonitor.setUser({
  id: 'user_123',
  email: 'user@example.com',
  username: '张三'
})
```

#### 4. 设置自定义标签和额外数据

```typescript
// 设置标签
errorMonitor.setTag('module', 'file-monitor')
errorMonitor.setTag('version', '2.0.0')

// 设置额外数据
errorMonitor.setExtra('config', { autoSync: true, interval: 5000 })
```

#### 5. 获取错误统计

```typescript
const stats = errorMonitor.getStats()
console.log('总错误数:', stats.total)
console.log('按类型统计:', stats.byType)
console.log('最近错误:', stats.recentErrors)
```

---

### 渲染进程 API

在渲染进程中使用 IPC 通信：

#### 1. 上报错误

```typescript
// src/renderer/errorReporter.ts
import { ipcRenderer } from 'electron'

export async function reportError(
  error: Error | string,
  context?: {
    type?: string
    level?: string
    tags?: Record<string, string>
    extra?: Record<string, any>
  }
): Promise<string> {
  const result = await ipcRenderer.invoke('error-monitor:report', error, context)
  return result.errorId
}

// 使用示例
try {
  // 业务代码
} catch (error) {
  await reportError(error, {
    type: 'business_error',
    level: 'error',
    tags: { component: 'Dashboard' },
    extra: { action: 'load_data' }
  })
}
```

#### 2. 添加面包屑

```typescript
export async function addBreadcrumb(breadcrumb: {
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
  category: string
  message: string
  data?: Record<string, any>
}): Promise<void> {
  await ipcRenderer.invoke('error-monitor:breadcrumb', breadcrumb)
}

// 使用示例
await addBreadcrumb({
  level: 'info',
  category: 'navigation',
  message: '用户导航到设置页面',
  data: { from: '/dashboard', to: '/settings' }
})
```

#### 3. React 错误边界组件

```typescript
// src/components/ErrorBoundary.tsx
import React from 'react'
import { reportError } from '../renderer/errorReporter'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 上报错误到主进程
    await reportError(error, {
      type: 'renderer_error',
      level: 'error',
      tags: { component: 'ErrorBoundary' },
      extra: {
        componentStack: errorInfo.componentStack
      }
    })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>应用遇到错误</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

---

## ⚙️ 配置说明

### 错误监控配置项

```typescript
interface ErrorMonitorConfig {
  // Sentry DSN（从 Sentry 项目设置获取）
  dsn?: string

  // 应用信息
  appName: string
  appVersion: string
  isDevelopment: boolean

  // 错误上报配置
  reporting: {
    enabled: boolean              // 是否启用上报
    sampleRate: number            // 采样率 (0-1)
    environment: string           // 环境标识
    ignorePatterns?: (string | RegExp)[]  // 忽略的错误模式
    beforeSend?: (error: ErrorContext) => boolean  // 自定义过滤
    user?: { id?: string; email?: string; username?: string }
  }

  // 用户提示
  showUserFriendlyMessages: boolean  // 是否显示友好提示

  // 面包屑追踪
  enableBreadcrumbs: boolean
  maxBreadcrumbs: number

  // 恢复策略
  recoveryStrategies?: Partial<Record<ErrorType, RecoveryConfig>>
}
```

### 错误恢复策略

系统内置 7 种恢复策略：

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| `ignore` | 忽略错误 | 非关键错误 |
| `log` | 仅记录日志 | 调试信息 |
| `report` | 上报错误 | 需要跟踪的错误 |
| `notify` | 通知用户 | 需要用户知道的错误 |
| `restart_window` | 重启窗口 | 渲染进程崩溃 |
| `restart` | 重启应用 | 主进程崩溃 |
| `fallback` | 使用降级方案 | 服务不可用 |

### 自定义恢复策略

```typescript
const errorMonitor = createErrorMonitor({
  // ...其他配置
  recoveryStrategies: {
    api_error: {
      strategy: 'fallback',
      maxRetries: 3,
      retryDelay: 2000,
      fallback: () => {
        // 降级处理：使用本地缓存
        console.log('使用本地缓存数据')
      }
    },
    network_error: {
      strategy: 'fallback',
      maxRetries: 5,
      retryDelay: 3000,
      fallback: () => {
        // 降级处理：切换到离线模式
        console.log('切换到离线模式')
      }
    }
  }
})
```

---

## 📊 错误类型

系统支持以下错误类型：

| 类型 | 说明 | 默认级别 |
|------|------|----------|
| `uncaught_exception` | 未捕获异常 | fatal |
| `unhandled_rejection` | 未处理的 Promise 拒绝 | error |
| `renderer_error` | 渲染进程错误 | error |
| `api_error` | API 调用错误 | error |
| `network_error` | 网络错误 | warning |
| `file_error` | 文件操作错误 | error |
| `validation_error` | 数据验证错误 | warning |
| `business_error` | 业务逻辑错误 | error |

---

## 🎯 最佳实践

### 1. 适时上报错误

```typescript
// ✅ 好：上报影响用户体验的错误
try {
  await syncData()
} catch (error) {
  errorMonitor.reportError(error, {
    type: 'api_error',
    level: 'error',
    tags: { feature: 'sync' }
  })
}

// ❌ 避免：上报不影响功能的错误
try {
  console.log('Debug info:', data)
} catch (error) {
  // 这种调试日志错误不需要上报
}
```

### 2. 提供有价值的上下文

```typescript
// ✅ 好：提供详细上下文
errorMonitor.reportError(error, {
  type: 'api_error',
  level: 'error',
  tags: {
    module: 'sync',
    operation: 'upload_file'
  },
  extra: {
    fileId: '123',
    fileSize: '2MB',
    retryCount: 3,
    lastSuccessTime: '2024-01-01T00:00:00Z'
  }
})

// ❌ 避免：缺少上下文
errorMonitor.reportError(error)
```

### 3. 使用面包屑追踪用户路径

```typescript
// 记录关键操作
errorMonitor.addBreadcrumb({
  level: 'info',
  category: 'navigation',
  message: '用户导航到证据管理页面'
})

errorMonitor.addBreadcrumb({
  level: 'info',
  category: 'user-action',
  message: '用户上传文件',
  data: { fileName: 'evidence.pdf', size: '5MB' }
})

errorMonitor.addBreadcrumb({
  level: 'info',
  category: 'api',
  message: '开始同步数据'
})
```

### 4. 合理设置采样率

```typescript
// 生产环境建议设置采样率
const errorMonitor = createErrorMonitor({
  reporting: {
    enabled: true,
    sampleRate: app.isPackaged ? 0.8 : 1.0,  // 生产环境 80%，开发环境 100%
    environment: app.isPackaged ? 'production' : 'development'
  }
})
```

### 5. 过滤敏感信息

```typescript
const errorMonitor = createErrorMonitor({
  reporting: {
    enabled: true,
    beforeSend: (error) => {
      // 过滤包含敏感信息的错误
      if (error.message.includes('password') ||
          error.message.includes('token')) {
        return false
      }
      return true
    }
  }
})
```

---

## 🔍 错误监控流程

```
错误发生
    ↓
全局错误处理器捕获
    ↓
构建错误上下文（时间、设备、版本等）
    ↓
检查是否应该忽略
    ↓
是否达到采样率？ ──否──→ 仅记录本地
    ↓ 是
上报到 Sentry
    ↓
执行恢复策略（通知用户/重启窗口/降级等）
    ↓
更新错误统计
    ↓
显示用户友好提示（如果启用）
```

---

## 📈 监控和统计

### 获取错误统计

```typescript
const stats = errorMonitor.getStats()

console.log('总错误数:', stats.total)
console.log('按类型统计:', stats.byType)
console.log('按级别统计:', stats.byLevel)
console.log('最近 50 条错误:', stats.recentErrors)
console.log('上报成功率:', stats.reportSuccessRate)
```

### 获取错误历史

```typescript
// 获取最近 100 条错误
const recentErrors = errorMonitor.getErrorHistory(100)

// 获取所有错误历史
const allErrors = errorMonitor.getErrorHistory()
```

---

## 🛠️ 故障排查

### 问题：Sentry 上报失败

**检查清单：**
1. ✅ 确认 DSN 配置正确
2. ✅ 确认网络连接正常
3. ✅ 检查 Sentry 项目状态
4. ✅ 查看控制台错误日志

### 问题：错误没有触发恢复策略

**可能原因：**
1. 未配置该错误类型的恢复策略
2. 已达到最大重试次数
3. 恢复策略执行时发生异常

### 问题：渲染进程错误未上报

**解决方案：**
确保在渲染进程使用 IPC 通信：

```typescript
// ❌ 错误：直接调用主进程 API
errorMonitor.reportError(error)

// ✅ 正确：使用 IPC
await ipcRenderer.invoke('error-monitor:report', error, context)
```

---

## 📝 总结

ErrorMonitor 提供了完整的错误监控解决方案：

- ✅ 自动捕获未处理异常
- ✅ 提供丰富的上下文信息
- ✅ 支持灵活的恢复策略
- ✅ 用户友好的错误提示
- ✅ 详细的错误统计和历史记录

通过合理配置和使用，可以显著提升应用的稳定性和用户体验。
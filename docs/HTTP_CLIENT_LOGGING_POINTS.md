# HttpClient 日志埋点文档

## 概述

本文档详细说明了 HttpClient 和 CircuitBreaker 中的所有日志埋点，帮助理解和排查请求链路中的问题。

---

## 日志级别说明

| 级别 | 说明 | 使用场景 |
|------|------|---------|
| `console.log` | 信息日志 | 记录正常流程 |
| `console.warn` | 警告日志 | 记录异常但不中断流程 |
| `console.error` | 错误日志 | 记录错误和失败 |

---

## HttpClient 日志埋点

### 1. 初始化阶段

#### 日志标签：`[初始化]`

```typescript
console.log(`[HttpClient] [初始化] HttpClient 初始化开始`, {
  baseURL: 'http://localhost:9092',
  timeout: 30000,
  loggingEnabled: true,
  circuitBreakerEnabled: true
})
```

**触发时机**：HttpClient 构造函数开始执行
**用途**：确认初始化参数

---

#### 日志标签：`[熔断器]`

```typescript
console.log(`[HttpClient] [熔断器] 熔断器已启用并初始化`, {
  serviceName: 'http://localhost:9092',
  failureThreshold: 5,
  openDuration: '30000ms',
  successThreshold: 3,
  hasFallback: true
})
```

**触发时机**：熔断器初始化完成
**用途**：确认熔断器配置

---

#### 日志标签：`[初始化完成]`

```typescript
console.log(`[HttpClient] [初始化完成] HttpClient 已就绪`, {
  baseURL: 'http://localhost:9092',
  timestamp: '2026-08-12T08:15:30.123Z'
})
```

**触发时机**：HttpClient 初始化完成
**用途**：确认服务已就绪

---

### 2. 请求发起阶段

#### 日志标签：`[请求发起]`

```typescript
console.log(`[HttpClient] [req_1691234567890_abc123] [请求发起]`, {
  method: 'GET',
  url: '/api/v1/users',
  baseURL: 'http://localhost:9092',
  timestamp: '2026-08-12T08:15:30.123Z'
})
```

**触发时机**：每个请求开始时
**用途**：记录请求的基本信息

---

#### 日志标签：`[熔断器检查]`

```typescript
console.log(`[HttpClient] [req_1691234567890_abc123] [熔断器检查] 熔断器已启用，进入熔断器执行流程`)
```

**触发时机**：检测到熔断器已启用
**用途**：确认进入熔断器处理流程

---

#### 日志标签：`[执行请求]`

```typescript
console.log(`[HttpClient] [req_1691234567890_abc123] [执行请求] 开始执行实际HTTP请求`)
```

**触发时机**：熔断器允许请求通过
**用途**：确认开始实际HTTP请求

---

#### 日志标签：`[axios请求]`

```typescript
console.log(`[HttpClient] [req_1691234567890_abc123] [axios请求] 发起 axios 请求`, {
  method: 'GET',
  url: '/api/v1/users',
  hasData: false,
  timeout: 30000
})
```

**触发时机**：发起 axios 请求
**用途**：记录 axios 请求参数

---

### 3. 请求成功阶段

#### 日志标签：`[axios成功]`

```typescript
console.log(`[HttpClient] [req_1691234567890_abc123] [axios成功] HTTP 请求成功`, {
  status: 200,
  statusText: 'OK',
  duration: '245ms',
  responseSize: 1024
})
```

**触发时机**：axios 请求成功
**用途**：记录成功响应的详细信息

---

#### 日志标签：`[请求完成]`

```typescript
console.log(`[HttpClient] [req_1691234567890_abc123] [请求完成] 熔断器执行成功`, {
  duration: '250ms'
})
```

**触发时机**：熔断器执行成功
**用途**：确认整个流程完成

---

### 4. 请求失败阶段

#### 日志标签：`[axios失败]`

```typescript
console.error(`[HttpClient] [req_1691234567890_abc123] [axios失败] HTTP 请求失败`, {
  duration: '5002ms',
  errorMessage: 'Network Error',
  errorCode: 'ERR_NETWORK',
  statusCode: undefined
})
```

**触发时机**：axios 请求失败
**用途**：记录失败的详细信息

---

#### 日志标签：`[请求失败]`

```typescript
console.error(`[HttpClient] [req_1691234567890_abc123] [请求失败] 熔断器执行失败`, {
  duration: '5005ms',
  error: 'Network Error'
})
```

**触发时机**：熔断器执行失败
**用途**：确认整个流程失败

---

## CircuitBreaker 日志埋点

### 1. 请求进入阶段

#### 日志标签：`[请求进入]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [请求进入]`, {
  requestId: 'req_1691234567890_abc123',
  method: 'GET',
  url: '/api/v1/users',
  currentState: 'CLOSED',
  timestamp: '2026-08-12T08:15:30.123Z'
})
```

**触发时机**：请求进入熔断器
**用途**：记录请求上下文和当前状态

---

#### 日志标签：`[状态检查]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [状态检查] 熔断器打开，进入处理流程`)
```

**触发时机**：熔断器状态为 OPEN
**用途**：确认进入熔断处理流程

---

### 2. 开始执行阶段

#### 日志标签：`[开始执行]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [开始执行] RequestID: req_1691234567890_abc123`)
```

**触发时机**：熔断器允许请求执行
**用途**：确认开始执行请求

---

#### 日志标签：`[执行成功]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [执行成功]`, {
  requestId: 'req_1691234567890_abc123',
  duration: '245ms',
  currentState: 'CLOSED'
})
```

**触发时机**：请求执行成功
**用途**：记录成功结果

---

#### 日志标签：`[执行失败]`

```typescript
console.error(`[CircuitBreaker] [http://localhost:9092] [执行失败]`, {
  requestId: 'req_1691234567890_abc123',
  duration: '5002ms',
  error: 'Network Error',
  currentState: 'CLOSED'
})
```

**触发时机**：请求执行失败
**用途**：记录失败原因

---

### 3. 打开状态处理

#### 日志标签：`[打开状态处理]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [打开状态处理]`, {
  requestId: 'req_1691234567890_abc123',
  elapsed: '15000ms',
  openDuration: '30000ms',
  remainingTime: '15000ms',
  shouldTransitionToHalfOpen: false
})
```

**触发时机**：熔断器处于打开状态
**用途**：记录打开状态的详细信息

---

#### 日志标签：`[熔断拒绝]`

```typescript
console.warn(`[CircuitBreaker] [http://localhost:9092] [熔断拒绝] 快速失败`, {
  requestId: 'req_1691234567890_abc123',
  reason: '熔断器打开',
  remainingTime: '15000ms'
})
```

**触发时机**：拒绝请求
**用途**：记录拒绝原因

---

#### 日志标签：`[状态转换]`

```typescript
console.warn(`[CircuitBreaker] [http://localhost:9092] [状态转换] 熔断器打开`, {
  previousState: 'CLOSED',
  newState: 'OPEN',
  timestamp: '2026-08-12T08:15:30.123Z',
  statistics: {
    totalCalls: 15,
    failedCalls: 8,
    failureRate: '53.33%',
    slowCallRate: '10.00%'
  },
  openDuration: '30000ms'
})
```

**触发时机**：熔断器状态转换
**用途**：记录状态转换的详细信息

---

### 4. 半打开状态处理

#### 日志标签：`[半打开状态处理]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [半打开状态处理]`, {
  requestId: 'req_1691234567890_abc123',
  currentCalls: 1,
  maxCalls: 3,
  canProceed: true
})
```

**触发时机**：熔断器处于半打开状态
**用途**：记录探测进度

---

#### 日志标签：`[半打开允许]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [半打开允许] 允许探测请求`, {
  requestId: 'req_1691234567890_abc123',
  newCallCount: 2
})
```

**触发时机**：允许探测请求通过
**用途**：确认探测请求

---

#### 日志标签：`[半打开成功]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [半打开成功] 探测成功`, {
  requestId: 'req_1691234567890_abc123',
  successCount: 2,
  threshold: 3
})
```

**触发时机**：探测请求成功
**用途**：记录成功探测

---

#### 日志标签：`[半打开失败]`

```typescript
console.error(`[CircuitBreaker] [http://localhost:9092] [半打开失败] 探测失败，立即打开熔断器`, {
  requestId: 'req_1691234567890_abc123',
  error: 'Connection refused'
})
```

**触发时机**：探测请求失败
**用途**：记录失败探测

---

### 5. 降级函数执行

#### 日志标签：`[降级触发]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [降级触发] 准备执行降级函数`)
```

**触发时机**：准备执行降级函数
**用途**：确认降级触发

---

#### 日志标签：`[降级开始]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [降级开始] 准备执行降级函数`, {
  requestId: 'req_1691234567890_abc123',
  method: 'GET',
  url: '/api/v1/users',
  timestamp: '2026-08-12T08:15:30.123Z'
})
```

**触发时机**：开始执行降级函数
**用途**：记录降级开始时间

---

#### 日志标签：`[降级上下文]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [降级上下文]`, {
  requestId: 'req_1691234567890_abc123',
  serviceName: 'http://localhost:9092',
  circuitState: 'OPEN',
  failureCount: 8,
  failureRate: '53.33%',
  slowCallRate: '10.00%'
})
```

**触发时机**：构建降级上下文
**用途**：记录降级上下文信息

---

#### 日志标签：`[降级成功]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [降级成功]`, {
  requestId: 'req_1691234567890_abc123',
  duration: '5ms',
  resultType: 'object'
})
```

**触发时机**：降级函数执行成功
**用途**：记录降级成功

---

#### 日志标签：`[降级失败]`

```typescript
console.error(`[CircuitBreaker] [http://localhost:9092] [降级失败]`, {
  requestId: 'req_1691234567890_abc123',
  duration: '15ms',
  error: 'Fallback function threw an error',
  stack: 'Error: Fallback function threw an error\n    at ...'
})
```

**触发时机**：降级函数执行失败
**用途**：记录降级失败原因

---

### 6. 成功/失败记录

#### 日志标签：`[记录成功]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [记录成功]`, {
  requestId: 'req_1691234567890_abc123',
  duration: '245ms',
  isSlowCall: false,
  currentState: 'CLOSED'
})
```

**触发时机**：记录成功结果
**用途**：记录成功统计信息

---

#### 日志标签：`[记录失败]`

```typescript
console.error(`[CircuitBreaker] [http://localhost:9092] [记录失败]`, {
  requestId: 'req_1691234567890_abc123',
  duration: '5002ms',
  isSlowCall: true,
  errorMessage: 'Network Error',
  currentState: 'CLOSED'
})
```

**触发时机**：记录失败结果
**用途**：记录失败统计信息

---

#### 日志标签：`[失败检测]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [失败检测] 检查是否应该打开熔断器`, {
  requestId: 'req_1691234567890_abc123',
  totalCalls: 15,
  failedCalls: 8,
  failureRate: '53.33%',
  slowCallRate: '10.00%'
})
```

**触发时机**：检查失败阈值
**用途**：记录失败检测过程

---

### 7. 恢复完成

#### 日志标签：`[恢复完成]`

```typescript
console.log(`[CircuitBreaker] [http://localhost:9092] [恢复完成] 达到成功阈值，准备关闭熔断器`)
```

**触发时机**：达到成功阈值
**用途**：确认服务恢复

---

## 日志输出示例

### 正常请求流程

```
[HttpClient] [初始化] HttpClient 初始化开始 { baseURL: 'http://localhost:9092', ... }
[HttpClient] [熔断器] 熔断器已启用并初始化 { serviceName: 'http://localhost:9092', ... }
[HttpClient] [初始化完成] HttpClient 已就绪 { baseURL: 'http://localhost:9092', ... }

[HttpClient] [req_1691234567890_abc123] [请求发起] { method: 'GET', url: '/api/v1/users', ... }
[HttpClient] [req_1691234567890_abc123] [熔断器检查] 熔断器已启用，进入熔断器执行流程

[CircuitBreaker] [http://localhost:9092] [请求进入] { requestId: 'req_1691234567890_abc123', currentState: 'CLOSED', ... }
[CircuitBreaker] [http://localhost:9092] [开始执行] RequestID: req_1691234567890_abc123

[HttpClient] [req_1691234567890_abc123] [执行请求] 开始执行实际HTTP请求
[HttpClient] [req_1691234567890_abc123] [axios请求] 发起 axios 请求 { method: 'GET', url: '/api/v1/users', ... }
[HttpClient] [req_1691234567890_abc123] [axios成功] HTTP 请求成功 { status: 200, duration: '245ms', ... }

[CircuitBreaker] [http://localhost:9092] [执行成功] { requestId: 'req_1691234567890_abc123', duration: '245ms', ... }
[CircuitBreaker] [http://localhost:9092] [记录成功] { requestId: 'req_1691234567890_abc123', duration: '245ms', ... }

[HttpClient] [req_1691234567890_abc123] [请求完成] 熔断器执行成功 { duration: '250ms' }
```

### 熔断触发流程

```
[CircuitBreaker] [http://localhost:9092] [记录失败] { requestId: 'req_1691234567890_abc123', ... }
[CircuitBreaker] [http://localhost:9092] [失败检测] 检查是否应该打开熔断器 { totalCalls: 15, failedCalls: 8, ... }
[CircuitBreaker] [http://localhost:9092] [失败检测] 达到阈值，准备打开熔断器
[CircuitBreaker] [http://localhost:9092] [状态转换] 熔断器打开 { previousState: 'CLOSED', newState: 'OPEN', ... }
```

### 降级执行流程

```
[CircuitBreaker] [http://localhost:9092] [打开状态处理] { requestId: 'req_1691234567890_abc123', elapsed: '15000ms', ... }
[CircuitBreaker] [http://localhost:9092] [熔断拒绝] 快速失败 { requestId: 'req_1691234567890_abc123', ... }
[CircuitBreaker] [http://localhost:9092] [降级触发] 准备执行降级函数
[CircuitBreaker] [http://localhost:9092] [降级开始] 准备执行降级函数 { requestId: 'req_1691234567890_abc123', ... }
[CircuitBreaker] [http://localhost:9092] [降级上下文] { requestId: 'req_1691234567890_abc123', ... }
[CircuitBreaker] [http://localhost:9092] [降级成功] { requestId: 'req_1691234567890_abc123', duration: '5ms', ... }
```

---

## 使用建议

1. **生产环境**：可以根据需要调整日志级别，减少详细日志
2. **开发环境**：建议开启所有日志，方便排查问题
3. **日志收集**：建议将日志发送到集中式日志系统（如 ELK）
4. **告警设置**：可以基于 `[状态转换]`、`[熔断拒绝]`、`[降级失败]` 等标签设置告警

---

## 相关文档

- [HTTP_CLIENT_CIRCUIT_BREAKER_DESIGN.md](./HTTP_CLIENT_CIRCUIT_BREAKER_DESIGN.md)
- [HTTP_CLIENT_DESIGN.md](./HTTP_CLIENT_DESIGN.md)
# 桌面端与网站数据互通实施指南

## 一、已完成工作

### 1.1 双因子认证系统 ✅
- ✅ 数据模型：TwoFactorAuth, TwoFactorAttempt
- ✅ API接口：6个完整的2FA接口
- ✅ 数据库迁移：已成功应用
- ✅ 依赖安装：pyotp, qrcode已安装

### 1.2 审计分析系统 ✅
- ✅ 审计分析脚本：security_audit_analyzer.py
- ✅ 自动化分析：每周运行一次
- ✅ 安全事件检测：暴力破解、异常登录等

### 1.3 等保文档 ✅
- ✅ 系统定级报告
- ✅ 安全管理制度
- ✅ 应急响应预案
- ✅ 合规检查清单

### 1.4 统一认证服务 ✅
- ✅ authService.ts：统一认证服务
- ✅ Token管理：自动刷新、验证
- ✅ 本地存储：Token和用户信息持久化

---

## 二、待实施工作

### 2.1 第一阶段：用户认证互通（本周）

#### 任务1：修改桌面端登录页面

**目标：** 将桌面端登录改为使用统一后端API

**实施步骤：**

1. **修改Auth.tsx页面**

```typescript
// 修改 src/pages/Auth.tsx
import { authService, LoginCredentials } from '../services/authService'

// 修改登录函数
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)
  setError('')

  try {
    const credentials: LoginCredentials = {
      username: username, // 改为用户名登录
      password: password
    }

    const result = await authService.login(credentials)

    if (result.success) {
      // 登录成功，跳转到主页面
      window.location.href = '/'
    } else {
      setError(result.error || '登录失败')
    }
  } catch (error) {
    setError('登录失败，请重试')
  } finally {
    setLoading(false)
  }
}
```

2. **修改注册页面**

```typescript
const handleRegister = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)
  setError('')

  try {
    const credentials = {
      username: username,
      email: email,
      password: password,
      privacy_agreed: true
    }

    const result = await authService.register(credentials)

    if (result.success) {
      setStep('success')
    } else {
      setError(result.error || '注册失败')
    }
  } catch (error) {
    setError('注册失败，请重试')
  } finally {
    setLoading(false)
  }
}
```

3. **添加自动登录检查**

```typescript
// 在App.tsx中添加
useEffect(() => {
  const checkAuth = async () => {
    if (authService.isAuthenticated()) {
      const isValid = await authService.validateToken()
      if (isValid) {
        // Token有效，自动登录
        setUser(authService.getCurrentUser())
      } else {
        // Token无效，清除认证信息
        authService.logout()
      }
    }
    setLoading(false)
  }

  checkAuth()
}, [])
```

#### 任务2：测试认证流程

**测试步骤：**

1. 启动后端服务器：
```bash
cd backend
python manage.py runserver
```

2. 启动桌面端：
```bash
cd desktop-client-2.0
npm run dev
```

3. 测试登录：
   - 使用网站注册的账号登录桌面端
   - 检查Token是否正确保存
   - 检查用户信息是否正确显示

4. 测试自动登录：
   - 关闭桌面端
   - 重新打开桌面端
   - 检查是否自动登录成功

---

### 2.2 第二阶段：数据同步实现（下周）

#### 任务1：创建SyncService

**目标：** 实现桌面端操作数据同步到云端

**实施步骤：**

1. **创建同步服务**

```typescript
// 创建 src/services/syncService.ts
export class SyncService {
  private syncQueue: any[] = []
  private isSyncing = false
  private syncInterval = 5 * 60 * 1000 // 5分钟

  constructor() {
    this.startPeriodicSync()
  }

  // 添加操作到同步队列
  addToQueue(operation: any) {
    this.syncQueue.push(operation)
  }

  // 批量同步到云端
  async syncBatch() {
    if (this.syncQueue.length === 0) return

    const operations = [...this.syncQueue]
    this.syncQueue = []

    try {
      const response = await authService.authenticatedFetch(
        'https://yijiandaodi.com/api/extension/sync/full/',
        {
          method: 'POST',
          body: JSON.stringify({
            session_id: `desktop_${Date.now()}`,
            device_type: 'desktop',
            operations: operations
          })
        }
      )

      if (!response.ok) {
        // 同步失败，重新加入队列
        this.syncQueue.unshift(...operations)
      }
    } catch (error) {
      console.error('同步失败:', error)
      // 同步失败，重新加入队列
      this.syncQueue.unshift(...operations)
    }
  }

  // 定期同步
  private startPeriodicSync() {
    setInterval(() => {
      if (this.syncQueue.length > 0 && !this.isSyncing) {
        this.syncBatch()
      }
    }, this.syncInterval)
  }
}

export const syncService = new SyncService()
```

2. **修改存储服务**

```typescript
// 修改 electron/services/storageService.ts
import { syncService } from '../../src/services/syncService'

export class StorageService {
  async saveOperation(operation: any) {
    // 1. 本地存储
    await this.saveToLocal(operation)

    // 2. 添加到同步队列
    syncService.addToQueue(operation)

    // 3. 重要操作立即同步
    if (this.isImportantOperation(operation)) {
      await syncService.syncBatch()
    }
  }

  private isImportantOperation(op: any): boolean {
    const importantTypes = ['delete', 'modify', 'create']
    return importantTypes.includes(op.type)
  }
}
```

#### 任务2：测试数据同步

**测试步骤：**

1. 在桌面端执行操作
2. 检查操作是否同步到云端
3. 在后台管理查看同步的数据

---

### 2.3 第三阶段：后台管理优化（第三周）

#### 任务1：创建用户设备管理页面

**实施步骤：**

1. 创建前端页面：`UserDevices.tsx`
2. 调用后端API获取用户设备列表
3. 显示设备信息和最后活跃时间
4. 添加设备登出功能

#### 任务2：创建操作记录查询页面

**实施步骤：**

1. 创建前端页面：`OperationLogs.tsx`
2. 支持按用户、时间、设备筛选
3. 支持搜索和导出
4. 显示详细的操作日志

#### 任务3：创建数据同步状态页面

**实施步骤：**

1. 创建前端页面：`SyncStatus.tsx`
2. 显示同步成功/失败状态
3. 显示待同步数据量
4. 支持手动触发同步

---

## 三、数据库迁移问题解决 ✅

**问题：** 迁移冲突（multiple leaf nodes）

**原因：** 两个迁移文件（0039和0040）没有正确的依赖关系

**解决方案：**
1. 修改了`0040_two_factor_auth_models.py`
2. 添加了正确的依赖：`('auth_app', '0039_apikey_apikeyusagelog')`
3. 执行`python manage.py migrate`成功

**结果：** ✅ 数据库迁移成功，双因子认证表已创建

---

## 四、测试清单

### 4.1 认证测试

- [ ] 网站注册新用户
- [ ] 网站登录用户
- [ ] 桌面端使用相同账号登录
- [ ] 检查Token是否正确保存
- [ ] 检查用户信息是否正确
- [ ] 测试自动登录功能
- [ ] 测试Token刷新功能
- [ ] 测试登出功能

### 4.2 数据同步测试

- [ ] 桌面端执行操作
- [ ] 检查操作是否同步到云端
- [ ] 后台查看同步的数据
- [ ] 测试离线缓存
- [ ] 测试网络恢复后自动同步

### 4.3 双因子认证测试

- [ ] 启用双因子认证
- [ ] 使用Google Authenticator扫描二维码
- [ ] 输入验证码验证
- [ ] 测试备用码
- [ ] 禁用双因子认证

---

## 五、注意事项

### 5.1 安全注意事项

1. **Token安全**
   - 不要在代码中硬编码Token
   - 使用HTTPS传输
   - Token存储在localStorage（考虑加密）

2. **密码安全**
   - 密码强度要求（至少8位，包含数字和字母）
   - 不要明文存储密码
   - 使用HTTPS传输

3. **API安全**
   - 所有API调用使用认证头部
   - 敏感操作添加二次验证
   - 频率限制防止暴力破解

### 5.2 性能注意事项

1. **数据同步**
   - 批量同步而不是单个同步
   - 离线时缓存数据
   - 网络恢复后自动同步

2. **Token验证**
   - 不要每次操作都验证Token
   - 使用本地缓存减少网络请求
   - Token过期前主动刷新

### 5.3 用户体验注意事项

1. **登录流程**
   - 提供清晰的错误提示
   - 记住用户名（不记住密码）
   - 支持多种登录方式

2. **同步状态**
   - 显示同步状态图标
   - 提供手动同步按钮
   - 显示待同步数据数量

---

## 六、后续优化建议

### 6.1 短期优化（本周）

1. **完善认证流程**
   - 添加"记住我"功能
   - 添加忘记密码功能
   - 添加邮箱验证功能

2. **优化用户界面**
   - 改进登录页面设计
   - 添加加载动画
   - 优化错误提示

### 6.2 中期优化（下周）

1. **数据同步优化**
   - 增量同步机制
   - 冲突解决策略
   - 同步性能优化

2. **安全增强**
   - 实现双因子认证
   - 添加登录设备管理
   - 异常登录检测

### 6.3 长期优化（持续）

1. **功能扩展**
   - 多设备同步
   - 数据导出功能
   - 第三方登录集成

2. **性能优化**
   - 缓存策略优化
   - 数据库查询优化
   - 网络请求优化

---

**创建时间：** 2025年1月29日
**更新时间：** 2025年1月29日
**负责人：** AI助手
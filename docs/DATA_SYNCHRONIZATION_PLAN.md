# 一鉴到底数据互通方案

## 一、现状分析

### 1.1 系统架构

**网站端（Web）：**
- 技术：React + TypeScript + Vite
- 认证：JWT Token（存储在Cookie）
- 数据存储：PostgreSQL数据库
- 访问方式：浏览器

**桌面端（Desktop）：**
- 技术：Electron + React + TypeScript
- 认证：本地存储Token
- 数据存储：本地JSON文件（operations.json）
- 访问方式：桌面应用

**后端API：**
- 技术：Django REST Framework
- 数据库：PostgreSQL（生产）/ SQLite（开发）
- 认证：JWT + Cookie双重认证
- API Key认证：支持

### 1.2 数据同步问题

**当前问题：**
1. 网站注册/登录后，桌面端无法自动同步用户信息
2. 桌面端操作记录仅存储在本地，无法同步到云端
3. 后台管理系统无法查看桌面端用户数据
4. 用户在网站和桌面端的操作数据不互通

---

## 二、数据互通方案

### 2.1 用户认证互通

#### 2.1.1 实现方案

**方案：共享JWT Token**

**流程：**
```
1. 网站登录成功 → 获取JWT Token
2. 桌面端打开 → 检查本地Token
3. Token有效 → 自动登录
4. Token无效 → 跳转登录页面
5. 桌面端登录 → 使用同一API接口
```

**技术实现：**

1. **桌面端登录接口：**
```typescript
// desktop-client-2.0/src/pages/Auth.tsx
async function handleLogin(username: string, password: string) {
  const response = await fetch('https://yijiandaodi.com/api/auth/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include' // 包含Cookie
  });
  
  if (response.ok) {
    const data = await response.json();
    // 保存认证信息到本地
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    return data;
  }
}
```

2. **Token验证：**
```typescript
// 每次启动时验证Token
async function validateToken() {
  const token = localStorage.getItem('token');
  if (!token) return false;
  
  const response = await fetch('https://yijiandaodi.com/api/auth/verify/', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.ok;
}
```

### 2.2 操作数据同步

#### 2.2.1 同步架构

**数据流：**
```
桌面端操作 → 本地存储 → 异步同步到云端 → 数据库存储 → 后台管理查看
```

**同步策略：**
- **实时同步：** 重要操作立即同步
- **批量同步：** 普通操作每5分钟批量同步
- **离线缓存：** 网络不可用时本地缓存，恢复后自动同步
- **冲突解决：** 使用时间戳和版本号解决冲突

#### 2.2.2 API接口复用

**现有API：**
- ✅ `/api/extension/sync/start/` - 开始录制同步
- ✅ `/api/extension/sync/operation/` - 操作同步
- ✅ `/api/extension/sync/end/` - 停止录制同步
- ✅ `/api/extension/sync/full/` - 完整同步
- ✅ `/api/extension/sessions/` - 获取会话列表

**适配方案：**
桌面端复用浏览器插件的同步API，修改设备类型标识。

#### 2.2.3 桌面端同步实现

**1. 创建同步服务：**

```typescript
// desktop-client-2.0/electron/services/syncService.ts
export class SyncService {
  private apiUrl = 'https://yijiandaodi.com/api/extension';
  private token: string | null = null;
  private syncQueue: OperationRecord[] = [];
  private isSyncing = false;

  constructor() {
    this.loadToken();
    this.startPeriodicSync();
  }

  private loadToken() {
    this.token = localStorage.getItem('token');
  }

  // 同步单个操作
  async syncOperation(operation: OperationRecord): Promise<boolean> {
    if (!this.token) return false;

    try {
      const response = await fetch(`${this.apiUrl}/sync/operation/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          session_id: operation.session_id,
          operations: [{
            operation_type: operation.type,
            platform: operation.platform,
            title: operation.title,
            url: operation.url,
            content_preview: operation.content_preview,
            timestamp: operation.timestamp,
            fingerprint: operation.fingerprint
          }]
        })
      });

      return response.ok;
    } catch (error) {
      console.error('同步失败:', error);
      return false;
    }
  }

  // 批量同步
  async syncBatch(operations: OperationRecord[]): Promise<boolean> {
    if (!this.token || operations.length === 0) return false;

    try {
      const response = await fetch(`${this.apiUrl}/sync/full/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          session_id: `desktop_${Date.now()}`,
          device_type: 'desktop',
          operations: operations.map(op => ({
            operation_type: op.type,
            platform: op.platform,
            title: op.title,
            url: op.url,
            content_preview: op.content_preview,
            timestamp: op.timestamp,
            fingerprint: op.fingerprint
          }))
        })
      });

      return response.ok;
    } catch (error) {
      console.error('批量同步失败:', error);
      return false;
    }
  }

  // 定期同步（每5分钟）
  private startPeriodicSync() {
    setInterval(async () => {
      if (this.syncQueue.length > 0 && !this.isSyncing) {
        this.isSyncing = true;
        const operations = [...this.syncQueue];
        this.syncQueue = [];
        
        const success = await this.syncBatch(operations);
        
        if (!success) {
          // 同步失败，重新加入队列
          this.syncQueue.unshift(...operations);
        }
        
        this.isSyncing = false;
      }
    }, 5 * 60 * 1000); // 5分钟
  }

  // 添加到同步队列
  addToQueue(operation: OperationRecord) {
    this.syncQueue.push(operation);
  }
}
```

**2. 修改存储服务：**

```typescript
// desktop-client-2.0/electron/services/storageService.ts
import { SyncService } from './syncService';

export class StorageService {
  private syncService: SyncService;

  constructor() {
    this.syncService = new SyncService();
  }

  async saveOperation(operation: OperationRecord) {
    // 1. 本地存储
    await this.saveToLocal(operation);
    
    // 2. 添加到同步队列
    this.syncService.addToQueue(operation);
    
    // 3. 重要操作立即同步
    if (this.isImportantOperation(operation)) {
      await this.syncService.syncOperation(operation);
    }
    
    return { success: true };
  }

  private isImportantOperation(op: OperationRecord): boolean {
    // 判断是否为重要操作（如删除、修改敏感信息等）
    const importantTypes = ['delete', 'modify', 'create'];
    return importantTypes.includes(op.type);
  }
}
```

### 2.3 后台管理数据查看

#### 2.3.1 数据展示优化

**需要添加的页面：**

1. **用户设备管理页面**
   - 显示用户在不同设备上的登录状态
   - 显示设备信息和最后活跃时间
   - 支持设备登出功能

2. **操作记录查询页面**
   - 按用户、时间、设备筛选操作记录
   - 支持搜索和导出
   - 显示详细的操作日志

3. **数据同步状态页面**
   - 显示同步成功/失败状态
   - 显示待同步数据量
   - 支持手动触发同步

#### 2.3.2 API接口扩展

**新增接口：**

```python
# backend/auth_app/views.py

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_devices(request):
    """获取用户所有设备"""
    devices = ExtensionSession.objects.filter(
        user=request.user
    ).values('device_id', 'extension_version', 'last_sync').distinct()
    
    return Response({
        'success': True,
        'devices': list(devices)
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_operations(request):
    """获取用户操作记录"""
    session_id = request.query_params.get('session_id')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    operations = ExtensionOperation.objects.filter(
        session__user=request.user
    )
    
    if session_id:
        operations = operations.filter(session__session_id=session_id)
    
    if start_date:
        operations = operations.filter(timestamp__gte=start_date)
    
    if end_date:
        operations = operations.filter(timestamp__lte=end_date)
    
    # 分页
    page = paginate_queryset(operations, request)
    
    serializer = ExtensionOperationSerializer(page, many=True)
    
    return Response({
        'success': True,
        'count': operations.count(),
        'results': serializer.data
    })
```

---

## 三、实施步骤

### 3.1 第一阶段：用户认证互通（本周）

**任务：**
1. ✅ 桌面端实现登录接口调用
2. ✅ 实现Token验证机制
3. ✅ 实现自动登录功能
4. ✅ 测试认证流程

**预期效果：**
- 网站登录后，桌面端自动识别用户
- 桌面端登录后，网站端也能识别
- Token过期自动跳转登录

### 3.2 第二阶段：数据同步实现（下周）

**任务：**
1. ✅ 创建SyncService同步服务
2. ✅ 修改StorageService添加同步逻辑
3. ✅ 实现批量同步机制
4. ✅ 实现离线缓存和恢复同步
5. ✅ 测试数据同步流程

**预期效果：**
- 桌面端操作自动同步到云端
- 网络中断不影响本地使用
- 恢复网络后自动同步

### 3.3 第三阶段：后台管理优化（第三周）

**任务：**
1. ✅ 创建用户设备管理页面
2. ✅ 创建操作记录查询页面
3. ✅ 创建数据同步状态页面
4. ✅ 优化数据展示和筛选
5. ✅ 测试后台管理功能

**预期效果：**
- 后台可查看所有用户数据
- 支持多维度筛选和导出
- 显示数据同步状态

---

## 四、数据安全考虑

### 4.1 数据加密

- **传输加密：** 全程使用HTTPS
- **存储加密：** 敏感数据AES加密
- **Token安全：** JWT签名验证

### 4.2 权限控制

- **用户隔离：** 用户只能访问自己的数据
- **设备验证：** 验证设备合法性
- **操作审计：** 记录所有同步操作

### 4.3 异常处理

- **网络异常：** 本地缓存，自动重试
- **同步冲突：** 时间戳优先，用户确认
- **数据丢失：** 定期备份，快速恢复

---

## 五、性能优化

### 5.1 同步优化

- **增量同步：** 只同步变化的数据
- **压缩传输：** 大数据压缩后传输
- **并发控制：** 控制同步并发数

### 5.2 存储优化

- **分表存储：** 按时间分表提高查询效率
- **索引优化：** 建立合适的索引
- **定期清理：** 清理过期数据

---

## 六、监控与告警

### 6.1 同步监控

- **同步成功率：** 监控同步成功率
- **同步延迟：** 监控同步延迟时间
- **失败告警：** 同步失败及时告警

### 6.2 性能监控

- **API响应时间：** 监控API响应时间
- **数据库查询：** 监控慢查询
- **并发数：** 监控系统并发数

---

## 七、总结

通过本方案的实施，将实现：

1. ✅ 网站与桌面端用户认证互通
2. ✅ 操作数据实时同步到云端
3. ✅ 后台管理可查看所有数据
4. ✅ 数据安全和隐私保护
5. ✅ 高性能和高可用性

预计在3周内完成所有功能开发和测试，实现完整的数据互通体系。

---

**创建时间：** 2025年1月29日
**更新时间：** 2025年1月29日
**负责人：** AI助手
# Web端与桌面端数据打通方案

## 一、现状分析

### 1.1 当前架构

**Web端**：
- 技术栈：React 18 + TypeScript + Vite
- 部署：`http://localhost:3000`（开发）/ 生产域名
- API调用：相对路径 `/api/...` → Nginx代理到后端

**桌面端**：
- 技术栈：Electron 28 + React 18
- 安装包：`desktop-client-2.0`
- API调用：`http://localhost:9092/api` → 直连本地后端

**后端**：
- 技术栈：Django 4.2 + DRF + SQLite
- 端口：9092（本地开发）
- 认证：JWT Token + Cookie

### 1.2 数据打通的关键问题

**问题1：API端点不统一**
- Web端：`/api/agent/identities/`
- 桌面端：`http://localhost:9092/api/agent/identities/`

**问题2：用户认证状态不同步**
- Web端登录后，桌面端需要重新登录
- Token无法跨端共享

**问题3：海马体记忆数据同步**
- 短期记忆：实时监控数据需要跨端同步
- 长期记忆：历史审计记录需要跨端查询
- 策略记忆：安全策略需要跨端生效

---

## 二、数据打通方案（核心）

### 2.1 方案设计原则

1. **单一后端**：Web端和桌面端共享同一个后端API
2. **统一认证**：JWT Token跨端共享，一次登录全局有效
3. **数据同步**：通过API实现数据实时同步，不依赖第三方中间件
4. **离线可用**：桌面端支持离线缓存，网络恢复后自动同步

### 2.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│  用户（同一账号）                                             │
└─────────────┬───────────────────────────────┬───────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐       ┌─────────────────────────┐
│  Web端                   │       │  桌面端                 │
│  (React + Vite)          │       │  (Electron)             │
│                          │       │                          │
│  - localStorage         │       │  - localStorage         │
│  - Cookie               │       │  - Cookie               │
│  - JWT Token            │       │  - JWT Token            │
└─────────────┬────────────┘       └─────────────┬───────────┘
              │                                 │
              │  API调用                         │  API调用
              │  /api/...                        │  http://backend/api/...
              │                                 │
              └─────────────┬───────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  Django Backend         │
              │  (localhost:9092)       │
              │                         │
              │  - JWT认证              │
              │  - SQLite数据库         │
              │  - 海马体记忆模型        │
              └─────────────┬───────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  海马体记忆数据库        │
              │  - ShortTermMemory      │
              │  - LongTermMemory       │
              │  - StrategicMemory      │
              └─────────────────────────┘
```

---

## 三、具体实现方案

### 3.1 统一API端点

**方案**：桌面端动态获取后端地址

**实现**：
```typescript
// desktop-client-2.0/src/config/apiConfig.ts

export class APIConfig {
  private static instance: APIConfig;
  private baseURL: string;

  private constructor() {
    // 1. 优先从配置文件读取（生产环境）
    const configBaseURL = localStorage.getItem('api_base_url');

    // 2. 其次检测本地开发后端
    if (configBaseURL) {
      this.baseURL = configBaseURL;
    } else if (this.isLocalBackendRunning()) {
      this.baseURL = 'http://localhost:9092';
    } else {
      // 3. 默认使用生产后端
      this.baseURL = 'https://your-production-domain.com';
    }
  }

  static getInstance(): APIConfig {
    if (!APIConfig.instance) {
      APIConfig.instance = new APIConfig();
    }
    return APIConfig.instance;
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  setBaseURL(url: string): void {
    this.baseURL = url;
    localStorage.setItem('api_base_url', url);
  }

  private async isLocalBackendRunning(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:9092/health', {
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// 使用示例
const apiConfig = APIConfig.getInstance();
const API_BASE = apiConfig.getBaseURL();
```

**优势**：
- 自动检测本地后端，开发环境无需手动配置
- 支持切换到生产后端
- 配置持久化，重启应用后仍然有效

### 3.2 跨端认证同步

**方案A：共享JWT Token（推荐）**

**实现步骤**：
1. Web端登录成功后，返回JWT Token和refresh_token
2. Token存储在localStorage（Web端）和localStorage（桌面端）
3. 桌面端启动时，检查localStorage中是否有有效Token
4. 如果有Token，自动验证并登录

**核心代码**：

```typescript
// backend/auth_app/views.py - 登录视图

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        user = authenticate(username=username, password=password)
        if not user:
            return Response({'error': '用户名或密码错误'}, status=401)

        # 生成JWT Token
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        # 返回用户信息和Token
        return Response({
            'success': True,
            'data': {
                'token': access_token,
                'refresh_token': refresh_token,
                'expires_in': 3600,  # 1小时
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'role': user.role
                }
            }
        })


// desktop-client-2.0/src/services/authService.ts - 桌面端认证

import { APIConfig } from '@/config/apiConfig';

export class AuthService {
  private static instance: AuthService;
  private token: string | null = null;
  private user: any = null;

  private constructor() {
    this.loadStoredAuth();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // 从localStorage加载认证信息
  private loadStoredAuth() {
    try {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');

      if (storedToken && storedUser) {
        this.token = storedToken;
        this.user = JSON.parse(storedUser);
      }
    } catch (error) {
      console.error('加载认证信息失败:', error);
    }
  }

  // 用户登录
  async login(username: string, password: string): Promise<AuthResponse> {
    const apiConfig = APIConfig.getInstance();
    const baseURL = apiConfig.getBaseURL();

    const response = await fetch(`${baseURL}/api/auth/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // 包含Cookie
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // 保存认证信息到localStorage
      this.token = data.data.token;
      this.user = data.data.user;
      localStorage.setItem('auth_token', data.data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.data.user));
      localStorage.setItem('refresh_token', data.data.refresh_token);

      return data;
    } else {
      throw new Error(data.error || '登录失败');
    }
  }

  // 验证Token是否有效
  async validateToken(): Promise<boolean> {
    if (!this.token) {
      return false;
    }

    const apiConfig = APIConfig.getInstance();
    const baseURL = apiConfig.getBaseURL();

    try {
      const response = await fetch(`${baseURL}/api/auth/verify/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Token验证失败:', error);
      return false;
    }
  }

  // 获取当前用户信息
  getCurrentUser() {
    return this.user;
  }

  // 检查是否已登录
  isAuthenticated() {
    return !!this.token && !!this.user;
  }
}

export const authService = AuthService.getInstance();
```

**方案B：Web端跳转桌面端自动登录（备选）**

**实现步骤**：
1. Web端生成一次性登录Token（有效期5分钟）
2. 桌面端通过URL参数接收Token
3. 桌面端使用Token换取正式JWT Token

**核心代码**：
```typescript
// Web端 - 生成一次性Token
const openDesktopApp = async () => {
  // 调用后端生成一次性Token
  const response = await fetch('/api/auth/generate-onetime-token/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    }
  });

  const data = await response.json();

  // 使用自定义协议打开桌面端
  window.location.href = `yijiandaodi://auth?token=${data.onetime_token}`;
};


// 桌面端 - 处理URL参数
import { app, BrowserWindow } from 'electron';

app.on('open-url', (event, url) => {
  const token = new URL(url).searchParams.get('token');

  if (token) {
    // 使用一次性Token换取正式Token
    authService.loginWithOneTimeToken(token);
  }
});
```

**推荐方案A**，因为：
- 实现简单，无需自定义协议
- Token共享更直接
- 用户体验更好

### 3.3 海马体记忆数据同步

**数据同步架构**：

```
┌─────────────────────────────────────────────────────────────┐
│  海马体记忆系统（后端）                                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ShortTermMemory (短期记忆)                          │   │
│  │  - 实时行为监控                                       │   │
│  │  - 30分钟自动过期                                     │   │
│  │  - WebSocket推送（可选）                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  LongTermMemory (长期记忆)                           │   │
│  │  - 历史审计记录                                       │   │
│  │  - 五元组链式存证                                     │   │
│  │  - REST API查询                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  StrategicMemory (策略记忆)                          │   │
│  │  - 安全策略知识库                                     │   │
│  │  - 策略版本演进                                       │   │
│  │  - REST API管理                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ REST API + WebSocket（可选）
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌──────────────────┐      ┌──────────────────┐
│  Web端            │      │  桌面端          │
│                  │      │                  │
│  - 实时监控      │      │  - 本地缓存      │
│  - 历史查询      │      │  - 离线可用      │
│  - 策略配置      │      │  - 自动同步      │
└──────────────────┘      └──────────────────┘
```

**具体实现**：

**1. 短期记忆实时同步（WebSocket可选）**

**方案A：轮询方式（简单，推荐）**
```typescript
// desktop-client-2.0/src/services/memoryApi.ts

export class ShortTermMemorySync {
  private static instance: ShortTermMemorySync;
  private syncInterval: number = 5000; // 5秒同步一次
  private timer: NodeJS.Timeout | null = null;

  // 开始同步
  startSync() {
    if (this.timer) return;

    this.timer = setInterval(async () => {
      await this.syncMemory();
    }, this.syncInterval);
  }

  // 停止同步
  stopSync() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // 同步短期记忆
  private async syncMemory() {
    try {
      const response = await authService.authenticatedFetch(
        `${API_BASE}/api/v1/memory/short-term/?limit=100`
      );

      const data = await response.json();

      // 更新本地缓存
      localStorage.setItem('short_term_memory', JSON.stringify(data.results));
    } catch (error) {
      console.error('短期记忆同步失败:', error);
    }
  }
}
```

**方案B：WebSocket推送（实时性更好）**
```typescript
// backend - WebSocket配置

from channels.generic.websocket import AsyncWebsocketConsumer
import json

class MemorySyncConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if self.scope["user"].is_anonymous:
            await self.close()
        else:
            await self.channel_layer.group_add(
                f"user_{self.scope['user'].id}",
                self.channel_name
            )
            await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            f"user_{self.scope['user'].id}",
            self.channel_name
        )

    async def memory_update(self, event):
        # 推送短期记忆更新
        await self.send(text_data=json.dumps({
            'type': 'memory_update',
            'data': event['data']
        }))


// desktop-client-2.0 - WebSocket连接

export class WebSocketMemorySync {
  private ws: WebSocket | null = null;

  connect(token: string) {
    this.ws = new WebSocket(`ws://localhost:9092/ws/memory/?token=${token}`);

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'memory_update') {
        // 更新本地短期记忆
        this.updateLocalMemory(data.data);
      }
    };
  }

  private updateLocalMemory(data: any) {
    const cached = localStorage.getItem('short_term_memory');
    const memories = cached ? JSON.parse(cached) : [];
    memories.unshift(data);
    localStorage.setItem('short_term_memory', JSON.stringify(memories.slice(0, 100)));
  }
}
```

**推荐方案A**，因为：
- 实现简单，无需额外依赖
- 5秒延迟对用户体验影响小
- 降低服务器压力

**2. 长期记忆跨端查询**

```typescript
// desktop-client-2.0/src/services/memoryApi.ts

export const memoryApi = {
  // 查询长期记忆（支持缓存）
  getLongTermMemory: async (params?: any) => {
    // 1. 检查本地缓存
    const cacheKey = `long_term_memory_${JSON.stringify(params || {})}`;
    const cached = CacheService.get(cacheKey);

    if (cached) {
      return cached;
    }

    // 2. 从后端获取
    const response = await authService.authenticatedFetch(
      `${API_BASE}/api/v1/memory/long-term/?${new URLSearchParams(params)}`
    );

    const data = await response.json();

    // 3. 缓存数据（5分钟）
    CacheService.set(cacheKey, data, 5 * 60 * 1000);

    return data;
  },

  // 导出审计报告（离线可用）
  exportAuditReport: async (filters: any) => {
    const response = await authService.authenticatedFetch(
      `${API_BASE}/api/v1/memory/long-term/export/`,
      {
        method: 'POST',
        body: JSON.stringify(filters)
      }
    );

    // 保存到本地文件
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_report_${new Date().toISOString()}.pdf`;
    a.click();
  }
};
```

**3. 策略记忆跨端生效**

```typescript
// desktop-client-2.0/src/services/strategyService.ts

export class StrategySync {
  private static instance: StrategySync;

  // 获取最新策略（启动时加载）
  async loadStrategies() {
    const response = await authService.authenticatedFetch(
      `${API_BASE}/api/v1/memory/strategic/?is_active=true`
    );

    const data = await response.json();

    // 保存到本地
    localStorage.setItem('strategies', JSON.stringify(data.results));

    return data.results;
  }

  // 应用策略到本地检测引擎
  applyStrategies(strategies: any[]) {
    // 更新本地检测规则
    strategies.forEach(strategy => {
      if (strategy.strategy_type === 'detection_rule') {
        this.updateDetectionRule(strategy);
      } else if (strategy.strategy_type === 'threshold') {
        this.updateThreshold(strategy);
      }
    });
  }

  private updateDetectionRule(strategy: any) {
    // 更新本地规则引擎
    console.log(`[策略更新] ${strategy.rule_name}: ${strategy.rule_action}`);
  }

  private updateThreshold(strategy: any) {
    // 更新阈值配置
    console.log(`[阈值更新] ${strategy.rule_name}: ${strategy.rule_condition}`);
  }
}
```

### 3.4 离线缓存策略

**核心思路**：桌面端支持离线查看历史数据

```typescript
// desktop-client-2.0/src/services/cacheService.ts

export class CacheService {
  private static instance: CacheService;

  // 设置缓存
  static set(key: string, data: any, duration: number) {
    const cacheData = {
      data,
      timestamp: Date.now(),
      expires: Date.now() + duration
    };

    localStorage.setItem(key, JSON.stringify(cacheData));
  }

  // 获取缓存
  static get(key: string): any | null {
    const cached = localStorage.getItem(key);

    if (!cached) {
      return null;
    }

    try {
      const cacheData = JSON.parse(cached);

      // 检查是否过期
      if (Date.now() > cacheData.expires) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      return null;
    }
  }

  // 后台同步（网络恢复后）
  static async syncOnOnline() {
    window.addEventListener('online', async () => {
      console.log('[网络恢复] 开始同步缓存数据...');

      // 同步短期记忆
      await ShortTermMemorySync.getInstance().syncMemory();

      // 同步策略
      await StrategySync.getInstance().loadStrategies();

      console.log('[同步完成] 所有数据已更新');
    });
  }
}
```

---

## 四、数据同步时序图

```
用户登录 → Web端                   桌面端
    │         │                      │
    │         ├─ POST /auth/login/   │
    │         │                      │
    │         ├─ 返回 JWT Token      │
    │         │                      │
    │         ├─ localStorage存储    │
    │         │                      │
    │         └──────────────────────┤
    │                                │
    │                                ├─ 启动应用
    │                                │
    │                                ├─ 检查localStorage
    │                                │
    │                                ├─ 发现Token
    │                                │
    │                                ├─ 验证Token有效性
    │                                │
    │                                ├─ Token有效，自动登录
    │                                │
    │                                ├─ 加载海马体记忆
    │                                │   ├─ 短期记忆（轮询）
    │                                │   ├─ 长期记忆（查询）
    │                                │   └─ 策略记忆（加载）
    │                                │
    │                                └─ 用户开始使用桌面端
    │
    └─ 数据实时同步
        ├─ Web端操作 → 后端 → 桌面端轮询更新
        └─ 桌面端操作 → 后端 → Web端刷新看到
```

---

## 五、实施计划

### 阶段1：API统一（1天）
- [ ] 实现APIConfig动态获取后端地址
- [ ] 统一Web端和桌面端的API调用方式
- [ ] 测试跨端API调用

### 阶段2：认证同步（2天）
- [ ] 实现JWT Token跨端共享
- [ ] 桌面端自动登录功能
- [ ] Token刷新机制

### 阶段3：海马体记忆数据模型（2天）
- [ ] 创建ShortTermMemory模型
- [ ] 创建LongTermMemory模型
- [ ] 创建StrategicMemory模型

### 阶段4：数据同步功能（2天）
- [ ] 实现短期记忆轮询同步
- [ ] 实现长期记忆缓存查询
- [ ] 实现策略记忆自动加载

### 阶段5：桌面端界面集成（2天）
- [ ] 桌面端Dashboard集成用户信息
- [ ] 桌面端Evidence集成历史记忆
- [ ] 桌面端Settings集成策略管理

---

## 六、关键代码文件清单

**后端（Django）**：
- `backend/auth_app/views.py` - 登录视图（返回JWT Token）
- `backend/auth_app/memory_models.py` - 海马体记忆模型（待创建）
- `backend/auth_app/memory_views.py` - 记忆API视图（待创建）
- `backend/auth_app/memory_urls.py` - 记忆API路由（待创建）

**桌面端（Electron）**：
- `desktop-client-2.0/src/config/apiConfig.ts` - API配置（待创建）
- `desktop-client-2.0/src/services/authService.ts` - 认证服务（已存在，需更新）
- `desktop-client-2.0/src/services/memoryApi.ts` - 记忆API（待创建）
- `desktop-client-2.0/src/services/cacheService.ts` - 缓存服务（待创建）
- `desktop-client-2.0/src/services/strategyService.ts` - 策略同步（待创建）

**Web端（React）**：
- `frontend/src/api/authApi.ts` - 认证API（已存在）
- `frontend/src/api/memoryApi.ts` - 记忆API（待创建）

---

## 七、总结

**核心优势**：
1. **零新增依赖**：基于现有JWT + localStorage，无需Redis或其他中间件
2. **跨端无缝同步**：Web端和桌面端共享同一后端，数据实时同步
3. **离线可用**：桌面端支持离线缓存，网络恢复后自动同步
4. **安全可靠**：JWT Token安全存储，自动刷新机制

**关键技术点**：
- JWT Token跨端共享（localStorage）
- API端点动态配置（自动检测本地后端）
- 短期记忆轮询同步（5秒间隔）
- 长期记忆缓存查询（5分钟有效期）
- 策略记忆自动加载（启动时同步）

**下一步行动**：
确认方案后，我将按照实施计划逐步开发，先完成API统一和认证同步，再实现海马体记忆系统。
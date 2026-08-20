# WebSocket实时告警推送集成方案

## 快速开始

### 1. 系统架构

```
桌面端客户端 (Electron)
    ↓ WebSocket连接
Django Channels (WebSocket服务)
    ↓ 触发风险评估
风险评估服务 (RiskAssessmentService)
    ↓ 判断是否告警
告警服务 (AlertService)
    ↓ WebSocket推送
桌面端客户端 (实时显示)
```

### 2. 核心组件

**已完成的组件**:

1. **Agent身份模型** (`agent_identity_models.py`)
   - AgentIdentity：Agent身份认证
   - API Key生成和验证
   - 信任级别管理

2. **风险评估服务** (`risk_assessment_service.py`)
   - 信任级别动态阈值调整
   - 权限越权风险加成
   - Agent身份集成

3. **告警服务** (`alert_service.py`)
   - 告警触发逻辑
   - WebSocket推送集成
   - Agent身份信息展示

4. **WebSocket消费者** (`agent_activity_consumers.py`)
   - 实时告警推送
   - 心跳机制
   - 连接管理

5. **风险评估API** (`risk_assessment_views.py`)
   - 独立的REST API接口
   - 支持手动触发告警
   - 批量风险评估

### 3. 工作流程

#### 自动流程（推荐）

```python
# 桌面端上报活动日志（自动触发风险评估）
response = requests.post(
    'http://localhost:9092/api/agent-activities/batch/',
    json={
        'activities': [
            {
                'agent_type': 'claude',
                'action': 'file_operation',
                'target': '/sensitive/data.py',
                'risk_score': 75,
                'client_id': 'client_001',
                # ...
            }
        ]
    },
    headers={'X-API-Key': 'agent_api_key'}
)

# 后端自动处理：
# 1. API Key认证 → 关联Agent身份
# 2. 创建活动日志（包含agent外键）
# 3. 触发风险评估（动态阈值调整）
# 4. 判断是否触发告警
# 5. WebSocket实时推送告警
```

#### 手动流程

```python
# 通过API手动触发告警
response = requests.post(
    'http://localhost:9092/api/risk-assessment/alerts/trigger/',
    json={
        'activity_id': 'act_xxx',
        'force': False
    }
)
```

### 4. 客户端集成

#### JavaScript示例

```javascript
// 连接WebSocket
const ws = new WebSocket('ws://localhost:9092/ws/agent-alerts/client_001/');

// 监听告警
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'alert') {
        const alert = data.data;
        console.log('收到告警:', alert);
        
        // 显示通知
        new Notification(`${alert.risk_level.toUpperCase()}风险`, {
            body: `${alert.agent.name}: ${alert.action}`
        });
    }
};

// 发送心跳（保持连接）
setInterval(() => {
    ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
}, 30000);
```

### 5. 测试方法

#### 测试WebSocket服务

```bash
python test_e2e_realtime_alert.py --test-service
```

#### 运行端到端测试

```bash
python test_e2e_realtime_alert.py
```

#### 演示实时推送

```bash
python websocket_realtime_demo.py
```

### 6. 部署要求

#### 必需依赖

```bash
# 安装依赖
pip install channels channels-redis websockets

# 启动Redis（用于Channel Layer）
redis-server

# 启动ASGI服务器
daphne -b 0.0.0.0 -p 9092 fangdudu_backend.asgi:application
```

#### Django配置

```python
# settings.py
INSTALLED_APPS = [
    # ...
    'channels',
]

ASGI_APPLICATION = 'fangdudu_backend.asgi.application'

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("127.0.0.1", 6379)],
        },
    },
}
```

### 7. 文档索引

- **完整集成指南**: [WEBSOCKET_REALTIME_INTEGRATION.md](./WEBSOCKET_REALTIME_INTEGRATION.md)
- **风险评估API文档**: [RISK_ASSESSMENT_API_DOCS.md](./RISK_ASSESSMENT_API_DOCS.md)
- **Agent身份管理**: `agent_identity_models.py`
- **风险评估逻辑**: `risk_assessment_service.py`
- **WebSocket消费者**: `agent_activity_consumers.py`

### 8. 核心特性

✅ **身份可信层**
- Agent身份认证（API Key）
- 信任级别动态管理
- 权限粒度控制

✅ **风险评估增强**
- 信任级别动态阈值调整
- 权限越权自动加成
- Agent身份信息集成

✅ **实时告警推送**
- WebSocket实时推送
- 告警信息包含Agent身份
- 心跳机制保持连接

✅ **独立API接口**
- REST API风险评估
- 手动触发告警
- 批量评估支持

### 9. 性能优化建议

1. **批量上报活动**：累积100个或间隔5秒上报一次
2. **WebSocket连接池**：复用WebSocket连接
3. **心跳机制**：30秒发送一次心跳保持连接
4. **缓存清理**：定期清理风险评估缓存

### 10. 故障排查

**WebSocket连接失败**：
- 检查Django Channels配置
- 确认Redis是否启动
- 验证ASGI服务器是否运行

**告警未触发**：
- 检查Agent身份是否关联
- 验证风险分数是否达到阈值
- 查看风险评估日志

**推送未收到**：
- 确认client_id匹配
- 检查WebSocket连接状态
- 验证Channel Layer配置

---

**完整的WebSocket实时告警推送系统已就绪！**

运行测试验证：
```bash
python test_e2e_realtime_alert.py --test-service
python test_e2e_realtime_alert.py
```
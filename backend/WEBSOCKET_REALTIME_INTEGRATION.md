# WebSocket实时告警推送集成指南

## 架构说明

```
┌─────────────────┐
│  桌面端客户端    │
│  (Electron)     │
└────────┬────────┘
         │ WebSocket连接
         ↓
┌─────────────────┐
│  Django Channels│
│  (WebSocket)    │
└────────┬────────┘
         │ 触发风险评估
         ↓
┌─────────────────┐
│  风险评估服务    │
│  (RiskAssess)   │
└────────┬────────┘
         │ 判断是否告警
         ↓
┌─────────────────┐
│  告警服务        │
│  (AlertService) │
└────────┬────────┘
         │ WebSocket推送
         ↓
┌─────────────────┐
│  桌面端客户端    │
│  显示告警       │
└─────────────────┘
```

## 完整工作流程

### 1. Agent活动上报

```python
# 桌面端上报Agent活动
import requests

# 批量上报活动日志
response = requests.post(
    'http://localhost:9092/api/agent-activities/batch/',
    json={
        'activities': [
            {
                'agent_type': 'claude',
                'action': 'file_operation',
                'target': '/sensitive/data.py',
                'risk_level': 'high',
                'risk_score': 75,
                'session_id': 'session_abc',
                'client_id': 'client_001',
                # ... 其他字段
            }
        ]
    },
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': 'your_agent_api_key'  # Agent身份认证
    }
)
```

**后端处理流程**:
1. `agent_activity_views.py`接收请求
2. API Key认证（如果提供）
3. 自动关联Agent身份（`request.agent`）
4. 创建活动日志（包含`agent`外键）
5. **自动触发风险评估**
6. 如果触发告警，立即WebSocket推送

### 2. 自动风险评估触发

在`agent_activity_views.py`中：

```python
# 创建活动后，自动触发风险评估
for activity in created_activities:
    # 执行风险评估
    result = RiskAssessmentService.assess_activity(activity)
    
    # 如果需要告警，触发并推送
    if result.should_alert:
        AlertService.handle_alert(activity, result)
```

### 3. WebSocket实时推送

在`alert_service.py`中：

```python
@classmethod
def _push_alert(cls, alert_data: Dict[str, Any]):
    """WebSocket推送告警到桌面端"""
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    
    channel_layer = get_channel_layer()
    
    if channel_layer:
        # 推送到指定client_id的频道组
        async_to_sync(channel_layer.group_send)(
            f"agent_alerts_{alert_data['client_id']}",
            {
                'type': 'alert_message',  # 对应消费者的方法名
                'data': alert_data
            }
        )
```

### 4. WebSocket消费者处理

在`agent_activity_consumers.py`中：

```python
async def alert_message(self, event):
    """处理告警消息"""
    alert_data = event['data']
    
    # 发送告警到WebSocket客户端
    await self.send(text_data=json.dumps({
        'type': 'alert',
        'data': alert_data
    }))
```

## 客户端集成

### JavaScript/Electron客户端

```javascript
// WebSocket客户端封装
class AgentAlertClient {
    constructor(clientId) {
        this.clientId = clientId;
        this.wsUrl = `ws://localhost:9092/ws/agent-alerts/${clientId}/`;
        this.websocket = null;
        this.callbacks = {
            'connection_established': [],
            'alert': [],
            'error': []
        };
    }

    // 连接WebSocket
    connect() {
        this.websocket = new WebSocket(this.wsUrl);

        this.websocket.onopen = () => {
            console.log('[WebSocket] 连接成功');
        };

        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.websocket.onerror = (error) => {
            console.error('[WebSocket] 错误:', error);
            this.callbacks['error'].forEach(cb => cb(error));
        };

        this.websocket.onclose = () => {
            console.log('[WebSocket] 连接关闭');
            // 自动重连
            setTimeout(() => this.connect(), 3000);
        };
    }

    // 处理消息
    handleMessage(data) {
        const { type } = data;

        switch (type) {
            case 'connection_established':
                console.log('[WebSocket]', data.message);
                this.callbacks['connection_established'].forEach(cb => cb(data));
                break;

            case 'alert':
                console.log('[实时告警]', data.data);
                this.callbacks['alert'].forEach(cb => cb(data.data));
                break;

            default:
                console.log('[WebSocket] 未知消息类型:', type);
        }
    }

    // 注册回调
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    // 发送心跳
    sendHeartbeat() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
                type: 'ping',
                timestamp: Date.now()
            }));
        }
    }
}

// 使用示例
const alertClient = new AgentAlertClient('client_001');

// 注册告警回调
alertClient.on('alert', (alert) => {
    console.log('收到告警:', alert);
    
    // 显示通知
    showNotification({
        title: `${alert.risk_level.toUpperCase()}风险告警`,
        body: `Agent ${alert.agent.name} 执行了 ${alert.action} 操作`,
        icon: 'warning.png'
    });

    // 更新UI
    updateAlertList(alert);
});

// 连接WebSocket
alertClient.connect();

// 定期发送心跳（保持连接）
setInterval(() => alertClient.sendHeartbeat(), 30000);
```

### React组件集成

```jsx
import React, { useEffect, useState } from 'react';

function AlertMonitor({ clientId }) {
    const [alerts, setAlerts] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');

    useEffect(() => {
        const ws = new WebSocket(`ws://localhost:9092/ws/agent-alerts/${clientId}/`);

        ws.onopen = () => {
            setConnectionStatus('connected');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'alert') {
                // 添加新告警到列表
                setAlerts(prev => [data.data, ...prev].slice(0, 100));

                // 显示桌面通知
                if (Notification.permission === 'granted') {
                    new Notification(`${data.data.risk_level.toUpperCase()}风险告警`, {
                        body: `Agent ${data.data.agent.name}: ${data.data.action}`,
                    });
                }
            }
        };

        ws.onclose = () => {
            setConnectionStatus('disconnected');
        };

        return () => ws.close();
    }, [clientId]);

    return (
        <div>
            <div>连接状态: {connectionStatus}</div>
            <div>
                <h3>实时告警 ({alerts.length})</h3>
                {alerts.map(alert => (
                    <div key={alert.alert_id} className={`alert ${alert.risk_level}`}>
                        <div>
                            <strong>{alert.agent.name}</strong> ({alert.agent.trust_level})
                        </div>
                        <div>
                            {alert.action} → {alert.target}
                        </div>
                        <div>
                            风险分数: {alert.overall_score.toFixed(1)}
                        </div>
                        <div>
                            建议: {alert.recommendations[0]}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
```

## API手动触发告警

除了自动触发，也可以通过API手动触发告警：

```python
import requests

# 手动触发风险评估和告警
response = requests.post(
    'http://localhost:9092/api/risk-assessment/alerts/trigger/',
    json={
        'activity_id': 'act_xxx',
        'force': False  # True: 强制触发，忽略风险评估结果
    }
)

# 检查结果
if response.json()['alert']:
    print("告警已触发，等待WebSocket推送...")
```

## 测试方法

### 1. 测试WebSocket连接

```bash
python websocket_realtime_demo.py --test-connection
```

### 2. 测试完整流程

```bash
python websocket_realtime_demo.py
```

按照提示输入活动日志ID，观察实时推送效果。

### 3. 使用wscat工具测试

```bash
# 安装wscat
npm install -g wscat

# 连接WebSocket
wscat -c ws://localhost:9092/ws/agent-alerts/client_001/

# 发送心跳测试
> {"type": "ping", "timestamp": 1234567890}
```

## 性能优化

### 1. 批量上报优化

```python
# 不要每个活动都上报，批量上报
activities = []

# 累积100个活动或间隔5秒
if len(activities) >= 100 or time_since_last_report > 5:
    response = requests.post(
        'http://localhost:9092/api/agent-activities/batch/',
        json={'activities': activities}
    )
    activities = []
```

### 2. WebSocket连接池

```python
# 管理多个WebSocket连接
class WebSocketPool:
    def __init__(self):
        self.connections = {}
    
    def get_connection(self, client_id):
        if client_id not in self.connections:
            self.connections[client_id] = AgentAlertClient(client_id)
            self.connections[client_id].connect()
        return self.connections[client_id]
```

### 3. 心跳机制

```python
# 客户端定期发送心跳，保持连接
setInterval(() => {
    websocket.send(JSON.stringify({
        'type': 'ping',
        'timestamp': Date.now()
    }));
}, 30000);  // 30秒一次
```

## 故障排查

### 问题1: WebSocket连接失败

**检查项**:
- Django Channels是否安装并配置
- Redis是否启动（如果使用channels-redis）
- URL路由是否正确配置

**解决方案**:
```bash
# 安装依赖
pip install channels channels-redis

# 启动Redis
redis-server

# 启动Django ASGI服务器
daphne -b 0.0.0.0 -p 9092 fangdudu_backend.asgi:application
```

### 问题2: 告警未触发

**检查项**:
- 活动日志是否创建成功
- Agent身份是否正确关联
- 风险分数是否达到阈值

**解决方案**:
```bash
# 查询活动日志
python manage.py shell

>>> from auth_app.agent_activity_models import AgentActivityLog
>>> activity = AgentActivityLog.objects.get(activity_id='act_xxx')
>>> print(f"风险分数: {activity.risk_score}")
>>> print(f"Agent: {activity.agent.agent_name if activity.agent else 'None'}")

# 手动触发测试
>>> from auth_app.risk_assessment_service import RiskAssessmentService
>>> from auth_app.alert_service import AlertService
>>> result = RiskAssessmentService.assess_activity(activity)
>>> print(f"触发告警: {result.should_alert}")
```

### 问题3: WebSocket推送未收到

**检查项**:
- client_id是否匹配
- WebSocket连接是否正常
- Channel Layer配置是否正确

**解决方案**:
```python
# 检查Channel Layer配置
# settings.py
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("127.0.0.1", 6379)],
        },
    },
}
```

## 部署建议

### 1. 生产环境配置

```python
# settings.py
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [os.environ.get('REDIS_URL', 'redis://localhost:6379')],
            "capacity": 1500,
            "expiry": 10,
        },
    },
}
```

### 2. 使用Nginx代理WebSocket

```nginx
# nginx.conf
upstream websocket {
    server 127.0.0.1:9092;
}

server {
    location /ws/ {
        proxy_pass http://websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### 3. 监控告警推送性能

```python
# 添加Prometheus监控
from prometheus_client import Counter

alert_counter = Counter('alerts_sent', 'Alerts sent via WebSocket')

@classmethod
def _push_alert(cls, alert_data):
    alert_counter.inc()
    # ... 原有逻辑
```

---

**完整的实时告警推送系统已集成！**
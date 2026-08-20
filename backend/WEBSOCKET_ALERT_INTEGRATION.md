# WebSocket告警推送集成指南

## 一、告警类型

系统支持两类WebSocket告警：

### 1. 实时行为告警
- 触发时机：Agent活动日志写入时，风险评估分数>=70
- 推送内容：风险等级、分数、操作类型、建议措施
- 消息类型：`alert`

### 2. 任务失败告警
- 触发时机：Celery任务重试次数耗尽后
- 推送内容：任务名称、错误信息、任务ID、建议措施
- 消息类型：`task_alert`

---

## 二、WebSocket连接

### 连接地址
```
ws://localhost:9092/ws/agent-alerts/{client_id}/
```

### 连接示例（JavaScript）
```javascript
const clientId = 'desktop_client_001';
const ws = new WebSocket(`ws://localhost:9092/ws/agent-alerts/${clientId}/`);

// 连接建立
ws.onopen = () => {
  console.log('WebSocket连接已建立');

  // 发送心跳检测
  setInterval(() => {
    ws.send(JSON.stringify({
      type: 'ping',
      timestamp: Date.now()
    }));
  }, 30000);
};

// 接收消息
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'connection_established':
      console.log('连接确认:', message);
      break;

    case 'alert':
      handleBehaviorAlert(message.data);
      break;

    case 'task_alert':
      handleTaskAlert(message.data);
      break;

    case 'pong':
      console.log('心跳响应:', message.timestamp);
      break;
  }
};

// 连接关闭
ws.onclose = (event) => {
  console.log('WebSocket连接已关闭:', event.code, event.reason);
};

// 连接错误
ws.onerror = (error) => {
  console.error('WebSocket错误:', error);
};
```

---

## 三、消息格式

### 1. 连接确认消息
```json
{
  "type": "connection_established",
  "client_id": "desktop_client_001",
  "message": "WebSocket连接已建立"
}
```

### 2. 实时行为告警
```json
{
  "type": "alert",
  "data": {
    "alert_id": "alert_act_xxx",
    "alert_type": "warning",
    "timestamp": "2026-08-09T19:30:00.123Z",
    "session_id": "session_xxx",
    "client_id": "desktop_client_001",
    "agent_type": "cursor",
    "action": "file_operation",
    "risk_level": "danger",
    "overall_score": 75.5,
    "risk_score": 80,
    "target": "/path/to/sensitive/file",
    "recommendations": [
      "检查文件访问权限",
      "确认操作合法性"
    ],
    "activity_id": "act_xxx"
  }
}
```

### 3. 任务失败告警
```json
{
  "type": "task_alert",
  "data": {
    "alert_id": "task_failure_abc-123-def",
    "alert_type": "task_failure",
    "timestamp": "2026-08-09T19:35:00.123Z",
    "task_id": "abc-123-def",
    "task_name": "build_trajectory_async",
    "error": "ValueError: Invalid activity_id",
    "activity_id": "act_xxx",
    "client_id": "desktop_client_001",
    "risk_level": "high",
    "overall_score": 85.0,
    "recommendations": [
      "检查任务执行日志",
      "确认数据完整性",
      "如需要可手动重试任务"
    ]
  }
}
```

---

## 四、前端集成示例

### Electron主进程
```javascript
// electron/services/alertHandler.js

const WebSocket = require('ws');

class AlertHandler {
  constructor(clientId) {
    this.clientId = clientId;
    this.ws = null;
    this.reconnectInterval = 5000;
    this.isManualClose = false;
  }

  connect() {
    const wsUrl = `ws://localhost:9092/ws/agent-alerts/${this.clientId}/`;
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('[AlertHandler] WebSocket连接已建立');
      this.startHeartbeat();
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('[AlertHandler] 解析消息失败:', error);
      }
    });

    this.ws.on('close', () => {
      console.log('[AlertHandler] WebSocket连接已关闭');
      this.stopHeartbeat();

      if (!this.isManualClose) {
        // 自动重连
        setTimeout(() => {
          console.log('[AlertHandler] 尝试重新连接...');
          this.connect();
        }, this.reconnectInterval);
      }
    });

    this.ws.on('error', (error) => {
      console.error('[AlertHandler] WebSocket错误:', error);
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'alert':
        this.handleBehaviorAlert(message.data);
        break;

      case 'task_alert':
        this.handleTaskAlert(message.data);
        break;

      case 'pong':
        console.log('[AlertHandler] 心跳响应');
        break;

      default:
        console.log('[AlertHandler] 未知消息类型:', message.type);
    }
  }

  handleBehaviorAlert(alertData) {
    console.log('[AlertHandler] 行为告警:', alertData);

    // 发送到渲染进程显示告警弹窗
    this.sendToRenderer('behavior-alert', alertData);

    // 记录到本地日志
    this.logAlert(alertData);
  }

  handleTaskAlert(alertData) {
    console.log('[AlertHandler] 任务告警:', alertData);

    // 发送到渲染进程显示任务失败通知
    this.sendToRenderer('task-alert', alertData);

    // 记录到本地日志
    this.logAlert(alertData);
  }

  sendToRenderer(channel, data) {
    // 通过IPC发送到渲染进程
    const { BrowserWindow } = require('electron');
    const mainWindow = BrowserWindow.getAllWindows()[0];

    if (mainWindow) {
      mainWindow.webContents.send(channel, data);
    }
  }

  logAlert(alertData) {
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(__dirname, '../../logs/alerts.log');

    const logEntry = {
      timestamp: new Date().toISOString(),
      ...alertData
    };

    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }));
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  close() {
    this.isManualClose = true;
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = AlertHandler;
```

### Vue/React渲染进程
```javascript
// 渲染进程监听告警

const { ipcRenderer } = require('electron');

// 监听行为告警
ipcRenderer.on('behavior-alert', (event, alertData) => {
  showAlertPopup({
    title: '风险行为告警',
    message: `检测到高风险操作: ${alertData.action}`,
    level: alertData.risk_level,
    score: alertData.overall_score,
    recommendations: alertData.recommendations,
    timestamp: alertData.timestamp
  });
});

// 监听任务失败告警
ipcRenderer.on('task-alert', (event, alertData) => {
  showTaskFailurePopup({
    title: '任务执行失败',
    taskName: alertData.task_name,
    error: alertData.error,
    taskId: alertData.task_id,
    timestamp: alertData.timestamp,
    onRetry: () => {
      // 手动重试任务
      retryTask(alertData.task_id);
    }
  });
});

function showAlertPopup(alertData) {
  // 使用Ant Design Vue或Element Plus等UI库显示告警弹窗
  // 例如使用Ant Design Vue:
  this.$notification.warning({
    message: alertData.title,
    description: alertData.message,
    duration: 0, // 不自动关闭
    btn: () => (
      <a-button type="primary" size="small" onClick={() => handleAlertAction(alertData)}>
        查看详情
      </a-button>
    )
  });
}

function showTaskFailurePopup(alertData) {
  this.$notification.error({
    message: alertData.title,
    description: `${alertData.taskName}: ${alertData.error}`,
    duration: 0,
    btn: () => (
      <a-button type="primary" size="small" onClick={alertData.onRetry}>
        重试任务
      </a-button>
    )
  });
}
```

---

## 五、测试WebSocket告警

### 1. 测试行为告警
```python
# 提交一个高风险活动日志
from auth_app.agent_activity_models import AgentActivityLog
from auth_app.tasks import build_trajectory_async

# 创建高风险活动
activity = AgentActivityLog.objects.create(
    activity_id='test_high_risk',
    session_id='test_session',
    client_id='desktop_client_001',
    agent_type='cursor',
    action='file_operation',
    target='/etc/passwd',
    risk_score=85,
    risk_level='high'
)

# 提交异步任务（会触发风险评估和告警）
build_trajectory_async.delay(activity.activity_id)
```

### 2. 测试任务失败告警
```python
# 提交一个会失败的任务
from auth_app.tasks import build_trajectory_async

# 使用无效ID触发失败
result = build_trajectory_async.delay('invalid_id_12345')

# 等待任务失败并重试耗尽
import time
time.sleep(30)

# WebSocket会收到task_alert消息
```

---

## 六、监控和调试

### 1. 查看WebSocket日志
```bash
# Celery Worker日志会显示推送信息
tail -f /var/log/celery/worker.log | grep "WebSocket"

# Django日志会显示告警触发
tail -f /var/log/django/debug.log | grep "ALERT"
```

### 2. 使用浏览器开发者工具
- 打开浏览器开发者工具（F12）
- 切换到Network标签
- 筛选WS（WebSocket）
- 查看实时消息流

---

## 七、生产部署建议

### 1. 使用Redis作为Channel Layer
```python
# settings.py
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [('127.0.0.1', 6379)],
        },
    },
}
```

### 2. 启用SSL加密（生产环境）
```javascript
// 使用wss协议
const ws = new WebSocket('wss://yijiandaodi.com/ws/agent-alerts/client_id/');
```

### 3. 添加认证机制
```python
# 在Consumer中添加认证
async def connect(self):
    # 验证token
    token = self.scope['query_string'].decode('utf-8').split('token=')[-1]

    if not self.validate_token(token):
        await self.close()
        return

    # 继续连接流程...
```

---

## 八、故障排查

### 问题1：WebSocket连接失败
- 检查Django ASGI服务是否启动
- 确认client_id是否正确
- 查看浏览器控制台错误信息

### 问题2：没有收到告警
- 确认Celery Worker已启动
- 检查Redis连接是否正常
- 查看Celery日志中的推送记录

### 问题3：告警延迟
- 优化Celery Worker性能
- 增加Worker并发数
- 检查Channel Layer配置
# Celery任务错误日志排查指南

## 一、任务监控API接口

### 1. 查询任务状态
```bash
GET /api/tasks/{task_id}/status/

# 示例
curl -H "Authorization: Bearer {token}" \
  http://localhost:9092/api/tasks/abc-123-def/status/
```

**返回示例：**
```json
{
  "task_id": "abc-123-def",
  "status": "FAILURE",
  "ready": true,
  "successful": false,
  "failed": true,
  "result": "ValueError: Invalid activity_id",
  "traceback": "Traceback (most recent call last):\n  File ...",
  "date_done": "2026-08-08T14:30:00.123Z"
}
```

---

### 2. 获取错误详情
```bash
GET /api/tasks/{task_id}/error/

# 示例
curl -H "Authorization: Bearer {token}" \
  http://localhost:9092/api/tasks/abc-123-def/error/
```

**返回示例：**
```json
{
  "task_id": "abc-123-def",
  "status": "FAILURE",
  "error_type": "ValueError",
  "error_message": "Invalid activity_id",
  "traceback": "Traceback (most recent call last):\n  ...",
  "date_done": "2026-08-08T14:30:00.123Z"
}
```

---

### 3. 获取重试历史
```bash
GET /api/tasks/{task_id}/retry-history/

# 示例
curl -H "Authorization: Bearer {token}" \
  http://localhost:9092/api/tasks/abc-123-def/retry-history/
```

**返回示例：**
```json
{
  "task_id": "abc-123-def",
  "current_retry_count": 2,
  "max_retries": 3,
  "retry_history": [
    {
      "timestamp": "2026-08-08T14:30:00Z",
      "status": "FAILURE",
      "result": "Error: ..."
    },
    {
      "timestamp": "2026-08-08T14:25:00Z",
      "status": "FAILURE",
      "result": "Error: ..."
    }
  ]
}
```

---

### 4. 获取最近失败的任务列表
```bash
GET /api/tasks/failed/?queue=trajectory&hours=24

# 示例
curl -H "Authorization: Bearer {token}" \
  "http://localhost:9092/api/tasks/failed/?queue=trajectory&hours=24"
```

**返回示例：**
```json
{
  "failed_tasks": [
    {
      "task_id": "abc-123-def",
      "status": "FAILURE",
      "error": "ValueError: Invalid activity_id",
      "date_done": "2026-08-08T14:30:00Z"
    }
  ],
  "count": 1,
  "queue": "trajectory",
  "hours": 24
}
```

---

### 5. 获取任务性能统计
```bash
GET /api/tasks/performance/?hours=24

# 示例
curl -H "Authorization: Bearer {token}" \
  "http://localhost:9092/api/tasks/performance/?hours=24"
```

**返回示例：**
```json
{
  "total_tasks": 1000,
  "successful_tasks": 950,
  "failed_tasks": 50,
  "success_rate": 95.0,
  "avg_duration_ms": 45.2,
  "max_duration_ms": 125.3,
  "min_duration_ms": 12.5
}
```

---

### 6. 手动重试任务
```bash
POST /api/tasks/{task_id}/retry/

# 示例
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"activity_id": "act_xxx"}' \
  http://localhost:9092/api/tasks/abc-123-def/retry/
```

**返回示例：**
```json
{
  "message": "Task retry submitted",
  "new_task_id": "xyz-456-uvw",
  "activity_id": "act_xxx"
}
```

---

## 二、使用Python代码查询

### 1. 查询任务状态
```python
from auth_app.task_monitor import TaskMonitor

# 查询任务状态
task_info = TaskMonitor.get_task_status('abc-123-def')
print(f"状态: {task_info['status']}")
print(f"结果: {task_info.get('result')}")
```

### 2. 获取错误详情
```python
# 获取错误详情
error_info = TaskMonitor.get_task_error('abc-123-def')
print(f"错误类型: {error_info['error_type']}")
print(f"错误消息: {error_info['error_message']}")
print(f"堆栈追踪:\n{error_info['traceback']}")
```

### 3. 获取重试历史
```python
# 获取重试历史
retry_info = TaskMonitor.get_retry_history('abc-123-def')
print(f"重试次数: {retry_info['current_retry_count']}")
print(f"历史记录: {retry_info['retry_history']}")
```

### 4. 获取最近失败的任务
```python
# 获取最近24小时失败的任务
failed_tasks = TaskMonitor.get_recent_failed_tasks(queue_name='trajectory', hours=24)
for task in failed_tasks:
    print(f"任务ID: {task['task_id']}")
    print(f"错误: {task['error']}")
    print(f"时间: {task['date_done']}")
```

---

## 三、使用Flower监控界面

### 1. 启动Flower
```bash
pip install flower
celery -A fangdudu_backend flower --port=5555
```

### 2. 访问监控界面
浏览器打开：http://localhost:5555

### 3. 查看失败任务
- 点击"Tasks"标签
- 筛选状态为"FAILURE"
- 点击任务ID查看详细信息

### 4. 查看任务详情
- 点击任务ID
- 查看"Result"、"Traceback"、"Args"等详细信息

---

## 四、查看Redis中的任务元数据

### 1. 连接Redis
```bash
redis-cli
```

### 2. 查询任务元数据
```bash
# 查看所有任务key
KEYS celery-task-meta-*

# 查看特定任务详情
GET celery-task-meta-abc-123-def

# 示例输出
{
  "status": "FAILURE",
  "result": "ValueError: Invalid activity_id",
  "traceback": "Traceback (most recent call last):\n  ...",
  "date_done": "2026-08-08T14:30:00.123Z"
}
```

### 3. 统计失败任务数量
```bash
# 统计所有失败任务
EVAL "return #redis.call('keys', 'celery-task-meta-*')" 0
```

---

## 五、查看Celery日志

### 1. Worker日志
```bash
# 查看最近的日志
tail -f /var/log/celery/worker.log

# 搜索失败任务
grep "FAILURE" /var/log/celery/worker.log

# 搜索特定任务ID
grep "abc-123-def" /var/log/celery/worker.log
```

### 2. Beat日志
```bash
# 查看定时任务执行情况
tail -f /var/log/celery/beat.log
```

---

## 六、常见错误排查

### 1. ActivityLog不存在
**错误：**
```json
{
  "error_type": "DoesNotExist",
  "error_message": "AgentActivityLog matching query does not exist."
}
```

**原因：** activity_id无效或已被删除

**解决：** 检查activity_id是否正确，查询数据库确认记录存在

---

### 2. JSON序列化失败
**错误：**
```json
{
  "error_type": "TypeError",
  "error_message": "Object of type datetime is not JSON serializable"
}
```

**原因：** 任务参数包含不可序列化的对象

**解决：** 确保传递的是activity_id（字符串）而非ORM对象

---

### 3. 数据库连接超时
**错误：**
```json
{
  "error_type": "OperationalError",
  "error_message": "could not connect to server: Connection timed out"
}
```

**原因：** 数据库连接池耗尽或网络问题

**解决：** 检查数据库连接数，增加连接池大小

---

### 4. Redis连接失败
**错误：**
```json
{
  "error_type": "ConnectionError",
  "error_message": "Error 111 connecting to localhost:6379. Connection refused."
}
```

**原因：** Redis未启动或端口错误

**解决：** 启动Redis服务

---

## 七、监控和告警

### 1. 配置日志告警
在ELK中配置告警规则：
```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "ERROR" } },
        { "match": { "logger": "trajectory_builder" } }
      ]
    }
  },
  "actions": [
    {
      "type": "webhook",
      "url": "https://yijiandaodi.com/api/alerts/"
    }
  ]
}
```

### 2. 配置Flower告警
```python
# flowerconfig.py
CELERY_FLOWER_API = 'http://localhost:5555/api'
CELERY_FLOWER_BROKER_API = 'http://localhost:6379/0'

# 监控任务失败率
def monitor_failed_tasks():
    import requests
    response = requests.get(f'{CELERY_FLOWER_API}/tasks')
    tasks = response.json()

    failed_count = sum(1 for t in tasks.values() if t['state'] == 'FAILURE')

    if failed_count > 10:
        # 发送告警
        send_alert(f"任务失败数: {failed_count}")
```

---

## 八、性能优化建议

### 1. 减少失败任务的重试次数
```python
@shared_task(bind=True, max_retries=1)  # 降低重试次数
def build_trajectory_async(self, activity_id: str):
    # ...
```

### 2. 增加任务超时时间
```python
@shared_task(bind=True, time_limit=600)  # 10分钟超时
def archive_old_trajectories_async(self, days: int = 7):
    # ...
```

### 3. 使用死信队列
```python
# settings.py
CELERY_TASK_ROUTES = {
    'auth_app.tasks.*': {
        'queue': 'trajectory',
        'delivery_info': {
            'dead_letter_exchange': 'dlx',
            'dead_letter_routing_key': 'dlq'
        }
    }
}
```
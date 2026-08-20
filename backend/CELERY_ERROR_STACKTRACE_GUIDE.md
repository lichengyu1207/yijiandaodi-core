# Celery Worker错误堆栈日志查看指南

## 一、日志格式说明

### 1. 结构化JSON日志
所有日志都采用JSON格式，包含以下关键字段：

```json
{
  "timestamp": 1723108200.123,
  "level": "ERROR",
  "logger": "trajectory_builder",
  "message": "异步轨迹构建异常",
  "task_id": "abc-123-def",
  "activity_id": "act_xxx",
  "error": "ValueError: Invalid activity_id",
  "error_type": "ValueError",
  "duration_ms": 45.23,
  "traceback": "Traceback (most recent call last):\n  File ...",
  "retry_count": 2
}
```

### 2. 详细堆栈追踪（单独一行）
在结构化日志之后，会有单独一行的详细堆栈追踪：

```
详细堆栈追踪:
Traceback (most recent call last):
  File "/backend/auth_app/tasks.py", line 108, in build_trajectory_async
    activity_log = AgentActivityLog.objects.get(activity_id=activity_id)
  File "/django/db/models/manager.py", line 85, in manager_method
    return getattr(self.model._default_manager, name)(*args, **kwargs)
  File "/django/db/models/query.py", line 439, in get
    self.model._meta.object_name
auth_app.models.AgentActivityLog.DoesNotExist: AgentActivityLog matching query does not exist.
```

---

## 二、查看日志的方法

### 1. Celery Worker实时日志
```bash
# 查看实时日志
celery -A fangdudu_backend worker -l info

# 或查看日志文件
tail -f /var/log/celery/worker.log
```

### 2. 搜索错误日志
```bash
# 搜索所有错误
grep '"level": "ERROR"' /var/log/celery/worker.log

# 搜索特定任务ID
grep 'abc-123-def' /var/log/celery/worker.log

# 搜索堆栈追踪
grep -A 20 "详细堆栈追踪" /var/log/celery/worker.log
```

### 3. 使用jq解析JSON日志
```bash
# 提取所有错误信息
cat /var/log/celery/worker.log | jq 'select(.level == "ERROR")'

# 提取特定任务的完整日志
cat /var/log/celery/worker.log | jq 'select(.task_id == "abc-123-def")'

# 提取错误类型和消息
cat /var/log/celery/worker.log | jq 'select(.level == "ERROR") | {error_type, error, task_id}'
```

---

## 三、常见错误类型及堆栈示例

### 1. ActivityLog不存在
**错误类型：** `DoesNotExist`

**堆栈示例：**
```python
Traceback (most recent call last):
  File "/backend/auth_app/tasks.py", line 46, in build_trajectory_async
    activity_log = AgentActivityLog.objects.get(activity_id=activity_id)
  File "/django/db/models/manager.py", line 85, in manager_method
    return getattr(self.model._default_manager, name)(*args, **kwargs)
  File "/django/db/models/query.py", line 439, in get
    self.model._meta.object_name
auth_app.models.AgentActivityLog.DoesNotExist: AgentActivityLog matching query does not exist.
```

**原因：** activity_id无效或已被删除

**解决：** 检查activity_id是否正确，查询数据库确认记录存在

---

### 2. JSON序列化失败
**错误类型：** `TypeError`

**堆栈示例：**
```python
Traceback (most recent call last):
  File "/backend/auth_app/tasks.py", line 62, in build_trajectory_async
    trajectory = TrajectoryBuilder.build_or_update_trajectory(activity_log)
  File "/backend/auth_app/trajectory_builder.py", line 85, in build_or_update_trajectory
    trajectory.add_activity(activity_log)
  File "/backend/auth_app/trajectory_models.py", line 45, in add_activity
    self.behavior_chain.append(activity_data)
  File "/json/__init__.py", line 231, in dumps
    return _default_encoder.encode(obj)
TypeError: Object of type datetime is not JSON serializable
```

**原因：** 任务参数包含不可序列化的对象

**解决：** 确保传递的是activity_id（字符串）而非ORM对象

---

### 3. 数据库连接超时
**错误类型：** `OperationalError`

**堆栈示例：**
```python
Traceback (most recent call last):
  File "/django/db/backends/base/base.py", line 260, in _cursor
    return self._cursor()
  File "/django/db/backends/postgresql/base.py", line 239, in _cursor
    cursor = self.connection.cursor()
  File "/psycopg2/extras.py", line 325, in cursor
    cursor = self._cursors[-1]
IndexError: list index out of range

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/backend/auth_app/tasks.py", line 46, in build_trajectory_async
    activity_log = AgentActivityLog.objects.get(activity_id=activity_id)
  File "/django/db/models/manager.py", line 85, in manager_method
    return getattr(self.model._default_manager, name)(*args, **kwargs)
  File "/django/db/models/query.py", line 439, in get
    self.model._meta.object_name
django.db.utils.OperationalError: could not connect to server: Connection timed out
```

**原因：** 数据库连接池耗尽或网络问题

**解决：** 检查数据库连接数，增加连接池大小

---

### 4. Redis连接失败
**错误类型：** `ConnectionError`

**堆栈示例：**
```python
Traceback (most recent call last):
  File "/redis/client.py", line 911, in get_connection
    connection = self.pool.get_connection()
  File "/redis/connection.py", line 1192, in get_connection
    raise ConnectionError("Connection refused")
redis.exceptions.ConnectionError: Error 111 connecting to localhost:6379. Connection refused.
```

**原因：** Redis未启动或端口错误

**解决：** 启动Redis服务

---

## 四、ELK日志聚合查询

### 1. 配置Logstash解析
```ruby
# /etc/logstash/conf.d/celery.conf
filter {
  json {
    source => "message"
  }

  # 解析详细堆栈追踪
  if [message] =~ "详细堆栈追踪" {
    grok {
      match => { "message" => "详细堆栈追踪:\n(?<stacktrace>[\s\S]+)" }
    }
  }
}
```

### 2. Elasticsearch查询示例
```json
// 查询所有任务失败
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "ERROR" } },
        { "exists": { "field": "task_id" } }
      ]
    }
  }
}

// 查询特定错误类型
{
  "query": {
    "bool": {
      "must": [
        { "match": { "error_type": "DoesNotExist" } }
      ]
    }
  }
}

// 聚合统计错误类型
{
  "aggs": {
    "error_types": {
      "terms": { "field": "error_type.keyword" }
    }
  }
}
```

### 3. Kibana可视化
- **错误趋势图**：按时间统计错误数量
- **错误类型分布**：饼图显示各错误类型占比
- **任务耗时分布**：直方图显示任务执行时间

---

## 五、调试技巧

### 1. 本地调试任务
```python
# 在Python Shell中直接调用任务函数（不经过Celery）
from auth_app.tasks import build_trajectory_async

# 同步执行（不提交到队列）
result = build_trajectory_async('invalid_id')
print(result)
```

### 2. 模拟重试场景
```python
from auth_app.tasks import build_trajectory_async

# 提交任务并观察重试
result = build_trajectory_async.delay('invalid_id')

# 查看任务状态
print(f"Task ID: {result.id}")
print(f"Status: {result.status}")

# 等待重试完成
import time
time.sleep(30)

# 查看最终状态
print(f"Final Status: {result.status}")
print(f"Result: {result.result}")
```

### 3. 查看Worker日志级别
```bash
# 启动Worker时设置日志级别
celery -A fangdudu_backend worker -l debug

# 或在配置中设置
CELERY_WORKER_LOG_LEVEL = 'DEBUG'
```

---

## 六、日志输出示例

### 场景：任务失败并重试耗尽

#### 第一次执行失败
```json
{
  "timestamp": 1723108200.123,
  "level": "ERROR",
  "logger": "trajectory_builder",
  "message": "异步轨迹构建异常",
  "task_id": "abc-123-def",
  "activity_id": "invalid_id",
  "error": "AgentActivityLog matching query does not exist.",
  "error_type": "DoesNotExist",
  "duration_ms": 12.5,
  "traceback": "Traceback (most recent call last):...",
  "retry_count": 0
}
```

#### 第二次重试失败（2秒后）
```json
{
  "timestamp": 1723108202.456,
  "level": "ERROR",
  "logger": "trajectory_builder",
  "message": "异步轨迹构建异常",
  "task_id": "abc-123-def",
  "activity_id": "invalid_id",
  "error": "AgentActivityLog matching query does not exist.",
  "error_type": "DoesNotExist",
  "duration_ms": 10.2,
  "traceback": "Traceback (most recent call last):...",
  "retry_count": 1
}
```

#### 重试次数耗尽（4秒后）
```json
{
  "timestamp": 1723108206.789,
  "level": "CRITICAL",
  "logger": "trajectory_builder",
  "message": "异步轨迹构建重试次数耗尽",
  "task_id": "abc-123-def",
  "activity_id": "invalid_id",
  "error": "AgentActivityLog matching query does not exist.",
  "error_type": "DoesNotExist",
  "max_retries": 3,
  "total_duration_ms": 25.7,
  "traceback_summary": [
    "File \"/backend/auth_app/tasks.py\", line 46, in build_trajectory_async",
    "activity_log = AgentActivityLog.objects.get(activity_id=activity_id)",
    "auth_app.models.AgentActivityLog.DoesNotExist: AgentActivityLog matching query does not exist."
  ]
}
```

---

## 七、性能优化建议

### 1. 减少日志大小
```python
# 只在DEBUG级别记录完整堆栈
if logger.isEnabledFor(logging.DEBUG):
    logger.debug(f"详细堆栈追踪:\n{traceback_str}")
else:
    # ERROR级别只记录前5行
    logger.error(f"堆栈摘要:\n{'\n'.join(traceback_str.split('\n')[:5])}")
```

### 2. 使用异步日志处理器
```python
# settings.py
LOGGING = {
    'handlers': {
        'celery_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/celery/worker.log',
            'maxBytes': 1024 * 1024 * 100,  # 100MB
            'backupCount': 5,
        }
    }
}
```

### 3. 日志采样（高并发场景）
```python
# 只记录10%的错误日志
import random
if random.random() < 0.1:
    logger.error("详细堆栈追踪:\n{traceback_str}")
```

---

## 八、告警和监控

### 1. 配置日志告警
```yaml
# elastalert/config.yaml
rules_folder: /etc/elastalert/rules

# /etc/elastalert/rules/celery_errors.yaml
name: Celery Task Errors
type: frequency
index: celery-logs-*
num_events: 10
timeframe:
  minutes: 5
filter:
  - term:
      level: "ERROR"
alert:
  - "email"
email: "admin@yijiandaodi.com"
```

### 2. Prometheus监控指标
```python
# 在tasks.py中添加指标
from prometheus_client import Counter, Histogram

task_errors = Counter('celery_task_errors_total', 'Total task errors', ['task_name', 'error_type'])
task_duration = Histogram('celery_task_duration_seconds', 'Task execution duration')

@shared_task
def build_trajectory_async(self, activity_id: str):
    try:
        # ...
    except Exception as e:
        task_errors.labels(task_name='build_trajectory_async', error_type=type(e).__name__).inc()
        raise
```

**所有错误堆栈日志已增强，现在可以精确排查任务失败的根本原因！**
# Celery任务执行日志监控配置

## 📋 目录
1. [日志采集配置](#日志采集配置)
2. [ELK Stack集成](#elk-stack集成)
3. [告警规则配置](#告警规则配置)
4. [实时监控仪表盘](#实时监控仪表盘)
5. [性能指标追踪](#性能指标追踪)
6. [异常追踪配置](#异常追踪配置)

---

## 1. 日志采集配置

### **Django日志配置 (settings.py)**

```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    
    'formatters': {
        'json': {
            'format': '{"timestamp": %(asctime)s, "level": %(levelname)s, "logger": %(name)s, "message": %(message)s}',
            'class': 'pythonjsonlogger.jsonlogger.JsonFormatter'
        },
        'standard': {
            'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
        }
    },
    
    'handlers': {
        'celery_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/celery/worker.log',
            'maxBytes': 104857600,  # 100MB
            'backupCount': 10,
            'formatter': 'json',
        },
        
        'celery_error_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/celery/errors.log',
            'maxBytes': 104857600,  # 100MB
            'backupCount': 20,
            'formatter': 'json',
        },
        
        'elk_tcp': {
            'level': 'INFO',
            'class': 'logging.handlers.SocketHandler',
            'host': 'elk-server',
            'port': 5959,
            'formatter': 'json',
        },
        
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
        }
    },
    
    'loggers': {
        'trajectory_builder': {
            'handlers': ['celery_file', 'celery_error_file', 'elk_tcp'],
            'level': 'INFO',
            'propagate': False,
        },
        
        'auth_app.tasks': {
            'handlers': ['celery_file', 'celery_error_file', 'elk_tcp'],
            'level': 'INFO',
            'propagate': False,
        },
        
        'celery': {
            'handlers': ['celery_file', 'elk_tcp'],
            'level': 'INFO',
            'propagate': False,
        },
        
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
        }
    }
}
```

### **Celery Worker启动配置**

```bash
# /etc/supervisor/conf.d/celery-worker.conf

[program:celery-worker-trajectory]
command=/opt/venv/bin/celery -A fangdudu_backend worker -l info -Q trajectory --logfile=/var/log/celery/worker_trajectory.log
directory=/opt/yijiandaodi/backend
user=celery
numprocs=1
autostart=true
autorestart=true
startsecs=10
stopwaitsecs=600
stdout_logfile=/var/log/celery/worker_trajectory_stdout.log
stderr_logfile=/var/log/celery/worker_trajectory_stderr.log
environment=PYTHONPATH="/opt/yijiandaodi/backend"

[program:celery-worker-maintenance]
command=/opt/venv/bin/celery -A fangdudu_backend worker -l info -Q maintenance --logfile=/var/log/celery/worker_maintenance.log
directory=/opt/yijiandaodi/backend
user=celery
numprocs=1
autostart=true
autorestart=true
startsecs=10
stopwaitsecs=600
stdout_logfile=/var/log/celery/worker_maintenance_stdout.log
stderr_logfile=/var/log/celery/worker_maintenance_stderr.log
environment=PYTHONPATH="/opt/yijiandaodi/backend"
```

---

## 2. ELK Stack集成

### **Filebeat配置 (filebeat.yml)**

```yaml
# /etc/filebeat/filebeat.yml

filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/celery/worker*.log
      - /var/log/celery/errors.log
    
    json.keys_under_root: true
    json.add_error_key: true
    json.message_key: message
    
    fields:
      app: yijiandaodi-backend
      env: production
      service: celery-worker
    
    fields_under_root: true
    
    multiline.pattern: '^\{'
    multiline.negate: true
    multiline.match: after
    
    tags: ["celery", "tasks", "python"]

  - type: log
    enabled: true
    paths:
      - /var/log/django/*.log
    
    json.keys_under_root: true
    
    fields:
      app: yijiandaodi-backend
      env: production
      service: django
    
    tags: ["django", "api"]

processors:
  - add_host_metadata: ~
  - add_cloud_metadata: ~
  - add_docker_metadata: ~
  
  - decode_json_fields:
      fields: [message]
      target: json_message
      overwrite_keys: true

output.elasticsearch:
  hosts: ["http://elasticsearch:9200"]
  index: "yijiandaodi-celery-%{+yyyy.MM.dd}"
  
setup.template.name: "yijiandaodi-celery"
setup.template.pattern: "yijiandaodi-celery-*"
setup.template.settings:
  index.number_of_shards: 3
  index.number_of_replicas: 1

setup.kibana:
  host: "http://kibana:5601"
```

### **Logstash Pipeline配置 (celery-pipeline.conf)**

```ruby
# /etc/logstash/conf.d/celery-pipeline.conf

input {
  beats {
    port => 5044
  }
  
  tcp {
    port => 5959
    codec => json_lines
  }
}

filter {
  if [logger] =~ /^trajectory_builder|auth_app\.tasks$/ {
    # 解析时间戳
    date {
      match => ["timestamp", "ISO8601", "UNIX", "yyyy-MM-dd HH:mm:ss"]
      target => "@timestamp"
    }
    
    # 提取错误类型
    if [error_type] {
      mutate {
        add_tag => ["error"]
      }
      
      # 错误分类
      if [error_type] == "DoesNotExist" {
        mutate {
          add_tag => ["database-error", "not-found"]
        }
      } else if [error_type] == "ConnectionError" {
        mutate {
          add_tag => ["network-error", "infrastructure"]
        }
      } else if [error_type] =~ /ValueError|TypeError/ {
        mutate {
          add_tag => ["validation-error", "data-issue"]
        }
      }
    }
    
    # 提取任务ID
    if [task_id] {
      mutate {
        add_field => { "task_id_short" => "%{task_id}" }
      }
    }
    
    # 性能标记
    if [duration_ms] {
      if [duration_ms] > 1000 {
        mutate {
          add_tag => ["slow-task"]
        }
      }
      
      if [duration_ms] > 5000 {
        mutate {
          add_tag => ["performance-warning"]
        }
      }
    }
    
    # 异常标志提取
    if [anomaly_flags] {
      ruby {
        code => "
          flags = event.get('anomaly_flags')
          if flags.is_a?(Array)
            flags.each do |flag|
              event.tag(flag)
            end
          end
        "
      }
    }
  }
}

output {
  elasticsearch {
    hosts => ["http://elasticsearch:9200"]
    index => "yijiandaodi-celery-%{+YYYY.MM.dd}"
  }
  
  # 错误日志单独索引
  if [level] == "ERROR" or [level] == "CRITICAL" {
    elasticsearch {
      hosts => ["http://elasticsearch:9200"]
      index => "yijiandaodi-celery-errors-%{+YYYY.MM.dd}"
    }
  }
}
```

---

## 3. 告警规则配置

### **ElastAlert规则 - 任务失败告警**

```yaml
# /etc/elastalert/rules/celery_task_failure.yaml

name: "Celery Task Failure Alert"
type: frequency
index: yijiandaodi-celery-errors-*

num_events: 3
timeframe:
  minutes: 5

filter:
  - term:
      level: "ERROR"
  - exists:
      field: error_type

query_key:
  - error_type
  - task_name

doc_type: _doc

alert:
  - slack
  - email
  - webhook

slack_webhook_url: "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
slack_channel_override: "#alerts-celery"

email:
  - "ops-team@yijiandaodi.com"
  - "dev-team@yijiandaodi.com"

webhook:
  - url: "http://monitoring-service:8000/api/webhooks/celery-alert/"
    method: POST
    headers:
      Content-Type: application/json
      Authorization: "Bearer YOUR_TOKEN"

alert_text: |
  🚨 Celery任务执行失败
  
  任务名称: {0}
  错误类型: {1}
  错误消息: {2}
  发生时间: {3}
  
  堆栈追踪摘要:
  {4}

alert_text_args:
  - task_name
  - error_type
  - error
  - "@timestamp"
  - traceback_summary

alert_text_type: alert_text_only

```

### **ElastAlert规则 - 性能告警**

```yaml
# /etc/elastalert/rules/celery_performance.yaml

name: "Celery Performance Warning"
type: metric_aggregation
index: yijiandaodi-celery-*

buffer_time:
  minutes: 10

metric_agg_key: duration_ms
metric_agg_type: avg
query_key: task_name

doc_type: _doc

min_threshold: 5000  # 5秒

filter:
  - exists:
      field: duration_ms

alert:
  - slack
  - email

slack_webhook_url: "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

alert_text: |
  ⚠️ Celery任务性能警告
  
  任务: {0}
  平均耗时: {1:.2f}ms
  阈值: 5000ms
  
  请检查任务是否有性能问题。

alert_text_args:
  - task_name
  - metric_value

```

### **ElastAlert规则 - 磁盘空间告警**

```yaml
# /etc/elastalert/rules/disk_space_warning.yaml

name: "Disk Space Warning"
type: frequency
index: yijiandaodi-celery-*

num_events: 1
timeframe:
  minutes: 1

filter:
  - term:
      message: "异步磁盘检查任务完成"
  - range:
      used_percent:
        gte: 85

query_key: used_percent

alert:
  - slack
  - email
  - pagerduty

pagerduty:
  service_key: "YOUR_PAGERDUTY_KEY"
  client_url: "https://yijiandaodi.com/monitoring"

alert_text: |
  🔴 磁盘空间不足告警
  
  已使用: {0}%
  剩余空间: {1}GB
  
  请立即清理数据或扩展存储。

alert_text_args:
  - used_percent
  - free_gb

```

---

## 4. 实时监控仪表盘

### **Kibana仪表盘配置 (NDJSON导出)**

```json
{
  "version": "7.10.0",
  "objects": [
    {
      "id": "celery-dashboard",
      "type": "dashboard",
      "attributes": {
        "title": "Celery任务监控仪表盘",
        "panelsJSON": [
          {
            "panelIndex": 1,
            "gridData": {"x": 0, "y": 0, "w": 12, "h": 4},
            "type": "visualization",
            "id": "celery-success-rate"
          },
          {
            "panelIndex": 2,
            "gridData": {"x": 0, "y": 4, "w": 6, "h": 4},
            "type": "visualization",
            "id": "celery-error-types"
          },
          {
            "panelIndex": 3,
            "gridData": {"x": 6, "y": 4, "w": 6, "h": 4},
            "type": "visualization",
            "id": "celery-performance-trend"
          },
          {
            "panelIndex": 4,
            "gridData": {"x": 0, "y": 8, "w": 12, "h": 4},
            "type": "visualization",
            "id": "celery-task-execution-heatmap"
          },
          {
            "panelIndex": 5,
            "gridData": {"x": 0, "y": 12, "w": 12, "h": 6},
            "type": "search",
            "id": "celery-recent-errors"
          }
        ]
      }
    },
    
    {
      "id": "celery-success-rate",
      "type": "visualization",
      "attributes": {
        "title": "任务成功率趋势",
        "visState": {
          "type": "line",
          "params": {
            "index": "yijiandaodi-celery-*",
            "time_field": "@timestamp"
          },
          "aggs": [
            {
              "id": "1",
              "type": "count",
              "schema": "metric"
            },
            {
              "id": "2",
              "type": "filters",
              "schema": "group",
              "params": {
                "filters": [
                  {"query": "success:true", "label": "成功"},
                  {"query": "success:false", "label": "失败"}
                ]
              }
            },
            {
              "id": "3",
              "type": "date_histogram",
              "schema": "segment",
              "params": {
                "field": "@timestamp",
                "interval": "5m"
              }
            }
          ]
        }
      }
    },
    
    {
      "id": "celery-error-types",
      "type": "visualization",
      "attributes": {
        "title": "错误类型分布",
        "visState": {
          "type": "pie",
          "params": {
            "index": "yijiandaodi-celery-errors-*"
          },
          "aggs": [
            {
              "id": "1",
              "type": "count",
              "schema": "metric"
            },
            {
              "id": "2",
              "type": "terms",
              "schema": "segment",
              "params": {
                "field": "error_type",
                "size": 10
              }
            }
          ]
        }
      }
    },
    
    {
      "id": "celery-performance-trend",
      "type": "visualization",
      "attributes": {
        "title": "任务耗时趋势",
        "visState": {
          "type": "line",
          "params": {
            "index": "yijiandaodi-celery-*"
          },
          "aggs": [
            {
              "id": "1",
              "type": "avg",
              "schema": "metric",
              "params": {
                "field": "duration_ms"
              }
            },
            {
              "id": "2",
              "type": "terms",
              "schema": "group",
              "params": {
                "field": "task_name",
                "size": 5
              }
            },
            {
              "id": "3",
              "type": "date_histogram",
              "schema": "segment",
              "params": {
                "field": "@timestamp",
                "interval": "1h"
              }
            }
          ]
        }
      }
    }
  ]
}
```

---

## 5. 性能指标追踪

### **Prometheus指标导出器**

```python
# monitoring/celery_metrics_exporter.py

from prometheus_client import Counter, Histogram, Gauge, start_http_server
from prometheus_client.core import CollectorRegistry

# Celery任务指标
TASK_COUNTER = Counter(
    'celery_task_total',
    'Total Celery tasks executed',
    ['task_name', 'status']
)

TASK_DURATION = Histogram(
    'celery_task_duration_seconds',
    'Celery task execution duration',
    ['task_name'],
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0]
)

TASK_ERRORS = Counter(
    'celery_task_errors_total',
    'Total Celery task errors',
    ['task_name', 'error_type']
)

TRAJECTORY_COUNTER = Counter(
    'trajectory_build_total',
    'Total trajectories built',
    ['agent_type', 'risk_level']
)

RISK_SCORE_GAUGE = Gauge(
    'trajectory_risk_score',
    'Current trajectory risk score',
    ['session_id']
)

ACTIVE_SESSIONS = Gauge(
    'active_agent_sessions',
    'Number of active agent sessions'
)


class CeleryMetricsMiddleware:
    """Celery任务指标中间件"""
    
    def __init__(self):
        self.registry = CollectorRegistry()
        
    def record_task_execution(self, task_name, duration, success, error_type=None):
        """记录任务执行"""
        status = 'success' if success else 'failure'
        TASK_COUNTER.labels(task_name=task_name, status=status).inc()
        
        TASK_DURATION.labels(task_name=task_name).observe(duration)
        
        if not success and error_type:
            TASK_ERRORS.labels(task_name=task_name, error_type=error_type).inc()
    
    def record_trajectory_build(self, agent_type, risk_level, risk_score):
        """记录轨迹构建"""
        TRAJECTORY_COUNTER.labels(agent_type=agent_type, risk_level=risk_level).inc()
        RISK_SCORE_GAUGE.labels(session_id='current').set(risk_score)


# 启动Prometheus HTTP服务器
def start_metrics_server(port=9090):
    """启动指标服务器"""
    start_http_server(port, registry=CollectorRegistry())
    print(f"Prometheus metrics server started on port {port}")
```

### **集成到Celery任务**

```python
# auth_app/tasks.py

from monitoring.celery_metrics_exporter import CeleryMetricsMiddleware

metrics_middleware = CeleryMetricsMiddleware()

@shared_task(bind=True, max_retries=3)
def build_trajectory_async(self, activity_id: str) -> dict:
    """异步构建轨迹任务"""
    import time
    
    task_start = time.time()
    
    try:
        # 执行任务逻辑
        result = ...
        
        task_duration = time.time() - task_start
        
        # 记录成功指标
        metrics_middleware.record_task_execution(
            task_name='build_trajectory_async',
            duration=task_duration,
            success=True
        )
        
        metrics_middleware.record_trajectory_build(
            agent_type=result.get('agent_type', 'unknown'),
            risk_level=result.get('risk_level', 'low'),
            risk_score=result.get('chain_risk_score', 0)
        )
        
        return result
        
    except Exception as e:
        task_duration = time.time() - task_start
        
        # 记录失败指标
        metrics_middleware.record_task_execution(
            task_name='build_trajectory_async',
            duration=task_duration,
            success=False,
            error_type=type(e).__name__
        )
        
        raise
```

---

## 6. 异常追踪配置

### **Sentry集成配置**

```python
# settings.py

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.django import DjangoIntegration

SENTRY_DSN = "https://your-sentry-dsn@sentry.io/your-project-id"

sentry_sdk.init(
    dsn=SENTRY_DSN,
    integrations=[
        CeleryIntegration(),
        DjangoIntegration(),
    ],
    
    # 环境配置
    environment="production",
    release="yijiandaodi-backend@2.0.0",
    
    # 采样率
    traces_sample_rate=0.1,  # 10%的性能追踪
    profiles_sample_rate=0.1,
    
    # 错误过滤
    before_send=lambda event, hint: event if event.get('level') == 'error' else None,
    
    # 标签
    tags={
        'service': 'celery-worker',
        'queue': 'trajectory',
    },
    
    # 用户上下文
    send_default_pii=False,
)
```

### **Celery任务中的Sentry上下文**

```python
# auth_app/tasks.py

import sentry_sdk
from sentry_sdk import configure_scope

@shared_task(bind=True, max_retries=3)
def build_trajectory_async(self, activity_id: str) -> dict:
    """异步构建轨迹任务"""
    
    # 设置Sentry上下文
    with configure_scope() as scope:
        scope.set_tag('activity_id', activity_id)
        scope.set_tag('task_id', self.request.id)
        scope.set_extra('session_id', None)
        
        try:
            # 执行任务
            activity_log = AgentActivityLog.objects.get(activity_id=activity_id)
            
            # 更新上下文
            scope.set_extra('session_id', activity_log.session_id)
            scope.set_extra('client_id', activity_log.client_id)
            scope.set_tag('agent_type', activity_log.agent_type)
            scope.set_tag('risk_level', activity_log.risk_level)
            
            # 构建轨迹
            trajectory = TrajectoryBuilder.build_or_update_trajectory(activity_log)
            
            # 添加面包屑
            sentry_sdk.add_breadcrumb(
                category='trajectory',
                message=f'Built trajectory {trajectory.trajectory_id}',
                level='info',
            )
            
            return {
                'success': True,
                'trajectory_id': trajectory.trajectory_id,
            }
            
        except AgentActivityLog.DoesNotExist as e:
            # 捕获异常并添加额外信息
            sentry_sdk.capture_exception(e)
            
            return {
                'success': False,
                'error': str(e),
                'error_type': 'DoesNotExist',
            }
```

---

## 7. 实时监控脚本

### **监控脚本 (monitor_celery_logs.py)**

```python
#!/usr/bin/env python3
"""
Celery任务日志实时监控脚本
"""

import time
import json
import re
from collections import defaultdict
from datetime import datetime

class CeleryLogMonitor:
    """Celery日志实时监控"""
    
    def __init__(self, log_file='/var/log/celery/worker.log'):
        self.log_file = log_file
        self.error_counts = defaultdict(int)
        self.performance_stats = defaultdict(list)
        
    def tail_log_file(self):
        """实时跟踪日志文件"""
        with open(self.log_file, 'r') as f:
            # 移动到文件末尾
            f.seek(0, 2)
            
            while True:
                line = f.readline()
                
                if not line:
                    time.sleep(0.1)
                    continue
                
                self.process_log_line(line)
    
    def process_log_line(self, line: str):
        """处理单行日志"""
        try:
            log_data = json.loads(line)
            
            # 统计错误
            if log_data.get('level') == 'ERROR':
                error_type = log_data.get('error_type', 'Unknown')
                task_name = log_data.get('task_name', 'unknown')
                
                key = f"{task_name}:{error_type}"
                self.error_counts[key] += 1
                
                # 错误告警
                if self.error_counts[key] >= 3:
                    self.send_alert(
                        f"🔴 频繁错误告警: {task_name} - {error_type}\n"
                        f"错误次数: {self.error_counts[key]}"
                    )
            
            # 性能监控
            if 'duration_ms' in log_data:
                task_name = log_data.get('task_name', 'unknown')
                duration = log_data['duration_ms']
                
                self.performance_stats[task_name].append(duration)
                
                # 慢任务告警
                if duration > 5000:
                    self.send_alert(
                        f"⚠️ 慢任务告警: {task_name}\n"
                        f"耗时: {duration:.2f}ms"
                    )
            
            # 实时显示
            if log_data.get('level') in ['ERROR', 'CRITICAL']:
                print(f"[{datetime.now()}] {log_data.get('message')}")
        
        except json.JSONDecodeError:
            # 非JSON日志，使用正则匹配
            self.process_raw_log(line)
    
    def process_raw_log(self, line: str):
        """处理原始日志（非JSON）"""
        # 检测详细堆栈追踪
        if '详细堆栈追踪' in line:
            print(f"\n{'='*80}")
            print(line)
        elif 'Traceback' in line:
            print(f"\n{line}")
    
    def send_alert(self, message: str):
        """发送告警"""
        print(f"\n{message}")
        
        # 这里可以集成到Slack、Email等
        # requests.post('https://hooks.slack.com/...', json={'text': message})
    
    def generate_report(self):
        """生成监控报告"""
        print("\n" + "="*80)
        print("Celery任务监控报告".center(80))
        print("="*80)
        
        print("\n📊 错误统计（Top 10）:")
        for key, count in sorted(self.error_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"  {key}: {count}次")
        
        print("\n⏱️ 性能统计（平均耗时）:")
        for task_name, durations in self.performance_stats.items():
            avg_duration = sum(durations) / len(durations)
            print(f"  {task_name}: {avg_duration:.2f}ms")

if __name__ == '__main__':
    monitor = CeleryLogMonitor('/var/log/celery/worker.log')
    
    try:
        print("开始监控Celery日志...")
        monitor.tail_log_file()
    except KeyboardInterrupt:
        print("\n停止监控...")
        monitor.generate_report()
```

---

## 8. 部署清单

### **生产环境部署步骤**

1. **安装依赖**
```bash
pip install python-json-logger elasticsearch filebeat logstash-exporter prometheus-client sentry-sdk
```

2. **配置日志目录**
```bash
mkdir -p /var/log/celery /var/log/django
chmod 755 /var/log/celery /var/log/django
```

3. **启动Filebeat**
```bash
systemctl enable filebeat
systemctl start filebeat
```

4. **启动Celery Worker**
```bash
supervisorctl restart celery-worker-trajectory
supervisorctl restart celery-worker-maintenance
```

5. **验证日志采集**
```bash
# 检查Filebeat状态
filebeat test config
filebeat test output

# 检查日志输出
tail -f /var/log/celery/worker.log | jq .
```

6. **访问监控仪表盘**
- Kibana: http://kibana:5601
- Prometheus: http://prometheus:9090
- Grafana: http://grafana:3000

---

**监控配置完成！所有Celery任务现在都可以实时追踪和告警。**
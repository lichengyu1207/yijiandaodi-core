# 自监控服务集成到主流程方案

## 集成状态

### ✅ 已完成的部分

#### 1. Celery定时任务配置
**文件**: [celery_app.py](file:///c:/MsSafeData/Desktop/yijiandaodi/backend/fangdudu_backend/celery_app.py)

已配置11个定时任务：

**高优先级（每15分钟）**：
- `check-accuracy-drift-every-15-min`: 准确率漂移检测
- `check-response-time-anomaly-every-15-min`: 响应时间异常检测

**中优先级（每小时）**：
- `check-false-positive-rate-hourly`: 误报率检测
- `audit-permission-usage-hourly`: 权限使用审计
- `run-all-self-audit-checks-hourly`: 综合检查

**低优先级（每天凌晨4点）**：
- `check-rule-freshness-daily`: 规则库时效性检测

**报告生成**：
- `generate-hourly-audit-report`: 小时报告（每小时）
- `generate-daily-audit-report`: 日报（每天凌晨5点）
- `generate-weekly-audit-report`: 周报（每周一凌晨6点）
- `generate-monthly-audit-report`: 月报（每月1号凌晨7点）

#### 2. 服务实现
**文件**: [self_audit_service.py](file:///c:/MsSafeData/Desktop/yijiandaodi/backend/auth_app/self_audit_service.py)

- ✅ 5个监控项全部实现
- ✅ 详细的日志记录
- ✅ 异常处理完善
- ✅ 数据库写入验证

#### 3. 任务实现
**文件**: [self_audit_tasks.py](file:///c:/MsSafeData/Desktop/yijiandaodi/backend/auth_app/self_audit_tasks.py)

- ✅ 7个Celery任务实现
- ✅ 任务重试机制
- ✅ 错误处理和日志

### 🔴 需要启动的服务

#### 1. Redis服务
```bash
# Windows环境（需要先下载Redis）
# 方式1：使用Chocolatey安装
choco install redis-64

# 方式2：手动下载
# 下载地址：https://github.com/microsoftarchive/redis/releases
# 解压后运行：
redis-server.exe

# 验证Redis运行：
redis-cli ping
# 应返回：PONG
```

#### 2. Celery Worker服务
```bash
# 方式1：前台运行（用于测试）
cd c:\MsSafeData\Desktop\yijiandaodi\backend
celery -A fangdudu_backend.celery_app worker -l info

# 方式2：后台运行（生产环境）
# 使用启动脚本：start_celery_worker.bat
```

#### 3. Celery Beat服务（定时任务调度器）
```bash
# 方式1：前台运行（用于测试）
cd c:\MsSafeData\Desktop\yijiandaodi\backend
celery -A fangdudu_backend.celery_app beat -l info

# 方式2：后台运行（生产环境）
# 使用启动脚本：start_celery_beat.bat
```

## 🚀 启动步骤

### 完整启动流程

#### 步骤1：启动Redis
```bash
# 方式1：使用安装的服务
redis-server

# 方式2：使用压缩包版本
cd C:\Redis
redis-server.exe redis.windows.conf
```

#### 步骤2：启动Celery Worker
```bash
cd c:\MsSafeData\Desktop\yijiandaodi\backend
celery -A fangdudu_backend.celery_app worker -l info --pool=solo
```

**注意**：Windows环境建议使用 `--pool=solo` 或 `--pool=threads`，因为Windows不支持prefork模式。

#### 步骤3：启动Celery Beat
```bash
cd c:\MsSafeData\Desktop\yijiandaodi\backend
celery -A fangdudu_backend.celery_app beat -l info
```

#### 步骤4：验证服务运行
```bash
# 查看日志输出
Get-Content logs\self_audit.log -Wait

# 检查Celery任务状态
celery -A fangdudu_backend.celery_app inspect active

# 查看已注册的定时任务
celery -A fangdudu_backend.celery_app inspect scheduled
```

### 一键启动（生产环境）

使用启动脚本：

```bash
# 启动所有服务
start_all_celery.bat

# 或分别启动
start_celery_worker.bat
start_celery_beat.bat
```

## 📊 验证定时任务运行

### 方法1：查看日志
```bash
# 实时查看自监控日志
Get-Content logs\self_audit.log -Wait

# 查看Celery日志
Get-Content logs\celery_worker.log -Wait
```

### 方法2：检查数据库记录
```bash
# 进入Django Shell
python manage.py shell

# 查询性能漂移记录
from auth_app.self_audit_models import PerformanceDriftRecord
PerformanceDriftRecord.objects.count()

# 查询自审计报告
from auth_app.self_audit_models import SelfAuditReport
SelfAuditReport.objects.count()
```

### 方法3：手动触发任务（测试）
```bash
# 进入Django Shell
python manage.py shell

# 手动触发准确率漂移检测
from auth_app.self_audit_tasks import check_accuracy_drift_task
check_accuracy_drift_task.delay()

# 手动触发综合检查
from auth_app.self_audit_tasks import run_all_self_audit_checks_task
run_all_self_audit_checks_task.delay()
```

## 🔧 主流程集成点

### 已实现的自动触发

#### 1. Celery定时任务（完全自动）
- ✅ 每15分钟：准确率漂移和响应时间异常检测
- ✅ 每小时：误报率检测和权限审计
- ✅ 每天：规则库时效性检测
- ✅ 小时/日/周/月：自动生成报告

#### 2. 健康度快照集成（自动）
- ✅ 每次创建健康度快照时，自动包含自监控统计数据
- ✅ 位置：[governance_models.py](file:///c:/MsSafeData/Desktop/yijiandaodi/backend/auth_app/governance_models.py:509)

### 建议添加的触发点

#### 1. API响应时间自动记录

**位置**: 在API中间件中自动记录响应时间

**实现方式**:
```python
# middleware.py
class ResponseTimeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()
        response = self.get_response(request)
        end_time = time.time()
        
        # 自动记录到短期记忆
        if request.path.startswith('/api/v1/'):
            from auth_app.memory_models import ShortTermMemory
            ShortTermMemory.objects.create(
                agent_id='system',
                operation_type='api_call',
                operation_content=f'{request.method} {request.path}',
                decision='allow',
                metadata={
                    'response_time': int((end_time - start_time) * 1000),  # ms
                    'status_code': response.status_code,
                    'source_ip': request.META.get('REMOTE_ADDR')
                }
            )
        
        return response
```

#### 2. 权限变更自动审计

**位置**: 在权限变更时自动触发审计

**实现方式**:
```python
# 在AgentPermission模型的save方法中添加
class AgentPermission(models.Model):
    def save(self, *args, **kwargs):
        is_new = self.pk is None
        old_instance = None
        
        if not is_new:
            old_instance = AgentPermission.objects.get(pk=self.pk)
        
        super().save(*args, **kwargs)
        
        # 自动记录权限审计日志
        from auth_app.self_audit_models import AgentPermissionAuditLog
        AgentPermissionAuditLog.objects.create(
            agent=self.agent,
            action='create' if is_new else 'update',
            old_value={
                'permission_level': old_instance.permission_level if old_instance else None
            },
            new_value={
                'permission_level': self.permission_level
            },
            changed_by=self.changed_by if hasattr(self, 'changed_by') else None
        )
```

#### 3. 安全检测完成时触发复核提醒

**位置**: 在安全检测API返回时触发

**实现方式**:
```python
# 在安全检测视图中添加
class SecurityCheckView(APIView):
    def post(self, request):
        # 执行安全检测
        result = perform_security_check(request.data)
        
        # 如果检测到高风险，自动创建长期记忆供人工复核
        if result['risk_level'] in ['high', 'critical']:
            from auth_app.memory_models import LongTermMemory
            LongTermMemory.objects.create(
                agent_id=request.user.id,
                operation_type='security_check',
                operation_content=json.dumps(request.data),
                decision=result['decision'],
                risk_level=result['risk_level'],
                risk_score=result['risk_score']
                # verified_result 默认为None，等待人工复核
            )
        
        return Response(result)
```

## 📈 监控和告警

### Flower监控面板
```bash
# 启动Flower
celery -A fangdudu_backend.celery_app flower --port=5555

# 访问面板
http://localhost:5555
```

### 邮件告警配置

建议配置邮件告警，当检测到严重问题时发送通知：

```python
# 在self_audit_service.py中添加
from django.core.mail import send_mail
from django.conf import settings

def send_alert_email(subject, message):
    """发送告警邮件"""
    send_mail(
        subject=f'[一鉴到底自监控告警] {subject}',
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=['admin@example.com'],
        fail_silently=True
    )

# 在检测到严重问题时调用
if drift_record.severity == 'critical':
    send_alert_email(
        f'检测到{drift_record.drift_type}异常',
        f'严重程度：{drift_record.severity}\n'
        f'当前值：{drift_record.current_value}\n'
        f'基线值：{drift_record.baseline_value}\n'
        f'偏离率：{drift_record.deviation_rate:.2%}'
    )
```

## ✅ 集成完成检查清单

### 服务启动
- [ ] Redis服务运行中
- [ ] Celery Worker运行中
- [ ] Celery Beat运行中
- [ ] 日志文件正常生成

### 定时任务验证
- [ ] 15分钟后检查日志，确认准确率漂移检测已运行
- [ ] 1小时后检查日志，确认误报率检测已运行
- [ ] 检查数据库，确认PerformanceDriftRecord已创建
- [ ] 检查数据库，确认SelfAuditReport已创建

### 主流程集成验证
- [ ] API调用后，检查ShortTermMemory是否自动创建
- [ ] 权限变更后，检查AgentPermissionAuditLog是否自动创建
- [ ] 高风险检测后，检查LongTermMemory是否自动创建

### 告警验证
- [ ] 产生严重漂移时，检查是否收到告警邮件
- [ ] Flower面板是否显示任务执行情况

## 🎯 总结

### 当前状态
- ✅ **Celery配置完成**：11个定时任务全部配置
- ✅ **服务实现完成**：5个监控项全部实现
- ✅ **数据库集成完成**：健康度快照已包含自监控数据
- 🔴 **服务未启动**：需要启动Redis、Celery Worker和Beat

### 下一步行动
1. **启动Redis服务**（必须）
2. **启动Celery Worker**（必须）
3. **启动Celery Beat**（必须）
4. **验证定时任务运行**（查看日志和数据库）
5. **配置邮件告警**（可选，用于严重问题通知）

### 生产环境建议
- 使用Supervisor或systemd管理Celery服务，确保自动重启
- 配置日志轮转，避免日志文件过大
- 设置Flower监控面板，方便查看任务执行情况
- 配置邮件告警，及时发现严重问题

系统已就绪，只需启动服务即可自动运行！🚀
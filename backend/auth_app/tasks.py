# ============================================================
# 一鉴到底 - 异步任务定义
# 
# 任务类型:
#   1. 系统维护任务 (Token清理、日志清理)
#   2. 数据处理任务 (报告生成、统计分析)
#   3. 安全任务 (健康检查、告警聚合)
#   4. 通知任务 (邮件发送、消息推送)
# ============================================================

from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


# ============================================================
# 系统维护任务
# ============================================================

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def cleanup_expired_tokens(self):
    """
    清理过期的Token黑名单
    每5分钟执行一次
    """
    from auth_app.models import BlacklistedToken
    
    try:
        expired_count = BlacklistedToken.objects.filter(
            expires_at__lt=timezone.now()
        ).delete()[0]
        
        logger.info(f"[Celery] 清理了 {expired_count} 个过期Token")
        return {'status': 'success', 'cleaned': expired_count}
    
    except Exception as e:
        logger.error(f"[Celery] Token清理失败: {str(e)}")
        self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def cleanup_expired_sessions(self):
    """
    清理过期的Agent会话
    每小时执行一次
    """
    from auth_app.agent_models import AgentSession
    
    try:
        expired_count = AgentSession.objects.filter(
            expires_at__lt=timezone.now(),
            status='expired'
        ).delete()[0]
        
        logger.info(f"[Celery] 清理了 {expired_count} 个过期会话")
        return {'status': 'success', 'cleaned': expired_count}
    
    except Exception as e:
        logger.error(f"[Celery] 会话清理失败: {str(e)}")
        self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def cleanup_old_logs(self):
    """
    清理90天前的旧日志
    每天凌晨2点执行
    """
    from auth_app.models import LoginLog, AuditLog
    from auth_app.agent_models import AgentVerificationRecord
    
    try:
        cutoff_date = timezone.now() - timedelta(days=90)
        
        # 清理登录日志
        login_logs = LoginLog.objects.filter(login_time__lt=cutoff_date).delete()[0]
        
        # 清理审计日志
        audit_logs = AuditLog.objects.filter(created_at__lt=cutoff_date).delete()[0]
        
        # 清理Agent验证记录
        agent_records = AgentVerificationRecord.objects.filter(
            created_at__lt=cutoff_date
        ).delete()[0]
        
        total = login_logs + audit_logs + agent_records
        logger.info(f"[Celery] 清理了 {total} 条旧日志记录")
        return {
            'status': 'success',
            'login_logs': login_logs,
            'audit_logs': audit_logs,
            'agent_records': agent_records
        }
    
    except Exception as e:
        logger.error(f"[Celery] 日志清理失败: {str(e)}")
        self.retry(exc=e)


# ============================================================
# 安全任务
# ============================================================

@shared_task(bind=True, max_retries=3, default_retry_delay=120)
def check_agent_health(self):
    """
    检查所有Agent的健康状态
    每10分钟执行一次
    """
    from auth_app.agent_models import AgentConfig
    from auth_app.health_monitor import HealthMonitor
    
    try:
        agents = AgentConfig.objects.filter(is_active=True)
        results = {
            'healthy': 0,
            'warning': 0,
            'critical': 0,
            'total': agents.count()
        }
        
        monitor = HealthMonitor()
        
        for agent in agents:
            status = monitor.check_health(agent.agent_code)
            if status == 'healthy':
                results['healthy'] += 1
            elif status == 'warning':
                results['warning'] += 1
            else:
                results['critical'] += 1
        
        logger.info(f"[Celery] Agent健康检查完成: {results}")
        return {'status': 'success', 'results': results}
    
    except Exception as e:
        logger.error(f"[Celery] Agent健康检查失败: {str(e)}")
        self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def aggregate_alerts(self):
    """
    聚合告警，减少告警疲劳
    每小时执行一次
    """
    from auth_app.alert_aggregation_engine import AlertAggregationEngine
    
    try:
        engine = AlertAggregationEngine()
        result = engine.process_pending_alerts()
        
        logger.info(f"[Celery] 告警聚合完成: {result}")
        return {'status': 'success', 'aggregated': result}
    
    except Exception as e:
        logger.error(f"[Celery] 告警聚合失败: {str(e)}")
        self.retry(exc=e)


# ============================================================
# 数据处理任务
# ============================================================

@shared_task(bind=True, max_retries=2, default_retry_delay=600)
def generate_daily_stats(self):
    """
    生成每日统计报告
    每天凌晨3点执行
    """
    from django.core.cache import cache
    from auth_app.models import User, LoginLog
    from auth_app.agent_models import AgentSession, AgentVerificationRecord
    from django.db.models import Count, Avg
    
    try:
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        
        # 统计数据
        stats = {
            'date': yesterday.isoformat(),
            'new_users': User.objects.filter(
                date_joined__date=yesterday
            ).count(),
            'active_users': LoginLog.objects.filter(
                login_time__date=yesterday,
                status='success'
            ).values('user').distinct().count(),
            'total_logins': LoginLog.objects.filter(
                login_time__date=yesterday,
                status='success'
            ).count(),
            'failed_logins': LoginLog.objects.filter(
                login_time__date=yesterday,
                status='failed'
            ).count(),
            'agent_sessions': AgentSession.objects.filter(
                created_at__date=yesterday
            ).count(),
            'agent_verifications': AgentVerificationRecord.objects.filter(
                created_at__date=yesterday
            ).count(),
        }
        
        # 缓存统计结果
        cache_key = f'daily_stats_{yesterday.isoformat()}'
        cache.set(cache_key, stats, timeout=86400 * 30)  # 缓存30天
        
        logger.info(f"[Celery] 每日统计生成完成: {stats}")
        return {'status': 'success', 'stats': stats}
    
    except Exception as e:
        logger.error(f"[Celery] 统计生成失败: {str(e)}")
        self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def process_large_dataset(self, dataset_id, operation):
    """
    处理大数据集任务
    用于长时间运行的数据处理操作
    """
    from django.core.cache import cache
    
    try:
        # 更新任务状态
        cache_key = f'task_progress_{self.request.id}'
        
        # 模拟进度更新
        progress_stages = [
            {'stage': 'initializing', 'progress': 10},
            {'stage': 'loading_data', 'progress': 30},
            {'stage': 'processing', 'progress': 60},
            {'stage': 'saving', 'progress': 90},
            {'stage': 'completed', 'progress': 100},
        ]
        
        for stage in progress_stages:
            cache.set(cache_key, stage, timeout=3600)
            
            # 根据操作类型执行不同逻辑
            if operation == 'export':
                # 导出数据
                pass
            elif operation == 'analyze':
                # 分析数据
                pass
            elif operation == 'clean':
                # 清理数据
                pass
        
        logger.info(f"[Celery] 数据集处理完成: {dataset_id}")
        return {'status': 'success', 'dataset_id': dataset_id}
    
    except Exception as e:
        logger.error(f"[Celery] 数据集处理失败: {str(e)}")
        self.retry(exc=e)


# ============================================================
# 通知任务
# ============================================================

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_notification(self, user_id, subject, template, context):
    """
    发送邮件通知
    """
    try:
        # 邮件发送逻辑 (需配置EMAIL_BACKEND)
        from django.core.mail import send_mail
        from django.conf import settings
        from auth_app.models import User
        
        user = User.objects.get(id=user_id)
        
        send_mail(
            subject=subject,
            message='',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
            # html_message=render_to_string(template, context)
        )
        
        logger.info(f"[Celery] 邮件发送成功: {user.email}")
        return {'status': 'success', 'email': user.email}
    
    except Exception as e:
        logger.error(f"[Celery] 邮件发送失败: {str(e)}")
        self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_websocket_notification(self, channel_name, message):
    """
    发送WebSocket通知
    """
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            channel_name,
            {
                'type': 'notification.message',
                'message': message
            }
        )
        
        logger.info(f"[Celery] WebSocket通知发送成功: {channel_name}")
        return {'status': 'success'}
    
    except Exception as e:
        logger.error(f"[Celery] WebSocket通知发送失败: {str(e)}")
        self.retry(exc=e)


# ============================================================
# 任务状态查询API
# ============================================================

def get_task_status(task_id):
    """
    查询任务状态
    """
    from celery.result import AsyncResult
    
    result = AsyncResult(task_id)
    
    return {
        'task_id': task_id,
        'status': result.state,
        'result': result.result if result.ready() else None,
        'traceback': result.traceback if result.failed() else None,
    }
"""
自监控Celery异步任务 - Self-Audit Celery Tasks

实现自监控系统的异步任务处理，包括：
1. 高优先级监控任务（准确率漂移、响应时间异常）
2. 中优先级监控任务（误报率变化、权限使用审计）
3. 低优先级监控任务（规则库时效性）
"""

import logging
import time
import sys
from celery import shared_task

logger = logging.getLogger(__name__)


# ============================================================
# 高优先级监控任务
# ============================================================

@shared_task
def check_accuracy_drift_task():
    """
    检测校验准确率漂移任务（高优先级）

    定期抽样评估，与基线对比，识别性能漂移

    Returns:
        dict: 检测结果
    """
    from .self_audit_service import SelfAuditService

    task_start = time.time()

    logger.info("[Celery Task] 开始检测准确率漂移")

    try:
        drift_record = SelfAuditService.check_accuracy_drift()

        task_duration = (time.time() - task_start) * 1000

        result = {
            'success': True,
            'has_drift': drift_record is not None,
            'duration_ms': round(task_duration, 2),
        }

        if drift_record:
            result['drift_id'] = drift_record.id
            result['severity'] = drift_record.severity
            result['deviation_rate'] = drift_record.deviation_rate

        logger.info(f"[Celery Task] 准确率漂移检测完成: {result}")

        return result

    except Exception as e:
        logger.error(f"[Celery Task] 准确率漂移检测失败: {e}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
        }


@shared_task
def check_response_time_anomaly_task():
    """
    检测响应时间异常任务（高优先级）

    实时监控API响应时间，设置阈值告警

    Returns:
        dict: 检测结果
    """
    from .self_audit_service import SelfAuditService

    task_start = time.time()

    logger.info("[Celery Task] 开始检测响应时间异常")

    try:
        anomaly_records = SelfAuditService.check_response_time_anomaly()

        task_duration = (time.time() - task_start) * 1000

        result = {
            'success': True,
            'anomaly_count': len(anomaly_records),
            'duration_ms': round(task_duration, 2),
        }

        if anomaly_records:
            result['anomaly_ids'] = [r.id for r in anomaly_records]

        logger.info(f"[Celery Task] 响应时间异常检测完成: {result}")

        return result

    except Exception as e:
        logger.error(f"[Celery Task] 响应时间异常检测失败: {e}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
        }


# ============================================================
# 中优先级监控任务
# ============================================================

@shared_task
def check_false_positive_rate_task():
    """
    检测误报率变化任务（中优先级）

    统计误报趋势，异常时触发复核

    Returns:
        dict: 检测结果
    """
    from .self_audit_service import SelfAuditService

    task_start = time.time()

    logger.info("[Celery Task] 开始检测误报率变化")

    try:
        drift_record = SelfAuditService.check_false_positive_rate()

        task_duration = (time.time() - task_start) * 1000

        result = {
            'success': True,
            'has_drift': drift_record is not None,
            'duration_ms': round(task_duration, 2),
        }

        if drift_record:
            result['drift_id'] = drift_record.id
            result['severity'] = drift_record.severity

        logger.info(f"[Celery Task] 误报率检测完成: {result}")

        return result

    except Exception as e:
        logger.error(f"[Celery Task] 误报率检测失败: {e}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
        }


@shared_task
def audit_permission_usage_task():
    """
    权限使用审计任务（中优先级）

    记录所有权限变更操作，定期审计，识别权限滥用

    Returns:
        dict: 审计结果统计
    """
    from .self_audit_service import SelfAuditService

    task_start = time.time()

    logger.info("[Celery Task] 开始权限使用审计")

    try:
        stats = SelfAuditService.audit_permission_usage()

        task_duration = (time.time() - task_start) * 1000

        result = {
            'success': True,
            'total_changes': stats['total_changes'],
            'anomaly_count': len(stats['anomalies']),
            'high_risk_count': len(stats['high_risk_operations']),
            'duration_ms': round(task_duration, 2),
        }

        logger.info(f"[Celery Task] 权限审计完成: {result}")

        return result

    except Exception as e:
        logger.error(f"[Celery Task] 权限审计失败: {e}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
        }


# ============================================================
# 低优先级监控任务
# ============================================================

@shared_task
def check_rule_freshness_task():
    """
    检测规则库时效性任务（低优先级）

    检测规则库更新频率，过期规则提醒

    Returns:
        dict: 检测结果
    """
    from .self_audit_service import SelfAuditService

    task_start = time.time()

    logger.info("[Celery Task] 开始检测规则库时效性")

    try:
        stale_rules = SelfAuditService.check_rule_freshness()

        task_duration = (time.time() - task_start) * 1000

        result = {
            'success': True,
            'stale_rule_count': len(stale_rules),
            'duration_ms': round(task_duration, 2),
        }

        logger.info(f"[Celery Task] 规则时效性检测完成: {result}")

        return result

    except Exception as e:
        logger.error(f"[Celery Task] 规则时效性检测失败: {e}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
        }


# ============================================================
# 综合报告任务
# ============================================================

@shared_task(bind=True)
def run_all_self_audit_checks_task(self):
    """
    运行所有自监控检查任务

    按优先级顺序执行所有监控项：
    1. 高优先级：准确率漂移、响应时间异常
    2. 中优先级：误报率变化、权限使用审计
    3. 低优先级：规则库时效性

    Returns:
        dict: 检查结果汇总
    """
    from .self_audit_service import SelfAuditService

    task_start = time.time()

    logger.info("[Celery Task] 开始运行所有自监控检查")

    try:
        results = SelfAuditService.run_all_checks()

        task_duration = (time.time() - task_start) * 1000

        logger.info(
            "[Celery Task] 自监控检查完成",
            extra={
                'duration_ms': round(task_duration, 2),
                'has_accuracy_drift': results['accuracy_drift'] is not None,
                'has_response_anomalies': len(results['response_time_anomalies']) > 0,
                'has_permission_anomalies': len(results['permission_audit'].get('anomalies', [])) > 0,
            }
        )

        return {
            'success': True,
            'results': results,
            'duration_ms': round(task_duration, 2),
        }

    except Exception as e:
        task_duration = (time.time() - task_start) * 1000

        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_str = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))

        logger.error(
            "[Celery Task] 自监控检查失败",
            extra={
                'error': str(e),
                'error_type': type(e).__name__,
                'duration_ms': round(task_duration, 2),
                'traceback': traceback_str,
            }
        )

        return {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'traceback': traceback_str,
        }


@shared_task
def generate_audit_report_task(report_type='hourly'):
    """
    生成自审计报告任务

    汇总自监控结果，生成综合审计报告

    Args:
        report_type: 报告类型 (hourly/daily/weekly/monthly)

    Returns:
        dict: 报告生成结果
    """
    from .self_audit_service import SelfAuditService

    task_start = time.time()

    logger.info(f"[Celery Task] 开始生成{report_type}审计报告")

    try:
        report = SelfAuditService.generate_audit_report(report_type=report_type)

        task_duration = (time.time() - task_start) * 1000

        result = {
            'success': True,
            'report_id': report.id,
            'health_score': report.overall_health_score,
            'issues_found': report.issues_found,
            'duration_ms': round(task_duration, 2),
        }

        logger.info(f"[Celery Task] 审计报告生成完成: {result}")

        return result

    except Exception as e:
        logger.error(f"[Celery Task] 审计报告生成失败: {e}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
        }
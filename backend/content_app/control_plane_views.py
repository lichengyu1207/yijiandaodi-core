"""P0 统一控制面（M1 MVP）云端接口 — 内部运维/诊断通道

能力透明架构：不面向用户、无品牌名、无模块管理面板；数据仅供日志/调试/故障排查消费。
- GET    /api/modules/status       → 云端能力单元状态聚合
- GET    /api/deepseek/quota       → 消费预算闸门实时额度（对齐桌面端 DeepSeekQuotaStatus）
- GET/PUT /api/settings/log-level  → 云端日志级别运行时调整（目标：content_app.deepseek_service）

日志统一使用 [控制面] 前缀，便于与桌面端诊断通道联动 grep 排查。
详见 docs/P0-UNIFIED-CONTROL-PLANE-API.md
"""

import logging
import os
import time

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .deepseek_service import get_budget_gate

logger = logging.getLogger(__name__)

# 云端日志级别可调整目标（仅治理推理日志，避免误调全局）
LOG_LEVEL_TARGET = 'content_app.deepseek_service'
LOG_LEVEL_CACHE_KEY = 'control_plane:log_level:{target}'
# Python logging 标准级别（WARN 归一为 WARNING）
VALID_LEVELS = {'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'}

# P1-2 消费额度预警配置（与 deepseek_service.QUOTA_ALERT_CACHE_KEY 保持一致）
QUOTA_ALERT_CACHE_KEY = 'settings:quota_alert'
DEFAULT_QUOTA_ALERT = {
    'enabled': True,
    'warn_threshold': 80,
    'critical_threshold': 95,
    'notify': ['desktop', 'sound'],
    'rules': {
        'circuit_open': True,     # 推理熔断触发时告警（P3 调度）
        'quota_exhausted': True,  # 本地推理配额耗尽时告警（P3 调度）
    },
}


def _get_quota_alert_config() -> dict:
    """读取消费额度预警配置（缺失项回落默认值）"""
    try:
        cfg = cache.get(QUOTA_ALERT_CACHE_KEY)
    except Exception:
        cfg = None
    if not isinstance(cfg, dict):
        cfg = {}
    merged = dict(DEFAULT_QUOTA_ALERT)
    merged.update(cfg)
    return merged


def _now_epoch_ms() -> int:
    return int(time.time() * 1000)


def _check_redis():
    """缓存服务（Redis）健康检查"""
    try:
        import redis as redis_lib
        client = redis_lib.from_url(
            os.environ.get('REDIS_URL', 'redis://localhost:6379/2'),
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        client.ping()
        return 'running', 'healthy', {'pingMs': 0}, None
    except Exception as e:  # noqa: BLE001 - 诊断通道降级不抛
        return 'stopped', 'unhealthy', {}, f'缓存服务不可用: {e}'


def _check_db():
    """数据存储（数据库连接）健康检查"""
    try:
        connection.ensure_connection()
        return 'running', 'healthy', {}, None
    except Exception as e:  # noqa: BLE001
        return 'stopped', 'unhealthy', {}, f'数据库连接失败: {e}'


def _check_celery():
    """异步任务（Celery worker）健康检查"""
    try:
        from fangdudu_backend.celery_app import app as celery_app
        ping = celery_app.control.ping(timeout=1)
        workers = len([r for r in ping if r])
        if workers > 0:
            return 'running', 'healthy', {'workers': workers}, None
        return 'stopped', 'unhealthy', {'workers': 0}, '无存活异步任务 worker'
    except Exception as e:  # noqa: BLE001
        return 'stopped', 'unhealthy', {}, f'异步任务检查失败: {e}'


def _check_budget_gate():
    """消费预算闸门健康检查"""
    try:
        quota = get_budget_gate().get_quota_status()
        return 'running', 'healthy', {
            'globalUsed': quota.get('globalUsed', 0),
            'globalQuota': quota.get('globalQuota', 0),
            'circuitOpen': 1 if quota.get('circuitOpen') else 0,
            'failures': 0,
        }, None
    except Exception as e:  # noqa: BLE001
        return 'stopped', 'unhealthy', {}, f'消费预算闸门状态读取失败: {e}'


def _check_inference_engine():
    """推理引擎（InferenceProvider + 本地优先/过载回退路由）健康检查（M2/M4）"""
    try:
        from .inference import get_inference_provider, get_router

        provider = get_inference_provider()
        router = get_router()
        detector = router.overload
        overload_reason = detector.check()
        metrics = {
            'provider': provider.name,
            'localOverload': overload_reason or '',
            'inFlight': detector.in_flight,
            'maxConcurrency': detector.max_concurrency,
            'maxLocalRatio': detector.max_local_ratio,
        }
        if overload_reason:
            return 'running', 'degraded', metrics, f'本地推理过载: {overload_reason}'
        return 'running', 'healthy', metrics, None
    except Exception as e:  # noqa: BLE001 - 诊断通道降级不抛
        return 'unknown', 'unknown', {}, f'推理引擎检查失败: {e}'


def _check_compute_cluster():
    """推理集群（P2P 节点池 + 任务管道）健康检查（M4）"""
    try:
        from p2p_app.models import P2PNode, TaskDispatch

        # 注意：JSONField 的 __contains 查找在 SQLite 后端不受支持，这里改为
        # DB 内按状态过滤 + Python 内做能力匹配，保证跨数据库后端一致。
        online = busy = 0
        for node in P2PNode.objects.filter(status__in=['online', 'busy']):
            if 'inference' not in (node.capabilities or []):
                continue
            if node.status == 'online':
                online += 1
            else:
                busy += 1
        total = P2PNode.objects.count()
        executing = TaskDispatch.objects.filter(status='executing').count()
        metrics = {
            'onlineNodes': online,
            'busyNodes': busy,
            'totalNodes': total,
            'executingTasks': executing,
        }
        if online + busy == 0:
            return 'stopped', 'unhealthy', metrics, '无在线/忙碌推理节点'
        if online == 0:
            return 'running', 'degraded', metrics, '仅有忙碌节点，无空闲在线节点'
        return 'running', 'healthy', metrics, None
    except Exception as e:  # noqa: BLE001 - 诊断通道降级不抛
        return 'unknown', 'unknown', {}, f'推理集群检查失败: {e}'


@api_view(['GET'])
@permission_classes([AllowAny])
def modules_status(request):
    """云端能力单元状态聚合（P0 统一控制面；内部诊断通道）"""
    redis_state, redis_health, redis_metrics, redis_detail = _check_redis()
    db_state, db_health, db_metrics, db_detail = _check_db()
    celery_state, celery_health, celery_metrics, celery_detail = _check_celery()
    gate_state, gate_health, gate_metrics, gate_detail = _check_budget_gate()
    engine_state, engine_health, engine_metrics, engine_detail = _check_inference_engine()
    cluster_state, cluster_health, cluster_metrics, cluster_detail = _check_compute_cluster()

    now = _now_epoch_ms()

    def build(module_id, name, state, health, metrics, detail=None, version=''):
        item = {
            'moduleId': module_id,
            'name': name,
            'kind': 'cloud',
            'state': state,
            'health': health,
            'version': version,
            'lastHeartbeat': now,
            'uptimeSec': None,
            'metrics': metrics,
        }
        if detail:
            item['detail'] = detail
        return item

    modules = [
        build('cloud.api', '云端后端', 'running', 'healthy',
              {'debug': 1 if settings.DEBUG else 0}, version='1.0.0'),
        build('cloud.celery', '异步任务', celery_state, celery_health, celery_metrics, celery_detail),
        build('cloud.redis', '缓存服务', redis_state, redis_health, redis_metrics, redis_detail),
        build('cloud.db', '数据存储', db_state, db_health, db_metrics, db_detail),
        build('cloud.budget-gate', '消费预算闸门', gate_state, gate_health, gate_metrics, gate_detail),
        build('cloud.inference-engine', '推理引擎', engine_state, engine_health, engine_metrics, engine_detail),
        build('cloud.compute-cluster', '推理集群', cluster_state, cluster_health, cluster_metrics, cluster_detail),
    ]
    logger.info('[控制面] 云端能力单元状态聚合完成: redis=%s db=%s celery=%s gate=%s engine=%s cluster=%s',
                redis_state, db_state, celery_state, gate_state, engine_state, cluster_state)
    return Response({'modules': modules})


@api_view(['GET'])
@permission_classes([AllowAny])
def deepseek_quota(request):
    """消费预算闸门实时额度（P0 统一控制面；内部诊断通道）"""
    try:
        quota = get_budget_gate().get_quota_status()
        return Response({'quota': quota})
    except Exception as e:  # noqa: BLE001
        logger.error('[控制面] 额度状态读取失败: %r', e)
        return Response({'quota': None, 'error': str(e)}, status=500)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def log_level(request):
    """云端日志级别运行时调整（P0 统一控制面；内部诊断通道）"""
    target_logger = logging.getLogger(LOG_LEVEL_TARGET)
    cache_key = LOG_LEVEL_CACHE_KEY.format(target=LOG_LEVEL_TARGET)
    if request.method == 'GET':
        return Response({
            'module': LOG_LEVEL_TARGET,
            'level': logging.getLevelName(target_logger.level) if target_logger.level else 'NOTSET',
            'persisted': cache.get(cache_key),
        })

    level = str(request.data.get('level', '')).upper()
    if level == 'WARN':
        level = 'WARNING'
    if level not in VALID_LEVELS:
        return Response({'error': f'无效日志级别: {request.data.get("level")}'}, status=400)
    numeric = logging.getLevelName(level)
    if not isinstance(numeric, int):
        return Response({'error': f'无效日志级别: {request.data.get("level")}'}, status=400)
    target_logger.setLevel(numeric)
    cache.set(cache_key, level, timeout=86400 * 90)
    logger.info('[控制面] 云端日志级别已更新: %s -> %s', LOG_LEVEL_TARGET, level)
    return Response({'module': LOG_LEVEL_TARGET, 'level': level, 'persisted': level})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def quota_alert(request):
    """消费额度预警配置（P1-2）：开关 / 阈值 / 通知方式

    - GET  /api/settings/quota-alert → 当前配置
    - POST /api/settings/quota-alert → 保存配置 { enabled, warn_threshold, critical_threshold, notify }
    """
    if request.method == 'GET':
        return Response({'success': True, 'config': _get_quota_alert_config()})

    data = request.data or {}
    current = _get_quota_alert_config()

    enabled = bool(data.get('enabled', current.get('enabled', True)))
    try:
        warn_threshold = int(data.get('warn_threshold') or current.get('warn_threshold', 80))
        critical_threshold = int(data.get('critical_threshold') or current.get('critical_threshold', 95))
    except (TypeError, ValueError):
        return Response({'success': False, 'error': '阈值必须为整数（百分比）'}, status=400)
    warn_threshold = max(1, min(warn_threshold, 99))
    critical_threshold = max(1, min(critical_threshold, 100))
    if warn_threshold >= critical_threshold:
        return Response({'success': False, 'error': '预警阈值必须小于临界阈值'}, status=400)

    notify = data.get('notify')
    if notify is None:
        notify = current.get('notify', ['desktop', 'sound'])
    if isinstance(notify, str):
        notify = [notify]
    valid = {'desktop', 'sound', 'email'}
    notify = [n for n in notify if n in valid]

    # 事件告警规则（circuit_open / quota_exhausted）：仅接受已知键的布尔值
    rules = data.get('rules')
    if rules is None:
        rules = current.get('rules', DEFAULT_QUOTA_ALERT['rules'])
    if not isinstance(rules, dict):
        rules = {}
    known_rules = {'circuit_open', 'quota_exhausted'}
    clean_rules = {k: bool(v) for k, v in rules.items() if k in known_rules}
    merged_rules = dict(DEFAULT_QUOTA_ALERT['rules'])
    merged_rules.update(clean_rules)

    cfg = {
        'enabled': enabled,
        'warn_threshold': warn_threshold,
        'critical_threshold': critical_threshold,
        'notify': notify,
        'rules': merged_rules,
    }
    cache.set(QUOTA_ALERT_CACHE_KEY, cfg, timeout=86400 * 90)
    logger.info('[控制面] 消费预警配置已更新: %s', cfg)
    return Response({'success': True, 'config': cfg})

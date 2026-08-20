"""
风险评估和告警API视图

提供独立的风险评估和告警接口，方便其他服务调用
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone
import logging

from .agent_activity_models import AgentActivityLog
from .risk_assessment_service import RiskAssessmentService
from .alert_service import AlertService
from .risk_assessment_serializers import (
    RiskAssessmentRequestSerializer,
    BatchRiskAssessmentRequestSerializer,
    RiskAssessmentResultSerializer,
    TriggerAlertRequestSerializer,
    AlertDataSerializer,
    CacheStatsSerializer,
)

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])  # 内部服务调用，暂时允许匿名访问
def assess_risk(request):
    """
    实时风险评估

    POST /api/risk-assessment/assess/

    请求体：
    {
        "activity_id": "act_xxx"
    }

    返回：
    {
        "success": true,
        "result": {
            "activity_id": "act_xxx",
            "overall_score": 75.5,
            "risk_level": "danger",
            "should_alert": true,
            "recommendations": ["..."],
            "agent_id": "agent_xxx",
            "agent_name": "Test Agent",
            "agent_trust_level": "high",
            "alert_threshold": 70.0,
            "critical_threshold": 90.0,
            "permission_bonus": 0.0
        }
    }
    """
    serializer = RiskAssessmentRequestSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {'success': False, 'errors': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )

    activity_id = serializer.validated_data['activity_id']

    try:
        # 查询活动日志
        activity = AgentActivityLog.objects.get(activity_id=activity_id)

        # 执行风险评估
        result = RiskAssessmentService.assess_activity(activity)

        # 获取Agent身份信息
        agent_id = activity.agent.agent_id if activity.agent else None
        agent_name = activity.agent.agent_name if activity.agent else None
        agent_trust_level = activity.agent.trust_level if activity.agent else None

        # 获取阈值信息
        trust_level = agent_trust_level or 'low'
        trust_factor = RiskAssessmentService.TRUST_LEVEL_FACTORS.get(trust_level, 1.0)
        alert_threshold = RiskAssessmentService.BASE_ALERT_THRESHOLD * trust_factor
        critical_threshold = RiskAssessmentService.BASE_CRITICAL_THRESHOLD * trust_factor

        # 计算权限加成
        permission_bonus = result.overall_score - activity.risk_score

        # 构建响应
        response_data = {
            'activity_id': activity_id,
            'overall_score': result.overall_score,
            'risk_level': result.risk_level,
            'should_alert': result.should_alert,
            'recommendations': result.recommendations,
            'agent_id': agent_id,
            'agent_name': agent_name,
            'agent_trust_level': agent_trust_level,
            'alert_threshold': alert_threshold,
            'critical_threshold': critical_threshold,
            'permission_bonus': permission_bonus,
        }

        logger.info(
            f"[风险评估API] Activity {activity_id}: "
            f"Score={result.overall_score:.1f}, Level={result.risk_level}, Alert={result.should_alert}"
        )

        return Response({
            'success': True,
            'result': response_data
        })

    except AgentActivityLog.DoesNotExist:
        return Response(
            {'success': False, 'error': f'Activity {activity_id} 不存在'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"[风险评估API] 评估失败: {e}", exc_info=True)
        return Response(
            {'success': False, 'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def assess_risk_batch(request):
    """
    批量风险评估

    POST /api/risk-assessment/assess-batch/

    请求体：
    {
        "activity_ids": ["act_xxx", "act_yyy"]
    }

    返回：
    {
        "success": true,
        "results": [
            {...},
            {...}
        ],
        "total_count": 2,
        "alert_count": 1
    }
    """
    serializer = BatchRiskAssessmentRequestSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {'success': False, 'errors': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )

    activity_ids = serializer.validated_data['activity_ids']

    try:
        # 查询活动日志
        activities = AgentActivityLog.objects.filter(activity_id__in=activity_ids)

        if not activities.exists():
            return Response(
                {'success': False, 'error': '未找到任何活动日志'},
                status=status.HTTP_404_NOT_FOUND
            )

        # 批量评估
        results = []
        alert_count = 0

        for activity in activities:
            result = RiskAssessmentService.assess_activity(activity)

            agent_id = activity.agent.agent_id if activity.agent else None
            agent_name = activity.agent.agent_name if activity.agent else None
            agent_trust_level = activity.agent.trust_level if activity.agent else None

            trust_level = agent_trust_level or 'low'
            trust_factor = RiskAssessmentService.TRUST_LEVEL_FACTORS.get(trust_level, 1.0)
            alert_threshold = RiskAssessmentService.BASE_ALERT_THRESHOLD * trust_factor
            critical_threshold = RiskAssessmentService.BASE_CRITICAL_THRESHOLD * trust_factor
            permission_bonus = result.overall_score - activity.risk_score

            result_data = {
                'activity_id': activity.activity_id,
                'overall_score': result.overall_score,
                'risk_level': result.risk_level,
                'should_alert': result.should_alert,
                'recommendations': result.recommendations,
                'agent_id': agent_id,
                'agent_name': agent_name,
                'agent_trust_level': agent_trust_level,
                'alert_threshold': alert_threshold,
                'critical_threshold': critical_threshold,
                'permission_bonus': permission_bonus,
            }

            results.append(result_data)

            if result.should_alert:
                alert_count += 1

        logger.info(
            f"[批量风险评估API] 评估 {len(results)} 个活动，触发 {alert_count} 次告警"
        )

        return Response({
            'success': True,
            'results': results,
            'total_count': len(results),
            'alert_count': alert_count
        })

    except Exception as e:
        logger.error(f"[批量风险评估API] 评估失败: {e}", exc_info=True)
        return Response(
            {'success': False, 'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def trigger_alert(request):
    """
    手动触发告警

    POST /api/alerts/trigger/

    请求体：
    {
        "activity_id": "act_xxx",
        "force": false  // 是否强制触发（忽略风险评估结果）
    }

    返回：
    {
        "success": true,
        "alert": {...}
    }
    """
    serializer = TriggerAlertRequestSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {'success': False, 'errors': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )

    activity_id = serializer.validated_data['activity_id']
    force = serializer.validated_data.get('force', False)

    try:
        # 查询活动日志
        activity = AgentActivityLog.objects.get(activity_id=activity_id)

        # 执行风险评估
        result = RiskAssessmentService.assess_activity(activity)

        # 判断是否触发告警
        should_trigger = force or result.should_alert

        if not should_trigger:
            return Response({
                'success': True,
                'alert': None,
                'message': f'风险分数 {result.overall_score:.1f} 未达到告警阈值'
            })

        # 触发告警
        alert_data = AlertService.handle_alert(activity, result)

        if alert_data:
            logger.info(
                f"[告警触发API] Activity {activity_id}: "
                f"Alert={alert_data['alert_id']}, Level={alert_data['risk_level']}"
            )

            return Response({
                'success': True,
                'alert': alert_data
            })
        else:
            return Response({
                'success': False,
                'error': '告警触发失败'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except AgentActivityLog.DoesNotExist:
        return Response(
            {'success': False, 'error': f'Activity {activity_id} 不存在'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"[告警触发API] 触发失败: {e}", exc_info=True)
        return Response(
            {'success': False, 'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_cache_stats(request):
    """
    获取风险评估缓存统计

    GET /api/risk-assessment/cache-stats/

    返回：
    {
        "success": true,
        "cache_stats": {
            "total_sessions": 10,
            "total_activities": 150,
            "sessions": {...}
        }
    }
    """
    try:
        cache_stats = RiskAssessmentService.get_cache_stats()

        return Response({
            'success': True,
            'cache_stats': cache_stats
        })

    except Exception as e:
        logger.error(f"[缓存统计API] 获取失败: {e}", exc_info=True)
        return Response(
            {'success': False, 'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def clear_cache(request):
    """
    清空风险评估缓存

    POST /api/risk-assessment/clear-cache/

    请求体：
    {
        "session_id": "session_xxx"  // 可选，不提供则清空所有
    }

    返回：
    {
        "success": true,
        "message": "缓存已清空"
    }
    """
    session_id = request.data.get('session_id')

    try:
        RiskAssessmentService.clear_cache(session_id)

        message = f'会话 {session_id} 缓存已清空' if session_id else '所有缓存已清空'

        logger.info(f"[缓存清空API] {message}")

        return Response({
            'success': True,
            'message': message
        })

    except Exception as e:
        logger.error(f"[缓存清空API] 清空失败: {e}", exc_info=True)
        return Response(
            {'success': False, 'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
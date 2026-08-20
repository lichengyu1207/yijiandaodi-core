"""
Agent活动日志API视图

提供批量上报接口
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone
import logging

from .agent_activity_models import AgentActivityLog, AgentActivityAggregation
from .agent_activity_serializers import (
    AgentActivityLogSerializer,
    AgentActivityBatchSerializer,
)
from .risk_assessment_service import RiskAssessmentService
from .alert_service import AlertService
from .agent_auth import OptionalAgentAPIKeyAuthentication  # 新增：Agent认证

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([OptionalAgentAPIKeyAuthentication])  # 可选Agent认证（向下兼容）
def batch_create_activities(request):
    """
    批量接收Agent活动日志

    POST /api/agent-activities/batch/

    请求头：
    X-Agent-API-Key: <api_key>  // 可选，用于Agent身份认证

    请求体：
    {
        "client_id": "desktop_client_001",
        "session_id": "session_abc123",  // 可选
        "agent_id": "agent_xxx",  // 可选，如果不提供则从API Key获取
        "activities": [
            {
                "agent_type": "cursor",
                "action": "file_operation",
                "target": "/path/to/file.py",
                "risk_level": "high",
                "risk_score": 75,
                "confidence": 0.95,
                "source": "file",
                "timestamp": "2026-08-08T14:30:00Z",
                "metadata": {}
            },
            // ... 最多100条
        ]
    }

    返回：
    {
        "success": true,
        "created_count": 100,
        "alerts_triggered": 2,
        "agent_authenticated": true,  // 是否通过Agent认证
        "message": "批量上报成功"
    }
    """
    serializer = AgentActivityBatchSerializer(data=request.data)

    if not serializer.is_valid():
        logger.error(f"批量上报数据验证失败: {serializer.errors}")
        return Response(
            {
                'success': False,
                'errors': serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        activities_data = serializer.validated_data['activities']
        client_id = serializer.validated_data['client_id']
        session_id = serializer.validated_data.get('session_id', '')
        top_level_agent_id = serializer.validated_data.get('agent_id')  # 请求体中的agent_id

        # 优先使用API Key认证的Agent（request.agent）
        # 如果没有API Key认证，则使用请求体中的agent_id
        authenticated_agent = getattr(request, 'agent', None)

        # 批量创建记录（不触发信号）
        activities = []
        for activity_data in activities_data:
            # Agent身份关联优先级：
            # 1. API Key认证的Agent（request.agent）- 最高优先级
            # 2. activity_data中的agent_id
            # 3. top_level_agent_id（请求体顶层）
            agent_instance = authenticated_agent  # 优先使用API Key认证的Agent

            if not agent_instance:
                # 如果没有API Key认证，尝试从agent_id查询
                agent_id = activity_data.get('agent_id') or top_level_agent_id
                if agent_id:
                    try:
                        from .agent_identity_models import AgentIdentity
                        agent_instance = AgentIdentity.objects.get(agent_id=agent_id)
                    except AgentIdentity.DoesNotExist:
                        logger.warning(f"[批量上报] Agent ID {agent_id} 不存在，将不关联Agent身份")

            activity = AgentActivityLog(
                agent=agent_instance,  # 关联AgentIdentity对象
                agent_type=activity_data['agent_type'],
                action=activity_data['action'],
                target=activity_data['target'],
                risk_level=activity_data['risk_level'],
                risk_score=activity_data['risk_score'],
                confidence=activity_data.get('confidence', 1.0),
                source=activity_data['source'],
                timestamp=activity_data['timestamp'],
                session_id=activity_data.get('session_id') or session_id,
                client_id=activity_data.get('client_id') or client_id,
                metadata=activity_data.get('metadata', {}),
            )
            activities.append(activity)

        # 批量插入数据库（高效，但不触发post_save信号）
        created_activities = AgentActivityLog.objects.bulk_create(activities)

        # 确定是否通过Agent认证
        agent_authenticated = authenticated_agent is not None

        logger.info(
            f"[批量上报] 客户端 {client_id} 上报 {len(created_activities)} 条日志 | "
            f"Agent认证: {agent_authenticated} | "
            f"Agent: {authenticated_agent.agent_name if authenticated_agent else '匿名'}"
        )

        # 关键：手动触发风险评估和告警
        alerts_triggered = 0
        for activity in created_activities:
            try:
                # 风险评估（包含Agent信任级别因素）
                risk_assessment = RiskAssessmentService.assess_activity(activity)

                # 告警处理
                if risk_assessment.should_alert:
                    alert_data = AlertService.handle_alert(activity, risk_assessment)
                    if alert_data:
                        alerts_triggered += 1

            except Exception as e:
                logger.error(
                    f"[风险评估失败] Activity {activity.activity_id}: {e}",
                    exc_info=True
                )

        return Response(
            {
                'success': True,
                'created_count': len(created_activities),
                'alerts_triggered': alerts_triggered,
                'agent_authenticated': agent_authenticated,  # 新增：是否通过Agent认证
                'agent_id': authenticated_agent.agent_id if authenticated_agent else None,
                'message': f'成功接收 {len(created_activities)} 条日志，触发 {alerts_triggered} 次告警',
            },
            status=status.HTTP_201_CREATED
        )

    except Exception as e:
        logger.error(f"[批量上报失败] {e}", exc_info=True)
        return Response(
            {
                'success': False,
                'error': str(e),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([OptionalAgentAPIKeyAuthentication])  # 可选Agent认证（向下兼容）
def get_activities(request):
    """
    查询Agent活动日志

    GET /api/agent-activities/?client_id=xxx&session_id=xxx&risk_level=high

    请求头：
    X-Agent-API-Key: <api_key>  // 可选，用于Agent身份认证

    查询参数：
    - client_id: 客户端ID（必填）
    - session_id: 会话ID（可选）
    - risk_level: 风险等级（可选）
    - agent_type: Agent类型（可选）
    - limit: 返回数量限制（默认100，最多1000）
    """
    client_id = request.query_params.get('client_id')

    if not client_id:
        return Response(
            {'error': 'client_id参数必填'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 构建查询
    queryset = AgentActivityLog.objects.filter(client_id=client_id)

    # 可选过滤
    session_id = request.query_params.get('session_id')
    if session_id:
        queryset = queryset.filter(session_id=session_id)

    risk_level = request.query_params.get('risk_level')
    if risk_level:
        queryset = queryset.filter(risk_level=risk_level)

    agent_type = request.query_params.get('agent_type')
    if agent_type:
        queryset = queryset.filter(agent_type=agent_type)

    # 限制返回数量
    limit = min(int(request.query_params.get('limit', 100)), 1000)
    queryset = queryset[:limit]

    # 序列化
    serializer = AgentActivityLogSerializer(queryset, many=True)

    return Response({
        'success': True,
        'count': len(serializer.data),
        'activities': serializer.data,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_cache_stats(request):
    """
    获取风险评估缓存统计（调试接口）

    GET /api/agent-activities/cache-stats/
    """
    cache_stats = RiskAssessmentService.get_cache_stats()

    return Response({
        'success': True,
        'cache_stats': cache_stats,
    })
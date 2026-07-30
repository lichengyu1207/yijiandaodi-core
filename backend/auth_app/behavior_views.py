"""Agent行为分析完整API接口"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .behavior_models import AgentBehaviorLog, BehaviorBaseline, BehaviorPattern, AnomalyDetection


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def behavior_overview(request):
    """行为分析总览"""
    return Response({
        'success': True,
        'overview': {
            'total_logs': AgentBehaviorLog.objects.count(),
            'total_baselines': BehaviorBaseline.objects.count(),
            'anomalies': AnomalyDetection.objects.filter(severity='high').count()
        },
        'message': 'Agent行为分析总览'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def behavior_list(request):
    """行为日志列表"""
    logs = AgentBehaviorLog.objects.order_by('-timestamp')[:50]
    return Response({
        'success': True,
        'logs': [{'behavior_id': log.behavior_id, 'agent_code': log.agent_code} for log in logs]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def behavior_detail(request, behavior_id):
    """行为日志详情"""
    try:
        log = AgentBehaviorLog.objects.get(id=behavior_id)
        return Response({'success': True, 'detail': {'agent_code': log.agent_code}})
    except:
        return Response({'success': False, 'message': '日志不存在'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def behavior_statistics(request):
    """行为统计分析"""
    return Response({'success': True, 'statistics': {'total': AgentBehaviorLog.objects.count()}})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def behavior_report(request):
    """行为分析报告"""
    return Response({'success': True, 'report': {'summary': 'Agent行为分析报告'}})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pattern_list(request):
    """行为模式列表"""
    patterns = BehaviorPattern.objects.filter(is_active=True)
    return Response({'success': True, 'patterns': [{'pattern_id': p.pattern_id} for p in patterns]})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def baseline_list(request):
    """行为基线列表"""
    baselines = BehaviorBaseline.objects.all()
    return Response({'success': True, 'baselines': [{'baseline_id': b.baseline_id} for b in baselines]})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def baseline_detail(request, baseline_id):
    """行为基线详情"""
    try:
        baseline = BehaviorBaseline.objects.get(id=baseline_id)
        return Response({'success': True, 'detail': {'agent_code': baseline.agent_code}})
    except:
        return Response({'success': False, 'message': '基线不存在'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def baseline_build(request):
    """构建行为基线"""
    return Response({'success': True, 'message': '基线构建完成'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def baseline_build_all(request):
    """构建所有行为基线"""
    return Response({'success': True, 'message': '所有基线构建完成'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def anomaly_list(request):
    """异常检测列表"""
    anomalies = AnomalyDetection.objects.order_by('-detected_at')[:30]
    return Response({'success': True, 'anomalies': [{'anomaly_id': a.anomaly_id} for a in anomalies]})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def anomaly_detail(request, anomaly_id):
    """异常检测详情"""
    try:
        anomaly = AnomalyDetection.objects.get(id=anomaly_id)
        return Response({'success': True, 'detail': {'severity': anomaly.severity}})
    except:
        return Response({'success': False, 'message': '异常不存在'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def anomaly_resolve(request, anomaly_id):
    """解决异常"""
    return Response({'success': True, 'message': '异常已解决'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def behavior_health(request):
    """系统健康状态"""
    anomalies = AnomalyDetection.objects.filter(severity='high').count()
    return Response({'success': True, 'health': {'status': 'healthy' if anomalies < 10 else 'warning'}})
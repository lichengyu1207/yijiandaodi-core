"""Agent健康监控API接口"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from .health_monitor import health_monitor, AgentHeartbeat, AgentBehaviorLoop


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def record_heartbeat(request):
    """Agent心跳上报"""
    agent_code = request.data.get('agent_code')
    task = request.data.get('current_task', '')
    session_id = request.data.get('session_id', '')
    
    result = health_monitor.record_heartbeat(agent_code, task, session_id)
    
    return Response({
        'success': True,
        'heartbeat_result': result,
        'message': '心跳已记录'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_timeout(request):
    """检查Agent超时状态"""
    agent_code = request.query_params.get('agent_code')
    
    status, message = health_monitor.check_timeout(agent_code)
    
    return Response({
        'success': True,
        'agent_code': agent_code,
        'status': status,
        'message': message,
        'recommendation': '立即重启Agent' if status == 'timeout' else '继续监控'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def detect_loop(request):
    """检测Agent行为循环"""
    agent_code = request.data.get('agent_code')
    behavior_data = request.data.get('behavior_data', {})
    
    result = health_monitor.detect_loop(agent_code, behavior_data)
    
    return Response({
        'success': True,
        'loop_detection': result,
        'message': '检测到行为循环' if result['loop_detected'] else '无循环行为'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_business_context(request):
    """检查业务上下文"""
    context = request.data.get('context')
    operation = request.data.get('operation')
    
    result = health_monitor.check_business_context(context, operation)
    
    return Response({
        'success': True,
        'context_check': result,
        'message': result['message']
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def health_summary(request):
    """Agent健康状态总览"""
    agents = request.query_params.getlist('agents', ['auditor', 'verifier', 'archiver', 'judge'])
    
    summary = health_monitor.get_health_summary(agents)
    
    # 统计健康率
    healthy_count = sum(1 for s in summary if s['status'] == 'healthy')
    health_rate = healthy_count / len(summary) * 100 if summary else 0
    
    return Response({
        'success': True,
        'summary': summary,
        'health_rate': health_rate,
        'total_agents': len(summary),
        'healthy_agents': healthy_count
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def heartbeat_history(request):
    """心跳历史记录"""
    agent_code = request.query_params.get('agent_code')
    limit = int(request.query_params.get('limit', 50))
    
    queryset = AgentHeartbeat.objects.all()
    
    if agent_code:
        queryset = queryset.filter(agent_code=agent_code)
    
    heartbeats = queryset.order_by('-heartbeat_time')[:limit]
    
    return Response({
        'success': True,
        'heartbeat_history': [{
            'agent_code': hb.agent_code,
            'current_task': hb.current_task,
            'status': hb.status,
            'heartbeat_time': hb.heartbeat_time.isoformat()
        } for hb in heartbeats]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def loop_detection_history(request):
    """循环检测历史"""
    agent_code = request.query_params.get('agent_code')
    
    queryset = AgentBehaviorLoop.objects.filter(loop_detected=True)
    
    if agent_code:
        queryset = queryset.filter(agent_code=agent_code)
    
    loops = queryset.order_by('-detected_time')[:20]
    
    return Response({
        'success': True,
        'loop_history': [{
            'agent_code': loop.agent_code,
            'behavior_hash': loop.behavior_hash,
            'loop_count': loop.loop_count,
            'detected_time': loop.detected_time.isoformat()
        } for loop in loops]
    })
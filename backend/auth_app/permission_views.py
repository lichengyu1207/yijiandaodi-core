"""权限控制API接口"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from .permission_controller import (
    permission_controller,
    PermissionControlAuditLog,
    AgentRegistry,
    PermissionViolation
)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_permission(request):
    """检查权限是否符合最小权限原则"""
    agent_code = request.data.get('agent_code')
    operation = request.data.get('operation')
    
    allowed, message = permission_controller.check_permission(agent_code, operation)
    
    return Response({
        'success': True,
        'allowed': allowed,
        'message': message,
        'recommendation': '移除过度权限' if not allowed else '符合最小权限原则'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def audit_permission(request):
    """实时权限审计"""
    agent_code = request.data.get('agent_code')
    operation = request.data.get('operation')
    resource = request.data.get('resource')
    
    result = permission_controller.audit_access(agent_code, operation, resource)
    
    return Response({
        'success': True,
        'audit_result': result,
        'recommendation': '拦截访问' if not result['allowed'] else '允许访问'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_agent(request):
    """Agent注册到Registry"""
    agent_code = request.data.get('agent_code')
    permissions = request.data.get('permissions', [])
    
    result = permission_controller.register_agent(agent_code, permissions)
    
    return Response({
        'success': True,
        'registration_result': result,
        'message': 'Agent已注册到Registry'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def detect_shadow_ai(request):
    """检测Shadow AI"""
    shadow_agents = permission_controller.detect_shadow_ai()
    
    return Response({
        'success': True,
        'shadow_agents': shadow_agents,
        'count': len(shadow_agents),
        'message': f'检测到{len(shadow_agents)}个未注册Agent'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def registry_summary(request):
    """Agent Registry总览"""
    total = AgentRegistry.objects.count()
    excessive = AgentRegistry.objects.filter(status='excessive').count()
    
    return Response({
        'success': True,
        'total_registered': total,
        'excessive_permissions': excessive,
        'minimal_compliance_rate': (total - excessive) / total * 100 if total > 0 else 0
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def audit_logs(request):
    """权限审计日志"""
    logs = PermissionControlAuditLog.objects.order_by('-timestamp')[:50]
    
    return Response({
        'success': True,
        'audit_logs': [{
            'agent_code': log.agent_code,
            'operation': log.operation,
            'resource': log.resource,
            'allowed': log.allowed,
            'message': log.message,
            'timestamp': log.timestamp.isoformat()
        } for log in logs]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def violations(request):
    """权限违规记录"""
    violations = PermissionViolation.objects.filter(resolved=False).order_by('-detected_at')
    
    return Response({
        'success': True,
        'violations': [{
            'agent_code': v.agent_code,
            'violation_type': v.violation_type,
            'operation': v.operation,
            'resource': v.resource,
            'severity': v.severity,
            'detected_at': v.detected_at.isoformat()
        } for v in violations]
    })
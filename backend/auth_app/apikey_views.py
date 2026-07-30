"""
API Key视图
生成、管理、验证API Key
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.utils import timezone
import time
import hashlib

from .apikey_models import APIKey, APIKeyUsageLog
from .apikey_serializers import APIKeySerializer, APIKeyGenerateSerializer


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_api_key(request):
    """生成API Key"""
    serializer = APIKeyGenerateSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    # 获取参数
    name = serializer.validated_data.get('name', 'Default API Key')
    permissions = serializer.validated_data.get('permissions', ['read'])
    expires_in_days = serializer.validated_data.get('expires_in_days', 365)
    
    # 创建API Key
    api_key_obj, raw_key = APIKey.create_for_user(
        user=request.user,
        name=name,
        permissions=permissions,
        expires_in_days=expires_in_days
    )
    
    return Response({
        'success': True,
        'api_key': raw_key,  # 只在生成时返回一次
        'name': api_key_obj.name,
        'permissions': api_key_obj.permissions,
        'created_at': api_key_obj.created_at,
        'expires_at': api_key_obj.expires_at
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_api_keys(request):
    """列出用户的所有API Key"""
    api_keys = APIKey.objects.filter(user=request.user)
    serializer = APIKeySerializer(api_keys, many=True)
    
    return Response({
        'success': True,
        'count': api_keys.count(),
        'results': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_api_key(request, key_id):
    """获取单个API Key详情"""
    try:
        api_key = APIKey.objects.get(id=key_id, user=request.user)
    except APIKey.DoesNotExist:
        return Response({
            'success': False,
            'error': 'API Key不存在'
        }, status=status.HTTP_404_NOT_FOUND)
    
    serializer = APIKeySerializer(api_key)
    return Response({
        'success': True,
        'data': serializer.data
    })


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_api_key(request, key_id):
    """删除API Key"""
    try:
        api_key = APIKey.objects.get(id=key_id, user=request.user)
        api_key.delete()
        
        return Response({
            'success': True,
            'message': 'API Key已删除'
        })
    except APIKey.DoesNotExist:
        return Response({
            'success': False,
            'error': 'API Key不存在'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_api_key(request, key_id):
    """更新API Key"""
    try:
        api_key = APIKey.objects.get(id=key_id, user=request.user)
    except APIKey.DoesNotExist:
        return Response({
            'success': False,
            'error': 'API Key不存在'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # 更新字段
    if 'name' in request.data:
        api_key.name = request.data['name']
    if 'permissions' in request.data:
        api_key.permissions = request.data['permissions']
    if 'is_active' in request.data:
        api_key.is_active = request.data['is_active']
    
    api_key.save()
    
    serializer = APIKeySerializer(api_key)
    return Response({
        'success': True,
        'data': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_usage_logs(request, key_id):
    """获取API Key使用日志"""
    try:
        api_key = APIKey.objects.get(id=key_id, user=request.user)
    except APIKey.DoesNotExist:
        return Response({
            'success': False,
            'error': 'API Key不存在'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # 获取日志
    logs = APIKeyUsageLog.objects.filter(api_key=api_key).order_by('-timestamp')[:100]
    
    log_data = [{
        'endpoint': log.endpoint,
        'method': log.method,
        'status_code': log.status_code,
        'response_time_ms': log.response_time_ms,
        'timestamp': log.timestamp,
        'ip_address': log.ip_address
    } for log in logs]
    
    return Response({
        'success': True,
        'api_key_name': api_key.name,
        'logs': log_data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def regenerate_api_key(request, key_id):
    """重新生成API Key"""
    try:
        api_key = APIKey.objects.get(id=key_id, user=request.user)
    except APIKey.DoesNotExist:
        return Response({
            'success': False,
            'error': 'API Key不存在'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # 生成新的密钥
    raw_key = APIKey.generate_key()
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:10]
    
    # 更新记录
    api_key.key_hash = key_hash
    api_key.key_prefix = key_prefix
    api_key.save()
    
    return Response({
        'success': True,
        'api_key': raw_key,  # 只返回一次
        'message': 'API Key已重新生成'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verify_api_key(request):
    """验证API Key（用于测试）"""
    # 检查是否通过API Key认证
    if hasattr(request, 'api_key'):
        api_key_obj = request.api_key
        return Response({
            'success': True,
            'api_key_id': api_key_obj.id,
            'user_id': api_key_obj.user.id,
            'permissions': api_key_obj.permissions
        })
    else:
        # 如果通过JWT认证，也返回成功
        return Response({
            'success': True,
            'user_id': request.user.id,
            'auth_method': 'JWT'
        })
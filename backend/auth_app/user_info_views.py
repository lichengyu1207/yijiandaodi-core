"""
完善后的用户信息API视图
返回完整的用户信息字段
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model

User = get_user_model()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_info(request):
    """
    获取完整用户信息
    包含：基本信息、认证状态、权限信息
    """
    user = request.user
    
    # 基本信息
    user_data = {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'phone': getattr(user, 'phone', None),
        'first_name': user.first_name,
        'last_name': user.last_name,
        'date_joined': user.date_joined.isoformat() if hasattr(user, 'date_joined') else None,
        'last_login': user.last_login.isoformat() if user.last_login else None,
        'is_active': user.is_active,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
    }
    
    # 实名认证信息
    user_data.update({
        'real_name': getattr(user, 'real_name', None),
        'id_card': getattr(user, 'id_card', None),
        'is_realname': getattr(user, 'is_realname', False),
        'face_registered': getattr(user, 'face_registered', False),
    })
    
    # 权限信息
    user_data.update({
        'role': 'admin' if user.is_superuser else ('staff' if user.is_staff else 'user'),
        'permissions': list(user.get_all_permissions()) if hasattr(user, 'get_all_permissions') else [],
    })
    
    # 用户组
    user_data.update({
        'groups': [group.name for group in user.groups.all()] if hasattr(user, 'groups') else [],
    })
    
    return Response({
        'success': True,
        'user': user_data
    })


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_user_info(request):
    """
    更新用户信息
    允许更新：email, first_name, last_name, phone
    """
    user = request.user
    
    # 可更新字段
    allowed_fields = ['email', 'first_name', 'last_name', 'phone']
    
    for field in allowed_fields:
        if field in request.data:
            setattr(user, field, request.data[field])
    
    user.save()
    
    return Response({
        'success': True,
        'message': '用户信息更新成功',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'phone': getattr(user, 'phone', None),
            'first_name': user.first_name,
            'last_name': user.last_name,
        }
    })
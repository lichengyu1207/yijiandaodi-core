"""
实名认证API视图
提供实名认证和状态查询功能
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model
import re

User = get_user_model()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_realname(request):
    """
    实名认证
    参数：
    - name: 真实姓名
    - id_card: 身份证号
    """
    name = request.data.get('name')
    id_card = request.data.get('id_card')
    
    # 验证姓名
    if not name or len(name.strip()) < 2:
        return Response({
            'success': False,
            'error': '请输入正确的姓名'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # 验证身份证号
    id_card_pattern = r'^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$'
    if not re.match(id_card_pattern, id_card):
        return Response({
            'success': False,
            'error': '请输入正确的身份证号'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # 更新用户实名信息
    user = request.user
    user.real_name = name
    user.id_card = id_card[-4:]  # 只存储后4位
    user.is_realname = True
    user.save()
    
    return Response({
        'success': True,
        'user_id': user.id,
        'name': name,
        'is_realname': True,
        'message': '实名认证成功'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verify_status(request):
    """
    查询实名认证状态
    """
    user = request.user
    
    return Response({
        'success': True,
        'user_id': user.id,
        'phone': user.username,
        'name': getattr(user, 'real_name', None),
        'is_realname': getattr(user, 'is_realname', False),
        'face_registered': False,  # 人脸注册状态
        'created_at': user.date_joined.isoformat() if hasattr(user, 'date_joined') else None
    })
"""P1-4 用户个性化数据持久化（账号互通二期）

GET/PUT /api/user/profile/ 读写 主题/布局/收藏。
登录成功后前端拉取覆盖 localStorage，修改时同步保存，重新登录不丢失。
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .user_behavior_models import UserProfile


def _get_or_create_profile(user) -> UserProfile:
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


def _profile_payload(profile: UserProfile) -> dict:
    return {
        'theme': profile.theme or 'default',
        'layout': profile.layout or {},
        'favorites': profile.favorites or [],
    }


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def user_profile(request):
    """读写用户个性化数据（主题 / 布局 / 收藏）"""
    if request.method == 'GET':
        profile = _get_or_create_profile(request.user)
        return Response({
            'success': True,
            'data': _profile_payload(profile),
        })

    data = request.data or {}
    profile = _get_or_create_profile(request.user)
    update_fields = []

    if 'theme' in data:
        profile.theme = str(data['theme'] or '')[:32]
        update_fields.append('theme')
    if 'layout' in data and isinstance(data['layout'], dict):
        profile.layout = data['layout']
        update_fields.append('layout')
    if 'favorites' in data and isinstance(data['favorites'], list):
        profile.favorites = data['favorites']
        update_fields.append('favorites')

    if update_fields:
        update_fields.append('updated_at')
        profile.save(update_fields=update_fields)

    return Response({
        'success': True,
        'data': _profile_payload(profile),
    })

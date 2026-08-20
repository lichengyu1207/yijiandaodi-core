"""
用户自有 API Key 管理视图（P1 消费控制：用户自带 Key，免平台配额）
- POST   /api/apikey/user-key         设置/更新用户自有 Key（加密存储，永不返回明文）
- GET    /api/apikey/user-key/status  验证 Key 有效性 + 返回余额/今日用量/掩码
- DELETE /api/apikey/user-key         删除用户自有 Key
"""

import logging

import requests
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .user_provider_key_models import UserProviderKey
from .crypto_utils import mask_key

logger = logging.getLogger(__name__)


def _verify_deepseek_key(raw_key: str) -> tuple[bool, str]:
    """调用 DeepSeek 官方余额接口验证 Key 有效性，返回 (ok, 余额描述)"""
    try:
        resp = requests.get(
            'https://api.deepseek.com/user/balance',
            headers={'Authorization': f'Bearer {raw_key}', 'Accept': 'application/json'},
            timeout=15,
        )
        if resp.status_code != 200:
            logger.info('[API密钥] 验证失败: status=%s', resp.status_code)
            return False, ''
        data = resp.json()
        if not data.get('is_available'):
            return False, ''
        infos = data.get('balance_infos') or []
        if infos:
            cny = next((b for b in infos if b.get('currency') == 'CNY'), infos[0])
            total = cny.get('total_balance', '')
            return True, f"{cny.get('currency', '')} {total}"
        return True, ''
    except Exception as e:  # noqa: BLE001
        logger.warning('[API密钥] 验证请求异常: %r', e)
        return False, ''


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_user_key(request):
    """设置/更新用户自有 DeepSeek API Key（只存加密值 + 后缀，不回显明文）"""
    api_key = str(request.data.get('api_key', '')).strip()
    if not api_key:
        return Response({'success': False, 'error': 'API Key 不能为空'}, status=status.HTTP_400_BAD_REQUEST)
    if len(api_key) < 8:
        return Response({'success': False, 'error': 'API Key 长度过短，请检查是否完整'}, status=status.HTTP_400_BAD_REQUEST)

    provider = str(request.data.get('provider', 'deepseek')).strip().lower()
    name = str(request.data.get('name', '')).strip()[:100]

    # 写入前先验证（余额非零 / 未过期）
    ok, balance = _verify_deepseek_key(api_key)
    if not ok:
        return Response({
            'success': False,
            'error': 'API Key 无效：余额为零、已过期或密钥错误，请检查后重试',
        }, status=status.HTTP_400_BAD_REQUEST)

    obj, _created = UserProviderKey.objects.update_or_create(
        user=request.user,
        provider=provider,
        defaults={
            'name': name,
            'is_active': True,
        },
    )
    obj.set_key(api_key)
    obj.mark_verified(True, balance)
    # 保存后缀
    obj.save(update_fields=['key_encrypted', 'key_suffix', 'name', 'is_active', 'updated_at'])

    logger.info('[API密钥] 用户 %s 设置自有 %s Key 成功（后缀 %s）',
                request.user.username, provider, obj.key_suffix)
    return Response({
        'success': True,
        'message': 'API Key 已保存并通过验证',
        'data': {
            'provider': obj.provider,
            'name': obj.name,
            'masked': f'sk-****{obj.key_suffix}',
            'balance': obj.balance,
            'lastVerifiedAt': obj.last_verified_at,
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_key_status(request):
    """查看用户自有 Key 状态（掩码 + 余额 + 今日用量；不含明文）"""
    provider = str(request.GET.get('provider', 'deepseek')).strip().lower()
    try:
        obj = UserProviderKey.objects.get(user=request.user, provider=provider)
    except UserProviderKey.DoesNotExist:
        return Response({
            'success': True,
            'data': {
                'hasKey': False,
                'provider': provider,
                'masked': '',
                'name': '',
                'balance': '',
                'todayUsed': 0,
                'lastVerifiedOk': False,
                'lastVerifiedAt': None,
            },
        })

    return Response({
        'success': True,
        'data': {
            'hasKey': obj.is_active,
            'provider': obj.provider,
            'masked': f'sk-****{obj.key_suffix}',
            'name': obj.name,
            'balance': obj.balance,
            'todayUsed': obj.today_used,
            'lastVerifiedOk': obj.last_verified_ok,
            'lastVerifiedAt': obj.last_verified_at,
        },
    })


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_user_key(request):
    """删除用户自有 Key（删除后回退到平台共享额度）"""
    provider = str(request.data.get('provider', 'deepseek')).strip().lower()
    try:
        obj = UserProviderKey.objects.get(user=request.user, provider=provider)
        obj.delete()
        logger.info('[API密钥] 用户 %s 删除自有 %s Key', request.user.username, provider)
        return Response({'success': True, 'message': '已删除自有 API Key，将回退到平台共享额度'})
    except UserProviderKey.DoesNotExist:
        return Response({'success': True, 'message': '无已保存的 Key'})

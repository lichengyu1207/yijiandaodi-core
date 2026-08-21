"""
实名认证API视图
提供实名认证和状态查询功能
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from datetime import date
import re

User = get_user_model()

# GB11643-1999 18 位公民身份号码校验
ID_CARD_PATTERN = re.compile(r'^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dX]$')
ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
ID_CHECK_MAP = '10X98765432'
ID_REGION_PREFIX = {
    '11', '12', '13', '14', '15',
    '21', '22', '23',
    '31', '32', '33', '34', '35', '36', '37',
    '41', '42', '43', '44', '45', '46',
    '50', '51', '52', '53', '54',
    '61', '62', '63', '64', '65',
    '71', '81', '82',
}
NAME_PATTERN = re.compile(r'^[a-zA-Z\u4e00-\u9fa5·\s]{2,30}$')


def id_card_checksum_valid(id_card: str) -> bool:
    """校验 17 位加权取模得到的末位校验码是否一致。"""
    total = sum(int(id_card[i]) * ID_WEIGHTS[i] for i in range(17))
    return ID_CHECK_MAP[total % 11] == id_card[17]


def is_valid_id_card(id_card: str) -> bool:
    """完整校验：格式 + 出生日期真实有效（且非未来）+ 地区码 + 校验位。"""
    id_card = id_card.strip().upper()
    if not ID_CARD_PATTERN.match(id_card):
        return False
    if id_card[:2] not in ID_REGION_PREFIX:
        return False
    try:
        birth = date(int(id_card[6:10]), int(id_card[10:12]), int(id_card[12:14]))
    except ValueError:
        return False
    if birth > date.today():
        return False
    return id_card_checksum_valid(id_card)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_realname(request):
    """
    实名认证
    参数：
    - name: 真实姓名
    - id_card: 身份证号
    """
    name = (request.data.get('name') or '').strip()
    id_card = (request.data.get('id_card') or '').strip().upper()

    # 验证姓名：2~30 位中文/英文（允许名族中间点·与空格），不含数字与符号
    if not NAME_PATTERN.match(name):
        return Response({
            'success': False,
            'error': '请输入正确的姓名（2~30位，中文或英文）'
        }, status=status.HTTP_400_BAD_REQUEST)

    # 验证身份证号：格式 + 地区码 + 出生日期 + GB11643 校验位
    if not is_valid_id_card(id_card):
        return Response({
            'success': False,
            'error': '身份证号校验未通过（请核对号码，含校验位/出生日期）'
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
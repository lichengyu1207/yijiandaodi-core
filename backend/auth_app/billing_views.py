"""套餐/计费实时挂钩 API（需求 4.2.3 两级计费）

- GET /api/billing/summary          → 实时账单摘要（本月已用/套餐剩余/预估费用/建议）
- GET /api/billing/monthly-detail   → 月度账单明细（按天聚合，供账单页展示）

消费数据来自 APICallLog 真实落库，套餐映射见 billing_service。
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
import logging
import secrets

from .billing_service import get_billing_summary, get_monthly_detail, grant_membership
from .payment_models import UserQuota, RedemptionCode, RedemptionRecord

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def billing_summary(request):
    """实时消费账单摘要：本月已用 / 套餐剩余 / 预估费用 / 建议。"""
    summary = get_billing_summary(request.user)
    return Response({'success': True, 'data': summary})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def monthly_bill(request):
    """月度账单明细：按天聚合消费（month 形如 2026-08，缺省为当月）。"""
    month = request.GET.get('month') or None
    detail = get_monthly_detail(request.user, month)
    return Response({'success': True, 'data': detail})


CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def _gen_code(prefix: str = 'YJD') -> str:
    """生成格式 YJD-XXXX-XXXX-XXXX 的唯一兑换码。"""
    while True:
        body = ''.join(secrets.choice(CODE_ALPHABET) for _ in range(12))
        code = f'{prefix}-{body[0:4]}-{body[4:8]}-{body[8:12]}'
        if not RedemptionCode.objects.filter(code=code).exists():
            return code


@api_view(['POST'])
@permission_classes([IsAdminUser])
def generate_redemption_codes(request):
    """管理员成批生成兑换码（可设开通天数/等级/数量/过期时间/备注）。

    body: {days, vip_level, count, total_uses, expire_at, remark}
    """
    days = int(request.data.get('days', 30) or 30)
    vip_level = int(request.data.get('vip_level', 1) or 1)
    count_param = int(request.data.get('count', 1) or 1)
    count = max(1, min(count_param, 500))
    total_uses = int(request.data.get('total_uses', 1) or 1)
    # total_uses>1 表示同码可多次兑换（如活动码全场通用）
    prefix = str(request.data.get('prefix') or 'YJD').upper()[:8]
    expire_at = request.data.get('expire_at')
    remark = str(request.data.get('remark') or '')[:200]
    owner = request.user if request.user.is_authenticated else None

    if days <= 0 or vip_level not in (1, 2, 3):
        return Response({'success': False, 'message': '参数不合法：天数必须>0，等级为1/2/3'}, status=400)

    # total_uses>1 只有一个唯一码；一次性批量码则生成 count 个
    codes = []
    if total_uses > 1:
        code = _gen_code(prefix)
        RedemptionCode.objects.create(
            code=code, owner=owner, days=days, vip_level=vip_level,
            total_uses=total_uses, used_count=0, redeem_code_count=1,
            expire_at=expire_at, remark=remark, status='active')
        codes.append(code)
    else:
        for _ in range(count):
            code = _gen_code(prefix)
            RedemptionCode.objects.create(
                code=code, owner=owner, days=days, vip_level=vip_level,
                total_uses=1, used_count=0, redeem_code_count=count,
                expire_at=expire_at, remark=remark, status='active')
            codes.append(code)

    return Response({'success': True, 'message': f'已生成 {len(codes)} 个兑换码', 'data': {'codes': codes}})


@api_view(['GET'])
@permission_classes([IsAdminUser])
def list_redemption_codes(request):
    """管理员查看已生成的兑换码及使用统计。"""
    rows = RedemptionCode.objects.all().prefetch_related('redemption_records')[:500]
    data = [{
        'code': r.code,
        'days': r.days,
        'vip_level': r.vip_level,
        'total_uses': r.total_uses,
        'used_count': r.used_count,
        'status': r.status,
        'expire_at': r.expire_at.isoformat() if r.expire_at else None,
        'remark': r.remark,
        'created_at': r.created_at.isoformat(),
        'records': [{
            'user_id': rec.user.id if rec.user else None,
            'username': rec.user.username if rec.user else '(已删除)',
            'granted_days': rec.granted_days,
            'new_expire_at': rec.new_expire_at.isoformat() if rec.new_expire_at else None,
            'created_at': rec.created_at.isoformat(),
        } for rec in r.redemption_records.all()],
    } for r in rows]
    return Response({'success': True, 'data': data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def redeem_code(request):
    """用户兑换码：兑换后开通/续期套餐会员。body: {code}"""
    code = str(request.data.get('code') or '').strip().upper()
    if not code:
        return Response({'success': False, 'message': '请输入兑换码'}, status=400)

    try:
        rec = RedemptionCode.objects.get(code=code)
    except RedemptionCode.DoesNotExist:
        return Response({'success': False, 'message': '兑换码无效'}, status=400)

    now = timezone.now()
    if rec.status != 'active':
        return Response({'success': False, 'message': '兑换码已停用'}, status=400)
    if rec.expire_at and rec.expire_at < now:
        return Response({'success': False, 'message': '兑换码已过期'}, status=400)
    if rec.total_uses > 0 and rec.used_count >= rec.total_uses:
        return Response({'success': False, 'message': '兑换码已被兑换完'}, status=400)

    quota, _ = UserQuota.objects.get_or_create(user=request.user)
    new_expire = grant_membership(quota, rec.vip_level, rec.days)

    rec.used_count += 1
    rec.save(update_fields=['used_count'])
    RedemptionRecord.objects.create(
        redemption=rec, user=request.user,
        granted_days=rec.days, granted_level=rec.vip_level, new_expire_at=new_expire)
    logger.info('[兑换] user=%s code=%s -> vip_lv%s %s天, 到期 %s',
                request.user.id, rec.code, rec.vip_level, rec.days, new_expire)

    return Response({
        'success': True,
        'message': f'兑换成功，已开通天数 {rec.days}，到期 {new_expire.strftime("%Y-%m-%d %H:%M")}',
        'data': {'new_expire_at': new_expire.isoformat(), 'vip_level': quota.vip_level},
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def claim_trial(request):
    """一次性免费试用：开通 1 个月基础版（每位用户仅一次，防止刷取）。"""
    quota, _ = UserQuota.objects.get_or_create(user=request.user)
    if quota.trial_claimed:
        return Response({'success': False, 'message': '您已领取过免费试用'}, status=400)
    if quota.is_vip and quota.vip_expire_at and quota.vip_expire_at > timezone.now():
        return Response({'success': False, 'message': '您已是会员账户，无需试用'}, status=400)

    new_expire = grant_membership(quota, 1, 30)
    quota.trial_claimed = True
    quota.save(update_fields=['trial_claimed'])
    logger.info('[试用] user=%s 领取1个月基础版, 到期 %s', request.user.id, new_expire)
    return Response({
        'success': True,
        'message': f'免费试用已开通 30 天，到期 {new_expire.strftime("%Y-%m-%d %H:%M")}',
        'data': {'new_expire_at': new_expire.isoformat(), 'vip_level': 1},
    })

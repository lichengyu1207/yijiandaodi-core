"""套餐/计费实时挂钩 API（需求 4.2.3 两级计费）

- GET /api/billing/summary          → 实时账单摘要（本月已用/套餐剩余/预估费用/建议）
- GET /api/billing/monthly-detail   → 月度账单明细（按天聚合，供账单页展示）

消费数据来自 APICallLog 真实落库，套餐映射见 billing_service。
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .billing_service import get_billing_summary, get_monthly_detail


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

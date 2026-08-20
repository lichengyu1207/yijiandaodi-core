"""套餐/计费实时挂钩服务（需求 4.2.3 两级计费）

把真实消费数据（APICallLog）与套餐模型（saas_pricing + UserQuota）实时挂钩：
- 当前套餐：由 UserQuota.vip_level 映射 saas_pricing 方案（basic/professional/enterprise）
- 本月已用：从 APICallLog 聚合本月真实费用 / 调用次数 / tokens
- 套餐剩余：套餐 api_limit 与本月调用对比；超限部分按 api_call_price 挂账
- 预估费用：按已过天数比例推算月末费用

对外无品牌名、无平台绑定，仅能力透明（free / basic / professional / enterprise）。
"""

import logging
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from .payment_models import UserQuota
from .saas_pricing import saas_pricing_engine

logger = logging.getLogger(__name__)

# vip_level → 套餐类型映射（对应 saas_pricing.pricing_plans 键）
_PLAN_BY_VIP = {0: None, 1: 'basic', 2: 'professional', 3: 'enterprise'}


def _resolve_plan(quota) -> dict:
    """从用户配额状态解析当前套餐；非套餐用户返回免费版。"""
    vip_level = quota.vip_level if quota.is_vip else 0
    plan_type = _PLAN_BY_VIP.get(vip_level)
    if not plan_type:
        return {
            'plan_type': 'free',
            'plan_name': '免费版',
            'monthly_price': 0.0,
            'api_limit': 0,
            'api_call_price': 0.0,
            'is_plan': False,
        }
    plan = saas_pricing_engine.pricing_plans[plan_type]
    return {
        'plan_type': plan_type,
        'plan_name': plan['name'],
        'monthly_price': plan['monthly_price'],
        'api_limit': plan['api_limit'],
        'api_call_price': plan['api_call_price'],
        'is_plan': True,
    }


def _month_bounds(month_key=None):
    """返回 [当月起始, 下月起始) 的 aware datetime；month_key 形如 '2026-08'。"""
    today = timezone.localdate()
    if month_key:
        try:
            year, mon = month_key.split('-')
            start = date(int(year), int(mon), 1)
        except (ValueError, TypeError):
            start = today.replace(day=1)
    else:
        start = today.replace(day=1)
    if start.month == 12:
        end = date(start.year + 1, 1, 1)
    else:
        end = date(start.year, start.month + 1, 1)
    return (
        timezone.make_aware(datetime.combine(start, time.min)),
        timezone.make_aware(datetime.combine(end, time.min)),
    )


def _month_usage(user_id: int, start_dt, end_dt) -> dict:
    """聚合某用户在 [start_dt, end_dt) 区间的真实消费。"""
    from .billing_models import APICallLog

    qs = APICallLog.objects.filter(
        user_id=user_id,
        created_at__gte=start_dt,
        created_at__lt=end_dt,
    )
    agg = qs.aggregate(
        cost=Sum('cost'),
        tokens=Sum('total_tokens'),
        calls=Count('id'),
    )
    return {
        'cost': float(agg['cost'] or Decimal('0')),
        'tokens': int(agg['tokens'] or 0),
        'calls': int(agg['calls'] or 0),
    }


def get_billing_summary(user) -> dict:
    """实时消费账单摘要：本月已用 / 套餐剩余 / 预估费用 / 建议。"""
    quota, _ = UserQuota.objects.get_or_create(user=user)
    plan = _resolve_plan(quota)

    today = timezone.localdate()
    start_dt, end_dt = _month_bounds()
    usage = _month_usage(user.id, start_dt, end_dt)
    start_date = start_dt.date()

    plan_remaining = None
    over_quota_calls = 0
    over_quota_cost = 0.0
    if plan['is_plan'] and plan['api_limit'] > 0:
        plan_remaining = max(0, plan['api_limit'] - usage['calls'])
        if usage['calls'] > plan['api_limit']:
            over_quota_calls = usage['calls'] - plan['api_limit']
            over_quota_cost = round(over_quota_calls * plan['api_call_price'], 2)

    # 预估月末费用：按已过天数比例推算（第 1 天不推算，避免除零）
    days_elapsed = (today - start_date).days + 1
    days_in_month = (end_dt.date() - start_date).days
    if days_elapsed > 0:
        projected_cost = round(usage['cost'] / days_elapsed * days_in_month, 2)
    else:
        projected_cost = usage['cost']

    # 建议动作：免费用户 → 绑定自有 Key 免配额；套餐额度用尽 → 升级；接近上限 → 留意
    if not plan['is_plan']:
        advice = 'bind_key'
    elif plan['api_limit'] > 0 and plan_remaining == 0:
        advice = 'upgrade'
    elif plan['api_limit'] > 0 and usage['calls'] >= plan['api_limit'] * 0.8:
        advice = 'watch'
    else:
        advice = 'ok'

    summary = {
        'month': start_date.strftime('%Y-%m'),
        'plan': plan,
        'usage': usage,
        'plan_remaining': plan_remaining,
        'over_quota': {
            'calls': over_quota_calls,
            'cost': over_quota_cost,
        },
        'projected_month_cost': projected_cost,
        'advice': advice,
        'generated_at': timezone.now().isoformat(),
    }
    logger.info('[账单] 用户 %s 实时账单生成: 月=%s 套餐=%s 费用=%.4f 调用=%d',
                user.id, summary['month'], plan['plan_type'], usage['cost'], usage['calls'])
    return summary


def get_monthly_detail(user, month=None) -> dict:
    """月度账单明细：按天聚合真实消费（含全月补齐的 0 值天）。"""
    from .billing_models import APICallLog

    start_dt, end_dt = _month_bounds(month)
    start_date = start_dt.date()
    rows = list(
        APICallLog.objects.filter(
            user_id=user.id,
            created_at__gte=start_dt,
            created_at__lt=end_dt,
        )
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(
            cost=Sum('cost'),
            tokens=Sum('total_tokens'),
            calls=Count('id'),
        )
        .order_by('day')
    )
    by_day = {
        r['day'].isoformat(): {
            'cost': float(r['cost'] or 0),
            'tokens': int(r['tokens'] or 0),
            'calls': int(r['calls'] or 0),
        }
        for r in rows
    }

    # 补全当月所有日期，保证账单图表连续
    items = []
    day = start_date
    while day < end_dt.date():
        key = day.isoformat()
        row = by_day.get(key, {'cost': 0.0, 'tokens': 0, 'calls': 0})
        items.append({'date': key, **row})
        day += timedelta(days=1)

    return {
        'month': start_date.strftime('%Y-%m'),
        'days': items,
    }

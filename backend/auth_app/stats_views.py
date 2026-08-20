import datetime
from decimal import Decimal
from django.db.models import Sum, Count, Avg, Q, F
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
import hashlib
import time

_stats_cache = {}
CACHE_TTL = 300

from .stats_models import (
    DailyPlatformStats,
    SkillDailyStats,
    AreaClickStats,
    RevenueDailyStats,
)
from .user_behavior_models import UserBehaviorLog
from .mall_models import Product, Order
from .payment_models import PaymentOrder, UserQuota, SkillHotnessSnapshot
from .skill_config_models import SkillConfig


class StatsAggregationEngine:

    @staticmethod
    def aggregate_daily_platform(target_date=None):
        if target_date is None:
            target_date = timezone.now().date()

        day_start = timezone.make_aware(datetime.datetime(target_date.year, target_date.month, target_date.day))
        day_end = day_start + datetime.timedelta(days=1)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        dau_users = UserBehaviorLog.objects.filter(
            created_at__gte=day_start,
            created_at__lt=day_end,
        ).values('user').distinct().count()

        new_users = User.objects.filter(date_joined__gte=day_start, date_joined__lt=day_end).count()
        total_users = User.objects.filter(is_active=True).count()

        total_clicks = UserBehaviorLog.objects.filter(
            created_at__gte=day_start,
            created_at__lt=day_end,
            action_type='click',
        ).count()

        total_executions = UserBehaviorLog.objects.filter(
            created_at__gte=day_start,
            created_at__lt=day_end,
            action_type='execute',
        ).count()

        total_shares = UserBehaviorLog.objects.filter(
            created_at__gte=day_start,
            created_at__lt=day_end,
            action_type='share',
        ).count()

        orders = PaymentOrder.objects.filter(
            created_at__gte=day_start,
            created_at__lt=day_end,
            status='paid',
        )

        paid_orders_count = orders.count()
        gross_revenue = orders.aggregate(s=Sum('amount'))['s'] or Decimal('0')
        avg_order_value = gross_revenue / max(paid_orders_count, 1)
        vip_active = UserQuota.objects.filter(is_vip=True, vip_expire_at__gt=timezone.now()).count()

        free_uses = UserBehaviorLog.objects.filter(
            created_at__gte=day_start,
            created_at__lt=day_end,
            action_type='execute',
            extra_data__use_type='free',
        ).count() or 0

        conversion_rate = round((paid_orders_count / max(dau_users + free_uses, 1)) * 100, 2) if (dau_users + free_uses) > 0 else 0.0

        obj, created = DailyPlatformStats.objects.update_or_create(
            date=target_date,
            defaults={
                'dau': dau_users,
                'new_users': new_users,
                'total_users': total_users,
                'total_clicks': total_clicks,
                'total_executions': total_executions,
                'total_shares': total_shares,
                'paid_uses': paid_orders_count,
                'free_uses': free_uses,
                'conversion_rate': conversion_rate,
                'revenue': gross_revenue,
                'avg_revenue_per_user': avg_order_value,
                'vip_active_count': vip_active,
            },
        )
        return obj

    @staticmethod
    def aggregate_skill_daily(target_date=None):
        if target_date is None:
            target_date = timezone.now().date()

        day_start = timezone.make_aware(datetime.datetime(target_date.year, target_date.month, target_date.day))
        day_end = day_start + datetime.timedelta(days=1)

        skills = SkillConfig.objects.filter(status='active')
        results = []

        for skill in skills:
            clicks = UserBehaviorLog.objects.filter(
                skill_id=str(skill.id),
                created_at__gte=day_start,
                created_at__lt=day_end,
                action_type='click',
            ).count()

            executions = UserBehaviorLog.objects.filter(
                skill_id=str(skill.id),
                created_at__gte=day_start,
                created_at__lt=day_end,
                action_type='execute',
            ).count()

            shares = UserBehaviorLog.objects.filter(
                skill_id=str(skill.id),
                created_at__gte=day_start,
                created_at__lt=day_end,
                action_type='share',
            ).count()

            impressions = UserBehaviorLog.objects.filter(
                skill_id=str(skill.id),
                created_at__gte=day_start,
                created_at__lt=day_end,
            ).count()

            click_rate = round((clicks / max(impressions, 1)) * 100, 2) if impressions > 0 else 0.0
            execution_rate = round((executions / max(clicks, 1)) * 100, 2) if clicks > 0 else 0.0

            order_revenue = PaymentOrder.objects.filter(
                created_at__gte=day_start,
                created_at__lt=day_end,
                status='paid',
                order_type='per_use',
                extra_data__icontains=str(skill.id),
            ).aggregate(s=Sum('amount'))['s'] or Decimal('0')

            hotness_snap = SkillHotnessSnapshot.objects.filter(
                skill_id=skill.id,
                hour_key=target_date.strftime('%Y%m%d') + '23',
            ).first()

            obj, _ = SkillDailyStats.objects.update_or_create(
                date=target_date,
                skill_id=skill.id,
                defaults={
                    'skill_name': skill.name[:100],
                    'skill_tier': skill.tier or '',
                    'skill_category': skill.category or '',
                    'impressions': impressions,
                    'clicks': clicks,
                    'executions': executions,
                    'shares': shares,
                    'click_rate': click_rate,
                    'execution_rate': execution_rate,
                    'hotness': float(hotness_snap.normalized_hotness) if hotness_snap else 0.0,
                    'rank': hotness_snap.rank if hotness_snap else None,
                    'revenue': order_revenue,
                },
            )
            results.append(obj)

        return results

    @staticmethod
    def aggregate_area_clicks(target_date=None):
        if target_date is None:
            target_date = timezone.now().date()

        day_start = timezone.make_aware(datetime.datetime(target_date.year, target_date.month, target_date.day))
        day_end = day_start + datetime.timedelta(days=1)

        area_types = [at[0] for at in AreaClickStats.AREA_TYPE_CHOICES]
        results = []

        for area_type in area_types:
            logs = UserBehaviorLog.objects.filter(
                created_at__gte=day_start,
                created_at__lt=day_end,
                extra_data__source_area=area_type,
            )

            impressions = logs.count()
            clicks = logs.filter(action_type='click').count()
            uv = logs.values('user').distinct().count()
            click_rate = round((clicks / max(impressions, 1)) * 100, 2) if impressions > 0 else 0.0

            top_skill = logs.filter(action_type='click').values('skill_id').annotate(
                c=Count('id')
            ).order_by('-c').first()

            top_item_id = str(top_skill['skill_id']) if top_skill else ''
            top_item_name = ''
            top_item_clicks = top_skill['c'] if top_skill else 0

            if top_item_id and top_item_id.isdigit():
                try:
                    s = SkillConfig.objects.get(id=int(top_item_id))
                    top_item_name = s.name[:100]
                except SkillConfig.DoesNotExist:
                    pass

            obj, _ = AreaClickStats.objects.update_or_create(
                date=target_date,
                area_type=area_type,
                defaults={
                    'impressions': impressions,
                    'clicks': clicks,
                    'unique_visitors': uv,
                    'click_rate': click_rate,
                    'top_clicked_item_id': top_item_id,
                    'top_clicked_item_name': top_item_name,
                    'top_item_clicks': top_item_clicks,
                },
            )
            results.append(obj)

        return results

    @staticmethod
    def aggregate_revenue_daily(target_date=None):
        if target_date is None:
            target_date = timezone.now().date()

        day_start = timezone.make_aware(datetime.datetime(target_date.year, target_date.month, target_date.day))
        day_end = day_start + datetime.timedelta(days=1)

        all_orders = PaymentOrder.objects.filter(
            created_at__gte=day_start,
            created_at__lt=day_end,
        )
        paid_orders = all_orders.filter(status='paid')
        refund_orders = all_orders.filter(status='refunded')

        gross_revenue = paid_orders.aggregate(s=Sum('amount'))['s'] or Decimal('0')
        refund_amount = refund_orders.aggregate(s=Sum('amount'))['s'] or Decimal('0')
        net_revenue = gross_revenue - refund_amount

        order_type_map = {
            'per_use': 'per_use_orders',
            'vip_monthly': 'monthly_orders',
            'vip_yearly_199': 'yearly_199_orders',
            'vip_yearly_599': 'yearly_599_orders',
            'vip_enterprise': 'enterprise_orders',
            'combo_security': 'combo_security_orders',
            'combo_content': 'combo_content_orders',
            'combo_enterprise_full': 'combo_enterprise_orders',
        }
        type_counts = {}
        for ot, field in order_type_map.items():
            cnt = paid_orders.filter(order_type=ot).count()
            type_counts[field] = cnt

        avg_val = gross_revenue / max(paid_orders.count(), 1)

        from .affiliate_models import CommissionRecord
        commission_total = CommissionRecord.objects.filter(
            created_at__gte=day_start,
            created_at__lt=day_end,
            status='settled',
        ).aggregate(s=Sum('commission_amount'))['s'] or Decimal('0')

        obj, created = RevenueDailyStats.objects.update_or_create(
            date=target_date,
            defaults={
                'gross_revenue': gross_revenue,
                'net_revenue': net_revenue,
                'refund_amount': refund_amount,
                'order_count': all_orders.count(),
                'paid_order_count': paid_orders.count(),
                'refund_order_count': refund_orders.count(),
                'avg_order_value': avg_val,
                **type_counts,
                'commission_paid': commission_total,
                'affiliate_revenue': commission_total,
            },
        )
        return obj


def _parse_date_range(request, default_days=7):
    """
    统一时间范围解析（P1-1 统计一期）。
    优先使用 start_date/end_date；否则回退到 days 参数（向后兼容）。
    边界：最大跨度受 settings.STATS_MAX_RANGE_DAYS 限制，防止超大范围查询拖垮数据库。
    返回 (start_dt, end_dt, span_days, granularity)。
    """
    from django.conf import settings
    max_days = getattr(settings, 'STATS_MAX_RANGE_DAYS', 730)

    today = timezone.now().date()
    try:
        days = int(request.GET.get('days', default_days))
    except (TypeError, ValueError):
        days = default_days
    days = max(1, min(days, max_days))

    def _to_date(s, fallback):
        try:
            return datetime.datetime.strptime(s, '%Y-%m-%d').date()
        except (TypeError, ValueError):
            return fallback

    start_date = _to_date(request.GET.get('start_date', ''), today - datetime.timedelta(days=days - 1))
    end_date = _to_date(request.GET.get('end_date', ''), today)
    if start_date > end_date:
        start_date, end_date = end_date, start_date
    span = (end_date - start_date).days + 1
    # 边界：超出最大跨度时，保留 end_date，向前收敛 start_date
    if span > max_days:
        start_date = end_date - datetime.timedelta(days=max_days - 1)
        span = max_days

    start_dt = timezone.make_aware(datetime.datetime(start_date.year, start_date.month, start_date.day))
    end_dt = timezone.make_aware(datetime.datetime(end_date.year, end_date.month, end_date.day)) + datetime.timedelta(days=1)

    granularity = request.GET.get('granularity', '')
    if not granularity:
        if span <= 1:
            granularity = 'hour'
        elif span <= 30:
            granularity = 'day'
        elif span <= 90:
            granularity = 'week'
        else:
            granularity = 'month'
    return start_dt, end_dt, span, granularity


def _get_cached_stats(cache_key):
    if cache_key in _stats_cache:
        cached_data, timestamp = _stats_cache[cache_key]
        if time.time() - timestamp < CACHE_TTL:
            return cached_data
    return None

def _set_cached_stats(cache_key, data):
    _stats_cache[cache_key] = (data, time.time())


def _percentile(values, p):
    """线性插值百分位计算；空列表返回 0。

    Args:
        values: 数值列表
        p: 百分位（0-100），如 50 / 95 / 99
    """
    if not values:
        return 0
    sorted_vals = sorted(values)
    k = (len(sorted_vals) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(sorted_vals) - 1)
    return sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f)


def _build_trend_buckets(start_dt, end_dt, granularity):
    """生成 [start_dt, end_dt) 的时间桶边界（hour/day/week/month）。

    Returns:
        list[(bucket_start, bucket_end), ...]
    """
    if granularity not in ('hour', 'day', 'week', 'month'):
        granularity = 'day'

    buckets = []
    cur = start_dt
    while cur < end_dt:
        if granularity == 'hour':
            nxt = cur + datetime.timedelta(hours=1)
        elif granularity == 'week':
            nxt = cur + datetime.timedelta(days=7)
        elif granularity == 'month':
            year = cur.year + (1 if cur.month == 12 else 0)
            month = 1 if cur.month == 12 else cur.month + 1
            day = min(cur.day, 28)
            nxt = timezone.make_aware(datetime.datetime(year, month, day))
        else:  # day
            nxt = cur + datetime.timedelta(days=1)

        if nxt > end_dt:
            nxt = end_dt
        if nxt <= cur:
            break
        buckets.append((cur, nxt))
        cur = nxt
    return buckets


def _mark_anomalies(points, value_key='value'):
    """3σ 异常点检测：对时间序列按 value_key 标记异常（> mean + 3σ）。

    Args:
        points: dict 列表（原地写入 'anomaly' 字段）
        value_key: 参与检测的字段名
    """
    values = [p.get(value_key, 0) for p in points]
    if len(values) >= 3:
        mean = sum(values) / len(values)
        var = sum((v - mean) ** 2 for v in values) / len(values)
        std = var ** 0.5
        threshold = mean + 3 * std if std > 0 else float('inf')
        anomalies = {i for i, v in enumerate(values) if v > threshold}
    else:
        anomalies = set()
    for i, p in enumerate(points):
        p['anomaly'] = i in anomalies


def _mark_hourly_anomalies(matrix, regions):
    """每小时热力图 3σ 异常标记：对每区域的 calls 序列标记异常（> mean + 3σ）。

    Args:
        matrix: [{ hour, region, calls, ... }]（原地写入 'anomaly' 字段）
        regions: 参与检测的区域列表
    """
    for reg in regions:
        cells = [c for c in matrix if c['region'] == reg]
        values = [float(c.get('calls', 0)) for c in cells]
        if len(values) >= 3:
            mean = sum(values) / len(values)
            var = sum((v - mean) ** 2 for v in values) / len(values)
            std = var ** 0.5
            threshold = mean + 3 * std if std > 0 else float('inf')
        else:
            threshold = float('inf')
        for c in cells:
            c['anomaly'] = float(c.get('calls', 0)) > threshold


class StatsViewSet(viewsets.ViewSet):

    @action(detail=False, methods=['get'], url_path='overview')
    def overview(self, request):
        start_dt, end_dt, days, granularity = _parse_date_range(request, 7)
        cache_key = f'overview_{start_dt.date()}_{end_dt.date()}'
        cached = _get_cached_stats(cache_key)
        if cached:
            return Response(cached)

        today = timezone.now().date()
        start_date = start_dt.date()

        from django.contrib.auth import get_user_model
        User = get_user_model()

        dau = UserBehaviorLog.objects.filter(
            created_at__gte=start_dt,
            created_at__lt=end_dt,
        ).values('user').distinct().count()

        new_users = User.objects.filter(
            date_joined__gte=start_dt,
            date_joined__lt=end_dt,
            is_active=True,
        ).count()

        total_users = User.objects.filter(is_active=True).count()

        total_clicks = UserBehaviorLog.objects.filter(
            created_at__gte=start_dt,
            created_at__lt=end_dt,
            action='click',
        ).count()

        total_executions = UserBehaviorLog.objects.filter(
            created_at__gte=start_dt,
            created_at__lt=end_dt,
            action='execute',
        ).count()

        total_shares = UserBehaviorLog.objects.filter(
            created_at__gte=start_dt,
            created_at__lt=end_dt,
            action='share',
        ).count()

        paid_orders = PaymentOrder.objects.filter(
            created_at__gte=start_dt,
            created_at__lt=end_dt,
            status='paid',
        )
        paid_orders_count = paid_orders.count()
        gross_revenue = paid_orders.aggregate(s=Sum('amount'))['s'] or Decimal('0')

        vip_active = UserQuota.objects.filter(
            is_vip=True,
            vip_expire_at__gt=timezone.now(),
        ).count()

        free_executions = UserBehaviorLog.objects.filter(
            created_at__gte=start_dt,
            created_at__lt=end_dt,
            action='execute',
        ).count()
        conversion_rate = round((paid_orders_count / max(free_executions, 1)) * 100, 2) if free_executions > 0 else 0.0

        chart_data = []
        for d in range(days):
            day = start_date + datetime.timedelta(days=d)
            day_start = timezone.make_aware(datetime.datetime(day.year, day.month, day.day))
            day_end = day_start + datetime.timedelta(days=1)

            day_dau = UserBehaviorLog.objects.filter(
                created_at__gte=day_start, created_at__lt=day_end,
            ).values('user').distinct().count()
            day_new = User.objects.filter(
                date_joined__gte=day_start, date_joined__lt=day_end, is_active=True,
            ).count()
            day_clicks = UserBehaviorLog.objects.filter(
                created_at__gte=day_start, created_at__lt=day_end, action='click',
            ).count()
            day_exec = UserBehaviorLog.objects.filter(
                created_at__gte=day_start, created_at__lt=day_end, action='execute',
            ).count()
            day_rev = PaymentOrder.objects.filter(
                created_at__gte=day_start, created_at__lt=day_end, status='paid',
            ).aggregate(s=Sum('amount'))['s'] or Decimal('0')
            day_orders = PaymentOrder.objects.filter(
                created_at__gte=day_start, created_at__lt=day_end, status='paid',
            ).count()
            day_free = UserBehaviorLog.objects.filter(
                created_at__gte=day_start, created_at__lt=day_end, action='execute',
            ).count()
            day_paid_o = PaymentOrder.objects.filter(
                created_at__gte=day_start, created_at__lt=day_end, status='paid',
            ).count()

            chart_data.append({
                'date': day.isoformat(),
                'dau': day_dau,
                'new_users': day_new,
                'clicks': day_clicks,
                'executions': day_exec,
                'revenue': float(day_rev),
                'conversion_rate': round((day_paid_o / max(day_free, 1)) * 100, 2) if day_free > 0 else 0.0,
                'paid_uses': day_paid_o,
                'free_uses': day_free,
                'gross_revenue': float(day_rev),
                'orders': day_orders,
            })

        response_data = {
            'success': True,
            'data': {
                'summary': {
                    'total_dau_avg': round(dau / max(days, 1), 1),
                    'total_new_users': new_users,
                    'total_clicks': total_clicks,
                    'total_executions': total_executions,
                    'total_shares': total_shares,
                    'total_revenue': float(gross_revenue),
                    'avg_conversion_rate': conversion_rate,
                    'total_gross_revenue': float(gross_revenue),
                    'total_net_revenue': float(gross_revenue),
                    'total_orders': paid_orders_count,
                    'total_refunds': PaymentOrder.objects.filter(
                        created_at__gte=start_dt, created_at__lt=end_dt, status='refunded',
                    ).count(),
                    'period_days': days,
                },
                'chart_data': chart_data,
                'latest_date': today.isoformat(),
            },
        }
        _set_cached_stats(cache_key, response_data)
        return Response(response_data)

    @action(detail=False, methods=['get'], url_path='skills')
    def skills(self, request):
        try:
            start_dt, end_dt, days, granularity = _parse_date_range(request, 7)
            category_filter = request.GET.get('category', '')
            tier_filter = request.GET.get('tier', '')
            sort_by = request.GET.get('sort_by', '-clicks')
            cache_key = f'skills_{start_dt.date()}_{end_dt.date()}_{category_filter}_{tier_filter}_{sort_by}'
            cached = _get_cached_stats(cache_key)
            if cached:
                return Response(cached)

            limit = min(int(request.GET.get('limit', 50)), 200)

            skills_qs = SkillConfig.objects.filter(status='online')
            if category_filter:
                skills_qs = skills_qs.filter(category=category_filter)
            if tier_filter:
                skills_qs = skills_qs.filter(tier=tier_filter)

            items = []
            for skill in skills_qs:
                clicks = UserBehaviorLog.objects.filter(
                    skill_id=str(skill.id),
                    created_at__gte=start_dt,
                    created_at__lt=end_dt,
                    action='click',
                ).count()
                executions = UserBehaviorLog.objects.filter(
                    skill_id=str(skill.id),
                    created_at__gte=start_dt,
                    created_at__lt=end_dt,
                    action='execute',
                ).count()
                shares = UserBehaviorLog.objects.filter(
                    skill_id=str(skill.id),
                    created_at__gte=start_dt,
                    created_at__lt=end_dt,
                    action='share',
                ).count()
                impressions = UserBehaviorLog.objects.filter(
                    skill_id=str(skill.id),
                    created_at__gte=start_dt,
                    created_at__lt=end_dt,
                ).count()

                click_rate = round((clicks / max(impressions, 1)) * 100, 2) if impressions > 0 else 0.0
                execution_rate = round((executions / max(clicks, 1)) * 100, 2) if clicks > 0 else 0.0
                conv_rate = round((executions / max(clicks, 1)) * 100, 2) if clicks > 0 else 0.0

                order_rev = PaymentOrder.objects.filter(
                    created_at__gte=start_dt,
                    created_at__lt=end_dt,
                    status='paid',
                    extra_data__icontains=str(skill.id),
                ).aggregate(s=Sum('amount'))['s'] or Decimal('0')

                items.append({
                    'skill_id': skill.id,
                    'skill_name': skill.name,
                    'tier': skill.tier or '',
                    'category': skill.category or '',
                    'impressions': impressions,
                    'clicks': clicks,
                    'executions': executions,
                    'shares': shares,
                    'revenue': float(order_rev),
                    'click_rate': click_rate,
                    'execution_rate': execution_rate,
                    'conversion_rate': conv_rate,
                    'days_active': 1 if (clicks > 0 or executions > 0) else 0,
                })

            sort_field = sort_by.lstrip('-')
            reverse = sort_by.startswith('-')
            items.sort(key=lambda x: x.get(sort_field, 0), reverse=reverse)
            items = items[:limit]

            categories = list(skills_qs.values_list('category', flat=True).distinct().exclude(category=''))
            tiers = list(skills_qs.values_list('tier', flat=True).distinct().exclude(tier=''))

            response_data = {
                'success': True,
                'data': {
                    'items': items,
                    'total': len(items),
                    'categories': categories,
                    'tiers': tiers,
                    'period_days': days,
                },
            }
            _set_cached_stats(cache_key, response_data)
            return Response(response_data)
        except Exception as e:
            return Response({'success': True, 'data': {'items': [], 'total': 0, 'categories': [], 'tiers': [], 'period_days': days}})

    @action(detail=False, methods=['get'], url_path='areas')
    def areas(self, request):
        try:
            start_dt, end_dt, days, granularity = _parse_date_range(request, 7)
            cache_key = f'areas_{start_dt.date()}_{end_dt.date()}'
            cached = _get_cached_stats(cache_key)
            if cached:
                return Response(cached)

            start_date = start_dt.date()

            area_labels = dict(AreaClickStats.AREA_TYPE_CHOICES)
            items = []
            trend_data = {}

            for area_type, label in AreaClickStats.AREA_TYPE_CHOICES:
                logs = UserBehaviorLog.objects.filter(
                    created_at__gte=start_dt,
                    created_at__lt=end_dt,
                    extra_data__source_area=area_type,
                )
                impressions = logs.count()
                clicks = logs.filter(action='click').count()
                uv = logs.values('user').distinct().count()
                ctr = round((clicks / max(impressions, 1)) * 100, 2) if impressions > 0 else 0.0

                top_skill = logs.filter(action='click').values('skill_id').annotate(
                    c=Count('id')
                ).order_by('-c').first()

                items.append({
                    'area_type': area_type,
                    'area_label': label,
                    'impressions': impressions,
                    'clicks': clicks,
                    'uv': uv,
                    'ctr': ctr,
                    'avg_ctr': ctr,
                    'days_active': 1 if clicks > 0 else 0,
                    'top_clicked_item_id': str(top_skill['skill_id']) if top_skill else '',
                    'top_clicked_item_name': '',
                    'top_item_clicks': top_skill['c'] if top_skill else 0,
                })

                daily = []
                for d in range(days):
                    day = start_date + datetime.timedelta(days=d)
                    day_start = timezone.make_aware(datetime.datetime(day.year, day.month, day.day))
                    day_end = day_start + datetime.timedelta(days=1)
                    d_imp = UserBehaviorLog.objects.filter(
                        created_at__gte=day_start, created_at__lt=day_end,
                        extra_data__source_area=area_type,
                    ).count()
                    d_clk = UserBehaviorLog.objects.filter(
                        created_at__gte=day_start, created_at__lt=day_end,
                        extra_data__source_area=area_type, action='click',
                    ).count()
                    daily.append({
                        'date': day.isoformat(),
                        'clicks': d_clk,
                        'impressions': d_imp,
                        'ctr': round((d_clk / max(d_imp, 1)) * 100, 2) if d_imp > 0 else 0.0,
                    })
                trend_data[area_type] = daily

            response_data = {
                'success': True,
                'data': {
                    'summary': items,
                    'trend': trend_data,
                    'period_days': days,
                },
            }
            _set_cached_stats(cache_key, response_data)
            return Response(response_data)
        except Exception as e:
            return Response({'success': True, 'data': {'summary': [], 'trend': {}, 'period_days': days}})

    @action(detail=False, methods=['get'], url_path='revenue')
    def revenue(self, request):
        start_dt, end_dt, days, granularity = _parse_date_range(request, 30)
        cache_key = f'revenue_{start_dt.date()}_{end_dt.date()}'
        cached = _get_cached_stats(cache_key)
        if cached:
            return Response(cached)

        start_date = start_dt.date()

        all_orders = PaymentOrder.objects.filter(
            created_at__gte=start_dt,
            created_at__lt=end_dt,
        )
        paid_orders = all_orders.filter(status='paid')
        refund_orders = all_orders.filter(status='refunded')

        gross_revenue = paid_orders.aggregate(s=Sum('amount'))['s'] or Decimal('0')
        refund_amount = refund_orders.aggregate(s=Sum('amount'))['s'] or Decimal('0')
        net_revenue = gross_revenue - refund_amount
        paid_count = paid_orders.count()
        total_count = all_orders.count()
        refund_count = refund_orders.count()
        avg_order_value = gross_revenue / max(paid_count, 1)
        vip_active = UserQuota.objects.filter(is_vip=True, vip_expire_at__gt=timezone.now()).count()

        order_types = ['per_use', 'vip_monthly', 'vip_yearly_199', 'vip_yearly_599',
                       'vip_enterprise', 'combo_security', 'combo_content', 'combo_enterprise_full']
        package_breakdown = {}
        for ot in order_types:
            package_breakdown[ot] = paid_orders.filter(order_type=ot).count()

        chart_data = []
        for d in range(days):
            day = start_date + datetime.timedelta(days=d)
            day_start = timezone.make_aware(datetime.datetime(day.year, day.month, day.day))
            day_end = day_start + datetime.timedelta(days=1)

            d_gross = PaymentOrder.objects.filter(
                created_at__gte=day_start, created_at__lt=day_end, status='paid',
            ).aggregate(s=Sum('amount'))['s'] or Decimal('0')
            d_refund = PaymentOrder.objects.filter(
                created_at__gte=day_start, created_at__lt=day_end, status='refunded',
            ).aggregate(s=Sum('amount'))['s'] or Decimal('0')
            d_paid = PaymentOrder.objects.filter(
                created_at__gte=day_start, created_at__lt=day_end, status='paid',
            ).count()
            d_refund_c = PaymentOrder.objects.filter(
                created_at__gte=day_start, created_at__lt=day_end, status='refunded',
            ).count()

            chart_data.append({
                'date': day.isoformat(),
                'gross_revenue': float(d_gross),
                'net_revenue': float(d_gross - d_refund),
                'orders': d_paid,
                'refunds': d_refund_c,
                'aov': float(d_gross / max(d_paid, 1)),
                'commission': 0,
                'vip_active': vip_active,
            })

        response_data = {
            'success': True,
            'data': {
                'summary': {
                    'total_gross_revenue': float(gross_revenue),
                    'total_net_revenue': float(net_revenue),
                    'total_orders': paid_count,
                    'total_refunds': refund_count,
                    'avg_order_value': float(avg_order_value),
                    'avg_conversion_rate': round((paid_count / max(total_count, 1)) * 100, 2) if total_count > 0 else 0.0,
                    'total_commission': 0.0,
                    'total_vip_active': vip_active,
                    'total_new_vip': 0,
                },
                'package_breakdown': package_breakdown,
                'chart_data': chart_data,
                'period_days': days,
            },
        }
        _set_cached_stats(cache_key, response_data)
        return Response(response_data)

    @action(detail=False, methods=['get'], url_path='by-region')
    def by_region(self, request):
        """区域维度统计（P1-1）：按区域聚合 API 调用消耗。

        GET /api/stats/by-region?start_date=&end_date=&region=cn|us|eu|all
        返回 [{ region, label, total, count, avg, error_count, error_rate, share }]
        """
        from .apikey_models import APIKeyUsageLog
        try:
            start_dt, end_dt, days, granularity = _parse_date_range(request, 7)
            region_filter = request.GET.get('region', '')
            cache_key = f'by_region_{start_dt.date()}_{end_dt.date()}_{region_filter}'
            cached = _get_cached_stats(cache_key)
            if cached:
                return Response(cached)

            qs = APIKeyUsageLog.objects.filter(
                timestamp__gte=start_dt,
                timestamp__lt=end_dt,
            )
            if region_filter:
                qs = qs.filter(region=region_filter)

            region_agg = (
                qs.values('region')
                .annotate(
                    count=Count('id'),
                    total_latency=Sum('response_time_ms'),
                    error_count=Count('id', filter=Q(status_code__gte=400)),
                )
            )

            labels = dict(APIKeyUsageLog.REGION_CHOICES)
            items = []
            grand_total = sum(r['count'] for r in region_agg)
            for r in region_agg:
                count = r['count']
                avg = round((r['total_latency'] or 0) / max(count, 1), 1)
                error_rate = round(r['error_count'] / max(count, 1) * 100, 2)
                items.append({
                    'region': r['region'],
                    'label': labels.get(r['region'], r['region']),
                    'total': count,
                    'count': count,
                    'avg': avg,
                    'error_count': r['error_count'],
                    'error_rate': error_rate,
                    'share': round(count / max(grand_total, 1) * 100, 2),
                })

            seen = {it['region'] for it in items}
            for reg, lab in labels.items():
                if reg not in seen:
                    items.append({
                        'region': reg, 'label': lab, 'total': 0, 'count': 0,
                        'avg': 0, 'error_count': 0, 'error_rate': 0, 'share': 0,
                    })
            items.sort(key=lambda x: x['count'], reverse=True)

            response_data = {
                'success': True,
                'data': {
                    'items': items,
                    'total': grand_total,
                    'period_days': days,
                    'granularity': granularity,
                },
            }
            _set_cached_stats(cache_key, response_data)
            return Response(response_data)
        except Exception:
            return Response({'success': True, 'data': {'items': [], 'total': 0, 'period_days': days}})

    @action(detail=False, methods=['get'], url_path='trend')
    def trend(self, request):
        """消费趋势统计（P2 分析一期）。

        GET /api/stats/trend?field=cost|count|error_rate&granularity=day&range=30d
        返回 data.trend = [{ date, value, p50, p95, p99, calls, anomaly }]
        - value: 按 field 聚合（cost=费用合计 / count=调用数 / error_rate=错误率%）
        - p50/p95/p99: 桶内单次调用费用分位（线性插值）
        - anomaly: 超过均值+3σ 的异常点标记
        """
        from .billing_models import APICallLog
        try:
            start_dt, end_dt, days, granularity = _parse_date_range(request, 30)
            field = request.GET.get('field', 'cost')
            if field not in ('cost', 'count', 'error_rate'):
                field = 'cost'
            gran = request.GET.get('granularity', '') or granularity
            if gran not in ('hour', 'day', 'week', 'month'):
                gran = 'day'

            qs = APICallLog.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt)

            buckets = _build_trend_buckets(start_dt, end_dt, gran)
            from django.conf import settings
            max_buckets = getattr(settings, 'STATS_MAX_BUCKETS', 2000)
            if len(buckets) > max_buckets:
                return Response(
                    {'success': False, 'error': f'时间跨度过大（{len(buckets)} 个桶，上限 {max_buckets}），请缩短范围或降低粒度'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            points = []
            for b_start, b_end in buckets:
                logs = list(qs.filter(created_at__gte=b_start, created_at__lt=b_end))
                costs = [float(x.cost or 0) for x in logs]
                errs = [1 if x.status == 'error' else 0 for x in logs]

                if field == 'cost':
                    value = round(sum(costs), 6)
                elif field == 'count':
                    value = len(logs)
                else:  # error_rate
                    value = round((sum(errs) / max(len(logs), 1)) * 100, 2)

                points.append({
                    'date': b_start.isoformat(),
                    'value': value,
                    'p50': round(_percentile(costs, 50), 6),
                    'p95': round(_percentile(costs, 95), 6),
                    'p99': round(_percentile(costs, 99), 6),
                    'calls': len(logs),
                })

            _mark_anomalies(points, 'value')

            total_cost = round(sum(float(x.cost or 0) for x in qs), 6)
            total_calls = qs.count()
            error_calls = qs.filter(status='error').count()

            return Response({'success': True, 'data': {
                'field': field,
                'granularity': gran,
                'period_days': days,
                'trend': points,
                'summary': {
                    'total_cost': total_cost,
                    'total_calls': total_calls,
                    'avg_cost_per_call': round(total_cost / max(total_calls, 1), 6),
                    'error_rate': round(error_calls / max(total_calls, 1) * 100, 2),
                },
            }})
        except Exception:
            return Response({'success': True, 'data': {
                'field': 'cost', 'granularity': 'day', 'period_days': 30,
                'trend': [], 'summary': {},
            }})

    @action(detail=False, methods=['get'], url_path='hourly')
    def hourly(self, request):
        """每小时区域监控热力图（P2 统计二期，§3.2.3）。

        GET /api/stats/hourly?region=cn|us|eu|all&start_date=&end_date=&days=&hour=2026-08-18T14
        返回 data：
        - hours：范围内每个整点标签（YYYY-MM-DDTHH，升序）
        - regions：区域列表
        - matrix：[{ hour, region, calls, errors, avg_latency, cost, anomaly }]（含零值桶）
        - summary：{ total_calls, total_errors, avg_latency, cost, anomaly_count }
        - 传入 hour 时附加 top_calls（该小时 Top 10 调用明细），matrix 精确过滤到该小时
        """
        from .apikey_models import APIKeyUsageLog
        from .stats_models import HourlyRegionStats
        from django.db.models.functions import TruncHour

        try:
            start_dt, end_dt, days, granularity = _parse_date_range(request, 7)
            region_filter = request.GET.get('region', '')
            hour_param = request.GET.get('hour', '')
            if region_filter not in ('', 'cn', 'us', 'eu', 'all'):
                region_filter = ''

            qs = APIKeyUsageLog.objects.filter(timestamp__gte=start_dt, timestamp__lt=end_dt)
            if region_filter:
                qs = qs.filter(region=region_filter)

            agg = list(
                qs.annotate(hour_bucket=TruncHour('timestamp'))
                .values('hour_bucket', 'region')
                .annotate(
                    calls=Count('id'),
                    errors=Count('id', filter=Q(status_code__gte=400)),
                    total_latency=Sum('response_time_ms'),
                )
                .order_by('hour_bucket', 'region')
            )

            cell_map = {}
            for row in agg:
                cell_map[(row['hour_bucket'], row['region'])] = {
                    'hour': row['hour_bucket'],
                    'region': row['region'],
                    'calls': row['calls'],
                    'errors': row['errors'],
                    'avg_latency': round((row['total_latency'] or 0) / max(row['calls'], 1), 1),
                    'cost': 0.0,
                }

            # 范围内完整小时桶（含零值，保证热力图矩阵连续）
            hours = []
            cursor = start_dt.replace(minute=0, second=0, microsecond=0)
            while cursor < end_dt:
                hours.append(cursor)
                cursor += datetime.timedelta(hours=1)

            # 边界：整点桶数上限，防止超大矩阵撑爆内存/响应体
            from django.conf import settings
            max_buckets = getattr(settings, 'STATS_MAX_BUCKETS', 2000)
            if len(hours) > max_buckets:
                return Response(
                    {'success': False, 'error': f'时间跨度过大（{len(hours)} 个整点，上限 {max_buckets}），请缩短范围'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            regions = [r for r, _ in APIKeyUsageLog.REGION_CHOICES]
            if region_filter:
                regions = [region_filter]

            matrix = []
            for h in hours:
                for reg in regions:
                    key = (h, reg)
                    if key in cell_map:
                        matrix.append(cell_map[key])
                    else:
                        matrix.append({'hour': h, 'region': reg, 'calls': 0, 'errors': 0, 'avg_latency': 0, 'cost': 0.0})

            # 每区域对 calls 序列做均值+3σ 异常标记（热力图红色高亮）
            _mark_hourly_anomalies(matrix, regions)

            total_calls = sum(c['calls'] for c in matrix)
            total_errors = sum(c['errors'] for c in matrix)
            total_latency = sum(c['avg_latency'] * c['calls'] for c in matrix)
            anomaly_count = sum(1 for c in matrix if c['anomaly'])

            # 保留聚合快照到 HourlyRegionStats（离线读取/审计；APIKeyUsageLog 无成本字段故 total_cost 为 0）
            for c in matrix:
                if c['calls'] > 0:
                    HourlyRegionStats.objects.update_or_create(
                        hour=c['hour'],
                        region=c['region'],
                        defaults={
                            'total_cost': Decimal('0'),
                            'call_count': c['calls'],
                            'error_count': c['errors'],
                            'avg_latency': int(c['avg_latency']),
                        },
                    )

            data = {
                'start_date': start_dt.date().isoformat(),
                'end_date': (end_dt - datetime.timedelta(seconds=1)).date().isoformat(),
                'days': days,
                'granularity': granularity or 'hour',
                'region': region_filter,
                'hours': [h.strftime('%Y-%m-%dT%H') for h in hours],
                'regions': regions,
                'matrix': [{
                    'hour': c['hour'].strftime('%Y-%m-%dT%H'),
                    'region': c['region'],
                    'calls': c['calls'],
                    'errors': c['errors'],
                    'avg_latency': c['avg_latency'],
                    'cost': c['cost'],
                    'anomaly': c['anomaly'],
                } for c in matrix],
                'summary': {
                    'total_calls': total_calls,
                    'total_errors': total_errors,
                    'avg_latency': round(total_latency / max(total_calls, 1), 1),
                    'cost': round(sum(c['cost'] for c in matrix), 6),
                    'anomaly_count': anomaly_count,
                },
            }

            # 精确小时过滤：附 Top 10 调用详情（前端点单元格弹窗）
            if hour_param:
                try:
                    hour_dt = timezone.make_aware(datetime.datetime.strptime(hour_param, '%Y-%m-%dT%H'))
                except (ValueError, TypeError):
                    hour_dt = None
                if hour_dt:
                    detail_qs = APIKeyUsageLog.objects.filter(
                        timestamp__gte=hour_dt,
                        timestamp__lt=hour_dt + datetime.timedelta(hours=1),
                    )
                    if region_filter:
                        detail_qs = detail_qs.filter(region=region_filter)
                    top_calls = list(
                        detail_qs.order_by('-response_time_ms')[:10].values(
                            'id', 'endpoint', 'method', 'status_code', 'response_time_ms', 'region', 'timestamp'
                        )
                    )
                    for it in top_calls:
                        it['time'] = it.pop('timestamp').isoformat()
                    data['top_calls'] = top_calls
                    data['matrix'] = [c for c in data['matrix'] if c['hour'] == hour_param]
                    data['hours'] = [hour_param]

            return Response({'success': True, 'data': data})
        except Exception:
            return Response({'success': True, 'data': {
                'start_date': '', 'end_date': '', 'days': 7, 'granularity': 'hour',
                'region': '', 'hours': [], 'regions': [], 'matrix': [], 'summary': {},
            }})

    @action(detail=False, methods=['post'], url_path='refresh-stats')
    def refresh_stats(self, request):
        target_str = request.data.get('target_date', '')
        try:
            target_date = datetime.datetime.strptime(target_str, '%Y-%m-%d').date() if target_str else None
        except ValueError:
            target_date = None

        platform = StatsAggregationEngine.aggregate_daily_platform(target_date)
        skills = StatsAggregationEngine.aggregate_skill_daily(target_date)
        areas = StatsAggregationEngine.aggregate_area_clicks(target_date)
        revenue = StatsAggregationEngine.aggregate_revenue_daily(target_date)

        return Response({
            'success': True,
            'message': '\u6570\u636e\u805a\u5408\u5b8c\u6210',
            'data': {
                'platform_date': str(platform.date),
                'skills_count': len(skills),
                'areas_count': len(areas),
                'revenue_date': str(revenue.date),
            },
        })

    @action(detail=False, methods=['get'], url_path='revenue-detail')
    def revenue_detail(self, request):
        """营收统计增强"""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        today = timezone.now().date()
        today_start = timezone.make_aware(datetime.datetime(today.year, today.month, today.day))
        today_end = today_start + datetime.timedelta(days=1)

        month_start = today.replace(day=1)
        month_start_dt = timezone.make_aware(datetime.datetime(month_start.year, month_start.month, month_start.day))

        total_revenue = PaymentOrder.objects.filter(status='paid').aggregate(s=Sum('amount'))['s'] or Decimal('0')
        month_revenue = PaymentOrder.objects.filter(
            status='paid', created_at__gte=month_start_dt
        ).aggregate(s=Sum('amount'))['s'] or Decimal('0')
        today_revenue = PaymentOrder.objects.filter(
            status='paid', created_at__gte=today_start, created_at__lt=today_end
        ).aggregate(s=Sum('amount'))['s'] or Decimal('0')

        paid_users = PaymentOrder.objects.filter(status='paid').values('user').distinct().count()
        new_paid_users_today = PaymentOrder.objects.filter(
            status='paid', created_at__gte=today_start, created_at__lt=today_end
        ).values('user').distinct().count()

        paid_orders = PaymentOrder.objects.filter(status='paid')
        avg_order_value = paid_orders.aggregate(s=Sum('amount'))['s'] or Decimal('0')
        avg_order_value = avg_order_value / max(paid_orders.count(), 1)

        total_users = User.objects.filter(is_active=True).count()
        conversion_rate = round((paid_users / max(total_users, 1)) * 100, 2) if total_users > 0 else 0.0

        top_products = []
        for product in Product.objects.filter(status='on_sale').order_by('-sales_count')[:10]:
            product_revenue = Order.objects.filter(
                status__in=['paid', 'completed'],
                items__contains=[{'product_id': product.id}],
            ).aggregate(s=Sum('pay_amount'))['s'] or Decimal('0')

            top_products.append({
                'id': product.id,
                'name': product.title,
                'category': product.category,
                'sales': product.sales_count,
                'revenue': float(product_revenue),
            })

        top_products.sort(key=lambda x: x['revenue'], reverse=True)

        revenue_trend = []
        for d in range(7):
            day = today - datetime.timedelta(days=6 - d)
            day_start_dt = timezone.make_aware(datetime.datetime(day.year, day.month, day.day))
            day_end_dt = day_start_dt + datetime.timedelta(days=1)

            day_revenue = PaymentOrder.objects.filter(
                status='paid',
                created_at__gte=day_start_dt,
                created_at__lt=day_end_dt,
            ).aggregate(s=Sum('amount'))['s'] or Decimal('0')

            day_orders = PaymentOrder.objects.filter(
                status='paid',
                created_at__gte=day_start_dt,
                created_at__lt=day_end_dt,
            ).count()

            revenue_trend.append({
                'date': day.isoformat(),
                'revenue': float(day_revenue),
                'orders': day_orders,
            })

        monthly_target = Decimal('10000.00')
        current_paid_users_target = 50
        goal_progress = {
            'monthly_target': float(monthly_target),
            'current': float(month_revenue),
            'percent': round((float(month_revenue) / float(monthly_target)) * 100, 2) if monthly_target > 0 else 0,
            'paid_user_target': current_paid_users_target,
            'current_paid_users': paid_users,
        }

        return Response({
            'success': True,
            'data': {
                'total_revenue': float(total_revenue),
                'month_revenue': float(month_revenue),
                'today_revenue': float(today_revenue),
                'paid_user_count': paid_users,
                'new_paid_users_today': new_paid_users_today,
                'avg_order_value': float(avg_order_value),
                'conversion_rate': conversion_rate,
                'top_products': top_products,
                'revenue_trend': revenue_trend,
                'goal_progress': goal_progress,
            },
        })

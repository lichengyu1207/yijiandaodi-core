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
                source_area=area_type,
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


def _get_cached_stats(cache_key):
    if cache_key in _stats_cache:
        cached_data, timestamp = _stats_cache[cache_key]
        if time.time() - timestamp < CACHE_TTL:
            return cached_data
    return None

def _set_cached_stats(cache_key, data):
    _stats_cache[cache_key] = (data, time.time())


class StatsViewSet(viewsets.ViewSet):

    @action(detail=False, methods=['get'], url_path='overview')
    def overview(self, request):
        days = int(request.GET.get('days', 7))
        cache_key = f'overview_{days}'
        cached = _get_cached_stats(cache_key)
        if cached:
            return Response(cached)

        today = timezone.now().date()
        start_dt = timezone.make_aware(datetime.datetime(today.year, today.month, today.day)) - datetime.timedelta(days=days - 1)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        dau = UserBehaviorLog.objects.filter(
            created_at__gte=start_dt,
        ).values('user').distinct().count()

        new_users = User.objects.filter(
            date_joined__gte=start_dt,
            is_active=True,
        ).count()

        total_users = User.objects.filter(is_active=True).count()

        total_clicks = UserBehaviorLog.objects.filter(
            created_at__gte=start_dt,
            action='click',
        ).count()

        total_executions = UserBehaviorLog.objects.filter(
            created_at__gte=start_dt,
            action='execute',
        ).count()

        total_shares = UserBehaviorLog.objects.filter(
            created_at__gte=start_dt,
            action='share',
        ).count()

        paid_orders = PaymentOrder.objects.filter(
            created_at__gte=start_dt,
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
            action='execute',
        ).count()
        conversion_rate = round((paid_orders_count / max(free_executions, 1)) * 100, 2) if free_executions > 0 else 0.0

        chart_data = []
        for d in range(days):
            day = today - datetime.timedelta(days=days - 1 - d)
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
                        created_at__gte=start_dt, status='refunded',
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
            days = int(request.GET.get('days', 7))
            category_filter = request.GET.get('category', '')
            tier_filter = request.GET.get('tier', '')
            sort_by = request.GET.get('sort_by', '-clicks')
            cache_key = f'skills_{days}_{category_filter}_{tier_filter}_{sort_by}'
            cached = _get_cached_stats(cache_key)
            if cached:
                return Response(cached)

            today = timezone.now().date()
            start_dt = timezone.make_aware(datetime.datetime(today.year, today.month, today.day)) - datetime.timedelta(days=days - 1)

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
                    action='click',
                ).count()
                executions = UserBehaviorLog.objects.filter(
                    skill_id=str(skill.id),
                    created_at__gte=start_dt,
                    action='execute',
                ).count()
                shares = UserBehaviorLog.objects.filter(
                    skill_id=str(skill.id),
                    created_at__gte=start_dt,
                    action='share',
                ).count()
                impressions = UserBehaviorLog.objects.filter(
                    skill_id=str(skill.id),
                    created_at__gte=start_dt,
                ).count()

                click_rate = round((clicks / max(impressions, 1)) * 100, 2) if impressions > 0 else 0.0
                execution_rate = round((executions / max(clicks, 1)) * 100, 2) if clicks > 0 else 0.0
                conv_rate = round((executions / max(clicks, 1)) * 100, 2) if clicks > 0 else 0.0

                order_rev = PaymentOrder.objects.filter(
                    created_at__gte=start_dt,
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
            days = int(request.GET.get('days', 7))
            cache_key = f'areas_{days}'
            cached = _get_cached_stats(cache_key)
            if cached:
                return Response(cached)

            today = timezone.now().date()
            start_dt = timezone.make_aware(datetime.datetime(today.year, today.month, today.day)) - datetime.timedelta(days=days - 1)

            area_labels = dict(AreaClickStats.AREA_TYPE_CHOICES)
            items = []
            trend_data = {}

            for area_type, label in AreaClickStats.AREA_TYPE_CHOICES:
                logs = UserBehaviorLog.objects.filter(
                    created_at__gte=start_dt,
                    source_area=area_type,
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
                    day = today - datetime.timedelta(days=days - 1 - d)
                    day_start = timezone.make_aware(datetime.datetime(day.year, day.month, day.day))
                    day_end = day_start + datetime.timedelta(days=1)
                    d_imp = UserBehaviorLog.objects.filter(
                        created_at__gte=day_start, created_at__lt=day_end,
                        source_area=area_type,
                    ).count()
                    d_clk = UserBehaviorLog.objects.filter(
                        created_at__gte=day_start, created_at__lt=day_end,
                        source_area=area_type, action='click',
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
        days = int(request.GET.get('days', 30))
        cache_key = f'revenue_{days}'
        cached = _get_cached_stats(cache_key)
        if cached:
            return Response(cached)

        today = timezone.now().date()
        start_dt = timezone.make_aware(datetime.datetime(today.year, today.month, today.day)) - datetime.timedelta(days=days - 1)

        all_orders = PaymentOrder.objects.filter(
            created_at__gte=start_dt,
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
            day = today - datetime.timedelta(days=days - 1 - d)
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

import hashlib
import json
from datetime import datetime, timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Count, Avg, Q, F
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .abtest_models import (
    ABTestExperiment,
    ABTestAssignment,
    ABTestEvent,
    PromoCardScheduleRule,
    PromoCardImpressionLog,
)
from .promo_card_models import PromoCard


class ABTestEngine:

    @staticmethod
    def get_or_assign_variant(experiment, user=None, session_id=''):
        if experiment.status != 'running':
            return 'control'

        existing = None
        if user:
            existing = ABTestAssignment.objects.filter(
                experiment=experiment, user=user
            ).first()
        if not existing and session_id:
            existing = ABTestAssignment.objects.filter(
                experiment=experiment, session_id=session_id
            ).first()

        if existing:
            return existing.variant

        hash_input = f"{experiment.id}:{user.id if user else session_id}"
        hash_val = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
        bucket = hash_val % 100

        variants_config = experiment.variants_config or []
        if not variants_config:
            variants_config = ['control', 'variant_a']

        cumulative_pct = 0
        for v in variants_config:
            pct = v.get('traffic', 100 // len(variants_config))
            cumulative_pct += pct
            if bucket < cumulative_pct * (experiment.traffic_allocation / 100):
                variant = v.get('name', v) if isinstance(v, dict) else v
                break
        else:
            variant = variants_config[-1].get('name', variants_config[-1]) if isinstance(variants_config[-1], dict) else variants_config[-1]

        ABTestAssignment.objects.create(
            experiment=experiment,
            user=user,
            session_id=session_id or '',
            variant=variant,
        )

        return variant

    @staticmethod
    def track_event(experiment, assignment, event_type, target_id='', value=0, extra_data=None):
        return ABTestEvent.objects.create(
            experiment=experiment,
            assignment=assignment,
            event_type=event_type,
            target_id=str(target_id),
            value=value or 0,
            extra_data=extra_data or {},
        )

    @staticmethod
    def get_experiment_results(experiment):
        assignments = ABTestAssignment.objects.filter(experiment=experiment).select_related('user')
        results = {}

        for assignment in assignments:
            var = assignment.variant
            if var not in results:
                results[var] = {'users': 0, 'impressions': 0, 'clicks': 0, 'executions': 0, 'payments': 0, 'revenue': 0}
            results[var]['users'] += 1

        events = ABTestEvent.objects.filter(experiment=experiment).select_related('assignment')
        for evt in events:
            var = evt.assignment.variant
            if var in results:
                if evt.event_type == 'impression':
                    results[var]['impressions'] += 1
                elif evt.event_type == 'click':
                    results[var]['clicks'] += 1
                elif evt.event_type == 'execute':
                    results[var]['executions'] += 1
                elif evt.event_type == 'payment_complete':
                    results[var]['payments'] += 1
                    results[var]['revenue'] += evt.value

        for var in results:
            r = results[var]
            imp = max(r['impressions'], 1)
            r['ctr'] = round(r['clicks'] / imp * 100, 2)
            r['conversion_rate'] = round(r['payments'] / imp * 100, 2)
            r['execution_rate'] = round(r['executions'] / imp * 100, 2)

        return results


class PromoCardScheduler:

    @staticmethod
    def get_cards_for_user(user=None, session_id='', position='feed_middle', limit=3):
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        segment = PromoCardScheduler._detect_user_segment(user)

        rules = PromoCardScheduleRule.objects.filter(
            is_active=True,
            promo_card__is_active=True,
        ).filter(
            Q(user_segment='all') | Q(user_segment=segment)
        ).order_by('-priority_score')

        available_cards = []
        for rule in rules:
            card = rule.promo_card
            if not card.is_active:
                continue

            today_shown = PromoCardImpressionLog.objects.filter(
                promo_card=card,
                shown_at__gte=today_start,
            )
            if user:
                today_shown = today_shown.filter(user=user)
            elif session_id:
                today_shown = today_shown.filter(session_id=session_id)

            shown_count = today_shown.count()
            if shown_count >= rule.show_frequency_max:
                continue

            last_click_log = today_shown.filter(clicked=True).order_by('-clicked_at').first()
            if last_click_log and rule.cooldown_after_click > 0:
                hours_since_click = (now - last_click_log.clicked_at).total_seconds() / 3600
                if hours_since_click < rule.cooldown_after_click:
                    continue

            last_shown = today_shown.order_by('-shown_at').first()
            if last_shown and rule.show_interval_hours > 0:
                hours_since_show = (now - last_shown.shown_at).total_seconds() / 3600
                if hours_since_show < rule.show_interval_hours:
                    continue

            position_list = rule.position_priority or [position]
            pos_score = len(position_list) - position_list.index(position) if position in position_list else 0

            final_weight = (rule.weight_multiplier or 1.0) * (card.click_count + 1) * (pos_score + 1)

            available_cards.append({
                'card': card,
                'rule': rule,
                'weight': final_weight,
                'shown_today': shown_count,
            })

        available_cards.sort(key=lambda x: x['weight'], reverse=True)
        selected = available_cards[:limit]

        result_cards = []
        for item in selected:
            log = PromoCardImpressionLog.objects.create(
                promo_card=item['card'],
                user=user,
                session_id=session_id or '',
                position=position,
            )
            card_data = {
                'id': item['card'].id,
                'title': item['card'].title,
                'description': item['card'].description[:100],
                'card_type': item['card'].card_type,
                'card_type_label': item['card'].get_card_type_display(),
                'position_label': item['card'].get_position_display(),
                'image_url': item['card'].image_url or '',
                'link_url': item['card'].link_url or '',
                'price_text': item['card'].price_text or '',
                'cta_text': item['card'].cta_text or '',
                'log_id': log.id,
                'priority_score': item['rule'].priority_score,
                'segment': segment,
            }
            result_cards.append(card_data)

        return result_cards

    @staticmethod
    def _detect_user_segment(user):
        if not user or not user.is_authenticated:
            return 'all'
        try:
            from .payment_models import UserQuota
            quota = UserQuota.objects.filter(user=user).first()
            if quota and quota.is_vip:
                return 'vip'
            from .user_behavior_models import UserProfile
            profile = UserProfile.objects.filter(user=user).first()
            if profile:
                total_actions = (profile.total_clicks or 0) + (profile.total_executions or 0)
                if total_actions >= 50:
                    return 'high_intent'
                elif total_actions >= 10:
                    return 'active'
            days_since_join = (timezone.now() - user.date_joined).days
            if days_since_join <= 3:
                return 'new'
            try:
                from .payment_models import PaymentOrder
                has_paid = PaymentOrder.objects.filter(user=user, status='paid').exists()
                if has_paid:
                    return 'vip'
            except Exception:
                pass
            return 'non_payer'
        except Exception:
            return 'all'

    @staticmethod
    def record_click(log_id):
        PromoCardImpressionLog.objects.filter(id=log_id).update(
            clicked=True,
            clicked_at=timezone.now(),
        )
        try:
            log = PromoCardImpressionLog.objects.select_related('promo_card').get(id=log_id)
            PromoCard.objects.filter(id=log.promo_card.id).update(click_count=F('click_count') + 1)
        except Exception:
            pass

    @staticmethod
    def get_promo_analytics(days=7):
        end = timezone.now().date()
        start = end - timedelta(days=days)

        logs = PromoCardImpressionLog.objects.filter(shown_at__date__gte=start)
        total_impressions = logs.count()
        total_clicks = logs.filter(clicked=True).count()

        by_card = logs.values('promo_card__title', 'promo_card__card_type').annotate(
            impressions=Count('id'),
            clicks=Count('id', filter=Q(clicked=True)),
        ).order_by('-impressions')[:15]

        by_position = logs.values('position').annotate(
            impressions=Count('id'),
            clicks=Count('id', filter=Q(clicked=True)),
        ).order_by('-impressions')

        by_segment = logs.values('session_id').annotate(
            seg=Count('id'),
        )

        items = []
        for bc in by_card:
            imp = bc['impressions']
            clk = bc['clicks']
            items.append({
                'title': bc['promo_card__title'],
                'type': bc['promo_card__card_type'],
                'impressions': imp,
                'clicks': clk,
                'ctr': round(clk / max(imp, 1) * 100, 2),
            })

        positions = []
        for bp in by_position:
            imp = bp['impressions']
            clk = bp['clicks']
            positions.append({
                'position': bp['position'] or 'unknown',
                'impressions': imp,
                'clicks': clk,
                'ctr': round(clk / max(imp, 1) * 100, 2),
            })

        return {
            'period_days': days,
            'total_impressions': total_impressions,
            'total_clicks': total_clicks,
            'overall_ctr': round(total_clicks / max(total_impressions, 1) * 100, 2),
            'by_card': items,
            'by_position': positions,
        }


class ABTestViewSet(viewsets.ViewSet):

    @action(detail=False, methods=['get'], url_path='experiments')
    def experiments(self, request):
        exps = ABTestExperiment.objects.all()
        data = []
        for e in exps:
            data.append({
                'id': e.id,
                'name': e.name,
                'status': e.status,
                'test_type': e.test_type,
                'variants': e.variants_config or [],
                'traffic': e.traffic_allocation,
                'winner': e.winner_variant,
            })
        return Response({'success': True, 'data': {'experiments': data}})

    @action(detail=False, methods=['post'], url_path='assign')
    def assign(self, request):
        exp_name = request.data.get('experiment')
        session_id = request.data.get('session_id', '')
        user = request.user if request.user.is_authenticated else None

        try:
            exp = ABTestExperiment.objects.get(name=exp_name)
        except ABTestExperiment.DoesNotExist:
            return Response({'success': False, 'message': '\u5b9e\u9a8c\u4e0d\u5b58\u5728'}, status=404)

        variant = ABTestEngine.get_or_assign_variant(exp, user, session_id)
        return Response({'success': True, 'data': {'variant': variant, 'experiment': exp.name}})

    @action(detail=False, methods=['post'], url_path='track-event')
    def track_event(self, request):
        exp_name = request.data.get('experiment')
        session_id = request.data.get('session_id', '')
        event_type = request.data.get('event_type', 'impression')
        target_id = request.data.get('target_id', '')
        value = float(request.data.get('value', 0))

        user = request.user if request.user.is_authenticated else None

        try:
            exp = ABTestExperiment.objects.get(name=exp_name)
        except ABTestExperiment.DoesNotExist:
            return Response({'success': False}, status=404)

        assignment = ABTestAssignment.objects.filter(
            experiment=exp,
        ).filter(Q(user=user) | Q(session_id=session_id)).first()

        if not assignment:
            return Response({'success': False, 'message': '\u672a\u5206\u914d\u53d8\u4f53'}, status=400)

        ABTestEngine.track_event(exp, assignment, event_type, target_id, value)
        return Response({'success': True})

    @action(detail=False, methods=['get'], url_path='results')
    def results(self, request):
        exp_name = request.query_params.get('experiment', '')

        if exp_name:
            try:
                exp = ABTestExperiment.objects.get(name=exp_name)
            except ABTestExperiment.DoesNotExist:
                return Response({'success': False}, status=404)
            results = ABTestEngine.get_experiment_results(exp)
            return Response({'success': True, 'data': {
                'experiment': exp.name,
                'results': results,
            }})

        all_results = {}
        for exp in ABTestExperiment.objects.filter(status='running'):
            all_results[exp.name] = ABTestEngine.get_experiment_results(exp)

        return Response({'success': True, 'data': {'experiments': all_results}})


class PromoOptimizationViewSet(viewsets.ViewSet):

    @action(detail=False, methods=['get'], url_path='smart-feed')
    def smart_feed(self, request):
        position = request.query_params.get('position', 'feed_middle')
        limit = min(int(request.query_params.get('limit', 2)), 5)
        user = request.user if request.user.is_authenticated else None
        session_id = request.headers.get('X-Session-ID', '')[:64]

        cards = PromoCardScheduler.get_cards_for_user(user, session_id, position, limit)
        return Response({'success': True, 'data': {'cards': cards, 'count': len(cards)}})

    @action(detail=False, methods=['post'], url_path='promo-click')
    def promo_click(self, request):
        log_id = request.data.get('log_id')
        if log_id:
            PromoCardScheduler.record_click(log_id)
        return Response({'success': True})

    @action(detail=False, methods=['get'], url_path='analytics')
    def analytics(self, request):
        days = min(int(request.query_params.get('days', 7)), 30)
        data = PromoCardScheduler.get_promo_analytics(days)
        return Response({'success': True, 'data': data})

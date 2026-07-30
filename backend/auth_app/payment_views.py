import math
import random
import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Sum, Count, F, Q, Window, functions
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
import time

from .skill_config_models import SkillConfig
from .payment_models import SkillHotnessSnapshot, UserQuota, PaymentOrder, FirstOrderPromo, UserCoupon
from .affiliate_views import bind_affiliate_on_payment
from .alipay_client import AlipayService, _alipay_sdk_available

logger = logging.getLogger(__name__)

_promo_cache = {}
PROMO_CACHE_TTL = 300


class HotnessEngine:
    CLICK_WEIGHT = 1.0
    SELECT_WEIGHT = 2.0
    EXECUTE_WEIGHT = 3.0
    SHARE_WEIGHT = 5.0
    IS_HOT_BONUS = 15.0
    IS_NEW_BONUS = 10.0
    IS_RECOMMENDED_BONUS = 8.0
    WEIGHT_FACTOR = 2.0
    DECAY_HOURS = 6
    MAX_HOTNESS = 100.0

    @classmethod
    def get_current_hour_key(cls):
        return timezone.now().strftime('%Y%m%d%H')

    @classmethod
    def calculate_hotness(cls, skill_id, hour_key=None):
        if not hour_key:
            hour_key = cls.get_current_hour_key()

        try:
            skill = SkillConfig.objects.get(id=skill_id)
        except SkillConfig.DoesNotExist:
            return None

        snapshot, created = SkillHotnessSnapshot.objects.get_or_create(
            skill=skill,
            hour_key=hour_key,
        )

        base_hotness = (
            (snapshot.click_count or 0) * cls.CLICK_WEIGHT +
            (snapshot.select_count or 0) * cls.SELECT_WEIGHT +
            (snapshot.execute_count or 0) * cls.EXECUTE_WEIGHT +
            (snapshot.share_count or 0) * cls.SHARE_WEIGHT
        )

        bonus = 0.0
        if skill.is_hot:
            bonus += cls.IS_HOT_BONUS
        if skill.is_new:
            bonus += cls.IS_NEW_BONUS
        if skill.is_recommended:
            bonus += cls.IS_RECOMMENDED_BONUS
        bonus += (skill.weight or 5) * cls.WEIGHT_FACTOR

        usage_factor = min((skill.usage_count or 0) * 0.01, 20.0)

        raw = base_hotness + bonus + usage_factor
        noise = random.uniform(-0.5, 1.0)

        final_raw = max(0, raw + noise)

        snapshot.raw_hotness = round(final_raw, 2)
        snapshot.save(update_fields=['raw_hotness'])

        return snapshot

    @classmethod
    def normalize_and_rank(cls, hour_key=None):
        if not hour_key:
            hour_key = cls.get_current_hour_key()

        snapshots = list(SkillHotnessSnapshot.objects.filter(
            hour_key=hour_key
        ).select_related('skill'))

        if not snapshots:
            return []

        raw_values = [s.raw_hotness for s in snapshots]
        max_raw = max(raw_values) if raw_values else 1.0
        min_raw = min(raw_values) if raw_values else 0.0
        range_raw = max_raw - min_raw if max_raw != min_raw else 1.0

        prev_hour_key = (timezone.now() - timedelta(hours=1)).strftime('%Y%m%d%H')
        prev_snapshots = {
            s.skill_id: s.normalized_hotness
            for s in SkillHotnessSnapshot.objects.filter(hour_key=prev_hour_key)
        }

        results = []
        sorted_by_raw = sorted(snapshots, key=lambda s: s.raw_hotness, reverse=True)

        for rank_idx, snap in enumerate(sorted_by_raw):
            normalized = ((snap.raw_hotness - min_raw) / range_raw) * cls.MAX_HOTNESS
            normalized = max(0.0, min(cls.MAX_HOTNESS, round(normalized, 1)))

            prev_val = prev_snapshots.get(snap.skill_id, 0.0)
            if normalized > prev_val + 2:
                trend = 1
            elif normalized < prev_val - 2:
                trend = -1
            else:
                trend = 0

            snap.normalized_hotness = normalized
            snap.rank = rank_idx + 1
            snap.trend = trend
            snap.save(update_fields=['normalized_hotness', 'rank', 'trend'])

            results.append({
                'skill_id': snap.skill.id,
                'skill_name': snap.skill.name,
                'rank': snap.rank,
                'hotness': normalized,
                'trend': trend,
                'tier': snap.skill.tier,
                'icon_name': snap.skill.icon_name,
                'icon_color': snap.skill.icon_color,
                'is_hot': snap.skill.is_hot,
                'is_new': snap.skill.is_new,
                'category': snap.skill.category,
                'main_scenario': snap.skill.main_scenario,
                'keywords': snap.skill.keywords,
                'usage_count': snap.skill.usage_count,
            })

        return results

    @classmethod
    def batch_update_hotness(cls, hour_key=None):
        if not hour_key:
            hour_key = cls.get_current_hour_key()

        online_skills = SkillConfig.objects.filter(status='online').values_list('id', flat=True)

        for skill_id in online_skills:
            cls.calculate_hotness(skill_id, hour_key)

        ranked = cls.normalize_and_rank(hour_key)

        return {
            'hour_key': hour_key,
            'total_skills': len(ranked),
            'top_10': ranked[:10],
            'updated_at': timezone.now().isoformat(),
        }

    @classmethod
    def record_interaction(cls, skill_id, action_type='click'):
        hour_key = cls.get_current_hour_key()
        try:
            skill = SkillConfig.objects.get(id=skill_id)
        except SkillConfig.DoesNotExist:
            return None

        snapshot, _ = SkillHotnessSnapshot.objects.get_or_create(
            skill=skill,
            hour_key=hour_key,
        )

        update_field = None
        if action_type == 'click':
            snapshot.click_count = (snapshot.click_count or 0) + 1
            update_field = 'click_count'
        elif action_type == 'select':
            snapshot.select_count = (snapshot.select_count or 0) + 1
            update_field = 'select_count'
        elif action_type == 'execute':
            snapshot.execute_count = (snapshot.execute_count or 0) + 1
            update_field = 'execute_count'
        elif action_type == 'share':
            snapshot.share_count = (snapshot.share_count or 0) + 1
            update_field = 'share_count'

        if update_field:
            snapshot.save(update_fields=[update_field])

        SkillConfig.objects.filter(id=skill_id).update(
            usage_count=F('usage_count') + 1
        )

        return snapshot


class HotnessViewSet(viewsets.ViewSet):
    permission_classes = []

    @action(detail=False, methods=['get'], url_path='top-skills')
    def top_skills(self, request):
        limit = min(int(request.query_params.get('limit', 9)), 18)
        hour_key = request.query_params.get('hour_key')

        if not hour_key:
            hour_key = HotnessEngine.get_current_hour_key()

        top_skills = SkillHotnessSnapshot.objects.filter(
            hour_key=hour_key
        ).select_related('skill').filter(
            skill__status='online'
        ).order_by('-normalized_hotness', 'rank')[:limit]

        items = []
        for ts in top_skills:
            s = ts.skill
            items.append({
                'id': s.id,
                'name': s.name,
                'category': s.category,
                'main_scenario': s.main_scenario,
                'keywords': s.keywords,
                'tier': s.tier,
                'icon_name': s.icon_name,
                'icon_color': s.icon_color,
                'weight': s.weight,
                'dev_days': s.dev_days,
                'monetization_type': s.monetization_type,
                'is_hot': s.is_hot,
                'is_new': s.is_new,
                'is_recommended': s.is_recommended,
                'usage_count': s.usage_count,
                'hotness': ts.normalized_hotness,
                'rank': ts.rank,
                'trend': ts.trend,
                'click_count': ts.click_count,
                'execute_count': ts.execute_count,
            })

        return Response({
            'success': True,
            'data': {
                'items': items,
                'count': len(items),
                'hour_key': hour_key,
                'updated_at': timezone.now().isoformat(),
            },
        })

    @action(detail=False, methods=['post'], url_path='refresh-hotness')
    def refresh_hotness(self, request):
        result = HotnessEngine.batch_update_hotness()
        return Response({
            'success': True,
            'message': f'热度已更新，共 {result["total_skills"]} 个技能',
            'data': result,
        })


class PaymentViewSet(viewsets.ViewSet):

    def get_permissions(self):
        if self.action in ('first_order_promo', 'quota', 'top_skills'):
            return [AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=['get'], url_path='quota')
    def quota(self, request):
        user = request.user if request.user.is_authenticated else None
        if not user:
            return Response({
                'success': True,
                'data': {
                    'is_authenticated': False,
                    'free_remaining': 3,
                    'free_limit': 3,
                    'is_vip': False,
                    'vip_level': 0,
                },
            })

        quota, created = UserQuota.objects.get_or_create(user=user)

        today = timezone.now().date()
        if quota.quota_reset_date and quota.quota_reset_date < today:
            quota.free_used_today = 0
            quota.free_daily_remaining = quota.free_daily_limit
            quota.quota_reset_date = today
            quota.save(update_fields=['free_used_today', 'free_daily_remaining', 'quota_reset_date'])

        is_vip_now = quota.is_vip
        if quota.vip_expire_at and quota.vip_expire_at < timezone.now():
            is_vip_now = False

        return Response({
            'success': True,
            'data': {
                'is_authenticated': True,
                'free_remaining': quota.free_daily_remaining,
                'free_limit': quota.free_daily_limit,
                'free_used_today': quota.free_used_today,
                'is_vip': is_vip_now,
                'vip_level': quota.vip_level,
                'vip_expire_at': quota.vip_expire_at.isoformat() if quota.vip_expire_at else None,
                'total_paid_uses': quota.total_paid_uses,
                'total_free_uses': quota.total_free_uses,
            },
        })

    @action(detail=False, methods=['post'], url_path='use-quota')
    def use_quota(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response({'success': False, 'message': '\u8bf7\u5148\u767b\u5f55'}, status=401)

        use_type = request.data.get('use_type', 'free')
        quota, _ = UserQuota.objects.get_or_create(user=user)

        today = timezone.now().date()
        if quota.quota_reset_date and quota.quota_reset_date < today:
            quota.free_used_today = 0
            quota.free_daily_remaining = quota.free_daily_limit
            quota.quota_reset_date = today

        if use_type == 'free':
            if quota.free_daily_remaining <= 0:
                return Response({
                    'success': False,
                    'message': '\u4eca\u65e5\u514d\u8d39\u6b21\u6570\u5df2\u7528\u5b8c\uff0c\u8bf7\u9009\u62e9\u4ed8\u8d39\u4f7f\u7528',
                    'data': {'need_pay': True, 'pay_options': ['per_use', 'vip_monthly']},
                }, status=403)

            quota.free_daily_remaining -= 1
            quota.free_used_today += 1
            quota.total_free_uses += 1
            quota.save(update_fields=['free_daily_remaining', 'free_used_today', 'total_free_uses', 'quota_reset_date'])
            return Response({'success': True, 'message': '\u514d\u8d39\u6b21\u6570\u6263\u51cf\u6210\u529f', 'data': {'remaining': quota.free_daily_remaining}})

        elif use_type == 'paid':
            has_order = PaymentOrder.objects.filter(
                user=user, status='paid', order_type='per_use'
            ).exists() or quota.is_vip

            if not has_order:
                return Response({'success': False, 'message': '\u8bf7\u5148\u5b8c\u6210\u652f\u4ed8'}, status=402)

            quota.total_paid_uses += 1
            quota.save(update_fields=['total_paid_uses'])
            return Response({'success': True, 'message': '\u4ed8\u8d39\u4f7f\u7528\u6210\u529f'})

        return Response({'success': False, 'message': '\u65e0\u6548\u7684\u4f7f\u7528\u7c7b\u578b'}, status=400)

    @action(detail=False, methods=['post'], url_path='create-order')
    def create_order(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response({'success': False, 'message': '\u8bf7\u5148\u767b\u5f55'}, status=401)

        order_type = request.data.get('order_type', 'per_use')
        coupon_code = request.data.get('coupon_code', '')
        price_map = {
            'per_use': ('19.00', '按次检测(¥19)'),
            'vip_monthly': ('99.00', '月度会员(¥99)'),
            'vip_yearly_199': ('199.00', '年度会员(¥199)♦超值'),
            'vip_yearly_599': ('599.00', '年度会员专享(¥599)'),
            'vip_enterprise': ('5999.00', '企业定制(¥5999)'),
            'combo_security': ('299.00', '安全检测套餐(¥299)'),
            'combo_content': ('398.00', '内容安全套餐(¥398)'),
            'combo_enterprise_full': ('2999.00', '企业全景套餐(¥2999)'),
        }
        if order_type not in price_map:
            return Response({'success': False, 'message': '不支持的订单类型'}, status=400)

        amount_str, subject = price_map[order_type]
        original_amount = amount_str
        discount_amount = '0.00'

        if coupon_code:
            try:
                coupon = UserCoupon.objects.select_related('promo').get(
                    coupon_code=coupon_code,
                    user=user,
                    status='unused',
                )
                promo = coupon.promo
                now = timezone.now()
                if promo.status != 'active':
                    return Response({'success': False, 'message': '优惠活动已失效'}, status=400)
                if now < promo.start_time or now > promo.end_time:
                    return Response({'success': False, 'message': '优惠活动不在有效期内'}, status=400)
                if order_type not in (promo.applicable_types or []):
                    return Response({'success': False, 'message': '该订单类型不适用此优惠券'}, status=400)
                if promo.total_limit > 0 and promo.used_count >= promo.total_limit:
                    return Response({'success': False, 'message': '优惠券已领完'}, status=400)

                from decimal import Decimal
                order_amount = Decimal(amount_str)
                if promo.discount_type == 'percent':
                    calc_discount = order_amount * Decimal(str(promo.discount_value)) / Decimal('100')
                else:
                    calc_discount = Decimal(str(promo.discount_value))

                calc_discount = min(calc_discount, Decimal(str(promo.max_discount)))
                calc_discount = min(calc_discount, order_amount)
                calc_discount = calc_discount.quantize(Decimal('0.01'))

                discount_amount = str(calc_discount)
                amount_str = str(order_amount - calc_discount)
            except UserCoupon.DoesNotExist:
                return Response({'success': False, 'message': '优惠券无效或已使用'}, status=400)

        import uuid
        order_no = 'YJD' + datetime.now().strftime('%Y%m%d%H%M%S') + str(uuid.uuid4())[:8].upper()

        expire_time = timezone.now() + timedelta(minutes=30)

        order = PaymentOrder.objects.create(
            order_no=order_no,
            user=user,
            order_type=order_type,
            amount=amount_str,
            original_amount=original_amount,
            discount_amount=discount_amount,
            subject=subject,
            description=subject + ' - 一鉴到底' + ' AI检测平台',
            expire_at=expire_time,
            status='pending',
        )

        if coupon_code and discount_amount != '0.00':
            try:
                coupon = UserCoupon.objects.get(coupon_code=coupon_code, user=user)
                coupon.status = 'used'
                coupon.order = order
                coupon.discount_amount = discount_amount
                coupon.used_at = timezone.now()
                coupon.save(update_fields=['status', 'order', 'discount_amount', 'used_at'])

                promo = coupon.promo
                promo.used_count += 1
                promo.save(update_fields=['used_count'])
            except UserCoupon.DoesNotExist:
                pass

        return Response({
            'success': True,
            'data': {
                'order_id': order.id,
                'order_no': order.order_no,
                'amount': float(order.amount),
                'original_amount': float(order.original_amount),
                'discount_amount': float(order.discount_amount),
                'subject': order.subject,
                'status': order.status,
                'expire_at': order.expire_at.isoformat() if order.expire_at else None,
                'pay_url': '/api/payment/' + order.order_no + '/mock-pay/',
            },
        })

    @action(detail=False, methods=['post'], url_path='mock-pay')
    def mock_pay(self, request):
        order_no = request.data.get('order_no') or request.query_params.get('order_no')
        if not order_no:
            return Response({'success': False, 'message': '\u7f3a\u5c11\u8ba2\u5355\u53f7'}, status=400)

        try:
            order = PaymentOrder.objects.get(order_no=order_no)
        except PaymentOrder.DoesNotExist:
            return Response({'success': False, 'message': '\u8ba2\u5355\u4e0d\u5b58\u5728'}, status=404)

        if order.status == 'paid':
            return Response({'success': True, 'message': '\u8be5\u8ba2\u5355\u5df2\u652f\u4ed8', 'data': {'order_status': 'paid'}})

        if order.expire_at and order.expire_at < timezone.now():
            order.status = 'expired'
            order.save(update_fields=['status'])
            return Response({'success': False, 'message': '\u8ba2\u5355\u5df2\u8fc7\u671f', 'data': {'order_status': 'expired'}})

        order.status = 'paid'
        order.pay_channel = 'mock'
        order.pay_trade_no = 'MOCK' + order_no
        order.pay_time = timezone.now()
        order.paid_at = timezone.now()
        order.save(update_fields=['status', 'pay_channel', 'pay_trade_no', 'pay_time', 'paid_at'])

        quota, _ = UserQuota.objects.get_or_create(user=order.user)
        if order.order_type in ['vip_monthly', 'vip_yearly_199', 'vip_yearly_599', 'vip_enterprise',
                                 'combo_security', 'combo_content', 'combo_enterprise_full']:
            quota.is_vip = True
            vip_levels = {
                'vip_monthly': 1,
                'vip_yearly_199': 2,
                'vip_yearly_599': 2,
                'vip_enterprise': 3,
                'combo_security': 2,
                'combo_content': 2,
                'combo_enterprise_full': 3,
            }
            vip_durations = {
                'vip_monthly': 30,
                'vip_yearly_199': 365,
                'vip_yearly_599': 365,
                'vip_enterprise': 365 * 3,
                'combo_security': 365,
                'combo_content': 365,
                'combo_enterprise_full': 365 * 3,
            }
            quota.vip_level = vip_levels.get(order.order_type, 1)
            duration = vip_durations.get(order.order_type, 30)
            quota.vip_expire_at = timezone.now() + timedelta(days=duration)
            quota.save(update_fields=['is_vip', 'vip_level', 'vip_expire_at'])
        else:
            quota.save()

        bind_affiliate_on_payment(order)

        return Response({
            'success': True,
            'message': '\u652f\u4ed8\u6210\u529f\uff01',
            'data': {
                'order_status': 'paid',
                'order_no': order.order_no,
                'amount': float(order.amount),
                'vip_info': {
                    'is_vip': quota.is_vip,
                    'vip_level': quota.vip_level,
                    'vip_expire_at': quota.vip_expire_at.isoformat() if quota.vip_expire_at else None,
                },
            },
        })

    @action(detail=False, methods=['get'], url_path='my-orders')
    def my_orders(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response({'success': False, 'message': '\u8bf7\u5148\u767b\u5f55'}, status=401)

        orders = PaymentOrder.objects.filter(user=user).order_by('-created_at')[:20]

        items = []
        for o in orders:
            items.append({
                'id': o.id,
                'order_no': o.order_no,
                'order_type': o.order_type,
                'type_display': o.get_order_type_display(),
                'status': o.status,
                'status_display': o.get_status_display(),
                'amount': float(o.amount),
                'subject': o.subject,
                'pay_channel': o.pay_channel,
                'paid_at': o.paid_at.isoformat() if o.paid_at else None,
                'created_at': o.created_at.isoformat() if o.created_at else None,
            })

        return Response({
            'success': True,
            'data': {'orders': items, 'count': len(items)},
        })

    @action(detail=False, methods=['get'], url_path='first-order-promo', permission_classes=[AllowAny])
    def first_order_promo(self, request):
        cache_key = 'first_order_promo'
        cached = _promo_cache.get(cache_key)
        if cached:
            cached_data, timestamp = cached
            if time.time() - timestamp < PROMO_CACHE_TTL:
                return Response(cached_data)

        now = timezone.now()
        try:
            promo = FirstOrderPromo.objects.filter(status='active').filter(
                start_time__lte=now, end_time__gte=now
            ).order_by('-created_at').first()
        except Exception:
            promo = None

        if not promo:
            return Response({
                'success': True,
                'data': None,
            })

        user = request.user if request.user.is_authenticated else None
        user_can_claim = False
        user_has_claimed = False
        user_coupon_code = None

        if user:
            has_paid_order = PaymentOrder.objects.filter(user=user, status='paid').exists()
            if not has_paid_order:
                try:
                    existing_coupon = UserCoupon.objects.select_related('promo').get(user=user, promo=promo)
                    user_has_claimed = True
                    if existing_coupon.status == 'unused':
                        user_can_claim = False
                        user_coupon_code = existing_coupon.coupon_code
                    else:
                        user_can_claim = False
                        user_coupon_code = existing_coupon.coupon_code
                except UserCoupon.DoesNotExist:
                    user_can_claim = True
            else:
                user_can_claim = False
                try:
                    existing_coupon = UserCoupon.objects.select_related('promo').get(user=user, promo=promo)
                    user_has_claimed = True
                    user_coupon_code = existing_coupon.coupon_code
                except UserCoupon.DoesNotExist:
                    pass
        else:
            user_can_claim = True

        remaining_count = None
        if promo.total_limit > 0:
            remaining_count = max(0, promo.total_limit - promo.used_count)

        extra_config = promo.extra_config or {}
        response_data = {
            'success': True,
            'data': {
                'id': promo.id,
                'name': promo.name,
                'discount_type': promo.discount_type,
                'discount_value': float(promo.discount_value),
                'max_discount': float(promo.max_discount),
                'min_order_amount': float(promo.min_order_amount),
                'applicable_types': promo.applicable_types or [],
                'start_time': promo.start_time.isoformat(),
                'end_time': promo.end_time.isoformat(),
                'status': promo.status,
                'extra_config': {
                    'banner_text': extra_config.get('banner_text', '新人专享·首单优惠'),
                    'subtext': extra_config.get('subtext', '最高减100元'),
                    'badge_text': extra_config.get('badge_text', '首单特惠'),
                    'bg_color': extra_config.get('bg_color', '#FFFBEA'),
                    'border_color': extra_config.get('border_color', '#FF7D00'),
                    'accent_color': extra_config.get('accent_color', '#FF7D00'),
                },
                'user_can_claim': user_can_claim,
                'user_has_claimed': user_has_claimed,
                'user_coupon_code': user_coupon_code,
                'remaining_count': remaining_count,
            },
        }
        _promo_cache[cache_key] = (response_data, time.time())
        return Response(response_data)

    @action(detail=False, methods=['post'], url_path='claim-first-order-coupon')
    def claim_first_order_coupon(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response({'success': False, 'message': '请先登录'}, status=401)

        now = timezone.now()
        try:
            promo = FirstOrderPromo.objects.filter(status='active').filter(
                start_time__lte=now, end_time__gte=now
            ).order_by('-created_at').first()
        except Exception:
            return Response({'success': False, 'message': '当前没有可用的优惠活动'}, status=404)

        if not promo:
            return Response({'success': False, 'message': '当前没有可用的优惠活动'}, status=404)

        has_paid_order = PaymentOrder.objects.filter(user=user, status='paid').exists()
        if has_paid_order:
            return Response({'success': False, 'message': '您已有成功支付的订单，无法领取新人优惠'}, status=400)

        try:
            UserCoupon.objects.get(user=user, promo=promo)
            return Response({'success': False, 'message': '您已领取过此优惠券'}, status=400)
        except UserCoupon.DoesNotExist:
            pass

        if promo.total_limit > 0 and promo.used_count >= promo.total_limit:
            return Response({'success': False, 'message': '优惠券已领完'}, status=400)

        import uuid
        coupon_code = 'FIRST' + now.strftime('%Y%m%d%H%M%S') + str(uuid.uuid4())[:6].upper()

        coupon_expire = promo.end_time
        if isinstance(coupon_expire, type(now)):
            pass
        else:
            coupon_expire = now

        coupon = UserCoupon.objects.create(
            user=user,
            promo=promo,
            coupon_code=coupon_code,
            status='unused',
            expire_at=coupon_expire,
        )

        return Response({
            'success': True,
            'message': '优惠券领取成功！',
            'data': {
                'coupon_id': coupon.id,
                'coupon_code': coupon.coupon_code,
                'promo_name': promo.name,
                'status': coupon.status,
                'expire_at': coupon.expire_at.isoformat() if coupon.expire_at else None,
            },
        })

    @action(detail=False, methods=['post'], url_path='apply-first-order-discount')
    def apply_first_order_discount(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response({'success': False, 'message': '请先登录'}, status=401)

        order_type = request.data.get('order_type', '')
        if not order_type:
            return Response({'success': False, 'message': '缺少订单类型参数'}, status=400)

        from decimal import Decimal
        try:
            coupon = UserCoupon.objects.select_related('promo').get(
                user=user,
                status='unused',
            )
        except UserCoupon.DoesNotExist:
            return Response({
                'success': True,
                'data': {'has_coupon': False, 'discount_info': None},
            })

        promo = coupon.promo
        now = timezone.now()
        if promo.status != 'active' or now < promo.start_time or now > promo.end_time:
            return Response({
                'success': True,
                'data': {'has_coupon': False, 'discount_info': None, 'reason': '优惠活动已失效'},
            })

        applicable = promo.applicable_types or []
        if order_type not in applicable:
            return Response({
                'success': True,
                'data': {'has_coupon': True, 'can_apply': False, 'reason': '该订单类型不适用此优惠券'},
            })

        price_map = {
            'per_use': Decimal('19.00'),
            'vip_monthly': Decimal('99.00'),
            'vip_yearly_199': Decimal('199.00'),
            'vip_yearly_599': Decimal('599.00'),
            'vip_enterprise': Decimal('5999.00'),
            'combo_security': Decimal('299.00'),
            'combo_content': Decimal('398.00'),
            'combo_enterprise_full': Decimal('2999.00'),
        }
        original_price = price_map.get(order_type)
        if not original_price:
            return Response({
                'success': True,
                'data': {'has_coupon': True, 'can_apply': False, 'reason': '未知的订单类型'},
            })

        if original_price < Decimal(str(promo.min_order_amount)):
            return Response({
                'success': True,
                'data': {'has_coupon': True, 'can_apply': False, 'reason': f'订单金额不足{promo.min_order_amount}元'},
            })

        if promo.discount_type == 'percent':
            calc_discount = original_price * Decimal(str(promo.discount_value)) / Decimal('100')
        else:
            calc_discount = Decimal(str(promo.discount_value))

        calc_discount = min(calc_discount, Decimal(str(promo.max_discount)))
        calc_discount = min(calc_discount, original_price)
        calc_discount = calc_discount.quantize(Decimal('0.01'))
        final_price = (original_price - calc_discount).quantize(Decimal('0.01'))

        return Response({
            'success': True,
            'data': {
                'has_coupon': True,
                'can_apply': True,
                'coupon_code': coupon.coupon_code,
                'discount_info': {
                    'original_price': float(original_price),
                    'discount_amount': float(calc_discount),
                    'final_price': float(final_price),
                    'discount_type': promo.discount_type,
                    'discount_display': f'{float(promo.discount_value)}折' if promo.discount_type == 'percent' else f'减¥{promo.discount_value}',
                    'promo_name': promo.name,
                },
            },
        })

    # ==================== 支付宝真实支付接口 ====================

    @action(detail=False, methods=['post'], url_path='alipay-page-pay')
    def alipay_page_pay(self, request):
        """
        电脑网站支付 — 生成支付宝支付表单 HTML
        前端收到后渲染表单并自动提交，跳转至支付宝收银台
        """
        user = request.user
        if not user or not user.is_authenticated:
            return Response({'success': False, 'message': '\u8bf7\u5148\u767b\u5f55'}, status=401)

        order_no = request.data.get('order_no', '')
        if not order_no:
            return Response({'success': False, 'message': '\u7f3a\u5c11\u8ba2\u5355\u53f7'}, status=400)

        try:
            order = PaymentOrder.objects.get(order_no=order_no, user=user)
        except PaymentOrder.DoesNotExist:
            return Response({'success': False, 'message': '\u8ba2\u5355\u4e0d\u5b58\u5728'}, status=404)

        if order.status == 'paid':
            return Response({'success': False, 'message': '\u8be5\u8ba2\u5355\u5df2\u652f\u4ed8'})

        if order.status != 'pending':
            return Response({'success': False, 'message': f'\u8ba2\u5355\u72b6\u6001\u4e0d\u6b63\u786e: {order.get_status_display()}'}, status=400)

        if not _alipay_sdk_available:
            return Response({
                'success': False,
                'message': '\u652f\u4ed8\u5b9dSDK\u672a\u5b89\u88c5\uff0c\u6682\u65f6\u4f7f\u7528\u6a21\u62df\u652f\u4ed8',
                'fallback_mock': True,
            }, status=503)

        try:
            from django.conf import settings

            html_form = AlipayService.page_pay(
                order_no=order.order_no,
                total_amount=str(order.amount),
                subject=order.subject,
                body=order.description,
                return_url=getattr(settings, 'ALIPAY_RETURN_URL', ''),
                notify_url=getattr(settings, 'ALIPAY_NOTIFY_URL', ''),
                passback_params=f'{{"order_type":"{order.order_type}"}}',
            )

            # 记录支付渠道
            order.pay_channel = 'alipay_page'
            order.extra_data = {**(order.extra_data or {}), 'pay_method': 'page_pay'}
            order.save(update_fields=['pay_channel', 'extra_data'])

            return Response({
                'success': True,
                'data': {
                    'order_no': order.order_no,
                    'amount': float(order.amount),
                    'payment_html': html_form,
                    'pay_channel': 'alipay_page',
                },
            })

        except Exception as e:
            logger.error(f'[Alipay] Page pay error for order {order_no}: {e}')
            return Response({'success': False, 'message': f'\u652f\u4ed8\u521b\u5efa\u5931\u8d25: {str(e)}'}, status=500)

    @action(detail=False, methods=['post'], url_path='alipay-wap-pay')
    def alipay_wap_pay(self, request):
        """
        手机网站支付 — 生成 WAP 支付表单 HTML
        适用于移动端浏览器场景，唤起支付宝 App 或 WAP 收银台
        """
        user = request.user
        if not user or not user.is_authenticated:
            return Response({'success': False, 'message': '\u8bf7\u5148\u767b\u5f55'}, status=401)

        order_no = request.data.get('order_no', '')
        if not order_no:
            return Response({'success': False, 'message': '\u7f3a\u5c11\u8ba2\u5355\u53f7'}, status=400)

        try:
            order = PaymentOrder.objects.get(order_no=order_no, user=user)
        except PaymentOrder.DoesNotExist:
            return Response({'success': False, 'message': '\u8ba2\u5355\u4e0d\u5b58\u5728'}, status=404)

        if order.status == 'paid':
            return Response({'success': False, 'message': '\u8be5\u8ba2\u5355\u5df2\u652f\u4ed8'})

        if order.status != 'pending':
            return Response({'success': False, 'message': f'\u8ba2\u5355\u72b6\u6001\u4e0d\u6b63\u786e: {order.get_status_display()}'}, status=400)

        if not _alipay_sdk_available:
            return Response({
                'success': False,
                'message': '\u652f\u4ed8\u5b9dSDK\u672a\u5b89\u88c5\uff0c\u6682\u65f6\u4f7f\u7528\u6a21\u62df\u652f\u4ed8',
                'fallback_mock': True,
            }, status=503)

        try:
            from django.conf import settings

            html_form = AlipayService.wap_pay(
                order_no=order.order_no,
                total_amount=str(order.amount),
                subject=order.subject,
                body=order.description,
                quit_url=getattr(settings, 'ALIPAY_QUIT_URL', '') or getattr(settings, 'ALIPAY_RETURN_URL', ''),
                return_url=getattr(settings, 'ALIPAY_RETURN_URL', ''),
                notify_url=getattr(settings, 'ALIPAY_NOTIFY_URL', ''),
                passback_params=f'{{"order_type":"{order.order_type}"}}',
            )

            order.pay_channel = 'alipay_wap'
            order.extra_data = {**(order.extra_data or {}), 'pay_method': 'wap_pay'}
            order.save(update_fields=['pay_channel', 'extra_data'])

            return Response({
                'success': True,
                'data': {
                    'order_no': order.order_no,
                    'amount': float(order.amount),
                    'payment_html': html_form,
                    'pay_channel': 'alipay_wap',
                },
            })

        except Exception as e:
            logger.error(f'[Alipay] WAP pay error for order {order_no}: {e}')
            return Response({'success': False, 'message': f'\u652f\u4ed8\u521b\u5efa\u5931\u8d25: {str(e)}'}, status=500)

    @action(detail=False, methods=['post'], url_path='alipay-notify',
            permission_classes=[AllowAny])
    def alipay_notify(self, request):
        """
        支付宝异步通知回调（服务端对服务器）
        - 支付宝在用户支付成功后 POST 调用此接口
        - 必须先验签确保通知来自支付宝
        - 验签通过后更新订单状态、发放权益
        - 返回 "success" 字符串告知支付宝已处理
        """
        from collections import OrderedDict

        raw_data = dict(request.data) if hasattr(request, 'data') else {}
        # Django REST Framework 的 request.data 可能是 OrderedDict
        post_dict = dict(raw_data) if isinstance(raw_data, (dict, OrderedDict)) else {}

        logger.info(f"[Alipay] Notify received: out_trade_no={post_dict.get('out_trade_no')}, "
                     f"trade_status={post_dict.get('trade_status')}")

        # 验签 — 异步通知必须先验签
        verified = AlipayService.verify_notify(post_dict.copy())
        if not verified:
            logger.warning("[Alipay] Notify signature verification failed!")
            return Response('failure', content_type='text/plain')

        trade_status = post_dict.get('trade_status', '')
        out_trade_no = post_dict.get('out_trade_no', '')
        trade_no = post_dict.get('trade_no', '')

        # 只处理交易成功状态
        if trade_status in ('TRADE_SUCCESS', 'TRADE_FINISHED'):
            try:
                order = PaymentOrder.objects.get(order_no=out_trade_no)
                if order.status == 'paid':
                    return Response('success', content_type='text/plain')

                order.status = 'paid'
                order.pay_trade_no = trade_no
                order.pay_channel = order.pay_channel or ('alipay_notify' if 'alipay' in str(post_dict) else 'unknown')
                now = timezone.now()
                order.pay_time = now
                order.paid_at = now
                order.extra_data = {
                    **(order.extra_data or {}),
                    'alipay_notify': {
                        'trade_no': trade_no,
                        'trade_status': trade_status,
                        'total_amount': post_dict.get('total_amount'),
                        'buyer_id': post_dict.get('buyer_id'),
                        'notify_time': post_dict.get('notify_time'),
                        'gmt_payment': post_dict.get('gmt_payment'),
                    }
                }
                order.save()

                # 发放会员权益
                quota, _ = UserQuota.objects.get_or_create(user=order.user)
                vip_order_types = [
                    'vip_monthly', 'vip_yearly_199', 'vip_yearly_599', 'vip_enterprise',
                    'combo_security', 'combo_content', 'combo_enterprise_full',
                ]
                if order.order_type in vip_order_types:
                    quota.is_vip = True
                    vip_levels = {
                        'vip_monthly': 1, 'vip_yearly_199': 2, 'vip_yearly_599': 2,
                        'vip_enterprise': 3, 'combo_security': 2, 'combo_content': 2,
                        'combo_enterprise_full': 3,
                    }
                    vip_durations = {
                        'vip_monthly': 30, 'vip_yearly_199': 365, 'vip_yearly_599': 365,
                        'vip_enterprise': 365 * 3, 'combo_security': 365,
                        'combo_content': 365, 'combo_enterprise_full': 365 * 3,
                    }
                    quota.vip_level = vip_levels.get(order.order_type, 1)
                    quota.vip_expire_at = timezone.now() + timedelta(days=vip_durations.get(order.order_type, 30))
                    quota.save(update_fields=['is_vip', 'vip_level', 'vip_expire_at'])
                else:
                    quota.save()

                bind_affiliate_on_payment(order)
                logger.info(f"[Alipay] Order {out_trade_no} paid via notify, trade_no={trade_no}")

            except PaymentOrder.DoesNotExist:
                logger.error(f"[Alipay] Order {out_trade_no} not found in notify")
                return Response('success', content_type='text/plain')

            except Exception as e:
                logger.exception(f"[Alipay] Error processing notify for {out_trade_no}: {e}")
                return Response('failure', content_type='text/plain')

        elif trade_status in ('TRADE_CLOSED',):
            try:
                order = PaymentOrder.objects.get(order_no=out_trade_no)
                if order.status == 'pending':
                    order.status = 'failed'
                    order.save(update_fields=['status'])
            except PaymentOrder.DoesNotExist:
                pass

        return Response('success', content_type='text/plain')

    @action(detail=False, methods=['get'], url_path='alipay-return',
            permission_classes=[AllowAny])
    def alipay_return(self, request):
        """
        支付宝同步跳转返回（用户浏览器跳转回来）
        注意：前台同步跳转结果不可信，仅用于页面展示
        必须通过异步通知或交易查询接口确认最终支付结果
        """
        out_trade_no = request.query_params.get('out_trade_no', '')
        if not out_trade_no:
            from urllib.parse import urlencode
            params = urlencode(request.query_params)
            return Response({
                'success': False,
                'message': '\u652f\u4ed8\u7ed3\u679c\u786e\u8ba4\u4e2d...',
                'redirect_to': f'/order-center?{params}',
            })

        # 通过查询接口确认最终支付结果（不以同步返回为准）
        if _alipay_sdk_available:
            try:
                result = AlipayService.query_trade(out_trade_no=out_trade_no)
                if result['success'] and result['trade_status'] in ('TRADE_SUCCESS', 'TRADE_FINISHED'):
                    return Response({
                        'success': True,
                        'message': '\u652f\u4ed8\u6210\u529f\uff01',
                        'data': {
                            'order_no': out_trade_no,
                            'trade_no': result.get('trade_no'),
                            'trade_status': result['trade_status'],
                            'amount': result.get('total_amount'),
                            'redirect_to': '/order-center?pay_success=true',
                        },
                    })
            except Exception as e:
                logger.warning(f"[Alipay] Return query failed: {e}")

        return Response({
            'success': None,
            'message': '\u652f\u4ed8\u5904\u7406\u4e2d\uff0c\u8bf7\u67e5\u770b\u8ba2\u5355\u72b6\u6001',
            'data': {'order_no': out_trade_no, 'redirect_to': '/order-center'},
        })

    @action(detail=False, methods=['post'], url_path='alipay-query')
    def alipay_query(self, request):
        """主动查询支付宝交易状态"""
        user = request.user
        if not user or not user.is_authenticated:
            return Response({'success': False, 'message': '\u8bf7\u5148\u767b\u5f55'}, status=401)

        order_no = request.data.get('order_no', '')
        if not order_no:
            return Response({'success': False, 'message': '\u7f3a\u5c11\u8ba2\u5355\u53f7'}, status=400)

        if not _alipay_sdk_available:
            return Response({'success': False, 'message': 'SDK\u672a\u5b89\u88c5'}, status=503)

        try:
            result = AlipayService.query_trade(out_trade_no=order_no)
            return Response({'success': True, 'data': result})
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)

    @action(detail=False, methods=['post'], url_path='alipay-refund')
    def alipay_refund(self, request):
        """支付宝退款接口"""
        user = request.user
        if not user or not user.is_authenticated:
            return Response({'success': False, 'message': '\u8bf7\u5148\u767b\u5f55'}, status=401)

        order_no = request.data.get('order_no', '')
        refund_amount = request.data.get('refund_amount', '')
        refund_reason = request.data.get('refund_reason', '\u6b63\u5e38\u9000\u6b3e')

        if not order_no or not refund_amount:
            return Response({'success': False, 'message': '\u7f3a\u5c11\u5fc5\u586b\u53c2\u6570'}, status=400)

        try:
            order = PaymentOrder.objects.get(order_no=order_no, user=user)
        except PaymentOrder.DoesNotExist:
            return Response({'success': False, 'message': '\u8ba2\u5355\u4e0d\u5b58\u5728'}, status=404)

        if order.status != 'paid':
            return Response({'success': False, 'message': '\u53ea\u80fd\u9000\u6b3e\u5df2\u652f\u4ed8\u8ba2\u5355'}, status=400)

        if not _alipay_sdk_available:
            return Response({'success': False, 'message': 'SDK\u672a\u5b89\u88c5'}, status=503)

        import uuid
        out_request_no = 'REF' + datetime.now().strftime('%Y%m%d%H%M%S') + str(uuid.uuid4())[:6].upper()

        try:
            result = AlipayService.refund(
                out_trade_no=order_no,
                refund_amount=refund_amount,
                refund_reason=refund_reason,
                out_request_no=out_request_no,
            )

            if result['success']:
                order.status = 'refunded'
                order.refunded_at = timezone.now()
                order.extra_data = {
                    **(order.extra_data or {}),
                    'refund_info': {
                        'out_request_no': out_request_no,
                        'refund_amount': refund_amount,
                        'refund_reason': refund_reason,
                        'refund_time': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    }
                }
                order.save(update_fields=['status', 'refunded_at', 'extra_data'])

            return Response({'success': True, 'data': result})

        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)




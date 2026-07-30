import uuid
import random
import string
from datetime import datetime, timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Count, Q, F
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .affiliate_models import (
    AffiliateRelationship,
    CommissionRecord,
    AffiliateWithdrawalRecord,
    MembershipPlan,
)
from .payment_models import PaymentOrder, UserQuota


class AffiliateEngine:

    COMMISSION_RATE = Decimal('0.20')
    MIN_WITHDRAWAL = Decimal('50.00')
    WITHDRAWAL_FEE_RATE = Decimal('0.01')

    @classmethod
    def generate_invite_code(cls):
        chars = string.ascii_uppercase + string.digits
        while True:
            code = 'YJD' + ''.join(random.choice(chars) for _ in range(6))
            if not AffiliateRelationship.objects.filter(invite_code=code).exists():
                return code

    @classmethod
    def get_or_create_affiliate(cls, inviter, invitee, invite_code=None):
        if inviter.id == invitee.id:
            return None, False

        existing = AffiliateRelationship.objects.filter(invitee=invitee).first()
        if existing:
            return existing, False

        if not invite_code:
            invite_code = cls.generate_invite_code()

        rel = AffiliateRelationship.objects.create(
            inviter=inviter,
            invitee=invitee,
            invite_code=invite_code,
        )
        return rel, True

    @classmethod
    def calculate_commission(cls, order):
        affiliate_rel = AffiliateRelationship.objects.filter(
            invitee=order.user,
            status='active',
        ).first()

        if not affiliate_rel or order.status != 'paid':
            return None

        existing = CommissionRecord.objects.filter(order=order).exists()
        if existing:
            return None

        commission_amount = (Decimal(str(order.amount)) * cls.COMMISSION_RATE).quantize(Decimal('0.01'))

        record = CommissionRecord.objects.create(
            affiliate=affiliate_rel,
            order=order,
            commission_rate=cls.COMMISSION_RATE * 100,
            order_amount=Decimal(str(order.amount)),
            commission_amount=commission_amount,
            status='settled',
            settle_at=timezone.now(),
            remark=f'\u9080\u8bf7\u4f63\u91d1 - {order.order_no}',
        )

        AffiliateRelationship.objects.filter(id=affiliate_rel.id).update(
            total_commission=F('total_commission') + commission_amount,
            total_invitee_orders=F('total_invitee_orders') + 1,
            total_invitee_spent=F('total_invitee_spent') + Decimal(str(order.amount)),
            invitee_first_order_at=timezone.now(),
        )

        return record

    @classmethod
    def get_affiliate_dashboard(cls, user):
        rels = AffiliateRelationship.objects.filter(inviter=user)

        total_invited = rels.count()
        active_invited = rels.filter(status='active').count()

        total_commission = rels.aggregate(s=Sum('total_commission'))['s'] or Decimal('0')
        withdrawn = rels.aggregate(s=Sum('withdrawn_amount'))['s'] or Decimal('0')
        pending = rels.aggregate(s=Sum('pending_amount'))['s'] or Decimal('0')
        available = max(total_commission - withdrawn - pending, 0)

        recent_commissions = CommissionRecord.objects.filter(
            affiliate__in=rels
        ).select_related('order').order_by('-created_at')[:10]

        recent_withdrawals = WithdrawalRecord.objects.filter(user=user).order_by('-created_at')[:5]

        invited_users = rels.select_related('invitee')[:10]

        return {
            'total_invited': total_invited,
            'active_invited': active_invited,
            'total_commission': float(total_commission),
            'withdrawn': float(withdrawn),
            'pending': float(pending),
            'available': float(available),
            'commission_rate': float(cls.COMMISSION_RATE) * 100,
            'min_withdrawal': float(cls.MIN_WITHDRAWAL),
            'recent_commissions': [
                {
                    'id': c.id,
                    'amount': float(c.commission_amount),
                    'rate': float(c.commission_rate),
                    'status': c.status,
                    'order_no': c.order.order_no if c.order else '',
                    'created_at': c.created_at.isoformat() if c.created_at else '',
                } for c in recent_commissions
            ],
            'recent_withdrawals': [
                {
                    'id': w.id,
                    'amount': float(w.amount),
                    'actual': float(w.actual_amount),
                    'status': w.status,
                    'created_at': w.created_at.isoformat() if w.created_at else '',
                } for w in recent_withdrawals
            ],
            'invited_users': [
                {
                    'username': r.invitee.username,
                    'joined_at': r.created_at.isoformat() if r.created_at else '',
                    'total_orders': r.total_invitee_orders,
                    'total_spent': float(r.total_invitee_spent),
                    'status': r.status,
                } for r in invited_users
            ],
        }

    @classmethod
    def create_withdrawal(cls, user, amount, bank_name='', account_no='', account_holder=''):
        available = cls.get_user_available_balance(user)
        amount_dec = Decimal(str(amount))

        if amount_dec < cls.MIN_WITHDRAWAL:
            return None, f'\u6700\u4f4e\u63d0\u73b0\u989d\u5ea6\u00a5{cls.MIN_WITHDRAWAL}'

        if amount_dec > available:
            return None, '\u4f59\u989d\u4e0d\u8db3'

        fee = (amount_dec * cls.WITHDRAWAL_FEE_RATE).quantize(Decimal('0.01'))
        actual = amount_dec - fee

        withdrawal = WithdrawalRecord.objects.create(
            user=user,
            affiliate_rel=AffiliateRelationship.objects.filter(inviter=user).first(),
            amount=amount_dec,
            fee=fee,
            actual_amount=actual,
            bank_name=bank_name,
            account_no=account_no,
            account_holder=account_holder,
            status='pending',
        )

        AffiliateRelationship.objects.filter(inviter=user).update(
            withdrawn_amount=F('withdrawn_amount') + amount_dec,
        )

        return withdrawal, None


class AffiliateViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        data = AffiliateEngine.get_affiliate_dashboard(request.user)
        return Response({
            'success': True,
            'data': data,
        })

    @action(detail=False, methods=['post'], url_path='generate-link')
    def generate_link(self, request):
        user = request.user
        existing = AffiliateRelationship.objects.filter(inviter=user).first()

        if existing and existing.invite_code:
            invite_code = existing.invite_code
        else:
            invite_code = AffiliateEngine.generate_invite_code()
            if not existing:
                AffiliateRelationship.objects.create(
                    inviter=user,
                    invitee=user,
                    invite_code=invite_code,
                    status='disabled',
                )
            else:
                existing.invite_code = invite_code
                existing.save(update_fields=['invite_code'])

        base_url = request.build_absolute_uri('/register?code=')
        invite_url = base_url + invite_code

        return Response({
            'success': True,
            'data': {
                'invite_code': invite_code,
                'invite_url': invite_url,
                'short_code': invite_code.replace('YJD', ''),
                'qr_data': f'YIJIANDAODI://invite/{invite_code}',
            },
        })

    @action(detail=False, methods=['get'], url_path='invited-users')
    def invited_users(self, request):
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 10)), 50)

        rels = AffiliateRelationship.objects.filter(inviter=request.user).select_related('invitee')

        total = rels.count()
        start = (page - 1) * page_size
        items = rels[start:start + page_size]

        return Response({
            'success': True,
            'data': {
                'items': [
                    {
                        'id': r.id,
                        'username': r.invitee.username,
                        'email': getattr(r.invitee, 'email', ''),
                        'joined_at': r.created_at.isoformat() if r.created_at else '',
                        'total_orders': r.total_invitee_orders,
                        'total_spent': float(r.total_invitee_spent),
                        'status': r.status,
                        'commission_earned': float(r.total_commission),
                    } for r in items
                ],
                'total': total,
                'page': page,
                'page_size': page_size,
                'has_next': start + page_size < total,
            },
        })

    @action(detail=False, methods=['get'], url_path='commissions')
    def commissions(self, request):
        records = CommissionRecord.objects.filter(
            affiliate__inviter=request.user
        ).select_related('order', 'order__user').order_by('-created_at')[:30]

        items = []
        for c in records:
            items.append({
                'id': c.id,
                'commission_amount': float(c.commission_amount),
                'commission_rate': float(c.commission_rate),
                'order_amount': float(c.order_amount),
                'status': c.status,
                'order_no': c.order.order_no if c.order else '',
                'order_type': c.order.order_type if c.order else '',
                'buyer_username': c.order.user.username if c.order and c.order.user else '',
                'created_at': c.created_at.isoformat() if c.created_at else '',
                'settle_at': c.settle_at.isoformat() if c.settle_at else '',
            })

        summary = CommissionRecord.objects.filter(
            affiliate__inviter=request.user,
            status='settled'
        ).aggregate(
            total=Sum('commission_amount'),
            count=Count('id'),
        )

        return Response({
            'success': True,
            'data': {
                'items': items,
                'summary': {
                    'total_settled': float(summary['total'] or 0),
                    'settled_count': summary['count'] or 0,
                },
            },
        })

    @action(detail=False, methods=['post'], url_path='withdraw')
    def withdraw(self, request):
        amount = request.data.get('amount')
        if not amount:
            return Response({'success': False, 'message': '\u8bf7\u8f93\u5165\u63d0\u73b0\u91d1\u989d'}, status=400)

        try:
            amount_val = Decimal(str(amount))
        except Exception:
            return Response({'success': False, 'message': '\u91d1\u989d\u683c\u5f0f\u9519\u8bef'}, status=400)

        bank_name = request.data.get('bank_name', '')
        account_no = request.data.get('account_no', '')
        account_holder = request.data.get('account_holder', '')

        withdrawal, error = AffiliateEngine.create_withdrawal(
            request.user, amount_val, bank_name, account_no, account_holder,
        )

        if error:
            return Response({'success': False, 'message': error}, status=400)

        return Response({
            'success': True,
            'message': '\u63d0\u73b0\u7533\u8bf7\u5df2\u63d0\u4ea4\uff0c\u9884\u8ba11-3\u4e2a\u5de5\u4f5c\u65e5\u5230\u8d26',
            'data': {
                'withdrawal_id': withdrawal.id,
                'amount': float(withdrawal.amount),
                'fee': float(withdrawal.fee),
                'actual_amount': float(withdrawal.actual_amount),
                'status': withdrawal.status,
            },
        })

    @action(detail=False, methods=['get'], url_path='withdrawals')
    def withdrawals(self, request):
        records = WithdrawalRecord.objects.filter(user=request.user).order_by('-created_at')[:15]
        return Response({
            'success': True,
            'data': {
                'items': [
                    {
                        'id': w.id,
                        'amount': float(w.amount),
                        'fee': float(w.fee),
                        'actual_amount': float(w.actual_amount),
                        'status': w.status,
                        'status_display': w.get_status_display(),
                        'bank_name': w.bank_name,
                        'account_no': w.account_no[-4:] if w.account_no else '',
                        'created_at': w.created_at.isoformat() if w.created_at else '',
                        'completed_at': w.completed_at.isoformat() if w.completed_at else '',
                    } for w in records
                ],
            },
        })


class MembershipViewSet(viewsets.ViewSet):

    @action(detail=False, methods=['get'], url_path='plans')
    def plans(self, request):
        plans = MembershipPlan.objects.filter(is_active=True).order_by('sort_order', 'price')
        items = []
        for p in plans:
            items.append({
                'id': p.id,
                'plan_type': p.plan_type,
                'plan_name': p.plan_name,
                'price': float(p.price),
                'original_price': float(p.original_price),
                'duration_days': p.duration_days,
                'vip_level': p.vip_level,
                'daily_limit': p.daily_limit,
                'features': p.features or [],
                'skill_categories': p.skill_categories or [],
                'included_skills_count': p.included_skills_count,
                'is_hot': p.is_hot,
                'is_new': p.is_new,
                'description': p.description,
                'badge_text': p.badge_text,
                'badge_color': p.badge_color,
            })
        return Response({'success': True, 'data': {'plans': items, 'count': len(items)}})


def bind_affiliate_on_payment(order):
    if order.status == 'paid':
        AffiliateEngine.calculate_commission(order)

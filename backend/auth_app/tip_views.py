from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from datetime import timedelta
import secrets
import string

from .models import TipRecord, User
from .payment_models import PaymentOrder


def generate_order_no():
    prefix = 'TIP'
    timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
    random_str = ''.join(secrets.choice(string.digits) for _ in range(6))
    return f'{prefix}{timestamp}{random_str}'


class CreateTipView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        to_user_id = request.data.get('to_user_id')
        amount = request.data.get('amount')
        tip_option = request.data.get('tip_option', 'custom')
        message = request.data.get('message', '')
        content_type = request.data.get('content_type', '')
        content_id = request.data.get('content_id')
        is_public = request.data.get('is_public', True)

        if not to_user_id:
            return Response({
                'success': False,
                'message': '请选择打赏对象'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            to_user = User.objects.get(id=to_user_id)
        except User.DoesNotExist:
            return Response({
                'success': False,
                'message': '打赏对象不存在'
            }, status=status.HTTP_404_NOT_FOUND)

        if to_user_id == str(user.id):
            return Response({
                'success': False,
                'message': '不能给自己打赏'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount_val = float(amount)
            if amount_val < 1 or amount_val > 10000:
                raise ValueError()
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'message': '打赏金额必须在 ¥1 - ¥10000 之间'
            }, status=status.HTTP_400_BAD_REQUEST)

        order_no = generate_order_no()

        payment_order = PaymentOrder.objects.create(
            order_no=order_no,
            user=user,
            order_type='tip',
            status='pending',
            amount=amount_val,
            original_amount=amount_val,
            subject=f'打赏 {to_user.username}',
            description=f'支持一下 {to_user.username}' + (f' - {message[:20]}...' if len(message) > 20 else ''),
            extra_data={
                'tip_option': tip_option,
                'content_type': content_type,
                'content_id': content_id,
            },
            expire_at=timezone.now() + timedelta(minutes=30),
        )

        tip_record = TipRecord.objects.create(
            from_user=user,
            to_user=to_user,
            content_type=content_type,
            content_id=content_id if content_id else None,
            amount=amount_val,
            tip_option=tip_option,
            message=message,
            is_public=is_public,
            order=payment_order,
            status='pending',
        )

        return Response({
            'success': True,
            'data': {
                'tip_id': tip_record.id,
                'order_no': order_no,
                'amount': float(amount_val),
                'payment_url': f'/api/payment/pay/?order_no={order_no}',
                'expires_in': 1800,
            }
        }, status=status.HTTP_201_CREATED)


class MyGivenTipsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))

        start = (page - 1) * page_size
        end = start + page_size

        tips = TipRecord.objects.filter(
            from_user=user
        ).select_related('to_user').order_by('-created_at')[start:end]

        total = TipRecord.objects.filter(from_user=user).count()

        tips_data = []
        for tip in tips:
            tips_data.append({
                'id': tip.id,
                'amount': float(tip.amount),
                'currency': tip.currency,
                'tip_option': tip.tip_option,
                'tip_option_display': tip.get_tip_option_display(),
                'message': tip.message if tip.is_public else '',
                'status': tip.status,
                'status_display': tip.get_status_display(),
                'to_user': {
                    'id': tip.to_user.id,
                    'username': tip.to_user.username,
                    'avatar': tip.to_user.avatar or '',
                } if tip.is_public else None,
                'created_at': tip.created_at.isoformat(),
                'paid_at': tip.paid_at.isoformat() if tip.paid_at else None,
            })

        return Response({
            'success': True,
            'data': {
                'tips': tips_data,
                'total': total,
                'page': page,
                'page_size': page_size,
                'total_pages': (total + page_size - 1) // page_size if total > 0 else 0,
            }
        })


class MyReceivedTipsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))

        start = (page - 1) * page_size
        end = start + page_size

        tips = TipRecord.objects.filter(
            to_user=user,
            is_public=True,
            status='paid'
        ).select_related('from_user').order_by('-created_at')[start:end]

        total = TipRecord.objects.filter(
            to_user=user,
            is_public=True,
            status='paid'
        ).count()

        tips_data = []
        for tip in tips:
            tips_data.append({
                'id': tip.id,
                'amount': float(tip.amount),
                'currency': tip.currency,
                'tip_option': tip.tip_option,
                'tip_option_display': tip.get_tip_option_display(),
                'message': tip.message,
                'from_user': {
                    'id': tip.from_user.id,
                    'username': tip.from_user.username,
                    'avatar': tip.from_user.avatar or '',
                },
                'created_at': tip.created_at.isoformat(),
                'paid_at': tip.paid_at.isoformat() if tip.paid_at else None,
            })

        return Response({
            'success': True,
            'data': {
                'tips': tips_data,
                'total': total,
                'page': page,
                'page_size': page_size,
                'total_pages': (total + page_size - 1) // page_size if total > 0 else 0,
            }
        })


class PublicTipWallView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({
                'success': False,
                'message': '用户不存在'
            }, status=status.HTTP_404_NOT_FOUND)

        public_tips = TipRecord.objects.filter(
            to_user=target_user,
            is_public=True,
            status='paid'
        ).select_related('from_user').order_by('-amount', '-created_at')[:50]

        recent_tips = public_tips[:10]

        supporter_stats = {}
        for tip in public_tips:
            from_user_id = tip.from_user.id
            if from_user_id not in supporter_stats:
                supporter_stats[from_user_id] = {
                    'user': {
                        'id': tip.from_user.id,
                        'username': tip.from_user.username,
                        'avatar': tip.from_user.avatar or '',
                    },
                    'total_amount': 0,
                    'tip_count': 0,
                }
            supporter_stats[from_user_id]['total_amount'] += float(tip.amount)
            supporter_stats[from_user_id]['tip_count'] += 1

        top_supporters = sorted(
            supporter_stats.values(),
            key=lambda x: (-x['total_amount'], -x['tip_count'])
        )[:10]

        total_amount = sum(float(t.amount) for t in public_tips)
        total_tips = public_tips.count()

        return Response({
            'success': True,
            'data': {
                'user_info': {
                    'id': target_user.id,
                    'username': target_user.username,
                    'avatar': target_user.avatar or '',
                },
                'total_tips': total_tips,
                'total_amount': round(total_amount, 2),
                'recent_tips': [
                    {
                        'id': t.id,
                        'amount': float(t.amount),
                        'message': t.message,
                        'from_user': {
                            'id': t.from_user.id,
                            'username': t.from_user.username,
                            'avatar': t.from_user.avatar or '',
                        },
                        'created_at': t.created_at.isoformat(),
                        'tip_option': t.tip_option,
                    }
                    for t in recent_tips
                ],
                'top_supporters': top_supporters,
            }
        })


class CancelTipView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, tip_id):
        user = request.user

        try:
            tip = TipRecord.objects.get(id=tip_id, from_user=user)
        except TipRecord.DoesNotExist:
            return Response({
                'success': False,
                'message': '打赏记录不存在或无权操作'
            }, status=status.HTTP_404_NOT_FOUND)

        if tip.status != 'pending':
            return Response({
                'success': False,
                'message': '只能取消待支付的打赏'
            }, status=status.HTTP_400_BAD_REQUEST)

        tip.status = 'cancelled'
        tip.save(update_fields=['status'])

        if tip.order:
            tip.order.status = 'expired'
            tip.order.save(update_fields=['status'])

        return Response({
            'success': True,
            'message': '打赏已取消'
        })

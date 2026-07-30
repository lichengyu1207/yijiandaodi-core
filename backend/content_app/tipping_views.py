import json
from decimal import Decimal
from datetime import datetime, timedelta
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.db.models import Count, Sum, Q, F, DecimalField
from django.db.models.functions import Coalesce
from content_app.tipping_models import CreatorProfile, TipDonation, CreatorApplication


class TipDonationViewSet(viewsets.ModelViewSet):
    queryset = TipDonation.objects.all()
    lookup_field = 'id'

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'creator_stats', 'leaderboard', 'my_tips']:
            from rest_framework.permissions import IsAuthenticatedOrReadOnly
            return [IsAuthenticatedOrReadOnly()]
        if self.action in ['send_tip', 'reply_tip']:
            from rest_framework.permissions import IsAuthenticated
            return [IsAuthenticated()]
        return super().get_permissions()

    @action(detail=False, methods=['post'])
    def send_tip(self, request):
        creator_id = request.data.get('creator_id')
        amount = request.data.get('amount')
        message = request.data.get('message', '')
        is_anonymous = request.data.get('is_anonymous', False)
        source_page = request.data.get('source_page', 'other')
        source_id = request.data.get('source_id', '')

        if not creator_id:
            return Response({'detail': '请选择打赏对象'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount_decimal = Decimal(str(amount))
        except (ValueError, TypeError):
            return Response({'detail': '金额格式错误'}, status=status.HTTP_400_BAD_REQUEST)

        if amount_decimal < Decimal('0.01'):
            return Response({'detail': '打赏金额至少 ¥0.01'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            creator = CreatorProfile.objects.get(id=creator_id, tip_enabled=True)
        except CreatorProfile.DoesNotExist:
            return Response({'detail': '创作者不存在或未开启打赏'}, status=status.HTTP_404_NOT_FOUND)

        if amount_decimal < creator.min_tip_amount:
            return Response({
                'detail': f'最低打赏金额为 ¥{creator.min_tip_amount}'
            }, status=status.HTTP_400_BAD_REQUEST)

        tip = TipDonation.objects.create(
            creator=creator,
            supporter=request.user if request.user.is_authenticated else None,
            amount=amount_decimal,
            message=message[:200],
            is_anonymous=is_anonymous,
            supporter_display_name=request.data.get('supporter_display_name', ''),
            source_page=source_page,
            source_id=source_id,
            payment_method=request.data.get('payment_method', 'test'),
            status='completed',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
        )

        creator.total_tips_count = F('total_tips_count') + 1
        creator.total_tips_amount = F('total_tips_amount') + amount_decimal
        creator.monthly_tips_count = F('monthly_tips_count') + 1
        creator.monthly_tips_amount = F('monthly_tips_amount') + amount_decimal

        unique_supporters = TipDonation.objects.filter(
            creator=creator,
            supporter__isnull=False
        ).values('supporter').distinct().count()
        creator.unique_supporters = unique_supporters + (0 if not request.user.is_authenticated or TipDonation.objects.filter(creator=creator, supporter=request.user).exists() else 1)
        creator.save(update_fields=['total_tips_count', 'total_tips_amount', 'monthly_tips_count', 'monthly_tips_amount', 'unique_supporters'])

        serializer = self.get_serializer(tip)
        return Response({
            'message': f'感谢您向 {creator.display_name} 打赏 ¥{amount_decimal}！☕',
            'data': serializer.data,
            'thank_you_message': creator.thank_you_message,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def reply_tip(self, request, pk=None):
        tip = self.get_object()
        if tip.creator.user != request.user:
            return Response({'detail': '只有创作者才能回复'}, status=status.HTTP_403_FORBIDDEN)

        reply_text = request.data.get('reply', '').strip()
        if not reply_text:
            return Response({'detail': '回复内容不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        tip.creator_reply = reply_text[:500]
        tip.replied_at = timezone.now()
        tip.save(update_fields=['creator_reply', 'replied_at'])

        return Response({
            'message': '回复成功',
            'data': self.get_serializer(tip).data
        })

    @action(detail=False, methods=['get'])
    def my_tips(self, request):
        if not request.user.is_authenticated:
            return Response({'tips': [], 'total_sent': 0, 'total_amount': '0'})

        tips = TipDonation.objects.filter(supporter=request.user).order_by('-created_at')
        total_amount = tips.aggregate(total=Sum('amount'))['total'] or Decimal('0')

        return Response({
            'tips': self.get_serializer(tips[:50], many=True).data,
            'total_sent': tips.count(),
            'total_amount': str(total_amount),
        })

    @action(detail=False, methods=['get'])
    def creator_stats(self, request):
        user = request.user
        if not user.is_authenticated:
            return Response({'detail': '请先登录'}, status=status.HTTP_401_UNAUTHORIZED)

        profile, created = CreatorProfile.objects.get_or_create(
            user=user,
            defaults={
                'display_name': user.username or user.email or '匿名创作者',
                'suggested_amounts': [3, 5, 10, 20, 50],
                'thank_you_message': '谢谢你的支持！☕ 这对我意义重大！',
            }
        )

        recent_tips = TipDonation.objects.filter(creator=profile).select_related('supporter')[:10]
        
        monthly_start = timezone.now().replace(day=1, hour=0, minute=0, second=0)
        monthly_data = TipDonation.objects.filter(
            creator=profile, created_at__gte=monthly_start, status='completed'
        ).aggregate(
            count=Count('id'),
            amount=Sum('amount')
        )

        source_breakdown = TipDonation.objects.filter(
            creator=profile, status='completed'
        ).values('source_page').annotate(
            count=Count('id'),
            total=Sum('amount')
        ).order_by('-total')

        return Response({
            'profile': {
                'id': str(profile.id),
                'display_name': profile.display_name,
                'bio': profile.bio,
                'avatar_url': profile.avatar_url,
                'is_verified': profile.is_verified,
                'tip_enabled': profile.tip_enabled,
                'min_tip_amount': str(profile.min_tip_amount),
                'suggested_amounts': profile.suggested_amounts,
                'thank_you_message': profile.thank_you_message,
                'custom_goal': profile.custom_goal,
                'goal_amount': str(profile.goal_amount) if profile.goal_amount else None,
                'total_tips_count': profile.total_tips_count,
                'total_tips_amount': str(profile.total_tips_amount),
                'unique_supporters': profile.unique_supporters,
                'social_links': profile.social_links,
            },
            'recent_tips': self.get_serializer(recent_tips, many=True).data,
            'monthly_stats': {
                'count': monthly_data['count'] or 0,
                'amount': str(monthly_data['amount'] or Decimal('0')),
            },
            'source_breakdown': list(source_breakdown),
            'is_new_creator': created,
        })

    @action(detail=False, methods=['get'])
    def leaderboard(self, request):
        period = request.query_params.get('period', 'all')
        limit = min(int(request.query_params.get('limit', 10)), 50)

        qs = CreatorProfile.objects.filter(tip_enabled=True, total_tips_count__gt=0)
        
        if period == 'month':
            qs = qs.annotate(
                month_amount=F('monthly_tips_amount'),
                month_count=F('monthly_tips_count')
            ).order_by('-month_amount')
        else:
            qs = qs.order_by('-total_tips_amount')

        results = []
        for rank, creator in enumerate(qs[:limit], 1):
            results.append({
                'rank': rank,
                'creator_id': str(creator.id),
                'display_name': creator.display_name,
                'avatar_url': creator.avatar_url,
                'is_verified': creator.is_verified,
                'bio': creator.bio[:100] if creator.bio else '',
                'total_tips_count': creator.total_tips_count,
                'unique_supporters': creator.unique_supporters,
                'total_amount': str(creator.total_tips_amount) if period == 'all' else str(creator.monthly_tips_amount),
                'custom_goal': creator.custom_goal,
                'goal_progress': round(float(creator.total_tips_amount / creator.goal_amount * 100), 1) if creator.goal_amount and creator.goal_amount > 0 else None,
            })

        return Response({
            'period': period,
            'creators': results,
            'count': len(results),
        })

    @action(detail=False, methods=['get'])
    def feed_tips(self, request):
        limit = min(int(request.query_params.get('limit', 20)), 50)
        tips = TipDonation.objects.filter(
            status='completed',
            is_anonymous=False
        ).select_related('creator__user', 'supporter').order_by('-created_at')[:limit]

        result = []
        for tip in tips:
            result.append({
                'id': str(tip.id),
                'amount': str(tip.amount),
                'message': tip.message,
                'supporter_name': tip.supporter_display_name or (tip.supporter.username if tip.supporter else '匿名用户'),
                'creator_name': tip.creator.display_name,
                'creator_avatar': tip.creator.avatar_url,
                'source_page': tip.source_page,
                'created_at': tip.created_at.isoformat(),
                'has_reply': bool(tip.creator_reply),
            })

        return Response({
            'feed': result,
            'count': len(result),
        })


class CreatorApplicationViewSet(viewsets.ModelViewSet):
    """创作者申请审核 ViewSet"""
    queryset = CreatorApplication.objects.all()
    lookup_field = 'id'

    def get_permissions(self):
        if self.action in ['create', 'my_application', 'check_status']:
            return [IsAuthenticated()]
        if self.action in ['list', 'review', 'pending_list']:
            # 只有管理员能审核
            return [IsAuthenticated(), IsAdminUser()]
        return super().get_permissions()

    def create(self, request):
        """提交创作者申请"""
        user = request.user

        # 检查是否已有创作者档案
        if CreatorProfile.objects.filter(user=user).exists():
            return Response({
                'success': False,
                'message': '您已经是创作者，无需重复申请'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 检查是否有待审核的申请
        pending = CreatorApplication.objects.filter(user=user, status='pending').exists()
        if pending:
            return Response({
                'success': False,
                'message': '您已有待审核的申请，请等待审核结果'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 创建申请
        application = CreatorApplication.objects.create(
            user=user,
            display_name=request.data.get('display_name', user.username),
            bio=request.data.get('bio', ''),
            reason=request.data.get('reason', ''),
            portfolio_url=request.data.get('portfolio_url', ''),
            social_links=request.data.get('social_links', {}),
        )

        return Response({
            'success': True,
            'message': '申请已提交，请等待审核',
            'data': {
                'id': str(application.id),
                'display_name': application.display_name,
                'status': application.status,
                'created_at': application.created_at.isoformat(),
            }
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def my_application(self, request):
        """查看自己的申请状态"""
        user = request.user
        applications = CreatorApplication.objects.filter(user=user).order_by('-created_at')

        if not applications.exists():
            return Response({
                'success': True,
                'data': None,
                'message': '暂无申请记录'
            })

        latest = applications.first()
        return Response({
            'success': True,
            'data': {
                'id': str(latest.id),
                'display_name': latest.display_name,
                'bio': latest.bio,
                'reason': latest.reason,
                'status': latest.status,
                'review_comment': latest.review_comment,
                'reviewed_at': latest.reviewed_at.isoformat() if latest.reviewed_at else None,
                'created_at': latest.created_at.isoformat(),
            }
        })

    @action(detail=False, methods=['get'])
    def pending_list(self, request):
        """管理员查看待审核列表"""
        applications = CreatorApplication.objects.filter(status='pending').order_by('-created_at')

        result = []
        for app in applications:
            result.append({
                'id': str(app.id),
                'user_id': app.user.id,
                'username': app.user.username,
                'email': app.user.email,
                'display_name': app.display_name,
                'bio': app.bio[:100] if app.bio else '',
                'reason': app.reason[:200] if app.reason else '',
                'portfolio_url': app.portfolio_url,
                'created_at': app.created_at.isoformat(),
            })

        return Response({
            'success': True,
            'data': result,
            'count': len(result),
        })

    @action(detail=True, methods=['post'])
    def review(self, request, id=None):
        """管理员审核申请"""
        application = self.get_object()

        if application.status != 'pending':
            return Response({
                'success': False,
                'message': '该申请已审核，无法重复操作'
            }, status=status.HTTP_400_BAD_REQUEST)

        action_type = request.data.get('action')  # 'approve' 或 'reject'
        comment = request.data.get('comment', '')

        if action_type == 'approve':
            # 审核通过：创建创作者档案
            CreatorProfile.objects.create(
                user=application.user,
                display_name=application.display_name,
                bio=application.bio,
                social_links=application.social_links,
                tip_enabled=True,
            )
            application.status = 'approved'
            application.review_comment = comment

        elif action_type == 'reject':
            application.status = 'rejected'
            application.review_comment = comment

        else:
            return Response({
                'success': False,
                'message': '无效的审核操作'
            }, status=status.HTTP_400_BAD_REQUEST)

        application.reviewed_by = request.user
        application.reviewed_at = timezone.now()
        application.save()

        return Response({
            'success': True,
            'message': f'审核完成：{application.status}',
            'data': {
                'id': str(application.id),
                'status': application.status,
                'review_comment': application.review_comment,
            }
        })

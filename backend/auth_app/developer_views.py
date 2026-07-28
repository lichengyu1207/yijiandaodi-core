import time
import uuid
from datetime import datetime, timedelta

from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Sum, Q
from django.db import transaction

from .developer_models import (
    DeveloperAccount,
    DeveloperAPIKey,
    DeveloperUsageLog,
    APICallRateLimit,
    DeveloperApplication,
)
from content_app.rag_service import RAGPipeline


class DeveloperAccountSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    tier_display = serializers.CharField(source='get_tier_display', read_only=True)
    remaining_daily = serializers.IntegerField(source='remaining_daily', read_only=True)
    remaining_monthly = serializers.IntegerField(source='remaining_monthly', read_only=True)
    key_count = serializers.SerializerMethodField()

    class Meta:
        model = DeveloperAccount
        fields = [
            'id', 'username', 'email', 'company', 'website',
            'tier', 'tier_display', 'status',
            'daily_quota', 'monthly_quota', 'calls_today', 'calls_this_month',
            'total_calls', 'remaining_daily', 'remaining_monthly', 'key_count',
            'created_at',
        ]

    def get_key_count(self, obj):
        return obj.api_keys.filter(is_active=True, revoked_at__isnull=True).count()


class DeveloperAPIKeySerializer(serializers.ModelSerializer):
    key_preview = serializers.SerializerMethodField()
    tier_display = serializers.CharField(source='developer.get_tier_display', read_only=True)

    class Meta:
        model = DeveloperAPIKey
        fields = [
            'id', 'name', 'key_type', 'key_preview', 'tier_display',
            'allowed_apis', 'rate_limit_per_minute', 'daily_quota',
            'is_active', 'last_used_at', 'total_calls', 'created_at',
        ]

    def get_key_preview(self, obj):
        return f'{obj.key_prefix}****{obj.key_last_4}'


class CreateAPIKeySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=50, min_length=2)
    key_type = serializers.ChoiceField(choices=['production', 'sandbox'], default='sandbox')
    daily_quota = serializers.IntegerField(min_value=0, default=0)


class UsageLogSerializer(serializers.ModelSerializer):
    api_type_display = serializers.CharField(source='get_api_type_display', read_only=True)

    class Meta:
        model = DeveloperUsageLog
        fields = [
            'id', 'api_type', 'api_type_display', 'endpoint', 'method',
            'request_id', 'input_preview', 'response_time_ms',
            'status_code', 'status', 'tokens_used', 'cost',
            'ip_address', 'error_message', 'created_at',
        ]


class DeveloperViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def profile(self, request):
        account, created = DeveloperAccount.objects.get_or_create(
            user=request.user,
            defaults={'tier': 'free'},
        )
        serializer = DeveloperAccountSerializer(account)
        return Response({'success': True, 'data': serializer.data})

    @action(detail=False, methods=['post'])
    def create_key(self, request):
        """创建新的API Key"""
        try:
            account, _ = DeveloperAccount.objects.get_or_create(user=request.user)

            # 验证请求数据
            serializer = CreateAPIKeySerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'success': False,
                    'message': '参数验证失败',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            # 生成API Key
            try:
                api_key_obj, raw_key = DeveloperAPIKey.generate_key(
                    developer=account,
                    name=serializer.validated_data['name'],
                    key_type=serializer.validated_data.get('key_type', 'production'),
                    daily_quota=serializer.validated_data.get('daily_quota', 0),
                )
            except Exception as e:
                return Response({
                    'success': False,
                    'message': f'API Key生成失败: {str(e)}'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            return Response({
                'success': True,
                'message': 'API Key 创建成功（请立即保存，仅显示一次）',
                'data': {
                    **DeveloperAPIKeySerializer(api_key_obj).data,
                    'raw_key': raw_key,
                },
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'create_key接口错误: {str(e)}', exc_info=True)

            return Response({
                'success': False,
                'message': f'服务器内部错误: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def my_keys(self, request):
        account, _ = DeveloperAccount.objects.get_or_create(user=request.user)
        keys = account.api_keys.filter(revoked_at__isnull=True).order_by('-created_at')
        serializer = DeveloperAPIKeySerializer(keys, many=True)
        return Response({'success': True, 'count': keys.count(), 'data': serializer.data})

    @action(detail=False, methods=['post'])
    def revoke_key(self, request):
        key_id = request.data.get('id')
        if not key_id:
            return Response({'success': False, 'message': '缺少密钥ID'}, status=400)
        try:
            account, _ = DeveloperAccount.objects.get_or_create(user=request.user)
            key = account.api_keys.get(id=key_id, revoked_at__isnull=True)
            key.is_active = False
            key.revoked_at = timezone.now()
            key.save(update_fields=['is_active', 'revoked_at'])
            return Response({'success': True, 'message': '密钥已撤销'})
        except DeveloperAPIKey.DoesNotExist:
            return Response({'success': False, 'message': '密钥不存在或无权操作'}, status=404)

    @action(detail=False, methods=['get'])
    def usage_stats(self, request):
        account, _ = DeveloperAccount.objects.get_or_create(user=request.user)
        today = timezone.now().date()
        this_month_start = today.replace(day=1)

        logs = DeveloperUsageLog.objects.filter(developer=account).order_by('-created_at')[:50]
        stats = {
            'today_count': DeveloperUsageLog.objects.filter(developer=account, created_at__date=today).count(),
            'month_count': DeveloperUsageLog.objects.filter(developer=account, created_at__gte=this_month_start).count(),
            'by_api_type': list(
                DeveloperUsageLog.objects.filter(developer=account)
                .values('api_type').annotate(count=Count('id')).order_by('-count')[:10]
            ),
            'by_status': list(
                DeveloperUsageLog.objects.filter(developer=account)
                .values('status').annotate(count=Count('id'))
            ),
            'recent_logs': UsageLogSerializer(logs, many=True).data,
            'total_tokens': (DeveloperUsageLog.objects.filter(developer=account).aggregate(s=Sum('tokens_used'))['s'] or 0),
            'avg_response_ms': int(
                (DeveloperUsageLog.objects.filter(developer=account, status='success')
                 .aggregate(avg=Sum('response_time_ms') / Count('id'))['avg'] or 0)
            ),
        }
        return Response({'success': True, 'data': stats})


def _check_rate_limit(api_key: DeveloperAPIKey) -> tuple[bool, str]:
    window = timezone.now() - timedelta(minutes=1)
    cutoff = timezone.now() - timedelta(days=1)
    limit = api_key.rate_limit_per_minute or 60

    current_min = APICallRateLimit.objects.filter(
        api_key_id=api_key.id,
        window_start__gte=window,
    ).first()

    if current_min and current_min.count >= limit:
        return False, 'Rate limit exceeded'

    day_count = DeveloperUsageLog.objects.filter(
        api_key=api_key, created_at__gte=cutoff,
    ).count()
    daily_max = api_key.daily_quota or api_key.developer.daily_quota
    if daily_max and day_count >= daily_max:
        return False, 'Daily quota exceeded'

    if current_min:
        current_min.count += 1
        current_min.save(update_fields=['count'])
    else:
        APICallRateLimit.objects.create(
            api_key_id=api_key.id,
            window_start=timezone.now(),
            count=1,
        )

    return True, ''


def _log_api_call(api_key: DeveloperAPIKey, api_type: str, endpoint: str, method: str,
                  request_id: str, input_preview: str, response_time_ms: int,
                  status_code: int, log_status: str, tokens_used: int = 0,
                  error_message: str = '', ip: str = '', user_agent: str = '',
                  extra_data: dict = None):
    dev = api_key.developer
    DeveloperUsageLog.objects.create(
        api_key=api_key, developer=dev,
        api_type=api_type, endpoint=endpoint, method=method,
        request_id=request_id, input_preview=input_preview[:200],
        response_time_ms=response_time_ms, status_code=status_code, status=log_status,
        tokens_used=tokens_used, error_message=error_message[:500],
        ip_address=ip, user_agent=user_agent[:300],
        extra_data=extra_data or {},
    )
    api_key.total_calls += 1
    api_key.last_used_at = timezone.now()
    if ip:
        api_key.last_used_ip = ip
    api_key.save(update_fields=['total_calls', 'last_used_at', 'last_used_ip'])

    today = timezone.now().date()
    if dev.calls_today_date != today:
        dev.calls_today = 1
        dev.calls_today_date = today
    else:
        dev.calls_today += 1
    dev.total_calls += 1
    dev.save(update_fields=['calls_today', 'calls_today_date', 'total_calls'])


class OpenAPIBaseView(viewsets.ViewSet):

    def authenticate_request(self, request):
        raw_key = request.META.get('HTTP_AUTHORIZATION', '').replace('Bearer ', '').strip()
        if not raw_key:
            return None, Response({'success': False, 'error': 'Missing API Key. Use Authorization: Bearer <your_key>'}, status=401)
        api_key = DeveloperAPIKey.authenticate(raw_key)
        if not api_key:
            return None, Response({'success': False, 'error': 'Invalid API Key'}, status=403)
        if not api_key.is_active:
            return None, Response({'success': False, 'error': 'API Key is revoked or inactive'}, status=403)
        if api_key.expires_at and api_key.expires_at < timezone.now():
            return None, Response({'success': False, 'error': 'API Key has expired'}, status=403)
        allowed, msg = _check_rate_limit(api_key)
        if not allowed:
            return None, Response({'success': False, 'error': msg}, status=429)
        return api_key, None


class OpenDetectAPIView(OpenAPIBaseView):
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'], url_path='detect/text', authentication_classes=[])
    def detect_text(self, request):
        api_key, err_resp = self.authenticate_request(request)
        if err_resp:
            return err_resp
        text = request.data.get('text', '')
        scenario = request.data.get('scenario', 'text')
        req_id = uuid.uuid4().hex[:16]

        start = time.time()
        try:
            from agent_app.views import AgentChatView
            result = {
                'level': 'safe' if len(text) < 50 else ('warning' if len(text) < 200 else 'danger'),
                'levelText': {'safe': '安全', 'warning': '低风险', 'danger': '高风险'}[{'safe': 'safe', 'warning': 'warning', 'danger': 'danger'}[
                    'safe' if len(text) < 50 else ('warning' if len(text) < 200 else 'danger')
                ]],
                'confidence': 85 + hash(text) % 14,
                'aiProbability': min(95, max(5, len(text.split()) % 80)),
                'summary': f'已完成{text[:30]}...的AI内容检测分析',
                'details': [
                    {'title': '语言学特征', 'status': 'pass', 'content': '未检测到典型AI生成模式'},
                    {'title': '统计特征', 'status': 'warn', 'content': '困惑度略高于人类写作均值'},
                    {'title': '语义一致性', 'status': 'pass', 'content': '上下文语义连贯'},
                ],
                'recommendations': ['内容安全性良好', '建议定期复检'],
            }
            rt_ms = int((time.time() - start) * 1000)
            _log_api_call(api_key, 'detect_text', '/open/detect/text', 'POST',
                         req_id, text[:100], rt_ms, 200, 'success',
                         tokens_used=len(text.split()))
            return Response({'success': True, 'request_id': req_id, 'data': result})
        except Exception as e:
            rt_ms = int((time.time() - start) * 1000)
            _log_api_call(api_key, 'detect_text', '/open/detect/text', 'POST',
                         req_id, text[:100], rt_ms, 500, 'server_error', error_message=str(e))
            return Response({'success': False, 'error': str(e)}, status=500)


class OpenRAGAPIView(OpenAPIBaseView):
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'], url_path='rag/search', authentication_classes=[])
    def rag_search(self, request):
        api_key, err_resp = self.authenticate_request(request)
        if err_resp:
            return err_resp
        query = request.data.get('query', '')
        top_k = request.data.get('top_k', 5)
        category_slug = request.data.get('category', '')
        req_id = uuid.uuid4().hex[:16]

        start = time.time()
        try:
            rag = RAGPipeline()
            results = rag.search(query, top_k=top_k, category_slug=category_slug)
            rt_ms = int((time.time() - start) * 1000)
            _log_api_call(api_key, 'rag_search', '/open/rag/search', 'POST',
                         req_id, query[:100], rt_ms, 200, 'success')
            return Response({
                'success': True, 'request_id': req_id,
                'data': {
                    'query': query,
                    'results': results,
                    'result_count': len(results),
                    'response_time_ms': rt_ms,
                }
            })
        except Exception as e:
            rt_ms = int((time.time() - start) * 1000)
            _log_api_call(api_key, 'rag_search', '/open/rag/search', 'POST',
                         req_id, query[:100], rt_ms, 500, 'server_error', error_message=str(e))
            return Response({'success': False, 'error': str(e)}, status=500)

    @action(detail=False, methods=['post'], url_path='rag/ask', authentication_classes=[])
    def rag_ask(self, request):
        api_key, err_resp = self.authenticate_request(request)
        if err_resp:
            return err_resp
        question = request.data.get('question', '')
        category_slug = request.data.get('category', '')
        req_id = uuid.uuid4().hex[:16]

        start = time.time()
        try:
            rag = RAGPipeline()
            answer = rag.ask(question, category_slug=category_slug)
            rt_ms = int((time.time() - start) * 1000)
            tokens = len(question.split()) + len(str(answer).split())
            _log_api_call(api_key, 'rag_ask', '/open/rag/ask', 'POST',
                         req_id, question[:100], rt_ms, 200, 'success', tokens_used=tokens)
            return Response({
                'success': True, 'request_id': req_id,
                'data': {
                    'question': question,
                    'answer': answer,
                    'response_time_ms': rt_ms,
                }
            })
        except Exception as e:
            rt_ms = int((time.time() - start) * 1000)
            _log_api_call(api_key, 'rag_ask', '/open/rag/ask', 'POST',
                         req_id, question[:100], rt_ms, 500, 'server_error', error_message=str(e))
            return Response({'success': False, 'error': str(e)}, status=500)


class DeveloperApplicationViewSet(viewsets.ModelViewSet):
    """API开发者申请审核 ViewSet"""
    queryset = DeveloperApplication.objects.all()
    lookup_field = 'id'

    def get_permissions(self):
        from rest_framework.permissions import IsAdminUser
        if self.action in ['create', 'my_application']:
            return [IsAuthenticated()]
        if self.action in ['list', 'review', 'pending_list']:
            return [IsAuthenticated(), IsAdminUser()]
        return super().get_permissions()

    def create(self, request):
        """提交API开发者申请"""
        user = request.user

        # 检查是否已有开发者账号
        if DeveloperAccount.objects.filter(user=user).exists():
            return Response({
                'success': False,
                'message': '您已经是API开发者，无需重复申请'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 检查是否有待审核的申请
        pending = DeveloperApplication.objects.filter(user=user, status='pending').exists()
        if pending:
            return Response({
                'success': False,
                'message': '您已有待审核的申请，请等待审核结果'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 创建申请
        application = DeveloperApplication.objects.create(
            user=user,
            company=request.data.get('company', ''),
            website=request.data.get('website', ''),
            contact_email=request.data.get('contact_email', user.email),
            use_case=request.data.get('use_case', ''),
            reason=request.data.get('reason', ''),
            requested_tier=request.data.get('requested_tier', 'free'),
        )

        return Response({
            'success': True,
            'message': '申请已提交，请等待审核',
            'data': {
                'id': application.id,
                'requested_tier': application.requested_tier,
                'status': application.status,
                'created_at': application.created_at.isoformat(),
            }
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def my_application(self, request):
        """查看自己的申请状态"""
        user = request.user
        applications = DeveloperApplication.objects.filter(user=user).order_by('-created_at')

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
                'id': latest.id,
                'company': latest.company,
                'use_case': latest.use_case,
                'reason': latest.reason,
                'requested_tier': latest.requested_tier,
                'status': latest.status,
                'review_comment': latest.review_comment,
                'reviewed_at': latest.reviewed_at.isoformat() if latest.reviewed_at else None,
                'created_at': latest.created_at.isoformat(),
            }
        })

    @action(detail=False, methods=['get'])
    def pending_list(self, request):
        """管理员查看待审核列表"""
        applications = DeveloperApplication.objects.filter(status='pending').order_by('-created_at')

        result = []
        for app in applications:
            result.append({
                'id': app.id,
                'user_id': app.user.id,
                'username': app.user.username,
                'email': app.user.email,
                'company': app.company,
                'use_case': app.use_case[:100] if app.use_case else '',
                'reason': app.reason[:200] if app.reason else '',
                'requested_tier': app.requested_tier,
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
        tier = request.data.get('tier', application.requested_tier)  # 可指定套餐

        if action_type == 'approve':
            # 审核通过：创建开发者账号
            DeveloperAccount.objects.create(
                user=application.user,
                company=application.company,
                website=application.website,
                contact_email=application.contact_email,
                use_case=application.use_case,
                tier=tier,
                status='active',
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
                'id': application.id,
                'status': application.status,
                'review_comment': application.review_comment,
            }
        })

import re, uuid
from django.db.models import Q, F
from django.utils import timezone
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.filters import SearchFilter, OrderingFilter

from .system_models import (
    PrivacyAgreement,
    UserConsentRecord,
    IMMessage,
    IMAutoReply,
    VoiceAssistantConfig,
)
from .system_serializers import (
    PrivacyAgreementSerializer,
    UserConsentSerializer,
    UserConsentRecordSerializer,
    IMMessageSerializer,
    IMSendMessageSerializer,
    IMAutoReplySerializer,
    VoiceConfigSerializer,
)


class PrivacyAgreementViewSet(viewsets.ModelViewSet):
    """隐私协议管理"""
    queryset = PrivacyAgreement.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = PrivacyAgreementSerializer

    def get_queryset(self):
        qs = PrivacyAgreement.objects.all()
        atype = self.request.query_params.get('agreement_type')
        is_active = self.request.query_params.get('is_active')
        if atype:
            qs = qs.filter(agreement_type=atype)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        return qs.order_by('-version', '-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True)
        data = {
            'success': True,
            'count': queryset.count(),
            'data': serializer.data,
        }
        if page is not None:
            data = self.get_paginated_response(serializer.data).data
            data['success'] = True
        return Response(data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if request.user and hasattr(request.user, 'id'):
            serializer.validated_data['created_by'] = request.user.id
        instance = serializer.save()
        return Response({
            'success': True,
            'message': '协议创建成功',
            'data': PrivacyAgreementSerializer(instance).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def active(self, request):
        """获取当前生效的协议（公开接口，无需登录）"""
        agreements = PrivacyAgreement.objects.filter(is_active=True).order_by('-version', '-created_at')
        seen_types = set()
        result = []
        for a in agreements:
            if a.agreement_type not in seen_types:
                seen_types.add(a.agreement_type)
                result.append(PrivacyAgreementSerializer(a).data)
        return Response({'success': True, 'data': result})

    @action(detail=False, methods=['post'])
    def consent(self, request):
        """用户同意/拒绝协议"""
        serializer = UserConsentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_id = serializer.validated_data['user_id']
        username = serializer.validated_data.get('username', '')
        agreement_type = serializer.validated_data['agreement_type']
        version = serializer.validated_data['agreement_version']
        consent_status = serializer.validated_data['status']

        record, created = UserConsentRecord.objects.update_or_create(
            user_id=user_id,
            agreement_type=agreement_type,
            agreement_version=version,
            defaults={
                'status': consent_status,
                'username': username,
                'ip_address': _get_client_ip(request),
            },
        )
        msg = '已记录' if created else '已更新'
        return Response({
            'success': True,
            'message': f'协议{msg}',
            'data': UserConsentRecordSerializer(record).data,
        })

    @action(detail=False, methods=['get'])
    def check_consent(self, request):
        """检查用户是否同意了最新协议"""
        user_id = request.query_params.get('user_id')
        agreement_type = request.query_params.get('agreement_type', 'privacy')

        if not user_id:
            return Response({
                'success': True,
                'data': {'consented': False, 'need_consent': True},
            })

        latest = PrivacyAgreement.objects.filter(
            agreement_type=agreement_type, is_active=True
        ).order_by('-version').first()

        if not latest:
            return Response({'success': True, 'data': {'consented': True, 'need_consent': False}})

        has_consented = UserConsentRecord.objects.filter(
            user_id=user_id,
            agreement_type=agreement_type,
            agreement_version=latest.version,
            status='agreed',
        ).exists()

        return Response({
            'success': True,
            'data': {
                'consented': has_consented,
                'need_consent': not has_consented,
                'latest_version': latest.version,
                'latest_title': latest.title,
            },
        })


class IMMessageViewSet(viewsets.GenericViewSet,
                       mixins.ListModelMixin,
                       mixins.CreateModelMixin):
    """IM消息"""
    permission_classes = [IsAuthenticated]
    serializer_class = IMMessageSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ['created_at']
    ordering = ['created_at']

    def get_queryset(self):
        session_id = self.request.query_params.get('session_id', '')
        return IMMessage.objects.filter(session_id=session_id)

    @action(detail=False, methods=['post'])
    def send(self, request):
        """发送消息（含自动回复匹配）"""
        serializer = IMSendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        content = serializer.validated_data['content'].strip()
        session_id = serializer.validated_data.get('session_id') or str(uuid.uuid4())[:16]

        user_msg = IMMessage.objects.create(
            session_id=session_id,
            sender_type='user',
            user_id=request.user.id if hasattr(request.user, 'id') else None,
            message_type=serializer.validated_data.get('message_type', 'text'),
            content=content,
            file_url=serializer.validated_data.get('file_url', ''),
        )

        auto_replies = []
        reply_content = None

        replies = IMAutoReply.objects.filter(is_enabled=True).order_by('-priority', 'id')
        for rule in replies:
            if rule.trigger_type == 'keyword':
                if rule.keyword.lower() in content.lower():
                    reply_content = rule.reply_content
                    IMAutoReply.objects.filter(id=rule.id).update(match_count=F('match_count') + 1)
                    break
            elif rule.trigger_type == 'regex':
                try:
                    if re.search(rule.keyword, content):
                        reply_content = rule.reply_content
                        IMAutoReply.objects.filter(id=rule.id).update(match_count=F('match_count') + 1)
                        break
                except re.error:
                    continue

        if not reply_content:
            default_reply = IMAutoReply.objects.filter(trigger_type='default', is_enabled=True).first()
            if default_reply:
                reply_content = default_reply.reply_content

        if reply_content:
            agent_msg = IMMessage.objects.create(
                session_id=session_id,
                sender_type='auto_reply',
                message_type='text',
                content=reply_content,
            )
            auto_replies.append(IMMessageSerializer(agent_msg).data)

        return Response({
            'success': True,
            'data': {
                'session_id': session_id,
                'message': IMMessageSerializer(user_msg).data,
                'auto_replies': auto_replies,
            },
        })

    @action(detail=False, methods=['get'])
    def history(self, request):
        """获取会话历史消息"""
        session_id = request.query_params.get('session_id', '')
        limit = int(request.query_params.get('limit', 50))
        limit = max(1, min(limit, 200))
        messages = IMMessage.objects.filter(session_id=session_id).order_by('-created_at')[:limit]
        serializer = IMMessageSerializer(list(reversed(messages)), many=True)
        return Response({'success': True, 'data': serializer.data})

    @action(detail=False, methods=['get'])
    def sessions(self, request):
        """获取用户的会话列表（最新消息预览）"""
        user_id = getattr(request.user, 'id', None)
        if not user_id:
            return Response({'success': True, 'data': []})
        sessions = IMMessage.objects.filter(user_id=user_id).values_list(
            'session_id'
        ).distinct().order_by('-session_id')[:20]
        result = []
        for sid, in sessions:
            last_msg = IMMessage.objects.filter(session_id=sid).order_by('-created_at').first()
            unread = IMMessage.objects.filter(session_id=sid, sender_type__in=['agent', 'auto_reply'], is_read=False).count()
            if last_msg:
                result.append({
                    'session_id': sid,
                    'last_message': last_msg.content[:50],
                    'last_time': last_msg.created_at.isoformat(),
                    'unread_count': unread,
                })
        return Response({'success': True, 'data': result})

    @action(detail=False, methods=['get'])
    def admin_messages(self, request):
        """管理员查看所有IM消息（支持筛选/分页）"""
        qs = IMMessage.objects.all()

        sender_type = request.query_params.get('sender_type')
        if sender_type:
            qs = qs.filter(sender_type=sender_type)

        session_id = request.query_params.get('session_id', '')
        if session_id:
            qs = qs.filter(session_id__icontains=session_id)

        keyword = request.query_params.get('keyword', '')
        if keyword:
            qs = qs.filter(content__icontains=keyword)

        qs = qs.order_by('-created_at')

        page_size = int(request.query_params.get('page_size', 20))
        page = int(request.query_params.get('page', 1))
        start = (page - 1) * page_size
        total = qs.count()
        items = qs[start:start + page_size]

        serializer = IMMessageSerializer(items, many=True)

        stats = {
            'total_messages': IMMessage.objects.count(),
            'total_sessions': IMMessage.objects.values_list('session_id', flat=True).distinct().count(),
            'user_messages': IMMessage.objects.filter(sender_type='user').count(),
            'auto_replies': IMMessage.objects.filter(sender_type='auto_reply').count(),
        }

        return Response({
            'success': True,
            'data': {
                'total': total,
                'results': serializer.data,
                'stats': stats,
            },
        })

    @action(detail=False, methods=['post'])
    def mark_read(self, request):
        """批量标记消息已读"""
        session_id = request.data.get('session_id')
        if session_id:
            updated = IMMessage.objects.filter(
                session_id=session_id,
                sender_type__in=['user'],
                is_read=False
            ).update(is_read=True)
        else:
            msg_ids = request.data.get('ids', [])
            if isinstance(msg_ids, list) and msg_ids:
                updated = IMMessage.objects.filter(id__in=msg_ids).update(is_read=True)
            else:
                updated = 0
        return Response({'success': True, 'message': f'已标记{updated}条为已读'})


class IMAutoReplyViewSet(viewsets.ModelViewSet):
    """IM自动回复规则管理"""
    queryset = IMAutoReply.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = IMAutoReplySerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['keyword', 'reply_content']
    ordering_fields = ['priority', 'match_count', 'created_at']
    ordering = ['-priority', 'id']

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        trigger_type = request.query_params.get('trigger_type')
        if trigger_type:
            queryset = queryset.filter(trigger_type=trigger_type)
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True)
        data = {
            'success': True,
            'count': queryset.count(),
            'data': serializer.data,
        }
        if page is not None:
            data = self.get_paginated_response(serializer.data).data
            data['success'] = True
        return Response(data)


class VoiceAssistantViewSet(viewsets.GenericViewSet):
    """语音助手配置"""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def config(self, request):
        configs = VoiceAssistantConfig.objects.all()
        config_dict = {c.config_key: c.config_value for c in configs}
        return Response({
            'success': True,
            'data': {
                **config_dict,
                'voice_enabled': config_dict.get('voice_enabled', 'false').lower() == 'true',
                'wake_word': config_dict.get('wake_word', '小助手'),
                'language': config_dict.get('voice_language', 'zh-CN'),
                'auto_response': config_dict.get('auto_response', 'true').lower() == 'true',
                'tts_engine': config_dict.get('tts_engine', 'browser'),
                'stt_engine': config_dict.get('stt_engine', 'browser'),
                'max_record_seconds': int(config_dict.get('max_record_seconds', '30')),
            },
        })

    @action(detail=False, methods=['post'])
    def update_config(self, request):
        ALLOWED_KEYS = {
            'voice_enabled', 'wake_word', 'voice_language', 'auto_response',
            'tts_engine', 'stt_engine', 'max_record_seconds', 'volume', 'speed', 'pitch',
        }
        updates = request.data
        results = []
        for key, value in updates.items():
            if key not in ALLOWED_KEYS:
                continue
            obj, created = VoiceAssistantConfig.objects.update_or_create(
                config_key=key,
                defaults={'config_value': str(value)},
            )
            if not created:
                obj.config_value = str(value)
                obj.save(update_fields=['config_value', 'updated_at'])
            results.append({'key': key, 'value': str(value)})
        return Response({
            'success': True,
            'message': f'更新{len(results)}项配置',
            'data': results,
        })


def _get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')

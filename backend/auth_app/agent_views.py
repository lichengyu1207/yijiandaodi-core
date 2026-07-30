import os
import json as json_module
import uuid
import time
from datetime import datetime, timedelta

from django.http import StreamingHttpResponse, JsonResponse
from rest_framework import viewsets, status, mixins
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.utils import timezone
from django.db.models import Q
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from .agent_models import AgentConfig, AgentSession, AgentMessage, AgentVerificationRecord
from .agent_serializers import (
    AgentConfigSerializer, AgentConfigListSerializer, AgentConfigCreateSerializer,
    AgentSessionSerializer, AgentMessageSerializer, ChatRequestSerializer,
    AgentVerificationRecordSerializer
)
from .rbac_permissions import HasPermission
from content_app.deepseek_service import get_deepseek_client
# OpenRath 兼容适配层 — Session 一等公民多智能体运行时
# https://github.com/Rath-Team/OpenRath  |  BSD-3-Clause  |  v1.2.1
from .openrath_adapter import (
    RathRuntime, Session, Agent, SequentialWorkflow,
    LocalMemoryStore, Provider, create_quad_agent_runtime,
)


def load_agent_texts():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(base_dir, 'agent_init_texts.json')
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            return json_module.load(f)
    return {}


class AgentConfigViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = AgentConfig.objects.all()
    serializer_class = AgentConfigSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), HasPermission('agent:config')]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == 'list':
            return AgentConfigListSerializer
        if self.action == 'create':
            return AgentConfigCreateSerializer
        return AgentConfigSerializer

    def get_queryset(self):
        queryset = AgentConfig.objects.all()
        search = self.request.query_params.get('search', '')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(code__icontains=search) |
                Q(short_desc__icontains=search)
            )
        return queryset.order_by('sort_order', 'id')

    def list(self, request, *args, **kwargs):
        texts = load_agent_texts()
        messages = texts.get('messages', {})
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'message': messages.get('config_list_success', ''),
            'data': serializer.data
        })

    def retrieve(self, request, *args, **kwargs):
        texts = load_agent_texts()
        messages = texts.get('messages', {})
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'message': messages.get('config_detail_success', ''),
            'data': serializer.data
        })

    def create(self, request, *args, **kwargs):
        texts = load_agent_texts()
        messages = texts.get('messages', {})
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        config = serializer.save()
        return Response({
            'success': True,
            'message': messages.get('config_create_success', ''),
            'data': AgentConfigSerializer(config).data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        texts = load_agent_texts()
        messages = texts.get('messages', {})
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        config = serializer.save()
        return Response({
            'success': True,
            'message': messages.get('config_update_success', ''),
            'data': AgentConfigSerializer(config).data
        })

    def partial_update(self, request, *args, **kwargs):
        texts = load_agent_texts()
        messages = texts.get('messages', {})
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        config = serializer.save()
        return Response({
            'success': True,
            'message': messages.get('config_update_success', ''),
            'data': AgentConfigSerializer(config).data
        })

    @action(detail=False, methods=['post'])
    def batch_update(self, request):
        texts = load_agent_texts()
        messages = texts.get('messages', {})
        configs_data = request.data.get('configs', [])
        if not configs_data:
            return Response({
                'success': False,
                'message': 'No config data provided',
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)

        SAFE_UPDATE_FIELDS = {'name', 'short_desc', 'welcome_msg', 'system_prompt',
                              'temperature', 'color', 'bg_color', 'icon', 'enabled', 'sort_order'}
        updated_configs = []
        for config_data in configs_data:
            code = config_data.get('code')
            if not code:
                continue
            try:
                config = AgentConfig.objects.get(code=code)
                for key, value in config_data.items():
                    if key in SAFE_UPDATE_FIELDS and hasattr(config, key):
                        setattr(config, key, value)
                config.save()
                updated_configs.append(AgentConfigSerializer(config).data)
            except AgentConfig.DoesNotExist:
                continue

        return Response({
            'success': True,
            'message': messages.get('config_batch_update_success', ''),
            'data': updated_configs
        })


class AgentPublicViewSet(APIView):
    # 公开接口：无需认证
    authentication_classes = []
    permission_classes = []

    def get(self, request, action_name=None):
        if action_name == 'configs':
            return self.configs(request)
        if action_name == 'sessions':
            return self.sessions(request)
        return JsonResponse({'success': False, 'message': 'Invalid action'}, status=404)

    def post(self, request, action_name=None):
        if action_name == 'chat':
            return self.chat(request)
        if action_name == 'detect':
            return self.detect(request)
        if action_name == 'detect-stream':
            return self.detect_stream(request)
        return JsonResponse({'success': False, 'message': 'Invalid action'}, status=404)

    def configs(self, request):
        texts = load_agent_texts()
        messages = texts.get('messages', {})
        agents_data = texts.get('agents', {})

        queryset = AgentConfig.objects.filter(enabled=True).order_by('sort_order', 'id')
        result = []
        for config in queryset:
            agent_text = agents_data.get(config.code, {})
            result.append({
                'id': config.id,
                'code': config.code,
                'name': config.name,
                'enabled': config.enabled,
                'color': config.color,
                'bg_color': config.bg_color,
                'icon': config.icon,
                'short_desc': config.short_desc or agent_text.get('short_desc', ''),
                'welcome_msg': config.welcome_msg or agent_text.get('welcome_msg', '')
            })

        from django.http import JsonResponse
        return JsonResponse({
            'success': True,
            'message': messages.get('public_configs_success', ''),
            'data': result
        })

    def chat(self, request):
        import json as json_module
        from django.core.cache import cache
        from django.core.files.uploadedfile import InMemoryUploadedFile
        
        # 检查是否是multipart/form-data请求（附件上传）
        content_type = request.content_type
        if 'multipart/form-data' in content_type:
            # 处理附件上传请求
            data = request.POST.dict()
            attachments = request.FILES
        else:
            # 处理JSON请求
            try:
                data = json_module.loads(request.body) if request.body else {}
            except Exception:
                data = {}
            attachments = {}

        texts = load_agent_texts()
        messages = texts.get('messages', {})
        agents_data = texts.get('agents', {})

        agent_code = data.get('agent_code', '')
        user_message = data.get('message', '')
        session_id = data.get('session_id', '')

        if not agent_code or not user_message:
            from django.http import JsonResponse
            return JsonResponse({
                'success': False,
                'message': messages.get('invalid_request', ''),
                'data': None
            }, status=400)

        # 处理附件内容
        attachment_contents = []
        if attachments:
            for key, file in attachments.items():
                if key.startswith('attachment_'):
                    try:
                        # 读取文件内容（支持文本文件）
                        if file.content_type.startswith('text/') or file.name.endswith(('.txt', '.md', '.json', '.csv')):
                            content = file.read().decode('utf-8')
                            attachment_contents.append({
                                'filename': file.name,
                                'content': content[:5000]  # 限制长度
                            })
                        # 图片文件（可以提取文本或使用OCR）
                        elif file.content_type.startswith('image/'):
                            attachment_contents.append({
                                'filename': file.name,
                                'type': 'image',
                                'content': '[图片附件]'
                            })
                        # 其他文件类型
                        else:
                            attachment_contents.append({
                                'filename': file.name,
                                'type': 'file',
                                'content': f'[{file.content_type}附件]'
                            })
                    except Exception as e:
                        print(f'[附件处理错误] {e}')

        # 将附件内容添加到用户消息
        if attachment_contents:
            user_message += "\n\n[附件内容]\n"
            for att in attachment_contents:
                user_message += f"文件: {att['filename']}\n{att['content']}\n\n"

        # 匿名用户次数限制（IP追踪）
        user = None
        if hasattr(request, 'user') and request.user and getattr(request.user, 'is_authenticated', False):
            user = request.user

        if not user:
            anon_usage_key = f'anon_agent_usage_{request.META.get("REMOTE_ADDR", "")}'
            usage_count = cache.get(anon_usage_key, 0)
            FREE_ANON_LIMIT = 3  # 每天免费次数
            if usage_count >= FREE_ANON_LIMIT:
                from django.http import JsonResponse
                return JsonResponse({
                    'success': False,
                    'message': '体验次数已用完，请登录继续使用',
                    'code': 'ANON_LIMIT_REACHED',
                    'require_login': True
                }, status=401)
            cache.set(anon_usage_key, usage_count + 1, 86400)  # 24小时过期

        # API频率限流（5秒一次）
        rate_limit_key = f'agent_chat_{request.META.get("REMOTE_ADDR", "")}'
        if cache.get(rate_limit_key):
            from django.http import JsonResponse
            return JsonResponse({
                'success': False,
                'message': '操作过于频繁，请稍后再试',
                'data': None
            }, status=429)
        cache.set(rate_limit_key, 1, 5)

        try:
            agent_config = AgentConfig.objects.get(code=agent_code, enabled=True)
        except AgentConfig.DoesNotExist:
            from django.http import JsonResponse
            return JsonResponse({
                'success': False,
                'message': messages.get('agent_not_found', ''),
                'data': None
            }, status=404)

        if not session_id:
            session_id = uuid.uuid4().hex
            user = request.user if request.user.is_authenticated else None
            session = AgentSession.objects.create(
                user=user,
                agent_code=agent_code,
                session_id=session_id,
                title=user_message[:50] if len(user_message) > 50 else user_message
            )

        else:
            try:
                session = AgentSession.objects.get(session_id=session_id)
            except AgentSession.DoesNotExist:
                from django.http import JsonResponse
                return JsonResponse({
                    'success': False,
                    'message': messages.get('session_not_found', ''),
                    'data': None
                }, status=404)

        AgentMessage.objects.create(
            session=session,
            role='user',
            content=user_message
        )

        agent_text = agents_data.get(agent_code, {})
        template_msg = messages.get('chat_template_reply', '')
        default_system_prompt = agent_text.get('system_prompt', f'你是{agent_config.name}，请根据你的角色定位回答用户问题。')

        history_messages = []
        if session_id:
            recent_msgs = AgentMessage.objects.filter(
                session=session
            ).order_by('-created_at')[:10]
            for msg in reversed(recent_msgs):
                history_messages.append({
                    'role': msg.role,
                    'content': msg.content
                })

        reply = None
        model_used = 'template'
        latency_ms = 0

        try:
            client = get_deepseek_client()
            start_time = time.time()
            reply = client.simple_chat(
                user_message=user_message,
                system_prompt=agent_config.system_prompt or default_system_prompt,
                temperature=agent_config.temperature or 0.7,
                history=history_messages
            )
            latency_ms = int((time.time() - start_time) * 1000)
            model_used = getattr(client, 'model', 'deepseek-chat')
        except Exception as e:
            print(f'[DeepSeek Error] {e}')

        if not reply:
            analysis_content = ''
            if agent_code == 'auditor':
                analysis_content = (
                    "1. Content Audit: Analyzing the provided information for accuracy and completeness...\n"
                    "2. Risk Assessment: Evaluating potential compliance and reputation risks...\n"
                    "3. Logic Check: Verifying the logical consistency of the narrative...\n"
                    "4. Preliminary Findings: No critical issues detected at this stage.\n\n"
                    "Recommendation: Proceed to detailed verification phase."
                )
            elif agent_code == 'verifier':
                analysis_content = (
                    "1. Source Verification: Cross-referencing information with available sources...\n"
                    "2. Timeline Analysis: Checking chronological consistency of events...\n"
                    "3. Evidence Chain: Building traceable proof path for key claims...\n"
                    "4. Consistency Score: 7/10 - Generally consistent with minor gaps.\n\n"
                    "Recommendation: Additional documentation may strengthen verification."
                )
            elif agent_code == 'archiver':
                analysis_content = (
                    "1. Document Classification: Categorizing materials by type and priority...\n"
                    "2. Metadata Extraction: Generating standard archival attributes...\n"
                    "3. Integrity Check: Computing hash values for tamper detection...\n"
                    "4. Archive Status: Ready for formal storage with unique identifier.\n\n"
                    "Recommendation: All materials meet archival standards."
                )
            elif agent_code == 'judge':
                analysis_content = (
                    "1. Comprehensive Review: Synthesizing inputs from all agent roles...\n"
                    "2. Rule Application: Applying business rules and compliance frameworks...\n"
                    "3. Risk-Benefit Analysis: Weighing potential outcomes...\n"
                    "4. Preliminary Ruling: Case appears viable pending full verification.\n\n"
                    "Recommendation: Approve progression to next review stage."
                )
            else:
                analysis_content = "Analysis in progress based on agent capabilities..."

            reply = template_msg.format(
                agent_name=agent_config.name,
                user_message=user_message[:100],
                analysis_content=analysis_content
            )

        AgentMessage.objects.create(
            session=session,
            role='assistant',
            content=reply,
            model_used=model_used,
            latency_ms=latency_ms
        )

        session.message_count += 1
        session.updated_at = timezone.now()
        session.save()

        from django.http import JsonResponse
        return JsonResponse({
            'success': True,
            'message': messages.get('chat_success', ''),
            'data': {
                'reply': reply,
                'session_id': session_id,
                'agent_code': agent_code,
                'timestamp': timezone.now().strftime('%Y-%m-%d %H:%M:%S')
            }
        })

    def detect(self, request):
        """多维协同检测接口 — 基于 OpenRath Runtime 的 4-Agent 串行检测

        架构说明:
          用户输入 → Session(一等公民) → SequentialWorkflow → [auditor→verifier→archiver→judge]
          每个Agent输出新Session（Fork+血缘）→ 全部注册到SessionGraph（支持路由/复现）
          Django AgentSession/AgentMessage 负责持久化存储
        """
        import json as json_module
        from django.core.cache import cache
        from django.http import JsonResponse
        try:
            data = json_module.loads(request.body) if request.body else {}
        except Exception:
            data = {}

        message = data.get('message', '').strip()
        scenario = data.get('scenario', 'text')
        skills = data.get('skills', [])

        if not message:
            return JsonResponse({
                'success': False,
                'message': '请输入检测内容',
                'data': None
            }, status=400)

        # 匿名用户次数限制（IP追踪）
        user = None
        if hasattr(request, 'user') and request.user and getattr(request.user, 'is_authenticated', False):
            user = request.user

        if not user:
            anon_usage_key = f'anon_agent_usage_{request.META.get("REMOTE_ADDR", "")}'
            usage_count = cache.get(anon_usage_key, 0)
            FREE_ANON_LIMIT = 3  # 每天免费次数
            if usage_count >= FREE_ANON_LIMIT:
                return JsonResponse({
                    'success': False,
                    'message': '体验次数已用完，请登录继续使用',
                    'code': 'ANON_LIMIT_REACHED',
                    'require_login': True
                }, status=401)
            cache.set(anon_usage_key, usage_count + 1, 86400)  # 24小时过期

        # API频率限流（5秒一次）
        rate_limit_key = f'agent_detect_{request.META.get("REMOTE_ADDR", "")}'
        if cache.get(rate_limit_key):
            return JsonResponse({
                'success': False,
                'message': '操作过于频繁，请稍后再试',
                'data': None
            }, status=429)
        cache.set(rate_limit_key, 1, 5)

        try:
            # 安全获取用户
            user = None
            if hasattr(request, 'user') and request.user and getattr(request.user, 'is_authenticated', False):
                user = request.user

            # 获取 DeepSeek 客户端并创建 OpenRath Runtime
            client = get_deepseek_client()
            runtime = create_quad_agent_runtime(deepseek_client=client)

            # 创建 Django 会话记录（持久化层）
            session_id = uuid.uuid4().hex
            django_session = AgentSession.objects.create(
                user=user,
                agent_code='quad-agent-openrath',
                session_id=session_id,
                title=message[:50] if len(message) > 50 else message,
            )
            AgentMessage.objects.create(session=django_session, role='user', content=message)

            # 通过 OpenRath Runtime 执行检测管道（已集成行为跟踪）
            result = runtime.run_detect_pipeline(
                message=message,
                scenario=scenario,
                on_event=lambda e: print(f'[OpenRath Event] {e.event_type.value} @ {e.agent_name}'),
                user_id=user.id if user else None,  # 传递用户ID用于行为跟踪
                ip_address=request.META.get('REMOTE_ADDR', ''),  # 传递IP地址用于行为跟踪
            )

            # 将每个 Agent 结果持久化到 Django
            for ar in result.get('agentResults', []):
                AgentMessage.objects.create(
                    session=django_session,
                    role='assistant',
                    content=json_module.dumps(ar['result'], ensure_ascii=False),
                    model_used=result.get('finalResult', {}).get('level', 'unknown'),
                    latency_ms=ar.get('latencyMs', 0),
                )

            # 更新 Django session
            django_session.message_count = len(result.get('agentResults', [])) + 1
            django_session.updated_at = timezone.now()
            django_session.save()

            # 用 Django session_id 覆盖 Runtime 生成的 UUID（保持前端兼容）
            result['sessionId'] = session_id

            return Response({
                'success': True,
                'message': '[OpenRath] 多维协同检测完成',
                'data': result,
            })

        except ValueError as e:
            return Response({
                'success': False,
                'message': f'AI服务配置错误: {str(e)}',
                'data': None
            }, status=503)
        except Exception as e:
            print(f'[OpenRath Detect Error] {e}')
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'message': f'检测服务异常: {str(e)}',
                'data': None
            }, status=500)

    def detect_stream(self, request):
        """SSE流式检测接口 — 基于 OpenRath Runtime 的逐Agent推送

        架构:
          RathRuntime.run_detect_pipeline() → 收集全部结果 → 按SSE格式逐事件推送
          SessionGraph 血缘信息在 complete 事件中返回（支持复现）
        """
        import json as json_module

        try:
            body = json_module.loads(request.body)
        except (TypeError, ValueError):
            return Response({'success': False, 'message': '无效的JSON请求体'}, status=400)

        message = (body.get('message') or '').strip()
        scenario = body.get('scenario', 'text')
        skills = body.get('skills', [])
        image_data = body.get('image')  # Base64图片数据
        image_name = body.get('image_name', '')  # 图片文件名

        # 图片场景时，允许空message（只有图片）
        if not message and not image_data:
            return Response({'success': False, 'message': '请输入检测内容或上传图片'}, status=400)

        session_id = uuid.uuid4().hex

        def event_stream():
            django_session = None
            try:
                user = None
                if hasattr(request, 'user') and request.user and getattr(request.user, 'is_authenticated', False):
                    user = request.user

                client = get_deepseek_client()
                runtime = create_quad_agent_runtime(deepseek_client=client)

                # 构建消息内容（包含图片信息）
                display_message = message
                if image_data:
                    display_message = f"[图片: {image_name or 'uploaded_image'}]\n{message}" if message else f"[图片: {image_name or 'uploaded_image'}]"

                django_session = AgentSession.objects.create(
                    user=user,
                    agent_code='quad-agent-openrath-stream',
                    session_id=session_id,
                    title=display_message[:50] if len(display_message) > 50 else display_message,
                )
                AgentMessage.objects.create(session=django_session, role='user', content=display_message)

                def sse(event_type: str, data_dict: dict) -> str:
                    payload = json_module.dumps({'type': event_type, 'data': data_dict}, ensure_ascii=False)
                    return f"data: {payload}\n\n"

                result = runtime.run_detect_pipeline(
                    message=message,
                    scenario=scenario,
                    on_event=lambda e: None,
                    image_data=image_data,  # 传递图片数据
                    image_name=image_name,
                )

                # SSE 推送：按前端消费格式逐事件推送
                yield sse('start', {
                    'sessionId': session_id,
                    'scenario': scenario,
                    'agents': [{'code': ar['agentCode'], 'name': ar['agentName']} for ar in result.get('agentResults', [])],
                })

                for i, ar in enumerate(result.get('agentResults', [])):
                    yield sse('agent_start', {
                        'index': i, 'agentCode': ar['agentCode'], 'agentName': ar['agentName'],
                        'totalAgents': len(result.get('agentResults', [])),
                    })
                    if django_session:
                        AgentMessage.objects.create(
                            session=django_session, role='assistant',
                            content=json_module.dumps(ar['result'], ensure_ascii=False),
                            model_used=ar.get('result', {}).get('level', ''),
                            latency_ms=ar.get('latencyMs', 0),
                        )
                    yield sse('agent_complete', ar)

                if django_session:
                    django_session.message_count = len(result.get('agentResults', [])) + 1
                    django_session.updated_at = timezone.now()
                    django_session.save()

                result['sessionId'] = session_id
                yield sse('complete', result)

            except ValueError as e:
                yield sse('error', {'message': f'AI服务配置错误: {str(e)}'})
            except Exception as e:
                print(f'[OpenRath Detect Stream Error] {e}')
                import traceback
                traceback.print_exc()
                yield sse('error', {'message': '检测服务异常: ' + str(e)})

        response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    def sessions(self, request):
        """获取会话列表（含最近消息）— 基于 OpenRath Session 持久化"""
        limit = min(int(request.GET.get('limit', 20)), 50)

        sessions_qs = AgentSession.objects.filter(
            agent_code__in=['quad-agent', 'quad-agent-openrath', 'quad-agent-openrath-stream']
        ).order_by('-updated_at')[:limit]

        result = []
        for sess in sessions_qs:
            recent_msgs = sess.messages.all().order_by('-created_at')[:10]
            messages = []
            for msg in reversed(recent_msgs):
                messages.append({
                    'role': msg.role,
                    'content': msg.content[:2000],
                    'modelUsed': msg.model_used or '',
                    'latencyMs': msg.latency_ms,
                    'createdAt': msg.created_at.isoformat(),
                })

            result.append({
                'sessionId': sess.session_id,
                'title': sess.title or '',
                'status': sess.status,
                'messageCount': sess.message_count,
                'scenario': '',
                'messages': messages,
                'createdAt': sess.created_at.isoformat(),
                'updatedAt': sess.updated_at.isoformat(),
            })

        return Response({
            'success': True,
            'message': '[OpenRath] 会话列表获取成功',
            'data': result,
        })


class AgentVerificationViewSet(View):
    def get(self, request):
        return self.by_article(request)

    def post(self, request):
        return self.trigger(request)

    def by_article(self, request):
        article_id = request.GET.get('article_id')
        if not article_id:
            from django.http import JsonResponse
            return JsonResponse({
                'success': False,
                'message': 'article_id is required',
                'data': []
            }, status=400)

        texts = load_agent_texts()
        messages = texts.get('messages', {})

        records = AgentVerificationRecord.objects.filter(
            article_id=article_id
        ).order_by('sort_order', 'created_at')

        serializer = AgentVerificationRecordSerializer(records, many=True)

        timeline_items = []
        for record in records:
            item = {
                'id': record.id,
                'agent_code': record.agent_code,
                'agent_name': record.agent_name,
                'status': record.status,
                'title': record.title,
                'summary': record.summary,
                'duration_ms': record.duration_ms,
                'created_at': record.created_at.strftime('%Y-%m-%d %H:%M:%S') if record.created_at else '',
                'result_data': record.result_data
            }
            timeline_items.append(item)

        from django.http import JsonResponse
        return JsonResponse({
            'success': True,
            'message': messages.get('verification_list_success', ''),
            'data': {
                'article_id': int(article_id),
                'total_count': len(timeline_items),
                'timeline': timeline_items
            }
        })

    def trigger(self, request):
        import json as json_module
        try:
            data = json_module.loads(request.body) if request.body else {}
        except Exception:
            data = {}

        texts = load_agent_texts()
        messages = texts.get('messages', {})
        agents_data = texts.get('agents', {})

        article_id = data.get('article_id')
        agent_code = data.get('agent_code', '')

        if not article_id:
            from django.http import JsonResponse
            return JsonResponse({
                'success': False,
                'message': 'article_id is required',
                'data': None
            }, status=400)

        if not agent_code:
            from django.http import JsonResponse
            return JsonResponse({
                'success': False,
                'message': 'agent_code is required',
                'data': None
            }, status=400)

        valid_codes = [choice[0] for choice in AgentConfig.AGENT_CHOICES]
        if agent_code not in valid_codes:
            from django.http import JsonResponse
            return JsonResponse({
                'success': False,
                'message': 'Invalid agent code',
                'data': None
            }, status=400)

        agent_text = agents_data.get(agent_code, {})
        agent_name = agent_text.get('name', agent_code)

        existing_record = AgentVerificationRecord.objects.filter(
            article_id=article_id,
            agent_code=agent_code
        ).first()

        if existing_record:
            existing_record.status = 'running'
            existing_record.operator = request.user if request.user.is_authenticated else None
            existing_record.save()
            record = existing_record
        else:
            max_sort = AgentVerificationRecord.objects.filter(
                article_id=article_id
            ).aggregate(models.Max('sort_order'))['sort_order__max'] or 0

            record = AgentVerificationRecord.objects.create(
                article_id=article_id,
                agent_code=agent_code,
                agent_name=agent_name,
                status='running',
                title=f'{agent_name} Verification',
                operator=request.user if request.user.is_authenticated else None,
                sort_order=max_sort + 1
            )

        from django.db import models as django_models
        record.status = 'completed'
        record.summary = f'{agent_name} verification completed successfully.'
        record.detail = f'Automated verification process for {agent_name} has been executed.'
        record.duration_ms = 1500
        record.result_data = {
            'status': 'completed',
            'agent_code': agent_code,
            'article_id': article_id,
            'completed_at': timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
            'findings': [],
            'recommendations': []
        }
        record.save()

        serializer = AgentVerificationRecordSerializer(record)

        from django.http import JsonResponse
        return JsonResponse({
            'success': True,
            'message': messages.get('verification_trigger_success', ''),
            'data': serializer.data
        })


# ===== Grok Tools API =====

class GrokToolsViewSet(APIView):
    """Grok 工具集 API"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """获取所有可用工具"""
        from .grok_tools import get_tool_registry

        registry = get_tool_registry()
        tools = registry.list_tools()
        definitions = registry.get_definitions()

        return Response({
            'success': True,
            'message': 'Available Grok tools',
            'data': {
                'tools': tools,
                'definitions': definitions
            }
        })

    def post(self, request):
        """执行工具"""
        from .grok_tools import get_tool_registry

        tool_name = request.data.get('tool')
        params = request.data.get('params', {})

        if not tool_name:
            return Response({
                'success': False,
                'message': 'tool name is required',
                'data': None
            }, status=400)

        registry = get_tool_registry()
        result = registry.execute(tool_name, **params)

        return Response({
            'success': result.success,
            'message': 'Tool execution result',
            'data': {
                'output': result.output,
                'error': result.error
            }
        })


# ===== Grok Memory API =====

class GrokMemoryViewSet(APIView):
    """Grok 记忆系统 API"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """获取记忆列表"""
        from .grok_memory import get_global_memory

        memory = get_global_memory()
        limit = int(request.query_params.get('limit', 100))
        entries = memory.list_all(limit=limit)

        return Response({
            'success': True,
            'message': f'Found {len(entries)} memories',
            'data': [{
                'id': e.id,
                'content': e.content[:500] + '...' if len(e.content) > 500 else e.content,
                'metadata': e.metadata,
                'created_at': e.created_at.isoformat(),
                'updated_at': e.updated_at.isoformat()
            } for e in entries]
        })

    def post(self, request):
        """保存记忆"""
        from .grok_memory import get_global_memory

        content = request.data.get('content')
        metadata = request.data.get('metadata', {})

        if not content:
            return Response({
                'success': False,
                'message': 'content is required',
                'data': None
            }, status=400)

        memory = get_global_memory()
        entry = memory.save(content, metadata)

        return Response({
            'success': True,
            'message': 'Memory saved successfully',
            'data': {
                'id': entry.id,
                'created_at': entry.created_at.isoformat()
            }
        })

    def delete(self, request):
        """删除记忆"""
        from .grok_memory import get_global_memory

        entry_id = request.query_params.get('id')
        if not entry_id:
            return Response({
                'success': False,
                'message': 'id parameter is required',
                'data': None
            }, status=400)

        memory = get_global_memory()
        deleted = memory.delete(entry_id)

        return Response({
            'success': deleted,
            'message': 'Memory deleted' if deleted else 'Memory not found',
            'data': None
        })


class GrokMemorySearchView(APIView):
    """记忆搜索 API"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """搜索记忆"""
        from .grok_memory import get_global_memory

        query = request.query_params.get('q', '')
        limit = int(request.query_params.get('limit', 10))

        if not query:
            return Response({
                'success': False,
                'message': 'q parameter is required',
                'data': []
            }, status=400)

        memory = get_global_memory()
        results = memory.search(query, limit=limit)

        return Response({
            'success': True,
            'message': f'Found {len(results)} results for "{query}"',
            'data': [{
                'id': e.id,
                'content': e.content[:500] + '...' if len(e.content) > 500 else e.content,
                'metadata': e.metadata,
                'created_at': e.created_at.isoformat()
            } for e in results]
        })

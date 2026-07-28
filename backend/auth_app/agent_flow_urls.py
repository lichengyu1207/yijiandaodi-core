"""
一鉴到底 - Agent 数据流 API
整合 Python SDK 到 Django 后端
"""

from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import json
from datetime import datetime


# ===== 数据流模型 =====

class AgentFlowRequest:
    """Agent 流程请求"""
    def __init__(self, data: dict):
        self.action = data.get('action')  # analyze, execute, verify
        self.agent_type = data.get('agent_type', 'auditor')
        self.session_id = data.get('session_id')
        self.content = data.get('content')
        self.operations = data.get('operations', [])
        self.context = data.get('context', {})


class AgentFlowResponse:
    """Agent 流程响应"""
    def __init__(self, success: bool, data: dict = None, error: str = None):
        self.success = success
        self.data = data or {}
        self.error = error
        self.timestamp = datetime.now().isoformat()

    def to_dict(self):
        return {
            'success': self.success,
            'data': self.data,
            'error': self.error,
            'timestamp': self.timestamp
        }


# ===== API 视图 =====

class AgentFlowView(APIView):
    """
    Agent 数据流 API - 核心入口
    
    POST /api/auth/agent/flow/
    
    请求体:
    {
        "action": "analyze",           # analyze | execute | verify | report
        "agent_type": "auditor",       # auditor | verifier | archiver | judge | detector | grok-build | explore | plan
        "session_id": "xxx",           # 可选，会话ID
        "content": "用户输入内容",      # 用户消息
        "operations": [...],           # 操作记录（来自插件）
        "context": {...}               # 额外上下文
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .agent_views import DeepSeekClient
        from .grok_tools import get_tool_registry
        from .grok_memory import get_global_memory

        flow_request = AgentFlowRequest(request.data)

        try:
            # 根据动作类型处理
            if flow_request.action == 'analyze':
                return self._handle_analyze(request, flow_request)
            elif flow_request.action == 'execute':
                return self._handle_execute(request, flow_request)
            elif flow_request.action == 'verify':
                return self._handle_verify(request, flow_request)
            elif flow_request.action == 'report':
                return self._handle_report(request, flow_request)
            else:
                return Response({
                    'success': False,
                    'error': f'Unknown action: {flow_request.action}'
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _handle_analyze(self, request, flow_request: AgentFlowRequest):
        """处理分析请求"""
        from .agent_views import DeepSeekClient
        from .agent_models import AgentConfig
        from django.core.cache import cache

        # 获取 Agent 配置
        try:
            agent_config = AgentConfig.objects.get(code=flow_request.agent_type)
            system_prompt = agent_config.system_prompt
        except AgentConfig.DoesNotExist:
            system_prompt = "你是「一鉴到底」AI助手，专注于创作证据分析和版权保护。"

        # 获取 DeepSeek 客户端
        client = DeepSeekClient()

        # 构建消息
        messages = [
            {"role": "system", "content": system_prompt},
        ]

        # 添加上下文（操作记录）
        if flow_request.operations:
            context_msg = "【操作记录】\n" + "\n".join([
                f"- {op.get('type')}: {op.get('data', {}).get('preview', '')[:100]}"
                for op in flow_request.operations[:10]
            ])
            messages.append({"role": "user", "content": context_msg})

        # 添加用户消息
        if flow_request.content:
            messages.append({"role": "user", "content": flow_request.content})

        # 调用 AI
        response = client.chat(
            messages=messages,
            model="deepseek-chat",
            temperature=0.7
        )

        # 保存到记忆
        memory = get_global_memory()
        memory.save(
            content=json.dumps({
                "action": "analyze",
                "agent": flow_request.agent_type,
                "user_message": flow_request.content,
                "ai_response": response
            }),
            metadata={
                "type": "analysis",
                "agent": flow_request.agent_type,
                "user_id": request.user.id
            }
        )

        return Response(AgentFlowResponse(
            success=True,
            data={
                "response": response,
                "agent": flow_request.agent_type,
                "session_id": flow_request.session_id
            }
        ).to_dict())

    def _handle_execute(self, request, flow_request: AgentFlowRequest):
        """处理工具执行请求"""
        from .grok_tools import get_tool_registry

        tool_name = flow_request.context.get('tool')
        params = flow_request.context.get('params', {})

        if not tool_name:
            return Response(AgentFlowResponse(
                success=False,
                error="tool name is required in context"
            ).to_dict(), status=status.HTTP_400_BAD_REQUEST)

        # 执行工具
        registry = get_tool_registry()
        result = registry.execute(tool_name, **params)

        # 保存执行记录
        memory = get_global_memory()
        memory.save(
            content=json.dumps({
                "tool": tool_name,
                "params": params,
                "result": result.output,
                "success": result.success
            }),
            metadata={
                "type": "tool_execution",
                "tool": tool_name,
                "user_id": request.user.id
            }
        )

        return Response(AgentFlowResponse(
            success=result.success,
            data={
                "output": result.output,
                "error": result.error
            }
        ).to_dict())

    def _handle_verify(self, request, flow_request: AgentFlowRequest):
        """处理验证请求 - 生成证据链"""
        from .agent_models import AgentVerificationRecord
        from django.utils import timezone
        import hashlib

        # 创建验证记录
        operations_data = json.dumps(flow_request.operations, ensure_ascii=False)
        operations_hash = hashlib.sha256(operations_data.encode()).hexdigest()

        record = AgentVerificationRecord.objects.create(
            user=request.user,
            agent_type=flow_request.agent_type,
            session_id=flow_request.session_id or f"session_{timezone.now().timestamp()}",
            operations=flow_request.operations,
            verification_hash=operations_hash,
            status='pending'
        )

        # 调用 AI 验证
        from .agent_views import DeepSeekClient
        client = DeepSeekClient()

        verification_prompt = f"""请分析以下操作记录，判断其原创性：

操作数量: {len(flow_request.operations)}
操作哈希: {operations_hash}

请回答：
1. 操作流程是否连贯？
2. 是否有明显的抄袭痕迹？
3. 创作时间线是否合理？
4. 综合评分（0-100分）
"""

        response = client.chat(
            messages=[
                {"role": "system", "content": "你是「一鉴到底」验证官，专注于创作原创性验证。"},
                {"role": "user", "content": verification_prompt}
            ],
            model="deepseek-chat"
        )

        # 更新记录
        record.verification_result = response
        record.status = 'completed'
        record.save()

        return Response(AgentFlowResponse(
            success=True,
            data={
                "record_id": str(record.id),
                "verification_hash": operations_hash,
                "ai_analysis": response,
                "operations_count": len(flow_request.operations)
            }
        ).to_dict())

    def _handle_report(self, request, flow_request: AgentFlowRequest):
        """处理报告生成请求"""
        from .agent_models import AgentVerificationRecord
        from .grok_memory import get_global_memory

        # 获取验证记录
        session_id = flow_request.session_id
        if session_id:
            records = AgentVerificationRecord.objects.filter(
                session_id=session_id,
                user=request.user
            )
        else:
            records = AgentVerificationRecord.objects.filter(user=request.user).order_by('-created_at')[:5]

        # 获取记忆
        memory = get_global_memory()
        memories = memory.search(str(request.user.id), limit=20)

        # 生成报告
        report = {
            "user": request.user.username,
            "generated_at": datetime.now().isoformat(),
            "verification_records": [
                {
                    "id": str(r.id),
                    "agent_type": r.agent_type,
                    "status": r.status,
                    "hash": r.verification_hash,
                    "created_at": r.created_at.isoformat()
                }
                for r in records
            ],
            "memory_count": len(memories),
            "total_operations": sum(len(r.operations) for r in records)
        }

        return Response(AgentFlowResponse(
            success=True,
            data=report
        ).to_dict())


class AgentSyncView(APIView):
    """
    数据同步 API - 插件与后端同步
    
    POST /api/auth/agent/sync/
    
    请求体:
    {
        "operations": [...],           # 插件录制的操作
        "session_id": "xxx",           # 会话ID
        "platform": "deepseek",        # 平台标识
        "timestamp": "2024-01-01..."   # 时间戳
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        operations = request.data.get('operations', [])
        session_id = request.data.get('session_id')
        platform = request.data.get('platform', 'unknown')

        # 保存操作到记忆
        from .grok_memory import get_global_memory
        memory = get_global_memory()

        saved_ids = []
        for op in operations:
            entry = memory.save(
                content=json.dumps(op, ensure_ascii=False),
                metadata={
                    "type": "operation",
                    "platform": platform,
                    "session_id": session_id,
                    "user_id": request.user.id
                }
            )
            saved_ids.append(entry.id)

        return Response({
            "success": True,
            "message": f"Synced {len(operations)} operations",
            "data": {
                "saved_count": len(saved_ids),
                "session_id": session_id
            }
        })


class AgentChatView(APIView):
    """
    Agent 对话 API - 流式响应
    
    POST /api/auth/agent/chat/
    
    请求体:
    {
        "message": "用户消息",
        "agent_type": "auditor",
        "stream": false
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .agent_views import DeepSeekClient
        from .agent_models import AgentConfig
        from .grok_memory import get_global_memory

        message = request.data.get('message')
        agent_type = request.data.get('agent_type', 'auditor')

        # 获取 Agent 配置
        try:
            agent_config = AgentConfig.objects.get(code=agent_type)
            system_prompt = agent_config.system_prompt
        except AgentConfig.DoesNotExist:
            system_prompt = "你是「一鉴到底」AI助手。"

        # 获取历史记忆
        memory = get_global_memory()
        recent_memories = memory.list_all(limit=5)

        # 构建上下文
        context = "\n".join([m.content[:200] for m in recent_memories if m.metadata.get('user_id') == request.user.id])

        # 调用 AI
        client = DeepSeekClient()
        messages = [
            {"role": "system", "content": system_prompt + f"\n\n【用户相关上下文】\n{context}" if context else system_prompt},
            {"role": "user", "content": message}
        ]

        response = client.chat(messages=messages, model="deepseek-chat")

        # 保存对话
        memory.save(
            content=json.dumps({"user": message, "ai": response}),
            metadata={
                "type": "chat",
                "agent": agent_type,
                "user_id": request.user.id
            }
        )

        return Response({
            "success": True,
            "data": {
                "response": response,
                "agent": agent_type
            }
        })


# ===== URL 配置 =====

urlpatterns = [
    path('flow/', AgentFlowView.as_view(), name='agent-flow'),
    path('sync/', AgentSyncView.as_view(), name='agent-sync'),
    path('chat/', AgentChatView.as_view(), name='agent-chat'),
]
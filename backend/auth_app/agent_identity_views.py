"""
Agent身份认证视图集

提供Agent身份管理的完整API接口
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
import logging

from .agent_identity_models import (
    AgentIdentity,
    AgentPermission,
    AgentAuthenticationLog,
    AgentAuthSession
)
from .agent_identity_serializers import (
    AgentIdentitySerializer,
    AgentIdentityCreateSerializer,
    AgentIdentityUpdateSerializer,
    AgentPermissionSerializer,
    AgentAuthenticationLogSerializer,
    AgentAuthSessionSerializer,
    APIKeyVerifySerializer,
    APIKeyRegenerateSerializer
)

logger = logging.getLogger(__name__)


class AgentIdentityViewSet(viewsets.ModelViewSet):
    """
    Agent身份管理视图集

    提供：
    - Agent的CRUD操作
    - API Key生成与验证
    - 权限管理
    - 会话管理
    """

    queryset = AgentIdentity.objects.all()
    serializer_class = AgentIdentitySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['agent_type', 'trust_level', 'is_active']
    search_fields = ['agent_id', 'agent_name']
    ordering_fields = ['created_at', 'last_active_at', 'trust_level']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """根据动作选择序列化器"""
        if self.action == 'create':
            return AgentIdentityCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return AgentIdentityUpdateSerializer
        return AgentIdentitySerializer

    def create(self, request, *args, **kwargs):
        """
        创建Agent（包含API Key生成）

        请求体：
        {
            "agent_name": "My Agent",
            "agent_type": "cursor",
            "trust_level": "low",
            "permissions": {}
        }

        返回：
        {
            "agent": {...},
            "api_key": "sk_live_..."  # 仅在创建时返回一次
        }
        """
        serializer = AgentIdentityCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # 调用模型的create_agent方法
        agent, api_key = AgentIdentity.create_agent(
            agent_name=serializer.validated_data['agent_name'],
            agent_type=serializer.validated_data['agent_type'],
            trust_level=serializer.validated_data.get('trust_level', 'low'),
            owner=request.user,
            created_by=request.user
        )

        # 设置权限
        if 'permissions' in serializer.validated_data:
            agent.permissions = serializer.validated_data['permissions']
            agent.save()

        logger.info(
            f"[Agent创建] 用户 {request.user.username} 创建Agent {agent.agent_id} | "
            f"类型: {agent.agent_type} | 信任级别: {agent.trust_level}"
        )

        # 返回Agent信息和API Key（仅此一次）
        return Response({
            'agent': AgentIdentitySerializer(agent).data,
            'api_key': api_key,  # 仅在创建时返回
            'message': '请妥善保存API Key，系统不会再次显示'
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def verify_api_key(self, request, pk=None):
        """
        验证API Key

        请求体：
        {
            "api_key": "sk_live_..."
        }

        返回：
        {
            "valid": true,
            "agent": {...}
        }
        """
        agent = self.get_object()
        serializer = APIKeyVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        api_key = serializer.validated_data['api_key']
        is_valid = agent.verify_api_key_with_logging(api_key)

        # 记录认证日志
        AgentAuthenticationLog.objects.create(
            agent=agent,
            success=is_valid,
            failure_reason=None if is_valid else 'API Key验证失败',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )

        return Response({
            'valid': is_valid,
            'agent': AgentIdentitySerializer(agent).data if is_valid else None,
            'message': '验证成功' if is_valid else '验证失败'
        })

    @action(detail=True, methods=['post'])
    def regenerate_api_key(self, request, pk=None):
        """
        重新生成API Key

        请求体：
        {
            "expires_days": 30  # 可选，有效期天数
        }

        返回：
        {
            "api_key": "sk_live_...",
            "expires_at": "2026-09-30T00:00:00Z"
        }
        """
        agent = self.get_object()
        serializer = APIKeyRegenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # 生成新的API Key
        api_key, api_key_hash = AgentIdentity.generate_api_key()

        # 更新Agent
        agent.api_key_hash = api_key_hash
        agent.api_key_prefix = api_key[:8]
        agent.api_key_created_at = timezone.now()

        # 设置过期时间
        expires_days = serializer.validated_data.get('expires_days')
        if expires_days:
            agent.api_key_expires_at = timezone.now() + timedelta(days=expires_days)
        else:
            agent.api_key_expires_at = None

        agent.save()

        logger.warning(
            f"[API Key重新生成] Agent {agent.agent_id} | "
            f"操作者: {request.user.username} | "
            f"过期时间: {agent.api_key_expires_at or '永不过期'}"
        )

        return Response({
            'api_key': api_key,
            'expires_at': agent.api_key_expires_at,
            'message': 'API Key已重新生成，旧Key已失效'
        })

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """
        停用Agent

        返回：
        {
            "success": true,
            "message": "Agent已停用"
        }
        """
        agent = self.get_object()
        agent.is_active = False
        agent.save()

        # 终止所有活跃会话
        agent.sessions.update(is_active=False)

        logger.warning(
            f"[Agent停用] Agent {agent.agent_id} | 操作者: {request.user.username}"
        )

        return Response({
            'success': True,
            'message': f'Agent {agent.agent_name} 已停用'
        })

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """
        激活Agent

        返回：
        {
            "success": true,
            "message": "Agent已激活"
        }
        """
        agent = self.get_object()
        agent.is_active = True
        agent.save()

        logger.info(
            f"[Agent激活] Agent {agent.agent_id} | 操作者: {request.user.username}"
        )

        return Response({
            'success': True,
            'message': f'Agent {agent.agent_name} 已激活'
        })

    @action(detail=True, methods=['get'])
    def permissions(self, request, pk=None):
        """
        获取Agent的权限列表

        返回：
        {
            "count": 5,
            "results": [...]
        }
        """
        agent = self.get_object()
        permissions = agent.permission_grants.all()
        serializer = AgentPermissionSerializer(permissions, many=True)

        return Response({
            'count': permissions.count(),
            'results': serializer.data
        })

    @action(detail=True, methods=['get'])
    def sessions(self, request, pk=None):
        """
        获取Agent的会话列表

        返回：
        {
            "count": 3,
            "results": [...]
        }
        """
        agent = self.get_object()
        sessions = agent.sessions.filter(is_active=True)
        serializer = AgentAuthSessionSerializer(sessions, many=True)

        return Response({
            'count': sessions.count(),
            'results': serializer.data
        })

    @action(detail=True, methods=['get'])
    def auth_logs(self, request, pk=None):
        """
        获取Agent的认证日志

        返回：
        {
            "count": 100,
            "results": [...]
        }
        """
        agent = self.get_object()
        logs = agent.auth_logs.all()[:100]  # 最近100条
        serializer = AgentAuthenticationLogSerializer(logs, many=True)

        return Response({
            'count': logs.count(),
            'results': serializer.data
        })


class AgentPermissionViewSet(viewsets.ModelViewSet):
    """Agent权限管理视图集"""

    queryset = AgentPermission.objects.all()
    serializer_class = AgentPermissionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['agent', 'resource_type', 'action']
    ordering = ['-granted_at']

    def perform_create(self, serializer):
        """创建权限时自动设置授权人"""
        serializer.save(granted_by=self.request.user)

    def perform_update(self, serializer):
        """更新权限时记录日志"""
        permission = serializer.save()
        logger.info(
            f"[权限更新] Agent {permission.agent.agent_id} | "
            f"资源: {permission.resource_type} | "
            f"操作: {permission.action} | "
            f"操作者: {self.request.user.username}"
        )


class AgentAuthSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """Agent认证会话管理视图集（只读）"""

    queryset = AgentAuthSession.objects.all()
    serializer_class = AgentAuthSessionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['agent', 'is_active']
    ordering = ['-token_created_at']

    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        """终止会话"""
        session = self.get_object()
        session.terminate()

        logger.warning(
            f"[会话终止] Session {session.session_id[:8]}... | "
            f"Agent: {session.agent.agent_id} | "
            f"操作者: {request.user.username}"
        )

        return Response({
            'success': True,
            'message': '会话已终止'
        })
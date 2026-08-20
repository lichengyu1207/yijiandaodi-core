"""
Agent API Key认证权限类

提供基于AgentIdentity模型的API Key认证机制
用于Agent活动日志上报等接口的身份验证
"""

from rest_framework import permissions
from rest_framework.exceptions import AuthenticationFailed
import logging

logger = logging.getLogger(__name__)


class AgentAPIKeyAuthentication(permissions.BasePermission):
    """
    Agent API Key认证权限类

    使用方式：
    1. 在视图中添加 permission_classes = [AgentAPIKeyAuthentication]
    2. 客户端在请求头中添加 X-Agent-API-Key: <api_key>
    3. 中间件自动验证API Key并注入request.agent

    示例：
        @api_view(['POST'])
        @permission_classes([AgentAPIKeyAuthentication])
        def batch_create_activities(request):
            # request.agent 已通过认证
            agent_id = request.agent.agent_id
            ...
    """

    def has_permission(self, request, view):
        """
        检查是否有权限访问

        验证流程：
        1. 从请求头提取API Key
        2. 验证API Key哈希
        3. 检查Agent是否活跃
        4. 将Agent对象注入request
        """
        # 1. 从请求头提取API Key
        api_key = request.headers.get('X-Agent-API-Key')

        if not api_key:
            # 如果没有提供API Key，检查是否允许匿名访问
            if hasattr(view, 'allow_anonymous') and view.allow_anonymous:
                return True
            raise AuthenticationFailed('缺少X-Agent-API-Key请求头')

        # 2. 验证API Key并获取Agent对象
        try:
            from .agent_identity_models import AgentIdentity

            # 验证API Key格式（前缀验证）
            if len(api_key) < 20:
                raise AuthenticationFailed('API Key格式无效')

            # 提取前缀
            api_key_prefix = api_key[:8]

            # 查询匹配前缀的Agent（优化性能）
            agent = AgentIdentity.objects.filter(
                api_key_prefix=api_key_prefix,
                is_active=True
            ).first()

            if not agent:
                raise AuthenticationFailed('API Key无效或Agent未激活')

            # 3. 验证API Key哈希
            if not agent.verify_api_key(api_key):
                raise AuthenticationFailed('API Key验证失败')

            # 4. 检查信任级别（可选）
            # 可以根据具体需求限制某些接口只能特定信任级别的Agent访问
            min_trust_level = getattr(view, 'min_trust_level', None)
            if min_trust_level:
                trust_levels = ['low', 'medium', 'high', 'critical']
                agent_level = trust_levels.index(agent.trust_level)
                required_level = trust_levels.index(min_trust_level)
                if agent_level < required_level:
                    raise AuthenticationFailed(f'需要{min_trust_level}及以上信任级别')

            # 5. 将Agent对象注入request（关键步骤）
            request.agent = agent

            # 记录认证日志
            logger.info(
                f"[Agent认证] API Key认证成功 | "
                f"Agent ID: {agent.agent_id} | "
                f"Agent名称: {agent.agent_name} | "
                f"信任级别: {agent.trust_level}"
            )

            return True

        except AuthenticationFailed:
            raise
        except Exception as e:
            logger.error(f"[Agent认证] 认证异常: {e}", exc_info=True)
            raise AuthenticationFailed(f'认证失败: {str(e)}')


class OptionalAgentAPIKeyAuthentication(permissions.BasePermission):
    """
    可选Agent API Key认证

    与AgentAPIKeyAuthentication的区别：
    - 如果提供了API Key，则验证并注入request.agent
    - 如果没有提供API Key，也允许访问（request.agent为None）

    使用场景：
    - 向下兼容旧版本客户端（不提供API Key也能访问）
    - 支持匿名上报（但关联不到Agent身份）
    """

    def has_permission(self, request, view):
        """可选认证：有API Key则验证，无则允许访问"""
        api_key = request.headers.get('X-Agent-API-Key')

        if not api_key:
            # 没有API Key，允许访问但request.agent为None
            request.agent = None
            return True

        # 有API Key，执行完整验证流程
        try:
            from .agent_identity_models import AgentIdentity

            api_key_prefix = api_key[:8]
            agent = AgentIdentity.objects.filter(
                api_key_prefix=api_key_prefix,
                is_active=True
            ).first()

            if agent and agent.verify_api_key(api_key):
                request.agent = agent
                logger.info(
                    f"[Agent认证] 可选认证成功 | Agent: {agent.agent_name}"
                )
            else:
                # API Key无效，但仍然允许访问
                request.agent = None
                logger.warning(
                    f"[Agent认证] 可选认证失败，继续匿名访问"
                )

            return True

        except Exception as e:
            logger.error(f"[Agent认证] 可选认证异常: {e}", exc_info=True)
            # 异常情况也允许访问
            request.agent = None
            return True


class AgentPermissionMixin:
    """
    Agent权限检查Mixin

    用于视图中检查Agent的权限和信任级别
    """

    def check_agent_permission(self, request, permission_name):
        """
        检查Agent是否有指定权限

        Args:
            permission_name: 权限名称（如 'file.read', 'network.access'）

        Returns:
            bool: 是否有权限
        """
        if not hasattr(request, 'agent') or not request.agent:
            return False

        # 检查Agent的permissions字段
        agent_permissions = request.agent.permissions or {}
        return agent_permissions.get(permission_name, False)

    def check_agent_trust_level(self, request, min_level):
        """
        检查Agent信任级别是否满足要求

        Args:
            min_level: 最低信任级别（'low', 'medium', 'high', 'critical'）

        Returns:
            bool: 是否满足信任级别
        """
        if not hasattr(request, 'agent') or not request.agent:
            return False

        trust_levels = ['low', 'medium', 'high', 'critical']
        try:
            agent_level = trust_levels.index(request.agent.trust_level)
            required_level = trust_levels.index(min_level)
            return agent_level >= required_level
        except (ValueError, AttributeError):
            return False
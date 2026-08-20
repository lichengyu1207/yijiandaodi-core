"""
Agent身份可信层数据模型

功能：
1. Agent身份认证与管理
2. API Key管理（最小化实现）
3. 权限管控（资源粒度）

参考：
- TAISE-Agent认证框架的五个行为域
- esign-agent-trust的四可信闭环
"""

import secrets
import hashlib
import logging
import time
import os
from datetime import datetime, timedelta
from django.db import models, connection
from django.conf import settings
from django.utils import timezone

# 初始化logger
logger = logging.getLogger(__name__)

# 日志性能控制配置
AGENT_QUERY_LOG_THRESHOLD_MS = float(os.environ.get('AGENT_QUERY_LOG_THRESHOLD_MS', '50'))  # 默认50ms
AGENT_ENABLE_DETAILED_LOGS = os.environ.get('AGENT_ENABLE_DETAILED_LOGS', 'false').lower() == 'true'

# 使用字符串引用避免循环依赖
# User = get_user_model()  # 会导致循环依赖


class AgentIdentity(models.Model):
    """
    Agent身份认证模型
    
    实现最小化的身份认证机制：
    - API Key（而非完整的DID/VC）
    - 信任级别分级（参考TAISE框架）
    - 资源粒度权限控制
    """
    
    # ==================== 基本信息 ====================
    
    agent_id = models.CharField(
        max_length=50, 
        unique=True, 
        verbose_name='Agent ID',
        help_text='Agent唯一标识符，格式: agent_<timestamp>_<random>'
    )
    
    agent_name = models.CharField(
        max_length=100, 
        verbose_name='Agent名称',
        help_text='用户友好的Agent名称'
    )
    
    agent_type = models.CharField(
        max_length=20, 
        choices=[
            ('cursor', 'Cursor IDE'),
            ('claude', 'Claude AI'),
            ('copilot', 'GitHub Copilot'),
            ('custom', 'Custom Agent'),
        ],
        verbose_name='Agent类型',
        help_text='Agent所属类型'
    )
    
    # ==================== 认证信息 ====================
    
    api_key_hash = models.CharField(
        max_length=128, 
        unique=True,
        verbose_name='API Key哈希',
        help_text='API Key的SHA-256哈希值'
    )
    
    api_key_prefix = models.CharField(
        max_length=8,
        verbose_name='API Key前缀',
        help_text='API Key的前缀（用于识别）'
    )
    
    api_key_created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='API Key创建时间'
    )
    
    api_key_expires_at = models.DateTimeField(
        null=True, 
        blank=True,
        verbose_name='API Key过期时间',
        help_text='NULL表示永不过期'
    )
    
    # ==================== 信任级别 ====================
    
    TRUST_LEVELS = [
        ('low', '低信任级'),      # 只读操作
        ('medium', '中信任级'),    # 文件操作
        ('high', '高信任级'),      # 系统操作
        ('critical', '关键级'),    # 敏感操作
    ]
    
    trust_level = models.CharField(
        max_length=10, 
        choices=TRUST_LEVELS,
        default='low',
        verbose_name='信任级别',
        help_text='Agent的信任级别，决定可执行的操作范围'
    )
    
    # ==================== 权限策略 ====================
    
    permissions = models.JSONField(
        default=dict,
        verbose_name='权限策略',
        help_text='资源粒度权限控制，格式: {resource_type: [actions]}'
    )
    
    # ==================== 关联信息 ====================
    
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='agents',
        verbose_name='所属用户'
    )
    
    # ==================== 元数据 ====================
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    last_active_at = models.DateTimeField(
        null=True, 
        blank=True,
        verbose_name='最后活跃时间'
    )
    
    is_active = models.BooleanField(
        default=True, 
        verbose_name='是否激活',
        help_text='禁用后将无法通过认证'
    )
    
    # ==================== 审计追踪 ====================
    
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True,
        related_name='created_agents',
        verbose_name='创建者'
    )
    
    # ==================== 元信息 ====================

    class Meta:
        db_table = 'agent_identities'
        ordering = ['-created_at']
        verbose_name = 'Agent身份'
        verbose_name_plural = 'Agent身份管理'

        # 性能优化索引
        indexes = [
            # 按Agent类型查询
            models.Index(fields=['agent_type'], name='idx_agent_type'),

            # 按信任级别查询（权限控制场景）
            models.Index(fields=['trust_level'], name='idx_trust_level'),

            # 按所属用户查询（用户管理自己的Agent）
            models.Index(fields=['owner'], name='idx_agent_owner'),

            # 活跃Agent查询（过滤已禁用Agent）
            models.Index(fields=['is_active'], name='idx_agent_active'),

            # 常用组合查询：类型+信任级别+活跃状态
            models.Index(fields=['agent_type', 'trust_level', 'is_active'],
                        name='idx_agent_type_trust_active'),

            # 用户+活跃状态（查询用户的活跃Agent）
            models.Index(fields=['owner', 'is_active'], name='idx_agent_owner_active'),
        ]
    
    def __str__(self):
        return f"{self.agent_name} ({self.agent_id})"
    
    # ==================== 业务方法 ====================
    
    @classmethod
    def generate_agent_id(cls) -> str:
        """
        生成唯一的Agent ID
        
        格式: agent_<timestamp>_<random>
        例如: agent_20260809_abc123
        """
        from datetime import datetime
        import secrets
        
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        random_part = secrets.token_hex(6)
        return f"agent_{timestamp}_{random_part}"
    
    @classmethod
    def generate_api_key(cls) -> tuple:
        """
        生成API Key
        
        返回: (原始API Key, 哈希值)
        格式: sk_live_<random_64_chars>
        """
        import secrets
        import hashlib
        
        # 生成64字节的随机token
        api_key = f"sk_live_{secrets.token_hex(32)}"
        
        # 计算SHA-256哈希
        api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        
        return api_key, api_key_hash
    
    @classmethod
    def create_agent(cls, agent_name: str, agent_type: str, trust_level: str = 'low', 
                     owner=None, created_by=None) -> tuple:
        """
        创建新的Agent（包含API Key生成）
        
        Args:
            agent_name: Agent名称
            agent_type: Agent类型
            trust_level: 信任级别
            owner: 所属用户
            created_by: 创建者
            
        Returns:
            tuple: (Agent对象, 原始API Key)
        """
        # 生成Agent ID
        agent_id = cls.generate_agent_id()
        
        # 生成API Key
        api_key, api_key_hash = cls.generate_api_key()
        
        # 创建Agent
        agent = cls.objects.create(
            agent_id=agent_id,
            agent_name=agent_name,
            agent_type=agent_type,
            api_key_hash=api_key_hash,
            api_key_prefix=api_key[:8],
            trust_level=trust_level,
            owner=owner,
            created_by=created_by
        )
        
        return agent, api_key
    
    def set_api_key(self, api_key: str) -> None:
        """
        设置API Key（存储哈希值）
        
        Args:
            api_key: 原始API Key
        """
        self.api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        self.api_key_prefix = api_key[:8]  # 存储"sk_live_"
        self.api_key_created_at = timezone.now()
    
    def verify_api_key(self, api_key: str) -> bool:
        """
        验证API Key
        
        Args:
            api_key: 待验证的API Key
            
        Returns:
            bool: 是否验证通过
        """
        # 检查Agent是否激活
        if not self.is_active:
            return False
        
        # 检查API Key是否过期
        if self.api_key_expires_at and timezone.now() > self.api_key_expires_at:
            return False
        
        # 验证哈希值
        api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        return secrets.compare_digest(api_key_hash, self.api_key_hash)
    
    def update_last_active(self) -> None:
        """更新最后活跃时间"""
        self.last_active_at = timezone.now()
        self.save(update_fields=['last_active_at'])
    
    def has_permission(self, resource_type: str, action: str) -> bool:
        """
        检查是否有指定权限
        
        Args:
            resource_type: 资源类型（file/network/database/system/api）
            action: 操作类型（read/write/execute/delete）
            
        Returns:
            bool: 是否有权限
        """
        # 检查权限策略
        if resource_type in self.permissions:
            return action in self.permissions[resource_type]
        
        # 默认拒绝
        return False
    
    def get_trust_level_description(self) -> str:
        """获取信任级别的描述"""
        return dict(self.TRUST_LEVELS).get(self.trust_level, '未知')

    # ==================== 核心查询方法（带日志） ====================

    @classmethod
    def get_active_agents_by_type(cls, agent_type: str):
        """
        按类型查询活跃Agent（使用idx_agent_type_trust_active索引）

        Args:
            agent_type: Agent类型（cursor/claude/copilot/custom）

        Returns:
            QuerySet: 活跃Agent查询集
        """
        start_time = time.time()

        try:
            # 执行查询
            queryset = cls.objects.filter(
                agent_type=agent_type,
                is_active=True
            )

            # 获取查询结果数量
            count = queryset.count()
            elapsed_time = (time.time() - start_time) * 1000  # 转换为毫秒

            # 记录查询日志（仅在满足条件时）
            if AGENT_ENABLE_DETAILED_LOGS or elapsed_time > AGENT_QUERY_LOG_THRESHOLD_MS:
                logger.info(
                    f"[Agent查询] 按类型查询活跃Agent | "
                    f"类型: {agent_type} | "
                    f"使用索引: idx_agent_type_trust_active | "
                    f"结果数: {count} | "
                    f"耗时: {elapsed_time:.2f}ms"
                )

            return queryset

        except Exception as e:
            elapsed_time = (time.time() - start_time) * 1000
            logger.error(
                f"[Agent查询失败] 按类型查询活跃Agent | "
                f"类型: {agent_type} | "
                f"耗时: {elapsed_time:.2f}ms | "
                f"错误: {str(e)}"
            )
            raise

    @classmethod
    def get_agents_by_trust_level(cls, trust_level: str, active_only: bool = True):
        """
        按信任级别查询Agent（使用idx_trust_level或idx_agent_type_trust_active索引）

        Args:
            trust_level: 信任级别（low/medium/high/critical）
            active_only: 是否只查询活跃Agent

        Returns:
            QuerySet: Agent查询集
        """
        start_time = time.time()

        try:
            # 构建查询
            filters = {'trust_level': trust_level}
            if active_only:
                filters['is_active'] = True

            queryset = cls.objects.filter(**filters)
            count = queryset.count()
            elapsed_time = (time.time() - start_time) * 1000

            # 确定使用的索引
            used_index = 'idx_trust_level' if not active_only else 'idx_agent_type_trust_active'

            # 记录查询日志（仅在满足条件时）
            if AGENT_ENABLE_DETAILED_LOGS or elapsed_time > AGENT_QUERY_LOG_THRESHOLD_MS:
                logger.info(
                    f"[Agent查询] 按信任级别查询Agent | "
                    f"信任级别: {trust_level} | "
                    f"活跃过滤: {active_only} | "
                    f"使用索引: {used_index} | "
                    f"结果数: {count} | "
                    f"耗时: {elapsed_time:.2f}ms"
                )

            return queryset

        except Exception as e:
            elapsed_time = (time.time() - start_time) * 1000
            logger.error(
                f"[Agent查询失败] 按信任级别查询Agent | "
                f"信任级别: {trust_level} | "
                f"耗时: {elapsed_time:.2f}ms | "
                f"错误: {str(e)}"
            )
            raise

    @classmethod
    def get_user_active_agents(cls, user):
        """
        查询用户的活跃Agent（使用idx_agent_owner_active索引）

        Args:
            user: 用户对象

        Returns:
            QuerySet: 用户活跃Agent查询集
        """
        start_time = time.time()

        try:
            queryset = cls.objects.filter(
                owner=user,
                is_active=True
            )

            count = queryset.count()
            elapsed_time = (time.time() - start_time) * 1000

            # 记录查询日志（仅在满足条件时）
            if AGENT_ENABLE_DETAILED_LOGS or elapsed_time > AGENT_QUERY_LOG_THRESHOLD_MS:
                logger.info(
                    f"[Agent查询] 查询用户活跃Agent | "
                    f"用户: {user.username if hasattr(user, 'username') else user.id} | "
                    f"使用索引: idx_agent_owner_active | "
                    f"结果数: {count} | "
                    f"耗时: {elapsed_time:.2f}ms"
                )

            return queryset

        except Exception as e:
            elapsed_time = (time.time() - start_time) * 1000
            logger.error(
                f"[Agent查询失败] 查询用户活跃Agent | "
                f"用户: {user.username if hasattr(user, 'username') else user.id} | "
                f"耗时: {elapsed_time:.2f}ms | "
                f"错误: {str(e)}"
            )
            raise

    def verify_api_key_with_logging(self, api_key: str) -> bool:
        """
        验证API Key（带日志记录）

        Args:
            api_key: 待验证的API Key

        Returns:
            bool: 是否验证通过
        """
        start_time = time.time()

        try:
            # 检查Agent是否激活
            if not self.is_active:
                elapsed_time = (time.time() - start_time) * 1000
                logger.warning(
                    f"[API Key验证] Agent未激活 | "
                    f"Agent ID: {self.agent_id} | "
                    f"耗时: {elapsed_time:.2f}ms"
                )
                return False

            # 检查API Key是否过期
            if self.api_key_expires_at and timezone.now() > self.api_key_expires_at:
                elapsed_time = (time.time() - start_time) * 1000
                logger.warning(
                    f"[API Key验证] API Key已过期 | "
                    f"Agent ID: {self.agent_id} | "
                    f"过期时间: {self.api_key_expires_at} | "
                    f"耗时: {elapsed_time:.2f}ms"
                )
                return False

            # 验证哈希值
            api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
            is_valid = secrets.compare_digest(api_key_hash, self.api_key_hash)

            elapsed_time = (time.time() - start_time) * 1000

            if is_valid:
                logger.info(
                    f"[API Key验证] 验证成功 | "
                    f"Agent ID: {self.agent_id} | "
                    f"Agent名称: {self.agent_name} | "
                    f"信任级别: {self.trust_level} | "
                    f"耗时: {elapsed_time:.2f}ms"
                )
            else:
                logger.warning(
                    f"[API Key验证] 验证失败 | "
                    f"Agent ID: {self.agent_id} | "
                    f"原因: 哈希不匹配 | "
                    f"耗时: {elapsed_time:.2f}ms"
                )

            return is_valid

        except Exception as e:
            elapsed_time = (time.time() - start_time) * 1000
            logger.error(
                f"[API Key验证异常] Agent ID: {self.agent_id} | "
                f"耗时: {elapsed_time:.2f}ms | "
                f"错误: {str(e)}"
            )
            return False


class AgentPermission(models.Model):
    """
    Agent权限模型（资源粒度控制）
    
    实现基于资源的细粒度权限控制：
    - 支持通配符匹配（如: /home/user/documents/*）
    - 支持时间约束（如: 09:00-18:00）
    - 支持频率限制（如: 每小时最多100次）
    """
    
    # ==================== 关联Agent ====================
    
    agent = models.ForeignKey(
        AgentIdentity, 
        on_delete=models.CASCADE, 
        related_name='permission_grants',
        verbose_name='所属Agent'
    )
    
    # ==================== 资源定义 ====================
    
    RESOURCE_TYPES = [
        ('file', '文件系统'),
        ('network', '网络访问'),
        ('database', '数据库'),
        ('system', '系统命令'),
        ('api', 'API调用'),
    ]
    
    resource_type = models.CharField(
        max_length=20, 
        choices=RESOURCE_TYPES,
        verbose_name='资源类型'
    )
    
    resource_pattern = models.CharField(
        max_length=200,
        verbose_name='资源模式',
        help_text='资源匹配模式，支持通配符（如: /home/user/documents/*）'
    )
    
    # ==================== 权限操作 ====================
    
    ACTIONS = [
        ('read', '读取'),
        ('write', '写入'),
        ('execute', '执行'),
        ('delete', '删除'),
    ]
    
    action = models.CharField(
        max_length=20, 
        choices=ACTIONS,
        verbose_name='操作类型'
    )
    
    # ==================== 条件约束 ====================
    
    conditions = models.JSONField(
        default=dict,
        verbose_name='条件约束',
        help_text='额外约束条件（时间范围、频率限制等）'
    )
    
    # ==================== 授权信息 ====================
    
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True,
        verbose_name='授权人'
    )
    
    granted_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='授权时间'
    )
    
    expires_at = models.DateTimeField(
        null=True, 
        blank=True,
        verbose_name='过期时间',
        help_text='权限过期时间，NULL表示永不过期'
    )
    
    # ==================== 元信息 ====================
    
    class Meta:
        db_table = 'agent_permissions'
        unique_together = ['agent', 'resource_type', 'resource_pattern', 'action']
        ordering = ['-granted_at']
        verbose_name = 'Agent权限'
        verbose_name_plural = 'Agent权限管理'
    
    def __str__(self):
        return f"{self.agent.agent_id}: {self.get_action_display()} on {self.resource_type}"
    
    # ==================== 业务方法 ====================
    
    def is_expired(self) -> bool:
        """
        检查权限是否过期
        
        Returns:
            bool: 是否已过期
        """
        if self.expires_at is None:
            return False
        
        return timezone.now() > self.expires_at
    
    def check_conditions(self, context: dict) -> bool:
        """
        检查条件约束是否满足
        
        Args:
            context: 上下文信息（如当前时间、请求频率等）
            
        Returns:
            bool: 条件是否满足
        """
        # 时间范围检查
        if 'time_range' in self.conditions:
            # TODO: 实现时间范围检查
            pass
        
        # 频率限制检查
        if 'max_frequency' in self.conditions:
            # TODO: 实现频率限制检查（需要Redis支持）
            pass
        
        return True
    
    def matches_resource(self, resource: str) -> bool:
        """
        检查资源是否匹配权限模式
        
        Args:
            resource: 实际资源路径
            
        Returns:
            bool: 是否匹配
        """
        import fnmatch
        
        # 使用Unix shell风格的通配符匹配
        return fnmatch.fnmatch(resource, self.resource_pattern)


class AgentAuthenticationLog(models.Model):
    """
    Agent认证日志
    
    记录所有Agent的认证尝试，用于审计和安全分析
    """
    
    # ==================== 基本信息 ====================
    
    agent = models.ForeignKey(
        AgentIdentity,
        on_delete=models.CASCADE,
        related_name='auth_logs',
        verbose_name='Agent'
    )
    
    # ==================== 认证结果 ====================
    
    success = models.BooleanField(
        verbose_name='认证结果',
        help_text='True表示认证成功，False表示失败'
    )
    
    failure_reason = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name='失败原因',
        help_text='认证失败时的原因'
    )
    
    # ==================== 上下文信息 ====================
    
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name='IP地址'
    )
    
    user_agent = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name='User Agent'
    )
    
    # ==================== 时间戳 ====================
    
    timestamp = models.DateTimeField(
        auto_now_add=True,
        verbose_name='认证时间'
    )
    
    # ==================== 元信息 ====================
    
    class Meta:
        db_table = 'agent_authentication_logs'
        ordering = ['-timestamp']
        verbose_name = 'Agent认证日志'
        verbose_name_plural = 'Agent认证日志管理'
    
    def __str__(self):
        status = "成功" if self.success else "失败"
        return f"{self.agent.agent_id} - {status} - {self.timestamp}"


class AgentAuthSession(models.Model):
    """
    Agent认证会话管理
    
    管理Agent的活动会话，支持JWT Token验证
    """
    
    # ==================== 会话信息 ====================
    
    agent = models.ForeignKey(
        AgentIdentity,
        on_delete=models.CASCADE,
        related_name='sessions',
        verbose_name='Agent'
    )
    
    session_id = models.CharField(
        max_length=64,
        unique=True,
        verbose_name='会话ID'
    )
    
    # ==================== Token信息 ====================
    
    jwt_token = models.TextField(
        verbose_name='JWT Token',
        help_text='JWT Token内容'
    )
    
    token_created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Token创建时间'
    )
    
    token_expires_at = models.DateTimeField(
        verbose_name='Token过期时间'
    )
    
    # ==================== 会话状态 ====================
    
    is_active = models.BooleanField(
        default=True,
        verbose_name='是否活跃'
    )
    
    last_activity_at = models.DateTimeField(
        auto_now=True,
        verbose_name='最后活动时间'
    )
    
    # ==================== 客户端信息 ====================
    
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name='IP地址'
    )
    
    user_agent = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name='User Agent'
    )
    
    # ==================== 元信息 ====================
    
    class Meta:
        db_table = 'agent_auth_sessions'
        ordering = ['-token_created_at']
        verbose_name = 'Agent认证会话'
        verbose_name_plural = 'Agent认证会话管理'
    
    def __str__(self):
        return f"{self.agent.agent_id} - Session {self.session_id[:8]}..."
    
    def is_expired(self) -> bool:
        """检查会话是否过期"""
        return timezone.now() > self.token_expires_at
    
    def terminate(self) -> None:
        """终止会话"""
        self.is_active = False
        self.save(update_fields=['is_active'])
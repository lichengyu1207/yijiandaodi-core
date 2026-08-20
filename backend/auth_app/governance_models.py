"""
合规治理层数据模型

功能：
1. Agent合规性评分系统
2. 治理健康度监控
3. 策略版本管理

参考：
- TAISE-Agent认证框架的合规性评估
- trusted-agent-engine的治理引擎设计
"""

import logging
import time
from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

# 初始化logger
logger = logging.getLogger(__name__)


class AgentComplianceScore(models.Model):
    """
    Agent合规性评分模型
    
    实时评估每个Agent的合规状态，支持多维度评分
    """
    
    # ==================== 关联Agent ====================
    
    agent = models.OneToOneField(
        'AgentIdentity',
        on_delete=models.CASCADE,
        related_name='compliance_score',
        verbose_name='关联Agent'
    )
    
    # ==================== 综合评分 ====================
    
    overall_score = models.FloatField(
        default=100.0,
        verbose_name='综合合规评分',
        help_text='总分100分，低于60分为不合格'
    )
    
    # ==================== 维度评分 ====================
    
    authentication_score = models.FloatField(
        default=100.0,
        verbose_name='认证合规评分',
        help_text='评估API Key使用、会话管理等方面的合规性'
    )
    
    permission_score = models.FloatField(
        default=100.0,
        verbose_name='权限合规评分',
        help_text='评估权限使用是否超出授权范围'
    )
    
    behavior_score = models.FloatField(
        default=100.0,
        verbose_name='行为合规评分',
        help_text='评估操作行为是否符合安全规范'
    )
    
    audit_score = models.FloatField(
        default=100.0,
        verbose_name='审计合规评分',
        help_text='评估审计记录是否完整、可追溯'
    )
    
    # ==================== 风险指标 ====================
    
    RISK_LEVELS = [
        ('safe', '安全'),
        ('low', '低风险'),
        ('medium', '中风险'),
        ('high', '高风险'),
        ('critical', '严重风险'),
    ]
    
    risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVELS,
        default='safe',
        verbose_name='风险等级'
    )
    
    violations_count = models.IntegerField(
        default=0,
        verbose_name='违规次数',
        help_text='累计违规操作次数'
    )
    
    violations_30d = models.IntegerField(
        default=0,
        verbose_name='近30天违规次数'
    )
    
    blocked_operations_count = models.IntegerField(
        default=0,
        verbose_name='阻断操作次数',
        help_text='累计被阻断的操作次数'
    )
    
    # ==================== 活跃度指标 ====================
    
    last_operation_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='最后操作时间'
    )
    
    operations_24h = models.IntegerField(
        default=0,
        verbose_name='24小时内操作次数'
    )
    
    operations_7d = models.IntegerField(
        default=0,
        verbose_name='7天内操作次数'
    )
    
    operations_30d = models.IntegerField(
        default=0,
        verbose_name='30天内操作次数'
    )
    
    # ==================== 元数据 ====================
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='创建时间'
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='更新时间'
    )
    
    score_updated_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='评分更新时间'
    )
    
    # ==================== 元信息 ====================
    
    class Meta:
        db_table = 'agent_compliance_scores'
        verbose_name = 'Agent合规性评分'
        verbose_name_plural = 'Agent合规性评分管理'
        ordering = ['-overall_score', '-updated_at']
        
        indexes = [
            # 按综合评分查询
            models.Index(fields=['overall_score'], name='idx_compliance_overall'),
            
            # 按风险等级查询
            models.Index(fields=['risk_level'], name='idx_compliance_risk'),
            
            # 按更新时间查询
            models.Index(fields=['-updated_at'], name='idx_compliance_updated'),
            
            # 组合查询：风险等级+更新时间
            models.Index(fields=['risk_level', '-updated_at'], name='idx_compliance_risk_time'),
        ]
    
    def __str__(self):
        return f"{self.agent.agent_id} - 合规评分: {self.overall_score:.1f}"
    
    # ==================== 业务方法 ====================
    
    def update_scores(self, auth_score=None, perm_score=None, 
                     behav_score=None, audit_score=None):
        """
        更新各维度评分并重新计算综合评分
        
        Args:
            auth_score: 认证评分
            perm_score: 权限评分
            behav_score: 行为评分
            audit_score: 审计评分
        """
        start_time = time.time()
        
        try:
            # 更新维度评分
            if auth_score is not None:
                self.authentication_score = auth_score
            if perm_score is not None:
                self.permission_score = perm_score
            if behav_score is not None:
                self.behavior_score = behav_score
            if audit_score is not None:
                self.audit_score = audit_score
            
            # 计算综合评分（加权平均）
            self.overall_score = (
                self.authentication_score * 0.25 +
                self.permission_score * 0.30 +
                self.behavior_score * 0.35 +
                self.audit_score * 0.10
            )
            
            # 更新风险等级
            self.risk_level = self._calculate_risk_level()
            
            # 更新时间戳
            self.score_updated_at = timezone.now()
            self.save()
            
            elapsed_ms = (time.time() - start_time) * 1000
            
            logger.info(
                f"[合规评分] Agent {self.agent.agent_id} 评分更新 | "
                f"综合评分: {self.overall_score:.1f} | "
                f"风险等级: {self.risk_level} | "
                f"耗时: {elapsed_ms:.2f}ms"
            )
            
        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            logger.error(
                f"[合规评分失败] Agent {self.agent.agent_id} | "
                f"错误: {str(e)} | "
                f"耗时: {elapsed_ms:.2f}ms"
            )
            raise
    
    def _calculate_risk_level(self) -> str:
        """
        根据综合评分计算风险等级
        
        Returns:
            str: 风险等级
        """
        if self.overall_score >= 90:
            return 'safe'
        elif self.overall_score >= 75:
            return 'low'
        elif self.overall_score >= 60:
            return 'medium'
        elif self.overall_score >= 40:
            return 'high'
        else:
            return 'critical'
    
    def record_violation(self, violation_type: str = 'general'):
        """
        记录违规行为
        
        Args:
            violation_type: 违规类型
        """
        self.violations_count += 1
        self.violations_30d += 1
        
        # 扣除评分
        penalty = {
            'general': 5,
            'permission_exceeded': 10,
            'suspicious_behavior': 15,
            'blocked_operation': 20,
            'critical_violation': 30,
        }.get(violation_type, 5)
        
        self.overall_score = max(0, self.overall_score - penalty)
        self.risk_level = self._calculate_risk_level()
        
        self.save()
        
        logger.warning(
            f"[违规记录] Agent {self.agent.agent_id} | "
            f"违规类型: {violation_type} | "
            f"扣分: {penalty} | "
            f"当前评分: {self.overall_score:.1f}"
        )
    
    def increment_operations(self):
        """增加操作计数"""
        self.operations_24h += 1
        self.operations_7d += 1
        self.operations_30d += 1
        self.last_operation_at = timezone.now()
        self.save(update_fields=[
            'operations_24h', 'operations_7d', 'operations_30d',
            'last_operation_at'
        ])


class GovernanceHealth(models.Model):
    """
    治理健康度监控模型
    
    实时监控整个系统的治理健康状态
    """
    
    # ==================== 综合健康度 ====================
    
    health_score = models.FloatField(
        default=100.0,
        verbose_name='治理健康度评分',
        help_text='总分100分，反映整体治理水平'
    )
    
    # ==================== Agent统计 ====================
    
    total_agents_count = models.IntegerField(
        default=0,
        verbose_name='Agent总数'
    )
    
    active_agents_count = models.IntegerField(
        default=0,
        verbose_name='活跃Agent数',
        help_text='24小时内有活动的Agent'
    )
    
    compliant_agents_count = models.IntegerField(
        default=0,
        verbose_name='合规Agent数',
        help_text='评分>=60分的Agent'
    )
    
    high_risk_agents_count = models.IntegerField(
        default=0,
        verbose_name='高风险Agent数',
        help_text='评分<40分的Agent'
    )
    
    # ==================== 操作统计 ====================
    
    operations_24h = models.IntegerField(
        default=0,
        verbose_name='24小时操作总数'
    )
    
    operations_7d = models.IntegerField(
        default=0,
        verbose_name='7天操作总数'
    )
    
    operations_30d = models.IntegerField(
        default=0,
        verbose_name='30天操作总数'
    )
    
    # ==================== 违规统计 ====================
    
    violations_24h = models.IntegerField(
        default=0,
        verbose_name='24小时违规次数'
    )
    
    violations_7d = models.IntegerField(
        default=0,
        verbose_name='7天违规次数'
    )
    
    violations_30d = models.IntegerField(
        default=0,
        verbose_name='30天违规次数'
    )
    
    # ==================== 阻断统计 ====================
    
    blocked_operations_24h = models.IntegerField(
        default=0,
        verbose_name='24小时阻断操作数'
    )
    
    blocked_operations_7d = models.IntegerField(
        default=0,
        verbose_name='7天阻断操作数'
    )
    
    blocked_operations_30d = models.IntegerField(
        default=0,
        verbose_name='30天阻断操作数'
    )
    
    # ==================== 合规率 ====================
    
    compliance_rate = models.FloatField(
        default=100.0,
        verbose_name='合规率',
        help_text='合规操作占比（%）'
    )
    
    blocking_rate = models.FloatField(
        default=0.0,
        verbose_name='阻断率',
        help_text='阻断操作占比（%）'
    )
    
    # ==================== 时间戳 ====================
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='创建时间'
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='更新时间'
    )
    
    snapshot_time = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='快照时间',
        help_text='数据统计的截止时间'
    )
    
    # ==================== 元信息 ====================
    
    class Meta:
        db_table = 'governance_health'
        verbose_name = '治理健康度监控'
        verbose_name_plural = '治理健康度监控管理'
        ordering = ['-updated_at']
        
        indexes = [
            # 按健康度评分查询
            models.Index(fields=['health_score'], name='idx_health_score'),
            
            # 按更新时间查询
            models.Index(fields=['-updated_at'], name='idx_health_updated'),
        ]
    
    def __str__(self):
        return f"治理健康度: {self.health_score:.1f} - {self.snapshot_time or self.updated_at}"
    
    # ==================== 业务方法 ====================
    
    @classmethod
    def take_snapshot(cls):
        """
        拍摄治理健康度快照

        集成自监控结果，使健康度评分反映性能漂移、权限异常等问题。
        并发请求下 SQLite 可能出现表锁冲突，这里做有限次重试。

        Returns:
            GovernanceHealth: 新创建的快照对象
        """
        from django.db import OperationalError
        import time as _time

        max_attempts = 5
        for attempt in range(max_attempts):
            try:
                return cls._take_snapshot_once()
            except OperationalError as e:
                message = str(e).lower()
                if ('locked' in message or 'busy' in message) and attempt < max_attempts - 1:
                    _time.sleep(0.1 * (attempt + 1))
                    logger.warning(
                        f"[治理健康度快照] 数据库锁冲突，第{attempt + 1}次重试 | 错误: {str(e)}"
                    )
                    continue
                raise

    @classmethod
    def _take_snapshot_once(cls):
        """
        拍摄治理健康度快照（单次执行）

        Returns:
            GovernanceHealth: 新创建的快照对象
        """
        from .agent_identity_models import AgentIdentity
        from .memory_models import ShortTermMemory
        from .self_audit_models import PerformanceDriftRecord, AgentPermissionAuditLog, RuleFreshnessCheck

        start_time = time.time()

        try:
            # 统计Agent数据
            total_agents = AgentIdentity.objects.count()
            active_agents = AgentIdentity.objects.filter(
                last_active_at__gte=timezone.now() - timedelta(hours=24)
            ).count()

            compliant_agents = AgentIdentity.objects.filter(
                compliance_score__overall_score__gte=60
            ).count()

            high_risk_agents = AgentIdentity.objects.filter(
                compliance_score__overall_score__lt=40
            ).count()

            # 统计操作数据（从短期记忆）
            now = timezone.now()
            operations_24h = ShortTermMemory.objects.filter(
                timestamp__gte=now - timedelta(hours=24)
            ).count()

            operations_7d = ShortTermMemory.objects.filter(
                timestamp__gte=now - timedelta(days=7)
            ).count()

            operations_30d = ShortTermMemory.objects.filter(
                timestamp__gte=now - timedelta(days=30)
            ).count()

            # 统计违规和阻断数据
            violations_24h = ShortTermMemory.objects.filter(
                timestamp__gte=now - timedelta(hours=24),
                risk_level__in=['high', 'critical']
            ).count()

            blocked_24h = ShortTermMemory.objects.filter(
                timestamp__gte=now - timedelta(hours=24),
                decision='block'
            ).count()

            # 计算合规率和阻断率
            compliance_rate = (
                (operations_24h - violations_24h) / operations_24h * 100
                if operations_24h > 0 else 100.0
            )

            blocking_rate = (
                blocked_24h / operations_24h * 100
                if operations_24h > 0 else 0.0
            )

            # ==================== 自监控集成 ====================
            # 获取自监控统计数据
            performance_drifts_24h = PerformanceDriftRecord.objects.filter(
                detected_at__gte=now - timedelta(hours=24),
                is_resolved=False
            ).count()

            critical_drifts_24h = PerformanceDriftRecord.objects.filter(
                detected_at__gte=now - timedelta(hours=24),
                severity='critical',
                is_resolved=False
            ).count()

            permission_anomalies_24h = AgentPermissionAuditLog.objects.filter(
                timestamp__gte=now - timedelta(hours=24),
                is_anomaly=True
            ).count()

            stale_rules = RuleFreshnessCheck.objects.filter(
                checked_at__gte=now - timedelta(hours=24),
                freshness_status__in=['stale', 'outdated']
            ).count()

            deprecated_rules = RuleFreshnessCheck.objects.filter(
                checked_at__gte=now - timedelta(hours=24),
                freshness_status='deprecated'
            ).count()

            # 计算自监控评分（基于问题的严重程度扣分）
            self_audit_penalty = 0
            self_audit_penalty += critical_drifts_24h * 10  # 严重漂移每个扣10分
            self_audit_penalty += (performance_drifts_24h - critical_drifts_24h) * 5  # 普通漂移每个扣5分
            self_audit_penalty += permission_anomalies_24h * 8  # 权限异常每个扣8分
            self_audit_penalty += deprecated_rules * 3  # 废弃规则每个扣3分

            # 计算健康度评分
            health_score = cls._calculate_health_score(
                compliance_rate=compliance_rate,
                active_agents_ratio=active_agents / total_agents if total_agents > 0 else 1.0,
                high_risk_ratio=high_risk_agents / total_agents if total_agents > 0 else 0.0,
                blocking_rate=blocking_rate
            )

            # 应用自监控惩罚（确保评分不低于0）
            health_score = max(0, health_score - self_audit_penalty)

            # 创建快照
            snapshot = cls.objects.create(
                health_score=health_score,
                total_agents_count=total_agents,
                active_agents_count=active_agents,
                compliant_agents_count=compliant_agents,
                high_risk_agents_count=high_risk_agents,
                operations_24h=operations_24h,
                operations_7d=operations_7d,
                operations_30d=operations_30d,
                violations_24h=violations_24h,
                blocked_operations_24h=blocked_24h,
                compliance_rate=compliance_rate,
                blocking_rate=blocking_rate,
                snapshot_time=now
            )

            elapsed_ms = (time.time() - start_time) * 1000

            logger.info(
                f"[治理健康度快照] 快照创建成功 | "
                f"健康度: {health_score:.1f} | "
                f"活跃Agent: {active_agents}/{total_agents} | "
                f"合规率: {compliance_rate:.1f}% | "
                f"性能漂移: {performance_drifts_24h} | "
                f"权限异常: {permission_anomalies_24h} | "
                f"自监控惩罚: -{self_audit_penalty}分 | "
                f"耗时: {elapsed_ms:.2f}ms"
            )

            return snapshot
            
        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            logger.error(
                f"[治理健康度快照失败] 错误: {str(e)} | "
                f"耗时: {elapsed_ms:.2f}ms"
            )
            raise
    
    @staticmethod
    def _calculate_health_score(compliance_rate: float, 
                                active_agents_ratio: float,
                                high_risk_ratio: float,
                                blocking_rate: float) -> float:
        """
        计算治理健康度评分
        
        Args:
            compliance_rate: 合规率
            active_agents_ratio: 活跃Agent占比
            high_risk_ratio: 高风险Agent占比
            blocking_rate: 阻断率
            
        Returns:
            float: 健康度评分（0-100）
        """
        # 合规率权重：40%
        compliance_score = compliance_rate * 0.40
        
        # 活跃度权重：20%
        activity_score = active_agents_ratio * 100 * 0.20
        
        # 风险控制权重：30%（高风险Agent越少越好）
        risk_score = (1 - high_risk_ratio) * 100 * 0.30
        
        # 阻断控制权重：10%（阻断率越低越好）
        block_score = (100 - blocking_rate) * 0.10
        
        return max(0, min(100, compliance_score + activity_score + risk_score + block_score))


class StrategyVersion(models.Model):
    """
    策略版本管理模型
    
    支持策略的版本控制、灰度发布和回滚
    """
    
    # ==================== 关联策略 ====================
    
    strategy = models.ForeignKey(
        'StrategicMemory',
        on_delete=models.CASCADE,
        related_name='versions',
        verbose_name='关联策略'
    )
    
    # ==================== 版本信息 ====================
    
    version = models.CharField(
        max_length=20,
        verbose_name='版本号',
        help_text='格式: v1.0.0'
    )
    
    version_code = models.IntegerField(
        default=1,
        verbose_name='版本编码',
        help_text='用于版本比较的数字编码'
    )
    
    # ==================== 策略配置 ====================
    
    config = models.JSONField(
        default=dict,
        verbose_name='策略配置',
        help_text='完整的策略配置数据'
    )
    
    changes = models.JSONField(
        default=dict,
        verbose_name='变更记录',
        help_text='相对于上一版本的变更内容'
    )
    
    # ==================== 发布状态 ====================
    
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('testing', '测试中'),
        ('staging', '预发布'),
        ('production', '生产环境'),
        ('deprecated', '已废弃'),
    ]
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        verbose_name='发布状态'
    )
    
    is_active = models.BooleanField(
        default=False,
        verbose_name='是否激活',
        help_text='当前生产环境使用的版本'
    )
    
    # ==================== 灰度发布 ====================
    
    rollout_percentage = models.IntegerField(
        default=0,
        verbose_name='灰度比例',
        help_text='0-100，表示推送到生产环境的比例'
    )
    
    rollout_agents = models.JSONField(
        default=list,
        verbose_name='灰度Agent列表',
        help_text='参与灰度测试的Agent ID列表'
    )
    
    # ==================== 部署信息 ====================
    
    deployed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='部署时间'
    )
    
    deployed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deployed_strategies',
        verbose_name='部署人'
    )
    
    # ==================== 性能指标 ====================
    
    performance_metrics = models.JSONField(
        default=dict,
        verbose_name='性能指标',
        help_text='包含命中率、误报率、响应时间等'
    )
    
    # ==================== 元数据 ====================
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='创建时间'
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='更新时间'
    )
    
    changelog = models.TextField(
        default='',
        verbose_name='变更日志',
        help_text='版本变更的详细说明'
    )
    
    # ==================== 元信息 ====================
    
    class Meta:
        db_table = 'strategy_versions'
        verbose_name = '策略版本'
        verbose_name_plural = '策略版本管理'
        ordering = ['-version_code']
        unique_together = ['strategy', 'version']
        
        indexes = [
            # 按策略和版本查询
            models.Index(fields=['strategy', '-version_code'], name='idx_strategy_version'),
            
            # 按状态查询
            models.Index(fields=['status'], name='idx_strategy_status'),
            
            # 按激活状态查询
            models.Index(fields=['is_active'], name='idx_strategy_active'),
            
            # 按部署时间查询
            models.Index(fields=['-deployed_at'], name='idx_strategy_deployed'),
        ]
    
    def __str__(self):
        return f"{self.strategy.rule_name} - {self.version} ({self.get_status_display()})"
    
    # ==================== 业务方法 ====================
    
    def deploy(self, user=None, rollout_percentage: int = 100, rollout_agents: list = None):
        """
        部署策略版本

        Args:
            user: 部署人
            rollout_percentage: 灰度比例（0-100）
            rollout_agents: 参与灰度测试的Agent ID列表
        """
        if rollout_agents is None:
            rollout_agents = []

        start_time = time.time()

        try:
            # 检查是否已经有激活版本
            active_version = StrategyVersion.objects.filter(
                strategy=self.strategy,
                is_active=True
            ).exclude(pk=self.pk).first()

            if active_version and rollout_percentage == 100:
                # 完全部署，先停用旧版本
                active_version.is_active = False
                active_version.status = 'deprecated'
                active_version.save()

            # 激活当前版本
            self.is_active = (rollout_percentage == 100)
            self.status = 'production'
            self.deployed_at = timezone.now()
            self.deployed_by = user
            self.rollout_percentage = rollout_percentage
            self.rollout_agents = rollout_agents
            self.save()
            
            elapsed_ms = (time.time() - start_time) * 1000
            
            logger.info(
                f"[策略部署] 策略 {self.strategy.rule_name} v{self.version} | "
                f"灰度比例: {rollout_percentage}% | "
                f"部署人: {user.username if user else '系统'} | "
                f"耗时: {elapsed_ms:.2f}ms"
            )

        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            logger.error(
                f"[策略部署失败] 策略 {self.strategy.rule_name} v{self.version} | "
                f"错误: {str(e)} | "
                f"耗时: {elapsed_ms:.2f}ms"
            )
            raise
    
    def rollback(self, user=None):
        """
        回滚到上一版本
        
        Args:
            user: 执行回滚的用户
        """
        start_time = time.time()
        
        try:
            # 查找上一版本
            previous_version = StrategyVersion.objects.filter(
                strategy=self.strategy,
                version_code__lt=self.version_code,
                status__in=['deprecated', 'production']
            ).order_by('-version_code').first()

            if not previous_version:
                raise ValueError("没有找到可回滚的版本")
            
            # 停用当前版本
            self.is_active = False
            self.status = 'deprecated'
            self.save()
            
            # 激活上一版本
            previous_version.is_active = True
            previous_version.status = 'production'
            previous_version.deployed_at = timezone.now()
            previous_version.deployed_by = user
            previous_version.save()
            
            elapsed_ms = (time.time() - start_time) * 1000
            
            logger.warning(
                f"[策略回滚] 策略 {self.strategy.rule_name} | "
                f"从 {self.version} 回滚到 {previous_version.version} | "
                f"执行人: {user.username if user else '系统'} | "
                f"耗时: {elapsed_ms:.2f}ms"
            )
            
            return previous_version
            
        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            logger.error(
                f"[策略回滚失败] 策略 {self.strategy.rule_name} | "
                f"错误: {str(e)} | "
                f"耗时: {elapsed_ms:.2f}ms"
            )
            raise
    
    def update_performance_metrics(self, metrics: dict):
        """
        更新性能指标
        
        Args:
            metrics: 性能指标数据
        """
        self.performance_metrics.update(metrics)
        self.save(update_fields=['performance_metrics', 'updated_at'])
        
        logger.info(
            f"[性能指标更新] 策略 {self.strategy.rule_name} v{self.version} | "
            f"指标: {metrics}"
        )
"""
海马体记忆系统数据模型

功能：
1. 短期记忆（ShortTermMemory）：实时行为监控，30分钟自动过期
2. 长期记忆（LongTermMemory）：历史审计记录，五元组链式存证
3. 策略记忆（StrategicMemory）：安全策略知识库，持续迭代优化

参考：
- 人类大脑海马体的记忆机制
- TAISE-Agent认证框架
- esign-agent-trust的四可信闭环
"""

from django.db import models, connection, transaction
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import hashlib
import json
import logging
import time

# 创建logger
logger = logging.getLogger(__name__)


class ChainIndexCounter(models.Model):
    """
    计数器表（用于长期记忆的chain_index生成）

    SQLite不支持SEQUENCE，使用计数器表替代
    """
    counter = models.IntegerField(default=0)

    class Meta:
        db_table = 'chain_index_counter'

    @classmethod
    def get_next_index(cls):
        """
        获取下一个chain_index（原子操作）

        使用事务和SELECT FOR UPDATE确保并发安全
        """
        start_time = time.time()

        try:
            with transaction.atomic():
                # 记录开始获取chain_index
                logger.debug(
                    f"[ChainIndex] 开始获取chain_index | "
                    f"线程ID: {time.thread_time()} | "
                    f"时间戳: {timezone.now().isoformat()}"
                )

                # 使用SELECT FOR UPDATE锁定记录（SQLite不支持，用事务代替）
                obj, created = cls.objects.get_or_create(id=1, defaults={'counter': 0})
                obj.counter += 1
                obj.save()

                elapsed_ms = (time.time() - start_time) * 1000

                # 记录成功获取chain_index
                logger.info(
                    f"[ChainIndex] 成功获取chain_index: {obj.counter} | "
                    f"新创建计数器: {created} | "
                    f"耗时: {elapsed_ms:.2f}ms | "
                    f"线程ID: {time.thread_time()}"
                )

                return obj.counter

        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            logger.error(
                f"[ChainIndex] 获取chain_index失败 | "
                f"错误: {str(e)} | "
                f"耗时: {elapsed_ms:.2f}ms"
            )
            raise


class ShortTermMemory(models.Model):
    """
    短期记忆：实时行为监控

    特点：
    - 30分钟自动过期
    - 毫秒级响应
    - 高频读写
    """

    # ==================== 基本信息 ====================

    agent_id = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name='Agent ID',
        help_text='Agent唯一标识符'
    )

    operation_type = models.CharField(
        max_length=50,
        verbose_name='操作类型',
        help_text='如：file_read, api_call, network_access'
    )

    operation_content = models.TextField(
        verbose_name='操作内容',
        help_text='操作的具体内容'
    )

    # ==================== 风险评估 ====================

    risk_score = models.FloatField(
        default=0.0,
        verbose_name='风险分数',
        help_text='0.0-1.0，越高越危险'
    )

    risk_level = models.CharField(
        max_length=20,
        choices=[
            ('low', '低风险'),
            ('medium', '中风险'),
            ('high', '高风险'),
            ('critical', '严重')
        ],
        default='low',
        verbose_name='风险等级'
    )

    risk_tags = models.JSONField(
        default=list,
        verbose_name='风险标签',
        help_text='如：["suspicious", "unusual_time"]'
    )

    # ==================== 决策结果 ====================

    decision = models.CharField(
        max_length=20,
        choices=[
            ('allow', '放行'),
            ('block', '阻断'),
            ('ask_user', '询问用户')
        ],
        default='allow',
        verbose_name='决策结果'
    )

    # ==================== 时间管理 ====================

    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name='创建时间'
    )

    expires_at = models.DateTimeField(
        verbose_name='过期时间',
        help_text='30分钟后自动过期'
    )

    # ==================== 元数据 ====================

    metadata = models.JSONField(
        default=dict,
        verbose_name='元数据',
        help_text='可存储响应时间、来源IP等扩展信息'
    )

    # ==================== 元信息 ====================

    class Meta:
        db_table = 'short_term_memories'
        ordering = ['-timestamp']
        verbose_name = '短期记忆'
        verbose_name_plural = '短期记忆管理'

        # 性能优化索引（优化后：减少到3个）
        indexes = [
            # 主查询索引：按时间查询（最常见）
            models.Index(fields=['-timestamp'], name='idx_stm_timestamp'),

            # 复合索引：按Agent和时间查询（高频使用）
            models.Index(fields=['agent_id', '-timestamp'], name='idx_stm_agent_time'),

            # 过期清理索引：定时任务使用
            models.Index(fields=['expires_at'], name='idx_stm_expires'),
        ]

    def __str__(self):
        return f"{self.agent_id}: {self.operation_type} ({self.risk_level})"

    def save(self, *args, **kwargs):
        """自动设置过期时间（30分钟）"""
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=30)
        super().save(*args, **kwargs)

    def is_expired(self) -> bool:
        """检查是否过期"""
        return timezone.now() > self.expires_at


class LongTermMemory(models.Model):
    """
    长期记忆：历史审计存证

    特点：
    - 永久保存
    - 五元组链式存证
    - 支持复杂查询
    """

    # ==================== 基本信息 ====================

    agent_id = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name='Agent ID'
    )

    operation_type = models.CharField(
        max_length=50,
        verbose_name='操作类型'
    )

    operation_content = models.TextField(
        verbose_name='操作内容'
    )

    # ==================== 风险评估 ====================

    risk_level = models.CharField(
        max_length=20,
        choices=[
            ('low', '低风险'),
            ('medium', '中风险'),
            ('high', '高风险'),
            ('critical', '严重')
        ],
        default='low',
        verbose_name='风险等级'
    )

    risk_score = models.FloatField(
        default=0.0,
        verbose_name='风险分数'
    )

    risk_tags = models.JSONField(
        default=list,
        verbose_name='风险标签'
    )

    # ==================== 五元组链式存证 ====================

    record_hash = models.CharField(
        max_length=64,
        unique=True,
        verbose_name='记录哈希',
        help_text='SHA-256哈希值'
    )

    prev_hash = models.CharField(
        max_length=64,
        default='0000000000000000000000000000000000000000000000000000000000000000',
        verbose_name='前一条记录哈希',
        help_text='形成区块链式结构'
    )

    chain_index = models.IntegerField(
        default=0,
        verbose_name='链索引',
        help_text='记录在链中的位置'
    )

    # ==================== 决策结果 ====================

    decision = models.CharField(
        max_length=20,
        choices=[
            ('allow', '放行'),
            ('block', '阻断'),
            ('ask_user', '询问用户')
        ],
        default='allow',
        verbose_name='决策结果'
    )

    # ==================== 关联用户 ====================

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='long_term_memories',
        verbose_name='所属用户'
    )

    # ==================== 时间戳 ====================

    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name='创建时间'
    )

    # ==================== 人工复核 ====================

    verified_result = models.BooleanField(
        null=True,
        blank=True,
        verbose_name='人工复核结果',
        help_text='True=安全(误报), False=危险(正确), None=未复核'
    )

    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_memories',
        verbose_name='复核人'
    )

    verified_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='复核时间'
    )

    verification_note = models.TextField(
        blank=True,
        default='',
        verbose_name='复核说明',
        help_text='人工复核时的备注说明'
    )

    # ==================== 元信息 ====================

    class Meta:
        db_table = 'long_term_memories'
        ordering = ['-timestamp']
        verbose_name = '长期记忆'
        verbose_name_plural = '长期记忆管理'

        # 性能优化索引（优化后）
        indexes = [
            # 主查询索引：按时间查询
            models.Index(fields=['-timestamp'], name='idx_ltm_timestamp'),

            # Agent查询索引（最常用）
            models.Index(fields=['agent_id', '-timestamp'], name='idx_ltm_agent_time'),

            # 链式查询索引（用于链验证）
            models.Index(fields=['chain_index'], name='idx_ltm_chain'),

            # 用户查询索引
            models.Index(fields=['user', '-timestamp'], name='idx_ltm_user_time'),

            # 人工复核索引（用于误报率统计）
            models.Index(fields=['verified_result', '-timestamp'], name='idx_ltm_verified'),

            # 复核人查询索引
            models.Index(fields=['verified_by', '-verified_at'], name='idx_ltm_verifier'),
        ]

    def __str__(self):
        return f"{self.agent_id}: {self.operation_type} ({self.risk_level})"

    def calculate_hash(self) -> str:
        """计算记录的哈希值"""
        data = {
            'agent_id': self.agent_id,
            'operation_type': self.operation_type,
            'operation_content': self.operation_content,
            'risk_level': self.risk_level,
            'risk_score': self.risk_score,
            'decision': self.decision,
            'prev_hash': self.prev_hash,
            'timestamp': str(self.timestamp)
        }
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

    def save(self, *args, **kwargs):
        """
        自动计算哈希值和链索引（优化版）

        使用计数器表确保并发写入时chain_index不会重复
        """
        if not self.record_hash:
            start_time = time.time()

            try:
                # 记录开始创建长期记忆
                logger.debug(
                    f"[LongTermMemory] 开始创建长期记忆 | "
                    f"Agent: {self.agent_id} | "
                    f"操作类型: {self.operation_type} | "
                    f"时间戳: {timezone.now().isoformat()}"
                )

                # 使用计数器表获取chain_index（原子操作，避免并发冲突）
                self.chain_index = ChainIndexCounter.get_next_index()

                # 获取前一条记录的哈希（使用索引查询）
                if self.chain_index > 1:
                    prev_record = LongTermMemory.objects.filter(
                        chain_index=self.chain_index - 1
                    ).only('record_hash').first()
                    self.prev_hash = prev_record.record_hash if prev_record else '0000000000000000000000000000000000000000000000000000000000000000'

                    logger.debug(
                        f"[LongTermMemory] 链式连接成功 | "
                        f"chain_index: {self.chain_index} | "
                        f"prev_hash: {self.prev_hash[:16]}..."
                    )
                else:
                    # 第一条记录
                    self.prev_hash = '0000000000000000000000000000000000000000000000000000000000000000'

                    logger.info(
                        f"[LongTermMemory] 创建第一条链记录 | "
                        f"chain_index: 1"
                    )

                # 计算哈希值
                self.record_hash = self.calculate_hash()

                elapsed_ms = (time.time() - start_time) * 1000

                # 记录成功创建
                logger.info(
                    f"[LongTermMemory] 成功创建长期记忆 | "
                    f"chain_index: {self.chain_index} | "
                    f"record_hash: {self.record_hash[:16]}... | "
                    f"Agent: {self.agent_id} | "
                    f"总耗时: {elapsed_ms:.2f}ms"
                )

            except Exception as e:
                elapsed_ms = (time.time() - start_time) * 1000
                logger.error(
                    f"[LongTermMemory] 创建失败 | "
                    f"Agent: {self.agent_id} | "
                    f"错误: {str(e)} | "
                    f"耗时: {elapsed_ms:.2f}ms"
                )
                raise

        super().save(*args, **kwargs)


class StrategicMemory(models.Model):
    """
    策略记忆：安全策略知识库

    特点：
    - 持续迭代优化
    - 版本演进
    - 热加载支持
    """

    # ==================== 基本信息 ====================

    strategy_id = models.CharField(
        max_length=100,
        unique=True,
        verbose_name='策略ID',
        help_text='如：rule_file_access_001'
    )

    strategy_type = models.CharField(
        max_length=50,
        choices=[
            ('detection_rule', '检测规则'),
            ('threshold', '阈值配置'),
            ('whitelist', '白名单'),
            ('blacklist', '黑名单'),
            ('behavior_pattern', '行为模式')
        ],
        verbose_name='策略类型'
    )

    # ==================== 策略内容 ====================

    rule_name = models.CharField(
        max_length=100,
        verbose_name='规则名称'
    )

    rule_condition = models.JSONField(
        verbose_name='规则条件',
        help_text='JSON Schema格式的条件'
    )

    rule_action = models.CharField(
        max_length=20,
        choices=[
            ('allow', '放行'),
            ('block', '阻断'),
            ('ask', '询问用户'),
            ('log', '仅记录')
        ],
        default='allow',
        verbose_name='规则动作'
    )

    # ==================== 学习参数 ====================

    confidence = models.FloatField(
        default=0.5,
        verbose_name='置信度',
        help_text='0.0-1.0，策略的可信度'
    )

    sample_count = models.IntegerField(
        default=0,
        verbose_name='样本数量',
        help_text='该策略基于的样本数'
    )

    success_rate = models.FloatField(
        default=0.0,
        verbose_name='成功率',
        help_text='策略判断的成功率'
    )

    # ==================== 版本管理 ====================

    version = models.IntegerField(
        default=1,
        verbose_name='版本号'
    )

    parent_strategy = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='child_strategies',
        verbose_name='父策略',
        help_text='策略迭代的关系'
    )

    # ==================== 生效状态 ====================

    is_active = models.BooleanField(
        default=True,
        verbose_name='是否生效'
    )

    effective_from = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='生效开始时间'
    )

    effective_until = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='生效结束时间'
    )

    # ==================== 创建信息 ====================

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_strategies',
        verbose_name='创建者'
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='创建时间'
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='更新时间'
    )

    # ==================== 元信息 ====================

    class Meta:
        db_table = 'strategic_memories'
        ordering = ['-created_at']
        verbose_name = '策略记忆'
        verbose_name_plural = '策略记忆管理'

        # 性能优化索引
        indexes = [
            # 按类型和状态查询
            models.Index(fields=['strategy_type', 'is_active'], name='idx_sm_type_active'),

            # 按策略ID查询
            models.Index(fields=['strategy_id'], name='idx_sm_strategy_id'),

            # 按创建时间查询
            models.Index(fields=['-created_at'], name='idx_sm_created'),

            # 按置信度查询（用于策略推荐）
            models.Index(fields=['-confidence'], name='idx_sm_confidence'),
        ]

    def __str__(self):
        return f"{self.rule_name} (v{self.version})"

    def is_effective(self) -> bool:
        """检查策略是否在生效期内"""
        now = timezone.now()

        if not self.is_active:
            return False

        if self.effective_from and now < self.effective_from:
            return False

        if self.effective_until and now > self.effective_until:
            return False

        return True

    def create_new_version(self, new_condition: dict, created_by=None):
        """创建新版本策略"""
        return StrategicMemory.objects.create(
            strategy_id=f"{self.strategy_id}_v{self.version + 1}",
            strategy_type=self.strategy_type,
            rule_name=self.rule_name,
            rule_condition=new_condition,
            rule_action=self.rule_action,
            confidence=0.5,  # 新版本重置置信度
            version=self.version + 1,
            parent_strategy=self,
            created_by=created_by
        )
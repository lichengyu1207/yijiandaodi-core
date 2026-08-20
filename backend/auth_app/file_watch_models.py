"""
文件系统监控数据模型

功能：
- 监控指定目录的文件变动
- 记录文件操作日志
- 存储文件哈希历史
- 风险评估结果

作者：一鉴到底团队
创建时间：2026-08-12
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class FileWatchConfig(models.Model):
    """
    文件监控配置
    
    用户可以配置需要监控的目录和监控规则
    """
    
    # 基本信息
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='file_watch_configs',
        verbose_name='所属用户'
    )
    
    watch_path = models.CharField(
        max_length=500,
        verbose_name='监控路径',
        help_text='绝对路径，如：C:\\漫剧\\素材'
    )
    
    watch_name = models.CharField(
        max_length=100,
        verbose_name='监控名称',
        help_text='用户自定义名称，如："素材目录"'
    )
    
    # 监控选项
    watch_create = models.BooleanField(
        default=True,
        verbose_name='监控文件创建'
    )
    
    watch_modify = models.BooleanField(
        default=True,
        verbose_name='监控文件修改'
    )
    
    watch_rename = models.BooleanField(
        default=True,
        verbose_name='监控文件重命名'
    )
    
    watch_delete = models.BooleanField(
        default=True,
        verbose_name='监控文件删除'
    )
    
    # 文件类型过滤
    file_extensions = models.JSONField(
        default=list,
        verbose_name='监控的文件扩展名',
        help_text='如：["jpg", "png", "mp4", "py", "js"]，空列表表示监控所有文件'
    )
    
    exclude_patterns = models.JSONField(
        default=list,
        verbose_name='排除模式',
        help_text='如：["*.tmp", "*.temp", "~*"]'
    )
    
    # 校验配置
    auto_verify = models.BooleanField(
        default=True,
        verbose_name='自动触发校验',
        help_text='文件变动时自动触发四官协同校验'
    )
    
    risk_threshold = models.CharField(
        max_length=20,
        choices=[
            ('low', '低风险'),
            ('medium', '中风险'),
            ('high', '高风险')
        ],
        default='medium',
        verbose_name='风险阈值',
        help_text='超过此风险等级时弹窗确认'
    )
    
    # 状态
    is_active = models.BooleanField(
        default=True,
        verbose_name='是否启用'
    )
    
    # 统计信息
    total_files = models.IntegerField(
        default=0,
        verbose_name='监控文件总数'
    )
    
    last_check_time = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='最后检查时间'
    )
    
    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        db_table = 'file_watch_configs'
        ordering = ['-created_at']
        verbose_name = '文件监控配置'
        verbose_name_plural = '文件监控配置管理'
        indexes = [
            models.Index(fields=['user', 'is_active'], name='idx_fwc_user_active'),
            models.Index(fields=['watch_path'], name='idx_fwc_path'),
        ]
    
    def __str__(self):
        return f"{self.watch_name} ({self.watch_path})"


class FileOperationLog(models.Model):
    """
    文件操作日志
    
    记录所有文件变动事件的详细信息
    """
    
    OPERATION_TYPES = [
        ('create', '文件创建'),
        ('modify', '文件修改'),
        ('rename', '文件重命名'),
        ('delete', '文件删除'),
    ]
    
    RISK_LEVELS = [
        ('safe', '安全'),
        ('low', '低风险'),
        ('medium', '中风险'),
        ('high', '高风险'),
        ('critical', '严重风险'),
    ]
    
    # 基本信息
    config = models.ForeignKey(
        FileWatchConfig,
        on_delete=models.CASCADE,
        related_name='operation_logs',
        verbose_name='监控配置'
    )
    
    # 文件信息
    file_path = models.CharField(
        max_length=1000,
        verbose_name='文件路径',
        help_text='文件的完整路径'
    )
    
    file_name = models.CharField(
        max_length=255,
        verbose_name='文件名'
    )
    
    file_extension = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='文件扩展名'
    )
    
    file_size = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name='文件大小(字节)'
    )
    
    # 操作信息
    operation_type = models.CharField(
        max_length=20,
        choices=OPERATION_TYPES,
        verbose_name='操作类型'
    )
    
    old_path = models.CharField(
        max_length=1000,
        blank=True,
        verbose_name='原路径',
        help_text='重命名操作时的原路径'
    )
    
    # 哈希信息
    file_hash = models.CharField(
        max_length=64,
        blank=True,
        verbose_name='文件哈希',
        help_text='SHA-256哈希值'
    )
    
    previous_hash = models.CharField(
        max_length=64,
        blank=True,
        verbose_name='前次哈希',
        help_text='用于检测非预期变动'
    )
    
    hash_changed = models.BooleanField(
        default=False,
        verbose_name='哈希是否改变',
        help_text='用于标识文件内容是否发生变化'
    )
    
    # 风险评估
    risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVELS,
        default='safe',
        verbose_name='风险等级'
    )
    
    risk_score = models.FloatField(
        default=0.0,
        verbose_name='风险分数'
    )
    
    risk_tags = models.JSONField(
        default=list,
        verbose_name='风险标签',
        help_text='如：["executable_file", "script_file"]'
    )
    
    # 校验结果
    verification_triggered = models.BooleanField(
        default=False,
        verbose_name='是否触发校验'
    )
    
    verification_result = models.JSONField(
        default=dict,
        verbose_name='校验结果',
        help_text='四官协同校验的详细结果'
    )
    
    # 用户确认
    user_confirmed = models.BooleanField(
        null=True,
        blank=True,
        verbose_name='用户确认',
        help_text='高风险操作时的用户确认结果'
    )
    
    confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='确认时间'
    )
    
    confirmation_note = models.TextField(
        blank=True,
        verbose_name='确认备注'
    )
    
    # 时间戳
    operation_time = models.DateTimeField(
        default=timezone.now,
        verbose_name='操作时间',
        help_text='文件变动的实际发生时间'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='记录创建时间')
    
    class Meta:
        db_table = 'file_operation_logs'
        ordering = ['-operation_time']
        verbose_name = '文件操作日志'
        verbose_name_plural = '文件操作日志管理'
        indexes = [
            models.Index(fields=['config', '-operation_time'], name='idx_fol_config_time'),
            models.Index(fields=['operation_type'], name='idx_fol_op_type'),
            models.Index(fields=['risk_level'], name='idx_fol_risk'),
            models.Index(fields=['file_hash'], name='idx_fol_hash'),
        ]
    
    def __str__(self):
        return f"{self.get_operation_type_display()}: {self.file_name}"


class FileHashRecord(models.Model):
    """
    文件哈希记录
    
    存储文件的哈希历史，用于检测非预期变动
    """
    
    config = models.ForeignKey(
        FileWatchConfig,
        on_delete=models.CASCADE,
        related_name='hash_records',
        verbose_name='监控配置'
    )
    
    file_path = models.CharField(
        max_length=1000,
        verbose_name='文件路径'
    )
    
    file_hash = models.CharField(
        max_length=64,
        verbose_name='文件哈希(SHA-256)'
    )
    
    file_size = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name='文件大小(字节)'
    )
    
    # 版本信息
    version = models.IntegerField(
        default=1,
        verbose_name='版本号',
        help_text='同一文件的哈希更新次数'
    )
    
    # 状态
    is_current = models.BooleanField(
        default=True,
        verbose_name='是否为当前版本',
        help_text='只有最新版本的is_current为True'
    )
    
    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        db_table = 'file_hash_records'
        ordering = ['-created_at']
        verbose_name = '文件哈希记录'
        verbose_name_plural = '文件哈希记录管理'
        indexes = [
            models.Index(fields=['file_path', '-created_at'], name='idx_fhr_path_time'),
            models.Index(fields=['file_hash'], name='idx_fhr_hash'),
            models.Index(fields=['is_current'], name='idx_fhr_current'),
        ]
    
    def __str__(self):
        return f"{self.file_path} v{self.version}"


class FileRiskAssessment(models.Model):
    """
    文件风险评估
    
    存储四官协同校验的详细结果
    """
    
    # 关联操作日志
    operation_log = models.OneToOneField(
        FileOperationLog,
        on_delete=models.CASCADE,
        related_name='risk_assessment',
        verbose_name='操作日志'
    )
    
    # 四官协同校验结果
    identity_check = models.JSONField(
        default=dict,
        verbose_name='身份官检查结果',
        help_text='验证用户身份、权限'
    )
    
    risk_check = models.JSONField(
        default=dict,
        verbose_name='风险官检查结果',
        help_text='评估文件风险'
    )
    
    verification_check = models.JSONField(
        default=dict,
        verbose_name='验证官检查结果',
        help_text='二次确认机制'
    )
    
    decision_check = models.JSONField(
        default=dict,
        verbose_name='决策官检查结果',
        help_text='最终决策'
    )
    
    # 综合评估
    overall_score = models.FloatField(
        default=0.0,
        verbose_name='综合评分'
    )
    
    overall_risk_level = models.CharField(
        max_length=20,
        choices=FileOperationLog.RISK_LEVELS,
        default='safe',
        verbose_name='综合风险等级'
    )
    
    # 建议
    recommendations = models.JSONField(
        default=list,
        verbose_name='安全建议',
        help_text='如：["建议隔离文件", "建议重新审核"]'
    )
    
    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        db_table = 'file_risk_assessments'
        ordering = ['-created_at']
        verbose_name = '文件风险评估'
        verbose_name_plural = '文件风险评估管理'
    
    def __str__(self):
        return f"风险评估: {self.operation_log.file_name} - {self.get_overall_risk_level_display()}"
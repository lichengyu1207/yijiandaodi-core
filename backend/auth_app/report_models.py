"""
报告生成系统 - 三份报告交付模型

报告类型：
1. 创作时间线报告 (timeline) - 记录创作过程、时间戳证据链
2. 素材风险报告 (material_risk) - 图片AI生成概率、版权风险评估
3. 账号资产报告 (account_asset) - 校验历史、安全积分、行为图谱
"""

from django.db import models
from django.conf import settings
import uuid


class UserReport(models.Model):
    """用户报告"""
    
    REPORT_TYPES = [
        ('timeline', '创作时间线报告'),
        ('material_risk', '素材风险报告'),
        ('account_asset', '账号资产报告'),
        ('full', '综合报告（三合一）'),
    ]
    
    REPORT_STATUS = [
        ('pending', '生成中'),
        ('completed', '已完成'),
        ('failed', '生成失败'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reports')
    
    # 报告基本信息
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES, verbose_name='报告类型')
    title = models.CharField(max_length=200, verbose_name='报告标题')
    status = models.CharField(max_length=20, choices=REPORT_STATUS, default='pending', verbose_name='状态')
    
    # 报告内容
    summary = models.TextField(default='', verbose_name='报告摘要')
    data = models.JSONField(default=dict, verbose_name='报告数据')
    
    # 时间范围
    start_date = models.DateTimeField(null=True, blank=True, verbose_name='统计开始时间')
    end_date = models.DateTimeField(null=True, blank=True, verbose_name='统计结束时间')
    
    # 统计数据
    total_checks = models.IntegerField(default=0, verbose_name='检测总数')
    total_risks = models.IntegerField(default=0, verbose_name='风险总数')
    safety_score = models.FloatField(default=0.0, verbose_name='安全评分')
    
    # 文件信息
    file_path = models.CharField(max_length=500, default='', verbose_name='文件路径')
    file_size = models.IntegerField(default=0, verbose_name='文件大小(bytes)')
    
    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        db_table = 'user_report'
        ordering = ['-created_at']
        verbose_name = '用户报告'
        verbose_name_plural = '用户报告'
    
    def __str__(self):
        return f'{self.user.username} - {self.get_report_type_display()} - {self.created_at.strftime("%Y-%m-%d")}'


class CreationTimeline(models.Model):
    """创作时间线事件"""
    
    EVENT_TYPES = [
        ('content_create', '内容创作'),
        ('content_edit', '内容编辑'),
        ('content_detect', '内容检测'),
        ('image_upload', '图片上传'),
        ('image_detect', '图片检测'),
        ('evidence_save', '证据存证'),
        ('report_export', '报告导出'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='timeline_events')
    report = models.ForeignKey(UserReport, on_delete=models.CASCADE, related_name='timeline_events', null=True)
    
    # 事件信息
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES, verbose_name='事件类型')
    event_title = models.CharField(max_length=200, verbose_name='事件标题')
    event_description = models.TextField(default='', verbose_name='事件描述')
    
    # 关联数据
    session_id = models.CharField(max_length=64, default='', verbose_name='会话ID')
    content_hash = models.CharField(max_length=64, default='', verbose_name='内容哈希')
    
    # 证据信息
    evidence_hash = models.CharField(max_length=128, default='', verbose_name='证据哈希')
    evidence_timestamp = models.DateTimeField(null=True, blank=True, verbose_name='证据时间戳')
    
    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        db_table = 'creation_timeline'
        ordering = ['-created_at']
        verbose_name = '创作时间线'
        verbose_name_plural = '创作时间线'
    
    def __str__(self):
        return f'{self.user.username} - {self.get_event_type_display()} - {self.created_at.strftime("%Y-%m-%d %H:%M")}'


class MaterialRiskRecord(models.Model):
    """素材风险记录"""
    
    RISK_LEVELS = [
        ('safe', '安全'),
        ('warning', '低风险'),
        ('danger', '高风险'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='material_risks')
    report = models.ForeignKey(UserReport, on_delete=models.CASCADE, related_name='material_risks', null=True)
    
    # 素材信息
    material_name = models.CharField(max_length=200, verbose_name='素材名称')
    material_type = models.CharField(max_length=50, default='image', verbose_name='素材类型')
    material_hash = models.CharField(max_length=64, default='', verbose_name='素材哈希')
    
    # AI生成检测
    ai_probability = models.FloatField(default=0.0, verbose_name='AI生成概率')
    confidence = models.FloatField(default=0.0, verbose_name='置信度')
    is_ai_generated = models.BooleanField(default=False, verbose_name='是否AI生成')
    
    # 风险评估
    risk_level = models.CharField(max_length=20, choices=RISK_LEVELS, default='safe', verbose_name='风险等级')
    risk_score = models.FloatField(default=0.0, verbose_name='风险评分')
    risk_factors = models.JSONField(default=list, verbose_name='风险因素')
    
    # 版权信息
    copyright_status = models.CharField(max_length=50, default='unknown', verbose_name='版权状态')
    license_type = models.CharField(max_length=50, default='', verbose_name='许可证类型')
    
    # 存证信息
    evidence_hash = models.CharField(max_length=128, default='', verbose_name='存证哈希')
    evidence_timestamp = models.DateTimeField(null=True, blank=True, verbose_name='存证时间')
    
    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        db_table = 'material_risk_record'
        ordering = ['-created_at']
        verbose_name = '素材风险记录'
        verbose_name_plural = '素材风险记录'
    
    def __str__(self):
        return f'{self.material_name} - {self.get_risk_level_display()} - {self.ai_probability}%'


class AccountAsset(models.Model):
    """账号资产"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='account_asset')
    
    # 安全积分
    safety_points = models.IntegerField(default=0, verbose_name='安全积分')
    trust_score = models.FloatField(default=0.0, verbose_name='信任评分')
    
    # 校验统计
    total_checks = models.IntegerField(default=0, verbose_name='检测总数')
    text_checks = models.IntegerField(default=0, verbose_name='文本检测数')
    image_checks = models.IntegerField(default=0, verbose_name='图片检测数')
    marketing_checks = models.IntegerField(default=0, verbose_name='营销文案检测数')
    
    # 风险统计
    total_risks = models.IntegerField(default=0, verbose_name='风险总数')
    high_risks = models.IntegerField(default=0, verbose_name='高风险数')
    medium_risks = models.IntegerField(default=0, verbose_name='中风险数')
    low_risks = models.IntegerField(default=0, verbose_name='低风险数')
    
    # 存证统计
    total_evidences = models.IntegerField(default=0, verbose_name='存证总数')
    evidence_chain_length = models.IntegerField(default=0, verbose_name='证据链长度')
    
    # 行为图谱
    behavior_graph = models.JSONField(default=dict, verbose_name='行为图谱')
    
    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        db_table = 'account_asset'
        verbose_name = '账号资产'
        verbose_name_plural = '账号资产'
    
    def __str__(self):
        return f'{self.user.username} - 安全积分: {self.safety_points}'
    
    def update_from_checks(self):
        """从检测记录更新统计"""
        from .agent_models import AgentSession
        from datetime import timedelta
        from django.utils import timezone
        
        # 统计检测数
        sessions = AgentSession.objects.filter(user=self.user)
        self.total_checks = sessions.count()
        
        # 按场景统计
        self.text_checks = sessions.filter(scenario='text').count()
        self.image_checks = sessions.filter(scenario='image').count()
        self.marketing_checks = sessions.filter(scenario='marketing').count()
        
        # 计算安全积分（每次检测+1，安全结果+2，高风险-5）
        self.safety_points = self.total_checks
        # TODO: 根据检测结果调整积分
        
        # 更新信任评分
        if self.total_checks > 0:
            safe_ratio = (self.total_checks - self.total_risks) / self.total_checks
            self.trust_score = safe_ratio * 100
        
        self.save()
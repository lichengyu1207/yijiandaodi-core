from django.db import models
from django.contrib.auth.models import User


class SkillConfig(models.Model):
    TIER_CHOICES = [
        ('core', '核心鉴别场景'),
        ('security', '安全融合层'),
        ('product', '产品融合层'),
        ('vertical', '垂直场景层'),
        ('monetization', '变现生态层'),
        ('multilingual', '多语言蓝海层'),
        ('professional', '专业领域层'),
        ('special', '特殊内容层'),
        ('compliance', '合规审计层'),
        ('ai-detect', 'AI检测同行层'),
        ('content-security', '内容安全同行层'),
        ('ai-governance', 'AI治理同行层'),
        ('vertical-peer', '垂直场景同行层'),
        ('infoflow-detect', '信息流检测层'),
        ('traffic-optimize', '流量优化层'),
        ('infoflow-compliance', '信息流合规层'),
        ('multimodal-infoflow', '多模态信息流层'),
        ('context-understanding', '上下文理解层'),
        ('long-conversation', '长对话管理层'),
        ('context-risk-control', '上下文风控层'),
        ('vertical-context', '垂直上下文层'),
        ('retrieval-system', '检索系统层'),
        ('cluster-management', '集群管理层'),
        ('file-operation', '文件操作层'),
        ('voice-input', '语音输入层'),
        ('general-agent', '通用Agent层'),
        ('enterprise-agent', '企业Agent层'),
        ('vertical-agent', '垂直Agent层'),
        ('multi-agent-collab', '多Agent协作层'),
    ]

    MONETIZATION_CHOICES = [
        ('free+pay', '免费基础+按次付费'),
        ('member+pay', '会员免费+按次付费'),
        ('pay+enterprise', '按次付费+企业定制'),
        ('enterprise', '企业定制'),
        ('free', '完全免费'),
    ]

    STATUS_CHOICES = [
        ('online', '上线'),
        ('offline', '下线'),
        ('beta', '内测'),
        ('coming_soon', '即将上线'),
    ]

    id = models.AutoField(primary_key=True)
    name = models.CharField('功能名称', max_length=100)
    category = models.CharField('功能分类', max_length=50)
    main_scenario = models.CharField('对应主场景', max_length=50)
    keywords = models.JSONField('Prompt关键词', default=list)
    weight = models.PositiveSmallIntegerField('推荐权重', default=10)
    dev_days = models.PositiveSmallIntegerField('开发周期(天)', default=3)
    monetization_type = models.CharField('变现类型', max_length=30, choices=MONETIZATION_CHOICES, default='free+pay')
    tier = models.CharField('所属层级', max_length=30, choices=TIER_CHOICES, default='core')
    icon_name = models.CharField('图标名称', max_length=30, default='Zap')
    icon_color = models.CharField('图标颜色', max_length=7, default='#165DFF')
    description = models.CharField('功能描述', max_length=200, blank=True, default='')
    api_endpoint = models.CharField('API端点', max_length=200, blank=True, default='', help_text='对应的后端API路径')
    target_product = models.CharField('对标产品', max_length=50, blank=True, default='', help_text='对标的产品名称')
    status = models.CharField('状态', max_length=15, choices=STATUS_CHOICES, default='online')
    sort_order = models.IntegerField('排序顺序', default=0)
    is_recommended = models.BooleanField('是否推荐', default=False)
    is_hot = models.BooleanField('是否热门', default=False)
    is_new = models.BooleanField('是否新上线', default=True)
    usage_count = models.PositiveIntegerField('使用次数', default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'system_skill_config'
        verbose_name = '技能配置'
        verbose_name_plural = verbose_name
        ordering = ['-weight', '-sort_order', 'id']

    def __str__(self):
        return f'#{self.id} {self.name}'

from django.db import models
from django.conf import settings

ICON_CHOICES = [
    ('Shield', '盾牌'),
    ('Image', '图片'),
    ('Link', '链接'),
    ('FileSearch', '文件搜索'),
    ('ScanLine', '扫描'),
    ('Lock', '锁'),
    ('Eye', '眼睛'),
    ('Code', '代码'),
    ('Database', '数据库'),
    ('Globe', '地球'),
    ('AlertTriangle', '警告'),
    ('CheckCircle', '检查'),
    ('Zap', '闪电'),
    ('Cpu', '处理器'),
    ('Fingerprint', '指纹'),
    ('Key', '密钥'),
    ('Wifi', '网络'),
    ('Mail', '邮件'),
    ('Users', '用户'),
    ('Settings', '设置'),
]

COLOR_PRESETS = [
    ('#165DFF', '品牌蓝'),
    ('#00B42A', '成功绿'),
    ('#FF7D00', '警告橙'),
    ('#F53F3F', '错误红'),
    ('#722ED1', '科技紫'),
    ('#0FC6C2', '青色'),
    ('#F7BA1E', '金黄'),
    ('#86909C', '中性灰'),
]


class FunctionCard(models.Model):
    STATUS_CHOICES = [
        ('online', '上线'),
        ('offline', '下线'),
    ]

    name = models.CharField(max_length=100, verbose_name='功能名称', db_index=True)
    icon = models.CharField(max_length=30, choices=ICON_CHOICES, default='Shield', verbose_name='图标')
    icon_color = models.CharField(max_length=10, choices=COLOR_PRESETS, default='#165DFF', verbose_name='图标颜色')
    description = models.CharField(max_length=200, verbose_name='功能简介')
    prompt_template = models.TextField(blank=True, default='', verbose_name='场景Prompt模板')
    knowledge_base = models.ForeignKey(
        'content_app.KnowledgeBaseCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='function_cards',
        verbose_name='关联知识库'
    )
    sort_order = models.IntegerField(default=0, verbose_name='排序值(越小越前)')
    weight = models.IntegerField(default=100, verbose_name='推荐权重(越高越推荐)')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='online', verbose_name='状态')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'system_function_card'
        verbose_name = '功能卡片'
        verbose_name_plural = '功能卡片管理'
        ordering = ['sort_order', '-weight']

    def __str__(self):
        return self.name

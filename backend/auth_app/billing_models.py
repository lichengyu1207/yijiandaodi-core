"""
AI 调用计费落库模型（P1-2 计费落库）
每次 DeepSeek 调用成功后记录 tokens/cost/model，供 cost-breakdown 与消费趋势分析使用。
"""
from decimal import Decimal

from django.db import models


class APICallLog(models.Model):
    """AI 调用计费记录

    对应需求 4.2.1：每次分析调用产生一条可查询的计费记录
    { tokens, cost, model, timestamp, userId, runId }
    """

    STATUS_CHOICES = [
        ('success', '成功'),
        ('error', '失败'),
    ]

    user_id = models.IntegerField('用户ID', null=True, blank=True, db_index=True)
    run_id = models.CharField('调用ID', max_length=64, db_index=True)
    scenario = models.CharField('场景', max_length=64, blank=True, default='')
    provider = models.CharField('提供商', max_length=32, default='deepseek')
    model = models.CharField('模型', max_length=64, blank=True, default='')

    # token 与费用
    input_tokens = models.IntegerField('输入tokens', default=0)
    output_tokens = models.IntegerField('输出tokens', default=0)
    total_tokens = models.IntegerField('总tokens', default=0)
    cost = models.DecimalField('费用(元)', max_digits=12, decimal_places=6, default=Decimal('0'))

    # 状态
    status = models.CharField('状态', max_length=16, choices=STATUS_CHOICES, default='success', db_index=True)
    error_message = models.TextField('错误信息', blank=True, default='')

    created_at = models.DateTimeField('时间', auto_now_add=True, db_index=True)

    class Meta:
        app_label = 'auth_app'
        db_table = 'auth_app_api_call_log'
        verbose_name = 'AI调用计费记录'
        verbose_name_plural = 'AI调用计费记录'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.model} {self.total_tokens}tokens ¥{self.cost} ({self.run_id})"

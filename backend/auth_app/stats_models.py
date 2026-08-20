from django.db import models
from django.conf import settings


class DailyPlatformStats(models.Model):
    id = models.BigAutoField(primary_key=True)
    date = models.DateField('\u65e5\u671f', unique=True, db_index=True)

    dau = models.PositiveIntegerField('DAU(\u6d3b\u8dc3\u7528\u6237)', default=0)
    wau = models.PositiveIntegerField('WAU(\u5468\u6d3b)', default=0)
    mau = models.PositiveIntegerField('MAU(\u6708\u6d3b)', default=0)

    new_users = models.PositiveIntegerField('\u65b0\u6ce8\u518c', default=0)
    total_users = models.PositiveIntegerField('\u7d2f\u8ba1\u7528\u6237', default=0)

    total_sessions = models.PositiveIntegerField('\u603b\u4f1a\u8bdd\u6570', default=0)
    avg_session_duration = models.PositiveIntegerField('\u5e73\u5747\u4f1a\u8bdd\u957f\u5ea6(s)', default=0)

    total_clicks = models.PositiveIntegerField('\u603b\u70b9\u51fb', default=0)
    total_executions = models.PositiveIntegerField('\u603b\u6267\u884c', default=0)
    total_shares = models.PositiveIntegerField('\u5206\u4eab', default=0)

    free_uses = models.PositiveIntegerField('\u514d\u8d39\u4f7f\u7528', default=0)
    paid_uses = models.PositiveIntegerField('\u4ed8\u8d39\u4f7f\u7528', default=0)
    conversion_rate = models.FloatField('\u4ed8\u8d39\u8f6c\u5316\u7387(%)', default=0.0)

    revenue = models.DecimalField('\u8425\u6536(\u5143)', max_digits=14, decimal_places=2, default=0)
    avg_revenue_per_user = models.DecimalField('ARPU(\u5143)', max_digits=10, decimal_places=2, default=0)

    retention_d1 = models.FloatField('\u6b21\u7559\u5b58(%)', default=0.0)
    retention_d7 = models.FloatField('7\u65e5\u7559\u5b58(%)', default=0.0)
    retention_d30 = models.FloatField('30\u65e5\u7559\u5b58(%)', default=0.0)

    extra_data = models.JSONField('\u6269\u5c55\u6570\u636e', default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'daily_platform_stats'
        verbose_name = '\u65e5\u5e73\u53f0\u7edf\u8ba1'
        verbose_name_plural = verbose_name
        ordering = ['-date']

    def __str__(self):
        return f'{self.date} DAU={self.dau}'


class SkillDailyStats(models.Model):
    id = models.BigAutoField(primary_key=True)
    date = models.DateField('\u65e5\u671f', db_index=True)
    skill_id = models.PositiveIntegerField('\u6280\u80fdID', db_index=True)
    skill_name = models.CharField('\u6280\u80fd\u540d\u79f0', max_length=100, default='')
    skill_tier = models.CharField('\u5c5e\u6027', max_length=50, default='')
    skill_category = models.CharField('\u5206\u7c7b', max_length=50, default='')

    impressions = models.PositiveIntegerField('\u66dd\u5149\u91cf', default=0)
    clicks = models.PositiveIntegerField('\u70b9\u51fb\u91cf', default=0)
    executions = models.PositiveIntegerField('\u4f7f\u7528\u91cf', default=0)
    shares = models.PositiveIntegerField('\u5206\u4eab\u91cf', default=0)

    click_rate = models.FloatField('\u70b9\u51fb\u7387(%)', default=0.0)
    execution_rate = models.FloatField('\u4f7f\u7528\u7387(%)', default=0.0)
    conversion_rate = models.FloatField('\u4ed8\u8d39\u8f6c\u5316\u7387(%)', default=0.0)

    hotness = models.FloatField('\u70ed\u5ea6\u503c', default=0.0)
    rank = models.PositiveIntegerField('\u6392\u540d', null=True, blank=True)
    revenue = models.DecimalField('\u8425\u6536(\u5143)', max_digits=10, decimal_places=2, default=0)

    class Meta:
        db_table = 'skill_daily_stats'
        verbose_name = '\u6280\u80fd\u65e5\u7edf\u8ba1'
        verbose_name_plural = verbose_name
        ordering = ['-date', '-clicks']
        indexes = [
            models.Index(fields=['date', 'skill_id'], name='idx_date_skill'),
            models.Index(fields=['date', '-clicks'], name='idx_date_clicks'),
            models.Index(fields=['date', 'skill_category'], name='idx_date_cat'),
            models.Index(fields=['date', 'skill_tier'], name='idx_date_tier'),
        ]

    def __str__(self):
        return f'{self.date} {self.skill_name[:20]} clicks={self.clicks}'


class AreaClickStats(models.Model):
    AREA_TYPE_CHOICES = [
        ('carousel', '\u8f6e\u64ad\u533a(Top9)'),
        ('recommendation', '\u4e3a\u4f60\u63a8\u8350'),
        ('new_for_you', '\u65b0\u54c1\u4e13\u533a'),
        ('promo_feed', '\u63a8\u5e7f\u4fe1\u606f\u6d41'),
        ('article_cta', '\u6587\u7ae0CTA'),
        ('skill_grid', '\u6280\u80fd\u7f51\u683c'),
        ('search_result', '\u641c\u7d22\u7ed3\u679c'),
        ('hot_skills_list', '\u70ed\u95e8\u5217\u8868'),
    ]

    id = models.BigAutoField(primary_key=True)
    date = models.DateField('\u65e5\u671f', db_index=True)
    area_type = models.CharField('\u533a\u57df\u7c7b\u578b', max_length=25, choices=AREA_TYPE_CHOICES, db_index=True)

    impressions = models.PositiveIntegerField('\u66dd\u5149\u91cf', default=0)
    clicks = models.PositiveIntegerField('\u70b9\u51fb\u91cf', default=0)
    unique_visitors = models.PositiveIntegerField('UV', default=0)

    click_rate = models.FloatField('\u70b9\u51fb\u7387(%)', default=0.0)
    avg_position = models.FloatField('\u5e73\u5747\u70b9\u51fb\u4f4d\u7f6e', default=0.0)

    top_clicked_item_id = models.CharField('\u70ed\u95e8\u70b9\u51fb\u9879ID', max_length=50, default='')
    top_clicked_item_name = models.CharField('\u70ed\u95e8\u70b9\u51fb\u9879\u540d', max_length=100, default='')
    top_item_clicks = models.PositiveIntegerField('\u70ed\u95e8\u9879\u70b9\u51fb\u6570', default=0)

    extra_data = models.JSONField('\u6269\u5c55\u6570\u636e', default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'area_click_stats'
        verbose_name = '\u533a\u57df\u70b9\u51fb\u7edf\u8ba1'
        verbose_name_plural = verbose_name
        ordering = ['-date', 'area_type']
        indexes = [
            models.Index(fields=['date', 'area_type'], name='idx_date_area'),
        ]

    def __str__(self):
        return f'{self.date} {self.area_type} CTR={self.click_rate}%'


class RevenueDailyStats(models.Model):
    id = models.BigAutoField(primary_key=True)
    date = models.DateField('\u65e5\u671f', unique=True, db_index=True)

    gross_revenue = models.DecimalField('\u603b\u8425\u6536(\u5143)', max_digits=14, decimal_places=2, default=0)
    net_revenue = models.DecimalField('\u51c0\u8425\u6536(\u5143)', max_digits=14, decimal_places=2, default=0)
    refund_amount = models.DecimalField('\u9000\u6b3e\u91d1\u989d(\u5143)', max_digits=12, decimal_places=2, default=0)

    order_count = models.PositiveIntegerField('\u8ba2\u5355\u6570', default=0)
    paid_order_count = models.PositiveIntegerField('\u5df2\u4ed8\u6b3e\u8ba2\u5355', default=0)
    refund_order_count = models.PositiveIntegerField('\u9000\u6b3e\u8ba2\u5355', default=0)

    avg_order_value = models.DecimalField('\u5e73\u5747\u8ba2\u5355\u989d(\u5143)', max_digits=10, decimal_places=2, default=0)
    conversion_rate = models.FloatField('\u6574\u4f53\u8f6c\u5316\u7387(%)', default=0.0)

    per_use_orders = models.PositiveIntegerField('\u6309\u6b21\u8ba2\u5355', default=0)
    monthly_orders = models.PositiveIntegerField('\u6708\u5456\u8ba2\u5355', default=0)
    yearly_199_orders = models.PositiveIntegerField('199\u5e74\u5361\u8ba2\u5355', default=0)
    yearly_599_orders = models.PositiveIntegerField('599\u5e74\u5361\u8ba2\u5355', default=0)
    enterprise_orders = models.PositiveIntegerField('\u4f01\u4e1a\u8ba2\u5355', default=0)
    combo_security_orders = models.PositiveIntegerField('\u5b89\u5168\u5957\u9910\u8ba2\u5355', default=0)
    combo_content_orders = models.PositiveIntegerField('\u5185\u5bb9\u5957\u9910\u8ba2\u5355', default=0)
    combo_enterprise_orders = models.PositiveIntegerField('\u4f01\u4e1a\u5168\u666f\u8ba2\u5355', default=0)

    commission_paid = models.DecimalField('\u5df2\u652f\u4ed8\u4f63\u91d1(\u5143)', max_digits=12, decimal_places=2, default=0)
    affiliate_revenue = models.DecimalField('\u5206\u9500\u8425\u6536(\u5143)', max_digits=12, decimal_places=2, default=0)

    vip_active_count = models.PositiveIntegerField('VIP\u6d3b\u8dc3\u6570', default=0)
    new_vip_count = models.PositiveIntegerField('\u65b0\u589eVIP', default=0)
    vip_renewal_count = models.PositiveIntegerField('VIP\u7eed\u8d39', default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'revenue_daily_stats'
        verbose_name = '\u8425\u6536\u65e5\u7edf\u8ba1'
        verbose_name_plural = verbose_name
        ordering = ['-date']

    def __str__(self):
        return f'{self.date} \u00a5{self.gross_revenue}'


class HourlyRegionStats(models.Model):
    """每小时区域监控聚合（P2 统计二期：区域热力图数据源）。

    由 GET /api/stats/hourly 实时聚合 APIKeyUsageLog 后 upsert，
    保留最近一次聚合结果供离线读取/审计。
    字段按需求 §3.2.3：hour / region / total_cost / call_count / error_count / avg_latency。
    """

    REGION_CHOICES = [
        ('cn', '\u4e2d\u56fd\u5927\u9646'),
        ('us', '\u5317\u7f8e'),
        ('eu', '\u6b27\u6d32'),
        ('all', '\u5176\u4ed6/\u5168\u5c40'),
    ]

    id = models.BigAutoField(primary_key=True)
    hour = models.DateTimeField('\u5c0f\u65f6', db_index=True)
    region = models.CharField('\u533a\u57df', max_length=10, choices=REGION_CHOICES, default='all', db_index=True)

    total_cost = models.DecimalField('\u6d88\u8017\u989d\u5ea6(\u5143)', max_digits=14, decimal_places=6, default=0)
    call_count = models.PositiveIntegerField('\u8c03\u7528\u6b21\u6570', default=0)
    error_count = models.PositiveIntegerField('\u9519\u8bef\u6b21\u6570', default=0)
    avg_latency = models.PositiveIntegerField('\u5e73\u5747\u8017\u65f6(ms)', default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hourly_region_stats'
        verbose_name = '\u6bcf\u5c0f\u65f6\u533a\u57df\u76d1\u63a7'
        verbose_name_plural = verbose_name
        ordering = ['-hour', 'region']
        indexes = [
            models.Index(fields=['hour', 'region'], name='idx_hour_region'),
        ]

    def __str__(self):
        return f'{self.hour:%Y-%m-%d %H} {self.region} calls={self.call_count}'

from django.db import models
from django.conf import settings
import hashlib


class ABTestExperiment(models.Model):
    STATUS_CHOICES = [
        ('draft', '\u8349\u7a3f'),
        ('running', '\u8fdb\u884c\u4e2d'),
        ('paused', '\u5df2\u6682\u505c'),
        ('completed', '\u5df2\u5b8c\u6210'),
    ]

    id = models.BigAutoField(primary_key=True)
    name = models.CharField('\u5b9e\u9a8c\u540d\u79f0', max_length=100, unique=True)
    description = models.TextField('\u63cf\u8ff0', blank=True, default='')

    test_type = models.CharField('\u6d4b\u8bd5\u7c7b\u578b', max_length=30,
                                  choices=[('rec_strategy', '\u63a8\u8350\u7b56\u7565'), ('promo_card', '\u63a8\u5e7f\u5361\u7247'), ('ui_layout', 'UI\u5e03\u5c40')])
    status = models.CharField('\u72b6\u6001', max_length=15, default='draft', choices=STATUS_CHOICES)

    traffic_allocation = models.PositiveSmallIntegerField('\u6d41\u91cf\u5206\u914d(%)', default=100)
    variants_config = models.JSONField('\u53d8\u4f53\u914d\u7f6e', default=list)

    control_group_pct = models.PositiveSmallIntegerField('\u5bf9\u7167\u7ec4(%)', default=50)
    metric_primary = models.CharField('\u4e3b\u8981\u6307\u6807', max_length=30, default='conversion_rate')
    metric_secondary = models.JSONField('\u6b21\u8981\u6307\u6807', default=list)

    sample_size_target = models.PositiveIntegerField('\u76ee\u6807\u6837\u672c\u6570', default=500)
    confidence_level = models.FloatField('\u7f6e\u4fe1\u5ea6', default=0.95)
    min_detectable_effect = models.FloatField('\u6700\u5c0f\u68c0\u6d4b\u6548\u5e94', default=0.05)

    start_at = models.DateTimeField('\u5f00\u59cb\u65f6\u95f4', null=True, blank=True)
    end_at = models.DateTimeField('\u7ed3\u675f\u65f6\u95f4', null=True, blank=True)
    winner_variant = models.CharField('\u83dc\u80dc\u53d8\u4f53', max_length=50, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ab_test_experiment'
        verbose_name = 'A/B\u6d4b\u8bd5\u5b9e\u9a8c'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} [{self.get_status_display()}]'


class ABTestAssignment(models.Model):
    id = models.BigAutoField(primary_key=True)
    experiment = models.ForeignKey(ABTestExperiment, on_delete=models.CASCADE, related_name='assignments')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='ab_assignments')
    session_id = models.CharField('\u4f1a\u8bddID', max_length=64, db_index=True)
    variant = models.CharField('\u5206\u914d\u53d8\u4f53', max_length=50)
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ab_test_assignment'
        verbose_name = 'A/B\u6d4b\u8bd5\u5206\u914d'
        verbose_name_plural = verbose_name
        indexes = [
            models.Index(fields=['experiment', 'session_id'], name='idx_exp_session'),
            models.Index(fields=['experiment', 'variant'], name='idx_exp_variant'),
        ]


class ABTestEvent(models.Model):
    EVENT_TYPES = [
        ('impression', '\u66dd\u5149'),
        ('click', '\u70b9\u51fb'),
        ('execute', '\u6267\u884c'),
        ('payment_start', '\u5f00\u59cb\u652f\u4ed8'),
        ('payment_complete', '\u652f\u4ed8\u5b8c\u6210'),
        ('share', '\u5206\u4eab'),
        ('time_on_page', '\u9875\u9762\u505c\u7559'),
    ]

    id = models.BigAutoField(primary_key=True)
    experiment = models.ForeignKey(ABTestExperiment, on_delete=models.CASCADE, related_name='events')
    assignment = models.ForeignKey(ABTestAssignment, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField('\u4e8b\u4ef6\u7c7b\u578b', max_length=20, choices=EVENT_TYPES)
    target_id = models.CharField('\u76ee\u6807ID', max_length=50, blank=True, default='')
    value = models.FloatField('\u503c', default=0)
    extra_data = models.JSONField('\u6269\u5c55\u6570\u636e', default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ab_test_event'
        verbose_name = 'A/B\u6d4b\u8bd5\u4e8b\u4ef6'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['experiment', 'assignment', 'event_type'], name='idx_exp_evt'),
        ]


class PromoCardScheduleRule(models.Model):
    USER_SEGMENT_CHOICES = [
        ('all', '\u6240\u6709\u7528\u6237'),
        ('new', '\u65b0\u7528\u6237(<3\u5929)'),
        ('active', '\u6d3b\u8dc3\u7528\u6237'),
        ('vip', 'VIP\u4f1a\u5458'),
        ('non_payer', '\u672a\u4ed8\u8d39'),
        ('high_intent', '\u9ad8\u610f\u56fe'),
    ]

    id = models.BigAutoField(primary_key=True)
    promo_card = models.ForeignKey('auth_app.PromoCard', on_delete=models.CASCADE, related_name='schedule_rules')

    user_segment = models.CharField('\u7528\u6237\u5206\u5c42', max_length=15, default='all', choices=USER_SEGMENT_CHOICES)
    position_priority = models.JSONField('\u4f4d\u7f6e\u4f18\u5148\u7ea7', default=list)
    show_frequency_max = models.PositiveSmallIntegerField('\u6bcf\u65e5\u6700\u591a\u663e\u793a', default=5)
    show_interval_hours = models.PositiveSmallIntegerField('\u95f4\u9694\u5c0f\u65f6\u6570', default=4)
    cooldown_after_click = models.PositiveSmallIntegerField('\u70b9\u51fb\u540e\u51b7\u5374(h)', default=12)

    time_rules = models.JSONField('\u65f6\u95f4\u89c4\u5219', default=dict)
    device_rules = models.JSONField('\u8bbe\u5907\u89c4\u5219', default=dict)
    weight_multiplier = models.FloatField('\u6743\u91cd\u52a0\u6210', default=1.0)

    is_active = models.BooleanField('\u662f\u5426\u542f\u7528', default=True)
    priority_score = models.PositiveSmallIntegerField('\u4f18\u5148\u7ea7', default=50)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'promo_card_schedule_rule'
        verbose_name = '\u63a8\u5e7f\u5361\u7247\u8c03\u5ea6\u89c4\u5219'
        verbose_name_plural = verbose_name
        ordering = ['-priority_score']

    def __str__(self):
        return f'Rule#{self.id} {self.promo_card.title if self.promo_card else "?"} -> {self.user_segment}'


class PromoCardImpressionLog(models.Model):
    id = models.BigAutoField(primary_key=True)
    promo_card = models.ForeignKey('auth_app.PromoCard', on_delete=models.CASCADE, related_name='impression_logs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='promo_impressions')
    session_id = models.CharField('\u4f1a\u8bddID', max_length=64, blank=True, default='')
    position = models.CharField('\u5c55\u793a\u4f4d\u7f6e', max_length=25, blank=True, default='')
    shown_at = models.DateTimeField(auto_now_add=True)
    clicked = models.BooleanField('\u662f\u5426\u70b9\u51fb', default=False)
    clicked_at = models.DateTimeField('\u70b9\u51fb\u65f6\u95f4', null=True, blank=True)
    converted = models.BooleanField('\u662f\u5426\u8f6c\u5316', default=False)

    class Meta:
        db_table = 'promo_card_impression_log'
        verbose_name = '\u63a8\u5e7f\u5361\u7247\u66dd\u5149\u65e5\u5fd7'
        verbose_name_plural = verbose_name
        ordering = ['-shown_at']
        indexes = [
            models.Index(fields=['promo_card', 'user', 'shown_at'], name='idx_promo_user_time'),
            models.Index(fields=['session_id', 'clicked'], name='idx_session_clicked'),
        ]

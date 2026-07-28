from django.db import models


class PromoCard(models.Model):
    CARD_TYPE_CHOICES = [
        ('vip_basic', '基础会员'),
        ('vip_premium', '高级会员'),
        ('vip_enterprise', '企业定制'),
        ('pay_per_use', '按次付费'),
        ('feature_launch', '新功能上线'),
        ('limited_offer', '限时优惠'),
        ('referral', '邀请有礼'),
    ]

    POSITION_CHOICES = [
        ('feed_top', '信息流顶部'),
        ('feed_middle', '信息流中部(每5条)'),
        ('feed_bottom', '信息流底部'),
        ('skill_panel_header', '技能面板头部'),
        ('skill_panel_footer', '技能面板底部'),
        ('sidebar', '侧边栏'),
    ]

    STATUS_CHOICES = [
        ('online', '上线'),
        ('offline', '下线'),
        ('scheduled', '定时上线'),
    ]

    id = models.BigAutoField(primary_key=True)
    title = models.CharField(verbose_name='标题', max_length=100)
    subtitle = models.CharField(verbose_name='副标题', max_length=200, blank=True, default='')
    description = models.TextField(verbose_name='详细描述', blank=True, default='')
    card_type = models.CharField(verbose_name='卡片类型', max_length=30, choices=CARD_TYPE_CHOICES, default='vip_basic')
    position = models.CharField(verbose_name='展示位置', max_length=30, choices=POSITION_CHOICES, default='feed_middle')
    icon_name = models.CharField(verbose_name='图标名称', max_length=30, default='Crown')
    icon_color = models.CharField(verbose_name='图标颜色', max_length=7, default='#F5A623')
    bg_color = models.CharField(verbose_name='背景色', max_length=7, default='#FFF7E8')
    border_color = models.CharField(verbose_name='边框色', max_length=7, default='#FFD666')
    accent_color = models.CharField(verbose_name='强调色', max_length=7, default='#F5A623')
    image_url = models.URLField(verbose_name='封面图URL', blank=True, default='')
    link_url = models.URLField(verbose_name='跳转链接', blank=True, default='')
    button_text = models.CharField(verbose_name='按钮文字', max_length=30, default='立即开通')
    price_text = models.CharField(verbose_name='价格文案', max_length=50, blank=True, default='\u00a59.9/\u6708\u8d77')
    priority = models.PositiveSmallIntegerField(verbose_name='优先级', default=10)
    status = models.CharField(verbose_name='状态', max_length=15, choices=STATUS_CHOICES, default='online')
    show_count_limit = models.PositiveIntegerField(verbose_name='展示次数上限', default=0, help_text='0=\u4e0d\u9650')
    click_count = models.PositiveIntegerField(verbose_name='点击次数', default=0)
    conversion_count = models.PositiveIntegerField(verbose_name='转化次数', default=0)
    target_user_type = models.CharField(
        verbose_name='\u76ee\u6807\u7528\u6237',
        max_length=20,
        blank=True,
        default='',
        help_text='all/free_user/vip/non_vip/active/inactive'
    )
    start_time = models.DateTimeField(verbose_name='\u5f00\u59cb\u65f6\u95f4', null=True, blank=True)
    end_time = models.DateTimeField(verbose_name='\u7ed3\u675f\u65f6\u95f4', null=True, blank=True)
    extra_config = models.JSONField(verbose_name='\u6269\u5c55\u914d\u7f6e', default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'promo_card_config'
        verbose_name = '\u63a8\u5e7f\u5361\u7247\u914d\u7f6e'
        verbose_name_plural = verbose_name
        ordering = ['-priority', '-id']

    def __str__(self):
        return '[' + self.get_card_type_display() + '] ' + self.title

    @property
    def is_active(self):
        from django.utils import timezone
        now = timezone.now()
        if self.status != 'online':
            return False
        if self.start_time and now < self.start_time:
            return False
        if self.end_time and now > self.end_time:
            return False
        if self.show_count_limit > 0 and self.click_count >= self.show_count_limit:
            return False
        return True

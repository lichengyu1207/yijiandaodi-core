from django.db import models
from django.conf import settings


class Category(models.Model):
    name = models.CharField(max_length=100, verbose_name='名称')
    slug = models.SlugField(max_length=100, unique=True, verbose_name='URL标识')
    icon = models.CharField(max_length=50, default='folder', verbose_name='图标')
    description = models.TextField(blank=True, default='', verbose_name='描述')
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'content_category'
        verbose_name = '分类'
        verbose_name_plural = '分类'
        ordering = ['sort_order', '-created_at']

    def __str__(self):
        return self.name


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True, verbose_name='标签名')
    slug = models.SlugField(max_length=50, unique=True, verbose_name='URL标识')

    class Meta:
        db_table = 'content_tag'
        verbose_name = '标签'
        verbose_name_plural = '标签'

    def __str__(self):
        return self.name


class FrontAuthor(models.Model):
    name = models.CharField(max_length=100, verbose_name='名称')
    avatar = models.URLField(blank=True, default='', verbose_name='头像')
    bio = models.TextField(blank=True, default='', verbose_name='简介')
    email = models.EmailField(blank=True, default='', verbose_name='邮箱')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'content_author'
        verbose_name = '作者'
        verbose_name_plural = '作者'

    def __str__(self):
        return self.name


class Article(models.Model):
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('published', '已发布'),
        ('archived', '已归档'),
    ]

    title = models.CharField(max_length=500, verbose_name='标题')
    summary = models.TextField(blank=True, default='', verbose_name='摘要')
    content = models.TextField(verbose_name='内容（Markdown）', default='')
    cover_image = models.URLField(blank=True, default='', verbose_name='封面图')
    gallery_images = models.JSONField(
        blank=True,
        default=list,
        verbose_name='多图列表',
        help_text='信息流三图模式，最多3张图片URL列表，如 ["url1", "url2", "url3"]'
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='articles',
        verbose_name='分类'
    )
    author = models.ForeignKey(
        FrontAuthor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='articles',
        verbose_name='作者'
    )
    tags = models.ManyToManyField(Tag, through='ArticleTag', blank=True, verbose_name='标签')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='状态')

    read_count = models.IntegerField(default=0, verbose_name='阅读量')
    like_count = models.IntegerField(default=0, verbose_name='点赞数')
    comment_count = models.IntegerField(default=0, verbose_name='评论数')
    favorite_count = models.IntegerField(default=0, verbose_name='收藏数')

    is_recommended = models.BooleanField(default=False, verbose_name='是否推荐')

    XINFA_TAG_CHOICES = [
        ('industry_insight', '行业认知洞察'),
        ('ai_security_pitfall', 'AI安全避坑'),
        ('compute_cost', '算力成本拆解'),
        ('startup_review', '项目创业复盘'),
        ('qa_qa', '赛道问答解惑'),
        ('beginner_guide', '新手入门指南'),
        ('architecture_inside', '架构干货内幕'),
        ('', '无'),
    ]

    ZONE_ID_CHOICES = [
        ('industry', '行业洞察区'),
        ('security', '安全避坑区'),
        ('compute', '算力成本区'),
        ('startup', '创业复盘区'),
        ('qa', '问答解惑区'),
        ('guide', '入门指南区'),
        ('inside', '架构内幕区'),
        ('', '默认'),
    ]

    xinfa_tag = models.CharField(
        max_length=20, choices=XINFA_TAG_CHOICES, blank=True, default='',
        verbose_name='心法标签', help_text='Agent避坑/开发保命/企业合规/踩坑实录'
    )
    is_pinned = models.BooleanField(default=False, verbose_name='是否精选置顶')
    zone_id = models.CharField(
        max_length=20, choices=ZONE_ID_CHOICES, blank=True, default='',
        verbose_name='Agent专区', help_text='个人开发者/企业部署/多智能体/真实踩坑'
    )
    hook_line = models.TextField(blank=True, default='', verbose_name='扎心钩子')
    real_case_title = models.CharField(max_length=300, blank=True, default='', verbose_name='案例标题')
    cta_text = models.CharField(max_length=100, blank=True, default='', verbose_name='CTA文字')
    cta_link = models.URLField(blank=True, default='', verbose_name='CTA链接')

    published_at = models.DateTimeField(null=True, blank=True, verbose_name='发布时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'content_article'
        verbose_name = '文章'
        verbose_name_plural = '文章'
        ordering = ['-published_at', '-created_at']
        indexes = [
            models.Index(fields=['status'], name='idx_article_status'),
            models.Index(fields=['-published_at'], name='idx_article_published'),
            models.Index(fields=['-read_count'], name='idx_article_read_count'),
            models.Index(fields=['category'], name='idx_article_category'),
            models.Index(fields=['xinfa_tag'], name='idx_article_xinfa_tag'),
            models.Index(fields=['is_pinned'], name='idx_article_is_pinned'),
            models.Index(fields=['zone_id'], name='idx_article_zone_id'),
        ]

    def __str__(self):
        return self.title


class ArticleTag(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='article_tags')
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name='tag_articles')

    class Meta:
        db_table = 'content_article_tag'
        unique_together = [['article', 'tag']]


class ArticleLike(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='likes', verbose_name='文章')
    user_id = models.IntegerField(verbose_name='用户ID')
    ip_address = models.GenericIPAddressField(default='', verbose_name='IP地址')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='点赞时间')

    class Meta:
        db_table = 'content_article_like'
        verbose_name = '文章点赞'
        verbose_name_plural = '文章点赞'
        unique_together = [['article', 'user_id', 'ip_address']]

    def __str__(self):
        return f'{self.article.title} - 用户{self.user_id}'


class ArticleComment(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='comments', verbose_name='文章')
    user_id = models.IntegerField(default=0, verbose_name='用户ID')
    username = models.CharField(max_length=50, default='匿名用户', verbose_name='用户名')
    avatar = models.URLField(default='', verbose_name='头像')
    content = models.TextField(verbose_name='评论内容')
    parent_comment = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies', verbose_name='父评论')
    ip_address = models.GenericIPAddressField(default='', verbose_name='IP地址')
    is_approved = models.BooleanField(default=True, verbose_name='是否审核通过')
    like_count = models.IntegerField(default=0, verbose_name='点赞数')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='评论时间')

    class Meta:
        db_table = 'content_article_comment'
        verbose_name = '文章评论'
        verbose_name_plural = '文章评论'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['article', '-created_at'], name='idx_comment_article_time'),
            models.Index(fields=['is_approved'], name='idx_comment_approved'),
        ]

    def __str__(self):
        return f'评论-{self.id}: {self.content[:20]}'


class UserFollow(models.Model):
    user_id = models.IntegerField(verbose_name='用户ID')
    author = models.ForeignKey(FrontAuthor, on_delete=models.CASCADE, related_name='followers', verbose_name='作者')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='关注时间')

    class Meta:
        db_table = 'content_user_follow'
        verbose_name = '用户关注'
        verbose_name_plural = '用户关注'
        unique_together = [['user_id', 'author']]

    def __str__(self):
        return f'用户{self.user_id} 关注 {self.author.name}'


class ArticleFavorite(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='favorites', verbose_name='文章')
    user_id = models.IntegerField(verbose_name='用户ID')
    ip_address = models.GenericIPAddressField(default='', verbose_name='IP地址')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='收藏时间')

    class Meta:
        db_table = 'content_article_favorite'
        verbose_name = '文章收藏'
        verbose_name_plural = '文章收藏'
        unique_together = [['article', 'user_id', 'ip_address']]

    def __str__(self):
        return f'{self.article.title} - 用户{self.user_id} 收藏'


from .rag_models import KnowledgeBaseCategory, KnowledgeDocument, DocumentChunk, RetrievalLog


class Banner(models.Model):
    STATUS_CHOICES = [('active', '启用'), ('inactive', '停用')]

    title = models.CharField('标题', max_length=100)
    subtitle = models.CharField('副标题', max_length=200, blank=True, default='')
    description = models.TextField('详细描述', blank=True, default='')
    image_url = models.URLField('封面图片URL', max_length=500, blank=True, default='')
    link_url = models.URLField('跳转链接', max_length=500, blank=True, default='')
    link_type = models.CharField('链接类型', max_length=20, default='article',
        choices=[('article','文章'),('url','外部链接'),('action','内部动作')])
    bg_color = models.CharField('背景色', max_length=7, default='#2563EB')
    category_tag = models.CharField('分类标签', max_length=30, blank=True, default='')
    sort_order = models.IntegerField('排序权重', default=0)
    status = models.CharField('状态', max_length=10, choices=STATUS_CHOICES, default='active')
    click_count = models.PositiveIntegerField('点击次数', default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'content_banner'
        verbose_name = '轮播图管理'
        verbose_name_plural = verbose_name
        ordering = ['-sort_order', '-id']

    def __str__(self):
        return f'#{self.id} {self.title}'

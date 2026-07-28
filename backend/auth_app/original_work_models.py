"""
原创作品审核模型
用户上传作品审核，获取原创声明证书
"""

from django.db import models
from django.conf import settings
import uuid
import hashlib


class OriginalWork(models.Model):
    """原创作品"""

    STATUS_CHOICES = [
        ('pending', '待审核'),
        ('reviewing', '审核中'),
        ('approved', '已通过'),
        ('rejected', '已拒绝'),
    ]

    TYPE_CHOICES = [
        ('article', '文章'),
        ('image', '图片'),
        ('code', '代码'),
        ('ai_dialog', 'AI对话'),
        ('video', '视频'),
        ('other', '其他'),
    ]

    # 基本信息
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='original_works')

    # 作品信息
    title = models.CharField('作品标题', max_length=200)
    work_type = models.CharField('作品类型', max_length=20, choices=TYPE_CHOICES, default='ai_dialog')
    description = models.TextField('作品描述', blank=True)

    # 作品内容
    content = models.TextField('作品内容', blank=True)  # 文本内容
    file_url = models.URLField('文件链接', blank=True)  # 文件存储链接
    content_hash = models.CharField('内容哈希', max_length=64, db_index=True)  # SHA-256

    # 证据链关联
    session_id = models.CharField('会话ID', max_length=100, blank=True)
    evidence_chain = models.JSONField('证据链数据', default=dict, blank=True)

    # 审核状态
    status = models.CharField('审核状态', max_length=20, choices=STATUS_CHOICES, default='pending')
    review_note = models.TextField('审核备注', blank=True)
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_works'
    )
    reviewed_at = models.DateTimeField('审核时间', null=True, blank=True)

    # 原创声明（审核通过后生成）
    declaration_number = models.CharField('原创声明编号', max_length=50, unique=True, blank=True)
    declaration_issued_at = models.DateTimeField('声明签发时间', null=True, blank=True)

    # 时间戳
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        db_table = 'auth_original_work'
        ordering = ['-created_at']
        verbose_name = '原创作品'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f"{self.title} - {self.user.username}"

    def generate_content_hash(self):
        """生成内容哈希"""
        content = self.content or ''
        hash_obj = hashlib.sha256(content.encode('utf-8'))
        self.content_hash = hash_obj.hexdigest()
        return self.content_hash

    def generate_declaration_number(self):
        """生成原创声明编号"""
        if not self.declaration_number:
            # 格式: YJDD-YYYYMMDD-XXXXX
            import datetime
            date_str = datetime.datetime.now().strftime('%Y%m%d')
            unique_id = str(self.id)[:8].upper()
            self.declaration_number = f"YJDD-{date_str}-{unique_id}"
        return self.declaration_number


class OriginalWorkEvidence(models.Model):
    """原创作品证据项"""

    work = models.ForeignKey(OriginalWork, on_delete=models.CASCADE, related_name='evidences')

    # 证据信息
    evidence_type = models.CharField('证据类型', max_length=50)  # operation, screenshot, fingerprint
    evidence_data = models.JSONField('证据数据')
    timestamp = models.DateTimeField('时间戳')
    fingerprint = models.CharField('哈希指纹', max_length=64, blank=True)

    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        db_table = 'auth_original_work_evidence'
        ordering = ['timestamp']
        verbose_name = '原创作品证据'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f"{self.work.title} - {self.evidence_type}"
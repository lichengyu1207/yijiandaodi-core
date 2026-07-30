# ============================================================
# 云端数据缓存模型 - 一鉴到底
#
# 功能：
#   1. 用户数据云端缓存
#   2. 消息云端存储（客服消息、Agent消息）
#   3. 会话云端存储（IM会话、Agent会话）
#   4. 文件云端缓存
#   5. 用户偏好云端同步
# ============================================================

from django.db import models
from django.conf import settings
from django.utils import timezone


class UserCloudData(models.Model):
    """
    用户云端数据缓存
    用于同步用户本地缓存到云端
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cloud_data',
        verbose_name='用户'
    )
    
    # 用户偏好配置
    preferences = models.JSONField(
        default=dict,
        verbose_name='用户偏好配置'
    )
    
    # 本地缓存摘要（用于同步检查）
    local_cache_hash = models.CharField(
        max_length=64,
        blank=True,
        default='',
        verbose_name='本地缓存哈希'
    )
    
    # 同步状态
    last_sync_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='最后同步时间'
    )
    sync_version = models.IntegerField(
        default=0,
        verbose_name='同步版本号'
    )
    
    # 存储空间统计
    total_cache_size = models.BigIntegerField(
        default=0,
        verbose_name='总缓存大小（字节）'
    )
    message_count = models.IntegerField(
        default=0,
        verbose_name='消息数量'
    )
    session_count = models.IntegerField(
        default=0,
        verbose_name='会话数量'
    )
    file_count = models.IntegerField(
        default=0,
        verbose_name='文件数量'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        db_table = 'user_cloud_data'
        verbose_name = '用户云端数据'
        verbose_name_plural = '用户云端数据'
    
    def __str__(self):
        return f'{self.user.username} - 云端数据'


class CloudCachedMessage(models.Model):
    """
    云端缓存的消息
    包括客服消息、人工消息、Agent消息
    """
    MESSAGE_TYPES = [
        ('text', '文本消息'),
        ('image', '图片消息'),
        ('file', '文件消息'),
        ('system', '系统消息'),
    ]
    
    SENDER_TYPES = [
        ('user', '用户'),
        ('agent', 'Agent'),
        ('human', '人工客服'),
        ('system', '系统'),
        ('auto_reply', '自动回复'),
    ]
    
    SESSION_TYPES = [
        ('im', 'IM客服会话'),
        ('agent', 'Agent会话'),
        ('human', '人工客服会话'),
    ]
    
    # 用户关联
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cached_messages',
        verbose_name='用户'
    )
    
    # 会话信息
    session_id = models.CharField(
        max_length=64,
        db_index=True,
        verbose_name='会话ID'
    )
    session_type = models.CharField(
        max_length=20,
        choices=SESSION_TYPES,
        default='im',
        verbose_name='会话类型'
    )
    
    # 消息内容
    message_type = models.CharField(
        max_length=20,
        choices=MESSAGE_TYPES,
        default='text',
        verbose_name='消息类型'
    )
    sender_type = models.CharField(
        max_length=20,
        choices=SENDER_TYPES,
        default='user',
        verbose_name='发送者类型'
    )
    content = models.TextField(
        blank=True,
        default='',
        verbose_name='消息内容'
    )
    file_url = models.URLField(
        blank=True,
        default='',
        verbose_name='文件URL'
    )
    
    # 元数据
    client_message_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='客户端消息ID'
    )
    is_read = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name='是否已读'
    )
    is_offline = models.BooleanField(
        default=False,
        verbose_name='是否离线创建'
    )
    
    # 同步状态
    synced_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='同步时间'
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name='创建时间'
    )
    
    class Meta:
        db_table = 'cloud_cached_message'
        verbose_name = '云端缓存消息'
        verbose_name_plural = '云端缓存消息'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['user', 'session_id', '-created_at'], name='idx_msg_user_session'),
            models.Index(fields=['user', '-created_at'], name='idx_msg_user_time'),
            models.Index(fields=['session_type', 'is_read'], name='idx_msg_type_read'),
        ]
    
    def __str__(self):
        return f'[{self.user.username}] {self.session_id}: {self.content[:30]}'


class CloudCachedSession(models.Model):
    """
    云端缓存的会话
    """
    SESSION_TYPES = [
        ('im', 'IM客服会话'),
        ('agent', 'Agent会话'),
        ('human', '人工客服会话'),
    ]
    
    STATUS_CHOICES = [
        ('active', '活跃'),
        ('closed', '已关闭'),
        ('expired', '已过期'),
    ]
    
    # 用户关联
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cached_sessions',
        verbose_name='用户'
    )
    
    # 会话信息
    session_id = models.CharField(
        max_length=64,
        unique=True,
        verbose_name='会话ID'
    )
    session_type = models.CharField(
        max_length=20,
        choices=SESSION_TYPES,
        default='im',
        verbose_name='会话类型'
    )
    title = models.CharField(
        max_length=200,
        blank=True,
        default='',
        verbose_name='会话标题'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        db_index=True,
        verbose_name='状态'
    )
    
    # 最后消息
    last_message = models.TextField(
        blank=True,
        default='',
        verbose_name='最后一条消息'
    )
    last_message_time = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='最后消息时间'
    )
    
    # 未读数
    unread_count = models.IntegerField(
        default=0,
        verbose_name='未读消息数'
    )
    
    # 关联的Agent/客服
    agent_code = models.CharField(
        max_length=50,
        blank=True,
        default='',
        verbose_name='Agent代码'
    )
    human_agent_id = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='人工客服ID'
    )
    
    # 同步状态
    synced_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='同步时间'
    )
    is_offline = models.BooleanField(
        default=False,
        verbose_name='是否离线创建'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        db_table = 'cloud_cached_session'
        verbose_name = '云端缓存会话'
        verbose_name_plural = '云端缓存会话'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at'], name='idx_sess_user_update'),
            models.Index(fields=['session_type', 'status'], name='idx_sess_type_status'),
        ]
    
    def __str__(self):
        return f'[{self.user.username}] {self.session_id} ({self.session_type})'


class CloudCachedFile(models.Model):
    """
    云端缓存的文件
    """
    FILE_TYPES = [
        ('image', '图片'),
        ('document', '文档'),
        ('video', '视频'),
        ('audio', '音频'),
        ('other', '其他'),
    ]
    
    UPLOAD_STATUS = [
        ('pending', '待上传'),
        ('uploading', '上传中'),
        ('uploaded', '已上传'),
        ('failed', '上传失败'),
        ('expired', '已过期'),
    ]
    
    # 用户关联
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cached_files',
        verbose_name='用户'
    )
    
    # 文件信息
    file_id = models.CharField(
        max_length=100,
        unique=True,
        verbose_name='文件ID'
    )
    original_name = models.CharField(
        max_length=255,
        verbose_name='原始文件名'
    )
    file_type = models.CharField(
        max_length=20,
        choices=FILE_TYPES,
        default='other',
        verbose_name='文件类型'
    )
    mime_type = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='MIME类型'
    )
    file_size = models.BigIntegerField(
        default=0,
        verbose_name='文件大小（字节）'
    )
    
    # 存储路径
    cloud_url = models.URLField(
        blank=True,
        default='',
        verbose_name='云端URL'
    )
    storage_path = models.CharField(
        max_length=500,
        blank=True,
        default='',
        verbose_name='存储路径'
    )
    
    # 上传状态
    upload_status = models.CharField(
        max_length=20,
        choices=UPLOAD_STATUS,
        default='pending',
        verbose_name='上传状态'
    )
    
    # 关联会话
    session_id = models.CharField(
        max_length=64,
        blank=True,
        default='',
        verbose_name='关联会话ID'
    )
    
    # 过期时间
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='过期时间'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        db_table = 'cloud_cached_file'
        verbose_name = '云端缓存文件'
        verbose_name_plural = '云端缓存文件'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'upload_status'], name='idx_file_user_status'),
            models.Index(fields=['expires_at'], name='idx_file_expires'),
        ]
    
    def __str__(self):
        return f'[{self.user.username}] {self.original_name}'
    
    def is_expired(self):
        """检查文件是否过期"""
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False


class UserDraft(models.Model):
    """
    用户草稿箱
    """
    DRAFT_TYPES = [
        ('message', '消息草稿'),
        ('file', '文件草稿'),
        ('session', '会话草稿'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='drafts',
        verbose_name='用户'
    )
    
    draft_type = models.CharField(
        max_length=20,
        choices=DRAFT_TYPES,
        verbose_name='草稿类型'
    )
    draft_key = models.CharField(
        max_length=100,
        verbose_name='草稿键'
    )
    content = models.JSONField(
        verbose_name='草稿内容'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        db_table = 'user_draft'
        verbose_name = '用户草稿'
        verbose_name_plural = '用户草稿'
        ordering = ['-updated_at']
        unique_together = ['user', 'draft_type', 'draft_key']
        indexes = [
            models.Index(fields=['user', 'draft_type'], name='idx_draft_user_type'),
        ]
    
    def __str__(self):
        return f'[{self.user.username}] {self.draft_type}:{self.draft_key}'


class SyncLog(models.Model):
    """
    同步日志
    """
    SYNC_TYPES = [
        ('upload', '上传同步'),
        ('download', '下载同步'),
        ('full', '全量同步'),
        ('partial', '增量同步'),
    ]
    
    SYNC_STATUS = [
        ('success', '成功'),
        ('failed', '失败'),
        ('partial', '部分成功'),
        ('pending', '进行中'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sync_logs',
        verbose_name='用户'
    )
    
    sync_type = models.CharField(
        max_length=20,
        choices=SYNC_TYPES,
        verbose_name='同步类型'
    )
    status = models.CharField(
        max_length=20,
        choices=SYNC_STATUS,
        default='pending',
        verbose_name='状态'
    )
    
    # 同步统计
    messages_synced = models.IntegerField(default=0, verbose_name='同步消息数')
    sessions_synced = models.IntegerField(default=0, verbose_name='同步会话数')
    files_synced = models.IntegerField(default=0, verbose_name='同步文件数')
    bytes_synced = models.BigIntegerField(default=0, verbose_name='同步字节数')
    
    # 错误信息
    error_message = models.TextField(blank=True, default='', verbose_name='错误信息')
    
    # 设备信息
    device_info = models.CharField(max_length=200, blank=True, default='', verbose_name='设备信息')
    client_version = models.CharField(max_length=50, blank=True, default='', verbose_name='客户端版本')
    
    started_at = models.DateTimeField(auto_now_add=True, verbose_name='开始时间')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='完成时间')
    
    class Meta:
        db_table = 'sync_log'
        verbose_name = '同步日志'
        verbose_name_plural = '同步日志'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['user', '-started_at'], name='idx_sync_user_time'),
            models.Index(fields=['status'], name='idx_sync_status'),
        ]
    
    def __str__(self):
        return f'[{self.user.username}] {self.sync_type} - {self.status}'
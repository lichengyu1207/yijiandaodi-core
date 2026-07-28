from django.db import models
from django.conf import settings


class KnowledgeBaseCategory(models.Model):
    name = models.CharField(max_length=100, verbose_name='分类名称')
    slug = models.SlugField(max_length=100, unique=True, verbose_name='URL标识')
    description = models.TextField(blank=True, default='', verbose_name='描述')
    icon = models.CharField(max_length=50, default='folder', verbose_name='图标')
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    is_active = models.BooleanField(default=True, verbose_name='是否启用')

    document_count = models.IntegerField(default=0, verbose_name='文档数量')
    chunk_count = models.IntegerField(default=0, verbose_name='分片数量')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'rag_kb_category'
        verbose_name = '知识库分类'
        verbose_name_plural = '知识库分类'
        ordering = ['sort_order', '-created_at']

    def __str__(self):
        return self.name

    def update_counts(self):
        self.document_count = self.documents.count()
        self.chunk_count = DocumentChunk.objects.filter(document__category=self).count()
        self.save(update_fields=['document_count', 'chunk_count'])


class KnowledgeDocument(models.Model):
    STATUS_CHOICES = [
        ('uploading', '上传中'),
        ('parsing', '解析中'),
        ('chunking', '分块中'),
        ('embedding', '向量化中'),
        ('completed', '已完成'),
        ('failed', '失败'),
    ]

    FILE_TYPE_CHOICES = [
        ('pdf', 'PDF文档'),
        ('word', 'Word文档'),
        ('txt', '文本文件'),
        ('markdown', 'Markdown'),
        ('excel', 'Excel表格'),
        ('html', 'HTML网页'),
        ('json', 'JSON数据'),
        ('other', '其他格式'),
    ]

    title = models.CharField(max_length=500, verbose_name='文档标题')
    category = models.ForeignKey(
        KnowledgeBaseCategory,
        on_delete=models.CASCADE,
        related_name='documents',
        verbose_name='所属分类'
    )

    file_name = models.CharField(max_length=255, verbose_name='文件名')
    file_path = models.CharField(max_length=500, verbose_name='文件路径')
    file_size = models.BigIntegerField(default=0, verbose_name='文件大小(bytes)')
    file_type = models.CharField(max_length=20, choices=FILE_TYPE_CHOICES, default='txt', verbose_name='文件类型')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='uploading', verbose_name='处理状态')
    progress = models.IntegerField(default=0, verbose_name='处理进度(%)')
    error_message = models.TextField(blank=True, default='', verbose_name='错误信息')

    page_count = models.IntegerField(default=0, verbose_name='页数/段数')
    word_count = models.IntegerField(default=0, verbose_name='字数')
    chunk_count = models.IntegerField(default=0, verbose_name='分片数量')

    summary = models.TextField(blank=True, default='', verbose_name='文档摘要')
    keywords = models.JSONField(default=list, blank=True, verbose_name='关键词列表')

    is_public = models.BooleanField(default=True, verbose_name='是否公开')
    allowed_roles = models.JSONField(default=list, blank=True, verbose_name='允许访问的角色ID列表')

    uploaded_by = models.IntegerField(default=0, verbose_name='上传人ID')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'rag_kb_document'
        verbose_name = '知识库文档'
        verbose_name_plural = '知识库文档'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['category', '-created_at'], name='idx_doc_category_time'),
            models.Index(fields=['status'], name='idx_doc_status'),
            models.Index(fields=['is_public'], name='idx_doc_public'),
        ]

    def __str__(self):
        return f'{self.title} ({self.get_file_type_display()})'


class DocumentChunk(models.Model):
    document = models.ForeignKey(
        KnowledgeDocument,
        on_delete=models.CASCADE,
        related_name='chunks',
        verbose_name='所属文档'
    )

    chunk_index = models.IntegerField(verbose_name='分片序号')
    content = models.TextField(verbose_name='分片内容')

    metadata = models.JSONField(default=dict, blank=True, verbose_name='元数据')
    page_number = models.IntegerField(default=0, verbose_name='页码/段落号')
    section_title = models.CharField(max_length=500, blank=True, default='', verbose_name='章节标题')

    embedding = models.TextField(blank=True, default='', verbose_name='向量数据(Base64编码)')
    embedding_model = models.CharField(max_length=100, default='text-embedding-ada-002', verbose_name='嵌入模型')

    token_count = models.IntegerField(default=0, verbose_name='Token数量')
    char_count = models.IntegerField(default=0, verbose_name='字符数量')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'rag_kb_chunk'
        verbose_name = '文档分片'
        verbose_name_plural = '文档分片'
        ordering = ['document_id', 'chunk_index']
        unique_together = [['document', 'chunk_index']]
        indexes = [
            models.Index(fields=['document_id', 'chunk_index'], name='idx_chunk_doc_idx'),
            models.Index(fields=['embedding_model'], name='idx_chunk_model'),
        ]

    def __str__(self):
        return f'[{self.document.title}] Chunk{self.chunk_index}'


class RetrievalLog(models.Model):
    query = models.TextField(verbose_name='查询内容')
    query_type = models.CharField(
        max_length=20,
        default='hybrid',
        choices=[
            ('semantic', '语义检索'),
            ('keyword', '关键词检索'),
            ('hybrid', '混合检索'),
        ],
        verbose_name='检索类型'
    )
    results_count = models.IntegerField(default=0, verbose_name='结果数量')

    top_chunks = models.JSONField(default=list, blank=True, verbose_name='Top-K分片ID列表')
    response_time_ms = models.IntegerField(default=0, verbose_name='响应时间(ms)')

    user_id = models.IntegerField(default=0, verbose_name='用户ID')
    session_id = models.CharField(max_length=100, blank=True, default='', verbose_name='会话ID')
    ip_address = models.GenericIPAddressField(default='', verbose_name='IP地址')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'rag_retrieval_log'
        verbose_name = '检索日志'
        verbose_name_plural = '检索日志'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_id', '-created_at'], name='idx_retrieval_user_time'),
            models.Index(fields=['query_type'], name='idx_retrieval_type'),
        ]

    def __str__(self):
        return f'{self.query[:50]}... ({self.results_count} results)'


class RAGOperationLog(models.Model):
    """RAG知识库操作审计日志"""

    ACTION_CHOICES = [
        ('upload', '文档上传'),
        ('delete', '文档删除'),
        ('re_vectorize', '重新向量化'),
        ('search', '检索查询'),
        ('ask', 'RAG问答'),
        ('category_create', '创建分类'),
        ('category_update', '更新分类'),
        ('category_delete', '删除分类'),
        ('chunk_delete', '删除分片'),
        ('export', '导出数据'),
    ]

    STATUS_CHOICES = [
        ('success', '成功'),
        ('failed', '失败'),
        ('partial', '部分成功'),
    ]

    action = models.CharField(max_length=30, choices=ACTION_CHOICES, db_index=True, verbose_name='操作类型')
    target_type = models.CharField(max_length=20, default='', verbose_name='目标类型')
    target_id = models.IntegerField(null=True, blank=True, verbose_name='目标ID')
    target_name = models.CharField(max_length=300, blank=True, default='', verbose_name='目标名称')

    user_id = models.IntegerField(null=True, blank=True, verbose_name='操作用户ID')
    username = models.CharField(max_length=100, blank=True, default='', verbose_name='操作用户名')
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='IP地址')
    user_agent = models.TextField(blank=True, default='', verbose_name='User-Agent')

    request_detail = models.JSONField(default=dict, blank=True, verbose_name='请求详情')
    response_detail = models.JSONField(default=dict, blank=True, verbose_name='响应详情')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='success', verbose_name='状态')
    error_message = models.TextField(blank=True, default='', verbose_name='错误信息')
    duration_ms = models.IntegerField(default=0, verbose_name='耗时(ms)')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='操作时间')

    class Meta:
        db_table = 'rag_operation_log'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['action', '-created_at']),
            models.Index(fields=['target_type', 'target_id']),
            models.Index(fields=['user_id', '-created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'{self.get_action_display()} - {self.target_name} - {self.created_at.strftime("%Y-%m-%d %H:%M")}'

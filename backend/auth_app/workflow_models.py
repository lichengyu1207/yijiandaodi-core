import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class Workflow(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, verbose_name='工作流名称')
    description = models.TextField(blank=True, default='', verbose_name='描述')
    workflow_type = models.CharField(
        max_length=30,
        choices=[
            ('chatflow', '对话型工作流'),
            ('workflow', '自动化工作流'),
            ('agent', '智能体编排'),
            ('custom', '自定义流程'),
        ],
        default='chatflow',
        verbose_name='工作流类型',
    )
    status = models.CharField(
        max_length=20,
        choices=[
            ('draft', '草稿'),
            ('published', '已发布'),
            ('archived', '已归档'),
            ('disabled', '已禁用'),
        ],
        default='draft',
        verbose_name='状态',
    )
    version = models.IntegerField(default=1, verbose_name='版本号')
    
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='workflows',
        null=True,
        blank=True,
        verbose_name='创建者',
    )
    
    icon = models.CharField(max_length=50, blank=True, default='', verbose_name='图标')
    icon_background = models.CharField(max_length=20, blank=True, default='#EF4444', verbose_name='图标背景色')
    
    graph_data = models.JSONField(default=dict, verbose_name='可视化图数据')
    environment_variables = models.JSONField(default=list, verbose_name='环境变量列表')
    
    is_template = models.BooleanField(default=False, verbose_name='是否为模板')
    template_category = models.CharField(max_length=50, blank=True, default='', verbose_name='模板分类')
    use_count = models.PositiveIntegerField(default=0, verbose_name='使用次数')
    like_count = models.PositiveIntegerField(default=0, verbose_name='点赞数')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'workflow_workflow'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['owner', 'status']),
            models.Index(fields=['workflow_type', 'status']),
            models.Index(fields=['is_template', 'template_category']),
        ]

    def __str__(self):
        return self.name

    def increment_use_count(self):
        self.use_count += 1
        self.save(update_fields=['use_count'])


class WorkflowNode(models.Model):
    NODE_TYPE_CHOICES = [
        ('start', '开始节点'),
        ('end', '结束节点'),
        ('llm', 'LLM 调用'),
        ('knowledge_retrieval', '知识库检索'),
        ('condition', '条件分支'),
        ('iteration', '迭代循环'),
        ('tool', '工具调用'),
        ('code', '代码执行'),
        ('http_request', 'HTTP 请求'),
        ('variable_assigner', '变量赋值'),
        ('template_transform', '模板转换'),
        ('question_classifier', '问题分类'),
        ('document_extractor', '文档提取'),
        ('tipping', '打赏处理'),
        ('notification', '通知推送'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='nodes',
        verbose_name='所属工作流',
    )
    node_id = models.CharField(max_length=100, verbose_name='节点ID（前端标识）')
    node_type = models.CharField(max_length=30, choices=NODE_TYPE_CHOICES, verbose_name='节点类型')
    title = models.CharField(max_length=200, verbose_name='节点标题')
    desc = models.TextField(blank=True, default='', verbose_name='描述')
    
    position_x = models.FloatField(default=0, verbose_name='X坐标')
    position_y = models.FloatField(default=0, verbose_name='Y坐标')
    
    config_data = models.JSONField(default=dict, verbose_name='节点配置数据')
    
    sort_order = models.IntegerField(default=0, verbose_name='排序顺序')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workflow_node'
        ordering = ['sort_order']
        unique_together = [['workflow', 'node_id']]
        indexes = [
            models.Index(fields=['workflow', 'node_type']),
        ]

    def __str__(self):
        return f'{self.node_type}: {self.title}'


class WorkflowEdge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='edges',
        verbose_name='所属工作流',
    )
    edge_id = models.CharField(max_length=100, verbose_name='边ID（前端标识）')
    source_node_id = models.CharField(max_length=100, verbose_name='源节点ID')
    target_node_id = models.CharField(max_length=100, verbose_name='目标节点ID')
    source_handle = models.CharField(max_length=50, default='source', verbose_name='源连接点')
    target_handle = models.CharField(max_length=50, default='target', verbose_name='目标连接点')
    
    condition_data = models.JSONField(default=dict, verbose_name='分支条件表达式')
    label = models.CharField(max_length=100, blank=True, default='', verbose_name='连线标签')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workflow_edge'
        unique_together = [['workflow', 'edge_id']]
        indexes = [
            models.Index(fields=['workflow', 'source_node_id']),
            models.Index(fields=['workflow', 'target_node_id']),
        ]

    def __str__(self):
        return f'{self.source_node_id} -> {self.target_node_id}'


class WorkflowExecution(models.Model):
    STATUS_CHOICES = [
        ('running', '运行中'),
        ('succeeded', '成功'),
        ('failed', '失败'),
        ('stopped', '已停止'),
        ('timeout', '超时'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='executions',
        verbose_name='工作流',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='workflow_executions',
        verbose_name='执行用户',
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='running', verbose_name='状态')
    inputs = models.JSONField(default=dict, verbose_name='输入数据')
    outputs = models.JSONField(default=dict, verbose_name='输出数据')
    error_message = models.TextField(blank=True, default='', verbose_name='错误信息')
    
    total_tokens = models.PositiveIntegerField(default=0, verbose_name='总Token消耗')
    total_steps = models.PositiveIntegerField(default=0, verbose_name='总步骤数')
    elapsed_time_ms = models.PositiveIntegerField(default=0, verbose_name='耗时(毫秒)')
    
    started_at = models.DateTimeField(default=timezone.now, verbose_name='开始时间')
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name='结束时间')

    class Meta:
        db_table = 'workflow_execution'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['workflow', 'status']),
            models.Index(fields=['user', '-started_at']),
        ]

    def __str__(self):
        return f'{self.workflow.name} - {self.status}'

    def finish(self, status: str, outputs: dict = None, error: str = None):
        self.status = status
        self.finished_at = timezone.now()
        if self.started_at:
            self.elapsed_time_ms = int((self.finished_at - self.started_at).total_seconds() * 1000)
        if outputs:
            self.outputs = outputs
        if error:
            self.error_message = error
        self.save()


class WorkflowTemplate(models.Model):
    CATEGORY_CHOICES = [
        ('agent', '智能体助手'),
        ('automation', '自动化流程'),
        ('content', '内容生成'),
        ('analysis', '数据分析'),
        ('customer_service', '客服场景'),
        ('security', '安全检测'),
        ('education', '教育培训'),
        ('other', '其他场景'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, verbose_name='模板名称')
    description = models.TextField(verbose_name='模板描述')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, verbose_name='分类')
    
    cover_image = models.URLField(blank=True, default='', verbose_name='封面图')
    icon = models.CharField(max_length=50, default='Workflow', verbose_name='图标')
    icon_color = models.CharField(max_length=20, default='#165DFF', verbose_name='图标颜色')
    
    base_workflow = models.OneToOneField(
        Workflow,
        on_delete=models.CASCADE,
        related_name='template_meta',
        verbose_name='基础工作流',
    )
    
    difficulty = models.CharField(
        max_length=12,
        choices=[('beginner', '入门'), ('intermediate', '中级'), ('advanced', '高级')],
        default='beginner',
        verbose_name='难度等级',
    )
    tags = models.JSONField(default=list, verbose_name='标签列表')
    use_count = models.PositiveIntegerField(default=0, verbose_name='使用次数')
    rating = models.FloatField(default=0.0, verbose_name='评分')
    is_official = models.BooleanField(default=True, verbose_name='是否官方模板')
    is_featured = models.BooleanField(default=False, verbose_name='是否推荐')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workflow_template'
        ordering = ['-is_featured', '-use_count']

    def __str__(self):
        return self.name

from django.db import models
from django.conf import settings


class Role(models.Model):
    name = models.CharField(max_length=50, unique=True, verbose_name='角色名称')
    code = models.CharField(max_length=50, unique=True, verbose_name='角色编码')
    description = models.TextField(blank=True, default='', verbose_name='描述')
    DATA_SCOPE_CHOICES = [
        ('all', '全部数据'),
        ('self', '仅本人数据'),
        ('role', '本角色数据'),
    ]
    data_scope = models.CharField(max_length=10, choices=DATA_SCOPE_CHOICES, default='self', verbose_name='数据权限范围')
    status = models.BooleanField(default=True, verbose_name='状态')
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    users = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='roles', blank=True, verbose_name='用户')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'rbac_role'
        verbose_name = '角色'
        verbose_name_plural = '角色'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.name


class Permission(models.Model):
    PERMISSION_TYPE_CHOICES = [
        ('menu', '菜单'),
        ('button', '按钮'),
        ('api', '接口'),
    ]
    name = models.CharField(max_length=100, verbose_name='权限名称')
    code = models.CharField(max_length=100, unique=True, verbose_name='权限标识')
    perm_type = models.CharField(max_length=10, choices=PERMISSION_TYPE_CHOICES, default='menu', verbose_name='类型')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children', verbose_name='上级权限')
    path = models.CharField(max_length=255, blank=True, default='', verbose_name='路由路径')
    method = models.CharField(max_length=10, blank=True, default='', verbose_name='请求方法')
    component = models.CharField(max_length=255, blank=True, default='', verbose_name='组件路径')
    icon = models.CharField(max_length=100, blank=True, default='', verbose_name='图标')
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    visible = models.BooleanField(default=True, verbose_name='是否可见')
    status = models.BooleanField(default=True, verbose_name='状态')
    roles = models.ManyToManyField(Role, related_name='permissions', blank=True, verbose_name='角色')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'rbac_permission'
        verbose_name = '权限'
        verbose_name_plural = '权限'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.name


class Menu(models.Model):
    MENU_TYPE_CHOICES = [
        ('directory', '目录'),
        ('menu', '菜单'),
        ('button', '按钮'),
    ]
    name = models.CharField(max_length=50, verbose_name='菜单名称')
    code = models.CharField(max_length=50, unique=True, verbose_name='菜单编码')
    menu_type = models.CharField(max_length=10, choices=MENU_TYPE_CHOICES, default='menu', verbose_name='类型')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children', verbose_name='上级菜单')
    path = models.CharField(max_length=255, blank=True, default='', verbose_name='路由路径')
    component = models.CharField(max_length=255, blank=True, default='', verbose_name='组件路径')
    icon = models.CharField(max_length=100, blank=True, default='', verbose_name='图标')
    permission = models.ForeignKey(Permission, on_delete=models.SET_NULL, null=True, blank=True, related_name='menus', verbose_name='关联权限')
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    visible = models.BooleanField(default=True, verbose_name='是否显示')
    status = models.BooleanField(default=True, verbose_name='状态')
    roles = models.ManyToManyField(Role, related_name='menus', blank=True, verbose_name='角色')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'rbac_menu'
        verbose_name = '菜单'
        verbose_name_plural = '菜单'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.name


class OperationLog(models.Model):
    METHOD_CHOICES = [
        ('GET', 'GET'),
        ('POST', 'POST'),
        ('PUT', 'PUT'),
        ('DELETE', 'DELETE'),
        ('PATCH', 'PATCH'),
    ]
    ACTION_CHOICES = [
        ('create', '新增'),
        ('update', '修改'),
        ('delete', '删除'),
        ('export', '导出'),
        ('import', '导入'),
        ('login', '登录'),
        ('logout', '登出'),
        ('other', '其他'),
    ]
    RESULT_CHOICES = [
        ('success', '成功'),
        ('failed', '失败'),
        ('error', '异常'),
        ('denied', '无权限'),
    ]

    operator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='operation_logs', verbose_name='操作人')
    operator_name = models.CharField(max_length=150, verbose_name='操作人账号', db_index=True, default='')
    role_name = models.CharField(max_length=50, blank=True, default='', verbose_name='角色')
    module = models.CharField(max_length=50, verbose_name='模块', db_index=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, default='other', verbose_name='操作类型')
    method = models.CharField(max_length=10, choices=METHOD_CHOICES, default='GET', verbose_name='请求方法')
    url = models.CharField(max_length=500, blank=True, default='', verbose_name='请求接口')
    request_data = models.TextField(blank=True, default='', verbose_name='请求数据')
    ip_address = models.GenericIPAddressField(verbose_name='IP地址')
    response_code = models.IntegerField(default=0, verbose_name='响应状态码')
    result = models.CharField(max_length=10, choices=RESULT_CHOICES, default='success', verbose_name='操作结果')
    duration = models.IntegerField(default=0, verbose_name='耗时(ms)')
    message = models.TextField(blank=True, default='', verbose_name='执行消息')
    created_at = models.DateTimeField(db_index=True, verbose_name='操作时间')

    class Meta:
        db_table = 'rbac_operation_log'
        verbose_name = '操作日志'
        verbose_name_plural = '操作日志'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} - {self.module} - {self.action} - {self.result}"


class PermissionAuditLog(models.Model):
    AUDIT_ACTION_CHOICES = [
        ('assign_role', '分配角色'),
        ('remove_role', '移除角色'),
        ('assign_perm', '分配权限'),
        ('remove_perm', '移除权限'),
        ('create_role', '创建角色'),
        ('update_role', '更新角色'),
        ('delete_role', '删除角色'),
        ('create_menu', '创建菜单'),
        ('update_menu', '更新菜单'),
        ('delete_menu', '删除菜单'),
    ]
    operator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='permission_audit_logs', verbose_name='操作人')
    target_type = models.CharField(max_length=20, verbose_name='目标类型')
    target_id = models.IntegerField(verbose_name='目标ID')
    target_name = models.CharField(max_length=100, blank=True, default='', verbose_name='目标名称')
    action = models.CharField(max_length=20, choices=AUDIT_ACTION_CHOICES, verbose_name='操作动作')
    detail_before = models.TextField(blank=True, default='', verbose_name='变更前内容')
    detail_after = models.TextField(blank=True, default='', verbose_name='变更后内容')
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='IP地址')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='操作时间')

    class Meta:
        db_table = 'rbac_permission_audit_log'
        verbose_name = '权限审计日志'
        verbose_name_plural = '权限审计日志'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.operator} - {self.action} - {self.target_type}:{self.target_id}"

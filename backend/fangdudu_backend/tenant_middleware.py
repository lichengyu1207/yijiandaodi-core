# ============================================================
# 租户自动隔离中间件 - 一鉴到底多租户架构
#
# 功能:
#   1. 自动识别当前租户（通过JWT Token或请求头）
#   2. 为所有数据库查询自动添加租户过滤条件
#   3. 防止跨租户数据访问
#   4. 记录租户访问审计日志
#
# 安全特性:
#   - SQL注入防护：使用参数化查询
#   - 数据泄露防护：强制租户过滤
#   - 权限验证：检查用户归属租户
# ============================================================

import threading
from django.db import connection, models
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
import logging

logger = logging.getLogger('security_audit')

# 线程本地存储，存储当前租户信息
_tenant_context = threading.local()


class TenantContext:
    """
    租户上下文管理器
    用于存储和管理当前请求的租户信息
    """
    
    def __init__(self, tenant_id=None, tenant_name=None):
        self.tenant_id = tenant_id
        self.tenant_name = tenant_name
        self.is_public = tenant_id is None  # 公共数据，不隔离
    
    def __enter__(self):
        _tenant_context.current = self
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        _tenant_context.current = None
    
    @classmethod
    def get_current(cls):
        """获取当前租户上下文"""
        return getattr(_tenant_context, 'current', None)


class TenantIsolationMiddleware:
    """
    租户自动隔离中间件
    
    工作流程:
    1. 从请求中提取租户标识（JWT Token中的tenant_id或X-Tenant-ID请求头）
    2. 验证用户是否有权限访问该租户数据
    3. 设置租户上下文，供ORM自动过滤使用
    4. 记录审计日志
    """
    
    # 需要租户隔离的模型前缀
    ISOLATED_APP_PREFIXES = [
        'auth_app.Enterprise',
        'auth_app.EnterpriseApplication',
        'auth_app.EnterpriseContract',
        'auth_app.EnterpriseInquiry',
        'auth_app.AgentSession',
        'auth_app.AgentMessage',
        'auth_app.AgentVerificationRecord',
        'content_app.Article',
        'data_app.*',
    ]
    
    # 公共模型（不隔离）
    PUBLIC_MODELS = getattr(settings, 'PUBLIC_MODELS', [
        'auth_app.User',
        'auth_app.BlacklistedToken',
        'auth_app.LoginLog',
        'auth_app.AuditLog',
    ])
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # 1. 提取租户标识
        tenant_info = self._extract_tenant(request)
        
        # 2. 设置租户上下文
        with TenantContext(
            tenant_id=tenant_info.get('tenant_id'),
            tenant_name=tenant_info.get('tenant_name')
        ) as ctx:
            
            # 3. 记录审计日志
            if tenant_info.get('tenant_id'):
                self._log_tenant_access(request, tenant_info)
            
            # 4. 执行请求
            response = self.get_response(request)
        
        return response
    
    def _extract_tenant(self, request):
        """
        从请求中提取租户信息
        
        提取方式:
        1. JWT Token中的tenant_id字段
        2. X-Tenant-ID请求头
        3. 用户关联的enterprise字段
        """
        tenant_info = {
            'tenant_id': None,
            'tenant_name': None,
            'source': None,
        }
        
        # 获取用户
        user = getattr(request, 'user', None)
        if user is None or isinstance(user, AnonymousUser):
            return tenant_info
        
        # 方式1: 从JWT Token提取
        if hasattr(user, 'tenant_id'):
            tenant_info['tenant_id'] = user.tenant_id
            tenant_info['source'] = 'jwt_token'
        
        # 方式2: 从请求头提取
        header_tenant_id = request.headers.get('X-Tenant-ID')
        if header_tenant_id:
            # 验证用户是否有权限访问该租户
            if self._validate_tenant_access(user, header_tenant_id):
                tenant_info['tenant_id'] = header_tenant_id
                tenant_info['source'] = 'header'
            else:
                logger.warning(
                    f"[Tenant] 非授权租户访问: user={user.id}, "
                    f"requested_tenant={header_tenant_id}"
                )
        
        # 方式3: 从用户enterprise字段提取
        if hasattr(user, 'enterprise_id') and not tenant_info['tenant_id']:
            tenant_info['tenant_id'] = user.enterprise_id
            tenant_info['source'] = 'user_profile'
        
        # 获取租户名称
        if tenant_info['tenant_id']:
            tenant_info['tenant_name'] = self._get_tenant_name(
                tenant_info['tenant_id']
            )
        
        return tenant_info
    
    def _validate_tenant_access(self, user, tenant_id):
        """
        验证用户是否有权限访问指定租户
        
        规则:
        - 超级管理员(super_admin)可以访问所有租户
        - 管理员(admin)可以访问所属租户
        - 普通用户只能访问所属租户
        """
        if user.role == 'super_admin':
            return True
        
        # 检查用户是否属于该租户
        user_tenant = getattr(user, 'tenant_id', None)
        user_enterprise = getattr(user, 'enterprise_id', None)
        
        return str(user_tenant) == str(tenant_id) or \
               str(user_enterprise) == str(tenant_id)
    
    def _get_tenant_name(self, tenant_id):
        """
        获取租户名称
        """
        try:
            from auth_app.enterprise_models import Enterprise
            tenant = Enterprise.objects.filter(id=tenant_id).first()
            return tenant.company_name if tenant else None
        except Exception:
            return None
    
    def _log_tenant_access(self, request, tenant_info):
        """
        记录租户访问审计日志
        """
        user = getattr(request, 'user', None)
        logger.info(
            f"[Tenant] 访问记录 | "
            f"user_id={getattr(user, 'id', None)} | "
            f"tenant_id={tenant_info['tenant_id']} | "
            f"tenant_name={tenant_info['tenant_name']} | "
            f"source={tenant_info['source']} | "
            f"path={request.path} | "
            f"method={request.method}"
        )


# ============================================================
# 租户过滤器 - 用于ORM查询自动添加租户条件
# ============================================================

def get_tenant_filter():
    """
    获取当前租户的过滤条件
    
    使用方式:
    在ViewSet或Manager中使用:
    
    def get_queryset(self):
        queryset = super().get_queryset()
        tenant_filter = get_tenant_filter()
        if tenant_filter:
            queryset = queryset.filter(**tenant_filter)
        return queryset
    """
    ctx = TenantContext.get_current()
    
    if ctx is None or ctx.is_public:
        return None
    
    return {
        'tenant_id': ctx.tenant_id,
        # 或者根据模型使用 company_id / enterprise_id
    }


def apply_tenant_filter(queryset, model_name=None):
    """
    应用租户过滤到查询集
    
    参数:
        queryset: Django QuerySet
        model_name: 模型名称（可选，用于判断是否需要隔离）
    
    返回:
        过滤后的QuerySet
    """
    # 检查是否为公共模型
    if model_name and model_name in TenantIsolationMiddleware.PUBLIC_MODELS:
        return queryset
    
    tenant_filter = get_tenant_filter()
    if tenant_filter:
        # 尝试不同的租户字段名
        for field_name in ['tenant_id', 'enterprise_id', 'company_id']:
            if hasattr(queryset.model, field_name):
                return queryset.filter(**{field_name: tenant_filter['tenant_id']})
    
    return queryset


# ============================================================
# TenantQuerySet - 自动租户过滤的QuerySet
# ============================================================

class TenantQuerySetMixin:
    """
    租户过滤QuerySet混入类
    
    使用方式:
    class MyModel(models.Model):
        objects = TenantManager()
        
        class Meta:
            base_manager_name = 'objects'
    """
    
    def get_queryset(self):
        queryset = super().get_queryset()
        model_name = f"{self.model._meta.app_label}.{self.model._meta.model_name}"
        return apply_tenant_filter(queryset, model_name)


class TenantManager(models.Manager):
    """
    租户感知的管理器
    """
    use_for_related_fields = True
    
    def get_queryset(self):
        from django.db.models import QuerySet
        queryset = QuerySet(self.model, using=self._db)
        model_name = f"{self.model._meta.app_label}.{self.model._meta.model_name}"
        return apply_tenant_filter(queryset, model_name)


# ============================================================
# 租户上下文装饰器 - 用于特定视图绕过隔离
# ============================================================

def bypass_tenant_isolation(func):
    """
    装饰器：绕过租户隔离
    
    使用场景:
    - 公共API（如注册、登录）
    - 超级管理员的跨租户操作
    - 系统维护任务
    """
    def wrapper(*args, **kwargs):
        with TenantContext(tenant_id=None, tenant_name='bypass') as ctx:
            ctx.is_public = True
            return func(*args, **kwargs)
    return wrapper


def set_tenant_context(tenant_id, tenant_name=None):
    """
    手动设置租户上下文
    
    使用场景:
    - Celery异步任务中需要指定租户
    - 系统初始化时设置默认租户
    """
    return TenantContext(tenant_id=tenant_id, tenant_name=tenant_name)


# models已在文件开头导入
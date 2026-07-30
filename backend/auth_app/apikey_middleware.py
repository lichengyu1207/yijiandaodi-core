"""
API Key认证中间件
支持X-API-Key头部认证
"""

from django.http import JsonResponse
import time
import hashlib


class APIKeyAuthenticationMiddleware:
    """API Key认证中间件"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # 检查是否有X-API-Key头部
        api_key_header = request.headers.get('X-API-Key')
        
        if api_key_header:
            # 验证API Key
            auth_result = self.verify_api_key(request, api_key_header)
            
            if not auth_result['success']:
                return JsonResponse(auth_result, status=401)
            
            # 设置用户信息
            request.api_key_user = auth_result.get('user')
            request.api_key_permissions = auth_result.get('permissions')
            request.api_key_id = auth_result.get('api_key_id')
        
        response = self.get_response(request)
        
        return response
    
    def verify_api_key(self, request, api_key_header):
        """验证API Key"""
        from .apikey_models import APIKey

        try:
            # 提取前缀
            key_prefix = api_key_header[:10]

            # 查找所有匹配前缀的API Key
            api_key_objs = APIKey.objects.filter(key_prefix=key_prefix, is_active=True)

            if not api_key_objs.exists():
                return {
                    'success': False,
                    'error': 'API Key无效'
                }

            # 验证密钥哈希
            key_hash = hashlib.sha256(api_key_header.encode()).hexdigest()
            api_key_obj = None
            for obj in api_key_objs:
                if obj.key_hash == key_hash:
                    api_key_obj = obj
                    break

            if not api_key_obj:
                return {
                    'success': False,
                    'error': 'API Key验证失败'
                }

            # 检查过期
            if api_key_obj.is_expired():
                return {
                    'success': False,
                    'error': 'API Key已过期'
                }

            # 更新最后使用时间
            api_key_obj.update_last_used()

            # 记录使用日志（异步）
            self.log_api_usage(request, api_key_obj)

            return {
                'success': True,
                'user': api_key_obj.user,
                'permissions': api_key_obj.permissions,
                'api_key_id': api_key_obj.id
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'验证异常: {str(e)}'
            }
    
    def log_api_usage(self, request, api_key_obj):
        """记录API使用日志"""
        from .apikey_models import APIKeyUsageLog
        
        try:
            start_time = getattr(request, 'start_time', time.time())
            response_time_ms = int((time.time() - start_time) * 1000)
            
            APIKeyUsageLog.objects.create(
                api_key=api_key_obj,
                endpoint=request.path,
                method=request.method,
                status_code=200,  # 这里会在response后更新
                response_time_ms=response_time_ms,
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:255]
            )
        except Exception as e:
            print(f"记录API使用日志失败: {str(e)}")
    
    def get_client_ip(self, request):
        """获取客户端IP"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class APIKeyPermissionMixin:
    """API Key权限检查Mixin"""
    
    def check_api_key_permission(self, request, permission):
        """检查API Key是否有指定权限"""
        if hasattr(request, 'api_key_permissions'):
            return permission in request.api_key_permissions
        return True  # 如果不是API Key请求，跳过检查
    
    def dispatch(self, request, *args, **kwargs):
        """请求分发"""
        # 检查权限
        method_permission_map = {
            'GET': 'read',
            'POST': 'write',
            'PUT': 'write',
            'PATCH': 'write',
            'DELETE': 'delete'
        }
        
        required_permission = method_permission_map.get(request.method)
        if required_permission and hasattr(request, 'api_key_permissions'):
            if not self.check_api_key_permission(request, required_permission):
                return JsonResponse({
                    'success': False,
                    'error': f'API Key缺少 {required_permission} 权限'
                }, status=403)
        
        return super().dispatch(request, *args, **kwargs)
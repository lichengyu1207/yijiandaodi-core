"""
API Key认证类
用于Django REST Framework
"""

from rest_framework import authentication, exceptions
from django.contrib.auth.models import AnonymousUser
import hashlib

from .apikey_models import APIKey


class APIKeyAuthentication(authentication.BaseAuthentication):
    """API Key认证类"""

    def authenticate(self, request):
        """认证API Key"""
        # 检查是否有X-API-Key头部
        api_key_header = request.headers.get('X-API-Key')

        if not api_key_header:
            # 没有API Key，返回None让其他认证类处理
            return None

        # 验证API Key
        try:
            # 提取前缀
            key_prefix = api_key_header[:10]

            # 查找所有匹配前缀的API Key
            api_key_objs = APIKey.objects.filter(key_prefix=key_prefix, is_active=True)

            if not api_key_objs.exists():
                raise exceptions.AuthenticationFailed('API Key无效')

            # 验证密钥哈希
            key_hash = hashlib.sha256(api_key_header.encode()).hexdigest()
            api_key_obj = None
            for obj in api_key_objs:
                if obj.key_hash == key_hash:
                    api_key_obj = obj
                    break

            if not api_key_obj:
                raise exceptions.AuthenticationFailed('API Key验证失败')

            # 检查过期
            if api_key_obj.is_expired():
                raise exceptions.AuthenticationFailed('API Key已过期')

            # 更新最后使用时间
            api_key_obj.update_last_used()

            # 保存API Key信息到request
            request.api_key = api_key_obj
            request.api_key_permissions = api_key_obj.permissions

            # 返回用户和认证信息
            return (api_key_obj.user, api_key_obj)

        except Exception as e:
            raise exceptions.AuthenticationFailed(f'API Key验证异常: {str(e)}')

    def authenticate_header(self, request):
        """返回认证头部名称"""
        return 'API Key'
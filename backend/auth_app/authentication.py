"""
认证模块
提供JWT认证和Cookie认证
"""

from rest_framework import authentication, exceptions
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


class CookieJWTAuthentication(authentication.BaseAuthentication):
    """
    基于Cookie的JWT认证
    从Cookie中读取JWT token进行验证
    """

    def authenticate(self, request):
        # 从Cookie中获取token
        access_token = request.COOKIES.get('yijiandaodi_access_token')

        if not access_token:
            # 尝试从Authorization header获取
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                access_token = auth_header.split(' ')[1]

        if not access_token:
            return None  # 没有token，返回None让其他认证方式处理

        try:
            # 使用JWTAuthentication验证token
            jwt_auth = JWTAuthentication()
            validated_token = jwt_auth.get_validated_token(access_token)

            # 获取用户
            user = jwt_auth.get_user(validated_token)

            if not user.is_active:
                raise exceptions.AuthenticationFailed('用户已被禁用')

            return (user, validated_token)

        except (InvalidToken, TokenError) as e:
            logger.warning(f'JWT认证失败: {str(e)}')
            raise exceptions.AuthenticationFailed('无效的认证token')
        except Exception as e:
            logger.error(f'认证异常: {str(e)}')
            raise exceptions.AuthenticationFailed('认证失败')

    def authenticate_header(self, request):
        return 'Bearer'


class SessionAuthentication(authentication.SessionAuthentication):
    """
    Session认证
    用于管理后台认证
    """

    def authenticate(self, request):
        # 获取session中的用户ID
        user_id = request.session.get('user_id')

        if not user_id:
            return None

        try:
            user = User.objects.get(id=user_id)
            if not user.is_active:
                raise exceptions.AuthenticationFailed('用户已被禁用')
            return (user, None)
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed('用户不存在')


class APIKeyAuthentication(authentication.BaseAuthentication):
    """
    API Key认证
    用于插件与服务器之间的认证
    """

    def authenticate(self, request):
        # 从header中获取API Key
        api_key = request.META.get('HTTP_X_API_KEY')

        if not api_key:
            return None

        # 验证API Key（这里简化处理，实际应该查询数据库）
        # TODO: 实现API Key验证逻辑

        return None
"""
JWT HttpOnly Cookie 认证后端
替代 Bearer Header 方式，防止 XSS 窃取 Token
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework import exceptions


class JWTCookieAuthentication(JWTAuthentication):
    """从 httpOnly Cookie 中读取 JWT Token 进行认证"""

    def authenticate(self, request):
        """优先从 Cookie 获取 Token，兼容 Header 方式"""
        # 1. 先尝试从 Cookie 获取（安全方式）
        cookie_token = request.COOKIES.get('access_token')
        if cookie_token:
            try:
                validated_token = self.get_validated_token(cookie_token)
                return self.get_user(validated_token), validated_token
            except exceptions.AuthenticationException:
                pass  # Cookie 无效或过期，继续尝试 Header

        # 2. 兼容：从 Header 获取（用于 API 调用/调试）
        return super().authenticate(request)

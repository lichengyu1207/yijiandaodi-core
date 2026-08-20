from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from datetime import timedelta
from django.core.cache import cache
from django.conf import settings
import secrets

from .models import User, BlacklistedToken, LoginLog
from .serializers import LoginSerializer, UserSerializer, UserInfoSerializer, LoginLogSerializer, RegisterSerializer
import logging

logger = logging.getLogger(__name__)


def safe_error_response(message: str = '内部服务错误，请稍后重试', status_code=500):
    """生产安全错误响应 - 不泄露内部异常详情"""
    return Response({
        'success': False,
        'message': message,
        'error_code': f'SERVER_{status_code}'
    }, status=status_code)


def _get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def _get_client_user_agent(request):
    return request.META.get('HTTP_USER_AGENT', '')


def _check_login_rate_limit(request):
    ip = _get_client_ip(request)
    cache_key = f'login_attempts_{ip}'
    attempts = cache.get(cache_key, 0)
    if attempts >= 5:
        lockout_key = f'login_lockout_{ip}'
        if cache.get(lockout_key):
            return False, '登录尝试过于频繁，请15分钟后重试'
    return True, None


class SystemStatusView(APIView):
    permission_classes = []

    def get(self, request):
        now = timezone.now()
        return Response({
            'success': True,
            'data': {
                'status': 'online',
                'server_time': now.isoformat(),
            }
        })


class SetupStatusView(APIView):
    """首次运行探测：是否已有用户（桌面端据此决定进入「设置账号」引导还是「登录」页）"""
    permission_classes = []

    def get(self, request):
        has_users = User.objects.exists()
        has_superuser = User.objects.filter(is_superuser=True).exists()
        return Response({
            'success': True,
            'data': {
                'is_initialized': has_users,
                'has_users': has_users,
                'has_superuser': has_superuser,
            }
        })


class LoginView(APIView):
    permission_classes = []

    def post(self, request):
        allowed, msg = _check_login_rate_limit(request)
        if not allowed:
            return Response({'success': False, 'message': msg}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        username = request.data.get('username', '')
        ip_address = _get_client_ip(request)
        user_agent = _get_client_user_agent(request)

        serializer = LoginSerializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
            user = serializer.validated_data['user']

            cache.delete(f'login_attempts_{ip_address}')
            cache.delete(f'login_lockout_{ip_address}')

            LoginLog.objects.create(
                user=user,
                ip_address=ip_address,
                user_agent=user_agent,
                status='success'
            )

            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)

            response = Response({
                'success': True,
                'message': '登录成功',
                'data': {
                    'token': access_token,
                    'refresh_token': refresh_token,
                    'user': UserInfoSerializer(user).data,
                    'expires_in': 7200,
                }
            }, status=status.HTTP_200_OK)

            # 设置 httpOnly Cookie（前端不再 localStorage 存 token）
            response.set_cookie(
                key='access_token',
                value=access_token,
                max_age=7200,          # 2 小时
                httponly=True,         # 防 XSS 窃取
                secure=False,           # 开发环境用 http
                samesite='Lax',
                path='/',
            )
            response.set_cookie(
                key='refresh_token',
                value=refresh_token,
                max_age=2592000,       # 30 天（桌面端登录态持久化，配合 REFRESH_TOKEN_LIFETIME）
                httponly=True,
                secure=False,
                samesite='Lax',
                path='/',
            )
            return response
        except Exception as e:
            cache_key = f'login_attempts_{ip_address}'
            attempts = cache.get(cache_key, 0) + 1
            cache.set(cache_key, attempts, timeout=900)
            if attempts >= 5:
                lockout_key = f'login_lockout_{ip_address}'
                cache.set(lockout_key, True, timeout=900)

            try:
                user_obj = User.objects.filter(username=username).first()
                if user_obj:
                    LoginLog.objects.create(
                        user=user_obj,
                        ip_address=ip_address,
                        user_agent=user_agent,
                        status='failed'
                    )
            except Exception:
                pass

            raise e


class RegisterView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)

            if not request.data.get('privacy_agreed'):
                return Response({
                    'success': False,
                    'message': '请阅读并同意《隐私政策》和《服务协议》'
                }, status=status.HTTP_400_BAD_REQUEST)

            ip_rate_key = f'register_ip_{_get_client_ip(request)}'
            from django.core.cache import cache
            if cache.get(ip_rate_key):
                return Response({
                    'success': False,
                    'message': '注册过于频繁，请稍后再试'
                }, status=status.HTTP_429_TOO_MANY_REQUESTS)
            cache.set(ip_rate_key, True, timeout=60)

            username = serializer.validated_data['username']
            password = serializer.validated_data['password']
            email = serializer.validated_data.get('email', '')

            user = User.objects.create_user(
                username=username,
                email=email or None,
                password=password,
                role='viewer'
            )

            # 创建隐私政策同意记录
            from .system_models import PrivacyAgreement, UserConsentRecord
            
            # 获取当前生效的隐私政策
            privacy_policy = PrivacyAgreement.objects.filter(
                agreement_type='privacy',
                is_active=True
            ).first()
            
            terms_policy = PrivacyAgreement.objects.filter(
                agreement_type='terms',
                is_active=True
            ).first()
            
            # 创建隐私政策同意记录
            if privacy_policy:
                UserConsentRecord.objects.create(
                    user_id=user.id,
                    username=user.username,
                    agreement_type='privacy',
                    agreement_version=privacy_policy.version,
                    status='agreed',
                    ip_address=_get_client_ip(request),
                    user_agent=_get_client_user_agent(request)
                )
            
            # 创建服务条款同意记录
            if terms_policy:
                UserConsentRecord.objects.create(
                    user_id=user.id,
                    username=user.username,
                    agreement_type='terms',
                    agreement_version=terms_policy.version,
                    status='agreed',
                    ip_address=_get_client_ip(request),
                    user_agent=_get_client_user_agent(request)
                )

            return Response({
                'success': True,
                'message': '注册成功，请登录',
                'data': {
                    'user_id': user.id,
                    'username': user.username,
                    'privacy_version': privacy_policy.version if privacy_policy else '1.0',
                    'terms_version': terms_policy.version if terms_policy else '1.0',
                }
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            raise e


class UserInfoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response({
            'success': True,
            'data': serializer.data
        })


DESKTOP_LOGIN_TOKEN_TTL = 300  # 5 分钟


class DesktopLoginTokenView(APIView):
    """桌面端→官网登录态同步（P1 账号互通一期）

    登录用户请求一次性临时 token（5 分钟、用后即销毁），
    桌面端将其拼到官网 URL 后经 shell.openExternal 打开，
    官网前端用该 token 兑换正式 JWT（见 ExchangeDesktopTokenView）。
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = secrets.token_urlsafe(32)
        cache_key = f'desktop_login_token:{token}'
        cache.set(cache_key, request.user.id, timeout=DESKTOP_LOGIN_TOKEN_TTL)
        return Response({
            'success': True,
            'message': '临时登录 token 已生成',
            'data': {
                'token': token,
                'expires_in': DESKTOP_LOGIN_TOKEN_TTL,
            }
        })


class ExchangeDesktopTokenView(APIView):
    """官网前端用一次性临时 token 兑换正式登录态（用后即销毁）"""
    permission_classes = []

    def post(self, request):
        token = (request.data.get('token') or '').strip()
        if not token:
            return Response({
                'success': False,
                'message': '缺少临时登录 token'
            }, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'desktop_login_token:{token}'
        user_id = cache.get(cache_key)
        if not user_id:
            return Response({
                'success': False,
                'message': '临时登录 token 无效或已过期'
            }, status=status.HTTP_401_UNAUTHORIZED)

        # 一次性：用后立即销毁，防止重放
        cache.delete(cache_key)

        user = User.objects.filter(id=user_id, is_active=True).first()
        if not user:
            return Response({
                'success': False,
                'message': '账号不存在或已停用'
            }, status=status.HTTP_401_UNAUTHORIZED)

        ip_address = _get_client_ip(request)
        LoginLog.objects.create(
            user=user,
            ip_address=ip_address,
            user_agent=_get_client_user_agent(request),
            status='desktop_sync'
        )

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        response = Response({
            'success': True,
            'message': '登录成功',
            'data': {
                'token': access_token,
                'refresh_token': refresh_token,
                'user': UserInfoSerializer(user).data,
                'expires_in': 7200,
            }
        }, status=status.HTTP_200_OK)

        # 与 LoginView 一致的 httpOnly Cookie 双保险
        response.set_cookie(
            key='access_token',
            value=access_token,
            max_age=7200,
            httponly=True,
            secure=False,
            samesite='Lax',
            path='/',
        )
        response.set_cookie(
            key='refresh_token',
            value=refresh_token,
            max_age=2592000,
            httponly=True,
            secure=False,
            samesite='Lax',
            path='/',
        )
        return response


class VerifyTokenView(APIView):
    """校验 Access Token 是否有效（供桌面端 validateToken 调用）"""
    permission_classes = []

    def get(self, request):
        from rest_framework_simplejwt.authentication import JWTAuthentication
        auth = JWTAuthentication()
        raw = request.headers.get('Authorization', '')
        try:
            if raw.lower().startswith('bearer '):
                raw = raw[7:].strip()
            validated_token = auth.get_validated_token(raw)
            user = auth.get_user(validated_token)
            return Response({
                'success': True,
                'valid': True,
                'data': UserInfoSerializer(user).data
            })
        except Exception:
            return Response({
                'success': False,
                'valid': False
            }, status=status.HTTP_401_UNAUTHORIZED)


class RefreshTokenView(APIView):
    """刷新 Access Token（供桌面端 refreshToken 调用）"""
    permission_classes = []

    def post(self, request):
        refresh_token = request.data.get('refresh', '')
        try:
            refresh = RefreshToken(refresh_token)
            access_token = str(refresh.access_token)

            # ROTATE_REFRESH_TOKENS=True 轮换逻辑（与 simplejwt TokenRefreshSerializer 一致）：
            # 1) 拉黑旧的 refresh token；2) 基于原对象签发新的 refresh token 返回给客户端
            try:
                refresh.blacklist()
            except AttributeError:
                # 未启用 blacklist app 时忽略
                pass
            refresh.set_jti()
            refresh.set_exp()
            refresh.set_iat()
            new_refresh_token = str(refresh)

            return Response({
                'success': True,
                'access': access_token,
                'refresh': new_refresh_token,
                'expires_in': 7200,
            })
        except Exception:
            return Response({
                'success': False,
                'message': '无效的 refresh token'
            }, status=status.HTTP_401_UNAUTHORIZED)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            auth_header = request.META.get('HTTP_AUTHORIZATION')
            if auth_header and auth_header.startswith('Bearer '):
                token_string = auth_header.split(' ')[1]

                # 说明：simplejwt 的 token_blacklist 仅支持吊销 RefreshToken，
                # AccessToken 为无状态短令牌，不受拉黑管理。这里保留自定义黑名单记录用于审计。
                BlacklistedToken.objects.create(
                    token=token_string,
                    user=request.user,
                    expires_at=timezone.now() + timedelta(days=7)
                )

            # 清除 httpOnly Cookie
            response = Response({
                'success': True,
                'message': '已退出登录'
            })
            response.delete_cookie('access_token', path='/')
            response.delete_cookie('refresh_token', path='/')
            return response
        except Exception as e:
            logger.error(f"Logout error: {e}", exc_info=True)
            return safe_error_response(message='退出登录失败，请稍后重试', status_code=400)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        if not old_password or not new_password:
            return Response({
                'success': False,
                'message': '请填写旧密码和新密码'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.check_password(old_password):
            return Response({
                'success': False,
                'message': '旧密码错误'
            }, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response({
                'success': False,
                'message': '新密码长度不能少于8位'
            }, status=status.HTTP_400_BAD_REQUEST)

        if old_password == new_password:
            return Response({
                'success': False,
                'message': '新密码不能与旧密码相同'
            }, status=status.HTTP_400_BAD_REQUEST)

        import re
        if not (re.search(r'[a-z]', new_password) and re.search(r'[0-9]', new_password)):
            return Response({
                'success': False,
                'message': '新密码必须包含字母和数字'
            }, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        request.user.save()

        BlacklistedToken.objects.filter(user=request.user).delete()
        LoginLog.objects.create(
            user=request.user,
            ip_address=_get_client_ip(request),
            user_agent=_get_client_user_agent(request),
            status='password_changed'
        )

        return Response({
            'success': True,
            'message': '密码修改成功，请重新登录'
        })


class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        confirm_text = request.data.get('confirm', '')
        if confirm_text != '永久注销':
            return Response({
                'success': False,
                'message': '请输入"永久注销"确认操作'
            }, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        BlacklistedToken.objects.filter(user=user).delete()

        from content_app.models import ArticleLike, ArticleComment, UserFollow
        ArticleLike.objects.filter(user_id=user.id).delete()
        ArticleComment.objects.filter(user_id=user.id).delete()
        UserFollow.objects.filter(user_id=user.id).delete()
        LoginLog.objects.filter(user=user).delete()

        username_backup = f'deleted_{user.id}_{user.username[:20]}'
        user.username = username_backup
        user.email = ''
        user.avatar = ''
        user.is_active = False
        user.set_password(secrets.token_urlsafe(32))
        user.save()

        return Response({
            'success': True,
            'message': '账号已注销，所有个人数据已清除'
        })


class UserListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return Response({
                'success': False,
                'message': '需要管理员权限'
            }, status=status.HTTP_403_FORBIDDEN)
        return self.list(request, *args, **kwargs)

    def get_queryset(self):
        queryset = User.objects.all()
        role_filter = self.request.query_params.get('role')
        if role_filter:
            queryset = queryset.filter(role=role_filter)
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'message': '获取用户列表成功',
            'data': serializer.data
        })


class UserUpdateView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def put(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return Response({
                'success': False,
                'message': '需要管理员权限'
            }, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        allowed_fields = ['role', 'is_active']
        data = {k: v for k, v in request.data.items() if k in allowed_fields}
        serializer = self.get_serializer(instance, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'success': True,
            'message': '用户更新成功',
            'data': serializer.data
        })


class LoginLogListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LoginLogSerializer

    def get_queryset(self):
        return LoginLog.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'message': '获取登录日志成功',
            'data': serializer.data
        })

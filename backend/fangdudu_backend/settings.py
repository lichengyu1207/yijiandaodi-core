import os
import secrets
import warnings
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

# 加载 .env 环境变量文件（密钥等敏感配置从 .env 读取，禁止硬编码到源码）
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / '.env')
except ImportError:
    pass

SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    SECRET_KEY = secrets.token_urlsafe(50)
    warnings.warn(
        "[SECURITY] SECRET_KEY not set in environment! Using auto-generated key. "
        "Set SECRET_KEY env var for production.",
        stacklevel=2,
    )

DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'

# ALLOWED_HOSTS：从环境变量读取，支持逗号分隔多域名
_allowed_hosts = os.environ.get('ALLOWED_HOSTS', '')
ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts.split(',') if h.strip()] \
    if _allowed_hosts \
    else (['*', 'testserver'] if DEBUG else ['localhost', '127.0.0.1'])

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sitemaps',          # 站点地图

    # Third-party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Custom apps
    'auth_app',
    'content_app',
    'data_app',
    'p2p_app',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'auth_app.apikey_middleware.APIKeyAuthenticationMiddleware',  # API Key认证中间件
    'fangdudu_backend.tracing_middleware.TracingMiddleware',  # 请求追踪中间件（新增）
    'fangdudu_backend.tenant_middleware.TenantIsolationMiddleware',  # 租户隔离中间件
    'fangdudu_backend.security_middleware.SecurityAuditMiddleware',
]

ROOT_URLCONF = 'fangdudu_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'fangdudu_backend.wsgi.application'

# Database - 自动检测：Docker 部署用 PostgreSQL，本地开发用 SQLite
import json

_db_host = os.environ.get('DB_HOST', '')

if _db_host and _db_host != 'localhost':
    # Docker / 生产环境：PostgreSQL
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME', 'fangdudu_main'),
            'USER': os.environ.get('DB_USER', 'postgres'),
            'PASSWORD': os.environ.get('DB_PASSWORD', ''),
            'HOST': _db_host,
            'PORT': int(os.environ.get('DB_PORT', 5432)),
        }
    }
else:
    # 本地开发：SQLite
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Auth User Model
AUTH_USER_MODEL = 'auth_app.User'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'zh-hans'
TIME_ZONE = 'Asia/Shanghai'
USE_I18N = True
USE_TZ = True

# 站点地图
SITE_ID = 1

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# 请求体大小限制（防止大文件上传导致内存耗尽/DoS）
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB
DATA_UPLOAD_MAX_NUMBER_FIELDS = 2000
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024   # 10MB

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'auth_app.apikey_authentication.APIKeyAuthentication',  # API Key认证
        'auth_app.cookie_auth.JWTCookieAuthentication',  # httpOnly Cookie 优先
        'rest_framework_simplejwt.authentication.JWTAuthentication',  # 兼容 Header
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
}

# CORS settings (for frontend development)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://admin.fangdudu.top",
]
if DEBUG:
    CORS_ALLOWED_ORIGINS.append("http://localhost:3000")
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# ===== Security Headers & Hardening =====
# [生产环境] 以下 SSL/安全 Cookie 相关配置在生产环境需开启（当前为 False 以兼容开发/HTTP 部署）
SECURE_SSL_REDIRECT = False          # 生产环境建议: True（需确保 HTTPS 已正确配置）
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = 0              # 生产环境建议: 31536000（1年）
SECURE_HSTS_INCLUDE_SUBDOMAINS = False  # 生产环境建议: True
SECURE_HSTS_PRELOAD = False           # 生产环境建议: True
SESSION_COOKIE_SECURE = False         # 生产环境建议: True（仅 HTTPS 传输）
CSRF_COOKIE_SECURE = False            # 生产环境建议: True（仅 HTTPS 传输）
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
X_FRAME_OPTIONS = 'DENY'
CONTENT_TYPE_NOSNIFFING = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
SECURE_CONTENT_TYPE_NOSNIFFING = True
SECURE_BROWSER_XSS_FILTER = True

# Password strength requirements (already defined above, do not duplicate)

# JWT hardening
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# DeepSeek API 多 Key 轮换池（逗号分隔，生产环境建议通过环境变量注入）
DEEPSEEK_API_KEYS = os.environ.get('DEEPSEEK_API_KEYS',
    'sk-d8d631cfd0b04280810fd37dec9e6bf3,sk-78d7f40a90d247a399d260ca1d31b48f,sk-6933250bf4de49ec902a89b86f7a0307,sk-b35e36723b6b4a2994cfae367b75e86f'
)
DEEPSEEK_BASE_URL = os.environ.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1')
DEEPSEEK_MODEL = os.environ.get('DEEPSEEK_MODEL', 'deepseek-chat')

# DRF security settings
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = [
    'rest_framework.throttling.AnonRateThrottle',
    'rest_framework.throttling.UserRateThrottle',
]
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'anon': '100/hour',
    'user': '1000/hour',
}

# ===== Security Audit Logging (网络安全法第21条: 日志留存≥6个月) =====
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'audit': {
            'format': '%(asctime)s | %(levelname)-8s | %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
        'json': {
            'format': '{"time": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": %(message)s}',
        },
    },
    'handlers': {
        'security_audit_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'security_audit.log',
            'maxBytes': 50 * 1024 * 1024,
            'backupCount': 180,
            'encoding': 'utf-8',
        },
        'security_console': {
            'level': 'WARNING',
            'class': 'logging.StreamHandler',
            'formatter': 'audit',
        },
        'tracing_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'tracing.log',
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'encoding': 'utf-8',
            'formatter': 'json',
        },
        'tracing_console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'json',
        },
    },
    'loggers': {
        'security_audit': {
            'handlers': ['security_audit_file', 'security_console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.security': {
            'handlers': ['security_console'],
            'level': 'WARNING',
            'propagate': True,
        },
        'tracing': {
            'handlers': ['tracing_file', 'tracing_console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

import os
os.makedirs(BASE_DIR / 'logs', exist_ok=True)

# Django Channels 配置
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    },
}

ASGI_APPLICATION = 'fangdudu_backend.asgi.application'

# 生产环境使用 Redis Channel Layer (取消注释并注释掉上面的 InMemory 配置)
# CHANNEL_LAYERS = {
#     'default': {
#         'BACKEND': 'channels_redis.core.RedisChannelLayer',
#         'CONFIG': {
#             "hosts": [('127.0.0.1', 6379)],
#         },
#     },
# }

# ===== 支付宝支付配置 =====
# 环境切换: True=沙箱环境(测试), False=生产环境(正式)
ALIPAY_SANDBOX = os.environ.get('ALIPAY_SANDBOX', 'False').lower() == 'true'

# 沙箱网关地址
ALIPAY_SANDBOX_GATEWAY = os.environ.get(
    'ALIPAY_SANDBOX_GATEWAY',
    'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
)

# 生产网关地址
ALIPAY_GATEWAY = os.environ.get(
    'ALIPAY_GATEWAY',
    'https://openapi.alipay.com/gateway.do'
)

# 应用配置（从 .env 环境变量读取，禁止硬编码密钥到源码）
# Python 使用 PKCS#1 格式私钥 (appPrivatePkcsKey)，禁止使用 PKCS#8 格式 (appPrivateKey)
ALIPAY_APP_ID = os.environ.get('ALIPAY_APP_ID', '')
ALIPAY_PRIVATE_KEY = os.environ.get('ALIPAY_PRIVATE_KEY', '')
ALIPAY_PUBLIC_KEY = os.environ.get('ALIPAY_PUBLIC_KEY', '')

# 回调地址（支付宝支付完成后的通知/跳转地址）
# 请根据实际部署域名修改，确保公网可访问
ALIPAY_NOTIFY_URL = os.environ.get(
    'ALIPAY_NOTIFY_URL',
    ''
)
ALIPAY_RETURN_URL = os.environ.get(
    'ALIPAY_RETURN_URL',
    ''
)
ALIPAY_QUIT_URL = os.environ.get(
    'ALIPAY_QUIT_URL',
    'https://yijiandaodi.com/pricing'
)

# ===== Celery 消息队列配置 =====
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Shanghai'
CELERY_ENABLE_UTC = True
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30分钟超时
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25分钟软超时
CELERY_WORKER_PREFETCH_MULTIPLIER = 4
CELERY_WORKER_MAX_TASKS_PER_CHILD = 1000
CELERY_TASK_ROUTES = {
    'auth_app.tasks.send_email_notification': {'queue': 'notifications'},
    'auth_app.tasks.send_websocket_notification': {'queue': 'notifications'},
    'auth_app.tasks.cleanup_*': {'queue': 'maintenance'},
    'auth_app.tasks.generate_daily_stats': {'queue': 'analytics'},
    'auth_app.tasks.check_agent_health': {'queue': 'security'},
    'auth_app.tasks.aggregate_alerts': {'queue': 'security'},
}

# ===== Django 缓存配置 =====
# 优先使用Redis，不可用时回退到本地内存缓存
try:
    import redis
    redis_client = redis.from_url(os.environ.get('REDIS_URL', 'redis://localhost:6379/2'))
    redis_client.ping()
    REDIS_AVAILABLE = True
except Exception:
    REDIS_AVAILABLE = False

if REDIS_AVAILABLE:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': os.environ.get('REDIS_URL', 'redis://localhost:6379/2'),
            'KEY_PREFIX': 'yijiandaodi',
            'TIMEOUT': 3600,  # 1小时默认过期
        },
        'session': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': os.environ.get('REDIS_URL', 'redis://localhost:6379/3'),
            'KEY_PREFIX': 'yijiandaodi_session',
            'TIMEOUT': 86400,  # 24小时
        },
    }
    SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
    SESSION_CACHE_ALIAS = 'session'
else:
    # 本地开发环境使用内存缓存
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'yijiandaodi-cache',
        },
        'session': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'yijiandaodi-session',
        },
    }
    SESSION_ENGINE = 'django.contrib.sessions.backends.db'

# ===== 多租户配置 =====
TENANT_MODEL = 'auth_app.Enterprise'
TENANT_DOMAIN_MODEL = None
TENANT_DEFAULT_NAME = 'default'
TENANT_CREATION_FIELDS = ['company_name', 'contact_email', 'contact_phone']

# 公共模型（不按租户隔离）
PUBLIC_MODELS = [
    'auth_app.User',
    'auth_app.BlacklistedToken',
    'auth_app.LoginLog',
    'auth_app.AuditLog',
]


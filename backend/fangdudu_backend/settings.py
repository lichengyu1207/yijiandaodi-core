import os
import secrets
import warnings
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

# 运行时数据目录（PyInstaller 打包生产环境用）：
# 安装目录可能只读（Program Files），DB/密钥/日志/媒体统一落到可写位置。
# 未设置时回退 BASE_DIR（本地开发保持原行为）。
DATA_DIR = Path(os.environ.get('YJD_DATA_DIR') or BASE_DIR)

# 加载 .env 环境变量文件（密钥等敏感配置从 .env 读取，禁止硬编码到源码）
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / '.env')
except ImportError:
    pass

SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    # 环境变量未设置 → 尝试从本地持久化文件读取（防止重启 token 全部失效）
    secret_key_path = DATA_DIR / '.secret_key'
    if secret_key_path.exists():
        with open(secret_key_path, 'r') as f:
            SECRET_KEY = f.read().strip()
    else:
        # 文件也不存在 → 生成并持久化到磁盘（下次启动读取同一份）
        SECRET_KEY = secrets.token_urlsafe(50)
        try:
            with open(secret_key_path, 'w') as f:
                f.write(SECRET_KEY)
        except OSError:
            warnings.warn(
                "[SECURITY] Failed to persist .secret_key to disk! "
                "SECRET_KEY will change on every restart, which invalidates all existing JWT tokens.",
                stacklevel=2,
            )
        warnings.warn(
            "[SECURITY] SECRET_KEY not set in environment! Using auto-generated and persisted key. "
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
    'rest_framework_simplejwt.token_blacklist',
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
            'NAME': DATA_DIR / 'db.sqlite3',
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
MEDIA_ROOT = DATA_DIR / 'media'

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
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://admin.fangdudu.top",
]
if DEBUG:
    CORS_ALLOWED_ORIGINS.extend(["http://localhost:5173", "http://127.0.0.1:5173"])
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
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# DeepSeek API 多 Key 轮换池（逗号分隔）。
# 安全：密钥必须通过环境变量注入，严禁硬编码在源码中；未配置时默认空，相关功能自动停用。
DEEPSEEK_API_KEYS = os.environ.get('DEEPSEEK_API_KEYS', '')
DEEPSEEK_BASE_URL = os.environ.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1')
DEEPSEEK_MODEL = os.environ.get('DEEPSEEK_MODEL', 'deepseek-chat')

# ===== DeepSeek 预算闸门（成本控制）=====
# 每日全局调用上限（0 = 不限制）。默认 200 次共享平台额度，超出后拦截并提示用户绑定自有 Key。
DEEPSEEK_DAILY_CALL_LIMIT = int(os.environ.get('DEEPSEEK_DAILY_CALL_LIMIT', '200'))
# 每用户每日调用上限（0 = 不限制）
DEEPSEEK_USER_DAILY_CALL_LIMIT = int(os.environ.get('DEEPSEEK_USER_DAILY_CALL_LIMIT', '0'))
# 连续失败（401/429/5xx/超时）触发熔断的阈值
DEEPSEEK_CIRCUIT_BREAKER_THRESHOLD = int(os.environ.get('DEEPSEEK_CIRCUIT_BREAKER_THRESHOLD', '5'))
# 熔断持续时间（秒）
DEEPSEEK_CIRCUIT_BREAKER_COOLDOWN = int(os.environ.get('DEEPSEEK_CIRCUIT_BREAKER_COOLDOWN', '300'))

# ===== P1-2 计费落库：DeepSeek 单价（元 / 百万 tokens）=====
DEEPSEEK_INPUT_PRICE = float(os.environ.get('DEEPSEEK_INPUT_PRICE', '0.5'))   # 输入
DEEPSEEK_OUTPUT_PRICE = float(os.environ.get('DEEPSEEK_OUTPUT_PRICE', '2.0'))  # 输出

# ===== P1-2 消费额度预警阈值（百分比）=====
# 仅当未配置 /api/settings/quota-alert 时作为默认值；get_quota_status 返回 ratio（0.8/0.95）
DEEPSEEK_BUDGET_WARN_THRESHOLD = int(os.environ.get('DEEPSEEK_BUDGET_WARN_THRESHOLD', '80'))
DEEPSEEK_BUDGET_CRITICAL_THRESHOLD = int(os.environ.get('DEEPSEEK_BUDGET_CRITICAL_THRESHOLD', '95'))

# ===== P1-5 推理引擎统一接口（M2）：默认推理提供者（deepseek / grok）=====
INFERENCE_PROVIDER = os.environ.get('INFERENCE_PROVIDER', 'deepseek')

# ===== P3 M4 推理集群接入：本地优先 + 过载回退路由 =====
INFERENCE_ROUTER = {
    'enabled': os.environ.get('INFERENCE_ROUTER_ENABLED', 'false').lower() == 'true',
    'local_overload_ratio': float(os.environ.get('LOCAL_OVERLOAD_RATIO', '0.9')),
    'max_local_concurrency': int(os.environ.get('MAX_LOCAL_CONCURRENCY', '8')),
    'cluster_timeout_sec': float(os.environ.get('CLUSTER_TIMEOUT_SEC', '30')),
    'fallback_enabled': os.environ.get('INFERENCE_FALLBACK_ENABLED', 'true').lower() == 'true',
}

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
        'verbose': {
            'format': '[{levelname}] {asctime} | {name} | {message}',
            'style': '{',
        },
        'performance': {
            'format': '[性能监控] {asctime} | {message}',
            'style': '{',
        },
    },
    'handlers': {
        'security_audit_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': DATA_DIR / 'logs' / 'security_audit.log',
            'maxBytes': 50 * 1024 * 1024,  # 50MB
            'backupCount': 180,  # 180个备份文件（6个月）
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
            'filename': DATA_DIR / 'logs' / 'tracing.log',
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
        # DeepSeek 预算闸门日志处理器（成本控制 / 调用失败排查）
        'deepseek_file': {
            'level': 'DEBUG',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': DATA_DIR / 'logs' / 'deepseek.log',
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 10,
            'encoding': 'utf-8',
            'formatter': 'verbose',
        },
        'deepseek_console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        # 海马体记忆系统日志处理器
        'hippocampus_file': {
            'level': 'DEBUG',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': DATA_DIR / 'logs' / 'hippocampus.log',
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 10,  # 10个备份文件（总共约100MB）
            'encoding': 'utf-8',
            'formatter': 'verbose',
        },
        'hippocampus_console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        # 性能监控日志处理器（单独文件）
        'performance_file': {
            'level': 'DEBUG',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': DATA_DIR / 'logs' / 'performance.log',
            'maxBytes': 5 * 1024 * 1024,  # 5MB
            'backupCount': 20,  # 20个备份文件（总共约100MB）
            'encoding': 'utf-8',
            'formatter': 'performance',
        },
        # 自监控系统日志处理器
        'self_audit_file': {
            'level': 'DEBUG',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': DATA_DIR / 'logs' / 'self_audit.log',
            'maxBytes': 20 * 1024 * 1024,  # 20MB（自监控日志较多）
            'backupCount': 30,  # 30个备份文件（总共约600MB，约一个月）
            'encoding': 'utf-8',
            'formatter': 'verbose',
        },
        'self_audit_console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        # Celery 任务日志处理器
        'celery_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': DATA_DIR / 'logs' / 'celery.log',
            'maxBytes': 20 * 1024 * 1024,  # 20MB
            'backupCount': 10,  # 10个备份文件（总共约200MB）
            'encoding': 'utf-8',
            'formatter': 'verbose',
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
        # DeepSeek 预算闸门日志（调用失败原因 / 熔断 / 配额排查）
        'content_app.deepseek_service': {
            'handlers': ['deepseek_file', 'deepseek_console'],
            'level': 'DEBUG' if DEBUG else 'INFO',  # 开发环境全量，生产只留 INFO/WARNING
            'propagate': False,
        },
        # Agent身份查询日志（生产环境可调整级别）
        'auth_app.agent_identity_models': {
            'handlers': ['security_console'],
            'level': 'DEBUG' if DEBUG else 'WARNING',
            'propagate': False,
        },
        # 海马体记忆系统日志（ChainIndexCounter、LongTermMemory）
        'auth_app.memory_models': {
            'handlers': ['hippocampus_file', 'hippocampus_console', 'performance_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',  # 生产环境使用INFO
            'propagate': False,
        },
        # 海马体记忆视图日志（策略缓存）
        'auth_app.memory_views': {
            'handlers': ['hippocampus_file', 'hippocampus_console', 'performance_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',  # 生产环境使用INFO
            'propagate': False,
        },
        # 自监控系统日志（性能漂移、权限审计、规则时效性）
        'auth_app.self_audit_service': {
            'handlers': ['self_audit_file', 'self_audit_console', 'performance_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',  # 生产环境使用INFO
            'propagate': False,
        },
        # 自监控数据模型日志
        'auth_app.self_audit_models': {
            'handlers': ['self_audit_file', 'self_audit_console'],
            'level': 'DEBUG' if DEBUG else 'WARNING',  # 生产环境使用WARNING
            'propagate': False,
        },
        # Celery 任务日志（包括定时任务）
        'celery': {
            'handlers': ['celery_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'celery.app': {
            'handlers': ['celery_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'celery.worker': {
            'handlers': ['celery_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'celery.beat': {
            'handlers': ['celery_file', 'self_audit_file'],  # Beat任务同时记录到自监控日志
            'level': 'INFO',
            'propagate': False,
        },
    },
}

import os
os.makedirs(DATA_DIR / 'logs', exist_ok=True)

# Django Channels 配置
# 使用 Redis Channel Layer（生产环境）
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [('127.0.0.1', 6379)],
        },
    },
}

ASGI_APPLICATION = 'fangdudu_backend.asgi.application'

# 开发环境使用 InMemory Channel Layer (取消注释并注释掉上面的 Redis 配置)
# CHANNEL_LAYERS = {
#     'default': {
#         'BACKEND': 'channels.layers.InMemoryChannelLayer',
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
    'auth_app.tasks.cleanup_old_activities_task': {'queue': 'maintenance'},
    'auth_app.tasks.archive_old_trajectories_async': {'queue': 'maintenance'},
    'auth_app.tasks.check_disk_space_task': {'queue': 'monitoring'},
    'auth_app.tasks.get_table_sizes_task': {'queue': 'monitoring'},
    'auth_app.tasks.build_trajectory_async': {'queue': 'trajectory'},
}

# Celery Beat配置
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# ===== 数据保留与边界策略 =====
# 合规依据：《网络安全法》第21条（网络日志留存≥6个月）、《个人信息保护法》第19条（保存期限为实现目的之最短时间）、
# 《数据安全法》第21条（数据分类分级）。保留期均可通过环境变量覆盖。
DATA_RETENTION_DAYS = {
    # 安全/操作日志类（含登录 IP、设备等个人信息）：网安法最低 6 个月
    'security_logs': int(os.environ.get('DATA_RETENTION_SECURITY_LOGS', 180)),
    # 计费/消费记录（费用核算，覆盖对账周期 1 年）
    'billing_logs': int(os.environ.get('DATA_RETENTION_BILLING', 365)),
    # 统计聚合快照（聚合数据非原始个人信息，支撑 2 年趋势对比）
    'stats_snapshots': int(os.environ.get('DATA_RETENTION_STATS', 730)),
}

# 统计接口最大可查时间跨度（天），防止超大范围查询拖垮数据库
STATS_MAX_RANGE_DAYS = int(os.environ.get('STATS_MAX_RANGE_DAYS', 730))
# 统计接口单次返回桶数上限（趋势/热力图），超出自动截断
STATS_MAX_BUCKETS = int(os.environ.get('STATS_MAX_BUCKETS', 2000))

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


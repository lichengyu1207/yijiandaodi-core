# -*- mode: python ; coding: utf-8 -*-
"""
一鉴到底 - Django 后端 PyInstaller 打包 spec
产出：dist/backend/backend.exe（onedir，零 Python 依赖）

用法（在 backend 目录下）：
  venv\\Scripts\\python.exe -m PyInstaller packaging\\backend.spec --noconfirm --clean
"""

import os
import sys

from PyInstaller.utils.hooks import collect_all

# PyInstaller 执行 spec 时不提供 __file__，改用内置 SPECPATH（spec 所在目录）
PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(SPEC), '..'))

# ---------------------------------------------------------------------------
# 1) Django 项目源码打进 <dist>/backend/ 目录（运行时由 backend_runner 加进 sys.path）
# ---------------------------------------------------------------------------
_EXCLUDE_TOP = {
    'venv', 'node_modules', '__pycache__', '.git', '.idea', '.vscode',
    'logs', 'media', 'staticfiles', 'dist', 'build', 'release',
}
_EXCLUDE_FILES = {
    'db.sqlite3', '.env', '.secret_key', '*.pyc', '*.pyo', '*.db', '*.sqlite3',
    # 开发期数据播种命令，运行时后端 API 不会引用；源码内含教育性恶意代码示例，
    # 排除以免被静态杀毒引擎当作攻击载荷字符串
    'update_ai_security.py', 'seed_articles.py',
}


def _should_skip(rel: str) -> bool:
    parts = rel.replace('\\', '/').split('/')
    if any(p in _EXCLUDE_TOP for p in parts):
        return True
    if any(p.endswith(suf) for p in parts for suf in ('.pyc', '.pyo')):
        return True
    if any(p in _EXCLUDE_FILES for p in parts):
        return True
    # 测试文件不进安装包
    if any(p.startswith('test_') or p == 'tests.py' for p in parts if p.endswith('.py')):
        return True
    return False


_datas = []
for _root, _dirs, _files in os.walk(PROJECT_DIR):
    _dirs[:] = [d for d in _dirs if d not in _EXCLUDE_TOP and d != '__pycache__']
    for _fname in _files:
        _full = os.path.join(_root, _fname)
        _rel = os.path.relpath(_full, PROJECT_DIR)
        if _should_skip(_rel):
            continue
        _datas.append((_full, os.path.join('backend', os.path.dirname(_rel))))

# ---------------------------------------------------------------------------
# 2) 第三方依赖：collect_all（含模板/静态/翻译等数据文件）
# ---------------------------------------------------------------------------
_DEPS = [
    # Web 框架
    'django', 'rest_framework', 'rest_framework_simplejwt', 'django_filters',
    'corsheaders', 'drf_spectacular',
    # Channels / WebSocket / 异步
    'channels', 'channels_redis', 'websockets', 'asgiref',
    # Celery / 消息
    'celery', 'kombu', 'amqp', 'billiard', 'vine', 'redis',
    # 配置 / 序列化 / 文件
    'dotenv', 'openpyxl', 'xlrd', 'qrcode', 'pyotp',
    # 加密 / 认证
    'cryptography', 'cffi', 'ecdsa', 'rsa', 'pyasn1', 'jose', 'jwt',
    # 数据 / HTTP
    'numpy', 'pillow', 'pymysql', 'msgpack', 'requests', 'urllib3',
    'PyYAML', 'jsonschema', 'jsonschema_specifications', 'ntplib',
    'python_dateutil', 'tzlocal',
]

# alipay SDK 异常庞大（数万个 domain/request/response 模块），全量 collect_all
# 会让打包耗时爆炸且产物臃肿。改为精确列出实际用到的子模块（见 auth_app/alipay_client.py）。
_ALIPAY_IMPORTS = [
    'alipay.aop.api.AlipayClientConfig',
    'alipay.aop.api.DefaultAlipayClient',
    'alipay.aop.api.AlipayPublicKey',
    'alipay.aop.api.util.SignatureUtils',
    'alipay.aop.api.request.AlipayTradePagePayRequest',
    'alipay.aop.api.request.AlipayTradeWapPayRequest',
    'alipay.aop.api.request.AlipayTradeQueryRequest',
    'alipay.aop.api.request.AlipayTradeRefundRequest',
    'alipay.aop.api.domain.AlipayTradePagePayModel',
    'alipay.aop.api.domain.AlipayTradeWapPayModel',
    'alipay.aop.api.domain.AlipayTradeQueryModel',
    'alipay.aop.api.domain.AlipayTradeRefundModel',
]

_binaries = []
_hiddenimports = []
for _pkg in _DEPS:
    try:
        _d, _b, _h = collect_all(_pkg)
        _datas += _d
        _binaries += _b
        _hiddenimports += _h
    except Exception as _exc:  # noqa: BLE001 - 个别包缺失不阻断整体
        print(f'[spec] collect_all 跳过 {_pkg}: {_exc}')

# alipay：只收集实际用到的子模块（精确 hiddenimports），避免全量收集拖慢构建
_hiddenimports += _ALIPAY_IMPORTS

# ---------------------------------------------------------------------------
# 3) 组装
# ---------------------------------------------------------------------------
a = Analysis(
    [os.path.join(os.path.dirname(SPEC), 'backend_runner.py')],
    pathex=[PROJECT_DIR],
    binaries=_binaries,
    datas=_datas,
    hiddenimports=_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    exclude_binaries=True,
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='backend',
)

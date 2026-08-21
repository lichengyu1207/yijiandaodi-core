# -*- mode: python ; coding: utf-8 -*-
"""
一鉴到底 - 沙箱 API PyInstaller 打包 spec
产出：dist/sandbox-api/sandbox-api.exe（onedir，零 Python 依赖）

沙箱服务依赖仓库根本地模块（grok / skill_api / local_data_store / xai_*），
打包时把这些纯 Python 源码以数据形式带入。
"""

import os

from PyInstaller.utils.hooks import collect_all

# PyInstaller 执行 spec 时不提供 __file__，改用内置 SPECPATH（spec 所在目录）
_SPEC_DIR = os.path.abspath(SPECPATH)
REPO_ROOT = os.path.abspath(os.path.join(_SPEC_DIR, '..', '..'))

# 白名单数据收集：只打包沙箱运行真正依赖的文件，避免把整个仓库（openclaw/zip/Redis
# 等无关文件）打进安装包导致体积膨胀与构建失败。
# 附件路径说明：
#   - 仓库根目录的 Python 模块（sandbox_api / xai_grok_* / local_data_store / skill_api …）
#   - grok/grok-python（SDK 源码，sandbox_api 通过 sys.path 引入）
_ALLOW_TOP = {
    # 仓库根文件（由下方白名单精确指定）
    'sandbox_api.py', 'local_data_store.py', 'skill_api.py',
    # grok-python SDK 目录
    'grok',
}


def _collect_whitelist() -> list:
    """只收集白名单顶层文件 + grok/grok-python 目录，返回 [(src, dest)]"""
    datas = []
    for _fname in os.listdir(REPO_ROOT):
        _full = os.path.join(REPO_ROOT, _fname)
        if os.path.isfile(_full) and _fname in _ALLOW_TOP:
            datas.append((_full, '.'))
    # grok/grok-python：仅收集该子目录内的所有文件（不含 grok-build-main 等无关层）
    _gp = os.path.join(REPO_ROOT, 'grok', 'grok-python')
    if os.path.isdir(_gp):
        for _root, _dirs, _files in os.walk(_gp):
            # 排除 node 依赖 / 前端构建产物 / 缓存：这些是 grok-python 自带的前端演示与
            # 临时 JS 依赖，python 沙箱运行不需要，且体积巨大拖垮打包与磁盘
            _dirs[:] = [
                d for d in _dirs
                if d != '__pycache__'
                and not d.startswith('.')
                and d != 'node_modules'
                and d != 'dist'
                and d != 'build'
            ]
            for _fname in _files:
                _full = os.path.join(_root, _fname)
                if _fname.endswith(('.pyc', '.pyo')):
                    continue
                _rel = os.path.relpath(os.path.dirname(_full), REPO_ROOT)
                datas.append((_full, _rel or '.'))
    return datas


_binaries = []
_hiddenimports = []
_datas = _collect_whitelist()
for _pkg in ['cryptography', 'cffi', 'jose', 'jwt', 'requests', 'urllib3', 'pycryptodome']:
    try:
        _d, _b, _h = collect_all(_pkg)
        _datas += _d
        _binaries += _b
        _hiddenimports += _h
    except Exception as _exc:  # noqa: BLE001
        print(f'[spec] collect_all 跳过 {_pkg}: {_exc}')

a = Analysis(
    [os.path.join(_SPEC_DIR, 'sandbox_runner.py')],
    pathex=[REPO_ROOT],
    binaries=_binaries,
    datas=_datas,
    hiddenimports=_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'unittest'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    exclude_binaries=True,
    name='sandbox-api',
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
    name='sandbox-api',
)

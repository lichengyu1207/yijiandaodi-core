#!/usr/bin/env python
"""
一鉴到底 - Django 后端打包入口（PyInstaller 单 exe 版）

职责：让打包后的 backend.exe 在用户机器上「零 Python 依赖」直接跑起来。
  1. 解析可写数据目录（DB / 密钥 / 日志 / 媒体 落到该目录，避免写 Program Files）；
  2. migrate（首次创建表结构，增量幂等）；
  3. 幂等种子数据（套餐/计费模型，update_or_create）；
  4. 启动本地 HTTP 服务（127.0.0.1:8000，桌面应用随启随停）。

用法：
  backend.exe [--host 127.0.0.1] [--port 8000] [--data-dir <path>]
  数据目录缺省：%LOCALAPPDATA%\\一鉴到底\\data
"""

import argparse
import os
import sys

# Windows 控制台默认 GBK(cp936)，无法编码 ¥/✓ 等字符，会导致 print 抛
# UnicodeEncodeError 使种子数据/日志报错。统一将 stdout/stderr 重配为 UTF-8。
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# 打包后 Django 项目源码以 datas 形式打进包内。PyInstaller 6.x 的 onedir
# 将 datas/binaries 统一放到 _internal/ 下（可用 sys._MEIPASS 定位运行时根）。
# 兼容两种布局：
#   a) <MEIPASS>/backend/<源码>      ← 6.x 把 dest 'backend/...' 挂到 _internal 下
#   b) <onedir根>/backend/<源码>
# 把 _MEIPASS、_MEIPASS/backend、onedir 根、onedir根/backend 都加入 sys.path，
# 使 Django 各 app 可被正常 import。
_MEIPASS = getattr(sys, '_MEIPASS', None)
_bundle_root = (
    os.path.abspath(_MEIPASS)
    if _MEIPASS
    else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
_candidates = [_bundle_root]
if _MEIPASS:
    _candidates.append(os.path.dirname(_bundle_root))  # onedir 根
for _c in list(_candidates):
    _candidates.append(os.path.join(_c, 'backend'))
for _candidate in _candidates:
    if _candidate not in sys.path and os.path.isdir(_candidate):
        sys.path.insert(0, _candidate)


def resolve_data_dir(explicit: str | None) -> str:
    """定位可写数据目录：显式参数 > 环境变量 > %LOCALAPPDATA%\\一鉴到底\\data"""
    data_dir = explicit or os.environ.get('YJD_DATA_DIR')
    if not data_dir:
        base = os.environ.get('LOCALAPPDATA') or os.path.expanduser('~')
        data_dir = os.path.join(base, '一鉴到底', 'data')
    os.makedirs(data_dir, exist_ok=True)
    return data_dir


def main() -> int:
    parser = argparse.ArgumentParser(description='一鉴到底 Django 后端（打包版）')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--data-dir', default=None)
    args = parser.parse_args()

    # ① 数据目录（必须在 import settings 前设置环境变量）
    data_dir = resolve_data_dir(args.data_dir)
    os.environ['YJD_DATA_DIR'] = data_dir
    print(f'[backend] 数据目录: {data_dir}', flush=True)

    # ② 初始化 Django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
    try:
        import django

        django.setup()
    except Exception as exc:  # noqa: BLE001
        print(f'[backend] Django 初始化失败: {exc}', file=sys.stderr, flush=True)
        return 1

    from django.core.management import call_command

    # ③ 建表（首次 + 增量，幂等）
    try:
        call_command('migrate', interactive=False, verbosity=0)
    except Exception as exc:  # noqa: BLE001
        print(f'[backend] migrate 失败: {exc}', file=sys.stderr, flush=True)
        return 1

    # ④ 幂等种子数据（套餐/计费模型，保证计费功能可用）
    try:
        call_command('seed_packages_and_audit', verbosity=0)
    except Exception as exc:  # noqa: BLE001 - 种子失败不阻断服务
        print(f'[backend] 种子数据失败（忽略）: {exc}', file=sys.stderr, flush=True)

    # ⑤ 启动本地服务（阻塞）
    print(f'[backend] 启动 HTTP 服务 {args.host}:{args.port} ...', flush=True)
    call_command('runserver', f'{args.host}:{args.port}', '--noreload', verbosity=0)
    return 0


if __name__ == '__main__':
    sys.exit(main())

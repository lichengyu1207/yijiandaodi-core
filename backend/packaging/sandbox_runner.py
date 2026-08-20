#!/usr/bin/env python
"""
一鉴到底 - 沙箱 API 服务打包入口（PyInstaller）

将 sandbox_api.py + 仓库根本地模块（grok / skill_api / local_data_store / xai_*）
打成单个 sandbox-api.exe，供桌面端生产环境零 Python 依赖启动。
"""

import os
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

# 委托给仓库根的 sandbox_api.py（保持原有启动行为）
import sandbox_api  # noqa: F401, E402

if __name__ == '__main__':
    sandbox_api.run_server()

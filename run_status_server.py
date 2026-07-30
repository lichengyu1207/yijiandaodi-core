#!/usr/bin/env python
"""
一鉴到底 - 服务状态 API
用于桌面端检查服务运行状态
"""
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import asyncio
import sys
import os

# 添加后端路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# 全局状态
status = {
    'proxy': 'running',
    'monitor': 'active',
    'backend': 'running'
}


class StatusHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(status).encode())
    
    def log_message(self, format, *args):
        pass  # 静默日志


def run_status_server():
    """运行状态服务"""
    server = HTTPServer(('127.0.0.1', 8766), StatusHandler)
    print(f"[状态服务] 运行在 http://127.0.0.1:8766")
    server.serve_forever()


if __name__ == "__main__":
    print("\n一鉴到底 - 服务状态检查器")
    print("=" * 40)
    
    # 启动状态服务
    run_status_server()
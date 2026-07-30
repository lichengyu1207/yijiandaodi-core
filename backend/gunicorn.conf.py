# Gunicorn 配置文件（生产环境）
# 使用方式: gunicorn -c gunicorn.conf.py fangdudu_backend.wsgi:application

import multiprocessing
import os

# 绑定地址
bind = f"0.0.0.0:{os.environ.get('GUNICORN_PORT', '8000')}"

# 工作进程数（建议 CPU核心数 * 2 + 1）
workers = int(os.environ.get('GUNICORN_WORKERS', '2'))

# 工作线程数（适合 I/O 密集型 Django 应用）
threads = int(os.environ.get('GUNICORN_THREADS', '4'))

# 工作模式: sync | gevent | gthread
worker_class = os.environ.get('GUNICORN_WORKER_CLASS', 'sync')

# 超时设置
timeout = int(os.environ.get('GUNICORN_TIMEOUT', '120'))
graceful_timeout = 30
keepalive = 5

# 最大请求数后重启 worker（防止内存泄漏）
max_requests = int(os.environ.get('GUNICORN_MAX_REQUESTS', '1000'))
max_requests_jitter = 50

# 日志配置
accesslog = '-'
errorlog = '-'   # 输出到 stdout/stderr，由容器日志收集
loglevel = os.environ.get('LOG_LEVEL', 'info')

# 进程名
proc_name = 'yijiandaodi-backend'

# 安全配置
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190

# 预加载应用（减少内存占用，加快启动）
preload_app = True

def on_starting(server):
    """启动时执行数据库迁移和静态文件收集"""
    import subprocess
    import sys

    print("[Deploy] Running migrations...")
    subprocess.run([sys.executable, "manage.py", "migrate", "--noinput"], check=False)

    print("[Deploy] Collecting static files...")
    subprocess.run([sys.executable, "manage.py", "collectstatic", "--noinput", "--clear"], check=False)

def post_fork(server, worker):
    """Fork 后初始化"""
    import threading
    server.log.info(f"Worker spawned (pid: {worker.pid})")

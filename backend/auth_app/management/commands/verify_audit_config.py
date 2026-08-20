"""
自监控系统生产环境配置验证脚本

验证日志配置、Celery 任务配置是否正确
"""

from django.core.management.base import BaseCommand
import logging
import os

from django.conf import settings


class Command(BaseCommand):
    help = '验证自监控系统的生产环境配置'

    def verify_log_config(self):
        """验证日志配置"""
        self.stdout.write(self.style.SUCCESS("\n[1] 验证日志配置"))
        self.stdout.write("=" * 60)

        # 检查日志目录
        logs_dir = settings.BASE_DIR / 'logs'
        if not os.path.exists(logs_dir):
            self.stdout.write(self.style.WARNING(f"  ⚠ 日志目录不存在: {logs_dir}"))
            self.stdout.write("    正在创建...")
            os.makedirs(logs_dir, exist_ok=True)
            self.stdout.write(self.style.SUCCESS(f"  ✓ 日志目录已创建: {logs_dir}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"  ✓ 日志目录存在: {logs_dir}"))

        # 检查日志配置
        logging_config = settings.LOGGING

        # 检查自监控日志处理器
        if 'self_audit_file' in logging_config['handlers']:
            handler = logging_config['handlers']['self_audit_file']
            self.stdout.write(self.style.SUCCESS(f"  ✓ 自监控日志处理器已配置"))
            self.stdout.write(f"    - 文件: {handler['filename']}")
            self.stdout.write(f"    - 大小: {handler['maxBytes'] / 1024 / 1024:.0f}MB")
            self.stdout.write(f"    - 备份: {handler['backupCount']}个")
        else:
            self.stdout.write(self.style.ERROR("  ✗ 自监控日志处理器未配置"))

        # 检查 Celery 日志处理器
        if 'celery_file' in logging_config['handlers']:
            handler = logging_config['handlers']['celery_file']
            self.stdout.write(self.style.SUCCESS(f"  ✓ Celery 日志处理器已配置"))
            self.stdout.write(f"    - 文件: {handler['filename']}")
        else:
            self.stdout.write(self.style.ERROR("  ✗ Celery 日志处理器未配置"))

        # 检查日志记录器
        loggers = logging_config['loggers']
        required_loggers = [
            'auth_app.self_audit_service',
            'auth_app.self_audit_models',
            'celery',
            'celery.beat'
        ]

        for logger_name in required_loggers:
            if logger_name in loggers:
                logger_config = loggers[logger_name]
                level = logger_config.get('level', 'NOT SET')
                handlers = logger_config.get('handlers', [])
                self.stdout.write(self.style.SUCCESS(f"  ✓ Logger '{logger_name}' 已配置"))
                self.stdout.write(f"    - 级别: {level}")
                self.stdout.write(f"    - 处理器: {', '.join(handlers)}")
            else:
                self.stdout.write(self.style.ERROR(f"  ✗ Logger '{logger_name}' 未配置"))

    def verify_celery_config(self):
        """验证 Celery 配置"""
        self.stdout.write(self.style.SUCCESS("\n[2] 验证 Celery 配置"))
        self.stdout.write("=" * 60)

        # 检查 Celery 配置
        celery_settings = {
            'CELERY_BROKER_URL': getattr(settings, 'CELERY_BROKER_URL', None),
            'CELERY_RESULT_BACKEND': getattr(settings, 'CELERY_RESULT_BACKEND', None),
            'CELERY_TIMEZONE': getattr(settings, 'CELERY_TIMEZONE', None),
            'CELERY_BEAT_SCHEDULER': getattr(settings, 'CELERY_BEAT_SCHEDULER', None),
        }

        for key, value in celery_settings.items():
            if value:
                self.stdout.write(self.style.SUCCESS(f"  ✓ {key}: {value}"))
            else:
                self.stdout.write(self.style.WARNING(f"  ⚠ {key}: 未配置"))

        # 检查定时任务配置
        try:
            from django_celery_beat.models import PeriodicTask
            task_count = PeriodicTask.objects.filter(enabled=True).count()
            self.stdout.write(self.style.SUCCESS(f"  ✓ 定时任务数量: {task_count}个"))

            # 列出自监控任务
            self_audit_tasks = PeriodicTask.objects.filter(
                name__icontains='self_audit',
                enabled=True
            )

            if self_audit_tasks.exists():
                self.stdout.write(self.style.SUCCESS("  ✓ 自监控定时任务已配置:"))
                for task in self_audit_tasks:
                    self.stdout.write(f"    - {task.name}: {task.interval}")
            else:
                self.stdout.write(self.style.WARNING("  ⚠ 未找到自监控定时任务"))

        except Exception as e:
            self.stdout.write(self.style.WARNING(f"  ⚠ 无法查询定时任务: {e}"))

    def verify_redis_connection(self):
        """验证 Redis 连接"""
        self.stdout.write(self.style.SUCCESS("\n[3] 验证 Redis 连接"))
        self.stdout.write("=" * 60)

        try:
            import redis
            redis_url = getattr(settings, 'CELERY_BROKER_URL', 'redis://localhost:6379/0')
            redis_client = redis.from_url(redis_url)
            redis_client.ping()
            self.stdout.write(self.style.SUCCESS(f"  ✓ Redis 连接正常: {redis_url}"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  ✗ Redis 连接失败: {e}"))
            self.stdout.write("    请确保 Redis 服务正在运行")

    def test_logging_output(self):
        """测试日志输出"""
        self.stdout.write(self.style.SUCCESS("\n[4] 测试日志输出"))
        self.stdout.write("=" * 60)

        # 获取自监控服务的 logger
        logger = logging.getLogger('auth_app.self_audit_service')

        # 写入测试日志
        try:
            logger.info("[验证测试] 这是一条测试日志 - INFO级别")
            logger.warning("[验证测试] 这是一条测试日志 - WARNING级别")
            logger.error("[验证测试] 这是一条测试日志 - ERROR级别")

            self.stdout.write(self.style.SUCCESS("  ✓ 日志输出测试成功"))
            self.stdout.write("    请检查以下文件是否包含测试日志:")
            self.stdout.write("    - logs/self_audit.log")
            self.stdout.write("    - logs/performance.log")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  ✗ 日志输出测试失败: {e}"))

    def verify_imports(self):
        """验证导入"""
        self.stdout.write(self.style.SUCCESS("\n[5] 验证模块导入"))
        self.stdout.write("=" * 60)

        modules = [
            ('auth_app.self_audit_models', '自监控数据模型'),
            ('auth_app.self_audit_service', '自监控服务'),
            ('auth_app.self_audit_tasks', '自监控任务'),
        ]

        for module_name, description in modules:
            try:
                __import__(module_name)
                self.stdout.write(self.style.SUCCESS(f"  ✓ {description} ({module_name})"))
            except ImportError as e:
                self.stdout.write(self.style.ERROR(f"  ✗ {description} ({module_name}): {e}"))

    def handle(self, *args, **options):
        """主处理函数"""
        self.stdout.write(self.style.SUCCESS("\n" + "=" * 80))
        self.stdout.write(self.style.SUCCESS("自监控系统生产环境配置验证"))
        self.stdout.write(self.style.SUCCESS("=" * 80))

        try:
            # 1. 验证日志配置
            self.verify_log_config()

            # 2. 验证 Celery 配置
            self.verify_celery_config()

            # 3. 验证 Redis 连接
            self.verify_redis_connection()

            # 4. 测试日志输出
            self.test_logging_output()

            # 5. 验证模块导入
            self.verify_imports()

            self.stdout.write("\n" + "=" * 80)
            self.stdout.write(self.style.SUCCESS("✓ 配置验证完成！"))
            self.stdout.write("=" * 80)

            self.stdout.write("\n下一步操作:")
            self.stdout.write("1. 启动 Redis 服务: redis-server")
            self.stdout.write("2. 启动 Celery Worker: start_celery_worker.bat")
            self.stdout.write("3. 启动 Celery Beat: start_celery_beat.bat")
            self.stdout.write("4. 查看日志文件: Get-Content logs\\self_audit.log -Wait")
            self.stdout.write("5. 访问监控面板: http://localhost:5555")

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\n✗ 验证失败: {type(e).__name__}: {e}"))
            raise
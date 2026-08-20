from django.apps import AppConfig


class AuthAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'auth_app'

    def ready(self):
        """应用启动时导入信号"""
        # 导入Agent活动日志信号
        import auth_app.agent_activity_signals  # noqa: F401

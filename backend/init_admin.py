import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from auth_app.models import User

try:
    if not User.objects.filter(username='admin').exists():
        user = User.objects.create_superuser(
            username='admin',
            email='admin@fangdudu.top',
            password='Admin@2026'
        )
        print('✅ 超级管理员创建成功!')
        print('   用户名: admin')
        print('   密码: Admin@2026')
        print('   邮箱: admin@fangdudu.top')
    else:
        print('⚠️  管理员账户已存在')
except Exception as e:
    print(f'❌ 创建失败: {e}')

"""
创建超级管理员账户的管理命令
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = '创建超级管理员账户和基础权限数据'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('开始初始化系统...'))

        # 1. 创建超级管理员
        self.create_super_admin()

        # 2. 创建测试数据
        self.create_test_data()

        self.stdout.write(self.style.SUCCESS('系统初始化完成！'))

    def create_super_admin(self):
        """创建超级管理员"""
        self.stdout.write('创建超级管理员...')

        # 检查是否已存在
        if User.objects.filter(username='admin').exists():
            self.stdout.write(self.style.WARNING('超级管理员已存在，跳过创建'))
            return

        # 创建超级管理员
        admin = User.objects.create_superuser(
            username='admin',
            email='admin@yijiandaodi.com',
            password='Admin@123456',
            role='admin'
        )

        self.stdout.write(self.style.SUCCESS(f'超级管理员创建成功: {admin.username}'))
        self.stdout.write(self.style.WARNING('默认密码: Admin@123456'))
        self.stdout.write(self.style.WARNING('请立即修改密码！'))

    def create_test_data(self):
        """创建测试数据"""
        self.stdout.write('创建测试数据...')

        # 创建测试用户
        test_users = [
            {'username': 'test_user1', 'email': 'test1@yijiandaodi.com', 'role': 'viewer'},
            {'username': 'test_operator', 'email': 'operator@yijiandaodi.com', 'role': 'operator'},
        ]

        for user_data in test_users:
            if not User.objects.filter(username=user_data['username']).exists():
                user = User.objects.create_user(
                    username=user_data['username'],
                    email=user_data['email'],
                    password='Test@123456',
                    role=user_data['role']
                )
                self.stdout.write(self.style.SUCCESS(f'创建测试用户: {user.username}'))

        self.stdout.write(self.style.SUCCESS('测试数据创建完成'))
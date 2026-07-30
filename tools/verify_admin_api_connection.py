#!/usr/bin/env python
"""
管理员API连接验证脚本
验证前端管理员页面与后端数据连接
"""

import os
import sys
import json
import django
from pathlib import Path

# 添加项目路径
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / 'backend'))

# 初始化Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
from django.db import connection

User = get_user_model()


class AdminAPIVerifier:
    """管理员API连接验证器"""

    def __init__(self):
        self.client = Client()
        self.results = {}

    def verify_all(self):
        """运行所有验证"""
        print("=" * 60)
        print("管理员API连接验证")
        print("=" * 60)
        print()

        self.results = {
            'database_connection': self.verify_database_connection(),
            'admin_user_exists': self.verify_admin_user_exists(),
            'admin_login': self.verify_admin_login(),
            'admin_api_routes': self.verify_admin_api_routes(),
            'frontend_api_config': self.verify_frontend_api_config(),
            'data_synchronization': self.verify_data_synchronization()
        }

        self.print_results()
        return self.results

    def verify_database_connection(self):
        """验证数据库连接"""
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM auth_user")
                count = cursor.fetchone()[0]

            return {
                'status': 'PASS',
                'message': f'数据库连接正常，用户数: {count}',
                'user_count': count
            }
        except Exception as e:
            return {
                'status': 'FAIL',
                'message': f'数据库连接失败: {str(e)}'
            }

    def verify_admin_user_exists(self):
        """验证管理员用户是否存在"""
        try:
            admin_exists = User.objects.filter(is_superuser=True).exists()

            if admin_exists:
                admin_user = User.objects.filter(is_superuser=True).first()
                return {
                    'status': 'PASS',
                    'message': f'管理员用户存在: {admin_user.username}',
                    'username': admin_user.username,
                    'is_staff': admin_user.is_staff,
                    'is_superuser': admin_user.is_superuser
                }
            else:
                return {
                    'status': 'FAIL',
                    'message': '不存在管理员用户，请运行: python manage.py createsuperuser'
                }
        except Exception as e:
            return {
                'status': 'ERROR',
                'message': f'查询管理员失败: {str(e)}'
            }

    def verify_admin_login(self):
        """验证管理员登录"""
        try:
            admin_user = User.objects.filter(is_superuser=True).first()

            if not admin_user:
                return {
                    'status': 'FAIL',
                    'message': '不存在管理员用户'
                }

            # 尝试登录
            response = self.client.login(username=admin_user.username, password='admin123')

            if response:
                return {
                    'status': 'PASS',
                    'message': '管理员登录成功'
                }
            else:
                return {
                    'status': 'FAIL',
                    'message': '管理员登录失败，请检查密码'
                }
        except Exception as e:
            return {
                'status': 'ERROR',
                'message': f'登录验证失败: {str(e)}'
            }

    def verify_admin_api_routes(self):
        """验证管理员API路由"""
        try:
            # 测试管理员路由
            response = self.client.get('/admin/')

            if response.status_code in [200, 302]:
                return {
                    'status': 'PASS',
                    'message': f'管理员路由正常，状态码: {response.status_code}',
                    'status_code': response.status_code
                }
            else:
                return {
                    'status': 'FAIL',
                    'message': f'管理员路由异常，状态码: {response.status_code}'
                }
        except Exception as e:
            return {
                'status': 'ERROR',
                'message': f'路由验证失败: {str(e)}'
            }

    def verify_frontend_api_config(self):
        """验证前端API配置"""
        try:
            frontend_env_path = BASE_DIR / 'frontend' / '.env'

            if not frontend_env_path.exists():
                # 创建示例配置
                example_config = {
                    'VITE_API_BASE_URL': 'http://localhost:8000',
                    'VITE_APP_TITLE': '一鉴到底'
                }

                return {
                    'status': 'WARN',
                    'message': '前端.env文件不存在，请创建',
                    'example_config': example_config
                }

            with open(frontend_env_path, 'r', encoding='utf-8') as f:
                content = f.read()

            if 'VITE_API_BASE_URL' in content:
                return {
                    'status': 'PASS',
                    'message': '前端API配置正确'
                }
            else:
                return {
                    'status': 'FAIL',
                    'message': '前端缺少API配置'
                }
        except Exception as e:
            return {
                'status': 'ERROR',
                'message': f'前端配置验证失败: {str(e)}'
            }

    def verify_data_synchronization(self):
        """验证数据同步"""
        try:
            # 创建测试用户
            test_username = 'test_api_sync_user'
            User.objects.filter(username=test_username).delete()

            test_user = User.objects.create_user(
                username=test_username,
                email='test@example.com',
                password='test123'
            )

            # 查询是否同步
            queried_user = User.objects.get(username=test_username)

            # 清理
            test_user.delete()

            if queried_user:
                return {
                    'status': 'PASS',
                    'message': '数据同步正常'
                }
            else:
                return {
                    'status': 'FAIL',
                    'message': '数据同步失败'
                }
        except Exception as e:
            return {
                'status': 'ERROR',
                'message': f'数据同步验证失败: {str(e)}'
            }

    def print_results(self):
        """打印验证结果"""
        print("\n验证结果：")
        print("-" * 60)

        pass_count = 0
        fail_count = 0
        warn_count = 0

        for name, result in self.results.items():
            status = result['status']
            message = result['message']

            if status == 'PASS':
                print(f"✅ {name}: {message}")
                pass_count += 1
            elif status == 'FAIL':
                print(f"❌ {name}: {message}")
                fail_count += 1
            elif status == 'WARN':
                print(f"⚠️  {name}: {message}")
                warn_count += 1
            else:
                print(f"🔴 {name}: {message}")
                fail_count += 1

        print("-" * 60)
        print(f"总计: {pass_count} 通过, {fail_count} 失败, {warn_count} 警告")
        print("=" * 60)
        print()


if __name__ == '__main__':
    verifier = AdminAPIVerifier()
    results = verifier.verify_all()

    # 保存结果到文件
    with open('admin_api_verification.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print("验证结果已保存到: admin_api_verification.json")

    # 如果有失败项，退出码为1
    if any(r['status'] == 'FAIL' for r in results.values()):
        sys.exit(1)
    else:
        sys.exit(0)
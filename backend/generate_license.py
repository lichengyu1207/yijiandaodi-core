"""
授权码生成脚本
用于生成内测授权码
"""

import os
import sys
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from auth_app.license_models import LicenseKey
from django.contrib.auth import get_user_model

User = get_user_model()

def generate_licenses(count=1, license_type='beta', valid_days=30, note='', created_by_username=None):
    """
    生成授权码

    Args:
        count: 生成数量
        license_type: 授权类型 (beta/pro/enterprise/lifetime)
        valid_days: 有效天数
        note: 备注
        created_by_username: 创建者用户名
    """

    # 获取创建者
    created_by = None
    if created_by_username:
        try:
            created_by = User.objects.get(username=created_by_username)
        except User.DoesNotExist:
            print(f"用户 {created_by_username} 不存在")

    print(f"\n正在生成 {count} 个 {license_type} 授权码 (有效期: {valid_days} 天)...")
    print("-" * 60)

    licenses = []
    for i in range(count):
        license = LicenseKey.objects.create(
            license_key=LicenseKey.generate_key(),
            license_type=license_type,
            valid_days=valid_days,
            watermark_code=LicenseKey.generate_watermark(),
            note=note,
            created_by=created_by
        )
        licenses.append(license)
        print(f"{i+1}. 授权码: {license.license_key} | 水印码: {license.watermark_code}")

    print("-" * 60)
    print(f"✅ 成功生成 {len(licenses)} 个授权码")

    return licenses

def list_licenses(status=None):
    """列出所有授权码"""
    queryset = LicenseKey.objects.all()

    if status:
        queryset = queryset.filter(status=status)

    print(f"\n授权码列表 (共 {queryset.count()} 个):")
    print("-" * 100)
    print(f"{'授权码':<20} {'类型':<12} {'状态':<10} {'剩余天数':<10} {'验证次数':<10} {'备注'}")
    print("-" * 100)

    for lic in queryset:
        days_remaining = (lic.expires_at - timezone.now()).days if lic.expires_at and lic.status == 'active' else '-'
        print(f"{lic.license_key:<20} {lic.license_type:<12} {lic.get_status_display():<10} {str(days_remaining):<10} {lic.verify_count:<10} {lic.note[:20] if lic.note else ''}")

def revoke_license(license_key):
    """撤销授权码"""
    try:
        license = LicenseKey.objects.get(license_key=license_key)
        license.revoke()
        print(f"✅ 授权码 {license_key} 已撤销")
    except LicenseKey.DoesNotExist:
        print(f"❌ 授权码 {license_key} 不存在")

if __name__ == '__main__':
    import argparse
    from django.utils import timezone

    parser = argparse.ArgumentParser(description='授权码管理工具')
    parser.add_argument('command', choices=['generate', 'list', 'revoke'], help='操作命令')
    parser.add_argument('--count', type=int, default=1, help='生成数量')
    parser.add_argument('--type', default='beta', help='授权类型')
    parser.add_argument('--days', type=int, default=30, help='有效天数')
    parser.add_argument('--note', default='', help='备注')
    parser.add_argument('--user', default='admin', help='创建者用户名')
    parser.add_argument('--key', default='', help='授权码（用于撤销）')

    args = parser.parse_args()

    if args.command == 'generate':
        generate_licenses(
            count=args.count,
            license_type=args.type,
            valid_days=args.days,
            note=args.note,
            created_by_username=args.user
        )
    elif args.command == 'list':
        list_licenses()
    elif args.command == 'revoke':
        if args.key:
            revoke_license(args.key)
        else:
            print("❌ 请指定要撤销的授权码 --key")
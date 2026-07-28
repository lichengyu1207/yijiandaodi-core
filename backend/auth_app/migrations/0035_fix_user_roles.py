# Generated manually

from django.db import migrations


def fix_user_roles(apps, schema_editor):
    """根据 is_superuser/is_staff 标志修复 role 字段值"""
    User = apps.get_model('auth_app', 'User')

    # 超级管理员 → super_admin
    User.objects.filter(is_superuser=True).exclude(role='super_admin').update(role='super_admin')

    # 普通员工但不是超管 → admin
    User.objects.filter(is_staff=True, is_superuser=False).exclude(role='admin').update(role='admin')


class Migration(migrations.Migration):

    dependencies = [
        ('auth_app', '0034_workflow_models'),
    ]

    operations = [
        migrations.RunPython(fix_user_roles, migrations.RunPython.noop),
    ]

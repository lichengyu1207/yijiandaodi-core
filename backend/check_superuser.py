from auth_app.models import User

# 查找超级管理员账户
superusers = User.objects.filter(is_superuser=True)
print(f'\n超级管理员账户数量: {superusers.count()}')
for user in superusers:
    print(f'  - 用户名: {user.username}')
    print(f'    邮箱: {user.email}')
    print(f'    角色: {user.role}')
    print(f'    是否激活: {user.is_active}')
    print()

# 查找所有管理员账户
admins = User.objects.filter(role='admin')
print(f'\n管理员账户数量: {admins.count()}')
for user in admins[:5]:  # 只显示前5个
    print(f'  - 用户名: {user.username}')
    print(f'    角色: {user.role}')
    print()
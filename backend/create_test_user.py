"""
创建测试用户脚本
用于跨端数据同步测试
"""
from auth_app.models import User

# 删除旧的测试用户（如果存在）
User.objects.filter(username='test_user').delete()

# 创建新的测试用户
test_user = User.objects.create_user(
    username='test_user',
    email='test@example.com',
    password='Test@123456',
    role='super_admin'
)

# 设置为超级管理员
test_user.is_superuser = True
test_user.is_staff = True
test_user.is_active = True
test_user.save()

print(f'\n✓ 测试用户创建成功')
print(f'  用户名: {test_user.username}')
print(f'  邮箱: {test_user.email}')
print(f'  角色: {test_user.role}')
print(f'  超级管理员: {test_user.is_superuser}')
print(f'  激活状态: {test_user.is_active}')
print(f'\n登录凭证:')
print(f'  用户名: test_user')
print(f'  密码: Test@123456')
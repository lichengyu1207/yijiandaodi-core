from auth_app.models import User

User.objects.filter(username='test_user').delete()

test_user = User.objects.create_user(
    username='test_user',
    email='test@example.com',
    password='Test@123456',
    role='super_admin'
)

test_user.is_superuser = True
test_user.is_staff = True
test_user.is_active = True
test_user.save()

print('Test user created successfully')
print('Username: test_user')
print('Password: Test@123456')
print('Role:', test_user.role)
print('Superuser:', test_user.is_superuser)
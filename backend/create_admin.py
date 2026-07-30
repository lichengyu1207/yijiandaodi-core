import os, sys, django
sys.path.insert(0, '.')
os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()

with open('user_result.txt', 'w', encoding='utf-8') as f:
    total = User.objects.count()
    f.write('Total users: %d\n' % total)
    for u in User.objects.all()[:5]:
        f.write('  [%d] %s | role=%s | active=%s\n' % (u.id, u.username, u.role, u.is_active))

    if not User.objects.filter(username='admin').exists():
        user = User.objects.create_superuser(
            username='admin',
            email='admin@yijiandaodi.com',
            password='Admin123456'
        )
        f.write('\n[OK] Admin created: admin / Admin123456\n')
    else:
        f.write('\n[INFO] Admin already exists\n')
print('DONE')

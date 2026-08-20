import os, sys, django


def main():
    sys.path.insert(0, '.')
    os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
    django.setup()
    from django.contrib.auth import get_user_model, authenticate

    User = get_user_model()

    with open('login_test.txt', 'w', encoding='utf-8') as f:
        user = authenticate(username='admin', password='Admin123456')
        if user:
            f.write('Auth OK: %s | role=%s | active=%s\n' % (user.username, user.role, user.is_active))
            user.role = 'superadmin'
            user.save()
            f.write('Role updated to: superadmin\n')
        else:
            f.write('Auth FAILED - checking users...\n')
            for u in User.objects.all():
                f.write('  [%d] %s | active=%s\n' % (u.id, u.username, u.is_active))
    print('DONE')


if __name__ == '__main__':
    main()

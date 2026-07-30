import os, sys
os.chdir(r'C:\MsSafeData\Desktop\yijiandaodi\backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
sys.path.insert(0, '.')
import django
django.setup()

lines = []
try:
    from auth_app.payment_models import FirstOrderPromo, UserCoupon
    count = FirstOrderPromo.objects.count()
    lines.append(f'FirstOrderPromo: {count} rows')
    if count > 0:
        p = FirstOrderPromo.objects.first()
        lines.append(f'  name={p.name}, type={p.discount_type}, value={p.discount_value}, status={p.status}')
    lines.append(f'UserCoupon: {UserCoupon.objects.count()} rows')
except Exception as e:
    lines.append(f'ERROR: {e}')

from django.db.migrations.recorder import MigrationRecorder
applied = list(MigrationRecorder.Migration.objects.filter(app='auth_app').values_list('name', flat=True).order_by('id'))
lines.append(f'Migrations: {len(applied)} applied')
has_24 = any('0024' in n or 'first_order' in n.lower() for n in applied)
lines.append(f'  Has promo migration: {has_24}')
if applied:
    lines.append(f'  Latest: {applied[-1]}')

with open(r'C:\MsSafeData\Desktop\yijiandaodi\backend\verify_result.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print('\n'.join(lines))

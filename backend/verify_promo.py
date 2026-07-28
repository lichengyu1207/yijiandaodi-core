import os, sys
os.chdir(r'C:\MsSafeData\Desktop\yijiandaodi\backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
sys.path.insert(0, '.')
import django
django.setup()
from auth_app.payment_models import FirstOrderPromo, UserCoupon
from django.db.migrations.recorder import MigrationRecorder

# Check migrations applied
applied = MigrationRecorder.Migration.objects.filter(app='auth_app').values_list('name', flat=True)
print(f'Applied auth_app migrations: {len(applied)}')
print(f'  Has first_order_promo: {"0024" in str(applied) or "first_order" in str(applied)}')

# Check tables exist
try:
    count = FirstOrderPromo.objects.count()
    print(f'\nFirstOrderPromo table OK, rows: {count}')
    if count > 0:
        p = FirstOrderPromo.objects.first()
        print(f'  Promo: {p.name} | {p.discount_type}={p.discount_value}% | max_discount={p.max_discount} | status={p.status}')
except Exception as e:
    print(f'FirstOrderPromo ERROR: {e}')

try:
    count = UserCoupon.objects.count()
    print(f'\nUserCoupon table OK, rows: {count}')
except Exception as e:
    print(f'UserCoupon ERROR: {e}')

# Check new API endpoints registered
from django.urls import reverse
for name in ['first-order-promo', 'claim-first-order-coupon', 'apply-first-order-discount']:
    try:
        url = reverse(f'payment-{name}' if not name.startswith('payment') else name)
        print(f'  URL [{name}]: {url}')
    except Exception as e:
        print(f'  URL [{name}]: NOT FOUND ({e})')

print('\nDone!')

import os
import sys
import random
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
import django
django.setup()

from decimal import Decimal
from datetime import datetime, timedelta
from auth_app.stats_models import (
    DailyPlatformStats,
    SkillDailyStats,
    AreaClickStats,
    RevenueDailyStats,
)
from auth_app.skill_config_models import SkillConfig

today = datetime.now().date()

print('=== Seeding Daily Platform Stats (3 days) ===')
for d in range(3, 0, -1):
    date = today - timedelta(days=d)
    dau = random.randint(120, 380)
    new_users = random.randint(5, 25)
    clicks = random.randint(800, 3500)
    executions = random.randint(200, 900)
    shares = random.randint(30, 150)
    free_uses = random.randint(50, 200)
    paid_orders = random.randint(3, 18)
    revenue = Decimal(str(random.uniform(199, 5999)))
    conv_rate = round(paid_orders / max(free_uses + paid_orders, 1) * 100, 2)

    obj, created = DailyPlatformStats.objects.update_or_create(
        date=date,
        defaults={
            'dau': dau,
            'new_users': new_users,
            'total_users': 1200 + d * random.randint(10, 50),
            'total_sessions': dau * random.randint(2, 5),
            'avg_session_duration': random.randint(120, 480),
            'total_clicks': clicks,
            'total_executions': executions,
            'total_shares': shares,
            'free_uses': free_uses,
            'paid_uses': paid_orders,
            'conversion_rate': conv_rate,
            'revenue': revenue,
            'avg_revenue_per_user': revenue / max(paid_orders, 1),
            'retention_d1': round(random.uniform(35, 65), 1),
            'retention_d7': round(random.uniform(15, 35), 1),
            'retention_d30': round(random.uniform(8, 20), 1),
        },
    )
    print(f'  {date} DAU={dau} Rev={revenue}')

print()
print('=== Seeding Skill Daily Stats (top 15 skills x 3 days) ===')
skills = list(SkillConfig.objects.filter(status='active')[:15])
area_types = [at[0] for at in AreaClickStats.AREA_TYPE_CHOICES]

for d in range(3, 0, -1):
    date = today - timedelta(days=d)
    count = 0
    for skill in skills:
        imp = random.randint(10, 500)
        clk = random.randint(max(1, imp // 5), imp)
        exe = random.randint(max(0, clk // 3), clk)
        shr = random.randint(0, max(1, exe // 4))

        SkillDailyStats.objects.update_or_create(
            date=date,
            skill_id=skill.id,
            defaults={
                'skill_name': skill.name[:100],
                'skill_tier': skill.tier or '',
                'skill_category': skill.category or '',
                'impressions': imp,
                'clicks': clk,
                'executions': exe,
                'shares': shr,
                'click_rate': round(clk / max(imp, 1) * 100, 2),
                'execution_rate': round(exe / max(clk, 1) * 100, 2),
                'hotness': round(random.uniform(40, 100), 1),
                'rank': random.randint(1, 166),
                'revenue': Decimal(str(round(random.uniform(0, 99), 2))),
            },
        )
        count += 1
    print(f'  {date}: {count} skills')

print()
print('=== Seeding Area Click Stats (8 areas x 3 days) ===')
for d in range(3, 0, -1):
    date = today - timedelta(days=d)
    for area_type in area_types:
        imp = random.randint(200, 3000)
        clk = random.randint(max(5, imp // 10), imp // 2)
        uv = random.randint(max(3, clk // 3), clk)
        ctr = round(clk / max(imp, 1) * 100, 2)

        top_skill = random.choice(skills) if skills else None
        AreaClickStats.objects.update_or_create(
            date=date,
            area_type=area_type,
            defaults={
                'impressions': imp,
                'clicks': clk,
                'unique_visitors': uv,
                'click_rate': ctr,
                'top_clicked_item_id': str(top_skill.id) if top_skill else '',
                'top_clicked_item_name': top_skill.name[:100] if top_skill else '',
                'top_item_clicks': random.randint(5, 80),
            },
        )
    print(f'  {date}: {len(area_types)} areas')

print()
print('=== Seeding Revenue Daily Stats (3 days) ===')
order_types = ['per_use', 'vip_monthly', 'vip_yearly_199', 'vip_yearly_599',
               'vip_enterprise', 'combo_security', 'combo_content', 'combo_enterprise_full']
for d in range(3, 0, -1):
    date = today - timedelta(days=d)
    gross = Decimal(str(random.uniform(500, 15000)))
    refund = Decimal(str(random.uniform(0, gross * 0.05)))
    orders = random.randint(5, 60)
    paid = random.randint(3, orders)

    type_counts = {}
    for ot in order_types:
        if ot == 'per_use':
            type_counts[ot] = random.randint(paid // 2, paid)
        elif ot == 'vip_yearly_199':
            type_counts[ot] = random.randint(0, min(8, paid))
        else:
            type_counts[ot] = random.randint(0, paid // 3)

    field_map = {
        'per_use': 'per_use_orders',
        'vip_monthly': 'monthly_orders',
        'vip_yearly_199': 'yearly_199_orders',
        'vip_yearly_599': 'yearly_599_orders',
        'vip_enterprise': 'enterprise_orders',
        'combo_security': 'combo_security_orders',
        'combo_content': 'combo_content_orders',
        'combo_enterprise_full': 'combo_enterprise_orders',
    }
    defaults = {
        'gross_revenue': gross,
        'net_revenue': gross - refund,
        'refund_amount': refund,
        'order_count': orders,
        'paid_order_count': paid,
        'refund_order_count': orders - paid,
        'avg_order_value': gross / max(paid, 1),
        'conversion_rate': round(paid / max(orders, 1) * 100, 2),
        'commission_paid': Decimal(str(gross * Decimal('0.08'))),
        'affiliate_revenue': Decimal(str(gross * Decimal('0.12'))),
        'vip_active_count': random.randint(20, 80),
        'new_vip_count': random.randint(1, 10),
        'vip_renewal_count': random.randint(0, 6),
    }
    for ot, cnt in type_counts.items():
        defaults[field_map[ot]] = cnt

    RevenueDailyStats.objects.update_or_create(date=date, defaults=defaults)
    print(f'  {date} Gross={gross:.2f} Orders={paid}/{orders}')

print()
total_platform = DailyPlatformStats.objects.count()
total_skill = SkillDailyStats.objects.count()
total_area = AreaClickStats.objects.count()
total_rev = RevenueDailyStats.objects.count()
print(f'[OK] Seed complete!')
print(f'     Platform:   {total_platform} days')
print(f'     Skills:     {total_skill} records')
print(f'     Areas:      {total_area} records')
print(f'     Revenue:    {total_rev} days')

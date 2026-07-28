import os
import sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
import django
django.setup()

from decimal import Decimal
from auth_app.affiliate_models import MembershipPlan

plans_data = [
    {
        'plan_type': 'per_use',
        'plan_name': '\u6309\u6b21\u68c0\u6d4b',
        'price': Decimal('19.00'),
        'original_price': Decimal('29.00'),
        'duration_days': 0,
        'vip_level': 0,
        'daily_limit': 0,
        'features': ['\u5355\u6b21\u5b8c\u6574\u68c0\u6d4b', '\u62a5\u544aPDF\u4e0b\u8f7d', '\u4e0d\u9650\u65f6\u95f4'],
        'skill_categories': [],
        'included_skills_count': 1,
        'is_hot': False,
        'is_new': False,
        'sort_order': 0,
        'description': '\u9002\u5408\u5076\u5c14\u4f7f\u7528\uff0c\u6309\u9700\u652f\u4ed8',
        'badge_text': '',
    },
    {
        'plan_type': 'vip_monthly',
        'plan_name': '\u6708\u5ea6\u4f1a\u5458',
        'price': Decimal('99.00'),
        'original_price': Decimal('199.00'),
        'duration_days': 30,
        'vip_level': 1,
        'daily_limit': 50,
        'features': ['30\u5929\u65e0\u9650\u6b21', '200+\u6280\u80fd\u89e3\u9501', '\u4f18\u5148\u4f53\u9a8c\u65b0\u529f\u80fd', '\u5ba2\u670d\u4f18\u5148'],
        'skill_categories': [],
        'included_skills_count': 166,
        'is_hot': True,
        'is_new': False,
        'sort_order': 10,
        'description': '\u9002\u5408\u5e38\u89c4\u7528\u6237\uff0c\u6bcf\u6708\u81ea\u52a8\u7eed\u8d39',
        'badge_text': '\u63a8\u8350',
        'badge_color': '#F5A623',
    },
    {
        'plan_type': 'vip_yearly_199',
        'plan_name': '\u5e74\u5ea6\u4f1a\u5458 \u2666 \u8d85\u503c',
        'price': Decimal('199.00'),
        'original_price': Decimal('1188.00'),
        'duration_days': 365,
        'vip_level': 2,
        'daily_limit': 999,
        'features': ['365\u5929\u65e0\u9650\u6b21', '200+\u6280\u80fd\u5168\u89e3\u9501', 'VIP-L2\u4f1a\u5458\u6743\u76ca', '\u5206\u9500\u8d5a\u94b1\u6743\u9650', '\u4f18\u5148\u5ba2\u670d'],
        'skill_categories': [],
        'included_skills_count': 166,
        'is_hot': True,
        'is_new': True,
        'sort_order': 20,
        'description': '\u6700\u53d7\u6b22\u8fce\u7684\u5e74\u5ea6\u5957\u9910\uff0c\u5e73\u5747\u00a516.6/\u6708',
        'badge_text': '\u2666 \u8d85\u503c',
        'badge_color': '#E02020',
    },
    {
        'plan_type': 'vip_yearly_599',
        'plan_name': '\u5e74\u5ea6\u4f1a\u5458\u4e13\u4eab',
        'price': Decimal('599.00'),
        'original_price': Decimal('2388.00'),
        'duration_days': 365,
        'vip_level': 2,
        'daily_limit': 999,
        'features': ['365\u5929\u65e0\u9650\u6b21', '200+\u6280\u80fd\u5168\u89e3\u9501', 'VIP-L2\u4f1a\u5458\u6743\u76ca', '\u5206\u9500\u8d5a\u94b1(20%)', 'API\u63a5\u53e3\u8bbf\u95ee', '\u4f01\u4e1a\u5ba2\u670d\u4e13\u5458'],
        'skill_categories': [],
        'included_skills_count': 166,
        'is_hot': False,
        'is_new': False,
        'sort_order': 25,
        'description': '\u91cd\u5ea6\u7528\u6237\u9996\u9009\uff0c\u9644\u8d60API\u6743\u9650',
        'badge_text': '',
    },
    {
        'plan_type': 'combo_security',
        'plan_name': '\u5b89\u5168\u68c0\u6d4b\u5957\u9910',
        'price': Decimal('299.00'),
        'original_price': Decimal('598.00'),
        'duration_days': 365,
        'vip_level': 2,
        'daily_limit': 100,
        'features': ['AI\u68c0\u6d4b\u5168\u666f\u89e3\u9501', '\u5b89\u5168\u5ba1\u8ba1\u589e\u503c', '\u98ce\u9669\u9884\u8b66\u63d0\u9192', '\u5408\u89c4\u62a5\u544a\u81ea\u52a8\u751f\u6210', '\u5b89\u5168\u77e5\u8bc6\u5e93\u67e5\u8be2'],
        'skill_categories': ['\u6838\u5fc3\u9274\u522b\u573a\u666f', '\u5b89\u5168\u5ba1\u8ba1', '\u98ce\u9669\u63a7\u5236'],
        'included_skills_count': 48,
        'is_hot': True,
        'is_new': True,
        'sort_order': 30,
        'description': '\u4e13\u4e3a\u5b89\u5168\u56e2\u961f\u8bbe\u8ba1\uff0c\u6db5\u76d6AI\u5b89\u5168\u68c0\u6d4b\u5168\u573a\u666f',
        'badge_text': '\u5b89\u5168',
        'badge_color': '#165DFF',
    },
    {
        'plan_type': 'combo_content',
        'plan_name': '\u5185\u5bb9\u5b89\u5168\u5957\u9910',
        'price': Decimal('398.00'),
        'original_price': Decimal('888.00'),
        'duration_days': 365,
        'vip_level': 2,
        'daily_limit': 150,
        'features': ['AI\u6587\u6848\u68c0\u6d4b', '\u6df1\u5ea6\u4f2b\u9020\u8bc6\u522b', '\u5185\u5bb9\u5ba1\u6838\u589e\u5f3a', '\u7248\u6743\u76d1\u6d4b', '\u5408\u89c4\u68c0\u6d4b\u62a5\u544a'],
        'skill_categories': ['AI\u6587\u6848\u9274\u522b', '\u5185\u5bb9\u5b89\u5168', '\u7248\u6743\u4fdd\u62a4'],
        'included_skills_count': 36,
        'is_hot': True,
        'is_new': True,
        'sort_order': 31,
        'description': '\u5185\u5bb9\u521b\u4f5c\u8005/\u5a92\u4f53\u5fc5\u5907\uff0c\u5168\u65b9\u4f4d\u5185\u5bb9\u5b89\u5168\u4fdd\u62a4',
        'badge_text': '\u5185\u5bb9',
        'badge_color': '#722ED1',
    },
    {
        'plan_type': 'combo_enterprise_full',
        'plan_name': '\u4f01\u4e1a\u5168\u666f\u5957\u9910',
        'price': Decimal('2999.00'),
        'original_price': Decimal('9999.00'),
        'duration_days': 1095,
        'vip_level': 3,
        'daily_limit': 9999,
        'features': ['3\u5e74\u65e0\u9650\u6b21', '200+\u6280\u80fd\u5168\u90e8\u89e3\u9501', 'VIP-L3\u4f01\u4e1a\u6743\u76ca', '\u591a\u4eba\u534f\u4f5c\u7ba1\u7406', 'API\u65e0\u9650\u8c03\u7528', '\u4e13\u5c5e\u6280\u672f\u5ba2\u670d', '\u79c1\u6709\u5316\u90e8\u7f72', '\u6570\u636e\u51fa\u53e3\u5b9a\u5236'],
        'skill_categories': [],
        'included_skills_count': 166,
        'is_hot': False,
        'is_new': False,
        'sort_order': 40,
        'description': '\u4f01\u4e1a\u7ea7\u5168\u666f\u89e3\u51b3\u65b9\u6848\uff0c\u9002\u5408\u56e2\u961f50\u4eba+',
        'badge_text': '\u4f01\u4e1a',
        'badge_color': '#00B42A',
    },
]

created = 0
for pd in plans_data:
    obj, is_new = MembershipPlan.objects.update_or_create(
        plan_type=pd['plan_type'],
        defaults=pd,
    )
    if is_new:
        created += 1

print(f'[OK] Seeded {len(plans_data)} membership plans ({created} new, {len(plans_data) - created} updated)')
for p in MembershipPlan.objects.all().order_by('sort_order'):
    print(f'     {p.plan_type:25s} {p.plan_name:20s} {str(p.price):>8s} | badge={p.badge_text}')

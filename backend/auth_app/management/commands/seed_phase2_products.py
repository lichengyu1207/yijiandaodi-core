import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

django.setup()

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from decimal import Decimal
from auth_app.mall_models import Product


class Command(BaseCommand):
    help = 'Seed Phase 2 商业化商品：年度会员套餐、企业服务、培训课程、广告合作位'

    def handle(self, *args, **options):
        User = get_user_model()

        superuser = User.objects.filter(is_superuser=True).first()
        if not superuser:
            self.stdout.write(self.style.WARNING('未找到超级用户，商品将无创建者。'))

        products_data = [
            {
                'title': '\u2b50 VIP\u5e74\u5ea6\u4f1a\u5458\xb7\u8d85\u503c\u7248',
                'category': 'template',
                'price': Decimal('199.00'),
                'original_price': Decimal('2388'),
                'description': '\u6708\u5747\u53a5\uffe516.6\uff0c\u5305\u542b\u6708\u5ea6\u4f1a\u5458\u5168\u90e8\u6743\u76ca + \u5e74\u5ea6\u4e13\u5c5e\u6280\u80fd\u5e93 + \u4f18\u5148\u5ba2\u670d\u901a\u9053',
                'tags': ['\u5e74\u5ea6\u4f1a\u5458', '\u7701\uffe52189', '12\u4e2a\u6708'],
                'is_hot': True,
                'is_recommend': True,
                'stock': -1,
                'status': 'on_sale',
                'sort_order': 10,
            },
            {
                'title': '\U0001f451 VIP\u5e74\u5ea6\u4f1a\u5458\xb7\u5c0a\u4eab\u7248',
                'category': 'template',
                'price': Decimal('599.00'),
                'original_price': Decimal('1188'),
                'description': '\u65e0\u9650\u6b21Agent\u8c03\u7528 + \u79c1\u6709RAG\u6587\u6863\u5e93(1000\u9875) + \u5b9a\u5236\u5b89\u5168\u62a5\u544a/\u6708 + 1\u5bf91\u6280\u672f\u987e\u95ee',
                'tags': ['\u5e74\u5ea6\u65d7\u8230', '\u65e0\u9650\u4f7f\u7528', '\u4e13\u5c5e\u987e\u95ee'],
                'is_hot': True,
                'is_recommend': True,
                'stock': -1,
                'status': 'on_sale',
                'sort_order': 11,
            },
            {
                'title': '\U0001f3e2 \u4f01\u4e1a\u5b9a\u5236\u7248',
                'category': 'template',
                'price': Decimal('5999.00'),
                'original_price': Decimal('12000'),
                'description': '\u79c1\u6709\u5316\u90e8\u7f72 + \u65e0\u9650\u8d26\u53f7 + \u5b9a\u5236\u5b89\u5168\u7b56\u7565\u5f15\u64ce + 7\xd724\u5c0f\u65f6\u6280\u672f\u652f\u6301',
                'tags': ['\u4f01\u4e1a\u7ea7', '\u79c1\u6709\u90e8\u7f72', 'SLA\u4fdd\u969c'],
                'is_hot': False,
                'is_recommend': True,
                'stock': -1,
                'status': 'on_sale',
                'sort_order': 12,
            },
            {
                'title': '\U0001f512 \u4f01\u4e1a\u79c1\u6709RAG\u90e8\u7f52\u670d\u52a1',
                'category': 'tool',
                'price': Decimal('5000.00'),
                'original_price': Decimal('8000'),
                'description': '\u57fa\u4e8e\u4e00\u9274\u5230\u5e95\u5b89\u5168\u6846\u67b6\u7684\u79c1\u6709RAG\u77e5\u8bc6\u5e93\u90e8\u7f72\uff0c\u652f\u6301\u5411\u91cf\u6570\u636e\u5e93\u9009\u578b\u3001\u6587\u6863\u5207\u7247\u7b56\u7565\u4f18\u5316\u3001\u68c0\u7d22\u589e\u5f3a\u914d\u7f6e',
                'tags': ['RAG', '\u79c1\u6709\u90e8\u7f72', '\u77e5\u8bc6\u5e93'],
                'is_hot': True,
                'is_recommend': True,
                'stock': -1,
                'status': 'on_sale',
                'sort_order': 20,
            },
            {
                'title': '\U0001f916 \u5b9a\u5236AI Agent\u5f00\u53d1',
                'category': 'course',
                'price': Decimal('10000.00'),
                'original_price': Decimal('18000'),
                'description': '\u4ece\u9700\u6c42\u5206\u6790\u5230\u4e0a\u7ebf\u4ea4\u4ed8\u7684\u5168\u6d41\u7a0b\u5b9a\u5236Agent\u5f00\u53d1\uff0c\u542b\u5b89\u5168\u5ba1\u8ba1\u3001\u6743\u9650\u63a7\u5236\u3001\u65e5\u5fd7\u5ba1\u8ba1\u6a21\u5757',
                'tags': ['\u5b9a\u5236\u5f00\u53d1', 'Agent', '\u4ea4\u4ed8'],
                'is_hot': True,
                'is_recommend': True,
                'stock': -1,
                'status': 'on_sale',
                'sort_order': 21,
                'course_meta': {
                    'level': '\u8fdb\u9636',
                    'duration': '\u81ea\u5b9a\u671f',
                    'lessons_count': 0,
                    'outline': [
                        {'title': '\u9700\u6c42\u5206\u6790\u4e0e\u65b9\u6848\u8bbe\u8ba1', 'desc': '\u6839\u636e\u4f01\u4e1a\u573a\u666f\u5b9a\u5236Agent\u529f\u80fd\u8303\u56f4'},
                        {'title': '\u5b89\u5168\u6846\u67b6\u642d\u5efa', 'desc': '\u6743\u9650\u63a7\u5236\u3001\u65e5\u5fd7\u5ba1\u8ba1\u3001\u95e8\u7981\u8bcd\u8fc7\u6ee4'},
                        {'title': 'Agent\u5f00\u53d1\u4e0e\u90e8\u7f72', 'desc': '\u5b8c\u6574\u5f00\u53d1+6\u4e2a\u6708\u7ef4\u62a4'},
                    ],
                    'features': ['\u4e00\u5bf9\u4e00\u6280\u672f\u987e\u95ee', '\u5b8c\u6574\u4ea4\u4ed8\u6587\u6863', '\u514d\u8d39\u7ef4\u62a46\u4e2a\u6708'],
                },
            },
            {
                'title': '\U0001f393 AI Agent\u5b89\u5168\u5f00\u53d1\u5b9e\u6218\u8bfe',
                'category': 'course',
                'price': Decimal('299.00'),
                'original_price': Decimal('599'),
                'description': '20\u8282\u7cbe\u8bb2\u8bfe\u7a0b\uff0c\u4ecePrompt\u6ce8\u5165\u9632\u62a4\u5230Agent\u6743\u9650\u6a21\u578b\u8bbe\u8ba1\uff0c\u542b\u5b9e\u9a8c\u73af\u5883\u548c\u7ed3\u4e1a\u8bc1\u4e66',
                'tags': ['\u89c6\u9891\u8bfe\u7a0b', '\u5b9e\u6218', '\u8bc1\u4e66'],
                'is_hot': True,
                'is_recommend': False,
                'stock': -1,
                'status': 'on_sale',
                'sort_order': 30,
                'cover_image': 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=340&fit=crop',
                'course_meta': {
                    'level': '\u5165\u95e8-\u8fdb\u9636',
                    'duration': '\u7ea618\u5c0f\u65f6',
                    'lessons_count': 20,
                    'outline': [
                        {'title': 'Prompt\u6ce8\u5165\u9632\u62a4\u57fa\u7840', 'desc': '\u5404\u79cdPrompt\u6ce8\u5165\u65b9\u5f0f\u7684\u5b89\u5168\u98ce\u9669\u4e0e\u9632\u5fa1\u7b56\u7565'},
                        {'title': 'Agent\u6743\u9650\u6a21\u578b\u8bbe\u8ba1', 'desc': '\u57fa\u4e8eRBAC\u7684Agent\u6743\u9650\u63a7\u5236\u67b6\u6784\u8bbe\u8ba1'},
                        {'title': '\u5de5\u5177\u94fe\u5b89\u5168', 'desc': '\u5916\u90e8API\u8c03\u7528\u3001\u6587\u4ef6\u64cd\u4f5c\u3001\u547d\u4ee4\u6267\u884c\u7684\u5b89\u5168\u9650\u5236'},
                        {'title': '\u5b9e\u6218\u9879\u76ee', 'desc': '\u5b8c\u6210\u4e00\u4e2a\u542b\u5b89\u5168\u68c0\u6d4b\u7684Agent\u5b9e\u6218\u9879\u76ee'},
                        {'title': '\u7ed3\u4e1a\u8003\u6838', 'desc': '\u5b9e\u6218\u9879\u76ee\u8bc4\u6d4b+\u7ed3\u4e1a\u8bc1\u4e66'},
                    ],
                    'features': ['\u914d\u5957\u5b9e\u9a8c\u73af\u5883', '\u7ea618\u5c0f\u65f6\u89c6\u9891', '\u5b8c\u6210\u8bc1\u4e66', '+3\u9879\u76ee\u6e90\u7801'],
                },
            },
            {
                'title': '\U0001f4da RAG\u5b89\u5168\u642d\u5efa\u5165\u95e8\u8bfe',
                'category': 'course',
                'price': Decimal('99.00'),
                'original_price': Decimal('199'),
                'description': '6\u5c0f\u65f6\u5feb\u901f\u638c\u63e1RAG\u7cfb\u7edf\u642d\u5efa\u7684\u5b89\u8981\u70b9\uff0c\u5411\u91cf\u6ce8\u5165\u9632\u5fa1\u3001\u68c0\u7d22\u8d8a\u6743\u9632\u62a4\u7b49\u6838\u5fc3\u6280\u80fd',
                'tags': ['\u5165\u95e8\u8bfe', 'RAG', '\u5feb\u901f\u4e0a\u624b'],
                'is_hot': False,
                'is_recommend': True,
                'stock': -1,
                'status': 'on_sale',
                'sort_order': 31,
                'cover_image': 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=340&fit=crop',
                'course_meta': {
                    'level': '\u5165\u95e8',
                    'duration': '\u7ea66\u5c0f\u65f6',
                    'lessons_count': 8,
                    'outline': [
                        {'title': 'RAG\u539f\u7406\u4e0e\u67b6\u6784', 'desc': '\u77e5\u8bc6\u5e93\u6784\u5efa\u3001\u5411\u91cf\u5316\u3001\u68c0\u7d22\u57fa\u7840'},
                        {'title': '\u5411\u91cf\u6ce8\u5165\u9632\u5fa1', 'desc': '\u63d0\u793a\u8bcd\u6ce8\u5165\u68c0\u6d4b\u4e0e\u8fc7\u6ee4\u7b56\u7565'},
                        {'title': '\u68c0\u7d22\u8d8a\u6743\u9632\u62a4', 'desc': '\u9632\u6b62\u901a\u8fc7\u68c0\u7d22\u8bed\u53e5\u7ed5\u8fc7\u6743\u9650\u83b7\u53d6\u6570\u636e'},
                        {'title': '\u624b\u628a\u624b\u642d\u5efa\u6307\u5357', 'desc': '\u4ece0\u52301\u642d\u5efaRAG\u7cfb\u7edf\u7684\u5b8c\u6574\u6b65\u9aa4'},
                    ],
                    'features': ['8\u8282\u7cbe\u8bb2\u89c6\u9891', '\u624b\u628a\u624b\u642d\u5efa\u6307\u5357', '\u5e38\u89c1\u95ee\u9898Checklist'],
                },
            },
            {
                'title': '\U0001f4e2 AI\u4ea7\u54c1\u7cbe\u51c6\u5e7f\u544a\u6295\u653e',
                'category': 'material',
                'price': Decimal('0.01'),
                'original_price': None,
                'description': '\u9762\u5411AI\u5b89\u5168\u4ece\u4e1a\u8005\u7684\u9ad8\u8d28\u91cf\u7cbe\u51c6\u6d41\u91cf\u6295\u653e\uff0c\u652f\u6301Banner\u3001\u4fe1\u606f\u6d41\u3001\u90ae\u4ef6\u7b49\u591a\u79cd\u5f62\u5f0f',
                'tags': ['\u5e7f\u544a', '\u5408\u4f5c', '\u6d41\u91cf'],
                'is_hot': False,
                'is_recommend': False,
                'stock': -1,
                'status': 'on_sale',
                'sort_order': 40,
            },
        ]

        created_count = 0
        for product_data in products_data:
            product, created = Product.objects.update_or_create(
                title=product_data['title'],
                defaults={
                    **product_data,
                    'created_by': superuser,
                }
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'\u521b\u5efa\u5546\u54c1 {created_count}: ID={product.id} | {product.title}'))
            else:
                self.stdout.write(self.style.WARNING(f'\u66f4\u65b0\u5546\u54c1: ID={product.id} | {product.title}'))

        self.stdout.write(
            self.style.SUCCESS(f'Phase 2 \u5546\u4e1a\u5316\u5546\u54c1\u521d\u59cb\u5316\u5b8c\u6215\uff01\u5171 {len(products_data)} \u4e2a\u5546\u54c1\uff0c\u65b0\u5efa {created_count} \u4e2a')
        )

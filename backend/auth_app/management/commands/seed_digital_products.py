from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from auth_app.mall_models import Product


class Command(BaseCommand):
    help = 'Seed digital products for the mall system'

    def handle(self, *args, **options):
        User = get_user_model()

        superuser = User.objects.filter(is_superuser=True).first()
        if not superuser:
            self.stdout.write(self.style.WARNING('No superuser found. Products will have no creator.'))

        Product.objects.filter(category__in=['template', 'tool', 'course', 'material']).delete()
        self.stdout.write(self.style.SUCCESS('Cleared existing digital products.'))

        products_data = [
            {
                'title': '🎯 新人专属：100+ Agent安全提示词大全',
                'category': 'material',
                'price': 9.90,
                'original_price': 49.90,
                'description': '''精心整理的100+条Agent安全检测提示词，覆盖：
  · Prompt Injection 检测提示词（20条）
  · 越权访问检测提示词（15条）
  · 数据泄露检测提示词（18条）
  · RAG投毒检测提示词（12条）
  · 供应链安全审计提示词（10条）
  · 合规性检查提示词（15条）
  · Docker/容器安全检测提示词（10条）

  即买即用，复制粘贴到Agent中即可开始检测！''',
                'tags': ['提示词', '新手入门', 'Agent安全', '即买即用', '爆款'],
                'is_hot': True,
                'is_recommend': True,
                'stock': -1,
                'status': 'on_sale',
                'sort_order': 1,
            },
            {
                'title': '📘 Agent安全开发实战手册（2024版）',
                'category': 'course',
                'price': 19.90,
                'original_price': 69.90,
                'description': '''从0到1搭建安全Agent的完整指南：
第一章：Agent架构安全设计原则
第二章：输入验证与Prompt Injection防护
第三章：Tool调用的权限控制方案
第四章：RAG系统的知识库安全
第五章：容器化部署的安全基线
第六章：日志审计与异常检测
第七章：等保合规检查清单

附赠：完整的安全Checklist PDF + 配置模板文件''',
                'tags': ['电子书', '教程', 'Agent开发', '安全', '从入门到精通'],
                'is_hot': True,
                'is_recommend': False,
                'stock': -1,
                'status': 'on_sale',
                'sort_order': 2,
            },
            {
                'title': '🛡️ 企业Agent安全体检工具包（含脚本+模板）',
                'category': 'tool',
                'price': 29.90,
                'original_price': 99.90,
                'description': '''一站式企业Agent安全自检解决方案：

✅ 自动化安全扫描脚本（Python）：
     - 依赖漏洞扫描器
     - 配置安全检查器
     - 权限审计工具
     - 日志敏感信息扫描器

✅ 安全评估模板（Word/Excel）：
     - 威胁建模模板
     - 风险评估报告模板
     - 等保差距分析模板
     - 应急响应预案模板

✅ Docker安全基线配置：
     - docker-compose安全版
     - K8s Pod安全策略
     - Nginx安全配置

  适用于：已部署或计划部署Agent的企业IT团队''',
                'tags': ['工具包', '企业版', '脚本', '模板', '自动化'],
                'is_hot': False,
                'is_recommend': True,
                'stock': -1,
                'status': 'on_sale',
                'sort_order': 3,
            },
            {
                'title': '⭐ VIP月度会员·首月特惠体验',
                'category': 'template',
                'price': 9.90,
                'original_price': 99.00,
                'description': '''首月仅需¥9.9！原价¥99的VIP月度会员体验：

🎯 会员权益：
· 每日50次Agent执行次数（免费用户仅3次）
· 全部高级技能解锁使用
· 优先客服支持通道
· 每月1次深度安全报告
· 新功能抢先体验资格

⚠️ 特惠说明：
· 仅限首次购买的用户享受
· 首月¥9.9，次月起恢复¥99/月
· 可随时取消，无绑定合约

👉 适合想体验完整功能的个人开发者和小团队''',
                'tags': ['会员', 'VIP', '特惠', '体验版', '限时'],
                'is_hot': True,
                'is_recommend': True,
                'stock': -1,
                'status': 'on_sale',
                'sort_order': 0,
            },
        ]

        created_count = 0
        for product_data in products_data:
            product = Product.objects.create(
                **product_data,
                created_by=superuser,
            )
            created_count += 1
            self.stdout.write(self.style.SUCCESS(f'Created product {created_count}: ID={product.id}'))

        self.stdout.write(
            self.style.SUCCESS(f'Successfully seeded {created_count} digital products!')
        )

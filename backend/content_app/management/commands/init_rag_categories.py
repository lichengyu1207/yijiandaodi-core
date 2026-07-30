from django.core.management.base import BaseCommand
from content_app.rag_models import KnowledgeBaseCategory


class Command(BaseCommand):
    help = 'Initialize RAG knowledge base categories'

    def handle(self, *args, **options):
        categories = [
            {
                'name': '安全漏洞分析',
                'slug': 'security-vulnerabilities',
                'description': 'CVE漏洞、0day漏洞、安全公告等技术文档',
                'icon': 'shield',
                'sort_order': 1,
            },
            {
                'name': '威胁情报',
                'slug': 'threat-intelligence',
                'description': 'APT组织、恶意软件、攻击手法等情报资料',
                'icon': 'alert',
                'sort_order': 2,
            },
            {
                'name': '合规标准',
                'slug': 'compliance-standards',
                'description': '等级保护、GDPR、ISO27001、PCI-DSS等合规文档',
                'icon': 'file-check',
                'sort_order': 3,
            },
            {
                'name': '安全工具使用',
                'slug': 'security-tools',
                'description': 'Nmap、Metasploit、Burp Suite等安全工具使用指南',
                'icon': 'wrench',
                'sort_order': 4,
            },
            {
                'name': '应急响应手册',
                'slug': 'incident-response',
                'description': '事件处置流程、取证方法、恢复策略等操作手册',
                'icon': 'first-aid-kit',
                'sort_order': 5,
            },
            {
                'name': '行业研究报告',
                'slug': 'industry-reports',
                'description': '年度安全报告、趋势分析、行业白皮书',
                'icon': 'chart-bar',
                'sort_order': 6,
            },
        ]

        created_count = 0
        for cat_data in categories:
            cat, created = KnowledgeBaseCategory.objects.get_or_create(
                slug=cat_data['slug'],
                defaults=cat_data
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'[OK] Created: {cat.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'[SKIP] Exists: {cat.name}'))

        self.stdout.write(self.style.SUCCESS(f'\n[DONE] Init complete! Created {created_count} categories. Total: {KnowledgeBaseCategory.objects.count()}'))

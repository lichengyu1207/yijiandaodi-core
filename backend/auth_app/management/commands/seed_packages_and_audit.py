from django.core.management.base import BaseCommand
from auth_app.mall_models import ScenarioPackage, EnterpriseAuditService, Product


class Command(BaseCommand):
    help = 'Initialize scenario linkage packages and enterprise audit services'

    def handle(self, *args, **options):
        self._seed_scenario_packages()
        self._seed_enterprise_audit_services()
        self.stdout.write(self.style.SUCCESS('[OK] Packages & Audit Services initialized'))

    def _seed_scenario_packages(self):
        self.stdout.write('[1/2] Seeding scenario linkage packages...')

        s_products = list(Product.objects.filter(title__icontains='S级') | Product.objects.filter(price__gte=500))
        a_products = list(Product.objects.filter(title__icontains='A级') | (Product.objects.filter(price__gte=200) & Product.objects.filter(price__lt=500)))
        b_products = list(Product.objects.filter(title__icontains='B级') | (Product.objects.filter(price__gte=50) & Product.objects.filter(price__lt=200)))

        packages_data = [
            {
                'name': '全链路安全旗舰套餐 (S+A+B)',
                'package_type': 'combo_sab',
                'description': 'S级旗舰场景 + A级核心场景 + 自选1个B级增强场景，覆盖AI内容安全检测全链路。包含审计官+验证官+存证官+裁决官4大Agent能力，以及RAG知识库检索、API开放平台等高级功能。',
                'original_total_price': 997,
                'package_price': 598,
                'included_features': [
                    'S级旗舰场景(全量功能解锁)',
                    'A级核心场景(高频检测能力)',
                    '自选1个B级增强场景',
                    '4大Agent协同执行权限',
                    'RAG 10万+知识库检索',
                    '开发者API接入(1000次/月)',
                    '优先技术支持响应',
                    '年度安全规则库更新',
                ],
                'tier_badges': ['👑 S级', '⭐ A级', '🔧 B级'],
                'validity_days': 365,
                'max_users': 3,
                'is_featured': True,
                'sort_order': 1,
            },
            {
                'name': '双核快速套餐 (S+A)',
                'package_type': 'combo_sa',
                'description': 'S级旗舰场景 + A级核心场景组合，适合需要核心检测能力的团队用户。',
                'original_total_price': 797,
                'package_price': 498,
                'included_features': [
                    'S级旗舰场景(全量功能解锁)',
                    'A级核心场景(高频检测能力)',
                    '2大Agent基础执行权限',
                    'RAG 5万+知识库检索',
                    '标准技术支持',
                ],
                'tier_badges': ['👑 S级', '⭐ A级'],
                'validity_days': 365,
                'max_users': 1,
                'is_featured': True,
                'sort_order': 2,
            },
            {
                'name': '轻量入门套餐 (A+B)',
                'package_type': 'combo_ab',
                'description': 'A级核心场景 + B级增强场景组合，适合个人用户和小团队起步使用。',
                'original_total_price': 297,
                'package_price': 198,
                'included_features': [
                    'A级核心场景(高频检测能力)',
                    '自选1个B级增强场景',
                    '单Agent执行权限',
                    'RAG 基础检索',
                    '社区支持',
                ],
                'tier_badges': ['⭐ A级', '🔧 B级'],
                'validity_days': 180,
                'max_users': 1,
                'is_featured': False,
                'sort_order': 3,
            },
        ]

        for pd in packages_data:
            s_prod = s_products[0] if s_products else None
            a_prod = a_products[0] if a_products else None
            b_list = b_products[:3] if b_products else []

            obj, created = ScenarioPackage.objects.update_or_create(
                name=pd['name'],
                defaults={
                    **pd,
                    's_scenario': s_prod,
                    'a_scenario': a_prod,
                }
            )
            if b_list and created:
                obj.b_scenarios.set(b_list)
            status = 'Created' if created else 'Updated'
            self.stdout.write(f'  [{status}] {pd["name"]} - ¥{pd["package_price"]}')

    def _seed_enterprise_audit_services(self):
        self.stdout.write('[2/2] Seeding enterprise audit services...')

        services_data = [
            {
                'name': '企业AI内容安全基础审计（年度）',
                'audit_tier': 'essential',
                'scope': 'ai_content',
                'description': '基于C级场景能力，为企业提供AI内容安全合规性基础审计服务。覆盖内容审核、敏感信息检测、版权保护等核心领域，帮助企业满足《生成式人工智能服务管理暂行办法》合规要求。',
                'deliverables': [
                    '《AI内容安全现状评估报告》×1份',
                    '《风险清单与整改建议》×1份',
                    '《合规差距分析报告》×1份',
                    '线上汇报会议 ×2次',
                ],
                'base_price': 50000,
                'min_price': 50000,
                'profit_margin': 80,
                'audit_days': 15,
                'on_site_visits': 0,
                'report_count': 3,
                'includes_remediation': False,
                'includes_certification': False,
                'includes_training': False,
                'target_company_size': '50-200人',
                'industry_focus': ['互联网', '媒体', '教育', '电商'],
                'compliance_standards': ['生成式AI管理办法', '网络信息内容生态治理规定'],
                'is_recommended': True,
            },
            {
                'name': 'Agent系统安全专业审计（年度）',
                'audit_tier': 'professional',
                'scope': 'agent_security',
                'description': '针对企业部署的AI Agent系统进行深度安全审计，包括Prompt注入攻击测试、输出越权检测、多Agent协作链路安全评估等专业服务。',
                'deliverables': [
                    '《Agent系统架构安全评估报告》×1份',
                    '《Prompt注入攻击模拟测试报告》×1份',
                    '《多Agent链路安全审计报告》×1份',
                    '《整改方案与最佳实践指南》×1份',
                    '线上汇报会议 ×4次',
                    '现场调研 ×1次',
                ],
                'base_price': 80000,
                'min_price': 70000,
                'profit_margin': 82,
                'audit_days': 25,
                'on_site_visits': 1,
                'report_count': 5,
                'includes_remediation': True,
                'includes_certification': False,
                'includes_training': True,
                'target_company_size': '200-1000人',
                'industry_focus': ['金融科技', '医疗健康', '政务', '大型互联网'],
                'compliance_standards': ['等保2.0三级', 'ISO27001', '个人信息保护法'],
                'is_recommended': True,
            },
            {
                'name': 'RAG系统合规性专项审计',
                'audit_tier': 'professional',
                'scope': 'rag_compliance',
                'description': '对企业RAG检索增强系统的数据来源、知识库管理、检索安全性、输出准确性进行全面合规审计，确保知识资产安全和AI输出可信。',
                'deliverables': [
                    '《RAG系统数据流向图》×1份',
                    '《知识库分类分级合规评估》×1份',
                    '《检索安全性与防注入测试报告》×1份',
                    '《输出准确率与幻觉风险评估》×1份',
                    '线上汇报会议 ×3次',
                ],
                'base_price': 65000,
                'min_price': 55000,
                'profit_margin': 78,
                'audit_days': 20,
                'on_site_visits': 1,
                'report_count': 4,
                'includes_remediation': True,
                'includes_certification': False,
                'includes_training': False,
                'target_company_size': '100-500人',
                'industry_focus': ['法律', '咨询', '金融', '科研'],
                'compliance_standards': ['数据安全法', '个人信息保护法', '网络安全法'],
                'is_recommended': False,
            },
            {
                'name': '企业全栈安全审计旗舰版（年度）',
                'audit_tier': 'enterprise',
                'scope': 'full_stack',
                'description': '最全面的企业级AI安全审计服务，覆盖AI内容安全、Agent系统、RAG合规、数据分类分级、API安全五大维度。提供现场审计、整改辅导、认证支持一站式服务。',
                'deliverables': [
                    '《企业AI安全全景评估报告》×1份（含5大维度）',
                    '《渗透测试与漏洞扫描报告》×1份',
                    '《数据分类分级实施评估》×1份',
                    '《API接口安全审计报告》×1份',
                    '《等保2.0差距分析与整改路线图》×1份',
                    '《ISO27001合规准备指南》×1份',
                    '现场调研 ×2次',
                    '管理层汇报 ×2次',
                    '技术培训 ×2场',
                    '季度复查 ×4次',
                ],
                'base_price': 150000,
                'min_price': 120000,
                'profit_margin': 85,
                'audit_days': 45,
                'on_site_visits': 2,
                'report_count': 10,
                'includes_remediation': True,
                'includes_certification': True,
                'includes_training': True,
                'target_company_size': '500人以上',
                'industry_focus': ['金融', '政府', '医疗', '能源', '电信'],
                'compliance_standards': ['等保2.0三级/四级', 'ISO27001', 'ISO27701', 'GDPR参考', '数据安全法', '个人信息保护法'],
                'is_recommended': True,
            },
            {
                'name': 'API接口安全专项审计',
                'audit_tier': 'essential',
                'scope': 'api_security',
                'description': '对企业开放的API接口进行安全审计，包括身份认证、访问控制、速率限制、输入验证、日志审计等关键安全点检查。',
                'deliverables': [
                    '《API安全基线评估报告》×1份',
                    '《OWASP API Top 10对照检查表》×1份',
                    '《认证授权机制审查报告》×1份',
                    '线上汇报会议 ×2次',
                ],
                'base_price': 40000,
                'min_price': 35000,
                'profit_margin': 75,
                'audit_days': 10,
                'on_site_visits': 0,
                'report_count': 3,
                'includes_remediation': False,
                'includes_certification': False,
                'includes_training': False,
                'target_company_size': '不限',
                'industry_focus': ['所有行业'],
                'compliance_standards': ['OWASP API Security Top 10', '网络安全法'],
                'is_recommended': False,
            },
            {
                'name': '数据分类分级实施审计',
                'audit_tier': 'professional',
                'scope': 'data_classification',
                'description': '依据《数据安全法》第21条要求，协助企业建立完善的数据分类分级制度，对现有数据进行PII标注和敏感度分级，并出具合规审计报告。',
                'deliverables': [
                    '《数据资产盘点报告》×1份',
                    '《PII字段标注清单》（含脱敏策略）×1份',
                    '《数据分类分级制度文档》×1套',
                    '《DPO任命与管理流程建议》×1份',
                    '《合规对标检查表》×1份',
                    '现场调研 ×1次',
                    '培训工作坊 ×1场',
                ],
                'base_price': 90000,
                'min_price': 80000,
                'profit_margin': 83,
                'audit_days': 30,
                'on_site_visits': 1,
                'report_count': 6,
                'includes_remediation': True,
                'includes_certification': True,
                'includes_training': True,
                'target_company_size': '200人以上',
                'industry_focus': ['金融', '医疗', '政府', '教育'],
                'compliance_standards': ['数据安全法', '个人信息保护法', 'GB/T 35273-2020'],
                'is_recommended': False,
            },
        ]

        for sd in services_data:
            obj, created = EnterpriseAuditService.objects.update_or_create(
                name=sd['name'], defaults=sd)
            status = 'Created' if created else 'Updated'
            tier_label = dict(EnterpriseAuditService.AUDIT_TIER_CHOICES).get(sd['audit_tier'], '')
            scope_label = dict(EnterpriseAuditService.AUDIT_SCOPE_CHOICES).get(sd['scope'], '')
            self.stdout.write(
                f'  [{status}] {sd["name"]} | {tier_label} | ¥{sd["base_price"]}/年 | 利润{sd["profit_margin"]}%'
            )

        total = EnterpriseAuditService.objects.count()
        total_value = sum(s.base_price for s in EnterpriseAuditService.objects.all())
        avg_margin = round(sum(s.profit_margin for s in EnterpriseAuditService.objects.all()) / max(total, 1), 1)
        self.stdout.write(f'\n     Total: {total} audit services, Avg price: ¥{total_value//total}, Avg margin: {avg_margin}%')

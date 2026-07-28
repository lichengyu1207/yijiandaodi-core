import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()
from decimal import Decimal
from datetime import date, timedelta
from auth_app.enterprise_models import EnterpriseAccount, EnterpriseMember, EnterpriseAPIKey, SoftwareCopyrightApplication
from auth_app.affiliate_models import MembershipPlan
from django.contrib.auth import get_user_model

User = get_user_model()

print('=== 1. Seeding 19999 Enterprise Premium Plan ===')

try:
    MembershipPlan.objects.update_or_create(
        plan_type='enterprise_premium_19999',
        defaults={
            'plan_name': '企业高级版',
            'price': Decimal('19999.00'),
            'original_price': Decimal('29999.00'),
            'duration_days': 365,
            'vip_level': 10,
            'daily_limit': 0,
            'description': '企业高级版年费 - 无限API调用 + 50成员 + 专属客户经理 + SLA保障 + 私有化部署支持',
            'features': json.dumps(['无限API调用', '50个成员席位', '专属客户经理', '99.9% SLA保障', '私有化部署支持', '定制化开发', '优先技术支持', '月度数据报告']),
            'skill_categories': ['all'],
            'included_skills_count': 200,
            'sort_order': 100,
            'is_active': True,
            'is_hot': True,
            'is_new': True,
        }
    )
    print('[OK] enterprise_premium_19999 seeded')
except Exception as e:
    print('[WARN] enterprise_premium: ' + str(e))

try:
    MembershipPlan.objects.update_or_create(
        plan_type='enterprise_starter_2999',
        defaults={
            'plan_name': '企业基础版',
            'price': Decimal('2999.00'),
            'original_price': Decimal('4999.00'),
            'duration_days': 365,
            'vip_level': 8,
            'daily_limit': 5000,
            'description': '企业基础版年费 - 10万次API/月 + 10成员 + 基础技术支持',
            'features': json.dumps(['10万次API调用/月', '10个成员席位', '基础技术支持', '数据导出', 'Webhook通知']),
            'skill_categories': ['security', 'content'],
            'included_skills_count': 80,
            'sort_order': 90,
            'is_active': True,
            'is_hot': False,
            'is_new': True,
        }
    )
    print('[OK] enterprise_starter_2999 seeded')
except Exception as e:
    print('[WARN] enterprise_starter: ' + str(e))

print()
print('=== 2. Seeding 20 Sample Enterprises ===')
demo_users = list(User.objects.all()[:25])
if len(demo_users) < 5:
    for i in range(5):
        u, _ = User.objects.get_or_create(username='ent_admin_' + str(i+1), defaults={'email': 'admin' + str(i+1) + '@demo.com'})
        demo_users.append(u)

enterprises_data = [
    ('北京智安科技有限公司', 'professional', 'active', '张总', '13800138001', 50000, 200000),
    ('上海深鉴信息科技', 'enterprise_premium', 'active', '李总', '13900139002', 150000, 450000),
    ('广州内容安全研究院', 'starter', 'active', '王院长', '13700137003', 10000, 30000),
    ('深圳AI检测实验室', 'professional', 'trial', '陈博士', '13600136004', 0, 0),
    ('杭州数字风控中心', 'enterprise_premium', 'active', '刘主任', '13500135005', 80000, 250000),
    ('成都网络安全公司', 'starter', 'active', '赵经理', '13400134006', 15000, 45000),
    ('武汉智能审核平台', 'professional', 'suspended', '孙总', '13300133007', 0, 80000),
    ('南京文本分析科技', 'enterprise_premium', 'active', '周CEO', '13200132008', 120000, 380000),
    ('天津内容治理系统', 'starter', 'active', '吴工', '13100131009', 8000, 24000),
    ('重庆AI安全服务', 'professional', 'active', '郑总', '13000130010', 35000, 105000),
    ('西安数据合规科技', 'enterprise_premium', 'active', '钱总监', '15900159011', 90000, 270000),
    ('长沙舆情监测中心', 'starter', 'trial', '冯主任', '15800158012', 0, 0),
    ('沈阳信息安全所', 'professional', 'active', '褚所长', '15700157013', 22000, 66000),
    ('大连软件园企业', 'starter', 'active', '卫经理', '15600156014', 12000, 36000),
    ('青岛海洋大数据', 'enterprise_premium', 'active', '蒋总', '15500155015', 65000, 195000),
    ('郑州电商审核部', 'professional', 'active', '沈主管', '15400154016', 28000, 84000),
    ('厦门文创科技公司', 'starter', 'active', '韩CEO', '15300153017', 6000, 18000),
    ('昆明智慧城市办', 'enterprise_premium', 'active', '杨局长', '15200152018', 110000, 330000),
    ('苏州工业园区AI', 'professional', 'active', '朱董', '15100151019', 42000, 126000),
    ('合肥量子安全研究', 'starter', 'trial', '秦教授', '15000150020', 0, 0),
]

created_count = 0
for idx, (name, plan, status, contact, phone, balance_val, recharged_val) in enumerate(enterprises_data):
    admin_user = demo_users[idx % len(demo_users)]
    ent, created = EnterpriseAccount.objects.update_or_create(
        admin_user=admin_user,
        defaults={
            'name': name,
            'company_name': name + '(有限公司)',
            'contact_person': contact,
            'contact_phone': phone,
            'contact_email': 'contact@' + name[:4].lower() + '.com',
            'plan_type': plan,
            'status': status,
            'balance': Decimal(str(balance_val)),
            'total_recharged': Decimal(str(recharged_val)),
            'total_spent': Decimal(str(max(0, recharged_val - balance_val))),
            'api_calls_limit': 100000 if plan == 'enterprise_premium' else (50000 if plan == 'professional' else 10000),
            'api_calls_used': int(max(0, recharged_val / 10)),
            'members_limit': 50 if plan == 'enterprise_premium' else (20 if plan == 'professional' else 10),
            'paid_until': date.today() + timedelta(days=365),
            'auto_renew': True if status == 'active' else False,
            'notes': 'Demo enterprise ' + str(idx+1),
        }
    )
    EnterpriseMember.objects.get_or_create(
        enterprise=ent, user=admin_user,
        defaults={'role': 'owner', 'status': 'active', 'department': '管理', 'position': '创始人'}
    )
    created_count += 1

print('[OK] ' + str(created_count) + ' enterprises seeded')

print()
print('=== 3. Seeding 3 Software Copyright Applications ===')

copyrights = [
    {
        'software_name': '一鉴到底AI内容检测平台',
        'software_type': 'ai_detection_platform',
        'version': 'V2.0',
        'description': '基于深度学习的内容安全检测平台，支持文本、图片、视频等多模态内容的AI识别与审核。集成200+技能矩阵，覆盖AIGC检测、敏感词过滤、版权识别、虚假信息鉴别等核心场景。采用RAG知识库增强检索，结合四角色AI Agent协作引擎，实现毫秒级响应的智能内容审核。',
        'tech_stack': 'Python 3.11 / Django 6.0 / React 18 / TypeScript 5.6 / DeepSeek API / PostgreSQL / Redis / Docker',
        'lines_of_code': 128000,
        'development_start_date': date(2024, 6, 1),
        'first_public_date': date(2024, 12, 15),
        'applicant_name': '一鉴到底科技有限公司',
        'applicant_type': 'corporate',
        'status': 'submitted',
        'submit_to': 'csdncc',
        'documents': json.dumps(['源代码清单.pdf', '用户操作手册.pdf', '功能说明书.pdf', '界面截图集.zip']),
        'screenshots': json.dumps(['dashboard.png', 'skill-selector.png', 'ai-chat.png', 'report-gen.png']),
    },
    {
        'software_name': '一鉴到底AI智能推荐引擎',
        'software_type': 'ai_recommendation_engine',
        'version': 'V2.0',
        'description': '基于多策略融合的个性化推荐引擎v2.0，包含balanced/conversion_optimized/engagement_focused/discovery_driven四种推荐策略。集成时间衰减因子、协同过滤算法、转化率优化模型和场景匹配机制。支持A/B测试框架(MD5哈希分桶)、PromoCardScheduler智能调度系统，实现千人千面的精准内容分发。',
        'tech_stack': 'Python 3.11 / Django REST Framework / NumPy / Pandas / Redis Sorted Sets / Elasticsearch',
        'lines_of_code': 85000,
        'development_start_date': date(2024, 8, 1),
        'first_public_date': date(2025, 1, 20),
        'applicant_name': '一鉴到底科技有限公司',
        'applicant_type': 'corporate',
        'status': 'under_review',
        'submit_to': 'sipa',
        'documents': json.dumps(['算法设计文档.pdf', '推荐策略说明.pdf', 'A/B测试报告.pdf', '效果评估报告.pdf']),
        'screenshots': json.dumps(['rec-engine.png', 'ab-test.png', 'strategy-config.png', 'analytics.png']),
    },
    {
        'software_name': '一鉴到底企业安全管理系统',
        'software_type': 'enterprise_security_system',
        'version': 'V1.0',
        'description': '面向企业级客户的综合安全管理平台，提供企业账号管理、API密钥管理(SHA-256加密)、批量充值审批工作流、用量监控仪表盘、IP白名单控制、速率限制网关中间件等功能。支持三档企业套餐(基础版¥2999/专业版¥19999/高级版¥19999)，内置软著申请全流程管理系统。',
        'tech_stack': 'Python 3.11 / Django 6.0 / DRF / JWT Auth / SHA-256 / PostgreSQL / Celery / Nginx',
        'lines_of_code': 62000,
        'development_start_date': date(2025, 1, 1),
        'first_public_date': date(2025, 5, 28),
        'applicant_name': '一鉴到底科技有限公司',
        'applicant_type': 'corporate',
        'status': 'draft',
        'submit_to': 'copyright_center',
        'documents': json.dumps(['系统架构图.pdf', 'API接口文档.pdf', '安全管理规范.pdf', '部署手册.pdf']),
        'screenshots': json.dumps(['ent-dashboard.png', 'member-mgmt.png', 'api-keys.png', 'recharge-flow.png']),
    },
]

for cdata in copyrights:
    app, cr = SoftwareCopyrightApplication.objects.update_or_create(
        software_name=cdata['software_name'],
        software_type=cdata['software_type'],
        defaults=cdata
    )
    if cr:
        app.registration_number = 'SR' + date.today().strftime('%Y%m%d') + str(app.id).zfill(6)
        app.save(update_fields=['registration_number'])
    print('  [OK] ' + cdata['software_name'] + ' -> ' + app.status)

print()
print('=== SEEDING COMPLETE ===')
print('Total enterprises: ' + str(EnterpriseAccount.objects.count()))
print('Total members: ' + str(EnterpriseMember.objects.count()))
print('Copyright apps: ' + str(SoftwareCopyrightApplication.objects.count()))
print('Enterprise plans: ' + str(MembershipPlan.objects.filter(plan_type__startswith='enterprise').count()))

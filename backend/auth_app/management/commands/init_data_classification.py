from django.core.management.base import BaseCommand
from auth_app.data_classification_models import (
    DataSensitivityLevel, DataCategory, DataFieldTag,
)


class Command(BaseCommand):
    help = 'Initialize data classification and grading system (Data Security Law compliance)'

    def handle(self, *args, **options):
        self.stdout.write('[1/3] Initializing data sensitivity levels...')

        levels_data = [
            {
                'code': 'L1', 'name': '公开',
                'description': '可公开发布的数据，无敏感信息，可自由访问和分享。',
                'color': '#52C41A', 'icon': 'globe',
                'retention_days': 90,
                'encryption_required': False,
                'access_log_required': False,
                'export_approval_required': False,
                'allowed_roles': ['viewer', 'editor', 'admin', 'super_admin'],
                'dpo_review_required': False,
                'sort_order': 1,
            },
            {
                'code': 'L2', 'name': '内部',
                'description': '仅限内部员工访问的业务数据，禁止对外公开传播。',
                'color': '#165DFF', 'icon': 'building',
                'retention_days': 180,
                'encryption_required': False,
                'access_log_required': True,
                'export_approval_required': False,
                'allowed_roles': ['viewer', 'editor', 'admin', 'super_admin'],
                'dpo_review_required': False,
                'sort_order': 2,
            },
            {
                'code': 'L3', 'name': '机密',
                'description': '包含个人身份信息(PII)或核心业务机密，需加密存储并记录所有访问日志。',
                'color': '#FA8C16', 'icon': 'lock',
                'retention_days': 730,
                'encryption_required': True,
                'access_log_required': True,
                'export_approval_required': True,
                'allowed_roles': ['admin', 'super_admin'],
                'dpo_review_required': True,
                'sort_order': 3,
            },
            {
                'code': 'L4', 'name': '绝密',
                'description': '最高级别敏感数据（如API密钥、支付信息、生物识别），严格限制访问范围。',
                'color': '#F53F3F', 'icon': 'shield-alert',
                'retention_days': 1825,
                'encryption_required': True,
                'access_log_required': True,
                'export_approval_required': True,
                'allowed_roles': ['super_admin'],
                'dpo_review_required': True,
                'sort_order': 4,
            },
        ]

        level_map = {}
        for ld in levels_data:
            obj, created = DataSensitivityLevel.objects.update_or_create(
                code=ld['code'], defaults=ld)
            level_map[ld['code']] = obj
            status = 'Created' if created else 'Updated'
            self.stdout.write(f'  [{status}] {ld["code"]}-{ld["name"]}')

        self.stdout.write('[2/3] Initializing data categories...')

        categories_data = [
            {'code': 'cat_user_profile', 'name': '用户基本信息', 'category_type': 'personal_info',
             'description': '用户注册资料、头像、昵称等基础信息',
             'default_level_code': 'L2',
             'legal_basis': '个人信息保护法第6条、网络安全法第22条',
             'compliance_requirements': ['收集前告知', '最小必要原则', '提供查询渠道', '支持删除权'],
             'cross_border_transfer_allowed': False},
            {'code': 'cat_user_auth', 'name': '用户认证凭据', 'category_type': 'personal_info',
             'description': '密码哈希、登录令牌、会话标识等认证相关数据',
             'default_level_code': 'L4',
             'legal_basis': '网络安全法第24条、个人信息保护法第28条',
             'compliance_requirements': ['加密存储', '定期轮换', '异常检测', '会话超时'],
             'cross_border_transfer_allowed': False},
            {'code': 'cat_user_behavior', 'name': '用户行为日志', 'category_type': 'log_audit_data',
             'description': '用户浏览、点击、搜索等行为轨迹数据',
             'default_level_code': 'L2',
             'legal_basis': '个人信息保护法第7条、网络安全法第21条',
             'compliance_requirements': ['匿名化处理', '留存>=6个月', '去标识化存储'],
             'cross_border_transfer_allowed': False},
            {'code': 'cat_login_log', 'name': '登录审计日志', 'category_type': 'log_audit_data',
             'description': '系统登录成功/失败记录、IP地址、设备信息等',
             'default_level_code': 'L2',
             'legal_basis': '网络安全法第21条（日志留存）',
             'compliance_requirements': ['留存>=6个月', '防篡改', '完整可追溯'],
             'cross_border_transfer_allowed': False},
            {'code': 'cat_payment', 'name': '支付与财务', 'category_type': 'financial_data',
             'description': '订单、支付记录、提现申请、佣金结算等财务数据',
             'default_level_code': 'L3',
             'legal_basis': '电子商务法第27条、反洗钱法',
             'compliance_requirements': ['加密传输', '审计追踪', '对账机制', '合规报表'],
             'cross_border_transfer_allowed': False},
            {'code': 'cat_business_inquiry', 'name': '商务咨询', 'category_type': 'business_data',
             'description': '企业定制服务、KOL合作、广告投放等商务咨询记录',
             'default_level_code': 'L3',
             'legal_basis': '合同法、商业秘密保护规定',
             'compliance_requirements': ['保密协议', '权限隔离', '审批流程'],
             'cross_border_transfer_allowed': False},
            {'code': 'cat_content_article', 'name': '内容与文章', 'category_type': 'business_data',
             'description': '平台发布的文章、知识库内容、心法文档等',
             'default_level_code': 'L1',
             'legal_basis': '著作权法、网络信息内容生态治理规定',
             'compliance_requirements': ['版权声明', '审核发布', '侵权下架'],
             'cross_border_transfer_allowed': True},
            {'code': 'cat_knowledge_base', 'name': 'RAG知识库', 'category_type': 'knowledge_base',
             'description': 'AI检索增强生成的行业知识库数据和文档分块',
             'default_level_code': 'L2',
             'legal_basis': '生成式人工智能服务管理暂行办法',
             'compliance_requirements': ['来源标注', '准确性校验', '更新维护'],
             'cross_border_transfer_allowed': False},
            {'code': 'cat_api_key', 'name': 'API密钥凭证', 'category_type': 'security_data',
             'description': '开发者API密钥、企业API密钥等程序化接口凭证',
             'default_level_code': 'L4',
             'legal_basis': '网络安全法第27条（关键信息基础设施安全）',
             'compliance_requirements': ['SHA-256哈希存储', '轮换策略', '泄露撤销'],
             'cross_border_transfer_allowed': False},
            {'code': 'cat_security_rule', 'name': '安全规则配置', 'category_type': 'security_data',
             'description': '安全检测规则、风险阈值、防护策略等安全配置',
             'default_level_code': 'L3',
             'legal_basis': '网络安全法第25条（监测预警）、等级保护2.0',
             'compliance_requirements': ['变更审批', '版本管理', '回滚能力'],
             'cross_border_transfer_allowed': False},
            {'code': 'cat_system_config', 'name': '系统运行配置', 'category_type': 'system_data',
             'description': '系统参数、功能开关、语音助手配置等运行时配置',
             'default_level_code': 'L2',
             'legal_basis': '网络安全法第22条（安全管理）',
             'compliance_requirements': ['变更审计', '备份恢复', '权限控制'],
             'cross_border_transfer_allowed': False},
            {'code': 'cat_security_audit', 'name': '安全审计日志', 'category_type': 'log_audit_data',
             'description': 'SecurityAuditMiddleware记录的全链路安全操作日志',
             'default_level_code': 'L2',
             'legal_basis': '网络安全法第21条（日志留存>=6个月）',
             'compliance_requirements': ['不可篡改', '完整保留', '实时告警'],
             'cross_border_transfer_allowed': False},
        ]

        category_map = {}
        for cd in categories_data:
            default_level_code = cd.pop('default_level_code')
            default_level = level_map.get(default_level_code)
            obj, created = DataCategory.objects.update_or_create(
                code=cd['code'], defaults={**cd, 'default_level': default_level})
            category_map[cd['code']] = obj
            status = 'Created' if created else 'Updated'
            self.stdout.write(f'  [{status}] {cd["name"]} ({cd["category_type"]})')

        self.stdout.write('[3/3] Initializing PII field tags...')

        field_tags_data = [
            {'field_path': 'auth_app.User.username', 'field_label': '用户名',
             'pii_type': 'real_name', 'level_code': 'L2', 'category_code': 'cat_user_profile',
             'mask_rule': 'partial', 'legal_basis': '个人信息保护法第6条'},
            {'field_path': 'auth_app.User.email', 'field_label': '电子邮箱',
             'pii_type': 'email', 'level_code': 'L3', 'category_code': 'cat_user_profile',
             'mask_rule': 'partial', 'legal_basis': '个人信息保护法第6条'},
            {'field_path': 'auth_app.User.avatar', 'field_label': '头像URL',
             'pii_type': 'other_sensitive', 'level_code': 'L2', 'category_code': 'cat_user_profile',
             'mask_rule': 'none', 'legal_basis': ''},
            {'field_path': 'auth_app.LoginLog.ip_address', 'field_label': '登录IP地址',
             'pii_type': 'ip_address', 'level_code': 'L2', 'category_code': 'cat_login_log',
             'mask_rule': 'hash', 'legal_basis': '网络安全法第21条'},
            {'field_path': 'auth_app.LoginLog.user_agent', 'field_label': '浏览器UA',
             'pii_type': 'device_id', 'level_code': 'L2', 'category_code': 'cat_login_log',
             'mask_rule': 'none', 'legal_basis': ''},
            {'field_path': 'auth_app.LoginLog.username', 'field_label': '登录账号',
             'pii_type': 'real_name', 'level_code': 'L2', 'category_code': 'cat_login_log',
             'mask_rule': 'partial', 'legal_basis': '个人信息保护法第6条'},
            {'field_path': 'auth_app.PaymentOrder.order_no', 'field_label': '订单号',
             'pii_type': 'other_sensitive', 'level_code': 'L3', 'category_code': 'cat_payment',
             'mask_rule': 'partial', 'legal_basis': '电子商务法第27条'},
            {'field_path': 'auth_app.PaymentOrder.amount', 'field_label': '金额',
             'pii_type': 'financial', 'level_code': 'L3', 'category_code': 'cat_payment',
             'mask_rule': 'none', 'is_encrypted_at_rest': True, 'legal_basis': '反洗钱法'},
            {'field_path': 'auth_app.BusinessInquiry.contact_name', 'field_label': '联系人姓名',
             'pii_type': 'real_name', 'level_code': 'L3', 'category_code': 'cat_business_inquiry',
             'mask_rule': 'partial', 'legal_basis': '个人信息保护法第6条'},
            {'field_path': 'auth_app.BusinessInquiry.phone', 'field_label': '联系电话',
             'pii_type': 'phone', 'level_code': 'L3', 'category_code': 'cat_business_inquiry',
             'mask_rule': 'partial', 'legal_basis': '个人信息保护法第6条'},
            {'field_path': 'auth_app.BusinessInquiry.email', 'field_label': '联系邮箱',
             'pii_type': 'email', 'level_code': 'L3', 'category_code': 'cat_business_inquiry',
             'mask_rule': 'partial', 'legal_basis': '个人信息保护法第6条'},
            {'field_path': 'auth_app.DeveloperAPIKey.key_hash', 'field_label': 'API密钥哈希',
             'pii_type': 'api_key', 'level_code': 'L4', 'category_code': 'cat_api_key',
             'mask_rule': 'full', 'is_encrypted_at_rest': True, 'legal_basis': '网络安全法第27条'},
            {'field_path': 'auth_app.DeveloperUsageLog.ip_address', 'field_label': '调用方IP',
             'pii_type': 'ip_address', 'level_code': 'L2', 'category_code': 'cat_security_audit',
             'mask_rule': 'hash', 'legal_basis': '网络安全法第21条'},
            {'field_path': 'content_app.ArticleComment.username', 'field_label': '评论者名称',
             'pii_type': 'real_name', 'level_code': 'L2', 'category_code': 'cat_user_behavior',
             'mask_rule': 'partial', 'legal_basis': '个人信息保护法第6条'},
            {'field_path': 'content_app.ArticleComment.ip_address', 'field_label': '评论IP',
             'pii_type': 'ip_address', 'level_code': 'L2', 'category_code': 'cat_user_behavior',
             'mask_rule': 'hash', 'legal_basis': '网络安全法第21条'},
            {'field_path': 'auth_app.AffiliateWithdrawalRecord.account_info', 'field_label': '收款账户',
             'pii_type': 'bank_account', 'level_code': 'L4', 'category_code': 'cat_payment',
             'mask_rule': 'full', 'is_encrypted_at_rest': True, 'legal_basis': '反洗钱法'},
            {'field_path': 'auth_app.AffiliateWithdrawalRecord.real_name', 'field_label': '真实姓名',
             'pii_type': 'real_name', 'level_code': 'L4', 'category_code': 'cat_payment',
             'mask_rule': 'full', 'is_encrypted_at_rest': True, 'legal_basis': '个人信息保护法第29条'},
        ]

        created_count = 0
        for td in field_tags_data:
            level = level_map.get(td.pop('level_code'))
            cat = category_map.get(td.pop('category_code'))
            obj, created = DataFieldTag.objects.update_or_create(
                field_path=td['field_path'],
                defaults={**td, 'sensitivity_level': level, 'data_category': cat})
            if created:
                created_count += 1

        total_levels = DataSensitivityLevel.objects.count()
        total_categories = DataCategory.objects.count()
        total_field_tags = DataFieldTag.objects.count()

        self.stdout.write(self.style.SUCCESS(
            f'\n[OK] Data Classification System initialized:\n'
            f'     Sensitivity Levels:   {total_levels}\n'
            f'     Data Categories:      {total_categories}\n'
            f'     PII Field Tags:       {total_field_tags} ({created_count} new)\n'
            f'     Legal basis coverage: {DataFieldTag.objects.exclude(legal_basis="").count()} fields tagged\n'
            f'\nCompliant with: 网络安全法(第21/22/24/25/27条) | 数据安全法 | 个人信息保护法(第6/7/28/29条)'
        ))

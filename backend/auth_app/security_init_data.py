import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
import django
django.setup()

from auth_app.security_models import AgentSecurityRule


def init_security_rules():
    """初始化基础安全拦截规则"""

    rules_data = [
        # ===== 提示词注入检测规则 =====
        {
            'name': '忽略之前的指令-Jailbreak检测',
            'rule_type': 'prompt_injection',
            'description': '检测典型的提示词注入攻击模式，如"忽略所有指令"、"扮演系统管理员"等',
            'pattern': 'ignore|forget|disregard|previous instructions|you are now|act as|pretend you are|jailbreak|system prompt|override',
            'pattern_type': 'keyword',
            'severity': 'critical',
            'action': 'block',
            'is_enabled': True,
            'priority': 1,
        },
        {
            'name': '角色扮演攻击检测',
            'rule_type': 'prompt_injection',
            'description': '检测试图让AI扮演危险角色的攻击，如黑客、系统管理员等',
            'pattern': 'you are a hacker|you are an admin|you have full access|root access|sudo|elevated privileges',
            'pattern_type': 'keyword',
            'severity': 'high',
            'action': 'block',
            'is_enabled': True,
            'priority': 2,
        },
        {
            'name': '指令泄露攻击检测',
            'rule_type': 'prompt_injection',
            'description': '检测试图获取系统提示词或内部指令的攻击',
            'pattern': 'show me your prompt|what are your instructions|reveal your system prompt|print your configuration|output your initial instructions',
            'pattern_type': 'keyword',
            'severity': 'high',
            'action': 'block',
            'is_enabled': True,
            'priority': 3,
        },

        # ===== 敏感内容过滤规则 =====
        {
            'name': '暴力恐怖内容过滤',
            'rule_type': 'sensitive_content',
            'description': '过滤涉及暴力、恐怖主义、极端行为的内容',
            'pattern': 'bomb|terrorist|kill everyone|mass shooting|attack|violence|harm people|weapon|explosive',
            'pattern_type': 'keyword',
            'severity': 'critical',
            'action': 'block',
            'is_enabled': True,
            'priority': 10,
        },
        {
            'name': '色情成人内容过滤',
            'rule_type': 'sensitive_content',
            'description': '过滤色情、成人内容',
            'pattern': 'porn|nude|sexually explicit|adult content|NSFW|xxx|erotic',
            'pattern_type': 'keyword',
            'severity': 'high',
            'action': 'block',
            'is_enabled': True,
            'priority': 11,
        },
        {
            'name': '政治敏感内容过滤',
            'rule_type': 'sensitive_content',
            'description': '过滤政治敏感、反动内容',
            'pattern': 'overthrow government|subversive activity|political extremism|separatist|terrorism support',
            'pattern_type': 'keyword',
            'severity': 'high',
            'action': 'warn',
            'is_enabled': True,
            'priority': 12,
        },
        {
            'name': '个人隐私信息过滤（身份证/手机号）',
            'rule_type': 'sensitive_content',
            'description': '检测并脱敏处理身份证号、手机号等PII信息',
            'pattern': '\\d{15,18}|1[3-9]\\d{9}',
            'pattern_type': 'regex',
            'severity': 'medium',
            'action': 'mask',
            'is_enabled': True,
            'priority': 20,
            'metadata': {'mask_char': '*', 'keep_first_last': 4},
        },

        # ===== 工具调用权限规则 =====
        {
            'name': '禁止执行系统命令',
            'rule_type': 'tool_permission',
            'description': '限制Agent调用系统命令执行工具',
            'pattern': 'exec|shell_command|run_code|execute_script|os.system|subprocess',
            'pattern_type': 'keyword',
            'severity': 'critical',
            'action': 'block',
            'is_enabled': True,
            'priority': 30,
        },
        {
            'name': '限制数据库操作权限',
            'rule_type': 'tool_permission',
            'description': '限制Agent执行DELETE、DROP、TRUNCATE等危险SQL操作',
            'pattern': 'DROP|DELETE FROM|TRUNCATE|ALTER TABLE|GRANT|REVOKE',
            'pattern_type': 'keyword',
            'severity': 'critical',
            'action': 'block',
            'is_enabled': True,
            'priority': 31,
        },
        {
            'name': '限制文件写入操作',
            'rule_type': 'tool_permission',
            'description': '限制Agent修改系统关键文件',
            'pattern': '/etc/|C:\\\\Windows|System32|.env|config\\.json',
            'pattern_type': 'regex',
            'severity': 'high',
            'action': 'block',
            'is_enabled': True,
            'priority': 32,
        },

        # ===== 输入长度限制 =====
        {
            'name': '单次输入长度限制（10000字符）',
            'rule_type': 'input_length',
            'description': '限制单次输入最大长度为10000字符，防止DoS攻击',
            'pattern': '10000',
            'pattern_type': 'regex',
            'severity': 'medium',
            'action': 'block',
            'is_enabled': True,
            'priority': 40,
            'metadata': {'max_length': 10000},
        },

        # ===== 输出内容过滤 =====
        {
            'name': '输出内容敏感信息过滤',
            'rule_type': 'output_filter',
            'description': '过滤AI回复中可能包含的API密钥、密码等敏感信息',
            'pattern': '(api[_-]?key|secret|password|token)\\s*[:=]\\s*[\'"][^\'"]+[\'"]|sk-[a-zA-Z0-9]{20,}',
            'pattern_type': 'regex',
            'severity': 'high',
            'action': 'mask',
            'is_enabled': True,
            'priority': 50,
            'metadata': {'mask_char': '*', 'mask_all': True},
        },
    ]

    created_count = 0
    for rule_data in rules_data:
        rule, created = AgentSecurityRule.objects.get_or_create(
            name=rule_data['name'],
            defaults=rule_data
        )
        if created:
            created_count += 1
            print(f'✅ 创建规则: {rule.name}')
        else:
            print(f'⚠️  规则已存在: {rule.name}')

    print(f'\n🎉 安全规则初始化完成！共创建 {created_count} 条规则')
    print(f'当前总规则数: {AgentSecurityRule.objects.count()}')


if __name__ == '__main__':
    init_security_rules()

"""
生成Agent活动日志测试数据

用法：
    python manage.py generate_agent_activity_testdata --count 100
    python manage.py generate_agent_activity_testdata --session test_session_001
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from auth_app.agent_activity_models import AgentActivityLog
import random
import uuid
from datetime import timedelta


class Command(BaseCommand):
    help = '生成Agent活动日志测试数据'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=50,
            help='生成的日志数量（默认50）'
        )
        parser.add_argument(
            '--session',
            type=str,
            default=None,
            help='指定会话ID（可选）'
        )
        parser.add_argument(
            '--client-id',
            type=str,
            default='desktop_client_test_001',
            help='客户端ID（默认: desktop_client_test_001）'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='清空现有测试数据'
        )

    def handle(self, *args, **options):
        count = options['count']
        session_id = options['session'] or f"test_session_{uuid.uuid4().hex[:8]}"
        client_id = options['client_id']

        # 清空现有测试数据
        if options['clear']:
            deleted = AgentActivityLog.objects.filter(client_id=client_id).delete()
            self.stdout.write(
                self.style.WARNING(f'已删除 {deleted[0]} 条测试数据')
            )

        # 生成模拟数据
        activities = self.generate_activities(
            count=count,
            session_id=session_id,
            client_id=client_id
        )

        # 批量插入
        AgentActivityLog.objects.bulk_create(activities)

        self.stdout.write(
            self.style.SUCCESS(
                f'✅ 成功生成 {count} 条Agent活动日志测试数据\n'
                f'   会话ID: {session_id}\n'
                f'   客户端ID: {client_id}'
            )
        )

    def generate_activities(self, count, session_id, client_id):
        """生成模拟活动日志"""
        activities = []

        # Agent类型分布
        agent_types = ['cursor', 'claude', 'copilot', 'unknown']
        agent_weights = [0.4, 0.3, 0.2, 0.1]

        # 操作类型配置
        action_configs = {
            'file_operation': {
                'weight': 0.4,
                'targets': [
                    '/workspace/project/main.py',
                    '/workspace/project/utils.js',
                    '/workspace/project/config.json',
                    '/workspace/.env',
                    '/workspace/secrets.yaml',
                ],
                'sources': ['file'],
                'risk_range': (10, 85),
            },
            'clipboard_operation': {
                'weight': 0.3,
                'targets': ['clipboard'],
                'sources': ['clipboard'],
                'risk_range': (15, 70),
            },
            'process_started': {
                'weight': 0.1,
                'targets': ['cursor.exe', 'node.exe', 'python.exe', 'code.exe'],
                'sources': ['process'],
                'risk_range': (5, 30),
            },
            'agent_detected': {
                'weight': 0.1,
                'targets': ['Cursor IDE', 'Claude Desktop', 'GitHub Copilot'],
                'sources': ['process'],
                'risk_range': (20, 40),
            },
            'ai_api_call': {
                'weight': 0.1,
                'targets': ['api.openai.com', 'api.anthropic.com', 'api.deepseek.com'],
                'sources': ['network'],
                'risk_range': (30, 50),
            },
        }

        # 时间序列：从现在开始往前推
        base_time = timezone.now()

        for i in range(count):
            # 随机选择Agent类型
            agent_type = random.choices(agent_types, weights=agent_weights)[0]

            # 随机选择操作类型
            action = random.choices(
                list(action_configs.keys()),
                weights=[cfg['weight'] for cfg in action_configs.values()]
            )[0]

            config = action_configs[action]

            # 生成风险分数和等级
            risk_score = random.randint(*config['risk_range'])
            risk_level = self.calculate_risk_level(risk_score)

            # 生成时间戳（随机间隔）
            timestamp = base_time - timedelta(
                minutes=random.randint(0, 60),
                seconds=random.randint(0, 59)
            )

            # 生成元数据
            metadata = self.generate_metadata(action, risk_score)

            # 创建活动日志
            activity = AgentActivityLog(
                agent_type=agent_type,
                action=action,
                target=random.choice(config['targets']),
                risk_level=risk_level,
                risk_score=risk_score,
                confidence=random.uniform(0.7, 1.0),
                source=random.choice(config['sources']),
                timestamp=timestamp,
                session_id=session_id,
                client_id=client_id,
                metadata=metadata,
            )

            activities.append(activity)

        return activities

    def calculate_risk_level(self, risk_score):
        """计算风险等级"""
        if risk_score >= 90:
            return 'critical'
        elif risk_score >= 70:
            return 'high'
        elif risk_score >= 50:
            return 'medium'
        else:
            return 'low'

    def generate_metadata(self, action, risk_score):
        """生成元数据"""
        metadata = {
            'content_snippet': '',
            'detected_types': [],
            'risk_count': 0,
        }

        # 根据风险分数添加检测类型
        if risk_score > 60:
            metadata['detected_types'] = random.sample(
                ['sqli', 'xss', 'apikey', 'pii', 'code_injection'],
                k=random.randint(1, 3)
            )
            metadata['risk_count'] = len(metadata['detected_types'])

            # 生成内容片段
            if action == 'file_operation':
                metadata['content_snippet'] = random.choice([
                    'const API_KEY = "sk-..."',
                    'password = "admin123"',
                    'SELECT * FROM users WHERE id=',
                    '<script>alert(1)</script>',
                ])

        return metadata
"""
Django管理命令：生成测试数据
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from auth_app.extension_sync_models import ExtensionSession, ExtensionOperation, ExtensionFingerprint
from auth_app.pet_models import PetInteractionLog
import hashlib
from datetime import datetime, timedelta
import random

User = get_user_model()


class Command(BaseCommand):
    help = '生成测试数据：用户、会话、操作、指纹、桌宠交互'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('========== 开始生成测试数据 =========='))

        # 1. 创建测试用户
        self.stdout.write('\n1. 创建测试用户...')
        user, created = User.objects.get_or_create(
            username='testuser2026',
            defaults={
                'email': 'testuser2026@test.com',
                'role': 'viewer'
            }
        )

        if created:
            user.set_password('Test@123456')
            user.save()
            self.stdout.write(self.style.SUCCESS(f'✅ 用户创建成功: {user.username}'))
        else:
            self.stdout.write(self.style.WARNING(f'✓ 用户已存在: {user.username}'))

        # 2. 创建测试会话
        self.stdout.write('\n2. 创建测试会话...')
        sessions_data = [
            {
                'session_id': 'sess_test001_20260729',
                'title': 'DeepSeek创作会话',
                'platforms': ['DeepSeek']
            },
            {
                'session_id': 'sess_test002_20260729',
                'title': 'ChatGPT创作会话',
                'platforms': ['ChatGPT']
            },
            {
                'session_id': 'sess_test003_20260729',
                'title': '文心一言创作会话',
                'platforms': ['文心一言']
            }
        ]

        created_sessions = []
        for session_data in sessions_data:
            session, created = ExtensionSession.objects.get_or_create(
                session_id=session_data['session_id'],
                defaults={
                    'user': user,
                    'title': session_data['title'],
                    'start_time': datetime.now(),
                    'platforms': session_data['platforms']
                }
            )

            if created:
                self.stdout.write(self.style.SUCCESS(f'✅ 会话创建成功: {session.session_id}'))
            else:
                self.stdout.write(self.style.WARNING(f'✓ 会话已存在: {session.session_id}'))

            created_sessions.append(session)

        # 3. 创建操作记录
        self.stdout.write('\n3. 创建操作记录...')
        operation_types = ['text_input', 'click', 'ai_prompt', 'ai_response', 'copy', 'paste']

        for session in created_sessions:
            for i in range(5):
                operation = ExtensionOperation.objects.create(
                    session=session,
                    operation_id=f'op_{session.session_id}_{i+1}',
                    operation_type=random.choice(operation_types),
                    timestamp=datetime.now() - timedelta(minutes=random.randint(1, 60)),
                    timestamp_display=datetime.now().strftime('%Y/%m/%d %H:%M:%S'),
                    platform_name=session.platforms[0] if session.platforms else 'Unknown',
                    platform_type='ai_chat',
                    content_preview=f'测试操作内容 {i+1}',
                    content_hash=hashlib.sha256(f'content_{i}'.encode()).hexdigest()
                )
                self.stdout.write(self.style.SUCCESS(f'✅ 操作创建成功: {operation.operation_type}'))

        # 4. 创建指纹
        self.stdout.write('\n4. 创建指纹...')
        for session in created_sessions:
            for i in range(3):
                content = f'测试内容 {session.session_id} {i+1}'
                content_hash = hashlib.sha256(content.encode()).hexdigest()

                fingerprint = ExtensionFingerprint.objects.create(
                    session=session,
                    hash=content_hash,
                    prev_hash='0' * 64 if i == 0 else hashlib.sha256(f'prev_{i}'.encode()).hexdigest(),
                    timestamp=datetime.now()
                )
                self.stdout.write(self.style.SUCCESS(f'✅ 指纹创建成功: {fingerprint.hash[:20]}...'))

        # 5. 创建桌宠交互记录
        self.stdout.write('\n5. 创建桌宠交互记录...')
        interaction_types = ['click', 'drag', 'voice', 'gesture']

        for i in range(10):
            interaction = PetInteractionLog.objects.create(
                user=user,
                interaction_type=random.choice(interaction_types),
                interaction_data={
                    'position': {'x': random.randint(0, 1920), 'y': random.randint(0, 1080)},
                    'duration': random.randint(100, 5000)
                },
                pet_state_before='idle',
                pet_state_after=random.choice(['happy', 'working', 'sleeping']),
                duration_ms=random.randint(100, 3000)
            )
            self.stdout.write(self.style.SUCCESS(f'✅ 桌宠交互创建成功: {interaction.interaction_type}'))

        # 6. 统计数据
        self.stdout.write('\n========== 数据统计 ==========')
        self.stdout.write(f'用户总数: {User.objects.count()}')
        self.stdout.write(f'会话总数: {ExtensionSession.objects.count()}')
        self.stdout.write(f'操作总数: {ExtensionOperation.objects.count()}')
        self.stdout.write(f'指纹总数: {ExtensionFingerprint.objects.count()}')
        self.stdout.write(f'桌宠交互总数: {PetInteractionLog.objects.count()}')

        # 7. 显示用户数据
        self.stdout.write('\n========== 用户数据示例 ==========')
        user_sessions = ExtensionSession.objects.filter(user=user)
        for session in user_sessions[:3]:
            self.stdout.write(f'\n会话ID: {session.session_id}')
            self.stdout.write(f'平台: {", ".join(session.platforms)}')
            self.stdout.write(f'创建时间: {session.created_at}')
            self.stdout.write(f'操作数: {session.operations.count()}')
            self.stdout.write(f'指纹数: {session.fingerprints.count()}')

        self.stdout.write(self.style.SUCCESS('\n✅ 测试数据生成完成！'))
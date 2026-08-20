"""
合规治理层API集成测试

测试覆盖：
1. Agent合规性评分API的完整流程
2. 治理健康度监控API的快照和仪表板功能
3. 策略版本管理API的部署和回滚功能
4. 认证和权限验证
5. 数据验证和错误处理
"""

from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status

from .governance_models import AgentComplianceScore, GovernanceHealth, StrategyVersion
from .agent_identity_models import AgentIdentity
from .memory_models import StrategicMemory

User = get_user_model()


class GovernanceAPIIntegrationTestCase(TestCase):
    """合规治理层API集成测试基类"""
    
    def setUp(self):
        """测试准备"""
        # 创建测试用户
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='admin123',
            is_staff=True,
            role='admin'
        )
        
        self.normal_user = User.objects.create_user(
            username='user',
            email='user@example.com',
            password='user123',
            role='viewer'
        )
        
        # 创建测试Agent
        self.agents = {}
        risk_levels = ['safe', 'low', 'medium', 'high', 'critical']
        
        for i, risk_level in enumerate(risk_levels):
            agent = AgentIdentity.objects.create(
                agent_id=f'test_agent_{i+1}',
                agent_name=f'测试Agent{i+1}',
                trust_level=risk_level,
                api_key_hash=f'hash_{i+1}_{risk_level}'
            )
            self.agents[risk_level] = agent
        
        # 创建合规性评分数据
        self.scores = {}
        score_values = {
            'safe': (95.0, 'safe', 100, 100, 95, 90),
            'low': (78.0, 'low', 85, 80, 75, 72),
            'medium': (65.0, 'medium', 70, 65, 60, 65),
            'high': (45.0, 'high', 50, 45, 40, 40),
            'critical': (25.0, 'critical', 30, 25, 20, 25)
        }
        
        for risk_level, (overall, level, auth, perm, behav, audit) in score_values.items():
            score = AgentComplianceScore.objects.create(
                agent=self.agents[risk_level],
                overall_score=overall,
                risk_level=level,
                authentication_score=auth,
                permission_score=perm,
                behavior_score=behav,
                audit_score=audit
            )
            self.scores[risk_level] = score
        
        # 创建策略记忆
        self.strategy = StrategicMemory.objects.create(
            strategy_id='test_strategy_001',
            strategy_type='detection_rule',
            rule_name='test_strategy',
            rule_condition={'condition': 'test'},
            rule_action='allow',
            is_active=True,
            version=1,
            confidence=0.95,
            sample_count=100,
            success_rate=0.98
        )
        
        # 创建API客户端
        self.client = APIClient()
    
    def authenticate(self, user=None):
        """认证用户"""
        if user is None:
            user = self.admin_user
        self.client.force_authenticate(user=user)
    
    def test_authentication_required(self):
        """测试API需要认证"""
        # 未认证访问
        response = self.client.get('/api/v1/governance/compliance-scores/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        # 认证后访问
        self.authenticate()
        response = self.client.get('/api/v1/governance/compliance-scores/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    # ============================================================
    # Agent合规性评分API测试
    # ============================================================
    
    def test_compliance_score_list(self):
        """测试合规性评分列表"""
        self.authenticate()
        response = self.client.get('/api/v1/governance/compliance-scores/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 5)
    
    def test_compliance_score_filter_by_risk_level(self):
        """测试按风险等级筛选"""
        self.authenticate()
        
        # 筛选高风险
        response = self.client.get('/api/v1/governance/compliance-scores/?risk_level=high')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['risk_level'], 'high')
    
    def test_compliance_score_filter_by_score_range(self):
        """测试按评分范围筛选"""
        self.authenticate()
        
        # 筛选评分大于80的
        response = self.client.get('/api/v1/governance/compliance-scores/?min_score=80')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        self.assertTrue(all(score['overall_score'] >= 80 for score in results))
    
    def test_compliance_score_detail(self):
        """测试合规性评分详情"""
        self.authenticate()
        
        score_id = self.scores['safe'].id
        response = self.client.get(f'/api/v1/governance/compliance-scores/{score_id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['agent_id'], 'test_agent_1')
        self.assertIn('risk_factors', response.data)  # 详情包含风险因素
        self.assertIn('compliance_status', response.data)  # 详情包含合规状态
    
    def test_compliance_score_statistics(self):
        """测试合规性评分统计"""
        self.authenticate()
        response = self.client.get('/api/v1/governance/compliance-scores/statistics/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_count', response.data)
        self.assertIn('average_score', response.data)
        self.assertIn('risk_distribution', response.data)
        self.assertIn('score_distribution', response.data)
        self.assertIn('dimension_scores', response.data)
        
        # 验证统计数据
        self.assertEqual(response.data['total_count'], 5)
        self.assertEqual(len(response.data['risk_distribution']), 5)
    
    def test_compliance_score_update_scores(self):
        """测试更新评分"""
        self.authenticate()
        
        score_id = self.scores['medium'].id
        response = self.client.post(
            f'/api/v1/governance/compliance-scores/{score_id}/update_scores/',
            {'authentication_score': 90},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['success'], True)
        
        # 验证评分已更新
        score = AgentComplianceScore.objects.get(id=score_id)
        self.assertEqual(score.authentication_score, 90)
    
    def test_compliance_score_record_violation(self):
        """测试记录违规行为"""
        self.authenticate()
        
        score_id = self.scores['low'].id
        original_score = self.scores['low'].overall_score
        
        response = self.client.post(
            f'/api/v1/governance/compliance-scores/{score_id}/record_violation/',
            {'violation_type': 'permission_violation', 'severity': 'high'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['success'], True)
        
        # 验证评分已降低
        score = AgentComplianceScore.objects.get(id=score_id)
        self.assertLess(score.overall_score, original_score)
        self.assertEqual(score.violations_count, 1)
    
    # ============================================================
    # 治理健康度监控API测试
    # ============================================================
    
    def test_health_snapshot_create(self):
        """测试拍摄健康度快照"""
        self.authenticate()
        response = self.client.post('/api/v1/governance/health/take_snapshot/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['success'], True)
        self.assertIn('health_score', response.data['data'])
        
        # 验证快照已创建
        self.assertEqual(GovernanceHealth.objects.count(), 1)
    
    def test_health_latest_snapshot(self):
        """测试获取最新快照"""
        # 先创建快照
        snapshot = GovernanceHealth.take_snapshot()
        
        self.authenticate()
        response = self.client.get('/api/v1/governance/health/latest/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], snapshot.id)
        self.assertIn('health_status', response.data)
    
    def test_health_dashboard_data(self):
        """测试治理仪表板数据"""
        # 先创建快照
        GovernanceHealth.take_snapshot()
        
        self.authenticate()
        response = self.client.get('/api/v1/governance/health/dashboard/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 验证仪表板数据完整性
        required_fields = [
            'health_score',
            'health_status',
            'total_agents',
            'active_agents',
            'compliant_agents',
            'high_risk_agents',
            'score_distribution',
            'risk_distribution',
            'compliance_trend'
        ]
        
        for field in required_fields:
            self.assertIn(field, response.data)
    
    def test_health_list_with_time_filter(self):
        """测试健康度列表的时间范围筛选"""
        # 创建多个快照
        for _ in range(3):
            GovernanceHealth.take_snapshot()

        self.authenticate()

        # 筛选最近1小时，使用正确的日期格式
        start_time = timezone.now() - timedelta(hours=1)
        # Django期望的格式: YYYY-MM-DD HH:MM[:ss[.uuuuuu]][TZ]
        start_time_str = start_time.strftime('%Y-%m-%d %H:%M:%S')

        response = self.client.get(
            f'/api/v1/governance/health/?start_time={start_time_str}'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 3)
    
    # ============================================================
    # 策略版本管理API测试
    # ============================================================
    
    def test_strategy_version_create(self):
        """测试创建策略版本"""
        self.authenticate()

        response = self.client.post(
            '/api/v1/governance/strategy-versions/',
            {
                'strategy': self.strategy.id,
                'version': 'v1.0.1',
                'version_code': 2,
                'config': {'test': 'config'},
                'changes': {'test': 'change'},
                'status': 'draft',
                'changelog': '测试版本'
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['version'], 'v1.0.1')
    
    def test_strategy_version_deploy_full_rollout(self):
        """测试策略版本全量部署"""
        self.authenticate()

        # 创建待部署版本
        version = StrategyVersion.objects.create(
            strategy=self.strategy,
            version='v2.0.0',
            version_code=100,
            status='staging',
            is_active=False
        )

        # 执行部署
        response = self.client.post(
            f'/api/v1/governance/strategy-versions/{version.id}/deploy/',
            {'rollout_percentage': 100},
            format='json'
        )

        # 打印响应内容以调试
        if response.status_code != status.HTTP_200_OK:
            print(f"Deploy failed with status {response.status_code}")
            print(f"Response data: {response.data}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['success'], True)

        # 验证版本已激活
        version.refresh_from_db()
        self.assertTrue(version.is_active)
        self.assertEqual(version.status, 'production')
    
    def test_strategy_version_deploy_canary_release(self):
        """测试策略版本灰度发布"""
        self.authenticate()
        
        # 创建待部署版本
        version = StrategyVersion.objects.create(
            strategy=self.strategy,
            version='v2.1.0',
            version_code=101,
            status='staging',
            is_active=False
        )
        
        # 执行灰度发布（指定特定Agent）
        response = self.client.post(
            f'/api/v1/governance/strategy-versions/{version.id}/deploy/',
            {
                'rollout_percentage': 50,
                'rollout_agents': ['test_agent_1', 'test_agent_2'],
                'changelog': '灰度发布到50%的Agent'
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['success'], True)
        
        # 验证灰度参数
        version.refresh_from_db()
        self.assertEqual(version.rollout_percentage, 50)
        self.assertEqual(len(version.rollout_agents), 2)
    
    def test_strategy_version_rollback(self):
        """测试策略版本回滚"""
        self.authenticate()

        # 创建旧版本和新版本
        old_version = StrategyVersion.objects.create(
            strategy=self.strategy,
            version='v1.0.0',
            version_code=1,
            status='production',
            is_active=True
        )

        new_version = StrategyVersion.objects.create(
            strategy=self.strategy,
            version='v1.1.0',
            version_code=2,
            status='production',
            is_active=True
        )

        # 执行回滚
        response = self.client.post(
            f'/api/v1/governance/strategy-versions/{new_version.id}/rollback/'
        )

        # 打印响应内容以调试
        if response.status_code != status.HTTP_200_OK:
            print(f"Rollback failed with status {response.status_code}")
            print(f"Response data: {response.data}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['success'], True)

        # 验证回滚后的状态
        new_version.refresh_from_db()
        self.assertFalse(new_version.is_active)
    
    def test_strategy_version_active_list(self):
        """测试获取激活的策略版本"""
        # 创建激活和非激活版本
        StrategyVersion.objects.create(
            strategy=self.strategy,
            version='v3.0.0',
            version_code=300,
            status='production',
            is_active=True
        )
        
        StrategyVersion.objects.create(
            strategy=self.strategy,
            version='v3.1.0',
            version_code=301,
            status='draft',
            is_active=False
        )
        
        self.authenticate()
        response = self.client.get('/api/v1/governance/strategy-versions/active/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # 应该只返回激活且状态为production的版本
        for version in response.data:
            self.assertTrue(version['is_active'])
            self.assertEqual(version['status'], 'production')
    
    # ============================================================
    # 数据验证和错误处理测试
    # ============================================================
    
    def test_invalid_score_update_validation(self):
        """测试评分更新数据验证"""
        self.authenticate()
        
        score_id = self.scores['safe'].id
        
        # 测试无效的评分范围
        response = self.client.post(
            f'/api/v1/governance/compliance-scores/{score_id}/update_scores/',
            {'authentication_score': 150},  # 超过100
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_invalid_deploy_validation(self):
        """测试部署参数验证"""
        self.authenticate()
        
        version = StrategyVersion.objects.create(
            strategy=self.strategy,
            version='v4.0.0',
            version_code=400,
            status='staging',
            is_active=False
        )
        
        # 测试灰度发布但没有指定Agent列表
        response = self.client.post(
            f'/api/v1/governance/strategy-versions/{version.id}/deploy/',
            {
                'rollout_percentage': 50,
                'rollout_agents': []  # 空列表
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_permission_denied_for_normal_user(self):
        """测试普通用户权限限制"""
        self.authenticate(self.normal_user)

        # 尝试创建合规性评分（需要提供完整数据）
        response = self.client.post(
            '/api/v1/governance/compliance-scores/',
            {
                'agent': self.agents['safe'].id,
                'overall_score': 85.0,
                'risk_level': 'safe',
                'authentication_score': 90,
                'permission_score': 85,
                'behavior_score': 80,
                'audit_score': 85
            },
            format='json'
        )

        # 普通用户不应该有创建权限（如果权限设置正确）
        # 这里取决于实际的权限配置
        self.assertIn(response.status_code, [
            status.HTTP_403_FORBIDDEN,
            status.HTTP_405_METHOD_NOT_ALLOWED,
            status.HTTP_401_UNAUTHORIZED  # 也可能返回401
        ])
    
    # ============================================================
    # 性能和并发测试
    # ============================================================

    def test_large_dataset_performance(self):
        """测试大数据集性能"""
        # 创建100条合规性评分
        for i in range(100):
            agent = AgentIdentity.objects.create(
                agent_id=f'perf_agent_{i}',
                agent_name=f'性能测试Agent{i}',
                trust_level='medium',
                api_key_hash=f'perf_hash_{i}'
            )
            
            AgentComplianceScore.objects.create(
                agent=agent,
                overall_score=75.0,
                risk_level='medium',
                authentication_score=80,
                permission_score=75,
                behavior_score=70,
                audit_score=75
            )
        
        self.authenticate()
        
        # 测试列表查询性能
        import time
        start_time = time.time()
        response = self.client.get('/api/v1/governance/compliance-scores/')
        elapsed_time = time.time() - start_time
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLess(elapsed_time, 2.0)  # 应该在2秒内完成
    
    # ============================================================
    # 集成测试
    # ============================================================
    
    def test_full_workflow_integration(self):
        """测试完整工作流集成"""
        self.authenticate()
        
        # 1. 创建健康度快照
        response = self.client.post('/api/v1/governance/health/take_snapshot/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 2. 获取仪表板数据
        response = self.client.get('/api/v1/governance/health/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        dashboard_data = response.data
        
        # 3. 验证仪表板数据与实际数据一致
        response = self.client.get('/api/v1/governance/compliance-scores/statistics/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        stats_data = response.data
        
        # 验证数据一致性
        self.assertEqual(dashboard_data['total_agents'], stats_data['total_count'])
        
        # 4. 更新评分
        score_id = self.scores['medium'].id
        response = self.client.post(
            f'/api/v1/governance/compliance-scores/{score_id}/update_scores/',
            {'behavior_score': 85},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 5. 再次创建快照，验证数据已更新
        response = self.client.post('/api/v1/governance/health/take_snapshot/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 6. 验证评分更新后的统计
        response = self.client.get('/api/v1/governance/compliance-scores/statistics/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 验证行为评分平均值已更新
        self.assertGreaterEqual(
            response.data['dimension_scores']['behavior'],
            60  # 应该大于等于之前的平均值
        )


class ConcurrentSnapshotTransactionTestCase(TransactionTestCase):
    """并发创建健康度快照测试

    必须使用 TransactionTestCase 而非 TestCase：

    Django 的 TestCase 会把整个测试包裹在一个数据库事务中，
    测试期间主线程持有 SQLite 写锁，导致子线程的数据库操作
    全部阻塞失败（database is locked）。TransactionTestCase
    不做事务包裹，因此允许子线程并发读写数据库。

    注意：TransactionTestCase 每个测试后通过 TRUNCATE 清理数据，
    会重置自增序列，运行相对较慢。
    """

    def setUp(self):
        """测试准备（仅创建最小必要数据）"""
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='admin123',
            is_staff=True,
            role='admin'
        )

    def test_concurrent_snapshot_creation(self):
        """测试并发创建快照"""
        import threading

        results = []
        errors = []

        def create_snapshot():
            try:
                # 每个线程使用独立的 API 客户端，避免共享客户端的状态竞争
                client = APIClient()
                client.force_authenticate(user=self.admin_user)
                response = client.post('/api/v1/governance/health/take_snapshot/')
                results.append(response.status_code)
            except Exception as e:  # pragma: no cover - 仅用于收集失败原因
                errors.append(str(e))

        # 并发创建5个快照
        threads = []
        for _ in range(5):
            t = threading.Thread(target=create_snapshot)
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # 收集期间不应有未捕获异常
        self.assertEqual(errors, [])

        # 验证至少有快照成功创建（take_snapshot 内置锁冲突重试，
        # 极端并发下允许部分失败，但必须保证整体可用）
        success_count = sum(1 for code in results if code == status.HTTP_200_OK)
        self.assertGreater(success_count, 0)
        self.assertEqual(GovernanceHealth.objects.count(), success_count)
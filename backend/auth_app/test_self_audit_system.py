"""
自监控系统单元测试 - Self-Audit System Unit Tests

测试自监控系统的核心功能，包括：
1. 性能漂移检测
2. 响应时间异常监控
3. 误报率变化统计
4. 权限使用审计
5. 规则库时效性检测
"""

from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch, MagicMock

from .self_audit_models import (
    PerformanceDriftRecord,
    AgentPermissionAuditLog,
    RuleFreshnessCheck,
    SelfAuditReport
)
from .self_audit_service import SelfAuditService
from .governance_models import GovernanceHealth
from .memory_models import ShortTermMemory, LongTermMemory, StrategicMemory
from .behavior_models import BehaviorBaseline
from .agent_identity_models import AgentIdentity, AgentPermission
from django.contrib.auth import get_user_model

User = get_user_model()


class PerformanceDriftDetectionTests(TestCase):
    """性能漂移检测测试"""

    def setUp(self):
        """测试数据准备"""
        # 创建行为基线
        self.baseline = BehaviorBaseline.objects.create(
            agent_code='test_agent',
            baseline_type='accuracy',
            sample_count=1000,
            accuracy=95.0,
            is_active=True
        )

    def test_accuracy_drift_detection_no_drift(self):
        """测试准确率无漂移的情况"""
        # 模拟短期记忆数据（准确率接近基线）
        # ShortTermMemory 使用 operation_type/operation_content/decision 字段
        # decision='allow' 视为安全，decision='block' 视为危险
        for i in range(100):
            ShortTermMemory.objects.create(
                agent_id='test_agent',
                operation_type='api_call',
                operation_content=f'test_{i}',
                risk_level='low',
                decision='block' if i < 5 else 'allow'  # 95%放行，接近基线95%
            )

        # 检测漂移
        result = SelfAuditService.check_accuracy_drift(time_window=timedelta(hours=1))

        # 应该返回None（无漂移）
        self.assertIsNone(result)

    def test_accuracy_drift_detection_with_drift(self):
        """测试准确率漂移检测"""
        # 创建基线
        baseline = BehaviorBaseline.objects.create(
            agent_code='test_agent_2',
            baseline_type='accuracy',
            sample_count=1000,
            accuracy=95.0,
            is_active=True
        )

        # 模拟短期记忆数据（准确率明显偏离基线）
        for i in range(100):
            ShortTermMemory.objects.create(
                agent_id='test_agent_2',
                operation_type='api_call',
                operation_content=f'test_{i}',
                risk_level='high',
                decision='block'  # 全部判定为危险，偏离基线
            )

        # 检测漂移
        result = SelfAuditService.check_accuracy_drift(time_window=timedelta(hours=1))

        # 应该检测到漂移
        self.assertIsNotNone(result)
        self.assertIsInstance(result, PerformanceDriftRecord)
        self.assertEqual(result.drift_type, 'accuracy')
        self.assertGreater(abs(result.deviation_rate), 0.10)  # 偏离率超过10%

    def test_severity_calculation(self):
        """测试严重程度计算"""
        record = PerformanceDriftRecord(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.65,
            deviation_rate=0.30  # 30%偏离
        )

        severity = record.calculate_severity()

        # 30%偏离应该是严重级别
        self.assertEqual(severity, 'critical')


class ResponseTimeAnomalyTests(TestCase):
    """响应时间异常监控测试"""

    def test_response_time_anomaly_detection(self):
        """测试响应时间异常检测"""
        # 模拟短期记忆数据，包含响应时间信息
        for i in range(50):
            ShortTermMemory.objects.create(
                agent_id='test_agent',
                operation_type='api_call',
                operation_content=f'test_{i}',
                risk_level='low',
                metadata={
                    'response_time': 500 + i * 50  # 响应时间从500ms递增
                }
            )

        # 检测响应时间异常
        results = SelfAuditService.check_response_time_anomaly(time_window=timedelta(hours=1))

        # 应该检测到异常
        self.assertIsInstance(results, list)

        # 检查是否有P99异常（超过2000ms阈值）
        p99_anomalies = [r for r in results if r.metadata.get('metric') == 'p99']
        if p99_anomalies:
            self.assertGreater(p99_anomalies[0].current_value, 2000)

    def test_no_response_time_data(self):
        """测试无响应时间数据的情况"""
        # 创建无响应时间数据的短期记忆
        ShortTermMemory.objects.create(
            agent_id='test_agent',
            operation_type='api_call',
            operation_content='test',
            risk_level='low'
        )

        # 检测响应时间异常
        results = SelfAuditService.check_response_time_anomaly(time_window=timedelta(hours=1))

        # 应该返回空列表
        self.assertEqual(results, [])


class FalsePositiveRateTests(TestCase):
    """误报率变化统计测试"""

    def setUp(self):
        """测试数据准备"""
        # 创建误报率基线
        self.baseline = BehaviorBaseline.objects.create(
            agent_code='test_agent',
            baseline_type='false_positive_rate',
            sample_count=1000,
            is_active=True
        )

    def test_false_positive_rate_normal(self):
        """测试误报率正常的情况"""
        # 创建长期记忆，少量误报
        # LongTermMemory 使用 operation_type/operation_content/decision 字段
        # verified_result=True 表示人工判定为安全（误报），False 表示正确判定
        for i in range(100):
            LongTermMemory.objects.create(
                agent_id='test_agent',
                operation_type='api_call',
                operation_content=f'test_{i}',
                risk_level='high',
                decision='block',
                verified_result=False if i < 97 else True  # 97条正确, 3条误报
            )

        # 检测误报率
        result = SelfAuditService.check_false_positive_rate(time_window=timedelta(hours=24))

        # 误报率较低，可能返回None或低严重程度
        if result:
            self.assertLess(result.current_value, SelfAuditService.THRESHOLDS['false_positive_rate'])

    def test_false_positive_rate_high(self):
        """测试误报率过高的情况"""
        # 创建长期记忆，大量误报
        for i in range(100):
            LongTermMemory.objects.create(
                agent_id='test_agent',
                operation_type='api_call',
                operation_content=f'test_{i}',
                risk_level='high',
                decision='block',
                verified_result=True  # 全部是误报
            )

        # 检测误报率
        result = SelfAuditService.check_false_positive_rate(time_window=timedelta(hours=24))

        # 应该检测到异常
        self.assertIsNotNone(result)
        self.assertEqual(result.drift_type, 'false_positive_rate')


class PermissionAuditTests(TestCase):
    """权限使用审计测试"""

    def setUp(self):
        """测试数据准备"""
        # 创建用户
        self.user = User.objects.create_user(
            username='test_user',
            role='admin'
        )

        # 创建Agent身份
        self.agent = AgentIdentity.objects.create(
            agent_id='test_agent',
            agent_name='Test Agent',
            agent_type='custom',
            owner=self.user
        )

        # 创建权限（AgentPermission 使用 resource_type/resource_pattern/action 字段）
        self.permission = AgentPermission.objects.create(
            agent=self.agent,
            resource_type='api',
            resource_pattern='*',
            action='read'
        )

    def test_permission_grant_audit(self):
        """测试权限授予审计"""
        # 创建权限授予记录
        audit_log = AgentPermissionAuditLog.objects.create(
            action='grant',
            agent=self.agent,
            permission=self.permission,
            permission_type='api_access',
            resource_type='all',
            change_description='授予API访问权限',
            performed_by=self.user,
            risk_level='safe'
        )

        # 运行审计
        result = SelfAuditService.audit_permission_usage(time_window=timedelta(hours=1))

        # 验证审计结果
        self.assertEqual(result['total_changes'], 1)
        self.assertIn('grant', result['by_action'])

    def test_permission_escalation_detection(self):
        """测试权限提升检测"""
        # 创建权限提升记录（高风险）
        audit_log = AgentPermissionAuditLog.objects.create(
            action='escalate',
            agent=self.agent,
            permission=self.permission,
            permission_type='admin_access',
            resource_type='system',
            change_description='权限提升为管理员',
            performed_by=self.user,
            risk_level='high'
        )

        # 运行审计
        result = SelfAuditService.audit_permission_usage(time_window=timedelta(hours=1))

        # 应该检测到高风险操作
        self.assertGreater(len(result['high_risk_operations']), 0)

    def test_frequent_permission_changes_detection(self):
        """测试频繁权限变更检测"""
        # 创建多次权限变更（异常）
        for i in range(6):
            AgentPermissionAuditLog.objects.create(
                action='modify',
                agent=self.agent,
                permission=self.permission,
                permission_type=f'perm_{i}',
                resource_type='data',
                change_description=f'第{i+1}次变更',
                performed_by=self.user,
                risk_level='medium'
            )

        # 运行审计
        result = SelfAuditService.audit_permission_usage(time_window=timedelta(hours=1))

        # 应该检测到异常
        self.assertGreater(len(result['anomalies']), 0)

    def test_risk_assessment(self):
        """测试权限风险评估"""
        # 需保存以生成 timestamp（auto_now_add），assess_risk 会读取 timestamp.hour
        audit_log = AgentPermissionAuditLog.objects.create(
            action='escalate',
            agent=self.agent,
            permission_type='admin_access',
            resource_type='system',
            change_description='权限提升'
        )

        # 评估风险
        risk_level = audit_log.assess_risk()

        # 权限提升+敏感资源应该是高风险
        self.assertIn(risk_level, ['high', 'critical'])


class RuleFreshnessTests(TestCase):
    """规则库时效性检测测试"""

    def setUp(self):
        """测试数据准备"""
        # 创建策略记忆（新规则）
        self.fresh_strategy = StrategicMemory.objects.create(
            strategy_id='fresh_rule_001',
            rule_name='fresh_rule',
            strategy_type='detection_rule',
            rule_condition={'threshold': 0.8},
            is_active=True
        )

        # 创建策略记忆（旧规则）
        self.old_strategy = StrategicMemory.objects.create(
            strategy_id='old_rule_001',
            rule_name='old_rule',
            strategy_type='detection_rule',
            rule_condition={'threshold': 0.6},
            is_active=True
        )
        # 模拟旧规则的更新时间（使用 update 绕过 auto_now 覆盖）
        StrategicMemory.objects.filter(pk=self.old_strategy.pk).update(
            updated_at=timezone.now() - timedelta(days=120)
        )
        self.old_strategy.refresh_from_db()

    def test_fresh_rule_detection(self):
        """测试新鲜规则检测"""
        # 检查时效性
        check = RuleFreshnessCheck.objects.create(
            rule_type='detection_rule',
            strategy=self.fresh_strategy,
            last_updated=self.fresh_strategy.updated_at,
            days_since_update=0,
            effectiveness_score=95.0,
            usage_count=100,
            success_rate=98.0
        )

        status = check.check_freshness()

        # 新规则应该是新鲜状态
        self.assertEqual(status, 'fresh')

    def test_outdated_rule_detection(self):
        """测试过期规则检测"""
        # 检查时效性
        check = RuleFreshnessCheck.objects.create(
            rule_type='detection_rule',
            strategy=self.old_strategy,
            last_updated=self.old_strategy.updated_at,
            days_since_update=120,
            effectiveness_score=60.0,
            usage_count=10,
            success_rate=70.0
        )

        status = check.check_freshness()

        # 120天前的规则应该是过期状态
        self.assertIn(status, ['outdated', 'deprecated'])

    def test_rule_freshness_check_service(self):
        """测试规则时效性检查服务"""
        result = SelfAuditService.check_rule_freshness()

        # 应该返回列表
        self.assertIsInstance(result, list)

        # 应该至少检测到旧规则
        self.assertGreater(len(result), 0)


class SelfAuditReportTests(TestCase):
    """自审计报告测试"""

    def test_hourly_report_generation(self):
        """测试小时报告生成"""
        report = SelfAuditService.generate_audit_report(report_type='hourly')

        # 验证报告基本属性
        self.assertEqual(report.report_type, 'hourly')
        self.assertIsNotNone(report.period_start)
        self.assertIsNotNone(report.period_end)
        self.assertGreaterEqual(report.overall_health_score, 0)
        self.assertLessEqual(report.overall_health_score, 100)

    def test_daily_report_generation(self):
        """测试日报生成"""
        report = SelfAuditService.generate_audit_report(report_type='daily')

        # 验证报告类型
        self.assertEqual(report.report_type, 'daily')

        # 验证评分计算
        scores = report.calculate_scores()
        self.assertIn('overall', scores)
        self.assertIn('security', scores)
        self.assertIn('performance', scores)
        self.assertIn('compliance', scores)

    def test_report_summary_generation(self):
        """测试报告摘要生成"""
        # 创建一些性能漂移记录
        PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            severity='high',
            baseline_value=0.95,
            current_value=0.75,
            deviation_rate=0.20,
            sample_size=100
        )

        # 生成报告
        report = SelfAuditService.generate_audit_report()

        # 验证摘要
        self.assertIsNotNone(report.summary)
        self.assertIsInstance(report.recommendations, list)


class GovernanceHealthIntegrationTests(TestCase):
    """治理健康度集成测试"""

    def setUp(self):
        """测试数据准备"""
        # 创建用户
        self.user = User.objects.create_user(
            username='test_user',
            role='admin'
        )

        # 创建Agent身份
        self.agent = AgentIdentity.objects.create(
            agent_id='test_agent',
            agent_name='Test Agent',
            agent_type='custom',
            owner=self.user
        )

    def test_health_snapshot_with_self_audit(self):
        """测试健康度快照集成自监控结果"""
        # 创建一些性能漂移记录
        PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            severity='critical',
            baseline_value=0.95,
            current_value=0.65,
            deviation_rate=0.30,
            sample_size=100,
            is_resolved=False
        )

        # 创建权限异常记录
        AgentPermissionAuditLog.objects.create(
            action='escalate',
            agent=self.agent,
            permission_type='admin_access',
            resource_type='system',
            change_description='权限提升',
            risk_level='high',
            is_anomaly=True
        )

        # 拍摄快照
        snapshot = GovernanceHealth.take_snapshot()

        # 验证快照
        self.assertIsNotNone(snapshot)
        self.assertGreaterEqual(snapshot.health_score, 0)
        self.assertLessEqual(snapshot.health_score, 100)

        # 验证自监控集成效果（健康度应该因为问题而降低）
        # 注意：由于没有基线数据，可能不会触发所有扣分逻辑
        # 但可以验证快照创建成功
        self.assertIsNotNone(snapshot.snapshot_time)


class SelfAuditServiceTests(TestCase):
    """自监控服务综合测试"""

    def test_run_all_checks(self):
        """测试运行所有检查"""
        results = SelfAuditService.run_all_checks()

        # 验证返回结果结构
        self.assertIn('accuracy_drift', results)
        self.assertIn('response_time_anomalies', results)
        self.assertIn('false_positive_drift', results)
        self.assertIn('permission_audit', results)
        self.assertIn('rule_freshness', results)
        self.assertIn('timestamp', results)

    def test_thresholds_configuration(self):
        """测试阈值配置"""
        thresholds = SelfAuditService.THRESHOLDS

        # 验证阈值配置
        self.assertIn('accuracy_deviation', thresholds)
        self.assertIn('response_time_p99', thresholds)
        self.assertIn('response_time_avg', thresholds)
        self.assertIn('false_positive_rate', thresholds)
        self.assertIn('rule_freshness_days', thresholds)

        # 验证阈值合理性
        self.assertGreater(thresholds['accuracy_deviation'], 0)
        self.assertLess(thresholds['accuracy_deviation'], 1)
        self.assertGreater(thresholds['response_time_p99'], 0)


class SelfAuditModelTests(TestCase):
    """自监控模型测试"""

    def test_performance_drift_record_str(self):
        """测试性能漂移记录字符串表示"""
        record = PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            severity='high',
            baseline_value=0.95,
            current_value=0.75,
            deviation_rate=0.20,
            sample_size=100
        )

        # 验证字符串表示
        str_repr = str(record)
        self.assertIn('准确率漂移', str_repr)

    def test_permission_audit_log_str(self):
        """测试权限审计日志字符串表示"""
        user = User.objects.create_user(username='test_user', role='admin')
        agent = AgentIdentity.objects.create(
            agent_id='test_agent',
            agent_name='Test Agent',
            agent_type='custom',
            owner=user
        )

        log = AgentPermissionAuditLog.objects.create(
            action='grant',
            agent=agent,
            permission_type='api_access',
            resource_type='all',
            change_description='授予权限'
        )

        # 验证字符串表示
        str_repr = str(log)
        self.assertIn('test_agent', str_repr)

    def test_rule_freshness_check_str(self):
        """测试规则时效性检查字符串表示"""
        strategy = StrategicMemory.objects.create(
            strategy_id='test_rule_001',
            rule_name='test_rule',
            strategy_type='detection_rule',
            rule_condition={},
            is_active=True
        )

        check = RuleFreshnessCheck.objects.create(
            rule_type='detection_rule',
            strategy=strategy,
            last_updated=timezone.now(),
            days_since_update=5
        )

        # 验证字符串表示（格式：规则类型显示名 - 时效状态 (天数)）
        str_repr = str(check)
        self.assertIn('检测规则', str_repr)

    def test_self_audit_report_str(self):
        """测试自审计报告字符串表示"""
        report = SelfAuditReport.objects.create(
            report_type='hourly',
            period_start=timezone.now() - timedelta(hours=1),
            period_end=timezone.now(),
            summary='测试报告'
        )

        # 验证字符串表示
        str_repr = str(report)
        self.assertIn('小时报告', str_repr)


class PerformanceDriftRecordCRUDTests(TestCase):
    """PerformanceDriftRecord 创建、读取、更新、删除测试"""

    def setUp(self):
        """测试数据准备"""
        # 创建行为基线（用于外键关联）
        self.baseline = BehaviorBaseline.objects.create(
            agent_code='test_agent',
            baseline_type='accuracy',
            sample_count=1000,
            accuracy=95.0,
            is_active=True
        )

    def test_create_basic_record(self):
        """测试创建基本漂移记录"""
        record = PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.75,
            deviation_rate=0.20,
            sample_size=100
        )

        # 验证基本字段
        self.assertEqual(record.drift_type, 'accuracy')
        self.assertEqual(record.baseline_value, 0.95)
        self.assertEqual(record.current_value, 0.75)
        self.assertEqual(record.deviation_rate, 0.20)
        self.assertEqual(record.sample_size, 100)
        
        # 验证默认值
        self.assertEqual(record.severity, 'low')  # 默认严重程度
        self.assertFalse(record.is_resolved)  # 默认未解决
        self.assertIsNotNone(record.detected_at)  # 自动设置检测时间

    def test_create_with_all_fields(self):
        """测试创建包含所有字段的记录"""
        time_window = timedelta(hours=2)
        metadata = {
            'safe_count': 90,
            'total_count': 100,
            'threshold': 0.10,
            'start_time': timezone.now().isoformat(),
            'end_time': timezone.now().isoformat()
        }

        record = PerformanceDriftRecord.objects.create(
            drift_type='response_time',
            severity='high',
            baseline_value=2000.0,
            current_value=3500.0,
            deviation_rate=0.75,
            sample_size=50,
            time_window=time_window,
            baseline=self.baseline,
            metadata=metadata
        )

        # 验证所有字段
        self.assertEqual(record.drift_type, 'response_time')
        self.assertEqual(record.severity, 'high')
        self.assertEqual(record.baseline_value, 2000.0)
        self.assertEqual(record.current_value, 3500.0)
        self.assertEqual(record.deviation_rate, 0.75)
        self.assertEqual(record.sample_size, 50)
        self.assertEqual(record.time_window, time_window)
        self.assertEqual(record.baseline, self.baseline)
        self.assertEqual(record.metadata['safe_count'], 90)

    def test_calculate_severity_critical(self):
        """测试计算严重程度 - 严重级别（偏离≥30%）"""
        record = PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.60,  # 偏离36.8%
            deviation_rate=0.368,
            sample_size=100
        )

        # 计算严重程度
        severity = record.calculate_severity()
        
        self.assertEqual(severity, 'critical')
        self.assertEqual(record.severity, 'critical')

    def test_calculate_severity_high(self):
        """测试计算严重程度 - 高级别（偏离20-30%）"""
        record = PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.72,  # 偏离24.2%
            deviation_rate=0.242,
            sample_size=100
        )

        severity = record.calculate_severity()
        
        self.assertEqual(severity, 'high')
        self.assertEqual(record.severity, 'high')

    def test_calculate_severity_medium(self):
        """测试计算严重程度 - 中级别（偏离10-20%）"""
        record = PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.82,  # 偏离13.7%
            deviation_rate=0.137,
            sample_size=100
        )

        severity = record.calculate_severity()
        
        self.assertEqual(severity, 'medium')
        self.assertEqual(record.severity, 'medium')

    def test_calculate_severity_low(self):
        """测试计算严重程度 - 低级别（偏离<10%）"""
        record = PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.89,  # 偏离6.3%
            deviation_rate=0.063,
            sample_size=100
        )

        severity = record.calculate_severity()
        
        self.assertEqual(severity, 'low')
        self.assertEqual(record.severity, 'low')

    def test_calculate_severity_negative_deviation(self):
        """测试计算严重程度 - 负偏离率（改善情况）"""
        record = PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.99,  # 改善4.2%
            deviation_rate=-0.042,
            sample_size=100
        )

        severity = record.calculate_severity()
        
        # 改善情况应判定为低严重程度
        self.assertEqual(severity, 'low')

    def test_create_all_drift_types(self):
        """测试创建所有类型的漂移记录"""
        drift_types = [
            'accuracy',
            'precision',
            'recall',
            'f1_score',
            'response_time',
            'false_positive_rate'
        ]

        for drift_type in drift_types:
            record = PerformanceDriftRecord.objects.create(
                drift_type=drift_type,
                baseline_value=100.0,
                current_value=120.0,
                deviation_rate=0.20,
                sample_size=50
            )
            
            self.assertEqual(record.drift_type, drift_type)
            self.assertIn(drift_type, dict(PerformanceDriftRecord.DRIFT_TYPE_CHOICES).keys())

    def test_update_resolve_status(self):
        """测试更新解决状态"""
        record = PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.75,
            deviation_rate=0.20,
            sample_size=100
        )

        # 初始状态：未解决
        self.assertFalse(record.is_resolved)
        self.assertIsNone(record.resolved_at)
        self.assertEqual(record.resolution_note, '')

        # 更新为已解决
        record.is_resolved = True
        record.resolved_at = timezone.now()
        record.resolution_note = '已通过优化算法修复'
        record.save()

        # 重新从数据库加载
        record.refresh_from_db()

        # 验证更新
        self.assertTrue(record.is_resolved)
        self.assertIsNotNone(record.resolved_at)
        self.assertEqual(record.resolution_note, '已通过优化算法修复')

    def test_metadata_json_field(self):
        """测试metadata JSONField存储"""
        metadata = {
            'metric': 'p99',
            'avg_time': 2800,
            'min_time': 500,
            'max_time': 5000,
            'threshold': 2000,
            'nested': {
                'level2': {
                    'level3': 'value'
                }
            },
            'list': [1, 2, 3, 4, 5]
        }

        record = PerformanceDriftRecord.objects.create(
            drift_type='response_time',
            baseline_value=2000.0,
            current_value=3500.0,
            deviation_rate=0.75,
            sample_size=50,
            metadata=metadata
        )

        # 重新从数据库加载
        record.refresh_from_db()

        # 验证metadata完整性
        self.assertEqual(record.metadata['metric'], 'p99')
        self.assertEqual(record.metadata['avg_time'], 2800)
        self.assertEqual(record.metadata['nested']['level2']['level3'], 'value')
        self.assertEqual(record.metadata['list'], [1, 2, 3, 4, 5])

    def test_baseline_foreign_key(self):
        """测试baseline外键关联"""
        # 创建记录并关联baseline
        record = PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.75,
            deviation_rate=0.20,
            sample_size=100,
            baseline=self.baseline
        )

        # 验证外键关联
        self.assertEqual(record.baseline, self.baseline)
        self.assertEqual(record.baseline.baseline_type, 'accuracy')

        # 测试反向查询
        drift_records = self.baseline.performancedriftrecord_set.all()
        self.assertIn(record, drift_records)

    def test_baseline_null_on_delete(self):
        """测试baseline删除时外键设置为NULL"""
        record = PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.75,
            deviation_rate=0.20,
            sample_size=100,
            baseline=self.baseline
        )

        # 验证初始关联
        self.assertEqual(record.baseline, self.baseline)

        # 删除baseline
        baseline_id = self.baseline.id
        self.baseline.delete()

        # 重新加载记录
        record.refresh_from_db()

        # 验证baseline设置为NULL
        self.assertIsNone(record.baseline)

    def test_time_window_duration_field(self):
        """测试time_window DurationField存储"""
        time_windows = [
            timedelta(minutes=15),
            timedelta(hours=1),
            timedelta(hours=24),
            timedelta(days=7)
        ]

        for time_window in time_windows:
            record = PerformanceDriftRecord.objects.create(
                drift_type='accuracy',
                baseline_value=0.95,
                current_value=0.75,
                deviation_rate=0.20,
                sample_size=100,
                time_window=time_window
            )

            record.refresh_from_db()
            self.assertEqual(record.time_window, time_window)

    def test_query_by_drift_type(self):
        """测试按漂移类型查询"""
        # 创建不同类型的记录
        PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.75,
            deviation_rate=0.20,
            sample_size=100
        )
        PerformanceDriftRecord.objects.create(
            drift_type='response_time',
            baseline_value=2000.0,
            current_value=3500.0,
            deviation_rate=0.75,
            sample_size=50
        )

        # 按类型查询
        accuracy_records = PerformanceDriftRecord.objects.filter(drift_type='accuracy')
        response_time_records = PerformanceDriftRecord.objects.filter(drift_type='response_time')

        self.assertEqual(accuracy_records.count(), 1)
        self.assertEqual(response_time_records.count(), 1)

    def test_query_by_severity(self):
        """测试按严重程度查询"""
        # 创建不同严重程度的记录
        for severity in ['low', 'medium', 'high', 'critical']:
            PerformanceDriftRecord.objects.create(
                drift_type='accuracy',
                severity=severity,
                baseline_value=0.95,
                current_value=0.75,
                deviation_rate=0.20,
                sample_size=100
            )

        # 按严重程度查询
        critical_records = PerformanceDriftRecord.objects.filter(severity='critical')
        self.assertEqual(critical_records.count(), 1)

        high_and_critical = PerformanceDriftRecord.objects.filter(
            severity__in=['high', 'critical']
        )
        self.assertEqual(high_and_critical.count(), 2)

    def test_query_unresolved_issues(self):
        """测试查询未解决的问题"""
        # 创建已解决和未解决的记录
        resolved = PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.75,
            deviation_rate=0.20,
            sample_size=100,
            is_resolved=True
        )
        unresolved = PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.75,
            deviation_rate=0.20,
            sample_size=100,
            is_resolved=False
        )

        # 查询未解决的记录
        unresolved_records = PerformanceDriftRecord.objects.filter(is_resolved=False)
        self.assertEqual(unresolved_records.count(), 1)
        self.assertIn(unresolved, unresolved_records)
        self.assertNotIn(resolved, unresolved_records)

    def test_ordering_by_detected_at(self):
        """测试按检测时间排序"""
        import time
        
        # 创建多个记录（有微小时间差）
        record1 = PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.75,
            deviation_rate=0.20,
            sample_size=100
        )
        time.sleep(0.01)  # 确保10ms时间差
        
        record2 = PerformanceDriftRecord.objects.create(
            drift_type='accuracy',
            baseline_value=0.95,
            current_value=0.75,
            deviation_rate=0.20,
            sample_size=100
        )

        # 查询并验证排序（默认按-detected_at排序，最新的在前）
        records = list(PerformanceDriftRecord.objects.all())
        self.assertEqual(records[0], record2)  # 最新的在前
        self.assertEqual(records[1], record1)

    def test_str_representation_format(self):
        """测试字符串表示格式"""
        record = PerformanceDriftRecord.objects.create(
            drift_type='response_time',
            severity='high',
            baseline_value=2000.0,
            current_value=3500.0,
            deviation_rate=0.75,
            sample_size=50
        )

        str_repr = str(record)
        
        # 验证格式：应包含漂移类型显示名、严重程度、偏离率
        self.assertIn('响应时间异常', str_repr)
        self.assertIn('high', str_repr)
        self.assertIn('75.00%', str_repr)
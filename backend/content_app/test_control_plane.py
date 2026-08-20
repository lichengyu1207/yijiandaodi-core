"""P0 统一控制面（M1 MVP）云端接口测试 — 内部诊断通道

覆盖：
- DeepSeekBudgetGate.get_quota_status() 结构（对齐桌面 DeepSeekQuotaStatus）
- GET /api/modules/status 返回 7 个云端能力单元，结构完整、无品牌名
- GET /api/deepseek/quota 返回配额结构
- GET/PUT /api/settings/log-level 运行时调整（含鉴权与非法级别校验）
"""

import logging
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APITestCase

from content_app.deepseek_service import DeepSeekBudgetGate, QUOTA_ALERT_CACHE_KEY


class GetQuotaStatusTest(TestCase):
    """DeepSeekBudgetGate.get_quota_status() 结构测试"""

    def setUp(self):
        self.gate = DeepSeekBudgetGate()
        self.gate.global_limit = 100
        self.gate.user_limit = 20
        self.gate.break_threshold = 5
        self.gate.break_cooldown = 300

    def test_structure_matches_deepseek_quota_status(self):
        status = self.gate.get_quota_status()
        # 对齐桌面端 DeepSeekQuotaStatus 字段
        for field in ('globalUsed', 'globalQuota', 'userUsed', 'userQuota',
                      'circuitOpen', 'circuitOpenedAt', 'failureRate',
                      'warnThreshold', 'criticalThreshold'):
            self.assertIn(field, status, f'缺少字段 {field}')
        self.assertEqual(status['globalQuota'], 100)
        self.assertEqual(status['userQuota'], 20)
        self.assertFalse(status['circuitOpen'])
        self.assertIsNone(status['circuitOpenedAt'])
        self.assertEqual(status['failureRate'], 0)


class BudgetGateCircuitAlertTest(TestCase):
    """P3 事件告警规则联动：熔断触发（circuit_open）告警"""

    def setUp(self):
        self.gate = DeepSeekBudgetGate()
        self.gate.break_threshold = 3
        self.gate.break_cooldown = 60
        cache.delete(self.gate.FAIL_COUNT_KEY)
        cache.delete(self.gate.BREAK_UNTIL_KEY)
        cache.delete(QUOTA_ALERT_CACHE_KEY)

    def tearDown(self):
        cache.delete(self.gate.FAIL_COUNT_KEY)
        cache.delete(self.gate.BREAK_UNTIL_KEY)
        cache.delete(QUOTA_ALERT_CACHE_KEY)

    def test_circuit_open_pushes_alert_when_breaker_opens(self):
        """连续失败达阈值触发熔断时推送 circuit_open 告警"""
        with patch('auth_app.alert_service.AlertService.push_event_alert') as push:
            self.gate.record_failure()
            self.gate.record_failure()
            push.assert_not_called()  # 未达阈值不告警

            self.gate.record_failure()  # 达阈值 → 熔断
            push.assert_called_once()
            self.assertEqual(push.call_args.kwargs['event'], 'circuit_open')
            self.assertEqual(push.call_args.kwargs['level'], 'critical')

    def test_circuit_open_alert_disabled_by_rule(self):
        """规则关闭时不推送熔断告警，但熔断本身照常生效"""
        cache.set(
            QUOTA_ALERT_CACHE_KEY,
            {'enabled': True, 'rules': {'circuit_open': False}},
            timeout=60,
        )
        with patch('auth_app.alert_service.AlertService.push_event_alert') as push:
            for _ in range(3):
                self.gate.record_failure()
            push.assert_not_called()
        # 熔断状态仍生效
        self.assertTrue(self.gate.get_quota_status()['circuitOpen'])


class ModulesStatusViewTest(APITestCase):
    """GET /api/modules/status 能力单元聚合"""

    @patch('content_app.control_plane_views._check_redis',
           return_value=('running', 'healthy', {'pingMs': 0}, None))
    @patch('content_app.control_plane_views._check_db',
           return_value=('running', 'healthy', {}, None))
    @patch('content_app.control_plane_views._check_celery',
           return_value=('running', 'healthy', {'workers': 1}, None))
    @patch('content_app.control_plane_views._check_budget_gate',
           return_value=('running', 'healthy',
                         {'globalUsed': 0, 'globalQuota': 100, 'circuitOpen': 0}, None))
    def test_returns_7_cloud_capability_units(self, *_mocks):
        resp = self.client.get('/api/modules/status/')
        self.assertEqual(resp.status_code, 200)
        modules = resp.json()['modules']

        ids = [m['moduleId'] for m in modules]
        self.assertEqual(ids, [
            'cloud.api',
            'cloud.celery',
            'cloud.redis',
            'cloud.db',
            'cloud.budget-gate',
            'cloud.inference-engine',
            'cloud.compute-cluster',
        ])

        # 每个能力单元结构完整，无品牌名
        for m in modules:
            self.assertEqual(m['kind'], 'cloud')
            self.assertIn(m['state'], ('running', 'stopped', 'starting', 'error', 'unknown'))
            self.assertIn(m['health'], ('healthy', 'degraded', 'unhealthy', 'unknown'))
            self.assertIn('version', m)
            self.assertIn('lastHeartbeat', m)
            self.assertIn('metrics', m)

        names = ' '.join(m['name'] for m in modules)
        for brand in ('Grok', 'DSH', 'OpenClaw', 'Cloud', 'DeepSeek'):
            self.assertNotIn(brand, names, f'出现品牌名 {brand}')

        # inference-engine / compute-cluster 不再是预留占位，必须上报真实状态
        by_id = {m['moduleId']: m for m in modules}
        engine = by_id['cloud.inference-engine']
        cluster = by_id['cloud.compute-cluster']
        self.assertNotEqual(engine['state'], 'unknown', '推理引擎不应为预留占位')
        self.assertIn(engine['health'], ('healthy', 'degraded'))
        self.assertIn('provider', engine['metrics'])
        self.assertIn('inFlight', engine['metrics'])
        self.assertIn('maxConcurrency', engine['metrics'])
        self.assertIn('onlineNodes', cluster['metrics'])


class CapabilityUnitCheckTest(APITestCase):
    """cloud.inference-engine / cloud.compute-cluster 真实状态检查（M2/M4）"""

    def test_inference_engine_reports_router_metrics(self):
        from content_app.control_plane_views import _check_inference_engine

        state, health, metrics, detail = _check_inference_engine()
        self.assertEqual(state, 'running')
        self.assertIn(health, ('healthy', 'degraded'))
        self.assertIn('provider', metrics)
        self.assertIn('localOverload', metrics)
        self.assertIn('inFlight', metrics)
        self.assertIn('maxConcurrency', metrics)
        self.assertIn('maxLocalRatio', metrics)

    def test_compute_cluster_stopped_without_nodes(self):
        from content_app.control_plane_views import _check_compute_cluster

        state, health, metrics, detail = _check_compute_cluster()
        self.assertEqual(state, 'stopped')
        self.assertEqual(health, 'unhealthy')
        self.assertEqual(metrics['onlineNodes'] + metrics['busyNodes'], 0)
        self.assertEqual(metrics['executingTasks'], 0)

    def test_compute_cluster_running_with_online_node(self):
        from p2p_app.models import P2PNode
        P2PNode.objects.create(
            node_id='node-infer-1',
            node_type='enterprise',
            capabilities=['inference'],
            resources={'cpu_cores': 4, 'memory_usage': 40},
            location='cn',
            status='online',
            public_key='k1',
        )
        from content_app.control_plane_views import _check_compute_cluster

        state, health, metrics, detail = _check_compute_cluster()
        self.assertEqual(state, 'running')
        self.assertEqual(health, 'healthy')
        self.assertEqual(metrics['onlineNodes'], 1)
        self.assertEqual(metrics['totalNodes'], 1)


class DeepSeekQuotaViewTest(APITestCase):
    """GET /api/deepseek/quota"""

    @patch('content_app.control_plane_views.get_budget_gate')
    def test_quota_response(self, mock_get_gate):
        mock_gate = mock_get_gate.return_value
        mock_gate.get_quota_status.return_value = {
            'day': '20260817',
            'globalUsed': 3,
            'globalQuota': 100,
            'userUsed': 0,
            'userQuota': 20,
            'circuitOpen': False,
            'circuitOpenedAt': None,
            'failureRate': 0,
            'warnThreshold': 70,
            'criticalThreshold': 90,
        }
        resp = self.client.get('/api/deepseek/quota/')
        self.assertEqual(resp.status_code, 200)
        quota = resp.json()['quota']
        self.assertEqual(quota['globalUsed'], 3)
        self.assertEqual(quota['globalQuota'], 100)


class LogLevelViewTest(APITestCase):
    """GET/PUT /api/settings/log-level"""

    def setUp(self):
        from django.contrib.auth import get_user_model
        self.user = get_user_model().objects.create_user(
            username='ctrl_plane_test', password='x' * 12,
        )

    def test_get_requires_auth(self):
        resp = self.client.get('/api/settings/log-level/')
        self.assertEqual(resp.status_code, 401)

    def test_get_and_put_level(self):
        self.client.force_authenticate(user=self.user)
        target = logging.getLogger('content_app.deepseek_service')

        put_resp = self.client.put(
            '/api/settings/log-level/', {'level': 'DEBUG'}, format='json')
        self.assertEqual(put_resp.status_code, 200)
        self.assertEqual(put_resp.json()['level'], 'DEBUG')
        self.assertEqual(target.level, logging.DEBUG)

        get_resp = self.client.get('/api/settings/log-level/')
        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(get_resp.json()['level'], 'DEBUG')

    def test_warn_normalized_to_warning(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.put(
            '/api/settings/log-level/', {'level': 'WARN'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['level'], 'WARNING')

    def test_invalid_level_rejected(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.put(
            '/api/settings/log-level/', {'level': 'NOPE'}, format='json')
        self.assertEqual(resp.status_code, 400)

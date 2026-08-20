"""P1-2 消费额度预警配置接口测试

覆盖：
- GET /api/settings/quota-alert：需鉴权，返回默认配置
- POST /api/settings/quota-alert：更新开关/阈值/通知方式
- POST 校验：warn 必须小于 critical；非法阈值拒绝
"""

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APITestCase

from content_app.control_plane_views import QUOTA_ALERT_CACHE_KEY, DEFAULT_QUOTA_ALERT


class QuotaAlertViewTest(APITestCase):
    """GET/POST /api/settings/quota-alert"""

    def setUp(self):
        from django.contrib.auth import get_user_model
        self.user = get_user_model().objects.create_user(
            username='quota_alert_test', password='x' * 12,
        )
        cache.delete(QUOTA_ALERT_CACHE_KEY)

    def tearDown(self):
        cache.delete(QUOTA_ALERT_CACHE_KEY)

    def test_get_requires_auth(self):
        resp = self.client.get('/api/settings/quota-alert/')
        self.assertEqual(resp.status_code, 401)

    def test_get_returns_default_config(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/settings/quota-alert/')
        self.assertEqual(resp.status_code, 200)
        cfg = resp.json()['config']
        self.assertEqual(cfg, DEFAULT_QUOTA_ALERT)

    def test_post_updates_config(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            '/api/settings/quota-alert/',
            {
                'enabled': True,
                'warn_threshold': 70,
                'critical_threshold': 90,
                'notify': ['desktop', 'email'],
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        cfg = resp.json()['config']
        self.assertTrue(cfg['enabled'])
        self.assertEqual(cfg['warn_threshold'], 70)
        self.assertEqual(cfg['critical_threshold'], 90)
        self.assertEqual(cfg['notify'], ['desktop', 'email'])

        # 再次 GET 应读取到更新后的配置（写入 cache）
        get_resp = self.client.get('/api/settings/quota-alert/')
        self.assertEqual(get_resp.json()['config'], cfg)

    def test_post_rejects_warn_ge_critical(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            '/api/settings/quota-alert/',
            {'warn_threshold': 90, 'critical_threshold': 90},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn('必须小于', resp.json()['error'])

    def test_post_rejects_invalid_threshold(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            '/api/settings/quota-alert/',
            {'warn_threshold': 'abc'},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)

    def test_post_filters_invalid_notify(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            '/api/settings/quota-alert/',
            {'notify': ['desktop', 'sms', 'pigeon']},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['config']['notify'], ['desktop'])

    # ------------------------------------------------------------------
    # P3 事件告警规则（circuit_open / quota_exhausted）
    # ------------------------------------------------------------------

    def test_default_config_includes_event_rules(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/settings/quota-alert/')
        rules = resp.json()['config']['rules']
        self.assertTrue(rules['circuit_open'])
        self.assertTrue(rules['quota_exhausted'])

    def test_post_updates_event_rules_and_filters_unknown(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            '/api/settings/quota-alert/',
            {
                'rules': {
                    'circuit_open': False,
                    'quota_exhausted': True,
                    'unknown_rule': True,
                },
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        rules = resp.json()['config']['rules']
        self.assertFalse(rules['circuit_open'])
        self.assertTrue(rules['quota_exhausted'])
        self.assertNotIn('unknown_rule', rules)

    def test_post_ignores_non_dict_rules(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            '/api/settings/quota-alert/',
            {'rules': 'not-a-dict'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        rules = resp.json()['config']['rules']
        self.assertTrue(rules['circuit_open'])
        self.assertTrue(rules['quota_exhausted'])

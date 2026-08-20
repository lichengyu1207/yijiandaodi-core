"""P2 分析一期：消费趋势接口测试

覆盖：
- GET /api/stats/trend：需鉴权 / cost/count/error_rate 聚合 / 分位 / 异常点
- GET /api/usage/trend-analysis：需鉴权 / 总体趋势 / 成本分解 / Top10 / 优化建议
"""

from decimal import Decimal
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase


class ConsumptionTrendTestBase(APITestCase):
    """公共准备：用户与 APICallLog 工厂"""

    def setUp(self):
        from django.contrib.auth import get_user_model
        self.user = get_user_model().objects.create_user(
            username='trend_test', password='x' * 12,
        )
        from .billing_models import APICallLog
        self.APICallLog = APICallLog

    def _create(self, **kwargs):
        """创建 APICallLog；支持显式 created_at（auto_now_add 不可覆盖，需走 update）"""
        created = kwargs.pop('created_at', None)
        obj = self.APICallLog.objects.create(**kwargs)
        if created is not None:
            self.APICallLog.objects.filter(pk=obj.pk).update(created_at=created)
        return obj


class StatsTrendViewTest(ConsumptionTrendTestBase):
    """GET /api/stats/trend"""

    def setUp(self):
        super().setUp()
        self.now = timezone.now()
        # 昨天 2 条调用（同一天，桶内成本分布 [0.001, 0.002]）
        yesterday = self.now - timedelta(days=1)
        self._create(
            user_id=self.user.id, run_id='t-1', model='deepseek-chat',
            total_tokens=1500, cost=Decimal('0.001'), status='success',
            created_at=yesterday,
        )
        self._create(
            user_id=self.user.id, run_id='t-2', model='deepseek-chat',
            total_tokens=3000, cost=Decimal('0.002'), status='error',
            created_at=yesterday + timedelta(hours=1),
        )
        # 今天 1 条调用
        self._create(
            user_id=self.user.id, run_id='t-3', model='deepseek-reasoner',
            total_tokens=500, cost=Decimal('0.0005'), status='success',
            created_at=self.now,
        )

    def test_requires_auth(self):
        resp = self.client.get('/api/stats/trend/')
        self.assertEqual(resp.status_code, 401)

    def test_trend_cost_aggregation(self):
        """cost 字段按天聚合，桶内分位基于单次费用"""
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/stats/trend/?granularity=day')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']
        self.assertEqual(data['field'], 'cost')
        self.assertEqual(data['granularity'], 'day')

        by_date = {p['date'][:10]: p for p in data['trend']}
        yesterday_key = (self.now - timedelta(days=1)).strftime('%Y-%m-%d')
        today_key = self.now.strftime('%Y-%m-%d')

        self.assertEqual(by_date[yesterday_key]['value'], 0.003)  # 0.001 + 0.002
        self.assertEqual(by_date[yesterday_key]['calls'], 2)
        self.assertEqual(by_date[today_key]['value'], 0.0005)
        self.assertEqual(by_date[today_key]['calls'], 1)

        # 昨天桶内费用分布 [0.001, 0.002]：p50 = 0.0015
        self.assertAlmostEqual(by_date[yesterday_key]['p50'], 0.0015, places=6)
        self.assertAlmostEqual(by_date[today_key]['p50'], 0.0005, places=6)

        # summary
        self.assertAlmostEqual(data['summary']['total_cost'], 0.0035, places=6)
        self.assertEqual(data['summary']['total_calls'], 3)

    def test_trend_field_count(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/stats/trend/?field=count&granularity=day')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']
        self.assertEqual(data['field'], 'count')
        today_key = self.now.strftime('%Y-%m-%d')
        yesterday_key = (self.now - timedelta(days=1)).strftime('%Y-%m-%d')
        by_date = {p['date'][:10]: p for p in data['trend']}
        self.assertEqual(by_date[yesterday_key]['value'], 2)
        self.assertEqual(by_date[today_key]['value'], 1)

    def test_trend_field_error_rate(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/stats/trend/?field=error_rate&granularity=day')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']
        yesterday_key = (self.now - timedelta(days=1)).strftime('%Y-%m-%d')
        today_key = self.now.strftime('%Y-%m-%d')
        by_date = {p['date'][:10]: p for p in data['trend']}
        self.assertEqual(by_date[yesterday_key]['value'], 50.0)  # 2 条中 1 条 error
        self.assertEqual(by_date[today_key]['value'], 0.0)

    def test_trend_anomaly_detection(self):
        """3σ 异常点检测：单日巨峰应被标记"""
        # 在原有 3 条基础上，再造 10 个低额天 + 1 个巨额天
        base = self.now - timedelta(days=20)
        for i in range(10):
            self._create(
                run_id=f'an-{i}', model='m', total_tokens=10,
                cost=Decimal('0.001'), status='success',
                created_at=base + timedelta(days=i),
            )
        self._create(
            run_id='an-spike', model='m', total_tokens=10,
            cost=Decimal('10.0'), status='success',
            created_at=self.now,
        )

        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/stats/trend/?granularity=day')
        self.assertEqual(resp.status_code, 200)
        trend = resp.json()['data']['trend']
        today_key = self.now.strftime('%Y-%m-%d')
        by_date = {p['date'][:10]: p for p in trend}
        self.assertTrue(by_date[today_key]['anomaly'])
        # 低额天不应被误标
        low_keys = [(base + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(10)]
        self.assertFalse(any(by_date[k]['anomaly'] for k in low_keys))


class TrendAnalysisViewTest(ConsumptionTrendTestBase):
    """GET /api/usage/trend-analysis"""

    def test_requires_auth(self):
        resp = self.client.get('/api/usage/trend-analysis/')
        self.assertEqual(resp.status_code, 401)

    def test_empty_data_returns_info_suggestion(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/usage/trend-analysis/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']
        self.assertEqual(data['summary']['total_calls'], 0)
        self.assertEqual(data['trend'], [])
        self.assertEqual(data['cost_breakdown']['by_model'], [])
        self.assertEqual(data['top_expensive'], [])
        self.assertIn('suggestions', data)
        self.assertEqual(data['suggestions'][0]['type'], 'info')

    def test_full_structure(self):
        """覆盖 summary / trend / cost_breakdown / top_expensive / suggestions"""
        now = timezone.now()
        self._create(
            user_id=self.user.id, run_id='expensive-1', scenario='intent',
            model='deepseek-reasoner', input_tokens=9000, output_tokens=1000,
            total_tokens=10000, cost=Decimal('0.8000'), status='success',
            created_at=now,
        )
        self._create(
            user_id=self.user.id, run_id='cheap-1', scenario='audit',
            model='deepseek-chat', input_tokens=1000, output_tokens=500,
            total_tokens=1500, cost=Decimal('0.0015'), status='success',
            created_at=now,
        )
        self._create(
            user_id=self.user.id, run_id='failed-1', scenario='intent',
            model='deepseek-chat', input_tokens=100, output_tokens=0,
            total_tokens=100, cost=Decimal('0.0001'), status='error',
            created_at=now,
        )

        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/usage/trend-analysis/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']

        # summary
        self.assertEqual(data['summary']['total_calls'], 3)
        self.assertAlmostEqual(data['summary']['total_cost'], 0.8016, places=6)
        self.assertEqual(data['summary']['total_tokens'], 11600)
        self.assertAlmostEqual(data['summary']['error_rate'], round(1 / 3 * 100, 2), places=2)

        # trend：3 条同日 → 1 个桶
        self.assertEqual(len(data['trend']), 1)
        self.assertAlmostEqual(data['trend'][0]['cost'], 0.8016, places=6)
        self.assertEqual(data['trend'][0]['calls'], 3)

        # cost_breakdown：按模型聚合
        by_model = {it['model']: it for it in data['cost_breakdown']['by_model']}
        self.assertIn('deepseek-reasoner', by_model)
        self.assertAlmostEqual(by_model['deepseek-reasoner']['cost'], 0.8, places=6)
        self.assertGreater(by_model['deepseek-reasoner']['share'], 90)

        # cost_breakdown：按场景聚合
        by_scenario = {it['scenario']: it for it in data['cost_breakdown']['by_scenario']}
        self.assertAlmostEqual(by_scenario['intent']['cost'], 0.8001, places=6)

        # top_expensive：按费用降序，含 time/tokens/scenario
        top = data['top_expensive']
        self.assertEqual(len(top), 3)
        self.assertEqual(top[0]['run_id'], 'expensive-1')
        self.assertEqual(top[0]['model'], 'deepseek-reasoner')
        self.assertEqual(top[0]['tokens'], 10000)
        self.assertAlmostEqual(top[0]['cost'], 0.8, places=6)
        self.assertIn('time', top[0])

        # suggestions：deepseek-reasoner 占比 > 90% → 触发模型集中建议
        types = {s['type'] for s in data['suggestions']}
        self.assertIn('cost', types)
        self.assertTrue(any('成本占比' in s['title'] for s in data['suggestions']))


class TrendAnalysisBoundaryTest(ConsumptionTrendTestBase):
    """P2 分析边界：Top-10 截断（§7.2）"""

    def test_top_expensive_truncated_to_10(self):
        """调用数 > 10 时 top_expensive 只返回费用最高的 10 条"""
        now = timezone.now()
        for i in range(12):
            self._create(
                user_id=self.user.id, run_id=f'boundary-{i}', scenario='intent',
                model='deepseek-chat', input_tokens=100, output_tokens=100,
                total_tokens=200, cost=Decimal(f'0.{i:02d}'), status='success',
                created_at=now,
            )

        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/usage/trend-analysis/')
        self.assertEqual(resp.status_code, 200)
        top = resp.json()['data']['top_expensive']

        self.assertEqual(len(top), 10)
        # 按费用降序（12 条里费用最高的是 boundary-11）
        self.assertEqual(top[0]['run_id'], 'boundary-11')
        self.assertAlmostEqual(top[0]['cost'], 0.11, places=6)
        # 截断后不包含低费用调用
        run_ids = {it['run_id'] for it in top}
        self.assertNotIn('boundary-0', run_ids)
        self.assertNotIn('boundary-1', run_ids)

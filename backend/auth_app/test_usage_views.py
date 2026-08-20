"""P1-2 计费落库费用分解接口测试

覆盖：
- GET /api/usage/cost-breakdown：需鉴权
- 按 APICallLog 聚合总费用/总tokens/总调用
- group_by=model / day 分组明细
"""

from decimal import Decimal

from rest_framework.test import APITestCase


class CostBreakdownViewTest(APITestCase):
    """GET /api/usage/cost-breakdown"""

    def setUp(self):
        from django.contrib.auth import get_user_model
        self.user = get_user_model().objects.create_user(
            username='usage_test', password='x' * 12,
        )
        from .billing_models import APICallLog
        self.APICallLog = APICallLog
        # 两条调用记录：同一模型，不同用户归属（user_id 无关，未建 FK）
        self.APICallLog.objects.create(
            user_id=self.user.id, run_id='run-0001', scenario='intent',
            provider='deepseek', model='deepseek-chat',
            input_tokens=1000, output_tokens=500, total_tokens=1500,
            cost=Decimal('0.001500'), status='success',
        )
        self.APICallLog.objects.create(
            user_id=self.user.id, run_id='run-0002', scenario='audit',
            provider='deepseek', model='deepseek-reasoner',
            input_tokens=2000, output_tokens=0, total_tokens=2000,
            cost=Decimal('0.001000'), status='success',
        )

    def test_get_requires_auth(self):
        resp = self.client.get('/api/usage/cost-breakdown/')
        self.assertEqual(resp.status_code, 401)

    def test_summary_aggregates_calls(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/usage/cost-breakdown/')
        self.assertEqual(resp.status_code, 200)
        summary = resp.json()['data']['summary']
        self.assertEqual(summary['total_calls'], 2)
        self.assertEqual(summary['total_tokens'], 3500)
        # 0.0015 + 0.0010 = 0.0025
        self.assertAlmostEqual(summary['total_cost'], 0.0025, places=6)
        self.assertEqual(summary['period_days'], 30)

    def test_group_by_model(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/usage/cost-breakdown/?group_by=model')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']
        self.assertEqual(data['group_by'], 'model')
        items = {it['model']: it for it in data['items']}
        self.assertIn('deepseek-chat', items)
        self.assertIn('deepseek-reasoner', items)
        self.assertEqual(items['deepseek-chat']['calls'], 1)
        self.assertAlmostEqual(items['deepseek-chat']['cost'], 0.0015, places=6)

    def test_group_by_day(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/usage/cost-breakdown/?group_by=day')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']
        self.assertEqual(data['group_by'], 'day')
        # 两条记录同一天，应聚合成 1 行、calls=2
        self.assertEqual(len(data['items']), 1)
        self.assertEqual(data['items'][0]['calls'], 2)

"""套餐/计费实时挂钩（4.2.3 两级计费）测试

覆盖：
- GET /api/billing/summary：需鉴权；免费/套餐用户返回本月已用、套餐剩余、预估费用、建议
- 套餐额度用尽 → 超限挂账 + upgrade 建议
- 免费用户 → bind_key 建议
- GET /api/billing/monthly-detail：按天聚合，含全月补齐 0 值
"""

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from auth_app.billing_service import get_billing_summary, get_monthly_detail
from auth_app.payment_models import UserQuota


def _create_user(username):
    from django.contrib.auth import get_user_model
    return get_user_model().objects.create_user(
        username=username, password='x' * 12,
    )


def _create_call_log(user, cost, created_at, tokens=100):
    from auth_app.billing_models import APICallLog
    import uuid
    # created_at 为 auto_now_add，create 时会强制置为 now，须用 update 回填历史时间
    log = APICallLog.objects.create(
        user_id=user.id,
        run_id=f'bill-{uuid.uuid4().hex[:8]}',
        model='deepseek-chat',
        total_tokens=tokens,
        cost=Decimal(str(cost)),
    )
    APICallLog.objects.filter(id=log.id).update(created_at=created_at)
    return log


class BillingServiceTest(TestCase):
    """get_billing_summary / get_monthly_detail"""

    def setUp(self):
        self.user = _create_user('billing_svc')

    def test_free_user_summary(self):
        summary = get_billing_summary(self.user)
        self.assertEqual(summary['plan']['plan_type'], 'free')
        self.assertFalse(summary['plan']['is_plan'])
        self.assertEqual(summary['usage']['calls'], 0)
        self.assertEqual(summary['over_quota']['calls'], 0)
        self.assertEqual(summary['advice'], 'bind_key')
        self.assertIsNone(summary['plan_remaining'])

    def test_summary_counts_current_month_only(self):
        now = timezone.localtime()
        _create_call_log(self.user, 1.5, now - timedelta(days=1))
        _create_call_log(self.user, 2.5, now)
        _create_call_log(self.user, 9.0, now - timedelta(days=60))  # 上上月，不计入

        summary = get_billing_summary(self.user)
        self.assertEqual(summary['usage']['calls'], 2)
        self.assertAlmostEqual(summary['usage']['cost'], 4.0, places=2)
        self.assertGreaterEqual(summary['projected_month_cost'], summary['usage']['cost'])

    def test_plan_over_quota_charges_extra_and_advises_upgrade(self):
        quota, _ = UserQuota.objects.get_or_create(user=self.user)
        quota.is_vip = True
        quota.vip_level = 1  # basic：api_limit=10000, api_call_price=0.05
        quota.save()

        now = timezone.localtime()
        for i in range(10005):  # 超 5 次
            _create_call_log(self.user, 0.01, now, tokens=10)

        summary = get_billing_summary(self.user)
        self.assertEqual(summary['plan']['plan_type'], 'basic')
        self.assertEqual(summary['plan_remaining'], 0)
        self.assertEqual(summary['over_quota']['calls'], 5)
        self.assertAlmostEqual(summary['over_quota']['cost'], 5 * 0.05, places=2)
        self.assertEqual(summary['advice'], 'upgrade')

    def test_monthly_detail_pads_full_month(self):
        now = timezone.localtime()
        _create_call_log(self.user, 3.0, now)
        detail = get_monthly_detail(self.user)
        self.assertEqual(detail['month'], now.strftime('%Y-%m'))
        # 全月补齐：每天都有记录
        month_start = date(now.year, now.month, 1)
        next_month = (
            date(month_start.year + 1, 1, 1)
            if month_start.month == 12
            else date(month_start.year, month_start.month + 1, 1)
        )
        expected_days = (next_month - month_start).days
        self.assertEqual(len(detail['days']), expected_days)
        # 今天有消费
        today_key = now.date().isoformat()
        today_row = next(d for d in detail['days'] if d['date'] == today_key)
        self.assertEqual(today_row['calls'], 1)

    def test_monthly_detail_invalid_month_falls_back(self):
        """非法 month 参数回退当月，不报错（§7.2 参数边界）"""
        now = timezone.localtime()
        detail = get_monthly_detail(self.user, month='not-a-month')
        self.assertEqual(detail['month'], now.strftime('%Y-%m'))

    def test_monthly_detail_filters_by_given_month(self):
        """month 指定历史月份时仅返回该月数据，且不含当月调用"""
        now = timezone.localtime()
        # 上个月
        if now.month == 1:
            prev_month_start = date(now.year - 1, 12, 1)
        else:
            prev_month_start = date(now.year, now.month - 1, 1)
        _create_call_log(self.user, 2.0, prev_month_start + timedelta(days=5))

        key = prev_month_start.strftime('%Y-%m')
        detail = get_monthly_detail(self.user, month=key)
        self.assertEqual(detail['month'], key)
        self.assertEqual(detail['days'][5]['calls'], 1)
        # 该月总调用恰为 1（当月调用不计入）
        self.assertEqual(sum(d['calls'] for d in detail['days']), 1)

    def test_summary_unlimited_plan_never_over_quota(self):
        """enterprise 套餐 api_limit=-1（无限）→ 无超限挂账、无剩余约束、建议 ok"""
        quota, _ = UserQuota.objects.get_or_create(user=self.user)
        quota.is_vip = True
        quota.vip_level = 3  # enterprise：api_limit=-1
        quota.save()

        now = timezone.localtime()
        for _ in range(200):
            _create_call_log(self.user, 0.01, now, tokens=10)

        summary = get_billing_summary(self.user)
        self.assertEqual(summary['plan']['plan_type'], 'enterprise')
        self.assertEqual(summary['plan']['api_limit'], -1)
        self.assertIsNone(summary['plan_remaining'])
        self.assertEqual(summary['over_quota']['calls'], 0)
        self.assertEqual(summary['advice'], 'ok')


class BillingViewTest(APITestCase):
    """GET /api/billing/summary / monthly-detail"""

    def setUp(self):
        self.user = _create_user('billing_view')

    def test_summary_requires_auth(self):
        resp = self.client.get('/api/billing/summary/')
        self.assertEqual(resp.status_code, 401)

    def test_summary_returns_structure(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/billing/summary/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']
        for key in ('month', 'plan', 'usage', 'plan_remaining',
                    'over_quota', 'projected_month_cost', 'advice'):
            self.assertIn(key, data)
        self.assertIn('plan_type', data['plan'])

    def test_monthly_detail_requires_auth(self):
        resp = self.client.get('/api/billing/monthly-detail/')
        self.assertEqual(resp.status_code, 401)

    def test_monthly_detail_returns_days(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/billing/monthly-detail/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']
        self.assertIn('month', data)
        self.assertIn('days', data)
        self.assertGreater(len(data['days']), 0)

"""P2 统计二期：每小时区域监控热力图接口测试

覆盖：
- GET /api/stats/hourly：需鉴权 / 按小时×区域聚合矩阵 / 区域过滤 / 精确小时 + Top10 明细 / 3σ 异常 / 空数据
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase


class HourlyRegionTestBase(APITestCase):
    """公共准备：用户、API Key 与使用日志工厂"""

    def setUp(self):
        from django.contrib.auth import get_user_model
        self.user = get_user_model().objects.create_user(
            username='hourly_test', password='x' * 12,
        )
        from .apikey_models import APIKey, APIKeyUsageLog
        self.APIKey = APIKey
        self.APIKeyUsageLog = APIKeyUsageLog
        self.api_key, _raw = APIKey.create_for_user(self.user, name='hourly-key')
        self.now = timezone.now()

    def _create(self, region='all', endpoint='/api/v1/test', response_time_ms=100, **kwargs):
        """创建使用日志；支持显式 timestamp（auto_now_add 不可覆盖，需走 update）"""
        created = kwargs.pop('timestamp', None)
        obj = self.APIKeyUsageLog.objects.create(
            api_key=self.api_key,
            endpoint=endpoint,
            method='GET',
            status_code=200,
            response_time_ms=response_time_ms,
            region=region,
            **kwargs,
        )
        if created is not None:
            self.APIKeyUsageLog.objects.filter(pk=obj.pk).update(timestamp=created)
        return obj

    def _hour(self, dt):
        """截断到整点（使用本地时区，与接口聚合时区一致）"""
        return timezone.localtime(dt).replace(minute=0, second=0, microsecond=0)

    def _local_date(self, days=0):
        """返回 N 天前的本地日期（YYYY-MM-DD，与接口 start_date/end_date 语义一致）"""
        return timezone.localdate(timezone.now() - timedelta(days=days))


class HourlyRegionViewTest(HourlyRegionTestBase):
    """GET /api/stats/hourly"""

    def test_requires_auth(self):
        resp = self.client.get('/api/stats/hourly/')
        self.assertEqual(resp.status_code, 401)

    def test_hourly_matrix_aggregation(self):
        """按小时×区域聚合，矩阵含零值桶，hours 为整点标签"""
        h1 = self._hour(self.now)
        h0 = h1 - timedelta(hours=1)
        self._create(region='cn', timestamp=h1)
        self._create(region='cn', timestamp=h1 + timedelta(minutes=10))
        self._create(region='us', timestamp=h1)
        self._create(region='cn', timestamp=h0)

        today = self._local_date()
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f'/api/stats/hourly/?start_date={today}&end_date={today}')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']

        self.assertEqual(data['days'], 1)
        self.assertIn('cn', data['regions'])
        self.assertIn('us', data['regions'])
        self.assertEqual(len(data['hours']), 24)

        cells = {(c['hour'], c['region']): c for c in data['matrix']}
        h1_label = h1.strftime('%Y-%m-%dT%H')
        h0_label = h0.strftime('%Y-%m-%dT%H')

        self.assertEqual(cells[(h1_label, 'cn')]['calls'], 2)
        self.assertEqual(cells[(h1_label, 'us')]['calls'], 1)
        self.assertEqual(cells[(h0_label, 'cn')]['calls'], 1)
        # 零值桶存在且非异常
        self.assertIn('anomaly', cells[(h1_label, 'cn')])
        self.assertEqual(data['summary']['total_calls'], 4)

    def test_hourly_region_filter(self):
        """region 过滤后仅返回该区域"""
        h1 = self._hour(self.now)
        self._create(region='cn', timestamp=h1)
        self._create(region='us', timestamp=h1)

        today = self._local_date()
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f'/api/stats/hourly/?start_date={today}&end_date={today}&region=cn')
        data = resp.json()['data']

        self.assertEqual(data['regions'], ['cn'])
        self.assertTrue(all(c['region'] == 'cn' for c in data['matrix']))
        self.assertEqual(data['summary']['total_calls'], 1)

    def test_hourly_exact_hour_top_calls(self):
        """hour 参数精确过滤，并返回 Top 10 调用明细"""
        h1 = self._hour(self.now)
        self._create(region='cn', endpoint='/api/v1/a', response_time_ms=500, timestamp=h1)
        self._create(region='cn', endpoint='/api/v1/b', response_time_ms=300, timestamp=h1)
        self._create(region='us', endpoint='/api/v1/c', response_time_ms=900, timestamp=h1)

        h1_label = h1.strftime('%Y-%m-%dT%H')
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f'/api/stats/hourly/?hour={h1_label}')
        data = resp.json()['data']

        self.assertEqual(data['hours'], [h1_label])
        self.assertTrue(all(c['hour'] == h1_label for c in data['matrix']))
        self.assertIn('top_calls', data)
        # 按耗时降序：c(900) → a(500) → b(300)
        self.assertEqual(data['top_calls'][0]['endpoint'], '/api/v1/c')
        self.assertEqual(data['top_calls'][0]['region'], 'us')
        self.assertEqual(len(data['top_calls']), 3)
        self.assertIn('time', data['top_calls'][0])

    def test_hourly_anomaly_detection(self):
        """某小时调用激增 → 3σ 异常标记"""
        base = self._hour(self.now) - timedelta(hours=12)
        # 10 个低流量小时 + 1 个激增小时
        for i in range(10):
            self._create(region='cn', timestamp=base + timedelta(hours=i))
        spike_h = base + timedelta(hours=10)
        for _ in range(30):
            self._create(region='cn', timestamp=spike_h)

        start = self._local_date(days=2)
        end = self._local_date()
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f'/api/stats/hourly/?start_date={start}&end_date={end}&region=cn')
        data = resp.json()['data']

        spike_label = spike_h.strftime('%Y-%m-%dT%H')
        spike_cells = [c for c in data['matrix'] if c['hour'] == spike_label and c['region'] == 'cn']
        self.assertEqual(spike_cells[0]['calls'], 30)
        self.assertTrue(spike_cells[0]['anomaly'])
        self.assertGreaterEqual(data['summary']['anomaly_count'], 1)

    def test_hourly_empty(self):
        """无数据时返回有效空结构"""
        today = self._local_date()
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f'/api/stats/hourly/?start_date={today}&end_date={today}')
        data = resp.json()['data']

        self.assertEqual(data['summary']['total_calls'], 0)
        self.assertEqual(len(data['matrix']), 4 * 24)
        self.assertTrue(all(c['calls'] == 0 for c in data['matrix']))

    def test_top_calls_truncated_to_10(self):
        """同一小时内调用数 > 10 时 top_calls 只返回耗时最高的 10 条（§7.2 截断）"""
        h1 = self._hour(self.now)
        for i in range(12):
            self._create(region='cn', endpoint=f'/api/v1/{i}', response_time_ms=100 + i, timestamp=h1)

        h1_label = h1.strftime('%Y-%m-%dT%H')
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f'/api/stats/hourly/?hour={h1_label}')
        data = resp.json()['data']

        top_calls = data.get('top_calls', [])
        self.assertEqual(len(top_calls), 10)
        # 按耗时降序：耗时最高的是 /api/v1/11（100+11=111ms）
        self.assertEqual(top_calls[0]['endpoint'], '/api/v1/11')
        endpoints = {c['endpoint'] for c in top_calls}
        self.assertNotIn('/api/v1/0', endpoints)
        self.assertNotIn('/api/v1/1', endpoints)

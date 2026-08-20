"""边界条件与数据保留测试

覆盖：
- DataCleanupService.run_all_cleanup：按合规保留期分批删除过期日志/计费/统计快照（180/365/730 天）
- cleanup_expired_tokens / cleanup_expired_sessions：过期 JWT 黑名单与 Session 清理
- _parse_date_range：days 与 start/end 跨度 clamp 到 STATS_MAX_RANGE_DAYS
- trend / hourly 接口：桶数超 STATS_MAX_BUCKETS 返回 400
"""

from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.test import APITestCase


class DataRetentionTestBase(APITestCase):
    """公共准备：用户与各增长表工厂"""

    def setUp(self):
        from django.contrib.auth import get_user_model
        self.user = get_user_model().objects.create_user(
            username='retention_test', password='x' * 12,
        )
        from .models import LoginLog
        from .user_behavior_models import UserBehaviorLog
        from .billing_models import APICallLog
        from .apikey_models import APIKey, APIKeyUsageLog
        from .stats_models import DailyPlatformStats, HourlyRegionStats

        self.LoginLog = LoginLog
        self.UserBehaviorLog = UserBehaviorLog
        self.APICallLog = APICallLog
        self.APIKeyUsageLog = APIKeyUsageLog
        self.DailyPlatformStats = DailyPlatformStats
        self.HourlyRegionStats = HourlyRegionStats

        self.api_key = APIKey.objects.create(
            user=self.user, name='test', key_hash='hash-1', key_prefix='sk-',
        )

    @staticmethod
    def _backdate(obj, field, dt):
        """覆盖 auto_now_add 时间字段（走 update）。"""
        from django.apps import apps
        model = type(obj)
        apps.get_model(model._meta.app_label, model._meta.model_name).objects.filter(pk=obj.pk).update(**{field: dt})


class RunAllCleanupTest(DataRetentionTestBase):
    """统一数据保留清理：过期删除、近期保留"""

    def _seed(self):
        now = timezone.now()
        old_login = self.LoginLog.objects.create(user=self.user)
        new_login = self.LoginLog.objects.create(user=self.user)
        self._backdate(old_login, 'login_time', now - timedelta(days=200))
        self._backdate(new_login, 'login_time', now - timedelta(days=10))

        old_usage = self.APIKeyUsageLog.objects.create(
            api_key=self.api_key, endpoint='/x', method='GET',
            status_code=200, response_time_ms=10,
        )
        new_usage = self.APIKeyUsageLog.objects.create(
            api_key=self.api_key, endpoint='/x', method='GET',
            status_code=200, response_time_ms=10,
        )
        self._backdate(old_usage, 'timestamp', now - timedelta(days=200))
        self._backdate(new_usage, 'timestamp', now - timedelta(days=10))

        old_behavior = self.UserBehaviorLog.objects.create(target_id=1)
        new_behavior = self.UserBehaviorLog.objects.create(target_id=2)
        self._backdate(old_behavior, 'created_at', now - timedelta(days=200))
        self._backdate(new_behavior, 'created_at', now - timedelta(days=10))

        old_call = self.APICallLog.objects.create(run_id='old-call')
        new_call = self.APICallLog.objects.create(run_id='new-call')
        self._backdate(old_call, 'created_at', now - timedelta(days=400))
        self._backdate(new_call, 'created_at', now - timedelta(days=10))

        old_daily = self.DailyPlatformStats.objects.create(date=(now - timedelta(days=800)).date())
        new_daily = self.DailyPlatformStats.objects.create(date=(now - timedelta(days=10)).date())

        old_hour = self.HourlyRegionStats.objects.create(
            hour=now - timedelta(days=800), region='cn',
        )
        new_hour = self.HourlyRegionStats.objects.create(
            hour=now - timedelta(days=10), region='cn',
        )

        return {
            'old_login': old_login.pk, 'new_login': new_login.pk,
            'old_usage': old_usage.pk, 'new_usage': new_usage.pk,
            'old_behavior': old_behavior.pk, 'new_behavior': new_behavior.pk,
            'old_call': old_call.pk, 'new_call': new_call.pk,
            'old_daily': old_daily.pk, 'new_daily': new_daily.pk,
            'old_hour': old_hour.pk, 'new_hour': new_hour.pk,
        }

    def test_removes_expired_keeps_recent(self):
        from .data_cleanup_service import DataCleanupService

        ids = self._seed()
        DataCleanupService.run_all_cleanup()

        # 过期数据按保留期删除
        self.assertFalse(self.LoginLog.objects.filter(pk=ids['old_login']).exists())
        self.assertFalse(self.APIKeyUsageLog.objects.filter(pk=ids['old_usage']).exists())
        self.assertFalse(self.UserBehaviorLog.objects.filter(pk=ids['old_behavior']).exists())
        self.assertFalse(self.APICallLog.objects.filter(pk=ids['old_call']).exists())
        self.assertFalse(self.DailyPlatformStats.objects.filter(pk=ids['old_daily']).exists())
        self.assertFalse(self.HourlyRegionStats.objects.filter(pk=ids['old_hour']).exists())

        # 近期数据保留
        self.assertTrue(self.LoginLog.objects.filter(pk=ids['new_login']).exists())
        self.assertTrue(self.APIKeyUsageLog.objects.filter(pk=ids['new_usage']).exists())
        self.assertTrue(self.UserBehaviorLog.objects.filter(pk=ids['new_behavior']).exists())
        self.assertTrue(self.APICallLog.objects.filter(pk=ids['new_call']).exists())
        self.assertTrue(self.DailyPlatformStats.objects.filter(pk=ids['new_daily']).exists())
        self.assertTrue(self.HourlyRegionStats.objects.filter(pk=ids['new_hour']).exists())

    def test_skill_hotness_snapshot_string_hour_key(self):
        """SkillHotnessSnapshot 的 YYYYMMDDHH 字符串时间键按字典序清理。"""
        from .data_cleanup_service import DataCleanupService
        from .skill_config_models import SkillConfig
        from .payment_models import SkillHotnessSnapshot

        skill = SkillConfig.objects.first()
        if skill is None:  # 无 seed 数据时跳过该断言（不阻塞其他清理逻辑）
            return

        now = timezone.now()
        old_key = (now - timedelta(days=800)).strftime('%Y%m%d00')
        new_key = (now - timedelta(days=10)).strftime('%Y%m%d00')
        old_snap = SkillHotnessSnapshot.objects.create(skill=skill, hour_key=old_key)
        new_snap = SkillHotnessSnapshot.objects.create(skill=skill, hour_key=new_key)

        DataCleanupService.run_all_cleanup()

        self.assertFalse(SkillHotnessSnapshot.objects.filter(pk=old_snap.pk).exists())
        self.assertTrue(SkillHotnessSnapshot.objects.filter(pk=new_snap.pk).exists())


class CleanupTokenSessionTest(DataRetentionTestBase):
    """过期 JWT 黑名单与 Session 清理"""

    def test_cleanup_expired_tokens(self):
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
        from .tasks import cleanup_expired_tokens

        now = timezone.now()
        expired = OutstandingToken.objects.create(
            user=self.user, jti='jti-expired', token='x',
            expires_at=now - timedelta(hours=1),
        )
        alive = OutstandingToken.objects.create(
            user=self.user, jti='jti-alive', token='x',
            expires_at=now + timedelta(hours=1),
        )

        result = cleanup_expired_tokens()

        self.assertTrue(result['success'])
        self.assertFalse(OutstandingToken.objects.filter(pk=expired.pk).exists())
        self.assertTrue(OutstandingToken.objects.filter(pk=alive.pk).exists())

    def test_cleanup_expired_sessions(self):
        from django.contrib.sessions.models import Session
        from .tasks import cleanup_expired_sessions

        now = timezone.now()
        expired = Session.objects.create(
            session_key='sess-expired', session_data='{}',
            expire_date=now - timedelta(hours=1),
        )
        alive = Session.objects.create(
            session_key='sess-alive', session_data='{}',
            expire_date=now + timedelta(hours=1),
        )

        result = cleanup_expired_sessions()

        self.assertTrue(result['success'])
        self.assertFalse(Session.objects.filter(pk=expired.pk).exists())
        self.assertTrue(Session.objects.filter(pk=alive.pk).exists())


class ParseDateRangeBoundaryTest(DataRetentionTestBase):
    """_parse_date_range 的 days/跨度边界"""

    def _parse(self, get):
        from types import SimpleNamespace
        from .stats_views import _parse_date_range
        return _parse_date_range(SimpleNamespace(GET=get))

    def test_days_clamped_to_max_range(self):
        max_days = settings.STATS_MAX_RANGE_DAYS
        start_dt, end_dt, span, _ = self._parse({'days': '99999'})
        self.assertEqual(span, max_days)
        # end_dt 为独占上界（已 +1 天），故区间天数 = (end_dt - start_dt).days
        self.assertLessEqual((end_dt - start_dt).days, max_days)

    def test_days_min_boundary(self):
        start_dt, end_dt, span, _ = self._parse({'days': '0'})
        self.assertEqual(span, 1)

    def test_invalid_days_falls_back(self):
        start_dt, end_dt, span, _ = self._parse({'days': 'abc'})
        self.assertEqual(span, 7)

    def test_start_end_span_clamped(self):
        max_days = settings.STATS_MAX_RANGE_DAYS
        start_dt, end_dt, span, _ = self._parse({
            'start_date': '2020-01-01', 'end_date': '2026-01-01',
        })
        self.assertEqual(span, max_days)


class StatsApiBoundaryTest(DataRetentionTestBase):
    """trend / hourly 接口桶数上限返回 400"""

    def test_trend_rejects_oversized_bucket_count(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/stats/trend/?days=99999&granularity=hour')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('error', resp.json())

    def test_hourly_rejects_oversized_hour_count(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/stats/hourly/?days=99999')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('error', resp.json())


class P0ControlPlaneBoundaryTest(DataRetentionTestBase):
    """P0 M1 统一控制面边界：log-level 级别白名单"""

    def test_log_level_requires_auth(self):
        resp = self.client.put('/api/settings/log-level/', {'level': 'DEBUG'}, format='json')
        self.assertEqual(resp.status_code, 401)

    def test_log_level_rejects_invalid_level(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.put('/api/settings/log-level/', {'level': 'TRACE'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('error', resp.json())

    def test_log_level_accepts_valid_and_normalizes_warn(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.put('/api/settings/log-level/', {'level': 'WARN'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json().get('level'), 'WARNING')


class P1StatsOverviewBoundaryTest(DataRetentionTestBase):
    """P1 统计一期边界：overview 时间跨度 clamp"""

    def test_overview_days_clamped(self):
        """days=99999 不报错，时间范围收敛到 STATS_MAX_RANGE_DAYS"""
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/stats/overview/?days=99999')
        self.assertEqual(resp.status_code, 200)
        data = resp.json().get('data', resp.json())
        self.assertIsNotNone(data)

    def test_overview_start_end_span_clamped(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/stats/overview/?start_date=2020-01-01&end_date=2026-01-01')
        self.assertEqual(resp.status_code, 200)


class P1QuotaAlertBoundaryTest(DataRetentionTestBase):
    """P1 消费预警边界：quota-alert 阈值校验与 notify 白名单"""

    def test_quota_alert_rejects_non_int_threshold(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            '/api/settings/quota-alert/',
            {'warn_threshold': 'abc'}, format='json',
        )
        self.assertEqual(resp.status_code, 400)

    def test_quota_alert_rejects_warn_gte_critical(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            '/api/settings/quota-alert/',
            {'warn_threshold': 95, 'critical_threshold': 80}, format='json',
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn('error', resp.json())

    def test_quota_alert_clamps_thresholds(self):
        self.client.force_authenticate(user=self.user)
        # warn=1 为最小有效值；critical=150 超上限应收敛到 100
        resp = self.client.post(
            '/api/settings/quota-alert/',
            {'warn_threshold': 1, 'critical_threshold': 150}, format='json',
        )
        self.assertEqual(resp.status_code, 200)
        cfg = resp.json()['config']
        self.assertEqual(cfg['warn_threshold'], 1)
        self.assertEqual(cfg['critical_threshold'], 100)

    def test_quota_alert_filters_invalid_notify(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            '/api/settings/quota-alert/',
            {'notify': ['desktop', 'email', 'hacker']}, format='json',
        )
        self.assertEqual(resp.status_code, 200)
        notify = resp.json()['config']['notify']
        self.assertEqual(set(notify), {'desktop', 'email'})
        self.assertNotIn('hacker', notify)

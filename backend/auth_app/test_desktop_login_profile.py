"""P1-3 / P1-4 后端接口测试

P1-3 桌面端→官网登录态同步（账号互通一期）：
- POST /api/auth/desktop-login-token/：需鉴权，生成一次性临时 token（5 分钟）
- POST /api/auth/desktop-login/exchange/：用临时 token 兑换正式 JWT，用后即销毁

P1-4 官网数据持久化 UserProfile（账号互通二期）：
- GET/PUT /api/user/profile/：读写 主题/布局/收藏，重新登录不丢失
"""

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase

from .user_behavior_models import UserProfile


class DesktopLoginSyncTest(APITestCase):
    """P1-3 桌面端→官网登录态同步"""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='desktop_sync', password='x' * 12,
        )

    def test_generate_requires_auth(self):
        resp = self.client.post('/api/auth/desktop-login-token/')
        self.assertEqual(resp.status_code, 401)

    def test_generate_returns_token(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post('/api/auth/desktop-login-token/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']
        self.assertTrue(data['token'])
        self.assertEqual(data['expires_in'], 300)

    def test_exchange_with_valid_token_returns_jwt(self):
        self.client.force_authenticate(user=self.user)
        token = self.client.post('/api/auth/desktop-login-token/').json()['data']['token']
        self.client.force_authenticate(user=None)
        resp = self.client.post(
            '/api/auth/desktop-login/exchange/',
            {'token': token},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']
        self.assertTrue(data['token'])
        self.assertTrue(data['refresh_token'])
        self.assertEqual(data['user']['username'], self.user.username)

    def test_exchange_token_is_single_use(self):
        self.client.force_authenticate(user=self.user)
        token = self.client.post('/api/auth/desktop-login-token/').json()['data']['token']
        self.client.force_authenticate(user=None)
        first = self.client.post(
            '/api/auth/desktop-login/exchange/',
            {'token': token},
            format='json',
        )
        self.assertEqual(first.status_code, 200)
        # 二次兑换应失败（用后即销毁，防重放）
        second = self.client.post(
            '/api/auth/desktop-login/exchange/',
            {'token': token},
            format='json',
        )
        self.assertEqual(second.status_code, 401)

    def test_exchange_invalid_token_rejected(self):
        resp = self.client.post(
            '/api/auth/desktop-login/exchange/',
            {'token': 'not-a-real-token'},
            format='json',
        )
        self.assertEqual(resp.status_code, 401)

    def test_exchange_missing_token_rejected(self):
        resp = self.client.post(
            '/api/auth/desktop-login/exchange/',
            {},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)


class UserProfileAPITest(APITestCase):
    """P1-4 官网数据持久化 UserProfile"""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='profile_api', password='x' * 12,
        )

    def test_get_requires_auth(self):
        resp = self.client.get('/api/user/profile/')
        self.assertEqual(resp.status_code, 401)

    def test_get_returns_default_profile(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/user/profile/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']
        self.assertEqual(data['theme'], 'default')
        self.assertEqual(data['layout'], {})
        self.assertEqual(data['favorites'], [])

    def test_put_updates_and_persists(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.put(
            '/api/user/profile/',
            {
                'theme': 'dark',
                'layout': {'nav': 'compact'},
                'favorites': ['a', 'b'],
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['data']['theme'], 'dark')
        # 落库持久化，重新读取不丢失
        profile = UserProfile.objects.get(user=self.user)
        self.assertEqual(profile.theme, 'dark')
        self.assertEqual(profile.layout, {'nav': 'compact'})
        self.assertEqual(profile.favorites, ['a', 'b'])

    def test_put_ignores_invalid_field_types(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.put(
            '/api/user/profile/',
            {'layout': 'not-a-dict', 'favorites': 'not-a-list'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        # 非法类型字段被忽略，不产生 500
        self.assertEqual(resp.json()['data']['layout'], {})
        self.assertEqual(resp.json()['data']['favorites'], [])

    def test_put_partial_update_only_theme(self):
        self.client.force_authenticate(user=self.user)
        self.client.put('/api/user/profile/', {'theme': 'deep'}, format='json')
        resp = self.client.get('/api/user/profile/')
        data = resp.json()['data']
        self.assertEqual(data['theme'], 'deep')
        self.assertEqual(data['favorites'], [])

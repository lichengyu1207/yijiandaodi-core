"""用户自有 API Key 管理测试（P1 消费控制：自带 Key 免平台配额）

覆盖：
- crypto_utils 加解密 / 掩码
- UserProviderKey 模型 set_key / decrypted_key
- POST /api/api-keys/user-key 设置（含无效 Key 拒绝）
- GET  /api/api-keys/user-key/status 状态查询（无 Key / 有 Key）
- DELETE /api/api-keys/user-key/delete 删除
- 鉴权：未登录一律 401
"""

from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APITestCase

from .crypto_utils import encrypt_secret, decrypt_secret, mask_key
from .user_provider_key_models import UserProviderKey

VALID_KEY = 'sk-abcdef0123456789'
INVALID_KEY = 'sk-invalid'


class CryptoUtilsTest(TestCase):
    """密钥加解密与掩码"""

    def test_round_trip(self):
        enc = encrypt_secret(VALID_KEY)
        self.assertTrue(enc.startswith('enc:v1:'))
        self.assertNotIn(VALID_KEY, enc, '密文不应包含明文')
        self.assertEqual(decrypt_secret(enc), VALID_KEY)

    def test_empty_handling(self):
        self.assertEqual(encrypt_secret(''), '')
        self.assertEqual(decrypt_secret(''), '')
        # 无前缀的旧值原样返回（历史兜底）
        self.assertEqual(decrypt_secret('plain-old'), 'plain-old')

    def test_corrupted_cipher_returns_empty(self):
        self.assertEqual(decrypt_secret('enc:v1:not-a-valid-token!!'), '')

    def test_mask_key(self):
        self.assertEqual(mask_key(VALID_KEY), 'sk-****6789')
        self.assertEqual(mask_key(''), '')


class UserProviderKeyModelTest(TestCase):
    """模型：加密存储 + 解密还原 + 唯一约束"""

    def setUp(self):
        from django.contrib.auth import get_user_model
        self.user = get_user_model().objects.create_user(
            username='key_owner', password='x' * 12,
        )

    def test_set_key_encrypts_and_stores_suffix(self):
        obj = UserProviderKey.objects.create(user=self.user, provider='deepseek')
        obj.set_key(VALID_KEY)
        self.assertTrue(obj.key_encrypted.startswith('enc:v1:'))
        self.assertNotIn(VALID_KEY, obj.key_encrypted)
        self.assertEqual(obj.key_suffix, VALID_KEY[-6:])
        self.assertEqual(obj.decrypted_key, VALID_KEY)

    def test_unique_constraint_per_user_provider(self):
        UserProviderKey.objects.create(user=self.user, provider='deepseek')
        UserProviderKey.objects.create(user=self.user, provider='grok')  # 不同 provider 允许
        with self.assertRaises(Exception):
            UserProviderKey.objects.create(user=self.user, provider='deepseek')


class SetUserKeyViewTest(APITestCase):
    """POST /api/api-keys/user-key/"""

    def setUp(self):
        from django.contrib.auth import get_user_model
        self.user = get_user_model().objects.create_user(
            username='key_setter', password='x' * 12,
        )
        self.url = '/api/api-keys/user-key/'

    def test_requires_auth(self):
        resp = self.client.post(self.url, {'api_key': VALID_KEY}, format='json')
        self.assertEqual(resp.status_code, 401)

    @patch('auth_app.user_provider_key_views._verify_deepseek_key',
           return_value=(True, 'CNY 110.00'))
    def test_set_key_success(self, _mock_verify):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(self.url, {'api_key': VALID_KEY}, format='json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']
        self.assertEqual(data['masked'], 'sk-****456789')
        self.assertEqual(data['balance'], 'CNY 110.00')

        obj = UserProviderKey.objects.get(user=self.user, provider='deepseek')
        self.assertTrue(obj.is_active)
        self.assertTrue(obj.last_verified_ok)
        self.assertEqual(obj.decrypted_key, VALID_KEY)
        # 接口响应不回显明文
        self.assertNotIn(VALID_KEY, resp.content.decode())

    @patch('auth_app.user_provider_key_views._verify_deepseek_key',
           return_value=(False, ''))
    def test_set_key_rejected_when_invalid(self, _mock_verify):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(self.url, {'api_key': INVALID_KEY}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(resp.json()['success'])
        self.assertFalse(
            UserProviderKey.objects.filter(user=self.user, provider='deepseek').exists(),
            '验证失败不应落库',
        )

    def test_empty_key_rejected(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(self.url, {'api_key': ''}, format='json')
        self.assertEqual(resp.status_code, 400)


class UserKeyStatusViewTest(APITestCase):
    """GET /api/api-keys/user-key/status/"""

    def setUp(self):
        from django.contrib.auth import get_user_model
        self.user = get_user_model().objects.create_user(
            username='key_viewer', password='x' * 12,
        )
        self.url = '/api/api-keys/user-key/status/?provider=deepseek'

    def test_requires_auth(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 401)

    def test_no_key_returns_has_key_false(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']
        self.assertFalse(data['hasKey'])
        self.assertEqual(data['masked'], '')
        self.assertEqual(data['todayUsed'], 0)

    def test_with_key_returns_masked_and_balance(self):
        obj = UserProviderKey.objects.create(user=self.user, provider='deepseek')
        obj.set_key(VALID_KEY)
        obj.save(update_fields=['key_encrypted', 'key_suffix'])  # 持久化后缀
        obj.mark_verified(True, 'CNY 50.00')
        obj.today_used = 3
        obj.save(update_fields=['today_used'])

        self.client.force_authenticate(user=self.user)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()['data']
        self.assertTrue(data['hasKey'])
        self.assertEqual(data['masked'], f'sk-****{obj.key_suffix}')
        self.assertEqual(data['balance'], 'CNY 50.00')
        self.assertEqual(data['todayUsed'], 3)
        self.assertTrue(data['lastVerifiedOk'])
        self.assertNotIn(VALID_KEY, resp.content.decode())


class DeleteUserKeyViewTest(APITestCase):
    """DELETE /api/api-keys/user-key/delete/"""

    def setUp(self):
        from django.contrib.auth import get_user_model
        self.user = get_user_model().objects.create_user(
            username='key_deleter', password='x' * 12,
        )
        self.url = '/api/api-keys/user-key/delete/'

    def test_requires_auth(self):
        resp = self.client.delete(self.url, {'provider': 'deepseek'}, format='json')
        self.assertEqual(resp.status_code, 401)

    def test_delete_existing_key(self):
        UserProviderKey.objects.create(user=self.user, provider='deepseek')
        self.client.force_authenticate(user=self.user)
        resp = self.client.delete(self.url, {'provider': 'deepseek'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(
            UserProviderKey.objects.filter(user=self.user, provider='deepseek').exists(),
        )

    def test_delete_missing_key_is_idempotent(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.delete(self.url, {'provider': 'deepseek'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()['success'])

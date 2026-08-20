"""
密钥加解密工具（用户自有 API Key 静态加密）
基于 Django SECRET_KEY 派生 Fernet 密钥，使用 cryptography 库。
"""

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

_PREFIX = 'enc:v1:'


def _fernet() -> Fernet:
    from django.conf import settings
    secret = getattr(settings, 'SECRET_KEY', 'insecure-dev-key')
    # 派生 32 字节 base64 密钥（Fernet 要求 urlsafe base64 编码的 32 字节）
    digest = hashlib.sha256(('user-key:' + secret).encode('utf-8')).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    """加密明文密钥，返回带前缀的密文"""
    if not plaintext:
        return ''
    token = _fernet().encrypt(plaintext.encode('utf-8')).decode('utf-8')
    return _PREFIX + token


def decrypt_secret(ciphertext: str) -> str:
    """解密密钥，失败时返回空串（避免崩溃）"""
    if not ciphertext:
        return ''
    if not ciphertext.startswith(_PREFIX):
        # 历史明文兜底（理论上不应存在）
        return ciphertext
    try:
        payload = ciphertext[len(_PREFIX):]
        return _fernet().decrypt(payload.encode('utf-8')).decode('utf-8')
    except (InvalidToken, ValueError, TypeError) as e:
        logger.error('[API密钥] 解密失败: %r', e)
        return ''


def mask_key(plaintext: str, keep_last: int = 4) -> str:
    """掩码显示密钥：sk-****abcd（保留末尾 keep_last 位）"""
    if not plaintext:
        return ''
    visible = plaintext[-keep_last:]
    return f"sk-****{visible}"

# -*- coding: utf-8 -*-
"""转换私钥格式 PKCS#8 -> PKCS#1"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from auth_app.alipay_client import get_alipay_config

cfg = get_alipay_config()
key = cfg['app_private_key']
print(f'私钥前20字符: {key[:20]}')

try:
    from cryptography.hazmat.primitives.serialization import load_pem_private_key
    from cryptography.hazmat.primitives import serialization

    pem = f'-----BEGIN PRIVATE KEY-----\n{key}\n-----END PRIVATE KEY-----'
    private_key = load_pem_private_key(pem.encode(), password=None)

    pkcs1_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()
    )

    print('\n=== 转换成功！PKCS#1 私钥 ===')
    decoded = pkcs1_pem.decode()
    print(decoded)

    # 提取纯密钥部分（去掉PEM头尾和换行）
    lines = decoded.strip().split('\n')
    pure_key = ''.join(line for line in lines if not line.startswith('-----'))
    print(f'\n=== 纯密钥（用于 .env） ===')
    print(pure_key)

except Exception as e:
    print(f'转换失败: {type(e).__name__}: {e}')

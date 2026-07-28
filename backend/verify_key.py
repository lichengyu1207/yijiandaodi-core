# -*- coding: utf-8 -*-
"""验证 .env 中的私钥是否有效"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from auth_app.alipay_client import get_alipay_config

cfg = get_alipay_config()
key = cfg['app_private_key']
print(f'密钥长度: {len(key)}')
print(f'前10字符: {key[:10]}')

# 尝试多种方式加载
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

# 方式1: PKCS#1 (RSA PRIVATE KEY)
try:
    pem1 = f'-----BEGIN RSA PRIVATE KEY-----\n{key}\n-----END RSA PRIVATE KEY-----'
    pk1 = serialization.load_pem_private_key(pem1.encode(), password=None)
    print('\n✅ PKCS#1 格式加载成功！')
    print(f'   key size: {pk1.key_size} bits')
except Exception as e:
    print(f'\n❌ PKCS#1 失败: {e}')

# 方式2: PKCS#8 (PRIVATE KEY) - 原始密钥
try:
    # 从原始 .env 读取原始 PKCS#8 密钥
    original_pkcs8 = "MIIEwAIBADANBgkqhkiG9w0BAQEFAASCBKowggSmAgEAAoIBAQCqPokq/yH1Cto5Rn5lVF8OEzRuwsxZvnd3KafjD8bV5xujD+YOr/ti4mzbMh2S7rDuLgSEnTFNRg9o9cSCodY2Iwc5nHp73RbJu420yTiY12EHPwjqWIh15zxY5mABSi+0W6tcbBhqpDMvK3/sWgCs7O7VcGU/S8nCfX4DJwMDBnLxKp/ldZ75WPKfUF3TCs6B7jni1dVxAVT3sOq17+3rukJ8V9kpV3pyfaZq09s/NUbMrFuEUYa/D/cwb75FY5OjQlP3qDKwGQaZLwc8ZaEjviyFTE3Yo1uJS32RMWdPzK2+yFj+CP/AuIkSEKl75/4R/OI7Cra8YypWtW8fnvKzAgMBAAECggEBAIlBngmiZVhRBZwD78f2fCS26yEZwPPiEiNq3Ea+44p1p9yR5uOUktMoxqb7AskB1HhTdaUNr0Aj6iyvaV4A6NoA58RVGpNerw66Pgex7AWeMEZNVfzKoEqewhLSujiP/WImPkRnilAATpwLMDn4Xm8NH4nJ8ndTvTknQD9+Znk6lma4GCUqHC3fYJz+CzmQCqmPMJ24hamULSBQ9A3ulGHPQ599wZzVdmEyDHq603avQ74ijj3RjomqTWotjLcLnF0BgGx5lr7ZmoXzKIWk7unoo/fGic1V8WW4/Am1yX6X0U5vIhoYng5k8kBiCFP2fUrHlS+tBeJz4ImNa9GAeeECgYEA9yEr1pVaZkK8nRO76fh5OeK5B3VWrfc6qAzemQAtXAjJ33fjuNDN0qRFXCIUGujAdL969yRNgiwsHcP3OHC56VUE4o7VKGSBOt1gzCu92Y8FxHpx+oclc9me7y3Qjx3MZZG68CdJTFUKvAW4z47NZsLeNNJ9Y8vnQd4iEa6sSxsCgYEAsFrhK2iImH+/gal4aJ2D/AGjteWtG243eSkeP4l2yGt9/Uw/8zd4Yc1Ep/uP19GmwrwMJtANaloBdOqwIRwp5VWHDQzgPeRzcSdYwbGoRWbFxP8bKcwcOe/AjD5LqAZGAvp/Xvfu/zrxbKBWTCRmlWdXMIl6RoxlryNXt2iJGEkCgYEA02Wnt2aJLuK1r3RbEZjAMlkUSCICpMvQfEKOA7lYE9tcvHE09jp/ZkmpH1fzdNVXFEdbq599QfYBQvEIQFqFXeihRiBCjMv0k+MdU2mzfDBREbJgX5tN2Vz2DMlXF6W428WecKJanBY/GXmXjs0sPVRCelL4ee7Jgtm+sPuHXLMCgYEAhssvyCoCHe2mxshtzCh5NSlbpDCE+65moCkZgZ7kN5RRnEWnq5L+ZGKs02ioLWGFgNqSvyfO2TcqXd7z+Jq6OxwAOa1ZyHTQ9/AHGyVbZJCFIWmLrYrhGDd0iL0kvqzs3mHw8Pm4p0S6OzjiPRilgBSYw/SQjVPKdO8ioIE6KGECgYEA1xXvPobH6LwsAhpcRFS9Lk2uQYMtFsgXB74R2NdkHh04QTwt87aAIRzzJRoLDYx2UxJwY4WVGtVHelGIgre++gi7Hjy/pdq1m2lPoXVYA+BZKyT6nbzOhqAbl2rp5yPq9YiqqBUa9cgFB1n597l/4uAHQrMfJpPPaDhSCqHzw3o="
    pem2 = f'-----BEGIN PRIVATE KEY-----\n{original_pkcs8}\n-----END PRIVATE KEY-----'
    pk2 = serialization.load_pem_private_key(pem2.encode(), password=None)
    print('✅ 原始 PKCS#8 加载成功！')
    
    # 转换为 PKCS#1
    pkcs1_pem = pk2.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()
    )
    print('✅ 转换为 PKCS#1 成功！')
    print(pkcs1_pem.decode())
    
except Exception as e:
    print(f'❌ PKCS#8 也失败: {e}')

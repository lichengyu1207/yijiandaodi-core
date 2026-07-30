# -*- coding: utf-8 -*-
"""定位支付宝签名错误"""
import os, sys, django, traceback
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from auth_app.alipay_client import AlipayService, _alipay_sdk_available, create_client
print(f'SDK available: {_alipay_sdk_available}')

try:
    client, cfg = create_client()
    print(f'Client created OK')
    print(f'server_url: {cfg["server_url"]}')
    print(f'app_id: {cfg["app_id"]}')
    print(f'private_key length: {len(cfg["app_private_key"])}')
    print(f'public_key length: {len(cfg["alipay_public_key"])}')
    
    from alipay.aop.api.request.AlipayTradePagePayRequest import AlipayTradePagePayRequest
    from alipay.aop.api.domain.AlipayTradePagePayModel import AlipayTradePagePayModel
    
    request = AlipayTradePagePayRequest()
    model = AlipayTradePagePayModel()
    
    # 逐个设置字段，找出哪个导致问题
    model.out_trade_no = 'TEST202606200001'
    model.total_amount = '0.01'  # 最小金额测试
    model.subject = '测试订单'
    model.body = '测试描述'
    model.product_code = 'FAST_INSTANT_TRADE_PAY'
    
    print(f'\nModel fields set OK')
    print(f'out_trade_no: {model.out_trade_no}')
    print(f'total_amount: {model.total_amount} (type: {type(model.total_amount).__name__})')
    
    request.biz_model = model
    request.return_url = cfg.get('return_url', '')
    request.notify_url = cfg.get('notify_url', '')
    
    print(f'\nCalling page_execute...')
    html_form = client.page_execute(request)
    print(f'SUCCESS! HTML length: {len(html_form)}')
    print(f'Preview: {html_form[:200]}...')
    
except Exception as e:
    print(f'\nERROR: {type(e).__name__}: {e}')
    traceback.print_exc()

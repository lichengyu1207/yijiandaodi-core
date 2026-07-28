# -*- coding: utf-8 -*-
"""测试订单创建和支付宝支付链路"""
import os, sys, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from auth_app.payment_models import PaymentOrder
from auth_app.alipay_client import AlipayService, _alipay_sdk_available

print(f'=== 支付宝SDK状态: {"已安装" if _alipay_sdk_available else "未安装"} ===')

# 检查现有订单
orders = PaymentOrder.objects.all()[:5]
print(f'\n=== 现有订单 ({PaymentOrder.objects.count()}条) ===')
for o in orders:
    print(f'  [{o.order_no}] {o.subject} ¥{o.amount} | {o.status}')

# 直接调用后端逻辑（绕过HTTP层）
from datetime import timedelta
from django.utils import timezone
from decimal import Decimal
from django.contrib.auth import get_user_model
User = get_user_model()
user = User.objects.get(username='admin')

order_type = 'vip_yearly_199'
price_map = {
    'vip_yearly_199': ('199.00', '年度会员(¥199)♦超值'),
    'vip_yearly_599': ('599.00', '年度会员专享(¥599)'),
}
amount_str, subject = price_map[order_type]

import uuid
order_no = 'YJD' + timezone.now().strftime('%Y%m%d%H%M%S') + str(uuid.uuid4())[:8].upper()
expire_time = timezone.now() + timedelta(minutes=30)

order = PaymentOrder.objects.create(
    order_no=order_no,
    user=user,
    order_type=order_type,
    amount=amount_str,
    original_amount=amount_str,
    discount_amount='0.00',
    subject=subject,
    description=subject + ' - 一鉴到底AI检测平台',
    expire_at=expire_time,
    status='pending',
)

print(f'\n=== 创建订单成功 ===')
print(f'order_no: {order.order_no}')
print(f'subject: {order.subject}')
print(f'amount: ¥{order.amount}')
print(f'status: {order.status}')

# 测试支付宝 page_pay
if _alipay_sdk_available:
    try:
        from django.conf import settings as dj_settings
        
        html_form = AlipayService.page_pay(
            order_no=order.order_no,
            total_amount=str(order.amount),
            subject=order.subject,
            body=order.description,
            return_url=getattr(dj_settings, 'ALIPAY_RETURN_URL', ''),
            notify_url=getattr(dj_settings, 'ALIPAY_NOTIFY_URL', ''),
        )
        
        print(f'\n=== 支付宝page_pay测试 ===')
        print(f'payment_html长度: {len(html_form)} 字符')
        print(f'HTML预览 (前200字符):')
        print(html_form[:200] + '...')
        
        # 检查关键信息
        if 'form' in html_form.lower():
            print('\n✅ 支付表单生成成功！前端可渲染并跳转至支付宝')
        else:
            print('\n⚠️ 返回内容可能不是标准表单')
            
    except Exception as e:
        print(f'\n❌ 支付宝page_pay失败:')
        print(f'   错误: {type(e).__name__}: {e}')
else:
    print('\n⚠️ 支付宝SDK未安装，无法生成支付链接')

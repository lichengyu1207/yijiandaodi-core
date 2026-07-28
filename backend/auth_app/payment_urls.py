from django.urls import path

from .payment_views import HotnessViewSet, PaymentViewSet

hotness_viewset = HotnessViewSet.as_view({'get': 'top_skills'})
refresh_hotness = HotnessViewSet.as_view({'post': 'refresh-hotness'})

quota_view = PaymentViewSet.as_view({'get': 'quota'})
use_quota_view = PaymentViewSet.as_view({'post': 'use-quota'})
create_order_view = PaymentViewSet.as_view({'post': 'create-order'})
mock_pay_view = PaymentViewSet.as_view({'post': 'mock-pay'})
my_orders_view = PaymentViewSet.as_view({'get': 'my-orders'})
first_order_promo_view = PaymentViewSet.as_view({'get': 'first-order-promo'})
claim_first_order_coupon_view = PaymentViewSet.as_view({'post': 'claim-first-order-coupon'})
apply_first_order_discount_view = PaymentViewSet.as_view({'post': 'apply-first-order-discount'})

# 支付宝真实支付接口
alipay_page_pay_view = PaymentViewSet.as_view({'post': 'alipay-page-pay'})
alipay_wap_pay_view = PaymentViewSet.as_view({'post': 'alipay-wap-pay'})
alipay_notify_view = PaymentViewSet.as_view({'post': 'alipay-notify'})
alipay_return_view = PaymentViewSet.as_view({'get': 'alipay-return'})
alipay_query_view = PaymentViewSet.as_view({'post': 'alipay-query'})
alipay_refund_view = PaymentViewSet.as_view({'post': 'alipay-refund'})

urlpatterns = [
    path('hotness/top-skills/', hotness_viewset, name='hotness-top-skills'),
    path('hotness/refresh-hotness/', refresh_hotness, name='hotness-refresh'),
    path('quota/', quota_view, name='payment-quota'),
    path('use-quota/', use_quota_view, name='payment-use-quota'),
    path('create-order/', create_order_view, name='payment-create-order'),
    path('mock-pay/', mock_pay_view, name='payment-mock-pay'),
    path('my-orders/', my_orders_view, name='payment-my-orders'),
    path('first-order-promo/', first_order_promo_view, name='first-order-promo'),
    path('claim-first-order-coupon/', claim_first_order_coupon_view, name='claim-first-order-coupon'),
    path('apply-first-order-discount/', apply_first_order_discount_view, name='apply-first-order-discount'),
    # 支付宝支付接口
    path('alipay-page-pay/', alipay_page_pay_view, name='alipay-page-pay'),
    path('alipay-wap-pay/', alipay_wap_pay_view, name='alipay-wap-pay'),
    path('alipay-notify/', alipay_notify_view, name='alipay-notify'),
    path('alipay-return/', alipay_return_view, name='alipay-return'),
    path('alipay-query/', alipay_query_view, name='alipay-query'),
    path('alipay-refund/', alipay_refund_view, name='alipay-refund'),
]

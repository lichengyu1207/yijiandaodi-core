"""套餐/计费实时挂钩 URL 路由（需求 4.2.3 两级计费）"""

from django.urls import path

from . import billing_views

urlpatterns = [
    path('summary/', billing_views.billing_summary, name='billing-summary'),
    path('monthly-detail/', billing_views.monthly_bill, name='billing-monthly-detail'),
    path('redeem/', billing_views.redeem_code, name='billing-redeem'),
    path('trial/', billing_views.claim_trial, name='billing-trial'),
    path('redemptions/', billing_views.list_redemption_codes, name='billing-redemptions'),
    path('redemptions/generate/', billing_views.generate_redemption_codes, name='billing-redemptions-generate'),
]

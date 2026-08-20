"""套餐/计费实时挂钩 URL 路由（需求 4.2.3 两级计费）"""

from django.urls import path

from . import billing_views

urlpatterns = [
    path('summary/', billing_views.billing_summary, name='billing-summary'),
    path('monthly-detail/', billing_views.monthly_bill, name='billing-monthly-detail'),
]

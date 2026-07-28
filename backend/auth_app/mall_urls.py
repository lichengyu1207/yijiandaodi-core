from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .mall_views import (
    ProductViewSet,
    OrderViewSet,
    PaymentViewSet,
    WithdrawalViewSet,
    HotContentViewSet,
    FeedbackViewSet,
    BusinessInquiryViewSet,
)

router = DefaultRouter()
router.register(r'mall-products', ProductViewSet, basename='mall-product')
router.register(r'mall-orders', OrderViewSet, basename='mall-order')
router.register(r'mall-payments', PaymentViewSet, basename='mall-payment')
router.register(r'mall-withdrawals', WithdrawalViewSet, basename='mall-withdrawal')
router.register(r'hot-templates', HotContentViewSet, basename='hot-template')
router.register(r'feedback', FeedbackViewSet, basename='feedback')
router.register(r'inquiries', BusinessInquiryViewSet, basename='business-inquiry')

urlpatterns = [
    path('', include(router.urls)),
]

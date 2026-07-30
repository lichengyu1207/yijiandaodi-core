from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .function_card_views import FunctionCardViewSet

router = DefaultRouter()
router.register(r'function-cards', FunctionCardViewSet, basename='function-card')

urlpatterns = [
    path('', include(router.urls)),
]

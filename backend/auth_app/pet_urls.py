"""
桌宠交互记录路由
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .pet_views import PetInteractionViewSet

router = DefaultRouter()
router.register(r'pet-interactions', PetInteractionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
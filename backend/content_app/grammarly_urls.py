from django.urls import path, include
from rest_framework.routers import DefaultRouter
from content_app import grammarly_views

router = DefaultRouter()
router.register(r'grammar-check', grammarly_views.GrammarCheckViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

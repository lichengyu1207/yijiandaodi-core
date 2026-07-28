from django.urls import path, include
from rest_framework.routers import DefaultRouter
from content_app import tipping_views

router = DefaultRouter()
router.register(r'tip', tipping_views.TipDonationViewSet, basename='tip-donation')
router.register(r'application', tipping_views.CreatorApplicationViewSet, basename='creator-application')

urlpatterns = [
    path('', include(router.urls)),
]

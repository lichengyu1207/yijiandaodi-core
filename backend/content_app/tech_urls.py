from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .tech_views import AIContentProvenanceViewSet, DeepfakeVideoDetectionViewSet

router = DefaultRouter()
router.register(r'provenance', AIContentProvenanceViewSet, basename='tech-provenance')
router.register(r'deepfake', DeepfakeVideoDetectionViewSet, basename='tech-deepfake')

urlpatterns = [
    path('', include(router.urls)),
]

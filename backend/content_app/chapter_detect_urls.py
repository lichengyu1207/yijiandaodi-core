from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import chapter_detect_views

router = DefaultRouter()
router.register(r'paper-submission', chapter_detect_views.PaperSubmissionViewSet, basename='chapter-detect-paper')

urlpatterns = [
    path('', include(router.urls)),
]

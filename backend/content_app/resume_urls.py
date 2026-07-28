from django.urls import path, include
from rest_framework.routers import DefaultRouter
from content_app import resume_views

router = DefaultRouter()
router.register(r'resume-analysis', resume_views.ResumeAnalysisViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

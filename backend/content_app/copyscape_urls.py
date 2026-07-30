from django.urls import path, include
from rest_framework.routers import DefaultRouter
from content_app import copyscape_views

router = DefaultRouter()
router.register(r'plagiarism-scan', copyscape_views.PlagiarismScanViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

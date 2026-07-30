from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .developer_views import (
    DeveloperViewSet,
    OpenDetectAPIView,
    OpenRAGAPIView,
    DeveloperApplicationViewSet,
)

router = DefaultRouter()
router.register(r'developer', DeveloperViewSet, basename='developer')
router.register(r'dev-application', DeveloperApplicationViewSet, basename='developer-application')

urlpatterns = [
    path('', include(router.urls)),
    path('detect/text/', OpenDetectAPIView.as_view({'post': 'detect_text'}), name='open-detect-text'),
    path('rag/search/', OpenRAGAPIView.as_view({'post': 'rag_search'}), name='open-rag-search'),
    path('rag/ask/', OpenRAGAPIView.as_view({'post': 'rag_ask'}), name='open-rag-ask'),
]

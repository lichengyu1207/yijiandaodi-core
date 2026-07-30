from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .rag_views import (
    KnowledgeCategoryViewSet,
    KnowledgeDocumentViewSet,
    RAGSearchViewSet,
    RetrievalLogViewSet,
    RAGOperationLogViewSet,
)

router = DefaultRouter()
router.register(r'categories', KnowledgeCategoryViewSet, basename='kb-category')
router.register(r'documents', KnowledgeDocumentViewSet, basename='kb-document')
router.register(r'search', RAGSearchViewSet, basename='rag-search')
router.register(r'logs', RetrievalLogViewSet, basename='retrieval-log')
router.register(r'operation-logs', RAGOperationLogViewSet, basename='rag-operation-log')

urlpatterns = [
    path('', include(router.urls)),
]

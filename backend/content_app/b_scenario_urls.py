from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .b_scenario_views import (
    BScenarioMedicalReportViewSet,
    BScenarioLegalDocumentViewSet,
    BScenarioFinancialStatementViewSet,
    BScenarioDesignDraftViewSet,
)

router = DefaultRouter()
router.register(r'medical', BScenarioMedicalReportViewSet, basename='bscenario-medical')
router.register(r'legal', BScenarioLegalDocumentViewSet, basename='bscenario-legal')
router.register(r'financial', BScenarioFinancialStatementViewSet, basename='bscenario-financial')
router.register(r'design', BScenarioDesignDraftViewSet, basename='bscenario-design')

urlpatterns = [
    path('', include(router.urls)),
]

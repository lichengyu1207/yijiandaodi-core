from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import data_classification_views as dc_views

router = DefaultRouter()
router.register(r'levels', dc_views.DataSensitivityLevelViewSet, basename='dc-levels')
router.register(r'categories', dc_views.DataCategoryViewSet, basename='dc-categories')
router.register(r'field-tags', dc_views.DataFieldTagViewSet, basename='dc-field-tags')
router.register(r'records', dc_views.DataClassificationRecordViewSet, basename='dc-records')
router.register(r'export-approvals', dc_views.DataExportApprovalViewSet, basename='dc-exports')
router.register(r'dpo', dc_views.DataProtectionOfficerViewSet, basename='dc-dpo')

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/', dc_views.DataComplianceDashboardView.as_view(), name='dc-dashboard'),
]

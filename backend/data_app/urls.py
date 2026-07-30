from django.urls import path
from . import views

app_name = 'data'

urlpatterns = [
    path('overview/', views.DataOverviewView.as_view(), name='overview'),
    path('export/', views.DataExportView.as_view(), name='export'),
    path('export-history/', views.ExportHistoryListView.as_view(), name='export-history'),
    path('analysis/', views.AnalysisView.as_view(), name='analysis'),
    path('config/', views.ConfigListView.as_view(), name='config'),
    path('profile/', views.ProfileUpdateView.as_view(), name='profile'),
]

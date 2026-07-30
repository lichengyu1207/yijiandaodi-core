from django.urls import path
from .stats_views import StatsViewSet

urlpatterns = [
    path('overview/', StatsViewSet.as_view({'get': 'overview'}), name='stats-overview'),
    path('skills/', StatsViewSet.as_view({'get': 'skills'}), name='stats-skills'),
    path('areas/', StatsViewSet.as_view({'get': 'areas'}), name='stats-areas'),
    path('revenue/', StatsViewSet.as_view({'get': 'revenue'}), name='stats-revenue'),
    path('revenue-detail/', StatsViewSet.as_view({'get': 'revenue_detail'}), name='stats-revenue-detail'),
    path('refresh-stats/', StatsViewSet.as_view({'post': 'refresh_stats'}), name='stats-refresh'),
]

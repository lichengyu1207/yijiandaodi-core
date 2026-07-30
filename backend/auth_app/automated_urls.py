"""自动化研判URL路由"""

from django.urls import path
from . import automated_views

urlpatterns = [
    path('analysis/', automated_views.automated_analysis, name='automated_analysis'),
    path('batch/', automated_views.batch_analysis, name='batch_analysis'),
    path('metrics/', automated_views.efficiency_metrics, name='efficiency_metrics'),
    path('history/', automated_views.analysis_history, name='analysis_history'),
    path('comparison/', automated_views.expert_comparison, name='expert_comparison'),
]
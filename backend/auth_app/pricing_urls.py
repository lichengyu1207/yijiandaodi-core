"""SaaS化定价URL路由"""

from django.urls import path
from . import pricing_views

urlpatterns = [
    path('calculate/', pricing_views.calculate_usage_cost, name='calculate_usage_cost'),
    path('compare/', pricing_views.compare_cost, name='compare_cost'),
    path('plans/', pricing_views.pricing_plans, name='pricing_plans'),
    path('metrics/', pricing_views.cost_metrics, name='cost_metrics'),
    path('usage-history/', pricing_views.usage_history, name='usage_history'),
    path('comparison-history/', pricing_views.cost_comparison_history, name='cost_comparison_history'),
    path('pressure-analysis/', pricing_views.cost_pressure_analysis, name='cost_pressure_analysis'),
]
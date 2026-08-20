"""消费费用分析 URL 路由（P1-2 计费落库）"""

from django.urls import path
from . import usage_views

urlpatterns = [
    path('cost-breakdown/', usage_views.cost_breakdown, name='usage-cost-breakdown'),
    path('trend-analysis/', usage_views.trend_analysis, name='usage-trend-analysis'),
]

"""Inline编译执行引擎URL路由"""

from django.urls import path
from . import inline_views

urlpatterns = [
    path('intercept/', inline_views.inline_intercept, name='inline_intercept'),
    path('batch/', inline_views.batch_inline_intercept, name='batch_inline_intercept'),
    path('performance/', inline_views.performance_report, name='performance_report'),
    path('history/', inline_views.interception_history, name='interception_history'),
    path('comparison/', inline_views.engine_comparison, name='engine_comparison'),
    path('architecture/', inline_views.architecture_features, name='architecture_features'),
]
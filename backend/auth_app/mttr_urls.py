"""MTTR压缩URL路由"""

from django.urls import path
from . import mttr_views

urlpatterns = [
    path('intercept/', mttr_views.inline_intercept, name='inline_intercept'),
    path('disposal/', mttr_views.auto_disposal, name='auto_disposal'),
    path('batch/', mttr_views.batch_inline_intercept, name='batch_inline_intercept'),
    path('metrics/', mttr_views.mttr_metrics, name='mttr_metrics'),
    path('history/', mttr_views.interception_history, name='interception_history'),
    path('disposal-history/', mttr_views.disposal_history, name='disposal_history'),
    path('comparison/', mttr_views.mttr_comparison, name='mttr_comparison'),
]
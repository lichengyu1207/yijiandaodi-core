"""
误报检测URL路由
"""

from django.urls import path
from . import fp_views

urlpatterns = [
    path('detect/', fp_views.detect_false_positive, name='detect_fp'),
    path('batch-detect/', fp_views.batch_detect_fp, name='batch_detect_fp'),
    path('baseline/update/', fp_views.update_baseline, name='update_fp_baseline'),
    path('statistics/', fp_views.get_fp_statistics, name='get_fp_statistics'),
    path('features/', fp_views.get_fp_features, name='get_fp_features'),
    path('features/add/', fp_views.add_fp_feature, name='add_fp_feature'),
]
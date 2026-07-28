from django.urls import path

from .skill_config_views import SkillConfigViewSet

public_list = SkillConfigViewSet.as_view({'get': 'public_list'})
public_search = SkillConfigViewSet.as_view({'get': 'public_search'})
categories = SkillConfigViewSet.as_view({'get': 'categories'})
stats = SkillConfigViewSet.as_view({'get': 'stats'})

urlpatterns = [
    path('public-list/', public_list, name='skillconfig-public-list'),
    path('public-search/', public_search, name='skillconfig-public-search'),
    path('categories/', categories, name='skillconfig-categories'),
    path('stats/', stats, name='skillconfig-stats'),
    path('admin/', SkillConfigViewSet.as_view({'get': 'list', 'post': 'create'}), name='skillconfig-admin-list'),
    path('admin/<int:pk>/', SkillConfigViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='skillconfig-admin-detail'),
    path('admin/batch-import/', SkillConfigViewSet.as_view({'post': 'batch_import'}), name='skillconfig-admin-batch-import'),
    path('admin/<int:pk>/toggle-status/', SkillConfigViewSet.as_view({'post': 'toggle_status'}), name='skillconfig-admin-toggle-status'),
    path('admin/batch-toggle/', SkillConfigViewSet.as_view({'post': 'batch_toggle'}), name='skillconfig-admin-batch-toggle'),
    path('admin/batch-delete/', SkillConfigViewSet.as_view({'delete': 'batch_delete'}), name='skillconfig-admin-batch-delete'),
]

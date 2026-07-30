"""
原创作品审核API路由
"""

from django.urls import path
from . import original_work_views

urlpatterns = [
    # 用户端
    path('upload/', original_work_views.upload_work, name='upload_work'),
    path('my-works/', original_work_views.my_works, name='my_works'),
    path('work/<uuid:work_id>/', original_work_views.work_detail, name='work_detail'),
    path('work/<uuid:work_id>/certificate/', original_work_views.declaration_certificate, name='declaration_certificate'),

    # 管理员
    path('admin/works/', original_work_views.admin_work_list, name='admin_work_list'),
    path('admin/work/<uuid:work_id>/review/', original_work_views.admin_review_work, name='admin_review_work'),

    # 公开验证
    path('verify/<str:declaration_number>/', original_work_views.verify_declaration, name='verify_declaration'),
]
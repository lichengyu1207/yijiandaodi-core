from django.urls import path
from . import enterprise_views

app_name = 'enterprise'

urlpatterns = [
    path('my-enterprise', enterprise_views.EnterpriseAdminViewSet.as_view({'get': 'my_enterprise'}), name='my-enterprise'),
    path('dashboard', enterprise_views.EnterpriseAdminViewSet.as_view({'get': 'dashboard'}), name='dashboard'),
    path('create', enterprise_views.EnterpriseAdminViewSet.as_view({'post': 'create_enterprise'}), name='create'),
    path('members/list', enterprise_views.EnterpriseAdminViewSet.as_view({'get': 'list_members'}), name='list-members'),
    path('members/add', enterprise_views.EnterpriseAdminViewSet.as_view({'post': 'add_member'}), name='add-member'),
    path('members/remove', enterprise_views.EnterpriseAdminViewSet.as_view({'post': 'remove_member'}), name='remove-member'),
    path('members/role', enterprise_views.EnterpriseAdminViewSet.as_view({'post': 'update_member_role'}), name='update-role'),
    path('keys/list', enterprise_views.EnterpriseAdminViewSet.as_view({'get': 'list_api_keys'}), name='list-keys'),
    path('keys/create', enterprise_views.EnterpriseAdminViewSet.as_view({'post': 'create_api_key'}), name='create-key'),
    path('keys/revoke', enterprise_views.EnterpriseAdminViewSet.as_view({'post': 'revoke_api_key'}), name='revoke-key'),
    path('recharge/submit', enterprise_views.EnterpriseAdminViewSet.as_view({'post': 'submit_recharge'}), name='submit-recharge'),
    path('recharge/history', enterprise_views.EnterpriseAdminViewSet.as_view({'get': 'recharge_history'}), name='recharge-history'),
    path('usage/logs', enterprise_views.EnterpriseAdminViewSet.as_view({'get': 'usage_logs'}), name='usage-logs'),

    path('admin/enterprises', enterprise_views.EnterpriseSuperAdminViewSet.as_view({'get': 'list_all_enterprises'}), name='admin-list'),
    path('admin/recharge/approve', enterprise_views.EnterpriseSuperAdminViewSet.as_view({'post': 'approve_recharge'}), name='admin-approve'),
    path('admin/recharge/reject', enterprise_views.EnterpriseSuperAdminViewSet.as_view({'post': 'reject_recharge'}), name='admin-reject'),

    path('copyright/list', enterprise_views.SoftwareCopyrightViewSet.as_view({'get': 'list_applications'}), name='copyright-list'),
    path('copyright/create', enterprise_views.SoftwareCopyrightViewSet.as_view({'post': 'create_application'}), name='copyright-create'),
    path('copyright/submit', enterprise_views.SoftwareCopyrightViewSet.as_view({'post': 'submit_application'}), name='copyright-submit'),
]

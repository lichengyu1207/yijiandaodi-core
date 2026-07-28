from django.urls import path

from .workflow_views import WorkflowViewSet, WorkflowExecutionViewSet

wf_list = WorkflowViewSet.as_view({
    'get': 'list',
    'post': 'create',
})
wf_detail = WorkflowViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy',
    'post': 'publish',
    'post': 'execute',
})
wf_save_graph = WorkflowViewSet.as_view({'post': 'save_graph'})
wf_templates = WorkflowViewSet.as_view({'get': 'templates'})
wf_duplicate = WorkflowViewSet.as_view({'post': 'duplicate'})

exec_list = WorkflowExecutionViewSet.as_view({'get': 'list'})
exec_detail = WorkflowExecutionViewSet.as_view({
    'get': 'retrieve',
    'post': 'stop',
})

urlpatterns = [
    path('workflows/', wf_list, name='workflow-list'),
    path('workflows/save-graph/', wf_save_graph, name='workflow-save-graph'),
    path('workflows/templates/', wf_templates, name='workflow-templates'),
    path('workflows/duplicate/', wf_duplicate, name='workflow-duplicate'),
    path('workflows/<uuid:pk>/', wf_detail, name='workflow-detail'),
    path('workflows/<uuid:pk>/publish/', wf_detail, name='workflow-publish'),
    path('workflows/<uuid:pk>/execute/', wf_detail, name='workflow-execute'),
    path('executions/', exec_list, name='execution-list'),
    path('executions/<uuid:pk>/', exec_detail, name='execution-detail'),
    path('executions/<uuid:pk>/stop/', exec_detail, name='execution-stop'),
]

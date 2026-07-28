from django.urls import path

from . import views

app_name = 'p2p'

urlpatterns = [
    path('nodes/register', views.NodeRegisterView.as_view(), name='p2p-node-register'),
    # 具体路径必须在参数化路径之前，否则 discover/offline 等会被 <str:node_id> 匹配
    path('nodes/discover', views.NodeDiscoverView.as_view(), name='p2p-node-discover'),
    path('nodes/<str:node_id>', views.NodeDetailView.as_view(), name='p2p-node-detail'),
    path('nodes/<str:node_id>/offline', views.NodeOfflineView.as_view(), name='p2p-node-offline'),
    path('nodes/<str:node_id>/reputation', views.NodeReputationView.as_view(), name='p2p-node-reputation'),
    path('nodes/<str:node_id>/heartbeat', views.NodeHeartbeatView.as_view(), name='p2p-node-heartbeat'),
    path('nodes', views.NodeListView.as_view(), name='p2p-node-list'),
    path('network/topology', views.NetworkTopologyView.as_view(), name='p2p-network-topology'),
    path('tasks/dispatch', views.TaskDispatchView.as_view(), name='p2p-task-dispatch'),
    path('tasks/<str:task_id>', views.TaskDetailView.as_view(), name='p2p-task-detail'),
    path('tasks/<str:task_id>/status', views.TaskStatusView.as_view(), name='p2p-task-status'),
    path('tasks/<str:task_id>/shards/<str:shard_id>/result', views.ShardResultSubmitView.as_view(), name='p2p-shard-result'),
    path('tasks', views.TaskListView.as_view(), name='p2p-task-list'),
    path('tasks/<str:task_id>/cancel', views.TaskCancelView.as_view(), name='p2p-task-cancel'),
    path('tasks/<str:task_id>/transitions', views.TaskStateMachineView.as_view(), name='p2p-task-transitions'),

    # ── L2 工作流编排 API ───────────────────
    path('workflows', views.WorkflowCreateView.as_view(), name='p2p-workflow-create'),
    path('workflows/list', views.WorkflowListView.as_view(), name='p2p-workflow-list'),
    path('workflows/<str:workflow_id>', views.WorkflowStatusView.as_view(), name='p2p-workflow-status'),
    path('workflows/<str:workflow_id>/ready-tasks', views.WorkflowReadyTasksView.as_view(), name='p2p-workflow-ready'),

    # ── L3 安全网关 API ─────────────────────
    path('security/check', views.SecurityCheckView.as_view(), name='p2p-security-check'),
    path('security/verify-signature', views.SecurityVerifySignatureView.as_view(), name='p2p-security-verify-sig'),

    # ── 统一执行流水线 API (L3→L2→L4→L5→L6→L7) ──
    path('pipeline/execute', views.PipelineExecuteView.as_view(), name='p2p-pipeline-execute'),
    path('pipeline/summary', views.PipelineSummaryView.as_view(), name='p2p-pipeline-summary'),
    path('pipeline/tasks', views.PipelineTaskListView.as_view(), name='p2p-pipeline-tasks'),
    path('pipeline/cancel/<str:task_id>', views.PipelineCancelView.as_view(), name='p2p-pipeline-cancel'),
    path('pipeline/audit/<str:task_id>', views.PipelineAuditLogView.as_view(), name='p2p-pipeline-audit'),

    # ── Skill 生态 API ───────────────────────
    path('skills/list', views.SkillListView.as_view(), name='p2p-skill-list'),
    path('skills/<str:skill_id>/detail', views.SkillDetailView.as_view(), name='p2p-skill-detail'),
    path('skills/<str:skill_id>/download', views.SkillDownloadView.as_view(), name='p2p-skill-download'),
]

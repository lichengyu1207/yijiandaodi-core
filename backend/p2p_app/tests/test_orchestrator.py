"""
L2 DAG 编排引擎测试 - WorkflowOrchestrator 纯逻辑测试

覆盖:
- DAGNode (dataclass): 创建节点、默认值、自定义字段
- WorkflowOrchestrator:
  - create_workflow: 简单无依赖工作流、线性依赖链、WF-格式验证、初始状态
  - _validate_dag / DAGCycleError: 环形检测、合法DAG、未知依赖
  - create_workflow_from_template: code_audit(4)/content_verify(5)/ai_execute(4)、未知模板
  - start_workflow: PENDING→RUNNING、非PENDING异常
  - get_ready_tasks: 无依赖就绪、有依赖阻塞、优先级排序
  - mark_task_completed: 状态变更、下游触发、全部完成、重复标记、不存在节点
  - mark_task_failed: 失败状态、工作流不自动完成
  - cancel_workflow: CANCELLED状态、pending/running变skipped、已完成取消异常
  - is_workflow_complete: 全completed、部分failed+总数匹配、否则False
  - get_workflow_progress: 字段完整性、percentage计算
  - list_workflows: 全部返回、status_filter过滤
  - cleanup_workflow: 清理后不再存在
- 异常类: DAGCycleError / WorkflowNotFoundError / InvalidTransitionError
"""

import unittest

from p2p_app.services.orchestrator import (
    DAGNode,
    DAGCycleError,
    InvalidTransitionError,
    WorkflowNotFoundError,
    WorkflowOrchestrator,
    WorkflowStatus,
)


# ════════════════════════════════════════════════
# DAGNode dataclass 测试
# ════════════════════════════════════════════════

class TestDAGNode(unittest.TestCase):
    """DAGNode 数据类测试"""

    def test_create_node_with_defaults(self):
        """创建节点，验证所有默认值正确"""
        node = DAGNode(node_id="A", agent_role="executor")
        self.assertEqual(node.node_id, "A")
        self.assertEqual(node.agent_role, "executor")
        self.assertEqual(node.payload, {})
        self.assertEqual(node.dependencies, [])
        self.assertEqual(node.security_level, "normal")
        self.assertEqual(node.estimated_resources, {})
        self.assertEqual(node.priority, "normal")
        self.assertEqual(node.status, "pending")
        self.assertIsNone(node.result)
        self.assertIsNone(node.error)
        self.assertIsNone(node.started_at)
        self.assertIsNone(node.completed_at)

    def test_create_node_with_dependencies(self):
        """带 dependencies 的节点创建"""
        node = DAGNode(
            node_id="B",
            agent_role="auditor",
            dependencies=["A", "C"],
        )
        self.assertEqual(node.dependencies, ["A", "C"])
        # 其他字段仍为默认值
        self.assertEqual(node.security_level, "normal")

    def test_create_node_with_payload(self):
        """带 payload 的节点创建"""
        payload = {"task": "scan", "target": "repo"}
        node = DAGNode(
            node_id="S1",
            agent_role="executor",
            payload=payload,
        )
        self.assertEqual(node.payload, payload)

    def test_create_node_with_security_level(self):
        """带 security_level 的节点创建"""
        node = DAGNode(
            node_id="CRIT",
            agent_role="guard",
            security_level="critical",
        )
        self.assertEqual(node.security_level, "critical")

    def test_create_node_with_all_custom_fields(self):
        """同时指定所有自定义字段的完整节点"""
        node = DAGNode(
            node_id="FULL",
            agent_role="auditor",
            payload={"cmd": "run"},
            dependencies=["PREV"],
            security_level="high",
            estimated_resources={"cpu_cores": 4, "memory_mb": 2048},
            priority="critical",
            status="running",
            result={"output": "done"},
            error=None,
        )
        self.assertEqual(node.node_id, "FULL")
        self.assertEqual(node.agent_role, "auditor")
        self.assertEqual(node.payload, {"cmd": "run"})
        self.assertEqual(node.dependencies, ["PREV"])
        self.assertEqual(node.security_level, "high")
        self.assertEqual(node.estimated_resources, {"cpu_cores": 4, "memory_mb": 2048})
        self.assertEqual(node.priority, "critical")
        self.assertEqual(node.status, "running")
        self.assertEqual(node.result, {"output": "done"})


# ════════════════════════════════════════════════
# create_workflow 测试
# ════════════════════════════════════════════════

class TestCreateWorkflow(unittest.TestCase):
    """create_workflow 方法测试"""

    def setUp(self):
        self.orch = WorkflowOrchestrator()

    def test_create_independent_nodes_workflow(self):
        """创建简单无依赖的工作流（3个独立节点），验证 workflow_id 格式（WF-开头）"""
        nodes = [
            DAGNode(node_id="A", agent_role="executor"),
            DAGNode(node_id="B", agent_role="auditor"),
            DAGNode(node_id="C", agent_role="verifier"),
        ]
        wf_id = self.orch.create_workflow(name="independent", tasks=nodes)
        self.assertTrue(wf_id.startswith("WF-"))
        wf = self.orch.workflows[wf_id]
        self.assertEqual(len(wf["nodes"]), 3)

    def test_create_linear_dependency_chain(self):
        """创建带依赖链的线性工作流 A→B→C"""
        nodes = [
            DAGNode(node_id="A", agent_role="guard"),
            DAGNode(node_id="B", agent_role="auditor", dependencies=["A"]),
            DAGNode(node_id="C", agent_role="archiver", dependencies=["B"]),
        ]
        wf_id = self.orch.create_workflow(name="linear_chain", tasks=nodes)
        wf = self.orch.workflows[wf_id]
        self.assertEqual(len(wf["nodes"]), 3)
        # 验证依赖关系
        self.assertEqual(wf["nodes"]["A"].dependencies, [])
        self.assertEqual(wf["nodes"]["B"].dependencies, ["A"])
        self.assertEqual(wf["nodes"]["C"].dependencies, ["B"])

    def test_initial_status_is_pending(self):
        """验证工作流状态初始为 PENDING"""
        nodes = [DAGNode(node_id="X", agent_role="executor")]
        wf_id = self.orch.create_workflow(name="status_test", tasks=nodes)
        self.assertEqual(self.orch.workflows[wf_id]["status"], WorkflowStatus.PENDING.value)

    def test_nodes_correctly_stored(self):
        """验证 nodes 正确存储到工作流中"""
        nodes = [
            DAGNode(node_id="N1", agent_role="guard"),
            DAGNode(node_id="N2", agent_role="auditor"),
        ]
        wf_id = self.orch.create_workflow(name="storage_test", tasks=nodes)
        wf = self.orch.workflows[wf_id]
        self.assertIn("N1", wf["nodes"])
        self.assertIn("N2", wf["nodes"])
        self.assertIsInstance(wf["nodes"]["N1"], DAGNode)


# ════════════════════════════════════════════════
# _validate_dag / DAGCycleError 测试
# ════════════════════════════════════════════════

class TestDAGValidation(unittest.TestCase):
    """DAG 环路检测与校验测试"""

    def setUp(self):
        self.orch = WorkflowOrchestrator()

    def test_cycle_a_b_c_a_raises_dag_cycle_error(self):
        """环形依赖 A→B→C→A 应抛出 DAGCycleError"""
        nodes = [
            DAGNode(node_id="A", agent_role="executor", dependencies=["C"]),
            DAGNode(node_id="B", agent_role="executor", dependencies=["A"]),
            DAGNode(node_id="C", agent_role="executor", dependencies=["B"]),
        ]
        with self.assertRaises(DAGCycleError) as ctx:
            self.orch.create_workflow(name="cycle_abc", tasks=nodes)
        self.assertIn("cycle", str(ctx.exception).lower())

    def test_valid_linear_dag_no_exception(self):
        """合法 DAG 不应抛异常"""
        nodes = [
            DAGNode(node_id="A", agent_role="executor"),
            DAGNode(node_id="B", agent_role="executor", dependencies=["A"]),
            DAGNode(node_id="C", agent_role="executor", dependencies=["B"]),
        ]
        wf_id = self.orch.create_workflow(name="valid_linear", tasks=nodes)
        self.assertIsNotNone(wf_id)
        self.assertTrue(wf_id.startswith("WF-"))

    def test_unknown_dependency_raises_value_error(self):
        """依赖不存在的节点应抛出 ValueError"""
        nodes = [
            DAGNode(node_id="A", agent_role="executor"),
            DAGNode(node_id="B", agent_role="executor", dependencies=["NONEXISTENT_NODE"]),
        ]
        with self.assertRaises(ValueError) as ctx:
            self.orch.create_workflow(name="bad_dep", tasks=nodes)
        self.assertIn("unknown node", str(ctx.exception).lower())


# ════════════════════════════════════════════════
# create_workflow_from_template 测试
# ════════════════════════════════════════════════

class TestCreateWorkflowFromTemplate(unittest.TestCase):
    """create_workflow_from_template 方法测试"""

    def setUp(self):
        self.orch = WorkflowOrchestrator()

    def test_code_audit_template_has_4_nodes(self):
        """用 'code_audit' 模板创建，验证有 4 个节点"""
        wf_id = self.orch.create_workflow_from_template("code_audit")
        wf = self.orch.workflows[wf_id]
        self.assertEqual(len(wf["nodes"]), 4)
        expected = {"input_guard", "static_scan", "dynamic_scan", "audit_report"}
        self.assertEqual(set(wf["nodes"].keys()), expected)

    def test_content_verify_template_has_5_nodes(self):
        """用 'content_verify' 模板创建，验证有 5 个节点"""
        wf_id = self.orch.create_workflow_from_template("content_verify")
        wf = self.orch.workflows[wf_id]
        self.assertEqual(len(wf["nodes"]), 5)
        expected = {"extractor", "auditor", "verifier", "judge", "archiver"}
        self.assertEqual(set(wf["nodes"].keys()), expected)

    def test_ai_execute_template_has_4_nodes(self):
        """用 'ai_execute' 模板创建，验证有 4 个节点"""
        wf_id = self.orch.create_workflow_from_template("ai_execute")
        wf = self.orch.workflows[wf_id]
        self.assertEqual(len(wf["nodes"]), 4)
        expected = {"security_check", "sandbox_exec", "result_collect", "audit_log"}
        self.assertEqual(set(wf["nodes"].keys()), expected)

    def test_unknown_template_raises_value_error(self):
        """未知模板名应抛出 ValueError"""
        with self.assertRaises(ValueError) as ctx:
            self.orch.create_workflow_from_template("nonexistent_template")
        self.assertIn("Unknown template", str(ctx.exception))


# ════════════════════════════════════════════════
# start_workflow 测试
# ════════════════════════════════════════════════

class TestStartWorkflow(unittest.TestCase):
    """start_workflow 方法测试"""

    def setUp(self):
        self.orch = WorkflowOrchestrator()
        nodes = [DAGNode(node_id="A", agent_role="executor")]
        self.wf_id = self.orch.create_workflow(name="start_test", tasks=nodes)

    def test_pending_to_running(self):
        """从 PENDING 启动到 RUNNING"""
        self.orch.start_workflow(self.wf_id)
        self.assertEqual(
            self.orch.workflows[self.wf_id]["status"],
            WorkflowStatus.RUNNING.value,
        )

    def test_non_pending_state_raises_invalid_transition_error(self):
        """非 PENDING 状态启动应抛出 InvalidTransitionError"""
        self.orch.start_workflow(self.wf_id)  # PENDING -> RUNNING
        with self.assertRaises(InvalidTransitionError):
            self.orch.start_workflow(self.wf_id)  # RUNNING 再次 start


# ════════════════════════════════════════════════
# get_ready_tasks 测试
# ════════════════════════════════════════════════

class TestGetReadyTasks(unittest.TestCase):
    """get_ready_tasks 方法测试"""

    def setUp(self):
        self.orch = WorkflowOrchestrator()
        nodes = [
            DAGNode(node_id="ROOT", agent_role="executor", priority="normal"),
            DAGNode(node_id="HIGH_DEP", agent_role="auditor",
                    dependencies=["ROOT"], priority="high"),
            DAGNode(node_id="LOW_DEP", agent_role="verifier",
                    dependencies=["ROOT"], priority="low"),
            DAGNode(node_id="CRIT_DEP", agent_role="judge",
                    dependencies=["ROOT"], priority="critical"),
        ]
        self.wf_id = self.orch.create_workflow(name="ready_test", tasks=nodes)

    def test_no_dependency_node_immediately_ready(self):
        """无依赖的节点应该立即可用"""
        ready = self.orch.get_ready_tasks(self.wf_id)
        ready_ids = {n.node_id for n in ready}
        self.assertEqual(ready_ids, {"ROOT"})

    def test_dependent_node_not_ready_before_deps_done(self):
        """有未完成依赖的节点不应出现"""
        ready = self.orch.get_ready_tasks(self.wf_id)
        ready_ids = {n.node_id for n in ready}
        self.assertNotIn("HIGH_DEP", ready_ids)
        self.assertNotIn("LOW_DEP", ready_ids)
        self.assertNotIn("CRIT_DEP", ready_ids)

    def test_result_sorted_by_priority_critical_high_normal(self):
        """返回结果按 priority 排序（critical > high > normal > low）"""
        # 完成 ROOT，使三个子节点都变为就绪
        self.orch.mark_task_completed(self.wf_id, "ROOT")
        ready = self.orch.get_ready_tasks(self.wf_id)
        ready_ids = [n.node_id for n in ready]
        # critical(CRIT_DEP) > high(HIGH_DEP) > normal(LOW_DEP 实际是 low 但排在 normal 后面)
        # PRIORITY_ORDER: critical=0, high=1, normal=2, low=3
        self.assertEqual(ready_ids[0], "CRIT_DEP")   # critical first
        self.assertEqual(ready_ids[1], "HIGH_DEP")   # high second
        self.assertEqual(ready_ids[2], "LOW_DEP")     # low last


# ════════════════════════════════════════════════
# mark_task_completed 测试
# ════════════════════════════════════════════════

class TestMarkTaskCompleted(unittest.TestCase):
    """mark_task_completed 方法测试"""

    def setUp(self):
        self.orch = WorkflowOrchestrator()
        nodes = [
            DAGNode(node_id="A", agent_role="executor"),
            DAGNode(node_id="B", agent_role="auditor", dependencies=["A"]),
            DAGNode(node_id="C", agent_role="verifier", dependencies=["B"]),
        ]
        self.wf_id = self.orch.create_workflow(name="complete_test", tasks=nodes)
        self.orch.start_workflow(self.wf_id)

    def test_status_becomes_completed(self):
        """标记完成后状态变为 completed"""
        self.orch.mark_task_completed(self.wf_id, "A")
        self.assertEqual(self.orch.workflows[self.wf_id]["nodes"]["A"].status, "completed")

    def test_completion_triggers_downstream_readiness(self):
        """完成后触发下游就绪检查"""
        self.orch.mark_task_completed(self.wf_id, "A")
        ready = self.orch.get_ready_tasks(self.wf_id)
        ready_ids = {n.node_id for n in ready}
        self.assertIn("B", ready_ids)

    def test_all_completed_sets_workflow_status_completed(self):
        """全部完成时工作流状态变为 COMPLETED"""
        self.orch.mark_task_completed(self.wf_id, "A")
        self.orch.mark_task_completed(self.wf_id, "B")
        self.orch.mark_task_completed(self.wf_id, "C")
        self.assertEqual(
            self.orch.workflows[self.wf_id]["status"],
            WorkflowStatus.COMPLETED.value,
        )

    def test_duplicate_complete_on_same_node_raises_invalid_transition(self):
        """对已完成节点重复标记应抛出 InvalidTransitionError"""
        self.orch.mark_task_completed(self.wf_id, "A")
        with self.assertRaises(InvalidTransitionError):
            self.orch.mark_task_completed(self.wf_id, "A")

    def test_nonexistent_node_id_raises_value_error(self):
        """不存在的节点 ID 应抛出 ValueError"""
        with self.assertRaises(ValueError):
            self.orch.mark_task_completed(self.wf_id, "GHOST_NODE")


# ════════════════════════════════════════════════
# mark_task_failed 测试
# ════════════════════════════════════════════════

class TestMarkTaskFailed(unittest.TestCase):
    """mark_task_failed 方法测试"""

    def setUp(self):
        self.orch = WorkflowOrchestrator()
        nodes = [
            DAGNode(node_id="A", agent_role="executor"),
            DAGNode(node_id="B", agent_role="auditor", dependencies=["A"]),
        ]
        self.wf_id = self.orch.create_workflow(name="fail_test", tasks=nodes)

    def test_status_becomes_failed(self):
        """标记失败后状态为 failed"""
        self.orch.mark_task_failed(self.wf_id, "A", "timeout")
        self.assertEqual(self.orch.workflows[self.wf_id]["nodes"]["A"].status, "failed")

    def test_error_message_stored(self):
        """错误信息被保存"""
        self.orch.mark_task_failed(self.wf_id, "A", "connection refused")
        self.assertEqual(
            self.orch.workflows[self.wf_id]["nodes"]["A"].error,
            "connection refused",
        )

    def test_workflow_not_auto_completed_on_failure(self):
        """失败后工作流不应自动完成（仍有 pending 节点）"""
        self.orch.mark_task_failed(self.wf_id, "A", "err")
        # B 仍然是 pending，所以不算 complete
        self.assertFalse(self.orch.is_workflow_complete(self.wf_id))
        # 工作流状态也不应该是 COMPLETED
        self.assertNotEqual(
            self.orch.workflows[self.wf_id]["status"],
            WorkflowStatus.COMPLETED.value,
        )

    def test_all_terminal_with_failure_counts_as_complete(self):
        """所有节点都有终态（含 failed）时算完成"""
        self.orch.mark_task_completed(self.wf_id, "B")
        self.orch.mark_task_failed(self.wf_id, "A", "err")
        self.assertTrue(self.orch.is_workflow_complete(self.wf_id))


# ════════════════════════════════════════════════
# cancel_workflow 测试
# ════════════════════════════════════════════════

class TestCancelWorkflow(unittest.TestCase):
    """cancel_workflow 方法测试"""

    def setUp(self):
        self.orch = WorkflowOrchestrator()
        nodes = [
            DAGNode(node_id="A", agent_role="executor"),
            DAGNode(node_id="B", agent_role="auditor", dependencies=["A"]),
            DAGNode(node_id="C", agent_role="verifier", dependencies=["B"]),
        ]
        self.wf_id = self.orch.create_workflow(name="cancel_test", tasks=nodes)
        self.orch.start_workflow(self.wf_id)

    def test_cancel_sets_status_to_cancelled(self):
        """取消后状态为 CANCELLED"""
        self.orch.cancel_workflow(self.wf_id)
        self.assertEqual(
            self.orch.workflows[self.wf_id]["status"],
            WorkflowStatus.CANCELLED.value,
        )

    def test_pending_and_running_nodes_become_skipped(self):
        """pending/running 节点变为 skipped"""
        self.orch.cancel_workflow(self.wf_id)
        for node in self.orch.workflows[self.wf_id]["nodes"].values():
            self.assertEqual(node.status, "skipped",
                             f"Node {node.node_id} should be skipped after cancel")

    def test_cancel_already_completed_workflow_raises_error(self):
        """已完成的 workflow 取消应抛异常"""
        # 先完成所有节点
        self.orch.mark_task_completed(self.wf_id, "A")
        self.orch.mark_task_completed(self.wf_id, "B")
        self.orch.mark_task_completed(self.wf_id, "C")
        with self.assertRaises(InvalidTransitionError):
            self.orch.cancel_workflow(self.wf_id)

    def test_double_cancel_raises_error(self):
        """已取消的 workflow 不能再次取消"""
        self.orch.cancel_workflow(self.wf_id)
        with self.assertRaises(InvalidTransitionError):
            self.orch.cancel_workflow(self.wf_id)


# ════════════════════════════════════════════════
# is_workflow_complete 测试
# ════════════════════════════════════════════════

class TestIsWorkflowComplete(unittest.TestCase):
    """is_workflow_complete 方法测试"""

    def setUp(self):
        self.orch = WorkflowOrchestrator()
        nodes = [
            DAGNode(node_id="A", agent_role="executor"),
            DAGNode(node_id="B", agent_role="auditor", dependencies=["A"]),
            DAGNode(node_id="C", agent_role="verifier", dependencies=["A"]),
        ]
        self.wf_id = self.orch.create_workflow(name="complete_check", tasks=nodes)

    def test_all_completed_returns_true(self):
        """全部 completed → True"""
        for nid in ["A", "B", "C"]:
            self.orch.mark_task_completed(self.wf_id, nid)
        self.assertTrue(self.orch.is_workflow_complete(self.wf_id))

    def test_partial_completed_partial_failed_total_matches_returns_true(self):
        """部分 completed + 部分 failed 且总数匹配 → True"""
        self.orch.mark_task_completed(self.wf_id, "A")
        self.orch.mark_task_completed(self.wf_id, "B")
        self.orch.mark_task_failed(self.wf_id, "C", "err")
        self.assertTrue(self.orch.is_workflow_complete(self.wf_id))

    def test_partial_only_returns_false(self):
        """仅部分完成，未达总数 → False"""
        self.orch.mark_task_completed(self.wf_id, "A")
        self.assertFalse(self.orch.is_workflow_complete(self.wf_id))

    def test_initially_returns_false(self):
        """初始时没有任何终态 → False"""
        self.assertFalse(self.orch.is_workflow_complete(self.wf_id))


# ════════════════════════════════════════════════
# get_workflow_progress 测试
# ════════════════════════════════════════════════

class TestWorkflowProgress(unittest.TestCase):
    """get_workflow_progress 方法测试"""

    def setUp(self):
        self.orch = WorkflowOrchestrator()
        nodes = [
            DAGNode(node_id="A", agent_role="executor"),
            DAGNode(node_id="B", agent_role="auditor", dependencies=["A"]),
            DAGNode(node_id="C", agent_role="verifier", dependencies=["A"]),
            DAGNode(node_id="D", agent_role="archiver", dependencies=["B", "C"]),
        ]
        self.wf_id = self.orch.create_workflow(name="progress_test", tasks=nodes)

    def test_return_dict_contains_required_fields(self):
        """返回字典包含正确字段"""
        progress = self.orch.get_workflow_progress(self.wf_id)
        expected_fields = [
            "workflow_id", "name", "status", "priority",
            "total_tasks", "completed", "failed", "pending",
            "running", "skipped", "percentage", "ready_task_ids",
            "task_dispatch_id", "created_at",
        ]
        for field in expected_fields:
            self.assertIn(field, progress, f"Missing field: {field}")

    def test_percentage_calculation_correct(self):
        """percentage 计算正确"""
        # 初始: 0/4 = 0%
        progress = self.orch.get_workflow_progress(self.wf_id)
        self.assertEqual(progress["percentage"], 0.0)

        # 完成 1 个: 1/4 = 25%
        self.orch.mark_task_completed(self.wf_id, "A")
        progress = self.orch.get_workflow_progress(self.wf_id)
        self.assertAlmostEqual(progress["percentage"], 25.0)

        # 完成 2 个: 2/4 = 50%
        self.orch.mark_task_completed(self.wf_id, "B")
        progress = self.orch.get_workflow_progress(self.wf_id)
        self.assertAlmostEqual(progress["percentage"], 50.0)

        # 全部完成: 100%
        self.orch.mark_task_completed(self.wf_id, "C")
        self.orch.mark_task_completed(self.wf_id, "D")
        progress = self.orch.get_workflow_progress(self.wf_id)
        self.assertEqual(progress["percentage"], 100.0)

    def test_total_tasks_matches_node_count(self):
        """total_tasks 与节点数一致"""
        progress = self.orch.get_workflow_progress(self.wf_id)
        self.assertEqual(progress["total_tasks"], 4)


# ════════════════════════════════════════════════
# list_workflows 测试
# ════════════════════════════════════════════════

class TestListWorkflows(unittest.TestCase):
    """list_workflows 方法测试"""

    def setUp(self):
        self.orch = WorkflowOrchestrator()
        self.wf_id_1 = self.orch.create_workflow(
            name="wf_a", tasks=[DAGNode(node_id="X", agent_role="executor")]
        )
        self.wf_id_2 = self.orch.create_workflow(
            name="wf_b", tasks=[DAGNode(node_id="Y", agent_role="executor")]
        )
        self.orch.start_workflow(self.wf_id_2)  # 变成 running

    def test_returns_all_workflows(self):
        """返回所有工作流"""
        workflows = self.orch.list_workflows()
        self.assertEqual(len(workflows), 2)

    def test_status_filter_filters_correctly(self):
        """status_filter 过滤正常工作"""
        pending_list = self.orch.list_workflows(status_filter="pending")
        self.assertEqual(len(pending_list), 1)
        self.assertEqual(pending_list[0]["workflow_id"], self.wf_id_1)

        running_list = self.orch.list_workflows(status_filter="running")
        self.assertEqual(len(running_list), 1)
        self.assertEqual(running_list[0]["workflow_id"], self.wf_id_2)

    def test_no_match_returns_empty_list(self):
        """无匹配状态返回空列表"""
        result = self.orch.list_workflows(status_filter="completed")
        self.assertEqual(result, [])


# ════════════════════════════════════════════════
# cleanup_workflow 测试
# ════════════════════════════════════════════════

class TestCleanupWorkflow(unittest.TestCase):
    """cleanup_workflow 方法测试"""

    def setUp(self):
        self.orch = WorkflowOrchestrator()
        self.wf_id = self.orch.create_workflow(
            name="cleanup_wf",
            tasks=[DAGNode(node_id="Z", agent_role="executor")]
        )

    def test_cleanup_removes_workflow_from_memory(self):
        """清理后工作流不再存在"""
        self.orch.cleanup_workflow(self.wf_id)
        self.assertNotIn(self.wf_id, self.orch.workflows)

    def test_cleanup_nonexistent_does_not_raise(self):
        """清理不存在的 workflow 不抛异常"""
        self.orch.cleanup_workflow("WF-NONEXISTENT123")  # 不应报错

    def test_cleanup_prevents_subsequent_access(self):
        """清理后通过 _get_workflow 访问会抛 WorkflowNotFoundError"""
        self.orch.cleanup_workflow(self.wf_id)
        with self.assertRaises(WorkflowNotFoundError):
            self.orch._get_workflow(self.wf_id)


# ════════════════════════════════════════════════
# 异常类可抛出与捕获测试
# ════════════════════════════════════════════════

class TestExceptionClasses(unittest.TestCase):
    """异常类: DAGCycleError / WorkflowNotFoundError / InvalidTransitionError"""

    def test_dag_cycle_error_can_be_raised_and_caught(self):
        """DAGCycleError 能正常抛出和捕获"""
        with self.assertRaises(DAGCycleError):
            raise DAGCycleError("test cycle detected")

    def test_workflow_not_found_error_can_be_raised_and_caught(self):
        """WorkflowNotFoundError 能正常抛出和捕获"""
        with self.assertRaises(WorkflowNotFoundError):
            raise WorkflowNotFoundError("test not found")

    def test_invalid_transition_error_can_be_raised_and_caught(self):
        """InvalidTransitionError 能正常抛出和捕获"""
        with self.assertRaises(InvalidTransitionError):
            raise InvalidTransitionError("test invalid transition")

    def test_exceptions_are_proper_subclasses(self):
        """所有自定义异常都是 Exception 的子类"""
        self.assertTrue(issubclass(DAGCycleError, Exception))
        self.assertTrue(issubclass(WorkflowNotFoundError, Exception))
        self.assertTrue(issubclass(InvalidTransitionError, Exception))


if __name__ == "__main__":
    unittest.main()

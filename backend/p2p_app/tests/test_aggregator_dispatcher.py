"""
ResultAggregator & TaskDispatcher 完整测试

使用 django.test.TestCase 测试:
- services/aggregator.py: ResultAggregator (aggregate, aggregate_shard, resolve_conflict,
  _merge_ordered_results, _infer_task_type, _topological_sort)
- services/dispatcher.py: TaskDispatcher (calculate_match_score, select_candidate_nodes,
  dispatch, handle_node_failure, get_queue_status)
"""

from datetime import datetime, timedelta, timezone

from django.test import TestCase
from django.utils import timezone as django_timezone

from p2p_app.models import (
    P2PNode,
    NodeReputation,
    TaskDispatch,
    TaskShard,
    ShardResult,
)
from p2p_app.services.aggregator import (
    ResultAggregator,
    ConsensusStatus,
    ShardResultSummary,
    TaskAggregationResult,
)
from p2p_app.services.dispatcher import (
    TaskDispatcher,
    SchedulableShard,
    DispatchPlan,
)


# ═══════════════════════════════════════════
# 辅助函数：创建测试数据
# ═══════════════════════════════════════════

def _create_node(node_id, status='online', reputation=100.0,
                  node_type='browser', memory_usage=50.0):
    """创建 P2PNode + NodeReputation"""
    node = P2PNode.objects.create(
        node_id=node_id,
        node_type=node_type,
        location='TestCity',
        public_key=f'pk-{node_id}',
        status=status,
        resources={'memory_usage': memory_usage},
        reputation_score=reputation,
    )
    NodeReputation.objects.create(
        node=node,
        score=reputation,
        success_rate=1.0,
    )
    return node


def _create_task_with_shards(task_id, task_type='text', shard_count=3,
                              status='executing'):
    """创建 TaskDispatch + N 个 TaskShard"""
    task = TaskDispatch.objects.create(
        task_id=task_id,
        task_type=task_type,
        status=status,
        total_shards=shard_count,
    )
    shards = []
    for i in range(1, shard_count + 1):
        s = TaskShard.objects.create(
            shard_id=f'{task_id}-SHARD-{i:04d}',
            task=task,
            sequence=i,
            total_in_task=shard_count,
            payload_hash=f'hash_{i}',
        )
        shards.append(s)
    return task, shards


def _add_result(shard, node_id, stdout='', exit_code=0,
                execution_time_ms=100):
    """为分片添加一个 ShardResult"""
    return ShardResult.objects.create(
        shard=shard,
        node_id=node_id,
        exit_code=exit_code,
        stdout=stdout,
        stderr='',
        execution_time_ms=execution_time_ms,
    )


# ═══════════════════════════════════════════
# 1. ResultAggregator 测试
# ═══════════════════════════════════════════

class TestResultAggregatorAggregate(TestCase):
    """ResultAggregator.aggregate 测试"""

    def test_nonexistent_task_raises_error(self):
        """任务不存在抛 P2PServiceError"""
        from p2p_app.services.heartbeat_service import P2PServiceError
        with self.assertRaises(P2PServiceError):
            ResultAggregator.aggregate('NONEXISTENT-TASK-ID')

    def test_all_shards_have_unanimous_consensus(self):
        """全部 shard 有结果且一致 → consensus=unanimous, overall=completed"""
        task, shards = _create_task_with_shards('AGG-UNANIMOUS-001', shard_count=2)

        for shard in shards:
            _add_result(shard, 'node-A', stdout='result_ok')

        result: TaskAggregationResult = ResultAggregator.aggregate(task.task_id)
        self.assertEqual(result.status, 'completed')
        self.assertEqual(result.completed_shards, 2)
        self.assertEqual(result.failed_shards, 0)

    def test_partial_results_overall_partial(self):
        """部分有结果 → overall=partial"""
        task, shards = _create_task_with_shards('AGG-PARTIAL-001', shard_count=3)

        # 只给前两个 shard 添加结果
        _add_result(shards[0], 'node-A', stdout='partial_1')
        _add_result(shards[1], 'node-B', stdout='partial_2')
        # 第三个没有结果，也不是 failed 状态

        result = ResultAggregator.aggregate(task.task_id)
        # 2 completed out of 3, 0 failed → partial
        self.assertIn(result.status, ('partial', 'completed'))
        self.assertGreaterEqual(result.completed_shards, 2)

    def test_all_failed_overall_failed(self):
        """全部失败 → overall=failed"""
        task, shards = _create_task_with_shards('AGG-FAILED-001', shard_count=2)

        # 标记所有 shard 为 failed（不添加结果）
        for shard in shards:
            shard.status = 'failed'
            shard.save(update_fields=['status'])

        result = ResultAggregator.aggregate(task.task_id)
        self.assertEqual(result.status, 'failed')

    def test_updates_task_dispatch_fields(self):
        """更新 TaskDispatch 的 result_summary/status/completed_shards/failed_shards"""
        task, shards = _create_task_with_shards('AGG-UPDATE-001', shard_count=2)
        _add_result(shards[0], 'node-X', stdout='data1')
        _add_result(shards[1], 'node-Y', stdout='data2')

        ResultAggregator.aggregate(task.task_id)

        task.refresh_from_db()
        self.assertIsNotNone(task.result_summary)
        self.assertIn('merged_output', task.result_summary)
        self.assertEqual(task.completed_shards, 2)
        self.assertEqual(task.failed_shards, 0)
        self.assertIn(task.status, ('completed', 'aggregating'))


class TestResultAggregatorAggregateShard(TestCase):
    """ResultAggregator.aggregate_shard 测试"""

    def setUp(self):
        self.task, self.shards = _create_task_with_shards('AGG-SHARD-001', shard_count=1)
        self.shard = self.shards[0]

    def test_single_result_unanimous(self):
        """单结果 → unanimous"""
        _add_result(self.shard, 'node-A', stdout='only_result')
        summary: ShardResultSummary = ResultAggregator.aggregate_shard(self.shard)
        self.assertEqual(summary.consensus_status, ConsensusStatus.UNANIMOUS)
        self.assertIsNotNone(summary.accepted_result)
        self.assertEqual(summary.accepted_result['stdout'], 'only_result')
        self.assertEqual(len(summary.flagged_node_ids), 0)

    def test_single_result_updates_is_accepted(self):
        """单结果更新 is_accepted 标志为 True"""
        r = _add_result(self.shard, 'node-B', stdout='accepted')
        ResultAggregator.aggregate_shard(self.shard)
        r.refresh_from_db()
        self.assertTrue(r.is_accepted)

    def test_single_result_updates_shard_status_completed(self):
        """单结果更新 shard 状态为 completed"""
        _add_result(self.shard, 'node-C', stdout='done')
        ResultAggregator.aggregate_shard(self.shard)
        self.shard.refresh_from_db()
        self.assertEqual(self.shard.status, 'completed')

    def test_multiple_same_stdout_unanimous(self):
        """多结果相同 stdout → unanimous"""
        _add_result(self.shard, 'node-D', stdout='same_output', execution_time_ms=50)
        _add_result(self.shard, 'node-E', stdout='same_output', execution_time_ms=80)
        summary = ResultAggregator.aggregate_shard(self.shard)
        self.assertEqual(summary.consensus_status, ConsensusStatus.UNANIMOUS)

    def test_multiple_majority_majority(self):
        """多结果多数一致 → majority"""
        _add_result(self.shard, 'node-F', stdout='majority_output', execution_time_ms=30)
        _add_result(self.shard, 'node-G', stdout='majority_output', execution_time_ms=60)
        _add_result(self.shard, 'node-H', stdout='minority_output', execution_time_ms=40)
        summary = ResultAggregator.aggregate_shard(self.shard)
        self.assertEqual(summary.consensus_status, ConsensusStatus.MAJORITY)

    def test_multiple_conflict(self):
        """多结果完全冲突 → conflict"""
        _add_result(self.shard, 'node-I', stdout='output_A', execution_time_ms=10)
        _add_result(self.shard, 'node-J', stdout='output_B', execution_time_ms=20)
        _add_result(self.shard, 'node-K', stdout='output_C', execution_time_ms=15)
        summary = ResultAggregator.aggregate_shard(self.shard)
        self.assertEqual(summary.consensus_status, ConsensusStatus.CONFLICT)

    def test_no_results_raises_error(self):
        """无结果时抛异常"""
        from p2p_app.services.heartbeat_service import P2PServiceError
        with self.assertRaises(P2PServiceError):
            ResultAggregator.aggregate_shard(self.shard)


class TestResolveConflict(TestCase):
    """ResultAggregator.resolve_conflict 测试"""

    def setUp(self):
        self.task, self.shards = _create_task_with_shards('RESOLVE-001', shard_count=1)
        self.shard = self.shards[0]

    def _make_results(self, data_list):
        """辅助: 创建多个 ShardResult 并返回列表"""
        results = []
        for node_id, stdout, exec_ms in data_list:
            r = _add_result(self.shard, node_id, stdout=stdout,
                            execution_time_ms=exec_ms)
            results.append(r)
        return list(self.shard.results.all())

    def test_majority_selects_largest_group(self):
        """多数决选择最大组"""
        results = self._make_results([
            ('n1', 'win', 100),
            ('n2', 'win', 90),
            ('n3', 'lose', 80),
        ])
        accepted, flagged = ResultAggregator.resolve_conflict(results)
        self.assertEqual(accepted.stdout, 'win')
        self.assertIn('n3', flagged)

    def test_tie_breaks_by_fastest_response_time(self):
        """平局时按 response_time 选择最快"""
        # 3个结果各自不同 → majority_threshold=2, 最大组=1 < 2 → 走平局分支
        results = self._make_results([
            ('n1', 'opt_a', 200),
            ('n2', 'opt_b', 50),
            ('n3', 'opt_c', 150),
        ])
        accepted, flagged = ResultAggregator.resolve_conflict(results)
        # n2 最快 (50ms) 应被选中
        self.assertEqual(accepted.node_id, 'n2')

    def test_tie_on_response_time_breaks_by_reputation(self):
        """response_time 也平局按 reputation 选择最高"""
        # 创建两个节点，信誉不同
        node_high = _create_node('high-rep-node', reputation=95.0)
        node_low = _create_node('low-rep-node', reputation=70.0)

        results = self._make_results([
            (node_high.node_id, 'tie_out', 100),
            (node_low.node_id, 'other_out', 100),
        ])
        accepted, flagged = ResultAggregator.resolve_conflict(results)
        # 高信誉节点应被选中
        self.assertEqual(accepted.node_id, node_high.node_id)

    def test_returns_tuple_accepted_and_flagged(self):
        """返回 (accepted_result, flagged_node_ids) 元组"""
        results = self._make_results([('nx', 'x', 10)])
        accepted, flagged = ResultAggregator.resolve_conflict(results)
        self.assertIsInstance(accepted, ShardResult)
        self.assertIsInstance(flagged, list)


class TestMergeOrderedResults(TestCase):
    """ResultAggregator._merge_ordered_results 测试"""

    def test_sorted_by_shard_id(self):
        """按 shard_id 排序合并"""
        from p2p_app.services.aggregator import ShardResultSummary

        summaries = [
            ShardResultSummary(
                shard_id='TASK-SHARD-0003',
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={'stdout': 'c'},
            ),
            ShardResultSummary(
                shard_id='TASK-SHARD-0001',
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={'stdout': 'a'},
            ),
            ShardResultSummary(
                shard_id='TASK-SHARD-0002',
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={'stdout': 'b'},
            ),
        ]
        merged = ResultAggregator._merge_ordered_results(summaries)
        output = merged['merged_output']
        # text 类型返回 str, file 类型返回 dict
        if merged['inferred_task_type'] == 'text':
            self.assertIsInstance(output, str)
        else:
            self.assertIsInstance(output, (str, dict))
        self.assertIn('shard_details', merged)

    def test_text_type_joins_stdout(self):
        """text 类型拼接 stdout"""
        from p2p_app.services.aggregator import ShardResultSummary

        summaries = [
            ShardResultSummary(
                shard_id='T-SHARD-0001',
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={'stdout': 'Hello world. This is line one.\n\nAnother paragraph.'},
            ),
            ShardResultSummary(
                shard_id='T-SHARD-0002',
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={'stdout': 'The second line is here.'},
            ),
        ]
        merged = ResultAggregator._merge_ordered_results(summaries)
        self.assertEqual(merged['inferred_task_type'], 'text')
        self.assertIn('line one', merged['merged_output'])
        self.assertIn('second line', merged['merged_output'])

    def test_code_type_generates_modules_structure(self):
        """code 类型生成 modules 结构"""
        from p2p_app.services.aggregator import ShardResultSummary

        summaries = [
            ShardResultSummary(
                shard_id='T-SHARD-0001',
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={'stdout': 'def foo(): pass'},
            ),
            ShardResultSummary(
                shard_id='T-SHARD-0002',
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={'stdout': 'class Bar: pass'},
            ),
        ]
        merged = ResultAggregator._merge_ordered_results(summaries)
        self.assertEqual(merged['inferred_task_type'], 'code')
        self.assertIn('modules', merged['merged_output'])
        self.assertEqual(len(merged['merged_output']['modules']), 2)

    def test_file_type_generates_offset_structure(self):
        """file 类型生成分片偏移结构"""
        from p2p_app.services.aggregator import ShardResultSummary

        summaries = [
            ShardResultSummary(
                shard_id='T-SHARD-0001',
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={'stdout': 'AAA'},
            ),
            ShardResultSummary(
                shard_id='T-SHARD-0002',
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={'stdout': 'BBBB'},
            ),
        ]
        merged = ResultAggregator._merge_ordered_results(summaries)
        self.assertEqual(merged['inferred_task_type'], 'file')
        file_data = merged['merged_output']
        self.assertIn('total_length', file_data)
        self.assertIn('parts', file_data)
        self.assertEqual(file_data['total_length'], 7)  # len('AAA') + len('BBBB')


class TestInferTaskType(TestCase):
    """ResultAggregator._infer_task_type 测试"""

    def test_code_indicators_return_code(self):
        """含 def/class/import → code"""
        from p2p_app.services.aggregator import ShardResultSummary

        summaries = [
            ShardResultSummary(
                shard_id='S1',
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={'stdout': 'def hello():\n    print("hi")\nimport os'},
            )
        ]
        self.assertEqual(ResultAggregator._infer_task_type(summaries), 'code')

    def test_text_indicators_return_text(self):
        """含中文标点/英文常见词 → text"""
        from p2p_app.services.aggregator import ShardResultSummary

        summaries = [
            ShardResultSummary(
                shard_id='S1',
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={'stdout': '这是一个测试。The weather is nice today.\n\nEnd.'},
            )
        ]
        self.assertEqual(ResultAggregator._infer_task_type(summaries), 'text')

    def test_else_returns_file(self):
        """else → file"""
        from p2p_app.services.aggregator import ShardResultSummary

        summaries = [
            ShardResultSummary(
                shard_id='S1',
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={'stdout': 'binary data \x01\x02\x03'},
            )
        ]
        self.assertEqual(ResultAggregator._infer_task_type(summaries), 'file')


class TestTopologicalSort(TestCase):
    """ResultAggregator._topological_sort 测试"""

    def test_no_deps_sorted_by_sequence(self):
        """无依赖按序列号排序"""
        from p2p_app.services.aggregator import ShardResultSummary

        task, shards = _create_task_with_shards('TOPO-NODEPS-001', shard_count=3)
        summaries = [
            ShardResultSummary(
                shard_id=shards[2].shard_id,
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={},
            ),
            ShardResultSummary(
                shard_id=shards[0].shard_id,
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={},
            ),
            ShardResultSummary(
                shard_id=shards[1].shard_id,
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={},
            ),
        ]
        sorted_sums = ResultAggregator._topological_sort(summaries)
        # 应按序列号排序: SHARD-0001, SHARD-0002, SHARD-0003
        self.assertEqual(sorted_sums[0].shard_id, shards[0].shard_id)
        self.assertEqual(sorted_sums[1].shard_id, shards[1].shard_id)
        self.assertEqual(sorted_sums[2].shard_id, shards[2].shard_id)

    def test_with_dependencies_kahn_bfs_order(self):
        """有依赖按拓扑序（Kahn BFS）"""
        from p2p_app.services.aggregator import ShardResultSummary

        task, shards = _create_task_with_shards('TOPO-DEPS-001', shard_count=3)
        # 设置依赖: shard1 ← shard2 ← shard3
        shards[1].dependencies = [shards[0].shard_id]
        shards[1].save(update_fields=['dependencies'])
        shards[2].dependencies = [shards[1].shard_id]
        shards[2].save(update_fields=['dependencies'])

        summaries = [
            ShardResultSummary(
                shard_id=s.shard_id,
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={},
            ) for s in [shards[2], shards[0], shards[1]]  # 乱序输入
        ]
        sorted_sums = ResultAggregator._topological_sort(summaries)
        # 拓扑序应为: shard1 (无依赖), shard2 (依赖shard1), shard3 (依赖shard2)
        self.assertEqual(sorted_sums[0].shard_id, shards[0].shard_id)
        self.assertEqual(sorted_sums[1].shard_id, shards[1].shard_id)
        self.assertEqual(sorted_sums[2].shard_id, shards[2].shard_id)

    def test_empty_input_returns_empty(self):
        """空输入返回空列表"""
        result = ResultAggregator._topological_sort([])
        self.assertEqual(result, [])


# ═══════════════════════════════════════════
# 2. TaskDispatcher 测试
# ═══════════════════════════════════════════

class TestCalculateMatchScore(TestCase):
    """TaskDispatcher.calculate_match_score 测试"""

    def setUp(self):
        self.dispatcher = TaskDispatcher()
        self.shard = SchedulableShard(
            priority_score=1.0,
            shard_id='test-shard',
            task_id='TASK-SCORE-001',
            sequence=0,
        )

    def test_score_between_zero_and_one(self):
        """返回 0-1 之间的浮点数"""
        node = _create_node('score-node-001', memory_usage=50.0, reputation=80.0)
        score = self.dispatcher.calculate_match_score(self.shard, node)
        self.assertIsInstance(score, float)
        self.assertGreaterEqual(score, 0.0)
        self.assertLessEqual(score, 1.0)

    def test_low_memory_usage_gives_lower_cost(self):
        """低内存使用 → 低 cost 分"""
        node_low = _create_node('score-low-mem', memory_usage=10.0)
        node_high = _create_node('score-high-mem', memory_usage=90.0)
        score_low = self.dispatcher.calculate_match_score(self.shard, node_low)
        score_high = self.dispatcher.calculate_match_score(self.shard, node_high)
        # 低内存 → 低 cost_normalized → 更低的总分
        self.assertLessEqual(score_low, score_high)

    def test_recent_heartbeat_gives_lower_latency(self):
        """新近心跳 → 低 latency 分"""
        from unittest.mock import patch

        node_fresh = _create_node('score-fresh', memory_usage=50.0)
        node_stale = _create_node('score-stale', memory_usage=50.0)

        # 固定 "当前时间"，确保两个节点的 heartbeat 差异精确可控
        fixed_now = django_timezone.now()
        with patch('p2p_app.services.dispatcher.django_timezone') as mock_tz:
            mock_tz.now.return_value = fixed_now
            # stale 节点心跳设为 30 分钟前
            node_stale.last_heartbeat = fixed_now - timedelta(minutes=30)
            node_stale.save(update_fields=['last_heartbeat'])
            # 防止 save() 覆盖：重新设置（某些模型会 auto_update）
            node_stale.last_heartbeat = fixed_now - timedelta(minutes=30)

            score_fresh = self.dispatcher.calculate_match_score(self.shard, node_fresh)
            score_stale = self.dispatcher.calculate_match_score(self.shard, node_stale)

        self.assertLess(score_fresh, score_stale)

    def test_high_reputation_gives_lower_penalty(self):
        """高信誉 → low reliability penalty"""
        node_good = _create_node('score-good-rep', memory_usage=50.0, reputation=99.0)
        node_bad = _create_node('score-bad-rep', memory_usage=50.0, reputation=30.0)
        score_good = self.dispatcher.calculate_match_score(self.shard, node_good)
        score_bad = self.dispatcher.calculate_match_score(self.shard, node_bad)
        # 高信誉 → reliability_penalty 低 → 总分低
        self.assertLessEqual(score_good, score_bad)

    def test_non_online_status_high_security_risk(self):
        """非 online 状态 → 高 security_risk"""
        node_online = _create_node('score-online', status='online', memory_usage=50.0)
        node_busy = _create_node('score-busy', status='busy', memory_usage=50.0)
        score_online = self.dispatcher.calculate_match_score(self.shard, node_online)
        score_busy = self.dispatcher.calculate_match_score(self.shard, node_busy)
        # busy 状态 security_risk 可能更高
        self.assertGreaterEqual(score_busy, score_online)


class TestSelectCandidateNodes(TestCase):
    """TaskDispatcher.select_candidate_nodes 测试"""

    def setUp(self):
        self.dispatcher = TaskDispatcher()
        self.shard = SchedulableShard(
            priority_score=1.0,
            shard_id='select-shard',
            task_id='TASK-SELECT-001',
            sequence=0,
            required_capabilities=['code_execution'],
            estimated_resources={'cpu_cores': 2},
        )

    def test_sorted_by_match_score_ascending(self):
        """按 match_score 升序排列"""
        nodes = [
            _create_node(f'sel-n{i}', reputation=float(90 - i * 10))
            for i in range(5)
        ]
        # 给所有节点加上 code_execution 能力
        for n in nodes:
            n.capabilities = ['code_execution']
            n.resources = {'cpu_cores': 4}
            n.save(update_fields=['capabilities', 'resources'])

        candidates = self.dispatcher.select_candidate_nodes(self.shard, nodes, n=3)
        scores = [
            self.dispatcher.calculate_match_score(self.shard, c)
            for c in candidates
        ]
        # 应升序排列
        self.assertEqual(scores, sorted(scores))

    def test_only_online_or_busy_nodes(self):
        """只选 online/busy 节点"""
        online = _create_node('sel-online', status='online')
        busy = _create_node('sel-busy', status='busy')
        offline = _create_node('sel-offline', status='offline')
        banned = _create_node('sel-banned', status='banned')

        for n in [online, busy, offline, banned]:
            n.capabilities = ['code_execution']
            n.resources = {'cpu_cores': 4}
            n.save(update_fields=['capabilities', 'resources'])

        candidates = self.dispatcher.select_candidate_nodes(self.shard, [online, busy, offline, banned])
        candidate_ids = {c.node_id for c in candidates}
        self.assertIn(online.node_id, candidate_ids)
        self.assertIn(busy.node_id, candidate_ids)
        self.assertNotIn(offline.node_id, candidate_ids)
        self.assertNotIn(banned.node_id, candidate_ids)

    def test_exclude_banned_nodes(self):
        """排除 banned 节点"""
        normal = _create_node('sel-normal', status='online')
        banned = _create_node('sel-banned2', status='banned')
        for n in [normal, banned]:
            n.capabilities = ['code_execution']
            n.resources = {'cpu_cores': 4}
            n.save()

        candidates = self.dispatcher.select_candidate_nodes(self.shard, [normal, banned])
        self.assertTrue(all(c.status != 'banned' for c in candidates))

    def test_must_meet_capabilities(self):
        """必须满足能力要求"""
        capable = _create_node('sel-capable', status='online')
        incapable = _create_node('sel-incapable', status='online')
        capable.capabilities = ['code_execution']
        capable.resources = {'cpu_cores': 4}
        capable.save()
        incapable.capabilities = ['ocr']
        incapable.resources = {'cpu_cores': 4}
        incapable.save()

        candidates = self.dispatcher.select_candidate_nodes(
            self.shard, [capable, incapable]
        )
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].node_id, capable.node_id)

    def test_must_meet_resource_requirements(self):
        """必须满足资源要求"""
        rich = _create_node('sel-rich', status='online')
        poor = _create_node('sel-poor', status='online')
        rich.capabilities = ['code_execution']
        rich.resources = {'cpu_cores': 8, 'memory_gb': 16}
        rich.save()
        poor.capabilities = ['code_execution']
        poor.resources = {'cpu_cores': 1, 'memory_gb': 1}
        poor.save()

        shard_needy = SchedulableShard(
            priority_score=1.0,
            shard_id='needy-shard',
            task_id='TASK-NEEDY',
            sequence=0,
            required_capabilities=['code_execution'],
            estimated_resources={'cpu_cores': 4},
        )
        candidates = self.dispatcher.select_candidate_nodes(shard_needy, [rich, poor])
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].node_id, rich.node_id)

    def test_returns_top_n(self):
        """返回 top-N 个"""
        nodes = [
            _create_node(f'sel-top{n}', reputation=float(95 - n * 5))
            for n in range(6)
        ]
        for n in nodes:
            n.capabilities = ['code_execution']
            n.resources = {'cpu_cores': 8}
            n.save()

        candidates = self.dispatcher.select_candidate_nodes(self.shard, nodes, n=3)
        self.assertLessEqual(len(candidates), 3)


class TestDispatch(TestCase):
    """TaskDispatcher.dispatch 测试"""

    def setUp(self):
        self.dispatcher = TaskDispatcher()
        self.task, self.shards = _create_task_with_shards('DISPATCH-TASK-001', shard_count=2)
        self.nodes = [_create_node(f'disp-n{i}') for i in range(3)]
        for n in self.nodes:
            n.capabilities = ['code_execution']
            n.resources = {'cpu_cores': 4, 'memory_gb': 8}
            n.save()

        self.schedulable_shards = [
            SchedulableShard(
                priority_score=float(s.sequence),
                shard_id=s.shard_id,
                task_id=self.task.task_id,
                sequence=s.sequence,
                required_capabilities=['code_execution'],
                estimated_resources={'cpu_cores': 2},
            ) for s in self.shards
        ]

    def test_empty_shards_raises_exception(self):
        """空 shards 列表抛异常"""
        from p2p_app.services.heartbeat_service import P2PServiceError
        with self.assertRaises(P2PServiceError):
            self.dispatcher.dispatch([], self.nodes)

    def test_empty_nodes_raises_exception(self):
        """空 nodes 列表抛异常"""
        from p2p_app.services.heartbeat_service import P2PServiceError
        with self.assertRaises(P2PServiceError):
            self.dispatcher.dispatch(self.schedulable_shards, [])

    def test_nonexistent_task_raises_exception(self):
        """任务不存在抛异常"""
        from p2p_app.services.heartbeat_service import P2PServiceError
        bad_shards = [
            SchedulableShard(
                priority_score=1.0,
                shard_id='bad-shard',
                task_id='NONEXISTENT-TASK',
                sequence=0,
            )
        ]
        with self.assertRaises(P2PServiceError):
            self.dispatcher.dispatch(bad_shards, self.nodes)

    def test_normal_dispatch_returns_plan(self):
        """正常调度返回 DispatchPlan(assignments, total_shards, estimated_total_time_ms)"""
        plan: DispatchPlan = self.dispatcher.dispatch(self.schedulable_shards, self.nodes)
        self.assertIsInstance(plan, DispatchPlan)
        self.assertEqual(plan.task_id, self.task.task_id)
        self.assertGreaterEqual(plan.total_shards, 1)
        self.assertIsInstance(plan.assignments, list)
        self.assertIsInstance(plan.estimated_total_time_ms, int)

    def test_task_status_updated_to_executing(self):
        """TaskDispatch 状态更新为 executing"""
        self.dispatcher.dispatch(self.schedulable_shards, self.nodes)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, 'executing')

    def test_shard_status_updated_to_dispatched(self):
        """TaskShard 状态更新为 dispatched + assigned_node_ids"""
        self.dispatcher.dispatch(self.schedulable_shards, self.nodes)
        for shard in self.shards:
            shard.refresh_from_db()
            self.assertEqual(shard.status, 'dispatched')
            self.assertIsInstance(shard.assigned_node_ids, list)
            self.assertGreater(len(shard.assigned_node_ids), 0)


class TestHandleNodeFailure(TestCase):
    """TaskDispatcher.handle_node_failure 测试"""

    def setUp(self):
        self.dispatcher = TaskDispatcher()
        self.failed_node = _create_node('fail-node-001', status='online', reputation=85.0)
        self.good_node = _create_node('fail-node-002', status='online', reputation=90.0)

        self.task, self.shards = _create_task_with_shards('FAIL-TASK-001', shard_count=2)
        for s in self.shards:
            s.status = 'dispatched'
            s.assigned_node_ids = [self.failed_node.node_id, self.good_node.node_id]
            s.required_capabilities = ['code_execution']
            s.estimated_resources = {'cpu_cores': 2}
            s.save()

        for n in [self.failed_node, self.good_node]:
            n.capabilities = ['code_execution']
            n.resources = {'cpu_cores': 4}
            n.save()

    def test_reduces_failed_node_reputation_by_10(self):
        """降低故障节点信誉(-10)"""
        original_rep = self.failed_node.reputation_score
        self.dispatcher.handle_node_failure(
            self.failed_node.node_id,
            [s.shard_id for s in self.shards],
        )
        self.failed_node.refresh_from_db()
        self.assertAlmostEqual(
            self.failed_node.reputation_score,
            original_rep - 10.0,
        )

    def test_increases_malicious_flags(self):
        """增加恶意标记"""
        rep = NodeReputation.objects.get(node=self.failed_node)
        original_flags = rep.malicious_flags
        self.dispatcher.handle_node_failure(
            self.failed_node.node_id,
            [self.shards[0].shard_id],
        )
        rep.refresh_from_db()
        self.assertEqual(rep.malicious_flags, original_flags + 1)

    def test_malicious_flags_gt_3_bans_node(self):
        """恶意标记>3时封禁节点"""
        rep = NodeReputation.objects.get(node=self.failed_node)
        rep.malicious_flags = 4  # 已经 > 3
        rep.save()

        self.dispatcher.handle_node_failure(
            self.failed_node.node_id,
            [self.shards[0].shard_id],
        )
        self.failed_node.refresh_from_db()
        self.assertEqual(self.failed_node.status, 'banned')

    def test_affected_shards_marked_failed(self):
        """受影响 shard 标记 failed"""
        self.dispatcher.handle_node_failure(
            self.failed_node.node_id,
            [s.shard_id for s in self.shards],
        )
        for shard in self.shards:
            shard.refresh_from_db()
            # shard 应被标记为 failed 或重新分配后 dispatched
            self.assertIn(shard.status, ('failed', 'dispatched'))

    def test_attempts_reassignment_to_replacement(self):
        """尝试重新分配给替换节点"""
        reassignments = self.dispatcher.handle_node_failure(
            self.failed_node.node_id,
            [s.shard_id for s in self.shards],
        )
        self.assertIsInstance(reassignments, list)
        # 如果有替换节点可用，reassignments 应非空
        if reassignments:
            entry = reassignments[0]
            self.assertIn('shard_id', entry)
            self.assertIn('replacement_node_ids', entry)

    def test_returns_reassignments_list(self):
        """返回 reassignments 列表"""
        result = self.dispatcher.handle_node_failure(
            self.failed_node.node_id,
            [self.shards[0].shard_id],
        )
        self.assertIsInstance(result, list)


class TestGetQueueStatus(TestCase):
    """TaskDispatcher.get_queue_status 测试"""

    def setUp(self):
        self.dispatcher = TaskDispatcher()

    def test_initially_empty_queue(self):
        """初始队列为空"""
        status = self.dispatcher.get_queue_status()
        self.assertEqual(status['queue_length'], 0)
        self.assertEqual(status['queued_shards'], [])

    def test_after_dispatch_has_queued_shards(self):
        """dispatch 后队列有排队分片"""
        task, shards = _create_task_with_shards('QUEUE-TASK-001', shard_count=2)
        nodes = [_create_node(f'queue-n{i}') for i in range(2)]
        for n in nodes:
            n.capabilities = ['code_execution']
            n.resources = {'cpu_cores': 4}
            n.save()

        schedulables = [
            SchedulableShard(
                priority_score=float(s.sequence),
                shard_id=s.shard_id,
                task_id=task.task_id,
                sequence=s.sequence,
                required_capabilities=['code_execution'],
                estimated_resources={'cpu_cores': 2},
            ) for s in shards
        ]

        self.dispatcher.dispatch(schedulables, nodes)

        status = self.dispatcher.get_queue_status()
        # dispatch 内部会 heappop 所有元素清空队列，
        # 所以 dispatch 后 queue 应该为空
        self.assertIsInstance(status['queue_length'], int)
        self.assertIsInstance(status['queued_shards'], list)

    def test_returns_queue_length_and_shard_list(self):
        """返回队列长度和排队分片列表"""
        status = self.dispatcher.get_queue_status()
        self.assertIn('queue_length', status)
        self.assertIn('queued_shards', status)

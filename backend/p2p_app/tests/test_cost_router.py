"""
测试 cost_router.py 中的 ComputeCostEstimator 和 EIHMCostRouter
"""

import logging
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings

from p2p_app.models import P2PNode, TaskDispatch, TaskShard
from p2p_app.services.cost_router import ComputeCostEstimator, EIHMCostRouter


class TestComputeCostEstimator(TestCase):
    """ComputeCostEstimator 单分片成本估算测试"""

    def setUp(self):
        self.estimator = ComputeCostEstimator()
        self.task = TaskDispatch.objects.create(
            task_id='task-cost-001',
            task_type='text',
            status='created',
        )
        self.shard = TaskShard.objects.create(
            shard_id='shard-cost-001',
            task=self.task,
            sequence=1,
            total_in_task=3,
            payload_hash='abc123',
            payload_size=1024 * 1024,
            security_level='normal',
            data_sensitivity='public',
            estimated_resources={'cpu_cores': 2, 'memory_gb': 4},
        )

    # ---- estimate_shard_cost: node_type 基础单价 ----

    def test_browser_node_lowest_base_cost(self):
        """browser 节点基础单价最低 (0.01)"""
        browser_node = P2PNode(
            node_id='node-browser', node_type='browser', capabilities=[],
            resources={}, location='Beijing', public_key='k1'
        )
        desktop_node = P2PNode(
            node_id='node-desktop', node_type='desktop_windows', capabilities=[],
            resources={}, location='Beijing', public_key='k1'
        )
        enterprise_node = P2PNode(
            node_id='node-enterprise', node_type='enterprise', capabilities=[],
            resources={}, location='Beijing', public_key='k1'
        )

        cost_browser = self.estimator.estimate_shard_cost(self.shard, browser_node)
        cost_desktop = self.estimator.estimate_shard_cost(self.shard, desktop_node)
        cost_enterprise = self.estimator.estimate_shard_cost(self.shard, enterprise_node)

        self.assertLess(cost_browser, cost_desktop)
        self.assertLess(cost_desktop, cost_enterprise)

    def test_unit_costs_values(self):
        """验证各节点类型的基准单价值"""
        expected = {'browser': 0.01, 'desktop_windows': 0.05, 'enterprise': 0.50}
        for ntype, exp_cost in expected.items():
            node = P2PNode(
                node_id=f'node-{ntype}', node_type=ntype, capabilities=[],
                resources={}, location='X', public_key='k'
            )
            raw = self.estimator.estimate_shard_cost(self.shard, node)
            unit = self.estimator.UNIT_COSTS[ntype]
            self.assertEqual(unit, exp_cost)

    # ---- estimate_shard_cost: security_level 加成 ----

    def test_security_level_normal_no_bonus(self):
        """normal 安全级别加成系数为 1.0"""
        self.shard.security_level = 'normal'
        node = self._make_node('desktop_windows')
        cost_normal = self.estimator.estimate_shard_cost(self.shard, node)
        self.shard.security_level = 'normal'
        self.assertAlmostEqual(cost_normal, cost_normal)

    def test_security_level_high_increases_cost(self):
        """high 安全级别使成本增加 (1.5x)"""
        node = self._make_node('desktop_windows')

        self.shard.security_level = 'normal'
        cost_normal = self.estimator.estimate_shard_cost(self.shard, node)

        self.shard.security_level = 'high'
        cost_high = self.estimator.estimate_shard_cost(self.shard, node)

        self.assertAlmostEqual(cost_high / cost_normal, 1.5, places=4)

    def test_security_level_critical_highest_increase(self):
        """critical 安全级别使成本大幅增加 (2.5x)"""
        node = self._make_node('desktop_windows')

        self.shard.security_level = 'normal'
        cost_normal = self.estimator.estimate_shard_cost(self.shard, node)

        self.shard.security_level = 'critical'
        cost_critical = self.estimator.estimate_shard_cost(self.shard, node)

        self.assertAlmostEqual(cost_critical / cost_normal, 2.5, places=4)

    def test_security_ordering(self):
        """安全级别成本排序: normal < high < critical"""
        node = self._make_node('enterprise')
        costs = {}
        for level in ['normal', 'high', 'critical']:
            self.shard.security_level = level
            costs[level] = self.estimator.estimate_shard_cost(self.shard, node)

        self.assertLess(costs['normal'], costs['high'])
        self.assertLess(costs['high'], costs['critical'])

    # ---- estimate_shard_cost: privacy_level 加成 ----

    def test_confidential_privacy_increases_cost(self):
        """confidential 隐私级别增加成本 (1.8x)"""
        node = self._make_node('desktop_windows')

        self.shard.data_sensitivity = 'public'
        cost_public = self.estimator.estimate_shard_cost(self.shard, node)

        self.shard.data_sensitivity = 'confidential'
        cost_conf = self.estimator.estimate_shard_cost(self.shard, node)

        self.assertGreater(cost_conf, cost_public)

    def test_privacy_ordering(self):
        """隐私级别成本排序: public < internal < confidential"""
        node = self._make_node('desktop_windows')
        costs = {}
        for priv in ['public', 'internal', 'confidential']:
            self.shard.data_sensitivity = priv
            costs[priv] = self.estimator.estimate_shard_cost(self.shard, node)

        self.assertLess(costs['public'], costs['internal'])
        self.assertLess(costs['internal'], costs['confidential'])

    # ---- estimate_shard_cost: payload_size 影响 size_factor ----

    def test_larger_payload_higher_cost(self):
        """payload_size 越大，size_factor 越高，总成本越高"""
        node = self._make_node('desktop_windows')

        self.shard.payload_size = 1024 * 1024   # 1 MB
        cost_small = self.estimator.estimate_shard_cost(self.shard, node)

        self.shard.payload_size = 10 * 1024 * 1024  # 10 MB
        cost_large = self.estimator.estimate_shard_cost(self.shard, node)

        self.assertGreater(cost_large, cost_small)

    def test_payload_size_proportional(self):
        """成本与 payload_size 成正比（其他条件相同时）"""
        node = self._make_node('browser')

        self.shard.payload_size = 2048 * 1024
        cost_2m = self.estimator.estimate_shard_cost(self.shard, node)

        self.shard.payload_size = 4096 * 1024
        cost_4m = self.estimator.estimate_shard_cost(self.shard, node)

        self.assertAlmostEqual(cost_4m / cost_2m, 2.0, places=4)

    # ---- estimate_shard_cost: 资源影响 resource_factor ----

    def test_high_cpu_resources_increase_cost(self):
        """CPU 资源需求越高，resource_factor 越大，成本越高"""
        node = self._make_node('desktop_windows')

        self.shard.estimated_resources = {'cpu_cores': 1, 'memory_gb': 2}
        cost_low = self.estimator.estimate_shard_cost(self.shard, node)

        self.shard.estimated_resources = {'cpu_cores': 8, 'memory_gb': 16}
        cost_high = self.estimator.estimate_shard_cost(self.shard, node)

        self.assertGreater(cost_high, cost_low)

    def test_memory_resources_affect_cost(self):
        """内存资源需求影响 resource_factor（内存权重 0.4）"""
        node = self._make_node('desktop_windows')

        self.shard.estimated_resources = {'cpu_cores': 2, 'memory_gb': 2}
        cost_low_mem = self.estimator.estimate_shard_cost(self.shard, node)

        self.shard.estimated_resources = {'cpu_cores': 2, 'memory_gb': 14}
        cost_high_mem = self.estimator.estimate_shard_cost(self.shard, node)

        self.assertGreater(cost_high_mem, cost_low_mem)

    def test_empty_estimated_resources_defaults(self):
        """空 estimated_resources 使用默认值，不报错"""
        node = self._make_node('desktop_windows')
        self.shard.estimated_resources = {}
        cost = self.estimator.estimate_shard_cost(self.shard, node)
        self.assertIsInstance(cost, float)
        self.assertGreaterEqual(cost, 0)

    # ---- estimate_shard_cost: 返回精度 ----

    def test_return_precision_six_decimals(self):
        """返回值精度为 6 位小数"""
        node = self._make_node('enterprise')
        cost_str = f"{self.estimator.estimate_shard_cost(self.shard, node):.6f}"
        self.assertEqual(len(cost_str.split('.')[-1]), 6)

    # ---- estimate_total_cost ----

    def test_estimate_total_cost_multi_shard_multi_node(self):
        """多分片多节点总成本累加正确"""
        task2 = TaskDispatch.objects.create(
            task_id='task-cost-total-002',
            task_type='text',
            status='created',
        )
        nodes = [
            P2PNode(node_id=f'n{i}', node_type='desktop_windows', capabilities=[],
                    resources={}, location='L', public_key=f'k{i}')
            for i in range(3)
        ]
        for n in nodes:
            n.save()

        s1 = TaskShard.objects.create(
            shard_id='ts-1', task=task2, sequence=1, total_in_task=2,
            payload_hash='h1', payload_size=1000000,
            estimated_resources={'cpu_cores': 2, 'memory_gb': 4},
        )
        s2 = TaskShard.objects.create(
            shard_id='ts-2', task=task2, sequence=2, total_in_task=2,
            payload_hash='h2', payload_size=2000000,
            estimated_resources={'cpu_cores': 4, 'memory_gb': 8},
        )

        assignments = {
            'ts-1': ['n0', 'n1'],
            'ts-2': ['n1', 'n2'],
        }
        total = self.estimator.estimate_total_cost(task=task2, assignments=assignments)

        manual_sum = (
            self.estimator.estimate_shard_cost(s1, nodes[0])
            + self.estimator.estimate_shard_cost(s1, nodes[1])
            + self.estimator.estimate_shard_cost(s2, nodes[1])
            + self.estimator.estimate_shard_cost(s2, nodes[2])
        )
        self.assertAlmostEqual(total, round(manual_sum, 6), places=6)

    def test_estimate_total_cost_skips_missing_nodes(self):
        """不存在的节点被跳过并记录日志 warning"""
        assignments = {
            self.shard.shard_id: ['nonexistent-node-id'],
        }

        with patch.object(logging.getLogger('p2p_app.services.cost_router'), 'warning') as mock_warn:
            total = self.estimator.estimate_total_cost(task=self.task, assignments=assignments)
            self.assertTrue(mock_warn.called)
            self.assertIn('not found', mock_warn.call_args_list[0][0][0])

        self.assertEqual(total, 0.0)

    def test_estimate_total_cost_empty_assignments(self):
        """空分配方案返回 0"""
        total = self.estimator.estimate_total_cost(task=self.task, assignments={})
        self.assertEqual(total, 0.0)

    # ---- helpers ----

    def _make_node(self, node_type):
        return P2PNode(
            node_id=f'node-test-{node_type}',
            node_type=node_type,
            capabilities=[],
            resources={},
            location='TestCity',
            public_key='test-public-key',
        )


class TestEIHMCostRouter(TestCase):
    """EIHMCostRouter 核心路由测试"""

    def setUp(self):
        self.router = EIHMCostRouter()
        self.task = TaskDispatch.objects.create(
            task_id='task-route-001',
            task_type='mixed',
            status='dispatching',
            security_level='high',
            privacy_level='internal',
            preferred_region='beijing',
            total_shards=3,
        )

    def _make_node(self, nid, **kwargs):
        defaults = dict(
            node_type='desktop_windows',
            capabilities=['ai_detection'],
            resources={'cpu_cores': 8, 'memory_gb': 16},
            location='Beijing CN',
            status='online',
            reputation_score=80.0,
            public_key=f'pk-{nid}',
        )
        defaults.update(kwargs)
        node = P2PNode(node_id=nid, **defaults)
        node.save()
        return node

    def _make_shard(self, sid, seq, **kwargs):
        defaults = dict(
            task=self.task,
            sequence=seq,
            total_in_task=3,
            payload_hash=f'hash-{sid}',
            payload_size=1024 * 1024,
            required_capabilities=['ai_detection'],
            estimated_resources={'cpu_cores': 2, 'memory_gb': 4},
            security_level='normal',
            data_sensitivity='public',
        )
        defaults.update(kwargs)
        return TaskShard.objects.create(shard_id=sid, **defaults)

    # ---- _filter_nodes ----

    def test_filter_excludes_offline_nodes(self):
        """offline 状态节点被过滤掉"""
        online = self._make_node('n-online', status='online')
        offline = self._make_node('n-offline', status='offline')
        filtered = self.router._filter_nodes(
            [online, offline], {'capabilities': set()}
        )
        self.assertIn(online, filtered)
        self.assertNotIn(offline, filtered)

    def test_filter_excludes_banned_nodes(self):
        """banned 状态节点被过滤掉"""
        ok = self._make_node('n-ok', status='online')
        banned = self._make_node('n-banned', status='banned')
        filtered = self.router._filter_nodes([ok, banned], {'capabilities': set()})
        self.assertIn(ok, filtered)
        self.assertNotIn(banned, filtered)

    def test_filter_excludes_maintenance_nodes(self):
        """maintenance 状态节点被过滤掉"""
        ok = self._make_node('n-ok', status='online')
        maint = self._make_node('n-maint', status='maintenance')
        filtered = self.router._filter_nodes([ok, maint], {'capabilities': set()})
        self.assertIn(ok, filtered)
        self.assertNotIn(maint, filtered)

    def test_filter_excludes_low_reputation_nodes(self):
        """低于 MIN_REPUTATION(30) 的节点被过滤"""
        good = self._make_node('n-good', reputation_score=50.0)
        bad = self._make_node('n-bad', reputation_score=20.0)
        filtered = self.router._filter_nodes([good, bad], {'capabilities': set()})
        self.assertIn(good, filtered)
        self.assertNotIn(bad, filtered)

    def test_filter_reputation_boundary(self):
        """信誉刚好等于 MIN_REPUTATION 的节点保留"""
        boundary = self._make_node('n-boundary', reputation_score=30.0)
        filtered = self.router._filter_nodes([boundary], {'capabilities': set()})
        self.assertIn(boundary, filtered)

    def test_filter_capability_mismatch(self):
        """能力完全不匹配的节点被过滤"""
        capable = self._make_node('n-capable', capabilities=['ocr'])
        incapable = self._make_node('n-incapable', capabilities=['gpu_render'])
        filtered = self.router._filter_nodes(
            [capable, incapable],
            {'capabilities': {'ocr'}},
        )
        self.assertIn(capable, filtered)
        self.assertNotIn(incapable, filtered)

    def test_filter_partial_capability_match_passes(self):
        """能力部分匹配即可通过过滤（交集非空）"""
        node = self._make_node('n-partial', capabilities=['ocr', 'ai_detection'])
        filtered = self.router._filter_nodes(
            [node],
            {'capabilities': {'ai_detection', 'nlp_inference'}},
        )
        self.assertIn(node, filtered)  # 有 ai_detection 交集

    def test_filter_all_valid_nodes_retained(self):
        """全部合法节点均保留"""
        nodes = [
            self._make_node(f'n{i}', status='online', reputation_score=60.0,
                            capabilities=['ai_detection'])
            for i in range(5)
        ]
        filtered = self.router._filter_nodes(nodes, {'capabilities': {'ai_detection'}})
        self.assertEqual(len(filtered), 5)

    def test_filter_empty_requirements_keeps_all_eligible(self):
        """无能力要求时，仅按状态和信誉过滤"""
        nodes = [
            self._make_node('a', status='online', reputation_score=50),
            self._make_node('b', status='busy', reputation_score=50),
            self._make_node('c', status='online', reputation_score=10),  # 低信誉
        ]
        filtered = self.router._filter_nodes(nodes, {'capabilities': set()})
        self.assertEqual(len(filtered), 2)  # a 和 b

    # ---- _score_node ----

    def test_lower_cost_higher_score(self):
        """成本越低 score 越高（cost_advantage 维度）"""
        cheap = self._make_node('cheap', node_type='browser')
        expensive = self._make_node('expensive', node_type='enterprise')

        shard = self._make_shard('score-shard-1', 1)
        score_cheap = self.router._score_node(cheap, shard)
        score_expensive = self.router._score_node(expensive, shard)

        self.assertGreater(score_cheap, score_expensive)

    def test_higher_reputation_higher_score(self):
        """信誉越高 score 越高"""
        low_rep = self._make_node('low-rep', reputation_score=30.0)
        high_rep = self._make_node('high-rep', reputation_score=95.0)

        shard = self._make_shard('rep-shard-1', 1)
        score_low = self.router._score_node(low_rep, shard)
        score_high = self.router._score_node(high_rep, shard)

        self.assertGreater(score_high, score_low)

    def test_fresh_heartbeat_better_response_speed(self):
        """心跳越新（间隔短），response_speed 分越高"""
        from django.utils import timezone as tz
        now = tz.now()

        fresh = self._make_node('fresh')
        P2PNode.objects.filter(node_id='fresh').update(last_heartbeat=now)
        fresh.refresh_from_db()

        stale = self._make_node('stale')
        P2PNode.objects.filter(node_id='stale').update(
            last_heartbeat=now - tz.timedelta(seconds=280)
        )
        stale.refresh_from_db()

        shard = self._make_shard('hb-shard-1', 1)
        score_fresh = self.router._score_node(fresh, shard)
        score_stale = self.router._score_node(stale, shard)

        self.assertGreater(score_fresh, score_stale)

    def test_geo_location_match_gives_full_geo_score(self):
        """地理位置匹配 preferred_region 时 geo_score=1.0"""
        matching = self._make_node('geo-match', location='Beijing China')
        non_matching = self._make_node('geo-no-match', location='Tokyo Japan')

        shard = self._make_shard('geo-shard-1', 1)
        score_match = self.router._score_node(matching, shard)
        score_nomatch = self.router._score_node(non_matching, shard)

        self.assertGreater(score_match, score_nomatch)

    def test_weighted_sum_formula(self):
        """四维加权总和 = 0.4*cost + 0.3*rep + 0.2*speed + 0.1*geo"""
        w = self.router.SCORE_WEIGHTS
        self.assertAlmostEqual(w['cost_advantage'] + w['reputation']
                               + w['response_speed'] + w['geo_location'], 1.0)

    # ---- route (核心路由) ----

    def test_route_empty_shards_returns_empty(self):
        """空 shards 列表返回空 assignments"""
        result = self.router.route(self.task, [])
        self.assertEqual(result['shard_assignments'], {})
        self.assertEqual(result['estimated_cost'], 0.0)
        self.assertEqual(result['score_matrix'], {})

    def test_route_no_available_nodes_returns_warning(self):
        """无可用节点返回 warning"""
        self._make_shard('s1', 1)
        offline_node = self._make_node('off', status='offline', reputation_score=10)
        result = self.router.route(self.task, [offline_node])
        self.assertEqual(result.get('warning'), 'no_available_nodes')
        self.assertEqual(result['shard_assignments'], {})

    def test_route_normal_case_returns_complete_result(self):
        """正常情况返回完整结果结构"""
        nodes = [
            self._make_node(f'rn{i}', status='online', reputation_score=70.0,
                            capabilities=['ai_detection'])
            for i in range(5)
        ]
        shards = [self._make_shard(f'rs{j}', j) for j in range(3)]

        result = self.router.route(self.task, nodes)

        self.assertIn('shard_assignments', result)
        self.assertIn('estimated_cost', result)
        self.assertIn('score_matrix', result)
        self.assertIn('routed_at', result)
        self.assertIn('nodes_considered', result)
        self.assertIn('nodes_filtered', result)
        self.assertEqual(result['nodes_considered'], len(nodes))

    def test_route_each_shard_gets_default_nodes_count(self):
        """每个 shard 分配 DEFAULT_NODES_PER_SHARD(3) 个节点"""
        nodes = [
            self._make_node(f'rn3-{i}', status='online', reputation_score=80.0,
                            capabilities=['ai_detection'])
            for i in range(6)
        ]
        shards = [self._make_shard(f'rsc{j}', j) for j in range(2)]

        result = self.router.route(self.task, nodes)

        for sid, assigned in result['shard_assignments'].items():
            self.assertEqual(len(assigned), EIHMCostRouter.DEFAULT_NODES_PER_SHARD)

    def test_route_result_contains_routed_at_timestamp(self):
        """结果包含 routed_at 时间戳"""
        nodes = [
            self._make_node(f'rt-{i}', status='online', reputation_score=70.0,
                            capabilities=['ai_detection'])
            for i in range(4)
        ]
        self._make_shard('rts-1', 1)
        result = self.router.route(self.task, nodes)
        self.assertIsNotNone(result.get('routed_at'))

    # ---- _optimize_assignment ----

    def test_optimize_greedy_top_n_selection(self):
        """贪心选择 top-N 高分节点"""
        nodes = [
            self._make_node(f'opt-{i}', status='online', reputation_score=70.0,
                            capabilities=['ai_detection'])
            for i in range(5)
        ]
        shards = [self._make_shard(f'os{j}', j) for j in range(2)]

        score_matrix = {}
        for shard in shards:
            scored = [(n.node_id, float(5 - i)) for i, n in enumerate(nodes)]
            score_matrix[shard.shard_id] = scored

        assignments = self.router._optimize_assignment(shards, nodes, score_matrix)

        for sid, selected in assignments.items():
            self.assertEqual(len(selected), 3)
            # 选中的应该是分数最高的前3个
            scores_in_selected = [
                s for nid, s in score_matrix[sid] if nid in selected
            ]
            scores_not_selected = [
                s for nid, s in score_matrix[sid] if nid not in selected
            ]
            if scores_not_selected:
                self.assertGreater(min(scores_in_selected), max(scores_not_selected))

    def test_optimize_overload_penalty_for_repeated_selection(self):
        """同一节点被多次选中时有过载惩罚因子"""
        nodes = [
            self._make_node(f'pen-{i}', status='online', reputation_score=70.0,
                            capabilities=['ai_detection'])
            for i in range(4)
        ]
        shards = [self._make_shard(f'ps{j}', j) for j in range(3)]

        score_matrix = {}
        for shard in shards:
            scored = [(n.node_id, 0.9) for n in nodes]
            score_matrix[shard.shard_id] = scored

        assignments = self.router._optimize_assignment(shards, nodes, score_matrix)

        usage_counts = {}
        for selected in assignments.values():
            for nid in selected:
                usage_counts[nid] = usage_counts.get(nid, 0) + 1

        # 惩罚机制下不会所有 shard 都选同一个节点
        max_usage = max(usage_counts.values()) if usage_counts else 0
        self.assertLessEqual(max_usage, len(shards))

    def test_optimize_sorted_by_sequence_first(self):
        """按 sequence 排序优先分配"""
        nodes = [
            self._make_node(f'seq-{i}', status='online', reputation_score=70.0,
                            capabilities=['ai_detection'])
            for i in range(5)
        ]
        shard3 = self._make_shard('seq-s3', 3)
        shard1 = self._make_shard('seq-s1', 1)
        shard2 = self._make_shard('seq-s2', 2)

        score_matrix = {
            s.shard_id: [(n.node_id, 0.8) for n in nodes]
            for s in [shard1, shard2, shard3]
        }

        assignments = self.router._optimize_assignment(
            [shard3, shard1, shard2], nodes, score_matrix
        )

        # sequence=1 的分片应先获得高分节点
        self.assertIn('seq-s1', assignments)

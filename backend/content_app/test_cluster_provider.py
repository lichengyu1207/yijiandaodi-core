"""P3 M4：ClusterProvider 集群客户端测试

覆盖：无节点回退 / 成功聚合 / 超时中止 / InferenceProvider 协议合规
"""

from django.test import SimpleTestCase

from content_app.inference.base import Completion, InferenceProvider
from content_app.inference.cluster_provider import ClusterProvider
from content_app.inference.exceptions import ClusterUnavailableError


class FakeGateway:
    """可控网关替身：submit / fetch_result / abort"""

    def __init__(self, submit_result='task-1', fetch_sequence=None):
        self.submit_result = submit_result
        # fetch_sequence：None 表示永不完成；字符串表示第 1 次即返回
        self.fetch_sequence = list(fetch_sequence) if fetch_sequence is not None else None
        self.submit_calls = []
        self.fetch_calls = []
        self.abort_calls = []

    def submit(self, messages, model=None, caller=None):
        self.submit_calls.append((messages, model, caller))
        return self.submit_result

    def fetch_result(self, task_id):
        self.fetch_calls.append(task_id)
        if self.fetch_sequence is None:
            return None
        if self.fetch_sequence:
            return self.fetch_sequence.pop(0)
        return None

    def abort(self, task_id):
        self.abort_calls.append(task_id)


class ClusterProviderTest(SimpleTestCase):

    def test_is_inference_provider(self):
        self.assertTrue(issubclass(ClusterProvider, InferenceProvider))
        self.assertEqual(ClusterProvider.name, 'cluster')

    # ------------------------------------------------------------------
    # 无在线节点 → 回退
    # ------------------------------------------------------------------

    def test_no_online_nodes_raises_cluster_unavailable(self):
        gw = FakeGateway(submit_result=None)
        prov = ClusterProvider(gateway=gw, timeout_sec=1)
        with self.assertRaises(ClusterUnavailableError) as ctx:
            prov.call([{'role': 'user', 'content': 'hi'}], caller='u1')
        self.assertEqual(ctx.exception.reason, 'no_online_nodes')
        self.assertEqual(gw.fetch_calls, [])  # 未进入轮询

    # ------------------------------------------------------------------
    # 成功：提交 → 轮询 → 聚合
    # ------------------------------------------------------------------

    def test_success_returns_cluster_completion(self):
        gw = FakeGateway(submit_result='task-9', fetch_sequence=['集群回复'])
        prov = ClusterProvider(gateway=gw, timeout_sec=5)
        comp = prov.call(
            [{'role': 'user', 'content': 'hi'}], model='m1', caller='u1'
        )
        self.assertIsInstance(comp, Completion)
        self.assertEqual(comp.provider, 'cluster')
        self.assertEqual(comp.content, '集群回复')
        self.assertEqual(gw.submit_calls[0][0][0]['content'], 'hi')
        self.assertEqual(gw.submit_calls[0][1], 'm1')
        self.assertEqual(gw.abort_calls, [])

    # ------------------------------------------------------------------
    # 超时 → 中止 + 回退
    # ------------------------------------------------------------------

    def test_timeout_aborts_and_raises_cluster_unavailable(self):
        gw = FakeGateway(submit_result='task-9', fetch_sequence=None)
        prov = ClusterProvider(gateway=gw, timeout_sec=0.1)
        with self.assertRaises(ClusterUnavailableError) as ctx:
            prov.call([{'role': 'user', 'content': 'hi'}], caller='u1')
        self.assertEqual(ctx.exception.reason, 'cluster_timeout')
        self.assertGreater(len(gw.fetch_calls), 0)
        self.assertEqual(gw.abort_calls, ['task-9'])

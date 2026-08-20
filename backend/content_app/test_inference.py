"""P1-5 推理引擎统一接口（M2：InferenceProvider）测试

覆盖：
- 工厂 get_inference_provider：默认 deepseek、强制 grok、未知名回退
- Completion 统一结果 & total_tokens 计算
- simple_complete 便捷接口组装消息
- DeepSeekProvider：解析响应、预算闸门拦截、模型覆盖
- GrokProvider：缺 Key 报错、成功调用、HTTP/网络错误记账
"""

from unittest import mock

from django.test import SimpleTestCase

from content_app.inference import (
    Completion,
    DeepSeekProvider,
    GrokProvider,
    InferenceProvider,
    get_inference_provider,
)


class FakeGate:
    """替代 DeepSeekBudgetGate 的假闸门，隔离 DB/cache 依赖"""

    def __init__(self, block=False):
        self.block = block
        self.events = []

    def check_allowed(self, caller=None):
        if self.block:
            return 'budget exceeded'
        return None

    def record_start(self, caller=None):
        self.events.append(('start', caller))

    def record_success(self):
        self.events.append(('success',))

    def record_failure(self):
        self.events.append(('failure',))


class FakeClient:
    """替代 DeepSeekClient 的假客户端"""

    def __init__(self, model='deepseek-chat', response=None):
        self.model = model
        self.response = response or {
            'model': 'deepseek-chat',
            'choices': [{'message': {'content': '你好，我是 DeepSeek'}}],
            'usage': {'prompt_tokens': 5, 'completion_tokens': 9, 'total_tokens': 14},
        }

    def chat_completion(self, messages, **kwargs):
        return self.response


class CompletionTest(SimpleTestCase):

    def test_total_tokens_from_total_field(self):
        comp = Completion(content='x', usage={'total_tokens': 42})
        self.assertEqual(comp.total_tokens, 42)

    def test_total_tokens_sums_prompt_and_completion(self):
        comp = Completion(content='x', usage={'prompt_tokens': 3, 'completion_tokens': 7})
        self.assertEqual(comp.total_tokens, 10)

    def test_total_tokens_empty_usage(self):
        comp = Completion(content='x', usage={})
        self.assertEqual(comp.total_tokens, 0)


class FactoryTest(SimpleTestCase):

    def tearDown(self):
        from content_app import inference as mod
        mod._PROVIDER_CACHE.clear()

    def test_default_is_deepseek(self):
        provider = get_inference_provider()
        self.assertIsInstance(provider, DeepSeekProvider)

    def test_forced_grok(self):
        provider = get_inference_provider('grok')
        self.assertIsInstance(provider, GrokProvider)

    def test_unknown_name_falls_back_to_deepseek(self):
        provider = get_inference_provider('openai')
        self.assertIsInstance(provider, DeepSeekProvider)

    def test_cache_reuses_instance(self):
        a = get_inference_provider('grok')
        b = get_inference_provider('grok')
        self.assertIs(a, b)


class SimpleCompleteTest(SimpleTestCase):

    def test_simple_complete_builds_messages_and_returns_content(self):
        captured = {}

        class StubProvider(InferenceProvider):
            name = 'stub'

            def call(self, messages, model=None, **kw):
                captured['messages'] = messages
                captured['kw'] = kw
                return Completion(content='reply', provider='stub')

        provider = StubProvider()
        text = provider.simple_complete(
            '你好',
            system_prompt='你是助手',
            history=[{'role': 'assistant', 'content': 'hi'}],
            caller='user-1',
        )
        self.assertEqual(text, 'reply')
        self.assertEqual(captured['messages'], [
            {'role': 'system', 'content': '你是助手'},
            {'role': 'assistant', 'content': 'hi'},
            {'role': 'user', 'content': '你好'},
        ])
        self.assertEqual(captured['kw']['caller'], 'user-1')


@mock.patch('content_app.inference.deepseek_provider.get_budget_gate')
class DeepSeekProviderTest(SimpleTestCase):

    def test_call_parses_response(self, mock_gate):
        gate = FakeGate()
        mock_gate.return_value = gate
        provider = DeepSeekProvider(client=FakeClient())
        comp = provider.call(
            [{'role': 'user', 'content': 'hi'}],
            caller='user-1',
        )
        self.assertEqual(comp.provider, 'deepseek')
        self.assertEqual(comp.model, 'deepseek-chat')
        self.assertEqual(comp.content, '你好，我是 DeepSeek')
        self.assertEqual(comp.total_tokens, 14)
        # DeepSeekProvider 的记账委托给 DeepSeekClient 内部完成，此处只验证放行
        self.assertFalse(gate.block)

    def test_call_blocked_by_budget_gate(self, mock_gate):
        gate = FakeGate(block=True)
        mock_gate.return_value = gate
        provider = DeepSeekProvider(client=FakeClient())
        with self.assertRaises(PermissionError):
            provider.call([{'role': 'user', 'content': 'hi'}], caller='user-1')

    def test_call_model_override_constructs_new_client(self, mock_gate):
        gate = FakeGate()
        mock_gate.return_value = gate
        provider = DeepSeekProvider(client=FakeClient(model='deepseek-chat'))
        new_client = FakeClient(model='deepseek-reasoner')
        new_client.response = {
            'model': 'deepseek-reasoner',
            'choices': [{'message': {'content': 'reasoned'}}],
            'usage': {'total_tokens': 8},
        }
        with mock.patch(
            'content_app.inference.deepseek_provider.DeepSeekClient',
            return_value=new_client,
        ):
            comp = provider.call(
                [{'role': 'user', 'content': 'hi'}],
                model='deepseek-reasoner',
                caller='user-1',
            )
        self.assertEqual(comp.model, 'deepseek-reasoner')
        self.assertEqual(comp.content, 'reasoned')


@mock.patch('content_app.inference.grok_provider.get_budget_gate')
@mock.patch('content_app.inference.grok_provider.requests.post')
class GrokProviderTest(SimpleTestCase):

    def test_call_missing_api_key_raises(self, mock_post, mock_gate):
        with mock.patch.dict('os.environ', {'GROK_API_KEY': ''}, clear=False):
            provider = GrokProvider()
            with self.assertRaises(RuntimeError):
                provider.call([{'role': 'user', 'content': 'hi'}])

    def test_call_success(self, mock_post, mock_gate):
        gate = FakeGate()
        mock_gate.return_value = gate
        mock_post.return_value = mock.Mock(
            status_code=200,
            raise_for_status=mock.Mock(),
            json=lambda: {
                'model': 'grok-2-latest',
                'choices': [{'message': {'content': '你好，Grok'}}],
                'usage': {'prompt_tokens': 4, 'completion_tokens': 6, 'total_tokens': 10},
            },
        )
        provider = GrokProvider(api_key='test-key')
        comp = provider.call(
            [{'role': 'user', 'content': 'hi'}],
            caller='user-1',
        )
        self.assertEqual(comp.provider, 'grok')
        self.assertEqual(comp.model, 'grok-2-latest')
        self.assertEqual(comp.content, '你好，Grok')
        self.assertEqual(comp.total_tokens, 10)
        # 校验请求头 / URL / 载荷
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], 'https://api.x.ai/v1/chat/completions')
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer test-key')
        self.assertEqual(kwargs['json']['model'], 'grok-2-latest')
        self.assertEqual(kwargs['json']['stream'], False)
        self.assertTrue(any(e[0] == 'start' for e in gate.events))
        self.assertTrue(any(e[0] == 'success' for e in gate.events))

    def test_call_http_error_records_failure(self, mock_post, mock_gate):
        gate = FakeGate()
        mock_gate.return_value = gate
        err = mock.Mock()
        err.response.status_code = 429
        err.response.text = 'rate limited'
        mock_post.side_effect = __import__('requests').exceptions.HTTPError('err', response=err.response)
        provider = GrokProvider(api_key='test-key')
        with self.assertRaises(RuntimeError):
            provider.call([{'role': 'user', 'content': 'hi'}])
        self.assertTrue(any(e[0] == 'failure' for e in gate.events))

    def test_call_network_error_records_failure(self, mock_post, mock_gate):
        gate = FakeGate()
        mock_gate.return_value = gate
        mock_post.side_effect = __import__('requests').exceptions.ConnectionError('boom')
        provider = GrokProvider(api_key='test-key')
        with self.assertRaises(__import__('requests').exceptions.ConnectionError):
            provider.call([{'role': 'user', 'content': 'hi'}])
        self.assertTrue(any(e[0] == 'failure' for e in gate.events))

    def test_call_blocked_by_budget_gate(self, mock_post, mock_gate):
        gate = FakeGate(block=True)
        mock_gate.return_value = gate
        provider = GrokProvider(api_key='test-key')
        with self.assertRaises(PermissionError):
            provider.call([{'role': 'user', 'content': 'hi'}])
        mock_post.assert_not_called()

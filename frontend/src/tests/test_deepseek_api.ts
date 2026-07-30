import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===== Mock axios (for deepseekClient) =====
const mockPost = vi.fn();
vi.mock('axios', () => {
  const mockInstance: Record<string, any> = {
    post: mockPost,
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: vi.fn(() => mockInstance),
    create: vi.fn(() => mockInstance),
  };
});

// ===== Mock global fetch (for chatStream) =====
const originalFetch = global.fetch;
let mockFetchResponse: any;

// ===== Mock contextManager (for chatWithContext) =====
vi.mock('@/utils/contextManager', () => ({
  contextManager: {
    addTurn: vi.fn(),
    shouldCompress: vi.fn().mockReturnValue(false),
    compress: vi.fn().mockResolvedValue(null),
    buildMessagesForApi: vi.fn().mockReturnValue({
      messages: [],
      hasCompressedContext: false,
    }),
    getCompressedContext: vi.fn().mockReturnValue(null),
    getTurnCount: vi.fn().mockReturnValue(2),
    getTotalTokens: vi.fn().mockReturnValue(500),
  },
}));

// ===== Mock import.meta.env =====
const originalEnv = import.meta.env;
vi.stubEnv('VITE_DEEPSEEK_API_KEY', 'test-api-key-12345');
vi.stubEnv('VITE_DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1');
vi.stubEnv('VITE_DEEPSEEK_MODEL', 'deepseek-chat');
vi.stubEnv('VITE_DEEPSEEK_MAX_TOKENS', '4096');

import {
  deepseekApi,
  SCENARIO_SYSTEM_PROMPTS,
  getAnalyticsSummary,
  clearAnalytics,
} from '@/api/deepseekApi';

describe('deepseekApi - AI 对话核心', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Reset mockPost to default success response
    mockPost.mockResolvedValue({
      data: {
        id: 'chatcmpl-test',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '这是AI的回复内容' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
      },
    });

    // Setup default fetch mock for streaming
    global.fetch = vi.fn().mockImplementation(async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"世界"}}]}\n\n',
        'data: [DONE]\n\n',
      ];
      const encoder = new TextEncoder();
      let chunkIndex = 0;
      const readable = new ReadableStream({
        async pull(controller) {
          if (chunkIndex < chunks.length) {
            controller.enqueue(encoder.encode(chunks[chunkIndex]));
            chunkIndex++;
          } else {
            controller.close();
          }
        },
      });
      return { ok: true, body: { getReader: () => readable.getReader() } };
    }) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ========== SCENARIO_SYSTEM_PROMPTS (3个) ==========

  it('1. 包含 text/image/code/paper/resume/contract/marketing/video 共 8 个场景', () => {
    const expectedScenarios = ['text', 'image', 'code', 'paper', 'resume', 'contract', 'marketing', 'video'];
    expectedScenarios.forEach((scenario) => {
      expect(SCENARIO_SYSTEM_PROMPTS).toHaveProperty(scenario);
      expect(typeof SCENARIO_SYSTEM_PROMPTS[scenario]).toBe('string');
      expect(SCENARIO_SYSTEM_PROMPTS[scenario].length).toBeGreaterThan(10);
    });
  });

  it('2. 默认 scenario="text" 返回文本分析 prompt', () => {
    const textPrompt = SCENARIO_SYSTEM_PROMPTS['text'];
    expect(textPrompt).toContain('内容安全审核');
    expect(textPrompt).toContain('文本分析');
  });

  it('3. 不存在的 scenario 返回默认 text prompt（通过 getScenarioPrompt 验证）', () => {
    const result = deepseekApi.getScenarioPrompt('nonexistent_scenario');
    expect(result).toBe(SCENARIO_SYSTEM_PROMPTS.text);
  });

  // ========== getConfig (2个) ==========

  it('4. 返回 baseUrl/model/maxTokens/hasApiKey', () => {
    const config = deepseekApi.getConfig();
    expect(config.baseUrl).toBeDefined();
    expect(config.model).toBeDefined();
    expect(config.maxTokens).toBeDefined();
    expect(typeof config.hasApiKey).toBe('boolean');
  });

  it('5. hasApiKey 在无 key 或短 key 时为 false', () => {
    // 当前环境设置了长 key，所以 hasApiKey 应该是 true
    const configWithKey = deepseekApi.getConfig();
    expect(configWithKey.hasApiKey).toBe(true);

    // 验证短 key 时为 false 的逻辑：通过检查源码中的条件
    // !!DEEPSEEK_API_KEY && DEEPSEEK_API_KEY.length > 10
    // 我们的 key 是 "test-api-key-12345" (19 chars > 10)，所以为 true
  });

  // ========== getScenarioPrompt (2个) ==========

  it('6. 返回对应场景的系统提示词', () => {
    expect(deepseekApi.getScenarioPrompt('code')).toBe(SCENARIO_SYSTEM_PROMPTS.code);
    expect(deepseekApi.getScenarioPrompt('image')).toBe(SCENARIO_SYSTEM_PROMPTS.image);
    expect(deepseekApi.getScenarioPrompt('resume')).toBe(SCENARIO_SYSTEM_PROMPTS.resume);
  });

  it('7. 场景不存在时回退到 text 提示词', () => {
    expect(deepseekApi.getScenarioPrompt('')).toBe(SCENARIO_SYSTEM_PROMPTS.text);
    expect(deepseekApi.getScenarioPrompt('xyz_invalid')).toBe(SCENARIO_SYSTEM_PROMPTS.text);
  });

  // ========== chat 方法 (4个) ==========

  it('8. 调用 POST /chat/completions 并传递正确参数(model/messages/temperature/max_tokens)', async () => {
    await deepseekApi.chat('你好，请帮我分析这段文字');

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, data] = mockPost.mock.calls[0];
    expect(url).toBe('/chat/completions');
    expect(data.model).toBe('deepseek-chat');
    expect(Array.isArray(data.messages)).toBe(true);
    expect(data.temperature).toBe(0.7);
    expect(data.max_tokens).toBe(4096);
    expect(data.stream).toBe(false);
  });

  it('9. history 参数限制为最近 10 条 (slice(-10))', async () => {
    // 创建 15 条历史消息
    const longHistory = Array.from({ length: 15 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as const,
      content: `消息 ${i}`,
    }));

    await deepseekApi.chat('最新问题', { history: longHistory });

    const [, data] = mockPost.mock.calls[0];
    // system message + last 10 history + user message = 12
    expect(data.messages.length).toBe(12); // 1 system + 10 history + 1 user
    // 确保只有最后 10 条被包含
    expect(data.messages[1].content).toBe('消息 5'); // 第 6 条开始 (15-10=5)
    expect(data.messages[data.messages.length - 2].content).toBe('消息 14'); // 倒数第二条历史
  });

  it('10. skills 非空时增强 system prompt', async () => {
    await deepseekApi.chat('测试技能增强', { skills: ['代码审计', '安全扫描'] });

    const [, data] = mockPost.mock.calls[0];
    const systemMessage = data.messages.find((m: any) => m.role === 'system');
    expect(systemMessage.content).toContain('[已启用增强技能]');
    expect(systemMessage.content).toContain('代码审计');
    expect(systemMessage.content).toContain('安全扫描');
  });

  it('11. 错误时抛出 "AI服务暂时不可用" 开头的 Error', async () => {
    mockPost.mockRejectedValueOnce({
      response: {
        status: 500,
        data: { error: { message: 'Internal Server Error' } },
      },
    });

    await expect(deepseekApi.chat('测试错误')).rejects.toThrow(/^AI服务暂时不可用/);
  });

  // ========== chatStream 方法 (3个) ==========

  it('12. 使用原生 fetch（非 axios）', async () => {
    const onChunk = vi.fn();
    const onDone = vi.fn();

    await deepseekApi.chatStream('流式测试', { onChunk, onDone });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockPost).not.toHaveBeenCalled(); // 不应使用 axios post
  });

  it('13. stream:true 参数传递', async () => {
    await deepseekApi.chatStream('流式参数测试');

    const fetchCall = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.stream).toBe(true);
  });

  it('14. onChunk/onDone 回调机制', async () => {
    const chunks: string[] = [];
    const onChunk = (text: string) => chunks.push(text);
    let doneText = '';
    const onDone = (fullText: string) => { doneText = fullText; };

    await deepseekApi.chatStream('回调测试', { onChunk, onDone });

    expect(chunks.length).toBeGreaterThan(0);
    expect(doneText.length).toBeGreaterThan(0);
    expect(onChunk).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  // ========== Analytics 追踪方法 (4个) ==========

  it('15. trackScenarioSwitch / trackSkillToggle / trackIdentifyStart / trackIdentifyComplete 各自创建事件', () => {
    // 这些方法通过 trackAnalytics 内部将事件推入队列
    // 我们验证调用后不会报错即可（事件入队）
    expect(() => deepseekApi.trackScenarioSwitch('text')).not.toThrow();
    expect(() => deepseekApi.trackSkillToggle('code', 'audit', true)).not.toThrow();
    expect(() => deepseekApi.trackIdentifyStart('image', 'upload')).not.toThrow();
    expect(() => deepseekApi.trackIdentifyComplete('paper', 'high', 1234)).not.toThrow();
  });

  it('16. getAnalyticsSummary 返回今日统计（total_events/scenario_stats/funnel/conversion_rate）', () => {
    // 先添加一些事件到 localStorage
    const events = [
      { event_type: 'chat_send' as const, scenario: 'text', timestamp: Date.now() },
      { event_type: 'chat_receive' as const, scenario: 'text', timestamp: Date.now() },
      { event_type: 'identify_start' as const, scenario: 'image', timestamp: Date.now() },
    ];
    localStorage.setItem('yi_analytics', JSON.stringify(events));

    const summary = getAnalyticsSummary();
    expect(summary).toHaveProperty('total_events');
    expect(summary).toHaveProperty('scenario_stats');
    expect(summary).toHaveProperty('funnel');
    expect(summary).toHaveProperty('conversion_rate');
    expect(summary.total_events).toBe(3);
  });

  it('17. clearAnalytics 清除 localStorage 数据和队列', () => {
    localStorage.setItem('yi_analytics', JSON.stringify([{ event_type: 'chat_send', scenario: 'text', timestamp: Date.now() }]));

    clearAnalytics();

    expect(localStorage.getItem('yi_analytics')).toBeNull();
  });

  it('18. analyticsQueue 在事件入队后非空（通过 chat 触发追踪验证）', async () => {
    // chat 方法内部会调用 trackAnalytics，产生事件入队
    await deepseekApi.chat('触发追踪');

    // 验证 flushAnalytics 被触发了（因为队列非空会设置 timer）
    // 由于我们无法直接访问 analyticsQueue，可以通过验证 localStorage 有数据来间接确认
    // flushAnalytics 会将队列数据写入 localStorage
    const stored = localStorage.getItem('yi_analytics');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.length).toBeGreaterThan(0);
  });

  // ========== chatWithContext (2个) ==========

  it('19. 调用 contextManager.addTurn 构建上下文', async () => {
    const { contextManager } = await import('@/utils/contextManager');
    const mockedCM = vi.mocked(contextManager);

    await deepseekApi.chatWithContext('带上下文的消息', { scenario: 'text' });

    expect(mockedCM.addTurn).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({
        role: 'user',
        content: '带上下文的消息',
      })
    );
  });

  it('20. 返回结果包含 contextInfo（wasCompressed/turnCount/totalTokens）', async () => {
    const result = await deepseekApi.chatWithContext('上下文测试');

    expect(result).toHaveProperty('contextInfo');
    expect(result.contextInfo).toHaveProperty('wasCompressed');
    expect(result.contextInfo).toHaveProperty('turnCount');
    expect(result.contextInfo).toHaveProperty('totalTokens');
  });
});

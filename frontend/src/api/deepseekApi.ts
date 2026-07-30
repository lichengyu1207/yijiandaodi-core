import axios from 'axios';

/// <reference types="vite/client" />

// 多 Key 轮换池（Round-Robin）
const RAW_KEYS = ((import.meta as any).env?.VITE_DEEPSEEK_API_KEYS || (import.meta as any).env?.VITE_DEEPSEEK_API_KEY || '').trim();
const KEY_POOL: string[] = RAW_KEYS.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 10);
let _keyIndex = 0;

function getNextKey(): string {
  if (KEY_POOL.length === 0) return '';
  const key = KEY_POOL[_keyIndex % KEY_POOL.length];
  _keyIndex++;
  return key;
}

const DEEPSEEK_BASE_URL = (import.meta as any).env?.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = (import.meta as any).env?.VITE_DEEPSEEK_MODEL || 'deepseek-chat';
const DEEPSEEK_MAX_TOKENS = parseInt((import.meta as any).env?.VITE_DEEPSEEK_MAX_TOKENS || '4096');

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface AnalyticsEvent {
  event_type: 'chat_send' | 'chat_receive' | 'identify_start' | 'identify_complete' | 'pricing_view' | 'pricing_click' | 'scenario_switch' | 'skill_toggle';
  scenario: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

const analyticsQueue: AnalyticsEvent[] = [];
let analyticsTimer: ReturnType<typeof setInterval> | null = null;

const deepseekClient = axios.create({
  baseURL: DEEPSEEK_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 每次请求动态注入 Key（轮换）
deepseekClient.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${getNextKey()}`;
  return config;
});

export const SCENARIO_SYSTEM_PROMPTS: Record<string, string> = {
  text: '你是一位资深的内容安全审核专家和AI文本分析师。你的任务是：1)检测文本中的AI生成痕迹（语言模式、句式结构、用词习惯）；2)识别敏感词/违规内容；3)评估内容风险等级；4)提供专业优化建议。请用中文回答，格式清晰，给出具体的数据支撑。',
  image: '你是一位专业的图像安全分析专家和多模态AI研究员。你的任务是：1)分析图像是否经过AI生成或PS篡改；2)检测图像中是否存在违规视觉元素（涉黄、暴恐、政治敏感）；3)评估图像真实性和元数据完整性。请用中文回答，给出详细的分析过程。',
  code: '你是一位顶级的代码安全审计专家。你的任务是：1)扫描代码中的安全漏洞（SQL注入、XSS、SSRF等）；2)检测恶意代码（后门、Webshell、挖矿脚本）；3)识别隐私泄露风险（硬编码密钥、Token）；4)评估代码质量和AI生成/抄袭概率。请用中文回答，给出具体的代码行号和建议修复方案。',
  paper: '你是一位学术诚信审查专家。你的任务是：1)检测论文中的AI生成内容（语言模式、句式结构）；2)评估原创性和查重相似度；3)检测学术不端行为（抄袭、代写、数据造假）；4)检查引用规范性。请用中文回答，遵循学术规范。',
  resume: '你是一位资深HR专家和职业规划师。你的任务是：1)检测简历中的AI生成/润色痕迹；2)计算ATS系统兼容性评分(0-100)；3)分析关键词匹配度；4)评估简历结构完整性；5)提供具体优化建议和改写示例。请用中文回答，给出可操作的建议。',
  contract: '你是一位资深律师和法律顾问。你的任务是：1)评定合同综合风险等级(0-100分)；2)识别不公平条款（免责、违约、解约条款）；3)检测模板套用痕迹；4)检查关键要素完整性；5)基于民法典进行合规性比对；6)给出具体修订建议。请用中文回答，引用相关法律条文。',
  marketing: '你是一位顶级营销专家和数据分析师。你的任务是：1)检测营销文案的AI生成/洗稿概率；2)评估原创度得分(0-100%)；3)预测CTR/CVR转化指数(0-100分)；4)扫描广告法敏感词；5)分析情感倾向平衡度；6)检测爆款元素（痛点、钩子、CTA）。请用中文回答，给出数据驱动的优化建议。',
  video: '你是一位短视频运营专家和内容策略师。你的任务是：1)检测短视频脚本的AI生成/模板化程度；2)计算多维度爆款指数(0-100分)；3)预测完播率(考虑平台特性)；4)分析黄金前3秒吸引力设置；5)评估节奏与情绪曲线丰富度；6)针对目标平台做算法适配分析。请用中文回答，给出可执行的优化方案。',
};

const trackAnalytics = (event: Omit<AnalyticsEvent, 'timestamp'>) => {
  const fullEvent: AnalyticsEvent = {
    ...event,
    timestamp: Date.now(),
  };

  analyticsQueue.push(fullEvent);

  if (!analyticsTimer) {
    analyticsTimer = setTimeout(() => {
        flushAnalytics();
      }, 5000
    );
  }
};

const flushAnalytics = () => {
  if (analyticsQueue.length === 0) return;

  const eventsToSend = [...analyticsQueue];
  analyticsQueue.length = 0;

  if (analyticsTimer) {
    clearTimeout(analyticsTimer);
    analyticsTimer = null;
  }

  try {
    const stored = JSON.parse(localStorage.getItem('yi_analytics') || '[]');
    const updated = [...stored, ...eventsToSend];
    localStorage.setItem('yi_analytics', JSON.stringify(updated.slice(-1000)));

    console.log('[Analytics] 已记录', eventsToSend.length, '个事件:', eventsToSend.map(e => e.event_type + '(' + e.scenario + ')').join(', '));
  } catch (err) {
    console.error('[Analytics] 存储失败:', err);
  }
};

export const getAnalyticsSummary = () => {
  try {
    const events = JSON.parse(localStorage.getItem('yi_analytics') || '[]');
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);

    const todayEvents = events.filter((e: AnalyticsEvent) => e.timestamp >= todayStart);

    const scenarioStats: Record<string, { sends: number; receives: number; identifies: number }> = {};
    const funnelData = {
      chat_sends: 0,
      chat_receives: 0,
      identify_starts: 0,
      identify_completes: 0,
      pricing_views: 0,
      pricing_clicks: 0,
    };

    todayEvents.forEach((e: AnalyticsEvent) => {
      if (!scenarioStats[e.scenario]) {
        scenarioStats[e.scenario] = { sends: 0, receives: 0, identifies: 0 };
      }

      switch (e.event_type) {
        case 'chat_send':
          scenarioStats[e.scenario].sends++;
          funnelData.chat_sends++;
          break;
        case 'chat_receive':
          scenarioStats[e.scenario].receives++;
          funnelData.chat_receives++;
          break;
        case 'identify_start':
          scenarioStats[e.scenario].identifies++;
          funnelData.identify_starts++;
          break;
        case 'identify_complete':
          funnelData.identify_completes++;
          break;
        case 'pricing_view':
          funnelData.pricing_views++;
          break;
        case 'pricing_click':
          funnelData.pricing_clicks++;
          break;
      }
    });

    return {
      date: new Date().toLocaleDateString(),
      total_events: todayEvents.length,
      scenario_stats: scenarioStats,
      funnel: funnelData,
      conversion_rate: funnelData.identify_starts > 0
        ? ((funnelData.pricing_clicks / funnelData.identify_starts) * 100).toFixed(2) + '%'
        : '0%',
    };
  } catch (err) {
    return { error: '无法读取统计数据' };
  }
};

export const clearAnalytics = () => {
  localStorage.removeItem('yi_analytics');
  analyticsQueue.length = 0;
};

export const deepseekApi = {
  async chat(
    message: string,
    options: {
      scenario?: string;
      systemPrompt?: string;
      history?: ChatMessage[];
      skills?: string[];
      temperature?: number;
    } = {}
  ): Promise<{
    content: string;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    model: string;
  }> {
    const {
      scenario = 'text',
      systemPrompt,
      history = [],
      skills = [],
      temperature = 0.7,
    } = options;

    trackAnalytics({
      event_type: 'chat_send',
      scenario,
      metadata: {
        message_length: message.length,
        skills_count: skills.length,
        history_length: history.length,
      },
    });

    const systemContent = systemPrompt || SCENARIO_SYSTEM_PROMPTS[scenario] || SCENARIO_SYSTEM_PROMPTS.text;

    let enhancedSystemPrompt = systemContent;

    if (skills.length > 0) {
      const skillNames = skills.join('、');
      enhancedSystemPrompt += '\n\n[已启用增强技能]: ' + skillNames + '\n请在回答时充分考虑这些技能的要求，提供更深入的分析。';
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: enhancedSystemPrompt },
      ...history.slice(-10),
      { role: 'user', content: message },
    ];

    try {
      const response = await deepseekClient.post<DeepSeekResponse>('/chat/completions', {
        model: DEEPSEEK_MODEL,
        messages,
        temperature,
        max_tokens: DEEPSEEK_MAX_TOKENS,
        stream: false,
      });

      const data = response.data;
      const content = data.choices?.[0]?.message?.content || '抱歉，模型未返回有效回复。';
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      trackAnalytics({
        event_type: 'chat_receive',
        scenario,
        metadata: {
          response_length: content.length,
          usage: usage,
          model: DEEPSEEK_MODEL,
        },
      });

      return {
        content,
        usage,
        model: DEEPSEEK_MODEL,
      };
    } catch (error: any) {
      console.error('[DeepSeek API Error]', error);

      const errorMessage = error.response?.data?.error?.message || error.message || '网络请求异常';

      trackAnalytics({
        event_type: 'chat_receive',
        scenario,
        metadata: {
          error: errorMessage,
          status: error.response?.status,
        },
      });

      throw new Error('AI服务暂时不可用: ' + errorMessage);
    }
  },

  async chatStream(
    message: string,
    options: {
      scenario?: string;
      systemPrompt?: string;
      history?: ChatMessage[];
      skills?: string[];
      temperature?: number;
      onChunk?: (text: string) => void;
      onDone?: (fullText: string) => void;
      onError?: (error: Error) => void;
    } = {}
  ) {
    const {
      scenario = 'text',
      systemPrompt,
      history = [],
      skills = [],
      temperature = 0.7,
      onChunk,
      onDone,
      onError,
    } = options;

    trackAnalytics({
      event_type: 'chat_send',
      scenario,
      metadata: {
        message_length: message.length,
        skills_count: skills.length,
        stream: true,
      },
    });

    const systemContent = systemPrompt || SCENARIO_SYSTEM_PROMPTS[scenario] || SCENARIO_SYSTEM_PROMPTS.text;
    let enhancedSystemPrompt = systemContent;

    if (skills.length > 0) {
      enhancedSystemPrompt += '\n\n[已启用增强技能]: ' + skills.join('、') + '\n请在回答时充分考虑这些技能的要求。';
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: enhancedSystemPrompt },
      ...history.slice(-10),
      { role: 'user', content: message },
    ];

    try {
      const response = await fetch(DEEPSEEK_BASE_URL + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getNextKey()}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages,
          temperature,
          max_tokens: DEEPSEEK_MAX_TOKENS,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  onChunk?.(delta);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }

      trackAnalytics({
        event_type: 'chat_receive',
        scenario,
        metadata: {
          response_length: fullText.length,
          stream: true,
        },
      });

      onDone?.(fullText);
      return fullText;
    } catch (error: any) {
      console.error('[DeepSeek Stream Error]', error);
      const errorMessage = error.message || '流式请求异常';
      onError?.(new Error('AI服务暂时不可用: ' + errorMessage));

      trackAnalytics({
        event_type: 'chat_receive',
        scenario,
        metadata: { error: errorMessage, stream: true },
      });
    }
  },

  trackScenarioSwitch(scenario: string) {
    trackAnalytics({ event_type: 'scenario_switch', scenario });
  },

  trackSkillToggle(scenario: string, skillId: string, enabled: boolean) {
    trackAnalytics({
      event_type: 'skill_toggle',
      scenario,
      metadata: { skill_id: skillId, enabled },
    });
  },

  trackIdentifyStart(scenario: string, inputType: string) {
    trackAnalytics({
      event_type: 'identify_start',
      scenario,
      metadata: { input_type: inputType },
    });
  },

  trackIdentifyComplete(scenario: string, resultLevel: string, duration: number) {
    trackAnalytics({
      event_type: 'identify_complete',
      scenario,
      metadata: { result_level: resultLevel, duration_ms: duration },
    });
  },

  trackPricingView(scenario: string) {
    trackAnalytics({
      event_type: 'pricing_view',
      scenario,
    });
  },

  trackPricingClick(scenario: string, planId: string) {
    trackAnalytics({
      event_type: 'pricing_click',
      scenario,
      metadata: { plan_id: planId },
    });
  },

  getScenarioPrompt(scenario: string): string {
    return SCENARIO_SYSTEM_PROMPTS[scenario] || SCENARIO_SYSTEM_PROMPTS.text;
  },

  getConfig() {
    return {
      baseUrl: DEEPSEEK_BASE_URL,
      model: DEEPSEEK_MODEL,
      maxTokens: DEEPSEEK_MAX_TOKENS,
      keyPoolSize: KEY_POOL.length,
      hasApiKey: KEY_POOL.length > 0,
    };
  },

  async chatWithContext(
    message: string,
    options: {
      scenario?: string;
      systemPrompt?: string;
      sessionId?: string;
      skills?: string[];
      temperature?: number;
      onCompressStart?: () => void;
      onCompressComplete?: (summary: string) => void;
    } = {}
  ): Promise<{
    content: string;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    model: string;
    contextInfo?: { wasCompressed: boolean; summary?: string; turnCount: number; totalTokens: number };
  }> {
    const { contextManager } = await import('@/utils/contextManager');
    const sessionId = options.sessionId || 'default';
    const scenario = options.scenario || 'text';

    contextManager.addTurn(sessionId, {
      role: 'user',
      content: message,
      metadata: { scenario, skills: options.skills },
    });

    let compressedSummary: string | undefined;

    if (contextManager.shouldCompress(sessionId)) {
      options.onCompressStart?.();
      const compressed = await contextManager.compress(sessionId, {
        agentName: options.systemPrompt ? '' : undefined,
        scenario,
      });
      if (compressed) {
        compressedSummary = compressed.summary;
        options.onCompressComplete?.(compressed.summary);
      }
    }

    const { messages, hasCompressedContext } = contextManager.buildMessagesForApi(
      sessionId,
      message,
      options.systemPrompt || SCENARIO_SYSTEM_PROMPTS[scenario] || SCENARIO_SYSTEM_PROMPTS.text
    );

    const result = await this.chat(message, {
      ...options,
      history: messages.filter(m => m.role !== 'system' && m.role !== 'user' || m.content !== message),
    });

    contextManager.addTurn(sessionId, {
      role: 'assistant',
      content: result.content,
    });

    return {
      ...result,
      contextInfo: {
        wasCompressed: hasCompressedContext || !!compressedSummary,
        summary: compressedSummary || (hasCompressedContext ? contextManager.getCompressedContext(sessionId)?.summary : undefined),
        turnCount: contextManager.getTurnCount(sessionId),
        totalTokens: contextManager.getTotalTokens(sessionId),
      },
    };
  },
};

window.addEventListener('beforeunload', () => {
  flushAnalytics();
});

setInterval(() => {
  if (analyticsQueue.length > 0) {
    flushAnalytics();
  }
}, 30000);

export default deepseekApi;

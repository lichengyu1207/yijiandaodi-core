import { ChatMessage } from '@/api/deepseekApi';
import deepseekApi from '@/api/deepseekApi';

export interface ContextTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tokenEstimate: number;
  metadata?: {
    scenario?: string;
    agentName?: string;
    level?: string;
    skills?: string[];
  };
}

export interface CompressedContext {
  summary: string;
  keyPoints: string[];
  mindMapData: MindMapNode;
  originalTurnCount: number;
  compressedAt: number;
  tokenSaved: number;
}

export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
  metadata?: { type?: string; value?: string; severity?: string };
}

const CONFIG = {
  /** 累积多少轮后开始考虑压缩（调优：8轮比6轮更合理，避免过早压缩） */
  MAX_TURNS_BEFORE_COMPRESS: 8,
  /** token 估算超过此值才触发压缩 */
  COMPRESSION_THRESHOLD_TOKENS: 4000,
  /** 单次API请求最大上下文token（保守值：DeepSeek上下文窗口虽大，但长上下文质量下降） */
  MAX_CONTEXT_TOKENS: 8000,
  /** 压缩时保留最近几轮原始对话不动 */
  KEEP_RECENT_TURNS: 3,
  /** 硬上限：单会话最多保留多少轮（超出强制截断最旧对话，防止内存/API无限膨胀） */
  MAX_TOTAL_TURNS: 20,
  /** 压缩失败时的重试次数 */
  MAX_COMPRESS_RETRIES: 1,
};

function estimateTokens(text: string): number {
  const len = text.length;
  if (len === 0) return 0;
  let count = 0;
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);
    if (code < 128) count += 1;
    else if (code < 2048) count += 2;
    else if (code < 65536) count += 3;
    else count += 4;
  }
  return Math.ceil(count * 0.55);
}

class ContextManagerImpl {
  private turns: Map<string, ContextTurn[]> = new Map();
  private compressedContexts: Map<string, CompressedContext> = new Map();
  private compressionCallbacks: Array<(sessionId: string, compressed: CompressedContext) => void> = [];

  addTurn(sessionId: string, turn: Omit<ContextTurn, 'id' | 'timestamp' | 'tokenEstimate'>) {
    if (!this.turns.has(sessionId)) {
      this.turns.set(sessionId, []);
    }
    const fullTurn: ContextTurn = {
      ...turn,
      id: 'turn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      timestamp: Date.now(),
      tokenEstimate: estimateTokens(turn.content),
    };
    const list = this.turns.get(sessionId)!;
    list.push(fullTurn);

    // 硬截断保护：超过 MAX_TOTAL_TURNS 时丢弃最旧的对话
    if (list.length > CONFIG.MAX_TOTAL_TURNS) {
      const discarded = list.splice(0, list.length - CONFIG.MAX_TOTAL_TURNS);
      console.warn(`[ContextManager] 会话 ${sessionId} 达到硬上限 ${CONFIG.MAX_TOTAL_TURNS} 轮，已截断 ${discarded.length} 轮最旧对话`);
    }
  }

  getTurns(sessionId: string): ContextTurn[] {
    return this.turns.get(sessionId) || [];
  }

  getTotalTokens(sessionId: string): number {
    const turns = this.turns.get(sessionId) || [];
    return turns.reduce((sum, t) => sum + t.tokenEstimate, 0);
  }

  getTurnCount(sessionId: string): number {
    return (this.turns.get(sessionId) || []).length;
  }

  shouldCompress(sessionId: string): boolean {
    const turns = this.turns.get(sessionId) || [];
    if (turns.length < CONFIG.MAX_TURNS_BEFORE_COMPRESS) return false;
    const totalTokens = this.getTotalTokens(sessionId);
    return totalTokens > CONFIG.COMPRESSION_THRESHOLD_TOKENS;
  }

  async compress(sessionId: string, contextInfo?: { agentName?: string; scenario?: string }): Promise<CompressedContext | null> {
    const turns = this.turns.get(sessionId) || [];
    if (turns.length < 3) return null;

    const turnsToCompress = turns.slice(0, -CONFIG.KEEP_RECENT_TURNS);
    if (turnsToCompress.length === 0) return null;

    const conversationText = turnsToCompress
      .map(t => '[' + t.role.toUpperCase() + '] ' + t.content)
      .join('\n\n');

    const compressPrompt = '你是一个智能上下文压缩引擎。请对以下对话历史进行深度分析和压缩。\n\n'
      + '【对话历史】\n' + conversationText + '\n\n'
      + '请严格按照以下JSON格式输出（不要输出其他内容）：\n'
      + '{\n'
      + '  "summary": "用2-3句话概括整个对话的核心内容和结论",\n'
      + '  "keyPoints": ["关键点1", "关键点2", "关键点3", "关键点4", "关键点5"],\n'
      + '  "mindMap": {\n'
      + '    "id": "root",\n'
      + '    "label": "对话主题概览",\n'
      + '    "children": [\n'
      + '      {\n'
      + '        "id": "topic-1",\n'
      + '        "label": "一级分类名",\n'
      + '        "children": [\n'
      + '          {"id": "sub-1-1", "label": "具体要点", "metadata": {"type": "info|risk|action|decision"}},\n'
      + '          {"id": "sub-1-2", "label": "具体要点2"}\n'
      + '        ]\n'
      + '      }\n'
      + '    ]\n'
      + '  }\n'
      + '}';

    // 带重试的压缩调用
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= CONFIG.MAX_COMPRESS_RETRIES; attempt++) {
      try {
        const result = await deepseekApi.chat(compressPrompt, {
          scenario: contextInfo?.scenario || 'text',
          systemPrompt: '你是专业的上下文分析引擎。你的任务是将长对话历史压缩为结构化的摘要、关键点和思维导图。保持信息的准确性和完整性，去除冗余内容。',
          temperature: 0.2,
        });

        let parsed: any = {};
        try {
          const jsonMatch = result.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.warn('[ContextManager] 压缩结果解析失败，使用fallback:', e);
        }

        const compressed = this.buildCompressedResult(parsed, turnsToCompress);

        // 成功：替换为保留的最近轮次
        const remainingTurns = turns.slice(-CONFIG.KEEP_RECENT_TURNS);
        this.turns.set(sessionId, remainingTurns);
        this.compressedContexts.set(sessionId, compressed);

        this.compressionCallbacks.forEach(cb => {
          try { cb(sessionId, compressed); } catch (e) {}
        });

        console.log('[ContextManager] 会话压缩完成:', sessionId,
          '节省', compressed.tokenSaved, 'tokens,', compressed.originalTurnCount, '轮→摘要');

        return compressed;
      } catch (err) {
        lastError = err as Error;
        console.warn(`[ContextManager] 压缩尝试 ${attempt + 1}/${CONFIG.MAX_COMPRESS_RETRIES + 1} 失败:`, err);
      }
    }

    // 所有重试都失败 → 兜底清理
    console.error('[ContextManager] 压缩全部失败（共' + (CONFIG.MAX_COMPRESS_RETRIES + 1) + '次），执行兜底清理:', lastError?.message);
    return this.fallbackCompress(sessionId, turnsToCompress);
  }

  /** 构建压缩结果对象（从 API 解析或 fallback 数据） */
  private buildCompressedResult(parsed: any, turnsToCompress: ContextTurn[]): CompressedContext {
    return {
      summary: parsed.summary || '对话已完成多轮分析，包含输入检测、风险评估和报告生成。',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [
        '已完成内容安全审计',
        '风险等级已评估',
        '生成结构化分析报告',
      ],
      mindMapData: parsed.mindMap || {
        id: 'root', label: '对话概览',
        children: [
          { id: 't1', label: '检测结果', children: [
            { id: 't1-1', label: '安全等级评估' },
            { id: 't1-2', label: '风险项识别' },
          ]},
          { id: 't2', label: '关键发现', children: [
            { id: 't2-1', label: '核心问题' },
            { id: 't2-2', label: '建议措施' },
          ]},
        ],
      },
      originalTurnCount: turnsToCompress.length,
      compressedAt: Date.now(),
      tokenSaved: turnsToCompress.reduce((sum, t) => sum + t.tokenEstimate, 0),
    };
  }

  /** 压缩API全部失败时的兜底方案：本地生成摘要并截断旧对话 */
  private fallbackCompress(sessionId: string, turnsToCompress: ContextTurn[]): CompressedContext | null {
    try {
      const userMsgs = turnsToCompress.filter(t => t.role === 'user').map(t => t.content);
      const assistantMsgs = turnsToCompress.filter(t => t.role === 'assistant').map(t => t.content);
      const fallbackSummary = '已完成 ' + turnsToCompress.length + ' 轮连续对话（'
        + userMsgs.length + ' 次用户输入 / ' + assistantMsgs.length + ' 次AI回复）。'
        + '历史上下文已自动摘要化以保持会话连贯性。';

      const compressed = this.buildCompressedResult(
        { summary: fallbackSummary, keyPoints: ['已完成多轮分析检测', '历史上下文已保留摘要'] },
        turnsToCompress
      );

      const turns = this.turns.get(sessionId) || [];
      const remainingTurns = turns.slice(-CONFIG.KEEP_RECENT_TURNS);
      this.turns.set(sessionId, remainingTurns);
      this.compressedContexts.set(sessionId, compressed);

      console.log('[ContextManager] 兜底清理完成:', sessionId, '本地摘要替代API压缩');
      return compressed;
    } catch (err) {
      console.error('[ContextManager] 兜底清理也失败了:', err);
      return null;
    }
  }

  getCompressedContext(sessionId: string): CompressedContext | null {
    return this.compressedContexts.get(sessionId) || null;
  }

  buildMessagesForApi(
    sessionId: string,
    currentMessage: string,
    systemPrompt: string,
    options?: { maxHistoryTurns?: number }
  ): { messages: ChatMessage[]; hasCompressedContext: boolean; compressedSummary?: string } {
    const maxTurns = options?.maxHistoryTurns || 10;
    const turns = this.turns.get(sessionId) || [];
    const compressed = this.compressedContexts.get(sessionId);

    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

    let hasCompressed = false;

    if (compressed && turns.length > 0) {
      hasCompressed = true;
      const contextInjection = '\n\n[上下文记忆 - 已压缩' + compressed.originalTurnCount + '轮对话]\n'
        + '摘要: ' + compressed.summary + '\n'
        + '关键要点:\n' + compressed.keyPoints.map((p, i) => (i + 1) + '. ' + p).join('\n')
        + '\n\n请基于以上历史上下文，结合用户最新输入进行分析。注意保持分析的连贯性和一致性。';

      messages.push({ role: 'assistant', content: '[系统注: 已加载历史上下文摘要，共' + compressed.keyPoints.length + '个关键要点]' });
      messages[0] = { role: 'system', content: systemPrompt + contextInjection };
    }

    // Token 上限保护：从最近往前取，直到不超过 MAX_CONTEXT_TOKENS
    let recentTurns = turns.slice(-maxTurns);
    let estimatedMsgTokens = estimateTokens(systemPrompt)
      + (hasCompressed && compressed ? estimateTokens(compressed.summary) + compressed.keyPoints.reduce((s, p) => s + estimateTokens(p), 0) : 0)
      + estimateTokens(currentMessage);
    const safeTurns: ContextTurn[] = [];

    for (let i = recentTurns.length - 1; i >= 0; i--) {
      const turn = recentTurns[i];
      if (estimatedMsgTokens + turn.tokenEstimate > CONFIG.MAX_CONTEXT_TOKENS && safeTurns.length > 0) break;
      safeTurns.unshift(turn);
      estimatedMsgTokens += turn.tokenEstimate;
    }

    if (safeTurns.length < recentTurns.length) {
      console.warn(`[ContextManager] Token 上限触发：${recentTurns.length} 轮 → 截断为 ${safeTurns.length} 轮（估算 ${Math.round(estimatedMsgTokens)} / ${CONFIG.MAX_CONTEXT_TOKENS} tokens）`);
    }

    for (const turn of safeTurns) {
      messages.push({ role: turn.role, content: turn.content });
    }

    messages.push({ role: 'user', content: currentMessage });

    return { messages, hasCompressedContext: hasCompressed, compressedSummary: compressed?.summary };
  }

  clearSession(sessionId: string) {
    this.turns.delete(sessionId);
    this.compressedContexts.delete(sessionId);
  }

  getAllSessions(): string[] {
    return Array.from(this.turns.keys());
  }

  onCompressed(callback: (sessionId: string, compressed: CompressedContext) => void) {
    this.compressionCallbacks.push(callback);
    return () => {
      this.compressionCallbacks = this.compressionCallbacks.filter(cb => cb !== callback);
    };
  }

  getSessionStats(sessionId: string): {
    turnCount: number;
    totalTokens: number;
    compressedCount: number;
    lastCompressedAt: number | null;
  } {
    const turns = this.turns.get(sessionId) || [];
    const compressed = this.compressedContexts.get(sessionId);
    return {
      turnCount: turns.length,
      totalTokens: this.getTotalTokens(sessionId),
      compressedCount: compressed?.originalTurnCount || 0,
      lastCompressedAt: compressed?.compressedAt || null,
    };
  }
}

export const contextManager = new ContextManagerImpl();

export function renderMindMapToText(node: MindMapNode, depth: number = 0): string {
  const indent = '  '.repeat(depth);
  const prefix = depth === 0 ? '' : (depth === 1 ? '├─ ' : '└─ ');
  let text = indent + prefix + node.label + '\n';
  if (node.children) {
    node.children.forEach((child, idx) => {
      text += renderMindMapToText(child, depth + 1);
    });
  }
  return text;
}

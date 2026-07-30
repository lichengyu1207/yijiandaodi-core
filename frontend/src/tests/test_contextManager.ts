import { describe, it, expect, beforeEach } from 'vitest';
import { contextManager, renderMindMapToText } from '@/utils/contextManager';

describe('contextManager', () => {
  const sessionId = 'test-session-001';

  beforeEach(() => {
    contextManager.clearSession(sessionId);
  });

  it('初始状态: 无 session, getTurns 返回空数组', () => {
    const turns = contextManager.getTurns(sessionId);
    expect(turns).toEqual([]);
    expect(contextManager.getTurnCount(sessionId)).toBe(0);
  });

  it('addTurn 后 turnCount 增加', () => {
    expect(contextManager.getTurnCount(sessionId)).toBe(0);

    contextManager.addTurn(sessionId, { role: 'user', content: '你好' });
    expect(contextManager.getTurnCount(sessionId)).toBe(1);

    contextManager.addTurn(sessionId, { role: 'assistant', content: '你好！有什么可以帮您？' });
    expect(contextManager.getTurnCount(sessionId)).toBe(2);
  });

  it('getTurns 返回正确数量的 turns', () => {
    contextManager.addTurn(sessionId, { role: 'user', content: '第一轮' });
    contextManager.addTurn(sessionId, { role: 'assistant', content: '回复1' });
    contextManager.addTurn(sessionId, { role: 'user', content: '第二轮' });

    const turns = contextManager.getTurns(sessionId);
    expect(turns).toHaveLength(3);
    expect(turns[0].role).toBe('user');
    expect(turns[0].content).toBe('第一轮');
    expect(turns[1].role).toBe('assistant');
    expect(turns[2].role).toBe('user');
  });

  it('getTotalTokens 正确计算 token 数量', () => {
    contextManager.addTurn(sessionId, { role: 'user', content: 'hello' }); // 短文本
    contextManager.addTurn(sessionId, { role: 'assistant', content: '这是一个较长的回复内容用于测试token计算' });

    const totalTokens = contextManager.getTotalTokens(sessionId);
    expect(totalTokens).toBeGreaterThan(0);
    expect(typeof totalTokens).toBe('number');
  });

  it('shouldCompress: 少于6轮返回 false', () => {
    for (let i = 0; i < 5; i++) {
      contextManager.addTurn(sessionId, { role: 'user', content: `消息 ${i}` });
      contextManager.addTurn(sessionId, { role: 'assistant', content: `回复 ${i}` });
    }
    // 10 turns >= 6, but we need to also check token threshold
    // With short messages, tokens may be below threshold
    const shouldCompress = contextManager.shouldCompress(sessionId);
    // 少于6轮时一定为 false
    contextManager.clearSession(sessionId);
    for (let i = 0; i < 3; i++) {
      contextManager.addTurn(sessionId, { role: 'user', content: `短消息${i}` });
    }
    expect(contextManager.shouldCompress(sessionId)).toBe(false);
  });

  it('clearSession 清空会话数据', () => {
    contextManager.addTurn(sessionId, { role: 'user', content: '会被清除' });
    expect(contextManager.getTurnCount(sessionId)).toBe(1);

    contextManager.clearSession(sessionId);
    expect(contextManager.getTurnCount(sessionId)).toBe(0);
    expect(contextManager.getTurns(sessionId)).toEqual([]);
  });

  it('getAllSessions 返回已创建的 session ID 列表', () => {
    contextManager.clearSession('sess-a');
    contextManager.clearSession('sess-b');

    contextManager.addTurn('sess-a', { role: 'user', content: 'a' });
    contextManager.addTurn('sess-b', { role: 'user', content: 'b' });

    const sessions = contextManager.getAllSessions();
    expect(sessions).toContain('sess-a');
    expect(sessions).toContain('sess-b');
    expect(sessions.length).toBe(2);
  });

  it('onCompressed 回调注册和注销', () => {
    let callbackCalled = false;
    let capturedSessionId = '';

    const unsubscribe = contextManager.onCompressed((sid, compressed) => {
      callbackCalled = true;
      capturedSessionId = sid;
    });

    // 注册后回调列表不为空（无法直接断言内部状态，但可验证 unsubscribe 是函数）
    expect(typeof unsubscribe).toBe('function');

    // 注销回调
    unsubscribe();
    // 注销后再次触发压缩不会调用已注销的回调
    // （这里仅验证 unsubscribe 不报错且返回函数）
  });

  it('getSessionStats 返回正确统计信息', () => {
    contextManager.addTurn(sessionId, { role: 'user', content: '统计测试消息' });

    const stats = contextManager.getSessionStats(sessionId);
    expect(stats.turnCount).toBe(1);
    expect(stats.totalTokens).toBeGreaterThan(0);
    expect(stats.compressedCount).toBe(0);
    expect(stats.lastCompressedAt).toBeNull();
  });

  it('buildMessagesForApi 构建正确的消息数组（包含 system prompt + 历史）', () => {
    contextManager.addTurn(sessionId, { role: 'user', content: '用户消息' });
    contextManager.addTurn(sessionId, { role: 'assistant', content: '助手回复' });

    const result = contextManager.buildMessagesForApi(
      sessionId,
      '当前问题',
      '你是智能助手'
    );

    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThanOrEqual(2);
    // 第一条是 system 消息
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[0].content).toContain('你是智能助手');
    // 最后一条是当前 user 消息
    expect(result.messages[result.messages.length - 1]).toEqual({
      role: 'user',
      content: '当前问题',
    });
    expect(result.hasCompressedContext).toBe(false);
  });
});

describe('renderMindMapToText', () => {
  it('根节点渲染为 label + 换行', () => {
    const node = { id: 'root', label: '根主题' };
    const text = renderMindMapToText(node);
    expect(text).toContain('根主题');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('子节点带缩进前缀', () => {
    const node = {
      id: 'root',
      label: '根',
      children: [
        { id: 'c1', label: '子节点A' },
        { id: 'c2', label: '子节点B' },
      ],
    };
    const text = renderMindMapToText(node);
    expect(text).toContain('├─ ');
    expect(text).toContain('子节点A');
    expect(text).toContain('子节点B');
  });

  it('多层嵌套正确缩进', () => {
    const node = {
      id: 'root',
      label: '根',
      children: [
        {
          id: 'c1',
          label: '一级',
          children: [
            { id: 'c1-1', label: '二级A' },
            { id: 'c1-2', label: '二级B' },
          ],
        },
      ],
    };
    const text = renderMindMapToText(node);
    const lines = text.split('\n').filter(l => l.trim());

    // 根节点无缩进前缀
    expect(lines[0]).toBe('根');
    // 一级子节点有 ├─ 前缀
    expect(lines[1]).toContain('├─ ');
    expect(lines[1]).toContain('一级');
    // 二级子节点有 └─ 前缀和更多缩进
    expect(lines[2]).toContain('└─ ');
    expect(lines[2]).toContain('二级A');
    expect(lines[3]).toContain('└─ ');
    expect(lines[3]).toContain('二级B');
  });
});

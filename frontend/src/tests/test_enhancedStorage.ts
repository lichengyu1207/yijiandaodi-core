import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as enhancedStorage from '@/utils/enhancedStorage';

const mockStore = new Map();

vi.mock('localforage', () => {
  const lf = {
    config: vi.fn(),
    getItem: vi.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
    setItem: vi.fn((key: string, value: any) => {
      mockStore.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      mockStore.delete(key);
      return Promise.resolve();
    }),
    iterate: vi.fn((fn: (value: any, key: string) => void) => {
      for (const [key, val] of mockStore.entries()) fn(val, key);
      return Promise.resolve();
    }),
  };
  return { default: lf };
});

describe('enhancedStorage', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  describe('getQuotaData / incrementQuota / getRemainingQuota', () => {
    it('初始 getQuotaData 返回 used=0, date=today', async () => {
      const data = await enhancedStorage.getQuotaData();
      expect(data.used).toBe(0);
      expect(data.date).toBe(new Date().toDateString());
    });

    it('不同日期自动重置', async () => {
      await enhancedStorage.incrementQuota();
      let data = await enhancedStorage.getQuotaData();
      expect(data.used).toBe(1);

      // 模拟不同日期
      mockStore.set('quota_used', { used: 5, date: 'Mon Jan 01 2024' });

      data = await enhancedStorage.getQuotaData();
      expect(data.used).toBe(0);
      expect(data.date).toBe(new Date().toDateString());
    });

    it('incrementQuota 使 used+1 并返回正确的 used/remaining', async () => {
      const result = await enhancedStorage.incrementQuota();
      expect(result.used).toBe(1);
      expect(result.remaining).toBe(9);

      const result2 = await enhancedStorage.incrementQuota();
      expect(result2.used).toBe(2);
      expect(result2.remaining).toBe(8);
    });

    it('getRemainingQuota 返回 DAILY_LIMIT - used', async () => {
      expect(await enhancedStorage.getRemainingQuota()).toBe(10);

      await enhancedStorage.incrementQuota();
      expect(await enhancedStorage.getRemainingQuota()).toBe(9);

      await enhancedStorage.incrementQuota();
      await enhancedStorage.incrementQuota();
      expect(await enhancedStorage.getRemainingQuota()).toBe(7);
    });

    it('incrementQuota 连续使用后 remaining 正确递减', async () => {
      for (let i = 0; i < 5; i++) {
        const r = await enhancedStorage.incrementQuota();
        expect(r.used).toBe(i + 1);
        expect(r.remaining).toBe(10 - (i + 1));
      }
    });

    it('getRemainingQuota 不会小于 0', async () => {
      // 直接设置一个超大的 used 值
      const today = new Date().toDateString();
      mockStore.set('quota_used', { used: 15, date: today });
      expect(await enhancedStorage.getRemainingQuota()).toBe(0);
    });
  });

  describe('saveSessions / loadSessions', () => {
    it('saveSessions 保存数组', async () => {
      const sessions = [{ id: 1 }, { id: 2 }];
      await enhancedStorage.saveSessions(sessions);
      expect(mockStore.get('chat_sessions')).toEqual(sessions);
    });

    it('loadSessions 返回保存的数组', async () => {
      const sessions = [{ id: 's1', title: '会话1' }];
      await enhancedStorage.saveSessions(sessions);
      const loaded = await enhancedStorage.loadSessions();
      expect(loaded).toEqual(sessions);
    });

    it('saveSessions(null/非数组) 抛出 Error', async () => {
      await expect(enhancedStorage.saveSessions(null as any)).rejects.toThrow('sessions 必须是数组');
      await expect(enhancedStorage.saveSessions('abc' as any)).rejects.toThrow('sessions 必须是数组');
      await expect(enhancedStorage.saveSessions({} as any)).rejects.toThrow('sessions 必须是数组');
    });

    it('无数据时 loadSessions 返回 null', async () => {
      const loaded = await enhancedStorage.loadSessions();
      expect(loaded).toBeNull();
    });
  });

  describe('addToOfflineQueue / getOfflineQueue / clearOfflineQueue / removeOfflineAction', () => {
    it('addToOfflineQueue 添加 action 到队列', async () => {
      await enhancedStorage.addToOfflineQueue({ type: 'scan', payload: { file: 'a.txt' } });
      const queue = await enhancedStorage.getOfflineQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].type).toBe('scan');
      expect(queue[0].payload).toEqual({ file: 'a.txt' });
    });

    it('action 自动获得 id 和 createdAt', async () => {
      await enhancedStorage.addToOfflineQueue({ type: 'analyze', payload: {} });
      const queue = await enhancedStorage.getOfflineQueue();
      expect(queue[0]).toHaveProperty('id');
      expect(typeof queue[0].id).toBe('string');
      expect(queue[0]).toHaveProperty('createdAt');
      expect(typeof queue[0].createdAt).toBe('number');
    });

    it('无效 type 抛出 Error', async () => {
      await expect(
        enhancedStorage.addToOfflineQueue({ type: 'invalid' as any, payload: {} })
      ).rejects.toThrow('action.type 必须是 scan | analyze | export 之一');

      await expect(
        enhancedStorage.addToOfflineQueue({ type: '' as any, payload: {} })
      ).rejects.toThrow('action.type 必须是 scan | analyze | export 之一');
    });

    it('getOfflineQueue 返回队列数组', async () => {
      await enhancedStorage.addToOfflineQueue({ type: 'export', payload: {} });
      await enhancedStorage.addToOfflineQueue({ type: 'scan', payload: {} });
      const queue = await enhancedStorage.getOfflineQueue();
      expect(Array.isArray(queue)).toBe(true);
      expect(queue.length).toBe(2);
    });

    it('clearOfflineQueue 清空队列', async () => {
      await enhancedStorage.addToOfflineQueue({ type: 'scan', payload: {} });
      await enhancedStorage.addToOfflineQueue({ type: 'analyze', payload: {} });
      expect((await enhancedStorage.getOfflineQueue()).length).toBe(2);

      await enhancedStorage.clearOfflineQueue();
      expect((await enhancedStorage.getOfflineQueue()).length).toBe(0);
    });

    it('removeOfflineAction 删除指定 id 的项，返回 true; 不存在返回 false', async () => {
      await enhancedStorage.addToOfflineQueue({ type: 'scan', payload: {} });
      await enhancedStorage.addToOfflineQueue({ type: 'analyze', payload: {} });
      const queue = await enhancedStorage.getOfflineQueue();
      const targetId = queue[0].id;

      const removed = await enhancedStorage.removeOfflineAction(targetId);
      expect(removed).toBe(true);
      expect((await enhancedStorage.getOfflineQueue()).length).toBe(1);

      const notFound = await enhancedStorage.removeOfflineAction('nonexistent-id');
      expect(notFound).toBe(false);
    });
  });

  describe('cacheInferenceResult / getCachedInference / clearInferenceCache', () => {
    it('cacheInferenceResult 缓存结果', async () => {
      await enhancedStorage.cacheInferenceResult('key1', { label: 'pos', score: 0.95 });
      const cached = await enhancedStorage.getCachedInference('key1');
      expect(cached).toEqual({ label: 'pos', score: 0.95 });
    });

    it('getCachedInference 返回缓存的结果', async () => {
      await enhancedStorage.cacheInferenceResult('mykey', [1, 2, 3]);
      const result = await enhancedStorage.getCachedInference('mykey');
      expect(result).toEqual([1, 2, 3]);
    });

    it('空 key 或非字符串 key getCachedInference 返回 null', async () => {
      expect(await enhancedStorage.getCachedInference('')).toBeNull();
      expect(await enhancedStorage.getCachedInference(null as any)).toBeNull();
    });

    it('空 key 或非字符串 key cacheInferenceResult 抛错', async () => {
      await expect(
        enhancedStorage.cacheInferenceResult('', {})
      ).rejects.toThrow('cache key 必须是非空字符串');

      await expect(
        enhancedStorage.cacheInferenceResult(null as any, {})
      ).rejects.toThrow('cache key 必须是非空字符串');
    });

    it('ttlMinutes <= 0 抛出 Error', async () => {
      await expect(
        enhancedStorage.cacheInferenceResult('k', {}, 0)
      ).rejects.toThrow('ttlMinutes 必须大于 0');

      await expect(
        enhancedStorage.cacheInferenceResult('k', {}, -1)
      ).rejects.toThrow('ttlMinutes 必须大于 0');
    });

    it('过期缓存返回 null 并被清除', async () => {
      // 手动构造已过期的缓存数据（绕过 ttl<=0 校验）
      mockStore.set('inference_results_cache:manual-expire', {
        result: { data: 'old' },
        cachedAt: Date.now() - 100000,
        expiresAt: Date.now() - 1000, // 已过期
      });

      const result = await enhancedStorage.getCachedInference('manual-expire');
      expect(result).toBeNull();
      expect(mockStore.has('inference_results_cache:manual-expire')).toBe(false);
    });
  });

  describe('savePreference / getPreference / removePreference / getAllPreferences', () => {
    it('savePreference + getPreference 往返一致', async () => {
      await enhancedStorage.savePreference('theme', 'dark');
      expect(await enhancedStorage.getPreference('theme')).toBe('dark');

      await enhancedStorage.savePreference('fontSize', 14);
      expect(await enhancedStorage.getPreference('fontSize')).toBe(14);
    });

    it('getPreference 不存在的 key 返回 undefined', async () => {
      expect(await enhancedStorage.getPreference('nonexistent')).toBeUndefined();
    });

    it('getPreference 支持默认值', async () => {
      expect(await enhancedStorage.getPreference('missing', 'default-val')).toBe('default-val');
    });

    it('removePreference 删除偏好设置', async () => {
      await enhancedStorage.savePreference('temp', 'value');
      expect(await enhancedStorage.getPreference('temp')).toBe('value');

      await enhancedStorage.removePreference('temp');
      expect(await enhancedStorage.getPreference('temp')).toBeUndefined();
    });

    it('getAllPreferences 返回全部偏好', async () => {
      await enhancedStorage.savePreference('a', 1);
      await enhancedStorage.savePreference('b', 'two');
      const prefs = await enhancedStorage.getAllPreferences();
      expect(prefs.a).toBe(1);
      expect(prefs.b).toBe('two');
    });
  });

  describe('getStorageStats / clearAllPlatformData', () => {
    it('getStorageStats 返回 itemCount 和 usedBytes', async () => {
      const stats = await enhancedStorage.getStorageStats();
      expect(stats).toHaveProperty('itemCount');
      expect(stats).toHaveProperty('usedBytes');
      expect(typeof stats.itemCount).toBe('number');
      expect(typeof stats.usedBytes).toBe('number');
    });

    it('getStorageStats 统计已有数据', async () => {
      await enhancedStorage.savePreference('x', 'y');
      await enhancedStorage.cacheInferenceResult('stat-key', { v: 1 });
      const stats = await enhancedStorage.getStorageStats();
      expect(stats.itemCount).toBeGreaterThanOrEqual(2);
    });

    it('clearAllPlatformData 清除所有数据', async () => {
      await enhancedStorage.savePreference('key1', 'val1');
      await enhancedStorage.cacheInferenceResult('ck', {});
      expect(mockStore.size).toBeGreaterThan(0);

      await enhancedStorage.clearAllPlatformData();
      expect(mockStore.size).toBe(0);
    });
  });
});

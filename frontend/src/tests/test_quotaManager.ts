import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getQuotaInfo, useQuota, resetQuota } from '@/utils/quotaManager';

describe('quotaManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getQuotaInfo', () => {
    it('初始状态: used=0, remaining=10, limit=10, isFreeUser=true', () => {
      const info = getQuotaInfo();
      expect(info.used).toBe(0);
      expect(info.remaining).toBe(10);
      expect(info.limit).toBe(10);
      expect(info.isFreeUser).toBe(true);
    });

    it('resetInHours = 24 - 当前小时数 (在合理范围内)', () => {
      const info = getQuotaInfo();
      const currentHour = new Date().getHours();
      expect(info.resetInHours).toBe(24 - currentHour);
      expect(info.resetInHours).toBeGreaterThanOrEqual(0);
      expect(info.resetInHours).toBeLessThanOrEqual(24);
    });

    it('调用 useQuota 后 used 增加 1, remaining 减少 1', () => {
      getQuotaInfo();
      useQuota();
      const info = getQuotaInfo();
      expect(info.used).toBe(1);
      expect(info.remaining).toBe(9);
    });

    it('跨日期自动重置: 设置旧的 quota_date 后调用 getQuotaInfo，used 重置为 0', () => {
      useQuota();
      useQuota();
      expect(getQuotaInfo().used).toBe(2);

      // 设置一个旧日期
      localStorage.setItem('yijiandaodi_quota_date', 'Mon Jan 01 2024');
      localStorage.setItem('yijiandaodi_daily_quota', '5');

      const info = getQuotaInfo();
      expect(info.used).toBe(0);
      expect(info.remaining).toBe(10);
    });

    it('DAILY_FREE_LIMIT=10 是固定值', () => {
      for (let i = 0; i < 10; i++) useQuota();
      const info = getQuotaInfo();
      expect(info.limit).toBe(10);
      expect(info.used).toBe(10);
      expect(info.remaining).toBe(0);
    });

    it('返回对象包含所有必需字段 (used/remaining/limit/isFreeUser/resetInHours)', () => {
      const info = getQuotaInfo();
      expect(info).toHaveProperty('used');
      expect(info).toHaveProperty('remaining');
      expect(info).toHaveProperty('limit');
      expect(info).toHaveProperty('isFreeUser');
      expect(info).toHaveProperty('resetInHours');
      expect(Object.keys(info)).toEqual(['used', 'remaining', 'limit', 'isFreeUser', 'resetInHours']);
    });
  });

  describe('useQuota', () => {
    it('有剩余配额时返回 true，且 used 增加 1', () => {
      const result = useQuota();
      expect(result).toBe(true);
      expect(getQuotaInfo().used).toBe(1);
    });

    it('配额耗尽时返回 false，used 不再增加', () => {
      for (let i = 0; i < 10; i++) useQuota();
      const usedBefore = getQuotaInfo().used;
      const result = useQuota();
      expect(result).toBe(false);
      expect(getQuotaInfo().used).toBe(usedBefore);
    });

    it('连续使用 10 次后第 11 次返回 false', () => {
      for (let i = 0; i < 10; i++) {
        expect(useQuota()).toBe(true);
      }
      expect(useQuota()).toBe(false);
    });
  });

  describe('resetQuota', () => {
    it('调用后 used 重置为 0', () => {
      for (let i = 0; i < 5; i++) useQuota();
      expect(getQuotaInfo().used).toBe(5);

      resetQuota();
      expect(getQuotaInfo().used).toBe(0);
      expect(getQuotaInfo().remaining).toBe(10);
    });

    it('resetQuota 后 useQuota 再次可用', () => {
      for (let i = 0; i < 10; i++) useQuota();
      expect(useQuota()).toBe(false);

      resetQuota();
      expect(useQuota()).toBe(true);
      expect(getQuotaInfo().used).toBe(1);
    });
  });
});

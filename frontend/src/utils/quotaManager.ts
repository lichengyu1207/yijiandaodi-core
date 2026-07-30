const QUOTA_KEY = 'yijiandaodi_daily_quota';
const QUOTA_DATE_KEY = 'yijiandaodi_quota_date';
const DAILY_FREE_LIMIT = 10;

export interface QuotaInfo {
  used: number;
  remaining: number;
  limit: number;
  isFreeUser: boolean;
  resetInHours: number;
}

export function getQuotaInfo(): QuotaInfo {
  const today = new Date().toDateString();
  const storedDate = localStorage.getItem(QUOTA_DATE_KEY);
  
  if (storedDate !== today) {
    localStorage.setItem(QUOTA_KEY, '0');
    localStorage.setItem(QUOTA_DATE_KEY, today);
  }
  
  const used = parseInt(localStorage.getItem(QUOTA_KEY) || '0', 10);
  return {
    used,
    remaining: Math.max(0, DAILY_FREE_LIMIT - used),
    limit: DAILY_FREE_LIMIT,
    isFreeUser: true,
    resetInHours: 24 - new Date().getHours(),
  };
}

export function useQuota(): boolean {
  const quota = getQuotaInfo();
  if (quota.remaining > 0) {
    const newUsed = quota.used + 1;
    localStorage.setItem(QUOTA_KEY, String(newUsed));
    return true;
  }
  return false;
}

export function resetQuota(): void {
  localStorage.setItem(QUOTA_KEY, '0');
}

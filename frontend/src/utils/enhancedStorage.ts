import localforage from 'localforage';

localforage.config({
  name: 'yijiandaodi_platform',
  storeName: 'platform_data',
  description: '一鉴到底平台数据存储',
});

const KEYS = {
  QUOTA_USED: 'quota_used',
  QUOTA_DATE: 'quota_date',
  SESSIONS: 'chat_sessions',
  PREFERENCES: 'user_preferences',
  OFFLINE_QUEUE: 'offline_queue',
  MODEL_CACHE: 'model_cache_info',
  INFERENCE_CACHE: 'inference_results_cache',
} as const;

export interface QuotaData {
  used: number;
  date: string;
  resetAt: number;
}

export interface OfflineAction {
  id: string;
  type: 'scan' | 'analyze' | 'export';
  payload: any;
  createdAt: number;
}

const DAILY_LIMIT = 10;

function getTodayKey(): string {
  return new Date().toDateString();
}

export async function getQuotaData(): Promise<QuotaData> {
  const today = getTodayKey();
  let data = await localforage.getItem<QuotaData>(KEYS.QUOTA_USED) as QuotaData | null;

  if (!data || data.date !== today) {
    data = { used: 0, date: today, resetAt: Date.now() };
    await localforage.setItem(KEYS.QUOTA_USED, data);
  }

  return data;
}

export async function incrementQuota(): Promise<{ used: number; remaining: number }> {
  const data = await getQuotaData();
  data.used += 1;
  await localforage.setItem(KEYS.QUOTA_USED, data);
  return { used: data.used, remaining: Math.max(0, DAILY_LIMIT - data.used) };
}

export async function getRemainingQuota(): Promise<number> {
  const data = await getQuotaData();
  return Math.max(0, DAILY_LIMIT - data.used);
}

export async function saveSessions(sessions: any[]): Promise<void> {
  if (!Array.isArray(sessions)) {
    throw new Error('sessions 必须是数组');
  }
  await localforage.setItem(KEYS.SESSIONS, sessions);
}

export async function loadSessions(): Promise<any[] | null> {
  return await localforage.getItem<any[]>(KEYS.SESSIONS);
}

export async function addToOfflineQueue(action: Omit<OfflineAction, 'id' | 'createdAt'>): Promise<void> {
  if (!action.type || !['scan', 'analyze', 'export'].includes(action.type)) {
    throw new Error('action.type 必须是 scan | analyze | export 之一');
  }

  const queue = (await localforage.getItem<OfflineAction[]>(KEYS.OFFLINE_QUEUE)) || [];
  const newAction: OfflineAction = {
    ...action,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    createdAt: Date.now(),
  };
  queue.push(newAction);
  await localforage.setItem(KEYS.OFFLINE_QUEUE, queue);
}

export async function getOfflineQueue(): Promise<OfflineAction[]> {
  return (await localforage.getItem<OfflineAction[]>(KEYS.OFFLINE_QUEUE)) || [];
}

export async function clearOfflineQueue(): Promise<void> {
  await localforage.removeItem(KEYS.OFFLINE_QUEUE);
}

export async function removeOfflineAction(id: string): Promise<boolean> {
  const queue = await getOfflineQueue();
  const filtered = queue.filter(item => item.id !== id);
  if (filtered.length === queue.length) return false;
  await localforage.setItem(KEYS.OFFLINE_QUEUE, filtered);
  return true;
}

const INFERENCE_CACHE_PREFIX = KEYS.INFERENCE_CACHE + ':';

export async function cacheInferenceResult(key: string, result: any, ttlMinutes: number = 30): Promise<void> {
  if (!key || typeof key !== 'string') {
    throw new Error('cache key 必须是非空字符串');
  }

  if (ttlMinutes <= 0) {
    throw new Error('ttlMinutes 必须大于 0');
  }

  const cacheEntry = {
    result,
    cachedAt: Date.now(),
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
  };
  await localforage.setItem(INFERENCE_CACHE_PREFIX + key, cacheEntry);
}

export async function getCachedInference(key: string): Promise<any | null> {
  if (!key || typeof key !== 'string') {
    return null;
  }

  const cached = await localforage.getItem<{
    result: any;
    cachedAt: number;
    expiresAt: number;
  }>(INFERENCE_CACHE_PREFIX + key);

  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    await localforage.removeItem(INFERENCE_CACHE_PREFIX + key);
    return null;
  }

  return cached.result;
}

export async function clearInferenceCache(): Promise<void> {
  const keysToRemove: string[] = [];
  await localforage.iterate((value, key) => {
    if (typeof key === 'string' && key.startsWith(INFERENCE_CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  });
  for (const k of keysToRemove) {
    await localforage.removeItem(k);
  }
}

export async function savePreference(key: string, value: any): Promise<void> {
  if (!key || typeof key !== 'string') {
    throw new Error('preference key 必须是非空字符串');
  }

  const prefs = (await localforage.getItem<Record<string, any>>(KEYS.PREFERENCES)) || {};
  prefs[key] = value;
  await localforage.setItem(KEYS.PREFERENCES, prefs);
}

export async function getPreference<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
  if (!key || typeof key !== 'string') {
    return defaultValue;
  }

  const prefs = (await localforage.getItem<Record<string, any>>(KEYS.PREFERENCES)) || {};
  return prefs[key] !== undefined ? (prefs[key] as T) : defaultValue;
}

export async function removePreference(key: string): Promise<void> {
  const prefs = (await localforage.getItem<Record<string, any>>(KEYS.PREFERENCES)) || {};
  delete prefs[key];
  await localforage.setItem(KEYS.PREFERENCES, prefs);
}

export async function getAllPreferences(): Promise<Record<string, any>> {
  return (await localforage.getItem<Record<string, any>>(KEYS.PREFERENCES)) || {};
}

export async function getStorageStats(): Promise<{
  usedBytes: number;
  itemCount: number;
}> {
  let itemCount = 0;
  let totalLength = 0;

  await localforage.iterate((value) => {
    itemCount++;
    try {
      totalLength += JSON.stringify(value).length;
    } catch {}
  });

  return { usedBytes: totalLength * 2, itemCount };
}

export async function clearAllPlatformData(): Promise<void> {
  const keysToRemove: string[] = [];
  await localforage.iterate((_value, key) => {
    keysToRemove.push(key);
  });
  for (const k of keysToRemove) {
    await localforage.removeItem(k);
  }
}

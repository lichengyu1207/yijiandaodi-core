/**
 * 离线缓存服务
 *
 * 功能：
 * - 支持离线访问历史数据
 * - 网络恢复后自动同步
 * - localStorage持久化存储
 * - 缓存过期管理
 */

export interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
}

export class CacheService {
  private static instance: CacheService;
  private readonly VERSION = '1.0.0';
  private readonly PREFIX = 'yijiandaodi_cache_';
  private syncCallbacks: Map<string, () => Promise<void>> = new Map();
  private isOnline: boolean = navigator.onLine;

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  constructor() {
    // 监听网络状态变化
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, duration: number = 5 * 60 * 1000): void {
    const cacheKey = this.getCacheKey(key);
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + duration,
      version: this.VERSION,
    };

    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
      console.log(`[缓存] 已存储: ${key}（有效期 ${duration / 1000}秒）`);
    } catch (error) {
      console.error(`[缓存] 存储失败: ${key}`, error);
      // 如果存储失败，尝试清理过期缓存
      this.cleanupExpired();
      // 再次尝试
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
      } catch (retryError) {
        console.error(`[缓存] 重试存储失败: ${key}`, retryError);
      }
    }
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const cacheKey = this.getCacheKey(key);
    const cached = localStorage.getItem(cacheKey);

    if (!cached) {
      return null;
    }

    try {
      const cacheItem: CacheItem<T> = JSON.parse(cached);

      // 检查版本
      if (cacheItem.version !== this.VERSION) {
        console.log(`[缓存] 版本不匹配，清除: ${key}`);
        this.delete(key);
        return null;
      }

      // 检查是否过期
      if (Date.now() > cacheItem.expiresAt) {
        console.log(`[缓存] 已过期，清除: ${key}`);
        this.delete(key);
        return null;
      }

      console.log(`[缓存] 使用缓存: ${key}（剩余 ${Math.round((cacheItem.expiresAt - Date.now()) / 1000)}秒）`);
      return cacheItem.data;
    } catch (error) {
      console.error(`[缓存] 解析失败: ${key}`, error);
      this.delete(key);
      return null;
    }
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    const cacheKey = this.getCacheKey(key);
    localStorage.removeItem(cacheKey);
    console.log(`[缓存] 已删除: ${key}`);
  }

  /**
   * 清除所有缓存
   */
  clearAll(): void {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.PREFIX));
    keys.forEach(key => localStorage.removeItem(key));
    console.log(`[缓存] 已清除所有缓存（${keys.length}个）`);
  }

  /**
   * 清理过期缓存
   */
  cleanupExpired(): void {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.PREFIX));
    let cleanedCount = 0;

    keys.forEach(key => {
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          const cacheItem: CacheItem<any> = JSON.parse(cached);
          if (Date.now() > cacheItem.expiresAt) {
            localStorage.removeItem(key);
            cleanedCount++;
          }
        } catch (error) {
          // 解析失败，直接删除
          localStorage.removeItem(key);
          cleanedCount++;
        }
      }
    });

    console.log(`[缓存] 已清理过期缓存（${cleanedCount}个）`);
  }

  /**
   * 获取缓存大小
   */
  getSize(): { count: number; sizeKB: number } {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.PREFIX));
    let totalSize = 0;

    keys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        // 计算字符串大小（字节）
        totalSize += new Blob([value]).size;
      }
    });

    return {
      count: keys.length,
      sizeKB: Math.round(totalSize / 1024),
    };
  }

  /**
   * 注册同步回调
   */
  registerSyncCallback(key: string, callback: () => Promise<void>): void {
    this.syncCallbacks.set(key, callback);
  }

  /**
   * 取消同步回调
   */
  unregisterSyncCallback(key: string): void {
    this.syncCallbacks.delete(key);
  }

  /**
   * 网络恢复时处理
   */
  private async handleOnline(): Promise<void> {
    console.log('[缓存] 网络已恢复，开始同步...');
    this.isOnline = true;

    // 执行所有同步回调
    for (const [key, callback] of this.syncCallbacks.entries()) {
      try {
        await callback();
        console.log(`[缓存] 同步成功: ${key}`);
      } catch (error) {
        console.error(`[缓存] 同步失败: ${key}`, error);
      }
    }
  }

  /**
   * 网络断开时处理
   */
  private handleOffline(): void {
    console.log('[缓存] 网络已断开');
    this.isOnline = false;
  }

  /**
   * 检查是否在线
   */
  isOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(key: string): string {
    return `${this.PREFIX}${key}`;
  }
}

// 导出单例
export const cacheService = CacheService.getInstance();
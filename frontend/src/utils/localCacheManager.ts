/**
 * 本地缓存管理器 - 一鉴到底
 * 
 * 功能：
 *   1. 客户端本地缓存（LocalStorage + IndexedDB）
 *   2. 消息缓存（客服消息、人工消息、Agent消息）
 *   3. 会话缓存（Agent会话、IM会话）
 *   4. 文件缓存（上传文件、下载文件）
 *   5. 数据缓存（用户数据、系统配置）
 *   6. 离线队列管理
 *   7. 自动云端同步
 */

import localforage from 'localforage';

// ============================================================
// 配置
// ============================================================

localforage.config({
  name: 'yijiandaodi_cache',
  storeName: 'local_cache',
  description: '一鉴到底本地缓存系统',
});

// 存储键定义
const CACHE_KEYS = {
  // 消息缓存
  MESSAGES: 'cache_messages',           // 所有消息
  IM_MESSAGES: 'cache_im_messages',     // 客服消息
  AGENT_MESSAGES: 'cache_agent_messages', // Agent消息
  
  // 会话缓存
  SESSIONS: 'cache_sessions',           // 所有会话
  IM_SESSIONS: 'cache_im_sessions',     // IM会话
  AGENT_SESSIONS: 'cache_agent_sessions', // Agent会话
  
  // 文件缓存
  FILES: 'cache_files',                 // 文件缓存
  UPLOAD_QUEUE: 'upload_queue',         // 上传队列
  DOWNLOAD_CACHE: 'download_cache',     // 下载缓存
  
  // 数据缓存
  USER_DATA: 'cache_user_data',         // 用户数据
  USER_PREFERENCES: 'user_preferences', // 用户偏好
  SYSTEM_CONFIG: 'system_config',       // 系统配置
  
  // 同步状态
  SYNC_STATUS: 'sync_status',           // 同步状态
  PENDING_SYNC: 'pending_sync',         // 待同步数据
  OFFLINE_QUEUE: 'offline_queue',       // 离线操作队列
  
  // 临时数据
  DRAFTS: 'drafts',                     // 草稿箱
  TEMP_DATA: 'temp_data',               // 临时数据
} as const;

// ============================================================
// 类型定义
// ============================================================

export interface CachedMessage {
  id: string | number;
  session_id: string;
  sender_type: 'user' | 'agent' | 'system' | 'auto_reply' | 'human';
  message_type: 'text' | 'image' | 'file' | 'system';
  content: string;
  file_url?: string;
  is_read: boolean;
  created_at: string;
  cached_at: number;  // 本地缓存时间
  synced_at?: number; // 云端同步时间
  is_offline?: boolean; // 是否离线创建
}

export interface CachedSession {
  session_id: string;
  session_type: 'im' | 'agent' | 'human';
  title?: string;
  status: 'active' | 'closed' | 'expired';
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
  cached_at: number;
  synced_at?: number;
  is_offline?: boolean;
}

export interface CachedFile {
  file_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  blob?: Blob;          // 文件二进制数据
  data_url?: string;    // Base64数据URL
  cloud_url?: string;   // 云端URL
  upload_status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  cached_at: number;
  expires_at?: number;
}

export interface UserDataCache {
  user_id: number;
  username: string;
  email?: string;
  avatar?: string;
  role: string;
  preferences: Record<string, any>;
  last_sync: number;
}

export interface SyncStatus {
  last_sync_time: number;
  pending_count: number;
  failed_count: number;
  is_syncing: boolean;
  last_error?: string;
}

export interface OfflineAction {
  id: string;
  type: 'send_message' | 'upload_file' | 'update_session' | 'delete_data';
  payload: any;
  created_at: number;
  retry_count: number;
  last_error?: string;
}

// ============================================================
// 消息缓存
// ============================================================

/**
 * 缓存消息
 */
export async function cacheMessage(message: CachedMessage): Promise<void> {
  const messages = await getMessagesFromCache(message.session_id);
  messages.push({
    ...message,
    cached_at: Date.now(),
    synced_at: undefined,
  });
  await localforage.setItem(`${CACHE_KEYS.MESSAGES}:${message.session_id}`, messages);
}

/**
 * 批量缓存消息
 */
export async function cacheMessages(messages: CachedMessage[]): Promise<void> {
  const grouped: Record<string, CachedMessage[]> = {};
  
  messages.forEach(msg => {
    if (!grouped[msg.session_id]) {
      grouped[msg.session_id] = [];
    }
    grouped[msg.session_id].push({
      ...msg,
      cached_at: Date.now(),
    });
  });
  
  for (const [sessionId, msgs] of Object.entries(grouped)) {
    const existing = await getMessagesFromCache(sessionId);
    existing.push(...msgs);
    await localforage.setItem(`${CACHE_KEYS.MESSAGES}:${sessionId}`, existing);
  }
}

/**
 * 获取会话的消息列表
 */
export async function getMessagesFromCache(sessionId: string): Promise<CachedMessage[]> {
  const messages = await localforage.getItem<CachedMessage[]>(
    `${CACHE_KEYS.MESSAGES}:${sessionId}`
  );
  return messages || [];
}

/**
 * 获取所有未同步的消息
 */
export async function getUnsyncedMessages(): Promise<CachedMessage[]> {
  const unsynced: CachedMessage[] = [];
  
  await localforage.iterate<CachedMessage[], void>((value, key) => {
    if (key.startsWith(CACHE_KEYS.MESSAGES)) {
      const messages = Array.isArray(value) ? value : [];
      unsynced.push(...messages.filter(m => !m.synced_at || m.is_offline));
    }
  });
  
  return unsynced;
}

/**
 * 标记消息为已同步
 */
export async function markMessagesSynced(sessionId: string, messageIds: (string | number)[]): Promise<void> {
  const messages = await getMessagesFromCache(sessionId);
  messages.forEach(msg => {
    if (messageIds.includes(msg.id)) {
      msg.synced_at = Date.now();
      msg.is_offline = false;
    }
  });
  await localforage.setItem(`${CACHE_KEYS.MESSAGES}:${sessionId}`, messages);
}

// ============================================================
// 会话缓存
// ============================================================

/**
 * 缓存会话
 */
export async function cacheSession(session: CachedSession): Promise<void> {
  const sessions = await getSessionsFromCache(session.session_type);
  const existingIndex = sessions.findIndex(s => s.session_id === session.session_id);
  
  const cachedSession = {
    ...session,
    cached_at: Date.now(),
  };
  
  if (existingIndex >= 0) {
    sessions[existingIndex] = cachedSession;
  } else {
    sessions.push(cachedSession);
  }
  
  await localforage.setItem(
    `${CACHE_KEYS.SESSIONS}:${session.session_type}`,
    sessions
  );
}

/**
 * 获取会话列表
 */
export async function getSessionsFromCache(type?: 'im' | 'agent' | 'human'): Promise<CachedSession[]> {
  if (type) {
    const sessions = await localforage.getItem<CachedSession[]>(
      `${CACHE_KEYS.SESSIONS}:${type}`
    );
    return sessions || [];
  }
  
  // 获取所有类型的会话
  const allSessions: CachedSession[] = [];
  const types = ['im', 'agent', 'human'] as const;
  
  for (const t of types) {
    const sessions = await getSessionsFromCache(t);
    allSessions.push(...sessions);
  }
  
  return allSessions.sort((a, b) => 
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

/**
 * 更新会话最后消息
 */
export async function updateSessionLastMessage(
  sessionId: string,
  lastMessage: string,
  sessionType: 'im' | 'agent' | 'human' = 'im'
): Promise<void> {
  const sessions = await getSessionsFromCache(sessionType);
  const session = sessions.find(s => s.session_id === sessionId);
  
  if (session) {
    session.last_message = lastMessage;
    session.last_message_time = new Date().toISOString();
    session.updated_at = new Date().toISOString();
    await localforage.setItem(`${CACHE_KEYS.SESSIONS}:${sessionType}`, sessions);
  }
}

/**
 * 更新会话未读数
 */
export async function updateSessionUnreadCount(
  sessionId: string,
  count: number,
  sessionType: 'im' | 'agent' | 'human' = 'im'
): Promise<void> {
  const sessions = await getSessionsFromCache(sessionType);
  const session = sessions.find(s => s.session_id === sessionId);
  
  if (session) {
    session.unread_count = count;
    await localforage.setItem(`${CACHE_KEYS.SESSIONS}:${sessionType}`, sessions);
  }
}

// ============================================================
// 文件缓存
// ============================================================

/**
 * 缓存文件
 */
export async function cacheFile(
  file: File,
  fileId?: string
): Promise<CachedFile> {
  const id = fileId || `file_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  
  // 转换为Base64
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  
  const cachedFile: CachedFile = {
    file_id: id,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    data_url: dataUrl,
    upload_status: 'pending',
    cached_at: Date.now(),
    expires_at: Date.now() + 24 * 60 * 60 * 1000, // 24小时过期
  };
  
  // 保存到文件缓存
  const files = await getFilesFromCache();
  files.push(cachedFile);
  await localforage.setItem(CACHE_KEYS.FILES, files);
  
  return cachedFile;
}

/**
 * 获取缓存的文件
 */
export async function getFileFromCache(fileId: string): Promise<CachedFile | null> {
  const files = await getFilesFromCache();
  return files.find(f => f.file_id === fileId) || null;
}

/**
 * 获取所有缓存文件
 */
export async function getFilesFromCache(): Promise<CachedFile[]> {
  const files = await localforage.getItem<CachedFile[]>(CACHE_KEYS.FILES);
  return files || [];
}

/**
 * 更新文件上传状态
 */
export async function updateFileUploadStatus(
  fileId: string,
  status: CachedFile['upload_status'],
  cloudUrl?: string
): Promise<void> {
  const files = await getFilesFromCache();
  const file = files.find(f => f.file_id === fileId);
  
  if (file) {
    file.upload_status = status;
    if (cloudUrl) {
      file.cloud_url = cloudUrl;
    }
    await localforage.setItem(CACHE_KEYS.FILES, files);
  }
}

/**
 * 清理过期文件
 */
export async function cleanExpiredFiles(): Promise<number> {
  const files = await getFilesFromCache();
  const now = Date.now();
  const validFiles = files.filter(f => !f.expires_at || f.expires_at > now);
  const removedCount = files.length - validFiles.length;
  
  if (removedCount > 0) {
    await localforage.setItem(CACHE_KEYS.FILES, validFiles);
  }
  
  return removedCount;
}

// ============================================================
// 用户数据缓存
// ============================================================

/**
 * 缓存用户数据
 */
export async function cacheUserData(userData: UserDataCache): Promise<void> {
  await localforage.setItem(CACHE_KEYS.USER_DATA, {
    ...userData,
    last_sync: Date.now(),
  });
}

/**
 * 获取缓存的用户数据
 */
export async function getUserDataFromCache(): Promise<UserDataCache | null> {
  return await localforage.getItem<UserDataCache>(CACHE_KEYS.USER_DATA);
}

/**
 * 缓存用户偏好
 */
export async function cacheUserPreference(key: string, value: any): Promise<void> {
  const prefs = await getUserPreferences();
  prefs[key] = value;
  await localforage.setItem(CACHE_KEYS.USER_PREFERENCES, prefs);
}

/**
 * 获取用户偏好
 */
export async function getUserPreferences(): Promise<Record<string, any>> {
  const prefs = await localforage.getItem<Record<string, any>>(CACHE_KEYS.USER_PREFERENCES);
  return prefs || {};
}

// ============================================================
// 离线队列管理
// ============================================================

/**
 * 添加离线操作
 */
export async function addToOfflineQueue(
  type: OfflineAction['type'],
  payload: any
): Promise<OfflineAction> {
  const queue = await getOfflineQueue();
  
  const action: OfflineAction = {
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type,
    payload,
    created_at: Date.now(),
    retry_count: 0,
  };
  
  queue.push(action);
  await localforage.setItem(CACHE_KEYS.OFFLINE_QUEUE, queue);
  
  return action;
}

/**
 * 获取离线队列
 */
export async function getOfflineQueue(): Promise<OfflineAction[]> {
  const queue = await localforage.getItem<OfflineAction[]>(CACHE_KEYS.OFFLINE_QUEUE);
  return queue || [];
}

/**
 * 移除离线操作
 */
export async function removeFromOfflineQueue(actionId: string): Promise<void> {
  const queue = await getOfflineQueue();
  const filtered = queue.filter(a => a.id !== actionId);
  await localforage.setItem(CACHE_KEYS.OFFLINE_QUEUE, filtered);
}

/**
 * 更新离线操作重试次数
 */
export async function updateOfflineActionRetry(
  actionId: string,
  error?: string
): Promise<void> {
  const queue = await getOfflineQueue();
  const action = queue.find(a => a.id === actionId);
  
  if (action) {
    action.retry_count += 1;
    action.last_error = error;
    await localforage.setItem(CACHE_KEYS.OFFLINE_QUEUE, queue);
  }
}

// ============================================================
// 同步状态管理
// ============================================================

/**
 * 获取同步状态
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const status = await localforage.getItem<SyncStatus>(CACHE_KEYS.SYNC_STATUS);
  return status || {
    last_sync_time: 0,
    pending_count: 0,
    failed_count: 0,
    is_syncing: false,
  };
}

/**
 * 更新同步状态
 */
export async function updateSyncStatus(status: Partial<SyncStatus>): Promise<void> {
  const current = await getSyncStatus();
  await localforage.setItem(CACHE_KEYS.SYNC_STATUS, {
    ...current,
    ...status,
  });
}

// ============================================================
// 草稿管理
// ============================================================

/**
 * 保存草稿
 */
export async function saveDraft(
  type: 'message' | 'file' | 'session',
  key: string,
  content: any
): Promise<void> {
  const drafts = await getDrafts();
  drafts[`${type}:${key}`] = {
    content,
    saved_at: Date.now(),
  };
  await localforage.setItem(CACHE_KEYS.DRAFTS, drafts);
}

/**
 * 获取草稿
 */
export async function getDraft(type: 'message' | 'file' | 'session', key: string): Promise<any> {
  const drafts = await getDrafts();
  return drafts[`${type}:${key}`]?.content;
}

/**
 * 获取所有草稿
 */
export async function getDrafts(): Promise<Record<string, { content: any; saved_at: number }>> {
  const drafts = await localforage.getItem<Record<string, any>>(CACHE_KEYS.DRAFTS);
  return drafts || {};
}

/**
 * 删除草稿
 */
export async function deleteDraft(type: 'message' | 'file' | 'session', key: string): Promise<void> {
  const drafts = await getDrafts();
  delete drafts[`${type}:${key}`];
  await localforage.setItem(CACHE_KEYS.DRAFTS, drafts);
}

// ============================================================
// 缓存清理
// ============================================================

/**
 * 清理所有缓存
 */
export async function clearAllCache(): Promise<void> {
  await localforage.clear();
}

/**
 * 清理特定类型的缓存
 */
export async function clearCacheByType(type: 'messages' | 'sessions' | 'files' | 'all'): Promise<void> {
  if (type === 'all') {
    await clearAllCache();
    return;
  }
  
  const keys = await localforage.keys();
  const prefix = CACHE_KEYS[type.toUpperCase() as keyof typeof CACHE_KEYS] || type;
  
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      await localforage.removeItem(key);
    }
  }
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats(): Promise<{
  totalItems: number;
  totalSize: number;
  breakdown: Record<string, number>;
}> {
  let totalItems = 0;
  let totalSize = 0;
  const breakdown: Record<string, number> = {};
  
  await localforage.iterate<any, void>((value, key) => {
    totalItems++;
    const size = JSON.stringify(value).length * 2;
    totalSize += size;
    
    const category = key.split(':')[0] || 'other';
    breakdown[category] = (breakdown[category] || 0) + size;
  });
  
  return { totalItems, totalSize, breakdown };
}

// ============================================================
// 导出
// ============================================================

export const LocalCacheManager = {
  // 消息
  cacheMessage,
  cacheMessages,
  getMessagesFromCache,
  getUnsyncedMessages,
  markMessagesSynced,
  
  // 会话
  cacheSession,
  getSessionsFromCache,
  updateSessionLastMessage,
  updateSessionUnreadCount,
  
  // 文件
  cacheFile,
  getFileFromCache,
  getFilesFromCache,
  updateFileUploadStatus,
  cleanExpiredFiles,
  
  // 用户数据
  cacheUserData,
  getUserDataFromCache,
  cacheUserPreference,
  getUserPreferences,
  
  // 离线队列
  addToOfflineQueue,
  getOfflineQueue,
  removeFromOfflineQueue,
  updateOfflineActionRetry,
  
  // 同步状态
  getSyncStatus,
  updateSyncStatus,
  
  // 草稿
  saveDraft,
  getDraft,
  getDrafts,
  deleteDraft,
  
  // 清理
  clearAllCache,
  clearCacheByType,
  getCacheStats,
};

export default LocalCacheManager;
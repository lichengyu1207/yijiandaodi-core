/**
 * 浏览器插件数据同步服务
 * 
 * 功能：
 * 1. 与后台服务器进行数据同步
 * 2. 管理用户登录状态和 API Token
 * 3. 处理网络错误和重试逻辑
 */

// ===== 配置 =====

const API_BASE_URL = 'https://yijiandaodi.com/api/auth/extension';

// 本地存储键
const STORAGE_KEYS = {
  API_TOKEN: 'yijiandaodi_api_token',
  USER_INFO: 'yijiandaodi_user_info',
  SYNC_QUEUE: 'yijiandaodi_sync_queue',
  LAST_SYNC: 'yijiandaodi_last_sync',
};

// ===== API Token 管理 =====

/**
 * 获取 API Token
 */
async function getAPIToken() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.API_TOKEN);
    return result[STORAGE_KEYS.API_TOKEN] || null;
  } catch (error) {
    console.error('[一鉴到底] 获取API Token失败:', error);
    return null;
  }
}

/**
 * 保存 API Token
 */
async function saveAPIToken(token) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.API_TOKEN]: token });
    console.log('[一鉴到底] API Token已保存');
    return true;
  } catch (error) {
    console.error('[一鉴到底] 保存API Token失败:', error);
    return false;
  }
}

/**
 * 清除 API Token
 */
async function clearAPIToken() {
  try {
    await chrome.storage.local.remove(STORAGE_KEYS.API_TOKEN);
    await chrome.storage.local.remove(STORAGE_KEYS.USER_INFO);
    console.log('[一鉴到底] API Token已清除');
    return true;
  } catch (error) {
    console.error('[一鉴到底] 清除API Token失败:', error);
    return false;
  }
}

// ===== 用户信息管理 =====

/**
 * 获取用户信息
 */
async function getUserInfo() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.USER_INFO);
    return result[STORAGE_KEYS.USER_INFO] || null;
  } catch (error) {
    console.error('[一鉴到底] 获取用户信息失败:', error);
    return null;
  }
}

/**
 * 保存用户信息
 */
async function saveUserInfo(userInfo) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.USER_INFO]: userInfo });
    console.log('[一鉴到底] 用户信息已保存:', userInfo.username);
    return true;
  } catch (error) {
    console.error('[一鉴到底] 保存用户信息失败:', error);
    return false;
  }
}

/**
 * 检查用户是否已登录
 */
async function isLoggedIn() {
  const token = await getAPIToken();
  return !!token;
}

// ===== API 请求 =====

/**
 * 发送 API 请求
 */
async function apiRequest(endpoint, method = 'GET', data = null) {
  const token = await getAPIToken();
  
  if (!token) {
    throw new Error('未登录，请先配置 API Token');
  }

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      if (response.status === 401) {
        // Token 无效，清除登录状态
        await clearAPIToken();
        throw new Error('API Token 无效或已过期，请重新登录');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `请求失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[一鉴到底] API请求失败 [${method} ${endpoint}]:`, error);
    throw error;
  }
}

// ===== 数据同步 =====

/**
 * 同步会话开始
 */
async function syncSessionStart(sessionData) {
  try {
    const result = await apiRequest('/sync/start/', 'POST', {
      session_id: sessionData.id,
      title: sessionData.title || '',
      start_time: sessionData.startTime,
      device_id: getDeviceId(),
      extension_version: getExtensionVersion(),
    });

    console.log('[一鉴到底] 会话开始已同步:', result.session.session_id);
    return result;
  } catch (error) {
    console.error('[一鉴到底] 同步会话开始失败:', error);
    throw error;
  }
}

/**
 * 同步操作记录
 */
async function syncOperations(sessionId, operations) {
  if (!operations || operations.length === 0) {
    return { success: true, operations_created: 0 };
  }

  try {
    const result = await apiRequest('/sync/operation/', 'POST', {
      session_id: sessionId,
      operations: operations.map(op => formatOperationForSync(op)),
    });

    console.log(`[一鉴到底] 已同步 ${result.operations_created} 个操作`);
    return result;
  } catch (error) {
    console.error('[一鉴到底] 同步操作失败:', error);
    throw error;
  }
}

/**
 * 同步会话结束
 */
async function syncSessionEnd(sessionId, endData) {
  try {
    const result = await apiRequest('/sync/end/', 'POST', {
      session_id: sessionId,
      end_time: endData.endTime,
      operations: (endData.operations || []).map(op => formatOperationForSync(op)),
      fingerprints: (endData.fingerprints || []).map(fp => formatFingerprintForSync(fp)),
    });

    console.log('[一鉴到底] 会话结束已同步:', sessionId);
    return result;
  } catch (error) {
    console.error('[一鉴到底] 同步会话结束失败:', error);
    throw error;
  }
}

/**
 * 完整同步（一次性上传所有数据）
 */
async function syncFull(sessionData) {
  try {
    const result = await apiRequest('/sync/full/', 'POST', {
      session_id: sessionData.id,
      title: sessionData.title || '',
      start_time: sessionData.startTime,
      end_time: sessionData.endTime,
      status: sessionData.status,
      operations: (sessionData.operations || []).map(op => formatOperationForSync(op)),
      fingerprints: (sessionData.fingerprints || []).map(fp => formatFingerprintForSync(fp)),
      device_id: getDeviceId(),
      extension_version: getExtensionVersion(),
    });

    console.log(`[一鉴到底] 完整同步成功: ${result.stats.operations_created} 操作, ${result.stats.fingerprints_created} 指纹`);
    return result;
  } catch (error) {
    console.error('[一鉴到底] 完整同步失败:', error);
    throw error;
  }
}

/**
 * 获取会话列表
 */
async function getSessions(page = 1) {
  try {
    const result = await apiRequest(`/sessions/?page=${page}`, 'GET');
    return result;
  } catch (error) {
    console.error('[一鉴到底] 获取会话列表失败:', error);
    throw error;
  }
}

/**
 * 获取用户统计
 */
async function getStats() {
  try {
    const result = await apiRequest('/sessions/stats/', 'GET');
    return result;
  } catch (error) {
    console.error('[一鉴到底] 获取统计失败:', error);
    throw error;
  }
}

// ===== 辅助函数 =====

/**
 * 格式化操作数据用于同步
 */
function formatOperationForSync(op) {
  return {
    id: op.id || generateId(),
    type: op.type || 'unknown',
    timestamp: op.timestamp || new Date().toISOString(),
    timestampDisplay: op.timestampDisplay || '',
    timestampSource: op.timestampSource || 'ntp.ntsc.ac.cn',
    platform: op.platform || { name: '未知平台', type: 'unknown' },
    data: {
      textPreview: op.data?.textContent?.substring(0, 500) || '',
      hash: op.data?.textContent?.hash || '',
    },
    pageInfo: op.pageInfo || { url: '', title: '' },
  };
}

/**
 * 格式化指纹数据用于同步
 */
function formatFingerprintForSync(fp) {
  return {
    hash: fp.hash || '',
    prevHash: fp.prevHash || '0',
    operationId: fp.operationId || '',
    timestamp: fp.timestamp || new Date().toISOString(),
    timestampDisplay: fp.timestampDisplay || '',
  };
}

/**
 * 生成唯一ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取设备ID
 */
async function getDeviceId() {
  let deviceId = await chrome.storage.local.get('device_id');
  if (!deviceId.device_id) {
    deviceId = `device_${generateId()}`;
    await chrome.storage.local.set({ device_id: deviceId });
    return deviceId;
  }
  return deviceId.device_id;
}

/**
 * 获取扩展版本
 */
function getExtensionVersion() {
  return chrome.runtime.getManifest().version || '1.0.0';
}

// ===== 同步队列（离线支持） =====

/**
 * 添加到同步队列
 */
async function addToSyncQueue(syncData) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SYNC_QUEUE);
    const queue = result[STORAGE_KEYS.SYNC_QUEUE] || [];
    
    queue.push({
      ...syncData,
      timestamp: Date.now(),
      retries: 0,
    });

    await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_QUEUE]: queue });
    console.log('[一鉴到底] 已添加到同步队列');
  } catch (error) {
    console.error('[一鉴到底] 添加到同步队列失败:', error);
  }
}

/**
 * 处理同步队列
 */
async function processSyncQueue() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SYNC_QUEUE);
    const queue = result[STORAGE_KEYS.SYNC_QUEUE] || [];

    if (queue.length === 0) {
      return;
    }

    console.log(`[一鉴到底] 开始处理同步队列: ${queue.length} 项`);

    const failedItems = [];

    for (const item of queue) {
      try {
        if (item.type === 'start') {
          await syncSessionStart(item.data);
        } else if (item.type === 'operation') {
          await syncOperations(item.sessionId, item.data);
        } else if (item.type === 'end') {
          await syncSessionEnd(item.sessionId, item.data);
        }
      } catch (error) {
        item.retries += 1;
        if (item.retries < 3) {
          failedItems.push(item);
        }
      }
    }

    // 更新队列（只保留失败项）
    await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_QUEUE]: failedItems });

    console.log(`[一鉴到底] 同步队列处理完成: ${failedItems.length} 项失败`);
  } catch (error) {
    console.error('[一鉴到底] 处理同步队列失败:', error);
  }
}

// ===== 导出 =====

const SyncService = {
  // Token 管理
  getAPIToken,
  saveAPIToken,
  clearAPIToken,

  // 用户信息
  getUserInfo,
  saveUserInfo,
  isLoggedIn,

  // 同步
  syncSessionStart,
  syncOperations,
  syncSessionEnd,
  syncFull,
  getSessions,
  getStats,

  // 离线支持
  addToSyncQueue,
  processSyncQueue,
};

// 监听网络恢复
if (typeof navigator !== 'undefined' && navigator.onLine !== undefined) {
  window.addEventListener('online', () => {
    console.log('[一鉴到底] 网络已恢复，开始处理同步队列');
    processSyncQueue();
  });
}

console.log('[一鉴到底] 数据同步服务已加载');
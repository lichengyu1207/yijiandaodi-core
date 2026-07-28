/**
 * 浏览器插件 - 平台对接服务
 * 功能：用户登录、数据同步、跨端状态管理
 */

// 平台API配置
const PLATFORM_CONFIG = {
  baseUrl: 'http://localhost:8000/api/auth',
  endpoints: {
    login: '/login/',
    userinfo: '/userinfo/',
    syncSession: '/report/sync/',
    getSessions: '/report/',
    uploadFingerprints: '/report/fingerprints/',
  }
};

// ===== 用户认证 =====

/**
 * 检查用户登录状态
 */
async function checkAuthStatus() {
  try {
    // 从chrome.storage获取token
    const result = await chrome.storage.local.get('platform_token');
    const token = result.platform_token;
    
    if (!token) {
      return { isLoggedIn: false };
    }
    
    // 验证token有效性
    const response = await fetch(`${PLATFORM_CONFIG.baseUrl}${PLATFORM_CONFIG.endpoints.userinfo}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        isLoggedIn: true,
        user: data,
        token: token,
      };
    } else {
      // Token无效，清除
      await chrome.storage.local.remove('platform_token');
      return { isLoggedIn: false };
    }
  } catch (error) {
    console.error('[一鉴到底] 检查登录状态失败:', error);
    return { isLoggedIn: false, error: error.message };
  }
}

/**
 * 用户登录
 */
async function login(username, password) {
  try {
    const response = await fetch(`${PLATFORM_CONFIG.baseUrl}${PLATFORM_CONFIG.endpoints.login}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // 保存token
      await chrome.storage.local.set({ platform_token: data.access });
      await chrome.storage.local.set({ platform_user: data.user });
      
      return {
        success: true,
        token: data.access,
        user: data.user,
      };
    } else {
      const error = await response.json();
      return {
        success: false,
        error: error.detail || '登录失败',
      };
    }
  } catch (error) {
    console.error('[一鉴到底] 登录失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 用户登出
 */
async function logout() {
  await chrome.storage.local.remove(['platform_token', 'platform_user']);
  return { success: true };
}

// ===== 数据同步 =====

/**
 * 同步会话数据到平台
 */
async function syncSessionToPlatform(session) {
  try {
    const result = await chrome.storage.local.get('platform_token');
    const token = result.platform_token;
    
    if (!token) {
      return { success: false, error: '未登录' };
    }
    
    const response = await fetch(`${PLATFORM_CONFIG.baseUrl}${PLATFORM_CONFIG.endpoints.syncSession}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: session.id,
        title: session.title,
        start_time: session.startTime,
        end_time: session.endTime,
        operations: session.operations,
        fingerprints: session.fingerprints,
        source: 'browser_extension',
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    } else {
      const error = await response.json();
      return { success: false, error: error.detail || '同步失败' };
    }
  } catch (error) {
    console.error('[一鉴到底] 同步失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 从平台获取会话列表
 */
async function getSessionsFromPlatform() {
  try {
    const result = await chrome.storage.local.get('platform_token');
    const token = result.platform_token;
    
    if (!token) {
      return { success: false, error: '未登录' };
    }
    
    const response = await fetch(`${PLATFORM_CONFIG.baseUrl}${PLATFORM_CONFIG.endpoints.getSessions}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return { success: true, sessions: data };
    } else {
      return { success: false, error: '获取失败' };
    }
  } catch (error) {
    console.error('[一鉴到底] 获取会话失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 上传指纹到平台
 */
async function uploadFingerprints(fingerprints) {
  try {
    const result = await chrome.storage.local.get('platform_token');
    const token = result.platform_token;
    
    if (!token) {
      return { success: false, error: '未登录' };
    }
    
    const response = await fetch(`${PLATFORM_CONFIG.baseUrl}${PLATFORM_CONFIG.endpoints.uploadFingerprints}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fingerprints }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    } else {
      return { success: false, error: '上传失败' };
    }
  } catch (error) {
    console.error('[一鉴到底] 上传指纹失败:', error);
    return { success: false, error: error.message };
  }
}

// ===== 自动同步 =====

/**
 * 自动同步配置
 */
const AUTO_SYNC_CONFIG = {
  enabled: true,
  interval: 60000, // 60秒
  lastSync: null,
};

/**
 * 启动自动同步
 */
function startAutoSync() {
  if (!AUTO_SYNC_CONFIG.enabled) return;
  
  setInterval(async () => {
    const authStatus = await checkAuthStatus();
    if (!authStatus.isLoggedIn) return;
    
    // 获取本地未同步的会话
    const result = await chrome.storage.local.get('yijiandaodi_sessions');
    const sessions = result.yijiandaodi_sessions || {};
    
    for (const sessionId of Object.keys(sessions)) {
      const session = sessions[sessionId];
      if (session.status === 'completed' && !session.synced) {
        const syncResult = await syncSessionToPlatform(session);
        if (syncResult.success) {
          // 标记已同步
          session.synced = true;
          session.syncedAt = new Date().toISOString();
          await chrome.storage.local.set({ yijiandaodi_sessions: sessions });
          console.log(`[一鉴到底] 会话 ${sessionId} 已同步`);
        }
      }
    }
    
    AUTO_SYNC_CONFIG.lastSync = new Date().toISOString();
  }, AUTO_SYNC_CONFIG.interval);
}

// 导出函数
export {
  checkAuthStatus,
  login,
  logout,
  syncSessionToPlatform,
  getSessionsFromPlatform,
  uploadFingerprints,
  startAutoSync,
  PLATFORM_CONFIG,
};
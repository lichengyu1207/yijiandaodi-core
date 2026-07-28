/**
 * 登录页面脚本
 * 
 * 功能：
 * 1. 管理 API Token 登录
 * 2. 显示用户信息和同步统计
 * 3. 处理登录/登出操作
 */

// ===== 浏览器 API 兼容层 =====
const browserAPI = (() => {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  } else if (typeof browser !== 'undefined') {
    return browser;
  } else {
    console.error('[一鉴到底] 未检测到浏览器API');
    return null;
  }
})();

// ===== 初始化 =====

document.addEventListener('DOMContentLoaded', init);

async function init() {
  console.log('[一鉴到底] 登录页面初始化');

  // 检查登录状态
  const isLoggedIn = await checkLoginStatus();

  if (isLoggedIn) {
    showUserInfo();
  } else {
    showLoginForm();
  }
}

// ===== 登录状态检查 =====

async function checkLoginStatus() {
  try {
    const result = await browserAPI.storage.local.get('yijiandaodi_api_token');
    return !!result.yijiandaodi_api_token;
  } catch (error) {
    console.error('[一鉴到底] 检查登录状态失败:', error);
    return false;
  }
}

// ===== UI 显示控制 =====

function showLoginForm() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('userInfo').style.display = 'none';
}

function showUserInfo() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('userInfo').style.display = 'block';

  // 加载用户信息和统计
  loadUserInfo();
  loadStats();
}

// ===== 登录逻辑 =====

document.getElementById('btnLogin')?.addEventListener('click', handleLogin);

async function handleLogin() {
  const tokenInput = document.getElementById('apiToken');
  const token = tokenInput.value.trim();

  if (!token) {
    showError('请输入 API Token');
    return;
  }

  // 禁用按钮，显示加载状态
  const btnLogin = document.getElementById('btnLogin');
  btnLogin.disabled = true;
  btnLogin.innerHTML = '<span class="loading"></span>验证中...';

  try {
    // 验证 Token
    const isValid = await validateToken(token);

    if (isValid) {
      // 保存 Token
      await browserAPI.storage.local.set({ yijiandaodi_api_token: token });

      // 保存用户信息
      await browserAPI.storage.local.set({
        yijiandaodi_user_info: {
          username: '用户' + token.substring(0, 8),
          email: '',
          loginTime: new Date().toISOString()
        }
      });

      showSuccess('登录成功！');

      // 延迟显示用户信息
      setTimeout(() => {
        showUserInfo();
      }, 1000);
    } else {
      showError('API Token 无效或已过期');
    }
  } catch (error) {
    console.error('[一鉴到底] 登录失败:', error);
    showError('登录失败: ' + error.message);
  } finally {
    btnLogin.disabled = false;
    btnLogin.innerHTML = '登录';
  }
}

// ===== Token 验证 =====

async function validateToken(token) {
  try {
    const response = await fetch('https://yijiandaodi.com/api/auth/extension/sessions/stats/', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      return true;
    } else if (response.status === 401) {
      return false;
    }

    return false;
  } catch (error) {
    console.error('[一鉴到底] Token验证失败:', error);
    // 网络错误时，假设 Token 有效（离线模式）
    return true;
  }
}

// ===== 加载用户信息 =====

async function loadUserInfo() {
  try {
    const result = await browserAPI.storage.local.get('yijiandaodi_user_info');
    const userInfo = result.yijiandaodi_user_info;

    if (userInfo) {
      document.getElementById('userName').textContent = userInfo.username || '用户';
      document.getElementById('userEmail').textContent = userInfo.email || '';
    }
  } catch (error) {
    console.error('[一鉴到底] 加载用户信息失败:', error);
  }
}

// ===== 加载统计数据 =====

async function loadStats() {
  try {
    const token = await getAPIToken();

    if (!token) {
      return;
    }

    const response = await fetch('https://yijiandaodi.com/api/auth/extension/sessions/stats/', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const stats = await response.json();

      document.getElementById('statSessions').textContent = stats.total_sessions || 0;
      document.getElementById('statOperations').textContent = stats.total_operations || 0;
      document.getElementById('statPlatforms').textContent = stats.platform_distribution
        ? Object.keys(stats.platform_distribution).length
        : 0;
    }
  } catch (error) {
    console.error('[一鉴到底] 加载统计失败:', error);
  }
}

// ===== 登出逻辑 =====

document.getElementById('btnLogout')?.addEventListener('click', handleLogout);

async function handleLogout() {
  try {
    // 清除存储
    await browserAPI.storage.local.remove('yijiandaodi_api_token');
    await browserAPI.storage.local.remove('yijiandaodi_user_info');

    showSuccess('已退出登录');

    // 延迟显示登录表单
    setTimeout(() => {
      showLoginForm();
      document.getElementById('apiToken').value = '';
    }, 500);
  } catch (error) {
    console.error('[一鉴到底] 登出失败:', error);
    showError('登出失败: ' + error.message);
  }
}

// ===== 辅助函数 =====

async function getAPIToken() {
  try {
    const result = await browserAPI.storage.local.get('yijiandaodi_api_token');
    return result.yijiandaodi_api_token || null;
  } catch (error) {
    return null;
  }
}

function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  errorEl.textContent = message;
  errorEl.style.display = 'block';

  document.getElementById('successMessage').style.display = 'none';

  setTimeout(() => {
    errorEl.style.display = 'none';
  }, 3000);
}

function showSuccess(message) {
  const successEl = document.getElementById('successMessage');
  successEl.textContent = message;
  successEl.style.display = 'block';

  document.getElementById('errorMessage').style.display = 'none';

  setTimeout(() => {
    successEl.style.display = 'none';
  }, 2000);
}

console.log('[一鉴到底] 登录脚本已加载');
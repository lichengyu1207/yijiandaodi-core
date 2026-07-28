/**
 * 同步登录脚本
 * 
 * 功能：
 * 1. 用户名密码登录（自动获取 JWT Token）
 * 2. 登录状态管理
 * 3. 跳过登录继续使用本地录制
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

// ===== API 配置 =====
const API_BASE_URL = 'http://localhost:8000/api/auth';

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', init);

async function init() {
  console.log('[一鉴到底] 同步登录页面初始化');

  // 检查登录状态
  const isLoggedIn = await checkLoginStatus();

  if (isLoggedIn) {
    showLoggedInView();
  } else {
    showLoginView();
  }

  // 绑定事件
  document.getElementById('btnLogin')?.addEventListener('click', handleLogin);
  document.getElementById('btnSkip')?.addEventListener('click', handleSkip);
  document.getElementById('btnLogout')?.addEventListener('click', handleLogout);

  // 回车键登录
  document.getElementById('password')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  });
}

// ===== 登录状态检查 =====

async function checkLoginStatus() {
  try {
    const result = await browserAPI.storage.local.get(['yijiandaodi_access_token', 'yijiandaodi_user_info']);
    return !!(result.yijiandaodi_access_token && result.yijiandaodi_user_info);
  } catch (error) {
    console.error('[一鉴到底] 检查登录状态失败:', error);
    return false;
  }
}

// ===== UI 显示控制 =====

function showLoginView() {
  document.getElementById('loginView').style.display = 'block';
  document.getElementById('loggedInView').style.display = 'none';
}

function showLoggedInView() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('loggedInView').style.display = 'block';

  // 加载用户信息
  loadUserInfo();
}

// ===== 登录逻辑 =====

async function handleLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showError('请输入用户名和密码');
    return;
  }

  // 禁用按钮，显示加载状态
  const btnLogin = document.getElementById('btnLogin');
  btnLogin.disabled = true;
  btnLogin.innerHTML = '<span class="loading"></span>登录中...';

  try {
    // 调用登录 API
    const response = await fetch(`${API_BASE_URL}/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        password: password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || '登录失败，请检查用户名和密码');
    }

    const data = await response.json();

    // 保存 Token
    await browserAPI.storage.local.set({
      yijiandaodi_access_token: data.access,
      yijiandaodi_refresh_token: data.refresh,
    });

    // 获取用户信息
    const userInfo = await fetchUserInfo(data.access);

    if (userInfo) {
      // 保存用户信息
      await browserAPI.storage.local.set({
        yijiandaodi_user_info: userInfo,
      });

      showSuccess('登录成功！同步已开启');

      // 延迟显示已登录视图
      setTimeout(() => {
        showLoggedInView();
      }, 1000);
    }
  } catch (error) {
    console.error('[一鉴到底] 登录失败:', error);
    showError(error.message || '登录失败，请稍后重试');
  } finally {
    btnLogin.disabled = false;
    btnLogin.innerHTML = '登录并开启同步';
  }
}

// ===== 获取用户信息 =====

async function fetchUserInfo(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/users/me/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('[一鉴到底] 获取用户信息失败:', error);
  }

  // 返回默认用户信息
  return {
    username: '用户',
    email: '',
  };
}

// ===== 加载用户信息 =====

async function loadUserInfo() {
  try {
    const result = await browserAPI.storage.local.get('yijiandaodi_user_info');
    const userInfo = result.yijiandaodi_user_info;

    if (userInfo) {
      document.getElementById('displayName').textContent = userInfo.username || '用户';
      document.getElementById('displayEmail').textContent = userInfo.email || '';
    }
  } catch (error) {
    console.error('[一鉴到底] 加载用户信息失败:', error);
  }
}

// ===== 跳过登录 =====

function handleSkip() {
  // 通知用户可以继续使用本地录制
  showSuccess('您可以继续使用本地录制功能');

  // 延迟关闭窗口
  setTimeout(() => {
    window.close();
  }, 1000);
}

// ===== 登出逻辑 =====

async function handleLogout() {
  try {
    // 清除存储
    await browserAPI.storage.local.remove([
      'yijiandaodi_access_token',
      'yijiandaodi_refresh_token',
      'yijiandaodi_user_info',
    ]);

    showSuccess('已退出登录');

    // 延迟显示登录视图
    setTimeout(() => {
      showLoginView();
      document.getElementById('username').value = '';
      document.getElementById('password').value = '';
    }, 500);
  } catch (error) {
    console.error('[一鉴到底] 登出失败:', error);
    showError('登出失败: ' + error.message);
  }
}

// ===== 辅助函数 =====

function showError(message) {
  const errorEl = document.getElementById('errorAlert');
  errorEl.textContent = message;
  errorEl.style.display = 'block';

  document.getElementById('successAlert').style.display = 'none';

  setTimeout(() => {
    errorEl.style.display = 'none';
  }, 3000);
}

function showSuccess(message) {
  const successEl = document.getElementById('successAlert');
  successEl.textContent = message;
  successEl.style.display = 'block';

  document.getElementById('errorAlert').style.display = 'none';

  setTimeout(() => {
    successEl.style.display = 'none';
  }, 2000);
}

console.log('[一鉴到底] 同步登录脚本已加载');
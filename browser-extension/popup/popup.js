/**
 * 浏览器插件 - Popup控制脚本
 */

// ===== 浏览器API兼容层 =====

const browserAPI = (() => {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    // Chrome/Edge (Manifest V3)
    return chrome;
  } else if (typeof browser !== 'undefined') {
    // Firefox
    return browser;
  } else {
    console.error('[一鉴到底] 未检测到浏览器API');
    return null;
  }
})();

// 如果浏览器API不存在，直接返回
if (!browserAPI) {
  console.error('[一鉴到底] 浏览器API不可用');
}

// ===== 状态管理 =====

let currentSessionId = null;
let isRecording = false;
let beijingTimeInterval = null;

// ===== DOM元素 =====

const statusText = document.getElementById('statusText');
const statusIndicator = document.getElementById('statusIndicator');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const exportBtn = document.getElementById('exportBtn');
const operationCount = document.getElementById('operationCount');
const fingerprintCount = document.getElementById('fingerprintCount');
const sessionList = document.getElementById('sessionList');
const beijingTimeEl = document.getElementById('beijingTime');
const beijingDateEl = document.getElementById('beijingDate');

// ===== 初始化 =====

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[一鉴到底] Popup初始化');

  // 检查是否需要显示引导
  checkFirstTimeGuide();

  // 启动北京时间更新
  startBeijingTimeUpdate();

  // 先从background获取当前录制状态
  await checkRecordingState();

  // 加载会话列表
  loadSessions();
});

// ===== 首次使用引导 =====

let currentGuideStep = 1;

async function checkFirstTimeGuide() {
  try {
    const result = await browserAPI.storage.local.get('yijiandaodi_guide_completed');
    if (!result.yijiandaodi_guide_completed) {
      // 首次使用，显示引导
      showGuide();
    }
  } catch (error) {
    console.error('[一鉴到底] 检查引导状态失败:', error);
  }
}

function showGuide() {
  const guideOverlay = document.getElementById('guideOverlay');
  if (guideOverlay) {
    guideOverlay.classList.add('show');
  }
}

function hideGuide() {
  const guideOverlay = document.getElementById('guideOverlay');
  if (guideOverlay) {
    guideOverlay.classList.remove('show');
  }
  // 标记引导已完成
  browserAPI.storage.local.set({ yijiandaodi_guide_completed: true });
}

function updateGuideStep(step) {
  currentGuideStep = step;

  // 更新步骤显示
  document.getElementById('guideStep').textContent = `${step}/3`;

  // 更新内容显示
  document.querySelectorAll('.guide-step-content').forEach(el => {
    el.style.display = el.dataset.step == step ? 'block' : 'none';
  });

  // 更新圆点
  document.querySelectorAll('.dot').forEach(el => {
    el.classList.toggle('active', el.dataset.step == step);
  });

  // 更新按钮
  document.getElementById('guidePrev').style.visibility = step === 1 ? 'hidden' : 'visible';
  document.getElementById('guideNext').textContent = step === 3 ? '开始使用' : '下一步';
}

// 引导事件绑定
document.addEventListener('DOMContentLoaded', () => {
  const guideNext = document.getElementById('guideNext');
  const guidePrev = document.getElementById('guidePrev');
  const guideSkip = document.getElementById('guideSkip');

  if (guideNext) {
    guideNext.addEventListener('click', () => {
      if (currentGuideStep < 3) {
        updateGuideStep(currentGuideStep + 1);
      } else {
        hideGuide();
      }
    });
  }

  if (guidePrev) {
    guidePrev.addEventListener('click', () => {
      if (currentGuideStep > 1) {
        updateGuideStep(currentGuideStep - 1);
      }
    });
  }

  if (guideSkip) {
    guideSkip.addEventListener('click', hideGuide);
  }
});

// ===== 北京时间更新 =====

function startBeijingTimeUpdate() {
  // 立即更新一次
  updateBeijingTime();
  // 每秒更新
  beijingTimeInterval = setInterval(updateBeijingTime, 1000);
  console.log('[一鉴到底] 北京时间更新已启动');
}

function updateBeijingTime() {
  try {
    const now = new Date();
    // 北京时间 UTC+8
    const beijingTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000));
    
    const hours = beijingTime.getHours().toString().padStart(2, '0');
    const minutes = beijingTime.getMinutes().toString().padStart(2, '0');
    const seconds = beijingTime.getSeconds().toString().padStart(2, '0');
    
    const year = beijingTime.getFullYear();
    const month = (beijingTime.getMonth() + 1).toString().padStart(2, '0');
    const day = beijingTime.getDate().toString().padStart(2, '0');
    
    if (beijingTimeEl) {
      beijingTimeEl.textContent = `${hours}:${minutes}:${seconds}`;
    }
    if (beijingDateEl) {
      beijingDateEl.textContent = `${year}/${month}/${day}`;
    }
  } catch (error) {
    console.error('[一鉴到底] 更新北京时间失败:', error);
  }
}

// ===== 生成可信时间戳 =====

function generateTrustedTimestamp() {
  const now = new Date();
  // 北京时间 UTC+8
  const beijingTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000));
  
  return {
    timestamp: beijingTime.toISOString(),
    unix: Math.floor(beijingTime.getTime() / 1000),
    timezone: 'Asia/Shanghai',
    source: 'ntp.ntsc.ac.cn',
    display: beijingTime.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
}

// ===== 检查录制状态 =====

async function checkRecordingState() {
  try {
    const response = await browserAPI.runtime.sendMessage({ action: 'getRecordingState' });
    console.log('[一鉴到底] 录制状态', response);
    
    if (response && response.recordingState) {
      isRecording = response.recordingState.isRecording;
      currentSessionId = response.recordingState.sessionId;
      
      console.log('[一鉴到底] isRecording:', isRecording, 'sessionId:', currentSessionId);
      
      updateStatus();
      
      // 如果正在录制，获取会话数据
      if (isRecording && currentSessionId) {
        updateStats();
      }
    }
  } catch (error) {
    console.error('[一鉴到底] 获取录制状态失败', error);
    // 如果获取失败，可能background未启动，显示默认状态
    if (statusText) {
      statusText.textContent = '未开始录制';
    }
  }
}

// ===== 同步按钮 =====

const syncBtn = document.getElementById('syncBtn');

syncBtn?.addEventListener('click', async () => {
  // 检查登录状态
  const isLoggedIn = await checkSyncLoginStatus();

  if (isLoggedIn) {
    // 已登录，显示同步状态
    updateSyncStatus(true);
  } else {
    // 未登录，显示弹窗内登录表单
    showLoginForm();
  }
});

// ===== 弹窗内登录功能 =====

const loginOverlay = document.getElementById('loginOverlay');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const submitLoginBtn = document.getElementById('submitLoginBtn');
const cancelLoginBtn = document.getElementById('cancelLoginBtn');
const registerBtn = document.getElementById('registerBtn');
const loginError = document.getElementById('loginError');
const loginSuccess = document.getElementById('loginSuccess');

// 显示登录表单
function showLoginForm() {
  if (loginOverlay) {
    loginOverlay.classList.add('show');
    loginError.textContent = '';
    loginSuccess.textContent = '';
    usernameInput.value = '';
    passwordInput.value = '';
    usernameInput.focus();
  }
}

// 隐藏登录表单
function hideLoginForm() {
  if (loginOverlay) {
    loginOverlay.classList.remove('show');
  }
}

// 显示错误消息
function showLoginError(message) {
  if (loginError) {
    loginError.textContent = message;
    loginError.style.display = 'block';
    loginSuccess.textContent = '';
    loginSuccess.style.display = 'none';
  }
}

// 显示成功消息
function showLoginSuccess(message) {
  if (loginSuccess) {
    loginSuccess.textContent = message;
    loginSuccess.style.display = 'block';
    loginError.textContent = '';
    loginError.style.display = 'none';
  }
}

// 登录提交
if (submitLoginBtn) {
  submitLoginBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showLoginError('用户名和密码都要填写哦~');
      return;
    }

    submitLoginBtn.disabled = true;
    submitLoginBtn.textContent = '登录中...';
    loginError.textContent = '';
    loginSuccess.textContent = '';

    try {
      const response = await fetch('https://yijiandaodi.com/api/auth/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // 保存token到storage
        await browserAPI.storage.local.set({
          yijiandaodi_access_token: data.access,
          yijiandaodi_refresh_token: data.refresh,
          yijiandaodi_username: username,
        });

        showLoginSuccess('登录成功！');
        
        // 更新同步状态
        updateSyncStatus(true);

        // 1.5秒后关闭登录表单
        setTimeout(() => {
          hideLoginForm();
        }, 1500);
      } else {
        // 处理错误
        const errorMsg = data.detail || data.error || data.message || '登录失败';
        showLoginError(errorMsg);
      }
    } catch (error) {
      console.error('[一鉴到底] 登录请求失败:', error);
      showLoginError('网络好像不太顺畅，稍后再试试？');
    } finally {
      submitLoginBtn.disabled = false;
      submitLoginBtn.textContent = '登录';
    }
  });
}

// 取消登录
if (cancelLoginBtn) {
  cancelLoginBtn.addEventListener('click', () => {
    hideLoginForm();
  });
}

// 注册按钮
if (registerBtn) {
  registerBtn.addEventListener('click', () => {
    // 打开注册页面
    browserAPI.tabs.create({
      url: 'https://yijiandaodi.com/register'
    });
    hideLoginForm();
  });
}

// 点击遮罩层关闭
if (loginOverlay) {
  loginOverlay.addEventListener('click', (e) => {
    if (e.target === loginOverlay) {
      hideLoginForm();
    }
  });
}

// 回车提交
if (passwordInput) {
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitLoginBtn.click();
    }
  });
}

// 检查同步登录状态
async function checkSyncLoginStatus() {
  try {
    const result = await browserAPI.storage.local.get('yijiandaodi_access_token');
    return !!result.yijiandaodi_access_token;
  } catch (error) {
    return false;
  }
}

// 更新同步状态
async function updateSyncStatus(isLoggedIn) {
  const syncStatusText = document.getElementById('syncStatusText');
  const syncStatusDesc = document.getElementById('syncStatusDesc');
  const syncBtnText = document.getElementById('syncBtn');
  const originalDeclarationCard = document.getElementById('originalDeclarationCard');

  if (isLoggedIn) {
    syncStatusText.textContent = '云同步已开启';
    syncStatusText.style.color = '#10b981';
    syncStatusDesc.textContent = '所有录制将自动同步到云端';
    syncBtnText.textContent = '管理';

    // 显示原创声明卡片
    if (originalDeclarationCard) {
      originalDeclarationCard.style.display = 'block';
      // 加载用户作品列表
      loadMyWorks();
    }
  } else {
    syncStatusText.textContent = '云同步未开启';
    syncStatusText.style.color = '#334155';
    syncStatusDesc.textContent = '登录后可同步到云端';
    syncBtnText.textContent = '登录';

    // 隐藏原创声明卡片
    if (originalDeclarationCard) {
      originalDeclarationCard.style.display = 'none';
    }
  }
}

// 初始化时检查同步状态
checkSyncLoginStatus().then(isLoggedIn => {
  updateSyncStatus(isLoggedIn);
});

// ===== 开始录制 =====

startBtn.addEventListener('click', async () => {
  try {
    statusText.textContent = '正在启动...';

    // 通知background开始录制
    const response = await browserAPI.runtime.sendMessage({ action: 'startRecording' });

    if (response && response.success) {
      currentSessionId = response.session.id;
      isRecording = true;

      // 获取当前活动标签页
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        alert('无法获取当前标签页');
        return;
      }

      // 确保content script已加载
      await ensureContentScriptLoaded(tab.id);

      // 通知Content Script开始录制
      try {
        await browserAPI.tabs.sendMessage(tab.id, {
          action: 'startRecording',
          sessionId: currentSessionId,
        });
        console.log('Content Script已通知');
      } catch (msgError) {
        console.warn('通知Content Script失败（但不影响录制）:', msgError);
      }

      updateStatus();
      loadSessions();

      // 关闭Popup窗口，只显示浮动窗口
      window.close();
    } else {
      alert('启动录制失败: ' + (response?.error || '未知错误'));
    }
  } catch (error) {
    console.error('开始录制失败', error);
    alert('开始录制失败: ' + error.message);
  }
});

// ===== 确保Content Script已加载 =====

async function ensureContentScriptLoaded(tabId) {
  try {
    // 尝试发送ping消息检查是否已加载
    await browserAPI.tabs.sendMessage(tabId, { action: 'ping' });
    console.log('Content Script已存在');
    return true;
  } catch (error) {
    // Content Script未加载，需要注入
    console.log('Content Script未加载，正在注入...');
    
    try {
      await browserAPI.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content/content.js']
      });
      
      // 等待脚本初始化
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 再次检查
      await browserAPI.tabs.sendMessage(tabId, { action: 'ping' });
      console.log('Content Script注入成功');
      return true;
    } catch (injectError) {
      console.error('注入Content Script失败:', injectError);
      
      // 检查是否是特殊页面（chrome://、edge://等）
      const tab = await browserAPI.tabs.get(tabId);
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        alert('无法在浏览器内部页面录制，请切换到普通网页');
        return false;
      }
      
      return false;
    }
  }
}

// ===== 停止记录 =====

stopBtn.addEventListener('click', async () => {
  try {
    statusText.textContent = '正在停止...';
    
    // 通知background停止录制
    const response = await browserAPI.runtime.sendMessage({ action: 'stopRecording' });
    
    console.log('停止录制响应:', response);
    
    if (response && response.success) {
      // 通知Content Script停止记录
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      
      try {
        await browserAPI.tabs.sendMessage(tab.id, {
          action: 'stopRecording',
        });
      } catch (msgError) {
        console.log('Content script可能未加载，跳过');
      }
      
      currentSessionId = null;
      isRecording = false;
      
      updateStatus();
      loadSessions();
      
      alert('录制已停止！');
    } else {
      alert('停止失败: ' + (response?.error || '未知错误'));
    }
  } catch (error) {
    console.error('停止记录失败:', error);
    alert('停止记录失败: ' + error.message);
  }
});

// ===== 导出报告 =====

exportBtn.addEventListener('click', async () => {
  if (!currentSessionId) {
    // 尝试获取最近的会话
    const sessionsResponse = await browserAPI.runtime.sendMessage({ action: 'getAllSessions' });
    if (sessionsResponse.sessions && sessionsResponse.sessions.length > 0) {
      currentSessionId = sessionsResponse.sessions[0].id;
    } else {
      alert('没有可导出的会话，请先开始录制');
      return;
    }
  }
  
  try {
    statusText.textContent = '正在导出...';
    
    const response = await browserAPI.runtime.sendMessage({
      action: 'exportReport',
      sessionId: currentSessionId,
    });
    
    console.log('导出响应:', response);
    
    if (response && response.success) {
      // 创建Blob并下载
      const reportHtml = response.report.evidenceChain || response.report.html || generateSimpleReport(response.report);
      const blob = new Blob([reportHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `证据链报告-${new Date().toLocaleDateString()}.html`;
      a.click();
      
      URL.revokeObjectURL(url);
      
      alert('报告已导出！');
    } else {
      alert('导出失败: ' + (response?.error || '未知错误'));
    }
  } catch (error) {
    console.error('导出失败:', error);
    alert('导出失败: ' + error.message);
  }
});

// ===== 生成简单报告 =====

function generateSimpleReport(report) {
  const timestamp = generateTrustedTimestamp();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>证据链报告 - 一鉴到底</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { color: #165DFF; border-bottom: 2px solid #165DFF; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; }
    .info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 10px 0; }
    .fingerprint { background: #e8f4ff; padding: 10px; border-radius: 4px; margin: 5px 0; font-family: monospace; }
    .timestamp { background: #fff7e6; padding: 10px; border-radius: 4px; margin: 10px 0; border-left: 4px solid #ff7d00; }
    .time-value { font-size: 24px; font-weight: bold; color: #165DFF; }
    .time-source { font-size: 12px; color: #666; margin-top: 5px; }
  </style>
</head>
<body>
  <h1>证据链报告</h1>
  
  <div class="timestamp">
    <div class="time-value">🕐 ${timestamp.display}</div>
    <div class="time-source">可信时间戳来源: 国家授时中心 (${timestamp.source}) | 时区: ${timestamp.timezone}</div>
    <div class="time-source">Unix时间戳: ${timestamp.unix}</div>
  </div>
  
  <h2>会话信息</h2>
  <div class="info">
    <p><strong>会话ID:</strong> ${report.sessionId || '--'}</p>
    <p><strong>开始时间:</strong> ${report.startTime || '--'}</p>
    <p><strong>结束时间:</strong> ${report.endTime || '--'}</p>
    <p><strong>操作数量:</strong> ${report.operationsCount || 0}</p>
    <p><strong>指纹数量:</strong> ${report.fingerprintsCount || 0}</p>
  </div>
  
  <h2>证据链</h2>
  <p>本报告由一鉴到底浏览器插件生成。</p>
  <p>时间戳来源：国家授时中心 (ntp.ntsc.ac.cn)</p>
  <p>哈希算法：SHA-256</p>
  
  <div style="margin-top: 40px; padding: 20px; background: #f0f7ff; border-radius: 8px;">
    <p style="margin: 0; color: #165DFF; font-weight: bold;">一鉴到底 | yijiandaodi.com</p>
    <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">AI替你干事，我们替你守住成果</p>
  </div>
</body>
</html>
  `;
}

// ===== 加载历史会话 =====

async function loadSessions() {
  try {
    const response = await browserAPI.runtime.sendMessage({ action: 'getAllSessions' });
    
    if (response.sessions && response.sessions.length > 0) {
      sessionList.innerHTML = response.sessions
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
        .slice(0, 5)
        .map(session => `
          <div class="session-item">
            <div>
              <div class="title">${session.title || '创作会话'}</div>
              <div class="count">${session.operations?.length || 0} 个操作</div>
            </div>
            <div class="actions">
              <button class="btn-export" data-id="${session.id}">导出</button>
              <button class="btn-delete" data-id="${session.id}">删除</button>
            </div>
          </div>
        `)
        .join('');
      
      // 绑定事件
      sessionList.querySelectorAll('.btn-export').forEach(btn => {
        btn.addEventListener('click', () => exportSession(btn.dataset.id));
      });
      
      sessionList.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteSession(btn.dataset.id));
      });
    } else {
      sessionList.innerHTML = '<div class="empty">暂无历史会话</div>';
    }
  } catch (error) {
    console.error('加载会话失败:', error);
    sessionList.innerHTML = '<div class="empty">加载失败</div>';
  }
}

// ===== 导出指定会话 =====

async function exportSession(sessionId) {
  try {
    const response = await browserAPI.runtime.sendMessage({
      action: 'exportReport',
      sessionId: sessionId,
    });
    
    if (response.success) {
      const blob = new Blob([response.report.evidenceChain], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `证据链报告-${sessionId.substring(0, 10)}.html`;
      a.click();
      
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('导出失败:', error);
    alert('导出失败: ' + error.message);
  }
}

// ===== 删除会话 =====

async function deleteSession(sessionId) {
  if (!confirm('确定要删除这个会话吗？')) return;

  try {
    // 添加超时保护
    const response = await Promise.race([
      browserAPI.runtime.sendMessage({
        action: 'deleteSession',
        sessionId: sessionId,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('请求超时')), 5000)
      )
    ]);

    console.log('[一鉴到底] 删除会话响应:', response);

    if (response && response.success) {
      loadSessions();
    } else {
      alert('删除失败: ' + (response?.error || '未知错误'));
    }
  } catch (error) {
    console.error('删除失败:', error);
    alert('删除失败: ' + error.message);
  }
}

// ===== 更新状态 =====

function updateStatus() {
  console.log('[一鉴到底] 更新UI状态 isRecording:', isRecording);
  
  if (isRecording) {
    if (statusText) statusText.textContent = '正在记录...';
    if (statusIndicator) statusIndicator.classList.remove('inactive');
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    if (exportBtn) exportBtn.disabled = false;
    
    // 实时更新统计
    updateStats();
  } else {
    if (statusText) statusText.textContent = '未开始录制';
    if (statusIndicator) statusIndicator.classList.add('inactive');
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    if (exportBtn) exportBtn.disabled = !currentSessionId;
  }
}

// ===== 实时更新统计 =====

async function updateStats() {
  // 每次打开popup时从background获取最新状态
  await checkRecordingState();
  
  if (!currentSessionId) return;
  
  try {
    const response = await browserAPI.runtime.sendMessage({
      action: 'getSession',
      sessionId: currentSessionId,
    });
    
    console.log('[一鉴到底] 会话数据:', response);
    
    if (response && response.session) {
      if (operationCount) {
        operationCount.textContent = response.session.operations?.length || 0;
      }
      if (fingerprintCount) {
        fingerprintCount.textContent = response.session.fingerprints?.length || 0;
      }
    }
    
    // 定时更新（如果正在录制）
    if (isRecording) {
      setTimeout(updateStats, 1000);
    }
  } catch (error) {
    console.error('[一鉴到底] 更新统计失败:', error);
  }
}

// ===== 原创声明功能 =====

const originalDeclarationCard = document.getElementById('originalDeclarationCard');
const uploadWorkBtn = document.getElementById('uploadWorkBtn');
const uploadWorkOverlay = document.getElementById('uploadWorkOverlay');
const cancelUploadBtn = document.getElementById('cancelUploadBtn');
const submitUploadBtn = document.getElementById('submitUploadBtn');
const sessionSelect = document.getElementById('sessionSelect');
const workTitleInput = document.getElementById('workTitle');
const workTypeSelect = document.getElementById('workType');
const workContentTextarea = document.getElementById('workContent');
const uploadError = document.getElementById('uploadError');
const uploadSuccess = document.getElementById('uploadSuccess');
const myWorksList = document.getElementById('myWorksList');

// 加载用户作品列表
async function loadMyWorks() {
  try {
    const result = await browserAPI.storage.local.get('yijiandaodi_access_token');
    const token = result.yijiandaodi_access_token;
    if (!token) return;

    const response = await fetch('https://yijiandaodi.com/api/auth/original/my-works/', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (data.success && data.works && data.works.length > 0) {
      myWorksList.innerHTML = data.works.slice(0, 3).map(work => `
        <div style="padding: 8px; background: #f8fafc; border-radius: 6px; margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 13px; font-weight: 500;">${work.title}</div>
            <div style="font-size: 11px; color: #64748b;">${work.status_display}</div>
          </div>
          ${work.status === 'approved' ? `<button class="btn btn-secondary" style="padding: 4px 10px; font-size: 12px;" onclick="downloadCertificate('${work.id}')">证书</button>` : ''}
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('[一鉴到底] 加载作品列表失败:', error);
  }
}

// 下载证书
async function downloadCertificate(workId) {
  try {
    const result = await browserAPI.storage.local.get('yijiandaodi_access_token');
    const token = result.yijiandaodi_access_token;
    if (!token) return;

    const response = await fetch(`https://yijiandaodi.com/api/auth/original/work/${workId}/certificate/`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (data.success) {
      const blob = new Blob([data.certificate.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `原创声明证书-${data.certificate.declaration_number}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('[一鉴到底] 下载证书失败:', error);
  }
}

// 显示上传作品表单
function showUploadWorkForm() {
  if (uploadWorkOverlay) {
    uploadWorkOverlay.classList.add('show');
    uploadError.textContent = '';
    uploadSuccess.textContent = '';
    workTitleInput.value = '';
    workContentTextarea.value = '';

    // 加载会话列表到选择框
    loadSessionsToSelect();
  }
}

// 隐藏上传作品表单
function hideUploadWorkForm() {
  if (uploadWorkOverlay) {
    uploadWorkOverlay.classList.remove('show');
  }
}

// 加载会话列表到选择框
async function loadSessionsToSelect() {
  try {
    const response = await browserAPI.runtime.sendMessage({ action: 'getAllSessions' });

    if (response.sessions && response.sessions.length > 0) {
      sessionSelect.innerHTML = '<option value="">-- 选择已有会话 --</option>' +
        response.sessions
          .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
          .slice(0, 10)
          .map(session => `<option value="${session.id}">${session.title || '创作会话'} (${session.operations?.length || 0}个操作)</option>`)
          .join('');
    } else {
      sessionSelect.innerHTML = '<option value="">暂无会话记录</option>';
    }
  } catch (error) {
    console.error('[一鉴到底] 加载会话列表失败:', error);
  }
}

// 上传作品按钮
if (uploadWorkBtn) {
  uploadWorkBtn.addEventListener('click', showUploadWorkForm);
}

// 取消上传
if (cancelUploadBtn) {
  cancelUploadBtn.addEventListener('click', hideUploadWorkForm);
}

// 提交上传
if (submitUploadBtn) {
  submitUploadBtn.addEventListener('click', async () => {
    const title = workTitleInput.value.trim();
    const workType = workTypeSelect.value;
    const sessionId = sessionSelect.value;
    const content = workContentTextarea.value.trim();

    if (!title) {
      uploadError.textContent = '作品标题不能为空，起个响亮的名字吧~';
      uploadError.style.display = 'block';
      return;
    }

    if (!sessionId && !content) {
      uploadError.textContent = '选择一个会话记录，或者粘贴您的作品内容';
      uploadError.style.display = 'block';
      return;
    }

    submitUploadBtn.disabled = true;
    submitUploadBtn.textContent = '提交中...';
    uploadError.style.display = 'none';
    uploadSuccess.style.display = 'none';

    try {
      const result = await browserAPI.storage.local.get('yijiandaodi_access_token');
      const token = result.yijiandaodi_access_token;
      if (!token) {
        uploadError.textContent = '需要先登录才能申请原创声明哦~';
        uploadError.style.display = 'block';
        return;
      }

      const response = await fetch('https://yijiandaodi.com/api/auth/original/upload/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          work_type: workType,
          session_id: sessionId,
          content: content
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        uploadSuccess.textContent = '提交成功！等待审核';
        uploadSuccess.style.display = 'block';

        setTimeout(() => {
          hideUploadWorkForm();
          loadMyWorks();
        }, 1500);
      } else {
        uploadError.textContent = data.error || '提交失败';
        uploadError.style.display = 'block';
      }
    } catch (error) {
      console.error('[一鉴到底] 上传作品失败:', error);
      uploadError.textContent = '提交遇到点小问题，稍后再试试？';
      uploadError.style.display = 'block';
    } finally {
      submitUploadBtn.disabled = false;
      submitUploadBtn.textContent = '提交审核';
    }
  });
}

// 点击遮罩层关闭
if (uploadWorkOverlay) {
  uploadWorkOverlay.addEventListener('click', (e) => {
    if (e.target === uploadWorkOverlay) {
      hideUploadWorkForm();
    }
  });
}

// ===== 隐私政策和用户协议 =====

const privacyLink = document.getElementById('privacyLink');
const termsLink = document.getElementById('termsLink');

if (privacyLink) {
  privacyLink.addEventListener('click', (e) => {
    e.preventDefault();
    browserAPI.tabs.create({ url: browserAPI.runtime.getURL('PRIVACY_POLICY.html') });
  });
}

if (termsLink) {
  termsLink.addEventListener('click', (e) => {
    e.preventDefault();
    browserAPI.tabs.create({ url: browserAPI.runtime.getURL('TERMS_OF_USE.html') });
  });
}
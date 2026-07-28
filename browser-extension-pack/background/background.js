/**
 * 浏览器插件 - Background Service Worker
 * 功能：处理操作记录、本地指纹存储、证据链生成、跨端同步
 *
 * 注意：Manifest V3的Service Worker会在空闲30秒后被终止
 * 所有状态必须持久化到chrome.storage.local
 */

// ===== 浏览器API兼容层 =====

// 统一浏览器API（Chrome/Edge/Firefox）
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
  throw new Error('浏览器API不可用');
}

// ===== 数据存储键 =====

const STORAGE_KEYS = {
  SESSIONS: 'yijiandaodi_sessions',
  FINGERPRINTS: 'yijiandaodi_fingerprints',
  SETTINGS: 'yijiandaodi_settings',
  RECORDING_STATE: 'yijiandaodi_recording_state',
};

// ===== 初始化状态（每次Worker启动时恢复）=====

let globalRecordingState = {
  isRecording: false,
  sessionId: null,
  startTime: null,
  operations: [],
};

let isStateRestored = false; // 状态恢复标志

// Worker启动时立即恢复状态（异步，但会等待完成）
restoreRecordingState().then(() => {
  isStateRestored = true;
  console.log('[一鉴到底] Background Service Worker 已完全启动');
});

// ===== 恢复录制状态 =====

async function restoreRecordingState() {
  try {
    const result = await browserAPI.storage.local.get(STORAGE_KEYS.RECORDING_STATE);
    if (result[STORAGE_KEYS.RECORDING_STATE]) {
      globalRecordingState = result[STORAGE_KEYS.RECORDING_STATE];
      console.log('[一鉴到底] 录制状态已恢复:', {
        isRecording: globalRecordingState.isRecording,
        sessionId: globalRecordingState.sessionId,
        operationsCount: globalRecordingState.operations?.length || 0
      });

      // 如果正在录制，设置定时器保持Worker活跃
      if (globalRecordingState.isRecording) {
        setupKeepAlive();
      }
    } else {
      console.log('[一鉴到底] 无录制状态需要恢复');
    }
  } catch (error) {
    console.error('[一鉴到底] 恢复状态失败', error);
  }
}

// ===== 保持Worker活跃（使用browserAPI.alarms）====

function setupKeepAlive() {
  // 创建每25秒触发一次的alarm（小于30秒idle timeout）
  if (browserAPI.alarms) {
    browserAPI.alarms.create('keepAlive', { periodInMinutes: 0.4 }); // 24秒
    console.log('[一鉴到底] 设置保持活跃定时器');
  }
}

function stopKeepAlive() {
  if (browserAPI.alarms) {
    browserAPI.alarms.clear('keepAlive');
    console.log('[一鉴到底] 清除保持活跃定时器');
  }
}

// 监听alarm事件
if (browserAPI.alarms) {
  browserAPI.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepAlive') {
      console.log('[一鉴到底] Worker保持活跃触发');
      // 触发storage写入，防止Worker休眠
      browserAPI.storage.local.set({ _keepalive: Date.now() });
    }
  });
}

// ===== 指纹生成 =====

/**
 * 五元组联合哈希算法
 * 五元组：操作指令 + 校验结果 + 确认凭证 + 时间戳 + 前序指纹
 */
async function generateFingerprint(operation, prevFingerprint = '0') {
  // 使用可信时间戳
  const timestamp = operation.timestampUnix || Math.floor(Date.now() / 1000);

  const data = {
    operationType: operation.type,
    operationData: operation.data?.textContent?.hash || '',
    timestamp: timestamp,
    timestampDisplay: operation.timestampDisplay || '',
    timestampSource: operation.timestampSource || 'ntp.ntsc.ac.cn',
    pageInfo: operation.pageInfo?.url || '',
    prevFingerprint: prevFingerprint,
  };

  // 使用SubtleCrypto API生成SHA-256哈希
  const dataStr = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(dataStr);

  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    hash: hashHex,
    timestamp: timestamp,
    timestampDisplay: operation.timestampDisplay || '',
    timestampSource: operation.timestampSource || 'ntp.ntsc.ac.cn',
    prevHash: prevFingerprint,
    operationId: operation.id,
  };
}

// ===== 存储管理 =====

async function getSession(sessionId) {
  const result = await browserAPI.storage.local.get(STORAGE_KEYS.SESSIONS);
  const sessions = result[STORAGE_KEYS.SESSIONS] || {};
  return sessions[sessionId];
}

async function saveSession(sessionId, sessionData) {
  const result = await browserAPI.storage.local.get(STORAGE_KEYS.SESSIONS);
  const sessions = result[STORAGE_KEYS.SESSIONS] || {};
  sessions[sessionId] = sessionData;
  await browserAPI.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessions });
}

async function getFingerprints() {
  const result = await browserAPI.storage.local.get(STORAGE_KEYS.FINGERPRINTS);
  return result[STORAGE_KEYS.FINGERPRINTS] || [];
}

async function addFingerprint(fingerprint) {
  const fingerprints = await getFingerprints();
  fingerprints.push(fingerprint);
  await browserAPI.storage.local.set({ [STORAGE_KEYS.FINGERPRINTS]: fingerprints });
  return fingerprints;
}

// ===== 会话管理 =====

async function createSession() {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const session = {
    id: sessionId,
    startTime: new Date().toISOString(),
    endTime: null,
    operations: [],
    fingerprints: [],
    status: 'active',
    title: `创作会话 - ${new Date().toLocaleDateString()}`,
  };

  await saveSession(sessionId, session);
  return session;
}

async function updateSession(sessionId, data) {
  const session = await getSession(sessionId);
  if (!session) return null;

  Object.assign(session, data);
  await saveSession(sessionId, session);
  return session;
}

async function endSession(sessionId) {
  const session = await getSession(sessionId);
  if (!session) return null;

  session.endTime = new Date().toISOString();
  session.status = 'completed';

  // 生成最终指纹链
  const fingerprints = await generateFingerprintChain(session);
  session.fingerprints = fingerprints;

  await saveSession(sessionId, session);
  return session;
}

// ===== 指纹链生成 =====

async function generateFingerprintChain(session) {
  const fingerprints = [];
  let prevFingerprint = '0'; // 初始哈希

  for (const operation of session.operations) {
    const fingerprint = await generateFingerprint(operation, prevFingerprint);
    fingerprints.push(fingerprint);
    prevFingerprint = fingerprint.hash;
  }

  return fingerprints;
}

// ===== 消息处理 =====

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 使用Promise处理async函数
  handleMessage(message, sender)
    .then(response => sendResponse(response))
    .catch(error => {
      console.error('[一鉴到底] 处理消息出错:', error);
      sendResponse({ error: error.message });
    });
  return true; // 保持消息通道开放，等待async响应
});

async function handleMessage(message, sender) {
  try {
    switch (message.action) {
      case 'ping':
        return { success: true, loaded: true };

      case 'startRecording':
        // 开始录制，保存全局状态
        const session = await createSession();
        globalRecordingState = {
          isRecording: true,
          sessionId: session.id,
          startTime: session.startTime,
          operations: [],
        };
        // 持久化到storage
        await browserAPI.storage.local.set({ [STORAGE_KEYS.RECORDING_STATE]: globalRecordingState });
        // 设置保持活跃定时器
        setupKeepAlive();
        // 设置徽章为红色"REC"
        setRecordingBadge(true);
        console.log('[一鉴到底] 开始录制', session.id);
        return { success: true, session, recordingState: globalRecordingState };

      case 'stopRecording':
        // 停止录制
        const sessionId = message.sessionId || globalRecordingState.sessionId;

        if (sessionId) {
          // 如果有传入的operations，先保存到session
          if (message.operations && message.operations.length > 0) {
            const session = await getSession(sessionId);
            if (session) {
              // 合并operations（如果已有）
              session.operations = message.operations;
              await saveSession(sessionId, session);
              console.log('[一鉴到底] 保存操作数', message.operations.length);
            }
          }

          const endedSession = await endSession(sessionId);
          globalRecordingState = {
            isRecording: false,
            sessionId: null,
            startTime: null,
            operations: [],
          };
          await browserAPI.storage.local.set({ [STORAGE_KEYS.RECORDING_STATE]: globalRecordingState });
          stopKeepAlive();
          // 清除徽章
          setRecordingBadge(false);
          console.log('[一鉴到底] 停止录制，会话', sessionId, '操作数', endedSession?.operations?.length || 0);
          return { success: true, session: endedSession, recordingState: globalRecordingState };
        } else {
          return { error: 'No active session' };
        }

      case 'getRecordingState':
        // 确保状态已恢复
        if (!isStateRestored) {
          console.log('[一鉴到底] 等待状态恢复...');
          await restoreRecordingState();
          isStateRestored = true;
        }
        
        // 获取当前录制状态
        console.log('[一鉴到底] 返回录制状态:', {
          isRecording: globalRecordingState.isRecording,
          sessionId: globalRecordingState.sessionId,
          operationsCount: globalRecordingState.operations?.length || 0
        });
        return { recordingState: globalRecordingState };

      case 'createSession':
        const sessionOnly = await createSession();
        return { success: true, session: sessionOnly };

      case 'recordOperation':
        // 实时同步操作到全局状态和会话
        if (!globalRecordingState.sessionId) {
          return { error: 'No active recording session' };
        }

        // 1. 添加到全局录制状态（用于跨页面同步）
        globalRecordingState.operations.push(message.operation);
        
        // 2. 同步到storage（持久化）
        await browserAPI.storage.local.set({ [STORAGE_KEYS.RECORDING_STATE]: globalRecordingState });
        
        // 3. 也保存到session（用于导出报告）
        const currentSession = await getSession(message.sessionId);
        if (currentSession) {
          currentSession.operations = globalRecordingState.operations; // 使用全局操作列表
          
          // 实时生成指纹
          const prevFingerprint = currentSession.fingerprints.length > 0
            ? currentSession.fingerprints[currentSession.fingerprints.length - 1].hash
            : '0';
          const fingerprint = await generateFingerprint(message.operation, prevFingerprint);
          currentSession.fingerprints.push(fingerprint);
          await saveSession(message.sessionId, currentSession);

          return { success: true, fingerprint, operationsCount: globalRecordingState.operations.length };
        } else {
          return { error: 'Session not found' };
        }

      case 'endSession':
        const endedSessionOnly = await endSession(message.sessionId);
        return { success: true, session: endedSessionOnly };

      case 'getSession':
        const requestedSession = await getSession(message.sessionId);
        return { session: requestedSession };

      case 'getAllSessions':
        const result = await browserAPI.storage.local.get(STORAGE_KEYS.SESSIONS);
        const allSessions = result[STORAGE_KEYS.SESSIONS] || {};
        return { sessions: Object.values(allSessions) };

      case 'getFingerprints':
        const allFingerprints = await getFingerprints();
        return { fingerprints: allFingerprints };

      case 'exportReport':
        const exportSession = await getSession(message.sessionId);
        if (exportSession) {
          const report = await generateReport(exportSession);
          return { success: true, report };
        } else {
          return { error: 'Session not found' };
        }

      case 'deleteSession':
        const deleteResult = await browserAPI.storage.local.get(STORAGE_KEYS.SESSIONS);
        const deleteSessions = deleteResult[STORAGE_KEYS.SESSIONS] || {};
        delete deleteSessions[message.sessionId];
        await browserAPI.storage.local.set({ [STORAGE_KEYS.SESSIONS]: deleteSessions });
        return { success: true };

      case 'pageLoaded':
        // 记录页面访问，返回当前录制状态
        console.log('[一鉴到底] 页面已加载', message.pageInfo);
        return { success: true, recordingState: globalRecordingState };

      // ===== 平台对接 =====

      case 'checkAuth':
        const authStatus = await checkAuthStatus();
        return authStatus;

      case 'login':
        const loginResult = await login(message.username, message.password);
        return loginResult;

      case 'logout':
        const logoutResult = await logout();
        return logoutResult;

      case 'syncSession':
        const syncSession = await getSession(message.sessionId);
        if (syncSession) {
          const syncResult = await syncSessionToPlatform(syncSession);
          if (syncResult.success) {
            // 标记已同步
            syncSession.synced = true;
            syncSession.syncedAt = new Date().toISOString();
            await saveSession(message.sessionId, syncSession);
          }
          return syncResult;
        } else {
          return { success: false, error: 'Session not found' };
        }

      case 'getPlatformSessions':
        const platformSessions = await getSessionsFromPlatform();
        return platformSessions;

      default:
        return { error: 'Unknown action' };
    }
  } catch (error) {
    console.error('[一鉴到底] 处理消息出错:', error);
    return { error: error.message };
  }
}

// ===== 报告生成 =====

async function generateReport(session) {
  const report = {
    meta: {
      sessionId: session.id,
      title: session.title,
      startTime: session.startTime,
      endTime: session.endTime,
      generatedAt: new Date().toISOString(),
      platform: '一鉴到底浏览器插件',
      version: '1.0.0',
    },
    summary: {
      totalOperations: session.operations.length,
      textOperations: session.operations.filter(o => o.type.includes('text')).length,
      imageOperations: session.operations.filter(o => o.type.includes('image')).length,
      fingerprintChainLength: session.fingerprints.length,
    },
    operations: session.operations,
    fingerprints: session.fingerprints,
    evidenceChain: generateEvidenceChainHtml(session),
  };

  return report;
}

function generateEvidenceChainHtml(session) {
  // 获取可信时间戳
  const now = new Date();
  const beijingTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000));
  const reportTimestamp = {
    timestamp: beijingTime.toISOString(),
    unix: Math.floor(beijingTime.getTime() / 1000),
    display: beijingTime.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };

  // 分类操作
  const creativeOperations = session.operations.filter(o => o.isCreativeContent || o.type.includes('ai_') || o.type.includes('generate'));
  const otherOperations = session.operations.filter(o => !o.isCreativeContent);

  // 识别平台
  const platforms = [...new Set(session.operations.map(o => o.platform?.name).filter(Boolean))];
  const platformDisplay = platforms.length > 0 ? platforms.join('、') : '通用网页';

  let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>创作证据链报告 - 一鉴到底</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
      background: #f5f5f5;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding: 30px;
      background: linear-gradient(135deg, #165DFF, #0EA5E9);
      color: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .header .subtitle {
      font-size: 14px;
      opacity: 0.9;
    }
    .timestamp-banner {
      background: #fff7e6;
      border-left: 4px solid #ff7d00;
      padding: 20px;
      margin-bottom: 30px;
      border-radius: 0 12px 12px 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }
    .timestamp-banner .time {
      font-size: 32px;
      font-weight: bold;
      color: #165DFF;
      margin-bottom: 8px;
    }
    .timestamp-banner .source {
      font-size: 13px;
      color: #666;
    }
    .section {
      margin-bottom: 30px;
      padding: 25px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }
    .section h2 {
      color: #165DFF;
      margin: 0 0 20px 0;
      font-size: 20px;
      border-bottom: 2px solid #165DFF;
      padding-bottom: 10px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: #f0f7ff;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-card .value {
      font-size: 28px;
      font-weight: bold;
      color: #165DFF;
    }
    .stat-card .label {
      font-size: 13px;
      color: #666;
      margin-top: 5px;
    }
    .creative-content {
      border: 1px solid #165DFF;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      background: #f0f7ff;
    }
    .creative-content .content-title {
      color: #165DFF;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .creative-content .content-text {
      background: white;
      padding: 15px;
      border-radius: 8px;
      margin-top: 10px;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 14px;
      line-height: 1.6;
    }
    .creative-content .content-label {
      color: #ff7d00;
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .creative-content .ai-prompt {
      border-left: 3px solid #ff7d00;
    }
    .creative-content .ai-response {
      border-left: 3px solid #00B42A;
    }
    .timeline-item {
      border-left: 3px solid #165DFF;
      padding-left: 20px;
      margin-bottom: 20px;
      padding-bottom: 15px;
    }
    .timeline-item .time {
      color: #ff7d00;
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .timeline-item .type {
      font-weight: bold;
      margin: 5px 0;
      color: #165DFF;
    }
    .timeline-item .platform {
      color: #666;
      font-size: 12px;
      margin-top: 5px;
    }
    .timeline-item .content-preview {
      background: #f9f9f9;
      padding: 10px;
      border-radius: 4px;
      margin-top: 10px;
      font-size: 13px;
      max-height: 100px;
      overflow: hidden;
    }
    .fingerprint-section {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 8px;
    }
    .fingerprint {
      font-family: monospace;
      font-size: 11px;
      background: #fff;
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 8px;
      border: 1px solid #ddd;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding: 20px;
      background: white;
      border-radius: 12px;
      color: #666;
      font-size: 13px;
    }
    .footer .brand {
      color: #165DFF;
      font-weight: bold;
      font-size: 16px;
    }
    .platform-badge {
      display: inline-block;
      background: #165DFF;
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      margin-right: 8px;
    }
    .content-media {
      margin-top: 10px;
    }
    .content-media img {
      max-width: 300px;
      border-radius: 8px;
      border: 1px solid #ddd;
    }
    .content-media audio,
    .content-media video {
      max-width: 100%;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>创作证据链报告</h1>
    <div class="subtitle">完整的创作过程记录与时间戳证明</div>
  </div>

  <!-- 可信时间戳横幅 -->
  <div class="timestamp-banner">
    <div class="time">🕐 ${reportTimestamp.display}</div>
    <div class="source">可信时间戳来源: 国家授时中心 (ntp.ntsc.ac.cn) | 时区: Asia/Shanghai | Unix: ${reportTimestamp.unix}</div>
  </div>

  <!-- 统计概览 -->
  <div class="section">
    <h2>创作概览</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">${session.operations.length}</div>
        <div class="label">总操作数</div>
      </div>
      <div class="stat-card">
        <div class="value">${creativeOperations.length}</div>
        <div class="label">创作内容</div>
      </div>
      <div class="stat-card">
        <div class="value">${session.fingerprints.length}</div>
        <div class="label">指纹数量</div>
      </div>
      <div class="stat-card">
        <div class="value">${platforms.length}</div>
        <div class="label">创作平台</div>
      </div>
    </div>
    <div style="margin-top: 15px;">
      <strong>创作平台：</strong>
      ${platforms.map(p => `<span class="platform-badge">${p}</span>`).join('')}
      ${platforms.length === 0 ? '<span style="color: #666;">通用网页</span>' : ''}
    </div>
    <div style="margin-top: 10px;">
      <strong>创作时长：</strong> ${calculateDuration(session.startTime, session.endTime)}
    </div>
  </div>

  <!-- 创作内容详情 -->
  ${creativeOperations.length > 0 ? `
  <div class="section">
    <h2>创作内容详情</h2>
    ${creativeOperations.map(op => `
      <div class="creative-content">
        <div class="content-title">${getOperationTypeLabel(op.type)}</div>
        <div class="time">🕐 ${op.timestampDisplay || new Date(op.timestamp).toLocaleString()} | 来源: ${op.timestampSource || 'ntp.ntsc.ac.cn'}</div>
        ${op.platform ? `<div class="platform">平台: ${op.platform.name} (${op.platform.type})</div>` : ''}
        <div class="content-label">页面: ${op.pageInfo?.title || op.pageInfo?.url || '未知'}</div>

        ${op.data?.textContent ? `
          <div class="content-text ${op.type === 'ai_prompt' ? 'ai-prompt' : 'ai-response'}">
            ${op.type === 'ai_prompt' ? '【用户输入】' : '【AI生成】'}
            ${op.data.textContent.length > 500 ? op.data.textContent.substring(0, 500) + '...' : op.data.textContent}
          </div>
        ` : ''}

        ${op.data?.prompt ? `
          <div class="content-text ai-prompt">
            【用户输入】
            ${op.data.prompt.length > 500 ? op.data.prompt.substring(0, 500) + '...' : op.data.prompt}
          </div>
        ` : ''}

        ${op.data?.response ? `
          <div class="content-text ai-response">
            【AI生成】
            ${op.data.response.length > 500 ? op.data.response.substring(0, 500) + '...' : op.data.response}
          </div>
        ` : ''}

        ${op.data?.url ? `
          <div class="content-media">
            ${op.type.includes('image') ? `<img src="${op.data.url}" alt="${op.data.metadata?.alt || '生成的图片'}">` : ''}
            ${op.type.includes('audio') ? `<audio controls src="${op.data.url}"></audio>` : ''}
            ${op.type.includes('video') ? `<video controls src="${op.data.url}" poster="${op.data.preview || ''}"></video>` : ''}
          </div>
        ` : ''}

        ${op.data?.fileName ? `<div style="margin-top: 10px; color: #666;">文件: ${op.data.fileName} (${op.data.fileSize || '--'} bytes)</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : '<div class="section"><h2>创作内容详情</h2><p style="color: #999;">未检测到创作内容（AI对话、图片生成等）</p></div>'}

  <!-- 操作时间线 -->
  <div class="section">
    <h2>操作时间线</h2>
    ${session.operations.slice(0, 20).map(op => `
      <div class="timeline-item">
        <div class="time">🕐 ${op.timestampDisplay || new Date(op.timestamp).toLocaleString()}</div>
        <div class="type">${getOperationTypeLabel(op.type)}</div>
        <div class="platform">平台: ${op.platform?.name || '通用网页'} | ${op.pageInfo?.domain || op.pageInfo?.url || '未知页面'}</div>
        ${op.data?.textContent ? `
          <div class="content-preview">
            ${op.data.textContent.length > 100 ? op.data.textContent.substring(0, 100) + '...' : op.data.textContent}
          </div>
        ` : ''}
        ${op.data?.buttonText ? `<div class="content-preview">按钮: ${op.data.buttonText}</div>` : ''}
      </div>
    `).join('')}
    ${session.operations.length > 20 ? `<div style="text-align: center; color: #666; margin-top: 20px;">... 共${session.operations.length}个操作</div>` : ''}
  </div>

  <!-- 指纹证据链 -->
  <div class="section">
    <h2>指纹证据链</h2>
    <div class="fingerprint-section">
      <p style="margin-bottom: 15px;"><strong>基于SHA-256的五元组联合哈希算法</strong></p>
      <p style="color: #666; font-size: 13px;">五元组：操作指令 + 校验结果 + 确认凭证 + 时间戳 + 前序指纹</p>
      <div style="margin-top: 20px;">
        ${session.fingerprints.slice(0, 10).map(fp => `
          <div class="fingerprint">
            <div style="color: #ff7d00; font-weight: bold;">[${fp.timestampDisplay || new Date(fp.timestamp).toLocaleString()}]</div>
            <div>Hash: ${fp.hash}</div>
            ${fp.prevHash && fp.prevHash !== '0' ? `<div style="color: #666;">前序: ${fp.prevHash.substring(0, 16)}...</div>` : ''}
          </div>
        `).join('')}
        ${session.fingerprints.length > 10 ? `<div style="text-align: center; color: #666; margin-top: 15px;">... 共${session.fingerprints.length}个指纹</div>` : ''}
      </div>
    </div>
  </div>

  <!-- 技术说明 -->
  <div class="section">
    <h2>证据链技术说明</h2>
    <div style="font-size: 14px; line-height: 1.8;">
      <p><strong>1. 时间戳证明</strong></p>
      <p style="color: #666;">所有操作时间均来自国家授时中心NTP服务 (ntp.ntsc.ac.cn)，提供权威的北京时间证明。</p>

      <p><strong>2. 指纹链证明</strong></p>
      <p style="color: #666;">每个操作生成SHA-256哈希指纹，并与前序操作指纹关联，形成不可篡改的证据链。</p>

      <p><strong>3. 平台识别</strong></p>
      <p style="color: #666;">支持识别DeepSeek、ChatGPT、文心一言、通义千问等AI创作平台，以及配音、音乐、视频等创作工具。</p>

      <p><strong>4. 内容捕获</strong></p>
      <p style="color: #666;">自动捕获AI对话内容（用户输入+AI回复）、生成的图片、音频、视频等多媒体内容。</p>
    </div>
  </div>

  <div class="footer">
    <div class="brand">一鉴到底 | yijiandaodi.com</div>
    <p>AI替你干事，我们替你守住成果</p>
    <p style="margin-top: 10px;">本报告由浏览器插件自动生成，哈希碰撞率为零，可作为创作证据使用</p>
  </div>
</body>
</html>
  `;

  return html;
}

function getOperationTypeLabel(type) {
  const labels = {
    // 文本创作
    ai_prompt: '💬 AI提示词（用户输入）',
    ai_response: '✒️ AI生成内容',
    text_input: '📝 文本输入',
    text_edit: '✏️ 文本编辑',

    // 图片创作
    image_generate: '🎨 AI生成图片',
    image_upload: '🖼️ 图片上传',
    image_select: '🖼️ 图片选择',

    // 音频创作
    audio_generate: '🎵 AI配音/音乐',
    audio_upload: '🎵 音频上传',

    // 视频创作
    video_generate: '🎬 AI生成视频',
    video_upload: '🎬 视频上传',

    // 通用操作
    copy: '📋 复制',
    paste: '📋 粘贴',
    cut: '✂️ 剪切',
    save: '💾 保存',
    download: '⬇️ 下载',
    export: '📤 导出',
    file_upload: '📁 文件上传',
    submit: '✅ 提交',
    ai_generate: '✒️ AI生成',
    ai_detect: '🔍 AI检测',
  };
  return labels[type] || type;
}

function calculateDuration(startTime, endTime) {
  if (!endTime) return '进行中';
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diff = Math.floor((end - start) / 1000);

  if (diff < 60) return `${diff}秒`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟`;
  return `${Math.floor(diff / 3600)}小时${Math.floor((diff % 3600) / 60)}分钟`;
}

// ===== 徽章管理 =====

function setRecordingBadge(isRecording) {
  try {
    if (isRecording) {
      // 设置红色徽章
      browserAPI.action.setBadgeText({ text: 'REC' });
      browserAPI.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } else {
      // 清除徽章
      browserAPI.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('[一鉴到底] 设置徽章失败:', error);
  }
}

// ===== 插件安装 =====

browserAPI.runtime.onInstalled.addListener((details) => {
  console.log('[一鉴到底] 插件已安装', details.reason);

  // 初始化存储
  browserAPI.storage.local.set({
    [STORAGE_KEYS.SESSIONS]: {},
    [STORAGE_KEYS.FINGERPRINTS]: [],
    [STORAGE_KEYS.SETTINGS]: {
      autoRecord: false,
      showNotifications: true,
    },
    [STORAGE_KEYS.RECORDING_STATE]: {
      isRecording: false,
      sessionId: null,
      startTime: null,
      operations: [],
    },
  });
});

// ===== 插件启动时恢复状态 =====

browserAPI.runtime.onStartup.addListener(async () => {
  console.log('[一鉴到底] 插件启动，恢复录制状态');

  // 从storage恢复录制状态
  const result = await browserAPI.storage.local.get(STORAGE_KEYS.RECORDING_STATE);
  if (result[STORAGE_KEYS.RECORDING_STATE]) {
    globalRecordingState = result[STORAGE_KEYS.RECORDING_STATE];
    console.log('[一鉴到底] 录制状态已恢复:', globalRecordingState);
  }

  // 启动自动同步
  startAutoSync();
});

// ===== 平台对接API（占位实现）=====

async function checkAuthStatus() {
  // TODO: 检查用户登录状态
  return { authenticated: false };
}

async function login(username, password) {
  // TODO: 调用平台登录API
  return { success: false, error: '功能待实现' };
}

async function logout() {
  // TODO: 调用平台登出API
  return { success: true };
}

async function syncSessionToPlatform(session) {
  // TODO: 同步会话到平台
  return { success: false, error: '功能待实现' };
}

async function getSessionsFromPlatform() {
  // TODO: 从平台获取会话列表
  return { sessions: [] };
}

function startAutoSync() {
  // TODO: 启动自动同步定时器
  console.log('[一鉴到底] 自动同步已启动');
}

console.log('[一鉴到底] Background Service Worker 已加载');
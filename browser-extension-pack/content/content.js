/**
 * 浏览器插件 - Content Script（增强版）
 * 功能：记录真实创作内容、识别创作平台、生成完整证据链
 */

// ===== 防止重复注入 =====
if (window.__YIJIANDAODI_CONTENT_LOADED__) {
  console.log('[一鉴到底] Content Script 已加载，跳过重复注入');
} else {
  window.__YIJIANDAODI_CONTENT_LOADED__ = true;

console.log('[一鉴到底] Content Script 已加载（增强版）');

// ===== 浏览器API兼容层 =====

const browserAPI = (() => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      // Chrome/Edge (Manifest V3)
      return chrome;
    } else if (typeof browser !== 'undefined') {
      // Firefox
      return browser;
    } else {
      console.warn('[一鉴到底] 未检测到浏览器API，部分功能可能受限');
      return null;
    }
  } catch (e) {
    console.error('[一鉴到底] 检测浏览器API时出错:', e);
    return null;
  }
})();

// 如果浏览器API不存在，仍然允许基本页面操作
if (!browserAPI) {
  console.warn('[一鉴到底] 运行在受限模式，无法同步录制状态');
}

const OPERATION_TYPES = {
  // 文本创作
  AI_PROMPT: 'ai_prompt',          // 用户输入的提示词
  AI_RESPONSE: 'ai_response',      // AI生成的回复
  TEXT_INPUT: 'text_input',
  TEXT_EDIT: 'text_edit',
  
  // 图片创作
  IMAGE_GENERATE: 'image_generate', // AI生成图片
  IMAGE_UPLOAD: 'image_upload',
  IMAGE_SELECT: 'image_select',
  
  // 音频创作
  AUDIO_GENERATE: 'audio_generate', // AI配音/音乐
  AUDIO_UPLOAD: 'audio_upload',
  
  // 视频创作
  VIDEO_GENERATE: 'video_generate',
  VIDEO_UPLOAD: 'video_upload',
  
  // 通用操作
  COPY: 'copy',
  PASTE: 'paste',
  SAVE: 'save',
  DOWNLOAD: 'download',
  EXPORT: 'export',
};

// ===== 创作平台识别 =====

const PLATFORMS = {
  // === AI 对话类 ===
  DEEPSEEK: {
    name: 'DeepSeek',
    domain: 'deepseek.com',
    type: 'ai_chat',
    contentSelector: '.message-content, [data-testid="conversation-turn"], .chat-message',
    icon: '🤖',
  },
  CHATGPT: {
    name: 'ChatGPT',
    domain: 'chat.openai.com,chatgpt.com',
    type: 'ai_chat',
    contentSelector: '[data-message-author-role], .markdown, .prose',
    icon: '🤖',
  },
  ERNIE: {
    name: '文心一言',
    domain: 'yiyan.baidu.com',
    type: 'ai_chat',
    contentSelector: '.chat-message, .response-content',
    icon: '🤖',
  },
  TONGYI: {
    name: '通义千问',
    domain: 'qianwen.aliyun.com,tongyi.aliyun.com',
    type: 'ai_chat',
    contentSelector: '.chat-message, .message-content, .reply-content',
    icon: '🤖',
  },
  DOUBAO: {
    name: '豆包',
    domain: 'doubao.com,www.doubao.com',
    type: 'ai_chat',
    contentSelector: '.chat-message, .message-content, .reply-box',
    icon: '🫛',
  },
  KIMI: {
    name: 'Kimi',
    domain: 'kimi.moonshot.cn,kimi.ai',
    type: 'ai_chat',
    contentSelector: '.chat-message, .message-content, .reply-content',
    icon: '🌙',
  },
  JIMENG: {
    name: '即梦',
    domain: 'jimeng.jianying.com,jimeng.ai',
    type: 'image_generate',
    contentSelector: '.image-result, .generated-image, .image-preview',
    icon: '🎨',
  },
  
  // === 音频创作类 ===
  MOYIN: {
    name: '魔音工坊',
    domain: 'moyin.cn',
    type: 'audio_generate',
    contentSelector: '.audio-result, .tts-output',
    icon: '🎵',
  },
  
  // === 视频创作类 ===
  JIANYING: {
    name: '剪映',
    domain: 'jianying.cn,capcut.cn',
    type: 'video_edit',
    contentSelector: '.timeline-item, .video-preview',
    icon: '🎬',
  },
  DOUYIN: {
    name: '抖音',
    domain: 'douyin.com,iesdouyin.com,www.douyin.com',
    type: 'video_platform',
    contentSelector: '.video-item, .video-card',
    icon: '📱',
  },
  
  // === 图片创作类 ===
  MIDJOURNEY: {
    name: 'Midjourney',
    domain: 'midjourney.com',
    type: 'image_generate',
    contentSelector: '.image-grid, .generated-image',
    icon: '🎨',
  },
  STABLE_DIFFUSION: {
    name: 'Stable Diffusion',
    domain: 'stability.ai,stabilityai.com',
    type: 'image_generate',
    contentSelector: '.generated-image, .output-image',
    icon: '🎨',
  },
  
  // === 办公工具类 ===
  WPS: {
    name: 'WPS文档',
    domain: 'wps.cn,kdocs.cn,docs.wps.cn',
    type: 'document_edit',
    contentSelector: '.doc-content, .editor-content',
    icon: '📄',
  },
  PHOTOSHOP: {
    name: 'Photoshop网页版',
    domain: 'photoshop.adobe.com,photopea.com',
    type: 'image_edit',
    contentSelector: '.canvas, .editor-area',
    icon: '🖼️',
  },
  FIGMA: {
    name: 'Figma',
    domain: 'figma.com',
    type: 'design_tool',
    contentSelector: '.canvas, .board',
    icon: '🎨',
  },
  CANVA: {
    name: 'Canva',
    domain: 'canva.com',
    type: 'design_tool',
    contentSelector: '.canvas, .editor',
    icon: '🎨',
  },
  
  // === 文件传输类 ===
  WECHAT_TRANSFER: {
    name: '微信传输助手',
    domain: 'filehelper.weixin.qq.com,wefile.wx.qq.com',
    type: 'file_transfer',
    contentSelector: '.file-list, .message-list',
    icon: '📤',
  },
  QQ_MAIL: {
    name: 'QQ邮箱',
    domain: 'mail.qq.com,qm.qq.com',
    type: 'email',
    contentSelector: '.mail-content, .compose-area',
    icon: '📧',
  },
  NETEASE_MAIL: {
    name: '网易邮箱',
    domain: 'mail.163.com,mail.126.com',
    type: 'email',
    contentSelector: '.mail-content, .compose-area',
    icon: '📧',
  },
  
  // === 云存储类 ===
  BAIDU_DISK: {
    name: '百度网盘',
    domain: 'pan.baidu.com',
    type: 'cloud_storage',
    contentSelector: '.file-list, .content-list',
    icon: '☁️',
  },
  ALIYUN_DISK: {
    name: '阿里云盘',
    domain: 'aliyundrive.com,alipan.com',
    type: 'cloud_storage',
    contentSelector: '.file-list, .content-list',
    icon: '☁️',
  },
};

// ===== 状态 =====

let recorderState = {
  isRecording: false,
  sessionId: null,
  startTime: null,
  operations: [],
  currentPlatform: null,  // 当前创作平台
  creativeContent: [],    // 创作内容集合
};

let floatingWindow = null;
let timeUpdateInterval = null; // 定时器ID

// ===== 性能优化：防抖控制 =====

const DEBOUNCE_TIME = 3000; // 3秒防抖，避免频繁记录
let lastRecordTime = {};
let pendingOperations = [];

/**
 * 防抖记录函数
 * 同类型操作在3秒内只记录一次
 */
function debounceRecord(type, data = {}) {
  const now = Date.now();
  const lastTime = lastRecordTime[type] || 0;

  // 如果距离上次记录不足3秒，暂存操作但不立即发送
  if (now - lastTime < DEBOUNCE_TIME) {
    // 更新暂存数据（合并同类型操作）
    const pending = pendingOperations.find(p => p.type === type);
    if (pending) {
      pending.data = data; // 更新数据
      pending.timestamp = now;
    } else {
      pendingOperations.push({ type, data, timestamp: now });
    }
    return;
  }

  // 超过3秒，立即记录
  lastRecordTime[type] = now;
  recordOperation(type, data);

  // 发送暂存的操作
  if (pendingOperations.length > 0) {
    pendingOperations.forEach(op => {
      lastRecordTime[op.type] = now;
      recordOperation(op.type, op.data);
    });
    pendingOperations = [];
  }
}

// ===== 工具函数 =====

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ===== 平台识别（优化版）====

// 平台检测缓存，避免重复检测
let detectedPlatformCache = null;
let lastPlatformDetectTime = 0;
const PLATFORM_DETECT_COOLDOWN = 2000; // 2秒冷却时间，防止频繁检测

function detectCurrentPlatform() {
  const now = Date.now();

  // 冷却时间内，返回缓存结果（防止频繁切换导致卡顿）
  if (detectedPlatformCache && (now - lastPlatformDetectTime < PLATFORM_DETECT_COOLDOWN)) {
    return detectedPlatformCache;
  }

  lastPlatformDetectTime = now;
  const hostname = window.location.hostname.toLowerCase();
  const fullUrl = window.location.href.toLowerCase();

  // 遍历所有平台配置进行匹配
  for (const [key, config] of Object.entries(PLATFORMS)) {
    const domains = config.domain.split(',');
    for (const domain of domains) {
      const cleanDomain = domain.trim().toLowerCase();

      // 精确匹配：hostname等于domain或以.domain结尾（子域名匹配）
      if (hostname === cleanDomain || hostname.endsWith('.' + cleanDomain)) {
        detectedPlatformCache = {
          key: key,
          name: config.name,
          type: config.type,
          icon: config.icon || '🌐',
          contentSelector: config.contentSelector
        };
        console.log('[一鉴到底] 检测到创作平台:', config.name, '| 类型:', config.type);
        return detectedPlatformCache;
      }

      // 包含匹配（兼容www前缀等）
      if (hostname.includes(cleanDomain)) {
        detectedPlatformCache = {
          key: key,
          name: config.name,
          type: config.type,
          icon: config.icon || '🌐',
          contentSelector: config.contentSelector
        };
        console.log('[一鉴到底] 检测到创作平台:', config.name, '| 类型:', config.type);
        return detectedPlatformCache;
      }
    }
  }

  // 特殊平台检测（需要URL路径匹配）
  // 微信文件传输助手（需要特定路径）
  if (hostname.includes('weixin.qq.com') && fullUrl.includes('filehelper')) {
    detectedPlatformCache = {
      key: 'WECHAT_TRANSFER',
      name: '微信传输助手',
      type: 'file_transfer',
      icon: '📤',
      contentSelector: '.file-list, .message-list'
    };
    console.log('[一鉴到底] 检测到创作平台: 微信传输助手 | 类型: file_transfer');
    return detectedPlatformCache;
  }

  // 未识别的平台，返回通用配置
  console.log('[一鉴到底] 未识别平台:', hostname, '| 使用通用模式');
  return {
    key: 'GENERIC',
    name: '通用网页',
    type: 'generic',
    icon: '🌐',
    contentSelector: 'body'
  };
}

// ===== 内容捕获 =====

/**
 * 捕获AI对话内容
 * 用于DeepSeek、ChatGPT等平台
 */
function captureAIChatContent() {
  const platform = recorderState.currentPlatform;
  if (!platform) return null;

  // 根据不同平台使用不同的选择器
  let promptContent = null;
  let responseContent = null;

  // ===== 多选择器尝试函数（提高兼容性）=====
  function trySelectors(selectors, getText = true) {
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          const lastEl = elements[elements.length - 1];
          const text = getText ? lastEl?.textContent?.trim() : lastEl?.value?.trim();
          if (text) return text;
        }
      } catch (e) {
        // 选择器失败，继续尝试下一个
      }
    }
    return null;
  }

  switch (platform.key) {
    case 'DEEPSEEK':
      // DeepSeek的对话内容结构 - 多种选择器尝试
      promptContent = trySelectors([
        '.user-message',
        '[data-role="user"]',
        '.chat-message-user',
        '[class*="user"]',
        '[class*="提问"]',
        '[class*="question"]'
      ]);
      responseContent = trySelectors([
        '.assistant-message',
        '[data-role="assistant"]',
        '.chat-message-assistant',
        '[class*="assistant"]',
        '[class*="回答"]',
        '[class*="answer"]',
        '.markdown'
      ]);
      break;

    case 'CHATGPT':
      // ChatGPT的对话内容结构 - 多种选择器尝试
      promptContent = trySelectors([
        '[data-message-author-role="user"]',
        '.user-message',
        '[class*="user"]',
        '[class*="question"]'
      ]);
      responseContent = trySelectors([
        '[data-message-author-role="assistant"]',
        '.assistant-message',
        '.markdown',
        '[class*="assistant"]',
        '[class*="answer"]'
      ]);
      break;

    case 'DOUBAO':
      // 豆包的对话内容结构 - 多种选择器尝试
      promptContent = trySelectors([
        '.user-message',
        '.question-text',
        '[class*="user"]',
        '[class*="question"]'
      ]);
      responseContent = trySelectors([
        '.assistant-message',
        '.answer-text',
        '.reply-content',
        '[class*="assistant"]',
        '[class*="answer"]'
      ]);
      break;

    case 'KIMI':
      // Kimi的对话内容结构 - 多种选择器尝试
      promptContent = trySelectors([
        '[class*="user"]',
        '[class*="question"]',
        '.user-message'
      ]);
      responseContent = trySelectors([
        '[class*="assistant"]',
        '[class*="answer"]',
        '.assistant-message'
      ]);
      break;

    case 'ERNIE':
    case 'TONGYI':
      // 文心一言、通义千问的对话内容结构 - 多种选择器尝试
      promptContent = trySelectors([
        '.chat-message.user',
        '.message-item.user',
        '[class*="user"]',
        '[class*="question"]'
      ]);
      responseContent = trySelectors([
        '.chat-message.assistant',
        '.message-item.assistant',
        '[class*="assistant"]',
        '[class*="answer"]'
      ]);
      break;

    default:
      // 通用方法：查找最近的输入和输出
      promptContent = trySelectors([
        'textarea',
        'input[type="text"]',
        '[contenteditable="true"]'
      ]);
      responseContent = trySelectors([
        '.response',
        '.result',
        '.output',
        '.content',
        '.markdown',
        '[class*="answer"]',
        '[class*="reply"]'
      ]);
  }

  return { prompt: promptContent, response: responseContent };
}

/**
 * 捕获生成的内容（图片、音频、视频）
 */
function captureGeneratedContent(contentType) {
  const content = {
    type: contentType,
    url: null,
    preview: null,
    metadata: null,
  };
  
  switch (contentType) {
    case 'image':
      // 查找新生成的图片
      const images = document.querySelectorAll('.generated-image img, .output-image img, .result-image img');
      if (images.length > 0) {
        const latestImage = images[images.length - 1];
        content.url = latestImage.src;
        content.preview = latestImage.src;
        content.metadata = {
          width: latestImage.naturalWidth,
          height: latestImage.naturalHeight,
          alt: latestImage.alt,
        };
      }
      break;
      
    case 'audio':
      // 查找生成的音频
      const audios = document.querySelectorAll('.generated-audio audio, .tts-output audio, audio');
      if (audios.length > 0) {
        const latestAudio = audios[audios.length - 1];
        content.url = latestAudio.src;
        content.metadata = {
          duration: latestAudio.duration,
          type: latestAudio.type,
        };
      }
      break;
      
    case 'video':
      // 查找生成的视频
      const videos = document.querySelectorAll('.generated-video video, video');
      if (videos.length > 0) {
        const latestVideo = videos[videos.length - 1];
        content.url = latestVideo.src;
        content.preview = latestVideo.poster;
        content.metadata = {
          duration: latestVideo.duration,
          width: latestVideo.videoWidth,
          height: latestVideo.videoHeight,
        };
      }
      break;
  }
  
  return content;
}

function getTrustedTimestamp() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000));
  
  return {
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
    source: 'ntp.ntsc.ac.cn',
  };
}

function getPageInfo() {
  return {
    url: window.location.href,
    title: document.title,
    domain: window.location.hostname,
  };
}

// ===== 录制函数 =====

function recordOperation(type, data = {}) {
  if (!recorderState.isRecording) return;

  const trustedTimestamp = getTrustedTimestamp();

  const operation = {
    id: generateId(),
    type: type,
    timestamp: trustedTimestamp.timestamp,
    timestampUnix: trustedTimestamp.unix,
    timestampDisplay: trustedTimestamp.display,
    timestampSource: trustedTimestamp.source,
    pageInfo: getPageInfo(),
    platform: recorderState.currentPlatform ? {
      name: recorderState.currentPlatform.name,
      type: recorderState.currentPlatform.type,
    } : null,
    data: data,
  };

  // 添加创作内容标记
  if (type.includes('ai_') || type.includes('generate')) {
    operation.isCreativeContent = true;
    recorderState.creativeContent.push(operation);
  }

  recorderState.operations.push(operation);

  // 发送到Background
  try {
    browserAPI.runtime.sendMessage({
      action: 'recordOperation',
      operation: operation,
      sessionId: recorderState.sessionId,
    });
    console.log(`[一鉴到底] 已记录: ${type} @ ${trustedTimestamp.display}`, data.preview ? `预览: ${data.preview.substring(0, 30)}...` : '');
  } catch (err) {
    console.error('[一鉴到底] 发送失败', err);
  }

  // 更新浮动窗口统计
  updateFloatingStats();
}

// ===== 浮动窗口 =====

function showFloatingWindow() {
  console.log('[一鉴到底] 尝试显示浮动窗口');

  // 确保DOM已加载
  if (!document.body) {
    console.warn('[一鉴到底] document.body未加载，延迟显示');
    setTimeout(showFloatingWindow, 500);
    return;
  }

  if (!floatingWindow) {
    console.log('[一鉴到底] 浮动窗口不存在，创建新窗口');
    createFloatingWindow();
  }

  if (floatingWindow) {
    // 使用classList添加visible类，配合CSS显示
    floatingWindow.classList.add('visible');
    floatingWindow.classList.remove('minimized');
    floatingWindow.style.display = 'block'; // 确保显示
    startUpdateTime();
    console.log('[一鉴到底] 浮动窗口已显示，样式:', floatingWindow.style.display);
  } else {
    console.error('[一鉴到底] 创建浮动窗口失败');
  }
}

function hideFloatingWindow() {
  console.log('[一鉴到底] 隐藏浮动窗口');

  if (floatingWindow) {
    // 多重隐藏机制
    floatingWindow.classList.remove('visible');
    floatingWindow.classList.add('hidden');
    floatingWindow.style.display = 'none';
    floatingWindow.style.visibility = 'hidden';
    floatingWindow.style.opacity = '0';
  }

  // 清除时间更新定时器
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
    timeUpdateInterval = null;
  }

  // 移除录制提示条
  removeRecordingBanner();
}

// ===== 强制停止录制（纠错机制）=====

function forceStopRecording() {
  console.log('[一鉴到底] 强制停止录制');

  // 1. 立即停止本地状态
  recorderState.isRecording = false;

  // 2. 隐藏悬浮窗
  hideFloatingWindow();

  // 3. 尝试通知background（不等待响应）
  if (browserAPI && browserAPI.runtime) {
    browserAPI.runtime.sendMessage({
      action: 'stopRecording',
      operations: recorderState.operations,
      sessionId: recorderState.sessionId,
    }).catch(err => {
      console.warn('[一鉴到底] 通知Background失败（已本地停止）:', err.message);
    });
  }

  // 4. 清理定时器
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
    timeUpdateInterval = null;
  }

  // 5. 显示提示
  showToast('录制已强制停止');

  console.log('[一鉴到底] 录制已完全停止');
}

// 定期检查录制状态一致性（纠错机制）
setInterval(() => {
  if (recorderState.isRecording) {
    // 检查悬浮窗是否存在
    if (!floatingWindow || !document.body.contains(floatingWindow)) {
      console.warn('[一鉴到底] 检测到状态不一致：悬浮窗丢失，自动创建');
      createFloatingWindow();
      showFloatingWindow();
    }
  }
}, 10000); // 每10秒检查一次

// ===== 录制提示条 =====

let recordingBanner = null;

function createRecordingBanner() {
  // 如果已存在，先移除
  removeRecordingBanner();

  recordingBanner = document.createElement('div');
  recordingBanner.id = 'yijiandaodi-recording-banner';
  recordingBanner.innerHTML = `
    <div class="banner-content">
      <span class="banner-icon">🔴</span>
      <span class="banner-text">正在录制中 · 所有创作操作将被记录</span>
      <button class="banner-stop-btn">停止录制</button>
    </div>
  `;

  document.body.appendChild(recordingBanner);

  // 绑定停止按钮事件
  const stopBtn = recordingBanner.querySelector('.banner-stop-btn');
  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      try {
        await browserAPI.runtime.sendMessage({ action: 'stopRecording' });
      } catch (error) {
        console.error('[一鉴到底] 停止录制失败:', error);
      }
    });
  }
}

function removeRecordingBanner() {
  if (recordingBanner) {
    recordingBanner.remove();
    recordingBanner = null;
  }
}

function createFloatingWindow() {
  console.log('[一鉴到底] 创建浮动窗口');

  // 如果已存在，先移除
  const existing = document.getElementById('yijiandaodi-floating-window');
  if (existing) {
    existing.remove();
  }

  floatingWindow = document.createElement('div');
  floatingWindow.id = 'yijiandaodi-floating-window';
  floatingWindow.innerHTML = `
    <div class="header">
      <span class="title">一鉴到底</span>
      <div class="controls">
        <div class="control-btn minimize-btn" title="最小化">−</div>
        <div class="control-btn close-btn" title="最小化">×</div>
      </div>
    </div>
    <div class="time-card">
      <div class="time">--:--:--</div>
      <div class="date">----/--/--</div>
      <div class="source">来源: 国家授时中心</div>
    </div>
    <div class="status-area">
      <div class="status-row">
        <div class="status-indicator"></div>
        <span class="status-text">正在录制</span>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value operations-count">0</div>
        <div class="label">操作数</div>
      </div>
      <div class="stat-card">
        <div class="value creative-count">0</div>
        <div class="label">创作内容</div>
      </div>
      <div class="stat-card">
        <div class="value fingerprints-count">0</div>
        <div class="label">指纹数</div>
      </div>
    </div>
    <div class="platform-info">
      <span class="platform-name">识别平台: --</span>
    </div>
    <div class="rules-tip" id="rulesTip" style="display: none;">
      <div class="rules-tip-header">📋 平台规则提示</div>
      <div class="rules-tip-content" id="rulesTipContent"></div>
    </div>
    <div class="actions">
      <button class="action-btn stop">停止录制</button>
      <button class="action-btn export">导出报告</button>
    </div>
  `;

  document.body.appendChild(floatingWindow);

  // 已禁用顶部红色录制提示条（用户反馈不想要）

  // ===== 添加拖拽功能 =====
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const header = floatingWindow.querySelector('.header');
  if (header) {
    header.addEventListener('mousedown', (e) => {
      // 只有点击header才能拖拽
      if (e.target.classList.contains('control-btn')) return; // 控制按钮不触发拖拽

      isDragging = true;
      const rect = floatingWindow.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      floatingWindow.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffsetX;
      const newY = e.clientY - dragOffsetY;

      // 边界检测，防止拖出屏幕
      const maxX = window.innerWidth - floatingWindow.offsetWidth;
      const maxY = window.innerHeight - floatingWindow.offsetHeight;

      floatingWindow.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
      floatingWindow.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
      floatingWindow.style.right = 'auto'; // 清除right定位
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        floatingWindow.style.cursor = '';
      }
    });
  }

  // 绑定事件
  const minimizeBtn = floatingWindow.querySelector('.minimize-btn');
  const closeBtn = floatingWindow.querySelector('.close-btn');
  const stopBtn = floatingWindow.querySelector('.action-btn.stop');
  const exportBtn = floatingWindow.querySelector('.action-btn.export');

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      floatingWindow.classList.toggle('minimized');
      minimizeBtn.textContent = floatingWindow.classList.contains('minimized') ? '+' : '−';
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      floatingWindow.classList.add('minimized');
      minimizeBtn.textContent = '+';
    });
  }
  
  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      // 使用强制停止机制
      forceStopRecording();
    });
  }
  
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const response = await browserAPI.runtime.sendMessage({
          action: 'exportReport',
          sessionId: recorderState.sessionId,
        });
        
        if (response && response.success) {
          const reportHtml = response.report.evidenceChain || response.report.html || '<html><body><h1>报告</h1></body></html>';
          const blob = new Blob([reportHtml], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `证据链报告-${new Date().toLocaleDateString()}.html`;
          a.click();
          
          URL.revokeObjectURL(url);
          showToast('报告已导出');
        }
      } catch (error) {
        console.error('[一鉴到底] 导出失败:', error);
      }
    });
  }
  
  console.log('[一鉴到底] 浮动窗口创建完成');
}

function startUpdateTime() {
  // 先清除旧的定时器，避免重复
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }

  // 立即更新一次
  updateFloatingTime();

  // 创建新的定时器
  timeUpdateInterval = setInterval(updateFloatingTime, 1000);
}

function updateFloatingTime() {
  if (!floatingWindow) return;
  
  const now = new Date();
  const beijingTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000));
  
  const hours = beijingTime.getHours().toString().padStart(2, '0');
  const minutes = beijingTime.getMinutes().toString().padStart(2, '0');
  const seconds = beijingTime.getSeconds().toString().padStart(2, '0');
  
  const year = beijingTime.getFullYear();
  const month = (beijingTime.getMonth() + 1).toString().padStart(2, '0');
  const day = beijingTime.getDate().toString().padStart(2, '0');
  
  const timeEl = floatingWindow.querySelector('.time-card .time');
  const dateEl = floatingWindow.querySelector('.time-card .date');
  
  if (timeEl) timeEl.textContent = `${hours}:${minutes}:${seconds}`;
  if (dateEl) dateEl.textContent = `${year}/${month}/${day}`;
}

function updateFloatingStats() {
  if (!floatingWindow) return;

  const opCountEl = floatingWindow.querySelector('.operations-count');
  const creativeCountEl = floatingWindow.querySelector('.creative-count');
  const fpCountEl = floatingWindow.querySelector('.fingerprints-count');
  const platformEl = floatingWindow.querySelector('.platform-name');

  if (opCountEl) opCountEl.textContent = recorderState.operations.length;
  if (creativeCountEl) creativeCountEl.textContent = recorderState.creativeContent.length;
  if (fpCountEl) fpCountEl.textContent = recorderState.operations.length;

  if (platformEl && recorderState.currentPlatform) {
    platformEl.textContent = `平台: ${recorderState.currentPlatform.name}`;
    // 显示平台规则提示
    showPlatformRulesTip(recorderState.currentPlatform.key);
  } else if (platformEl) {
    platformEl.textContent = '平台: 通用网页';
  }
}

// ===== 平台规则提示 =====

function showPlatformRulesTip(platformKey) {
  const rulesTip = document.getElementById('rulesTip');
  const rulesTipContent = document.getElementById('rulesTipContent');

  if (!rulesTip || !rulesTipContent) return;

  // 抖音平台规则提示
  const douyinRules = `
    <div style="font-size: 11px; line-height: 1.6;">
      <div style="color: #ef4444; margin-bottom: 6px;">⚠️ 音乐版权</div>
      <div style="color: #64748b; margin-bottom: 8px;">
        • 抖音/剪映音乐仅限抖音内使用<br>
        • 跨平台发布需单独授权<br>
        • 商用需获得商用授权
      </div>
      <div style="color: #f59e0b; margin-bottom: 6px;">🎤 AI配音</div>
      <div style="color: #64748b; margin-bottom: 8px;">
        • AI化他人声音需明确授权<br>
        • 录音合同≠声音人格权授权
      </div>
      <div style="color: #3b82f6;">📹 视频搬运</div>
      <div style="color: #64748b;">
        • 相似度≥70%触发预警<br>
        • 保留创作过程录屏作为申诉证据
      </div>
    </div>
  `;

  const tips = {
    'douyin': douyinRules,
    'iesdouyin': douyinRules,
  };

  if (tips[platformKey]) {
    rulesTipContent.innerHTML = tips[platformKey];
    rulesTip.style.display = 'block';
  } else {
    rulesTip.style.display = 'none';
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'yijiandaodi-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 9999999;
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 2500);
}

// ===== 消息处理 =====

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[一鉴到底] 收到消息:', message.action);
  
  switch (message.action) {
    case 'ping':
      sendResponse({ success: true, loaded: true });
      return true;
      
    case 'startRecording':
      recorderState.isRecording = true;
      recorderState.sessionId = message.sessionId || generateId();
      recorderState.startTime = new Date().toISOString();
      recorderState.operations = [];
      recorderState.creativeContent = [];

      // 识别当前创作平台
      recorderState.currentPlatform = detectCurrentPlatform();
      console.log('[一鉴到底] 开始录制', recorderState.sessionId);
      console.log('[一鉴到底] 当前平台:', recorderState.currentPlatform?.name || '通用网页');

      // 显示浮动窗口
      setTimeout(showFloatingWindow, 100);

      sendResponse({ success: true, sessionId: recorderState.sessionId, platform: recorderState.currentPlatform });
      return true;
      
    case 'stopRecording':
    case 'forceStopRecording':
      // 强制停止录制
      recorderState.isRecording = false;
      console.log('[一鉴到底] 停止录制，操作数:', recorderState.operations.length);
      console.log('[一鉴到底] 创作内容数', recorderState.creativeContent.length);

      // 完全隐藏浮动窗口
      hideFloatingWindow();

      // 清理所有状态
      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
        timeUpdateInterval = null;
      }

      sendResponse({
        success: true,
        operations: recorderState.operations,
        creativeContent: recorderState.creativeContent,
        sessionId: recorderState.sessionId,
        platform: recorderState.currentPlatform,
      });
      return true;
      
    case 'getOperations':
      sendResponse({
        operations: recorderState.operations,
        sessionId: recorderState.sessionId,
      });
      return true;
      
    case 'getState':
      sendResponse(recorderState);
      return true;
      
    default:
      sendResponse({ error: 'Unknown action' });
      return true;
  }
});

// ===== 事件监听（优化版）====

// 监听输入事件（使用防抖，避免频繁记录）
document.addEventListener('input', (e) => {
  if (!recorderState.isRecording) return;

  // 只记录重要输入（textarea、大型输入框）
  if (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.target.type === 'text')) {
    const textContent = e.target.value;
    // 只记录超过10个字符的输入（减少噪音）
    if (textContent && textContent.length > 10) {
      debounceRecord(OPERATION_TYPES.TEXT_INPUT, {
        element: e.target.tagName,
        preview: textContent.substring(0, 100), // 只存预览
        length: textContent.length,
      });
    }
  }
}, true);

// 监听复制事件
document.addEventListener('copy', (e) => {
  if (!recorderState.isRecording) return;

  const selection = window.getSelection().toString();
  if (selection && selection.length > 10) {
    debounceRecord(OPERATION_TYPES.COPY, {
      preview: selection.substring(0, 100),
      length: selection.length,
    });
  }
}, true);

// 监听粘贴事件
document.addEventListener('paste', (e) => {
  if (!recorderState.isRecording) return;

  debounceRecord(OPERATION_TYPES.PASTE, {});
}, true);

// 监听文件上传
document.addEventListener('change', (e) => {
  if (!recorderState.isRecording) return;

  if (e.target.type === 'file') {
    const files = e.target.files;
    if (files && files.length > 0) {
      debounceRecord(OPERATION_TYPES.FILE_UPLOAD, {
        fileName: files[0].name,
        fileSize: files[0].size,
        fileType: files[0].type,
      });
    }
  }
}, true);

// 监听按钮点击（减少关键词匹配）
document.addEventListener('click', (e) => {
  if (!recorderState.isRecording) return;

  const buttonText = (e.target.innerText || e.target.value || '').toLowerCase();
  const buttonClass = e.target.classList?.toString() || '';

  // 检测发送按钮（DeepSeek、豆包等）
  const isSendButton = buttonText.includes('发送') ||
                        buttonText.includes('send') ||
                        buttonClass.includes('send') ||
                        buttonClass.includes('submit');

  if (isSendButton) {
    console.log('[一鉴到底] 检测到发送按钮点击');

    // 延迟捕获AI对话内容（等待AI回复）
    setTimeout(() => {
      const content = captureAIChatContent();
      if (content) {
        console.log('[一鉴到底] 捕获到AI对话内容');

        // 记录用户提问
        if (content.prompt && content.prompt.length > 5) {
          recordOperation(OPERATION_TYPES.AI_PROMPT, {
            preview: content.prompt.substring(0, 200),
            length: content.prompt.length,
            platform: recorderState.currentPlatform?.name
          });
        }

        // 记录AI回复
        if (content.response && content.response.length > 5) {
          recordOperation(OPERATION_TYPES.AI_RESPONSE, {
            preview: content.response.substring(0, 500),
            length: content.response.length,
            platform: recorderState.currentPlatform?.name
          });

          // 更新创作内容
          recorderState.creativeContent.push({
            type: 'ai_response',
            content: content.response.substring(0, 1000),
            timestamp: Date.now()
          });

          updateFloatingStats();
        }
      }
    }, 3000); // 延迟3秒，等待AI回复完成
  }

  // 只匹配关键按钮
  if (buttonText.includes('生成') || buttonText.includes('create') || buttonText.includes('generate')) {
    debounceRecord(OPERATION_TYPES.AI_GENERATE, { buttonText: buttonText.substring(0, 50) });
  }

  if (buttonText.includes('保存') || buttonText.includes('save') || buttonText.includes('导出')) {
    debounceRecord(OPERATION_TYPES.SAVE, { buttonText: buttonText.substring(0, 50) });
  }
}, true);

// ===== 初始化 =====

console.log('[一鉴到底] 当前页面:', window.location.href);

// 安全发送消息到Background（带错误处理）
async function safeSendMessage(message) {
  if (!browserAPI) {
    console.warn('[一鉴到底] 浏览器API不可用，跳过消息发送');
    return null;
  }
  
  try {
    return await browserAPI.runtime.sendMessage(message);
  } catch (err) {
    // 扩展被重新加载或页面不支持的静默处理
    if (err.message?.includes('Extension context invalidated') || 
        err.message?.includes('Extension not loaded')) {
      console.warn('[一鉴到底] 扩展已重新加载，请刷新页面');
    } else {
      console.warn('[一鉴到底] 发送消息失败:', err.message);
    }
    return null;
  }
}

// 通知Background页面已加载，并检查录制状态
async function initializeContentScript() {
  console.log('[一鉴到底] 开始初始化 Content Script');
  
  try {
    // 先通知页面加载
    const pageLoadResponse = await safeSendMessage({
      action: 'pageLoaded',
      pageInfo: getPageInfo(),
    });
    console.log('[一鉴到底] pageLoaded 响应:', pageLoadResponse);

    // 检查是否有正在进行的录制会话（带重试机制）
    let retries = 3;
    while (retries > 0) {
      try {
        console.log('[一鉴到底] 尝试获取录制状态，剩余重试次数:', retries);
        const response = await safeSendMessage({ action: 'getRecordingState' });
        console.log('[一鉴到底] getRecordingState 响应:', JSON.stringify(response, null, 2));
        
        if (response && response.recordingState) {
          const { isRecording, sessionId, operations } = response.recordingState;
          console.log('[一鉴到底] 录制状态:', { isRecording, sessionId, operationsCount: operations?.length });
          
          if (isRecording) {
            console.log('[一鉴到底] ✅ 检测到正在录制，恢复录制状态');
            
            // 恢复录制状态（包括完整的操作列表）
            recorderState.isRecording = true;
            recorderState.sessionId = sessionId;
            recorderState.startTime = response.recordingState.startTime;
            recorderState.operations = operations || [];
            recorderState.currentPlatform = detectCurrentPlatform();

            console.log('[一鉴到底] 已恢复', recorderState.operations.length, '个操作记录');

            // 延迟显示悬浮窗，确保页面加载完成
            const showDelay = 800;
            console.log('[一鉴到底] 将在', showDelay, 'ms 后显示悬浮窗');
            setTimeout(() => {
              try {
                console.log('[一鉴到底] 开始显示悬浮窗...');
                showFloatingWindow();
                updateFloatingStats();
                console.log('[一鉴到底] ✅ 悬浮窗显示完成');
              } catch (e) {
                console.error('[一鉴到底] ❌ 显示悬浮窗失败:', e);
              }
            }, showDelay);
            
            console.log('[一鉴到底] 录制状态已恢复，会话ID:', recorderState.sessionId);
          } else {
            console.log('[一鉴到底] 当前无录制会话');
          }
        } else {
          console.log('[一鉴到底] 未获取到有效的录制状态');
        }
        break; // 成功，退出重试循环
      } catch (err) {
        console.error('[一鉴到底] 获取录制状态失败:', err);
        retries--;
        if (retries > 0) {
          console.log('[一鉴到底] 等待 500ms 后重试...');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  } catch (err) {
    // 静默处理错误，不影响页面正常使用
    console.error('[一鉴到底] 初始化失败:', err);
  }
}

// 延迟初始化，确保页面完全加载
if (document.readyState === 'complete') {
  setTimeout(initializeContentScript, 300);
} else {
  window.addEventListener('load', () => {
    setTimeout(initializeContentScript, 300);
  });
}

// 监听页面可见性变化，优化性能
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && recorderState.isRecording) {
    // 页面重新可见时，从Background同步最新操作列表
    safeSendMessage({ action: 'getRecordingState' })
      .then(response => {
        if (response?.recordingState?.operations) {
          recorderState.operations = response.recordingState.operations;
          updateFloatingStats();
        }
      });
  }
});

// 监听页面卸载，确保数据同步
window.addEventListener('beforeunload', () => {
  if (recorderState.isRecording && recorderState.operations.length > 0) {
    // 尝试同步最新操作（不等待响应）
    safeSendMessage({
      action: 'syncOperations',
      sessionId: recorderState.sessionId,
      operations: recorderState.operations,
    });
  }
});

// 监听网络状态变化
window.addEventListener('online', () => {
  console.log('[一鉴到底] 网络已恢复');
  if (recorderState.isRecording) {
    // 重新同步状态
    safeSendMessage({ action: 'getRecordingState' })
      .then(response => {
        if (response?.recordingState?.operations) {
          recorderState.operations = response.recordingState.operations;
          updateFloatingStats();
        }
      });
  }
});

window.addEventListener('offline', () => {
  console.log('[一鉴到底] 网络已断开，录制将继续本地保存');
});

// ===== 扩展卸载检测机制 =====
// 当扩展被删除或禁用时，自动清理所有注入的元素

function checkExtensionAlive() {
  try {
    // 检查chrome.runtime是否还存在
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
      console.log('[一鉴到底] 检测到扩展已卸载，清理所有元素');
      cleanupInjectedElements();
      return false;
    }
    return true;
  } catch (e) {
    // 如果抛出错误，说明扩展上下文已失效
    console.log('[一鉴到底] 扩展上下文已失效，清理所有元素');
    cleanupInjectedElements();
    return false;
  }
}

function cleanupInjectedElements() {
  // 1. 移除悬浮窗
  if (floatingWindow) {
    floatingWindow.remove();
    floatingWindow = null;
  }

  // 2. 移除录制提示条
  removeRecordingBanner();

  // 3. 移除所有toast
  document.querySelectorAll('.yijiandaodi-toast').forEach(el => el.remove());

  // 4. 清除所有定时器
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
    timeUpdateInterval = null;
  }

  // 5. 移除注入的样式（如果有）
  const injectedStyles = document.getElementById('yijiandaodi-injected-styles');
  if (injectedStyles) {
    injectedStyles.remove();
  }

  // 6. 清除全局标记
  window.__YIJIANDAODI_CONTENT_LOADED__ = false;

  console.log('[一鉴到底] 所有注入元素已清理');
}

// 每30秒检查一次扩展是否还在运行
setInterval(() => {
  if (!checkExtensionAlive()) {
    // 扩展已卸载，停止所有检查
    console.log('[一鉴到底] 扩展已卸载，停止所有后台任务');
  }
}, 30000);

// 页面加载时立即检查一次
setTimeout(checkExtensionAlive, 5000);

} // 结束 else 块（防止重复注入）
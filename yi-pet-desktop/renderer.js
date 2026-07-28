/**
 * 一鉴到底桌宠 - 渲染进程JavaScript
 */

// 获取DOM元素
const petAvatar = document.getElementById('pet-avatar');
const statusBubble = document.getElementById('status-bubble');
const bubbleContent = statusBubble.querySelector('.bubble-content');

// 当前状态
let currentState = 'green';

// 状态配置
const STATE_CONFIG = {
  green: {
    message: '系统安全运行中 ✓',
    color: '#58D68D',
    animation: 'idle'
  },
  yellow: {
    message: '正在检测中...',
    color: '#F7DC6F',
    animation: 'scanning'
  },
  red: {
    message: '⚠ 发现风险！',
    color: '#E74C3C',
    animation: 'warning'
  }
};

/**
 * 初始化
 */
function init() {
  // 监听状态变化
  window.yiPetAPI.onStateChange(handleStateChange);

  // 获取初始状态
  window.yiPetAPI.getState();

  // 添加鼠标事件
  addMouseEventListeners();

  // 显示欢迎气泡
  showBubble('你好！我是小鉴', 3000);
}

/**
 * 处理状态变化
 */
function handleStateChange(newState) {
  if (currentState === newState) return;

  currentState = newState;
  updatePetAppearance();
}

/**
 * 更新桌宠外观
 */
function updatePetAppearance() {
  const config = STATE_CONFIG[currentState];

  // 移除所有状态类
  petAvatar.classList.remove('state-green', 'state-yellow', 'state-red');

  // 添加新状态类
  petAvatar.classList.add(`state-${currentState}`);

  // 更新状态指示器颜色
  document.querySelector('.pet-status-indicator').style.backgroundColor = config.color;

  // 显示状态气泡
  showBubble(config.message, 2000);
}

/**
 * 显示气泡提示
 */
function showBubble(message, duration = 2000) {
  bubbleContent.textContent = message;
  statusBubble.classList.add('visible');

  setTimeout(() => {
    statusBubble.classList.remove('visible');
  }, duration);
}

/**
 * 添加鼠标事件监听器
 */
function addMouseEventListeners() {
  const petContainer = document.getElementById('pet-container');

  // 左键点击：显示状态
  petContainer.addEventListener('click', (event) => {
    const config = STATE_CONFIG[currentState];
    showBubble(config.message, 2000);
  });

  // 右键菜单（在主进程处理）
  petContainer.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    // 右键菜单由系统托盘处理
  });

  // 鼠标悬停：显示详细信息
  petContainer.addEventListener('mouseenter', () => {
    showBubble(`当前状态: ${currentState}`, 3000);
  });

  // 鼠标离开：隐藏气泡
  petContainer.addEventListener('mouseleave', () => {
    statusBubble.classList.remove('visible');
  });
}

/**
 * 动画控制
 */
function startAnimation(animationType) {
  petAvatar.classList.remove('anim-idle', 'anim-scanning', 'anim-warning');
  petAvatar.classList.add(`anim-${animationType}`);
}

/**
 * 交互效果
 */
function playInteractionEffect(effect) {
  switch(effect) {
    case 'happy':
      petAvatar.classList.add('effect-happy');
      setTimeout(() => petAvatar.classList.remove('effect-happy'), 500);
      break;
    case 'alert':
      petAvatar.classList.add('effect-alert');
      setTimeout(() => petAvatar.classList.remove('effect-alert'), 500);
      break;
  }
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
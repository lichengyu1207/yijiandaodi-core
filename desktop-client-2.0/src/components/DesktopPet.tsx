import React, { useState, useEffect } from 'react';
import './DesktopPet.css';

/**
 * 一鉴到底桌宠组件 - 小鉴
 * 
 * 功能：
 * - 显示在桌面右下角
 * - 使用动态PNG图片
 * - 智能交互：点击打开主窗口、30秒无交互打招呼
 * - 状态指示：绿灯（正常）、黄灯（检测中）、红灯（警示）
 */

interface DesktopPetProps {
  onStateChange?: (state: 'green' | 'yellow' | 'red' | 'thinking') => void;
}

type PetState = 'green' | 'yellow' | 'red' | 'thinking';

const DesktopPet: React.FC<DesktopPetProps> = ({ onStateChange }) => {
  const [state, setState] = useState<PetState>('green');
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleMessage, setBubbleMessage] = useState('');
  const [lastInteractionTime, setLastInteractionTime] = useState(Date.now());

  // 状态配置
  const stateConfig = {
    green: {
      image: '/pet-idle.png',
      message: '系统安全运行中 ✓',
      color: '#58D68D',
      animClass: 'idle'
    },
    yellow: {
      image: '/pet-thinking.png',
      message: '正在检测中...',
      color: '#F7DC6F',
      animClass: 'thinking'
    },
    red: {
      image: '/pet-alert.png',
      message: '⚠ 发现风险！',
      color: '#E74C3C',
      animClass: 'alert'
    },
    thinking: {
      image: '/pet-thinking.png',
      message: 'AI 正在治理分析中...',
      color: '#F7DC6F',
      animClass: 'thinking'
    }
  };

  // 打招呼消息列表
  const GREETING_MESSAGES = [
    '嗨！别忘了定期检查系统安全哦~',
    '主人，我还在这里守护着呢！',
    '要不要来看看最近的安全报告？',
    '系统一切正常，放心使用吧！',
    '有什么需要帮助的吗？'
  ];

  /**
   * 显示气泡消息
   */
  const showBubbleMessage = (message: string, duration = 3000) => {
    setBubbleMessage(message);
    setShowBubble(true);
    setTimeout(() => setShowBubble(false), duration);
  };

  /**
   * 显示随机打招呼
   */
  const showRandomGreeting = () => {
    const randomMessage = GREETING_MESSAGES[Math.floor(Math.random() * GREETING_MESSAGES.length)];
    showBubbleMessage(randomMessage, 5000);
  };

  /**
   * 打开主窗口
   */
  const openMainWindow = () => {
    if (window.electronAPI?.openMainWindow) {
      window.electronAPI.openMainWindow();
    }
    setLastInteractionTime(Date.now());
  };

  // 监听来自主进程的状态更新
  useEffect(() => {
    if (window.electronAPI?.onPetStateChange) {
      window.electronAPI.onPetStateChange((newState: 'green' | 'yellow' | 'red' | 'thinking') => {
        setState(newState);
        showBubbleMessage(stateConfig[newState].message);
        onStateChange?.(newState);
        setLastInteractionTime(Date.now());
      });
    }

    // 获取初始状态
    if (window.electronAPI?.getPetState) {
      window.electronAPI.getPetState().then((initialState) => {
        if (initialState) {
          setState(initialState as 'green' | 'yellow' | 'red' | 'thinking');
        }
      });
    }

    // 初始欢迎
    setTimeout(() => {
      showBubbleMessage('你好！我是小鉴，点击我可以打开主窗口', 4000);
    }, 1000);
  }, [onStateChange]);

  // 30秒无交互自动打招呼
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastInteractionTime;
      
      // 超过30秒无交互
      if (elapsed > 30000) {
        showRandomGreeting();
        setLastInteractionTime(Date.now()); // 重置计时器
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [lastInteractionTime]);

  // 处理点击事件
  const handleClick = () => {
    openMainWindow();
    showBubbleMessage(stateConfig[state].message, 2000);
  };

  // 处理鼠标悬停
  const handleMouseEnter = () => {
    setLastInteractionTime(Date.now());
  };

  const config = stateConfig[state];

  return (
    <div
      className={`desktop-pet ${config.animClass}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      {/* 桌宠主体 */}
      <div className="pet-container">
        {/* 状态指示器 */}
        <div 
          className="status-indicator"
          style={{ backgroundColor: config.color }}
        />

        {/* 小鉴形象 - PNG图片 */}
        <img 
          src={config.image}
          alt="小鉴"
          className="pet-image"
        />
      </div>

      {/* 气泡提示 */}
      {showBubble && (
        <div className="bubble">
          <div className="bubble-content">
            {bubbleMessage}
          </div>
        </div>
      )}
    </div>
  );
};

export default DesktopPet;
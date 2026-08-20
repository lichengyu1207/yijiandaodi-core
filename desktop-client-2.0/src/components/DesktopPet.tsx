import React, { useState, useEffect } from 'react';
import './DesktopPet.css';

/**
 * 一鉴到底桌宠组件 - 小鉴
 * 
 * 融合 Claude Code 风格：
 * - 内联 SVG 帧动画，不依赖外部图片
 * - 角色属性面板（悬停显示）
 * - 稀有度星标
 * - 状态变色动画
 * 
 * 功能：
 * - 显示在主界面设置页内
 * - 智能交互：点击打开主窗口
 * - 状态指示：绿灯（正常）、黄灯（检测中）、红灯（警示）
 */

interface DesktopPetProps {
  onStateChange?: (state: 'green' | 'yellow' | 'red' | 'thinking') => void;
  character?: {
    name: string;
    species: string;
    rarity: string;
    rarityStars: string;
    shiny: boolean;
    stats: Record<string, number>;
  } | null;
}

type PetState = 'green' | 'yellow' | 'red' | 'thinking';

// 状态配色（对齐 Claude 风格）
const MOOD_COLORS = {
  green: '#58D68D',
  yellow: '#F7DC6F',
  red: '#E74C3C',
  thinking: '#5DADE2',
};

const MOOD_BODY = {
  green: '#4A90D9',
  yellow: '#F0C75E',
  red: '#E08B7E',
  thinking: '#7FB8E8',
};

// 属性标签映射
const STAT_LABELS: Record<string, string> = {
  VIGILANCE: '警觉',
  WISDOM: '智慧',
  PATIENCE: '耐心',
  EXECUTION: '执行',
  CHAOS: '混沌',
};

const DesktopPet: React.FC<DesktopPetProps> = ({ onStateChange, character }) => {
  const [state, setState] = useState<PetState>('green');
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleMessage, setBubbleMessage] = useState('');
  const [lastInteractionTime, setLastInteractionTime] = useState(Date.now());

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
        const defaultMessages = {
          green: '系统安全运行中 ✓',
          yellow: '正在检测中...',
          red: '⚠ 发现风险！',
          thinking: 'AI 正在治理分析中...',
        };
        showBubbleMessage(defaultMessages[newState], 3000);
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
    const defaultMessages = {
      green: '系统安全运行中 ✓',
      yellow: '正在检测中...',
      red: '⚠ 发现风险！',
      thinking: 'AI 正在治理分析中...',
    };
    showBubbleMessage(defaultMessages[state], 2000);
  };

  // 处理鼠标悬停
  const handleMouseEnter = () => {
    setLastInteractionTime(Date.now());
  };

  const currentBodyColor = MOOD_BODY[state];
  const currentIndicatorColor = MOOD_COLORS[state];

  return (
    <div
      className={`desktop-pet ${state}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      <div className="pet-container">
        {/* 角色徽标（名称 + 稀有度星标） */}
        <div className="badge">
          <span className="stars">{character?.rarityStars || '★'}</span>
          <span>{character?.name || '小鉴'}</span>
        </div>

        {/* 属性面板（悬停显示） */}
        {character?.stats && Object.keys(character.stats).length > 0 && (
          <div className="stats">
            {Object.entries(character.stats).map(([k, v]) => (
              <div key={k} className="stat-row">
                <span className="stat-label">{STAT_LABELS[k] || k}</span>
                <div className="stat-bar">
                  <div className="stat-fill" style={{ width: `${v}%` }} />
                </div>
                <span className="stat-value">{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* 状态光环 */}
        <div
          className="status-indicator"
          style={{ backgroundColor: currentIndicatorColor }}
        />

        {/* 桌宠主体（内联 SVG，融合 Claude Code 风格） */}
        <div className={`pet-body mood-${state}`}>
          <svg className="pet-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            {/* 身体 */}
            <ellipse id="bodyShape" cx="60" cy="78" rx="40" ry="34" fill={currentBodyColor} />
            {/* 肚皮 */}
            <ellipse cx="60" cy="86" rx="26" ry="20" fill="#EAF2FB" />
            {/* 耳朵 */}
            <path d="M32 52 L26 24 L50 40 Z" fill={currentBodyColor} />
            <path d="M88 52 L94 24 L70 40 Z" fill={currentBodyColor} />
            {/* 眼睛（眨眼动画） */}
            <ellipse className="eye" cx="48" cy="64" rx="5" ry="6" fill="#1C2733" />
            <ellipse className="eye" cx="72" cy="64" rx="5" ry="6" fill="#1C2733" />
            {/* 腮红 */}
            <circle cx="40" cy="76" r="4" fill="#F5A8B8" opacity="0.6" />
            <circle cx="80" cy="76" r="4" fill="#F5A8B8" opacity="0.6" />
            {/* 嘴 */}
            <path d="M56 78 Q60 82 64 78" stroke="#1C2733" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* 尾巴 */}
            <path d="M96 88 Q118 84 110 66" stroke={currentBodyColor} strokeWidth="8" fill="none" strokeLinecap="round" />
          </svg>
        </div>

        {/* 气泡提示 */}
        {showBubble && (
          <div className="bubble show tail">
            {bubbleMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopPet;
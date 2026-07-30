import { useEffect, useRef } from 'react';
import './LogoAnimation.css';

/**
 * Logo动画组件 - 可集成到官网首页
 * 自动播放，无需用户点击
 */
const LogoAnimation: React.FC = () => {
  const particlesRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 创建背景粒子
    if (particlesRef.current) {
      const particleCount = 40;
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 10 + 's';
        particle.style.animationDuration = (Math.random() * 5 + 8) + 's';
        particlesRef.current.appendChild(particle);
      }
    }

    // Logo出现后触发爆炸粒子
    const timer = setTimeout(() => {
      if (logoRef.current) {
        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
          const particle = document.createElement('div');
          particle.className = 'explosion-particle';
          
          const angle = (Math.PI * 2 * i) / particleCount;
          const distance = 100 + Math.random() * 50;
          const tx = Math.cos(angle) * distance;
          const ty = Math.sin(angle) * distance;
          
          particle.style.setProperty('--tx', tx + 'px');
          particle.style.setProperty('--ty', ty + 'px');
          particle.style.animationDelay = (i * 0.05) + 's';
          
          logoRef.current.appendChild(particle);
          
          setTimeout(() => {
            particle.remove();
          }, 1000);
        }
      }
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="logo-animation-wrapper">
      {/* 背景粒子 */}
      <div className="particles" ref={particlesRef}></div>

      {/* 主容器 */}
      <div className="logo-animation-container">
        {/* Logo容器 */}
        <div className="logo-wrapper" ref={logoRef}>
          {/* 外部旋转光环 */}
          <div className="outer-ring"></div>
          <div className="outer-ring"></div>
          <div className="outer-ring"></div>

          {/* 内部光晕 */}
          <div className="inner-glow"></div>

          {/* Logo图片 */}
          <img 
            src="/yi-removebg-preview.png" 
            alt="一鉴到底" 
            className="logo-img"
          />
        </div>

        {/* 标题 */}
        <h1 className="title">一鉴到底</h1>
        <p className="subtitle">AI Agent 安全平台</p>
      </div>
    </div>
  );
};

export default LogoAnimation;
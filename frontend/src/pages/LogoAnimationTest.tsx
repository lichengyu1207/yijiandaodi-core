import React from 'react';
import LogoAnimation from '@/components/LogoAnimation';

/**
 * Logo动画测试页面
 * 用于查看组件效果
 */
const LogoAnimationTest: React.FC = () => {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden'
    }}>
      <LogoAnimation />
    </div>
  );
};

export default LogoAnimationTest;
# Logo动画组件集成指南

## 一、组件说明

### 1.1 组件位置
- **组件文件：** `frontend/src/components/LogoAnimation/index.tsx`
- **样式文件：** `frontend/src/components/LogoAnimation/LogoAnimation.css`

### 1.2 组件特点
- ✅ **自动播放**：无需用户点击，页面加载后自动播放
- ✅ **纯CSS动画**：性能优秀，60fps流畅运行
- ✅ **响应式设计**：适配桌面端、平板、手机
- ✅ **React组件**：可直接集成到官网首页

---

## 二、集成方法

### 2.1 首页集成（推荐）

**修改文件：** `frontend/src/pages/Home/index.tsx`

**步骤1：导入组件**
```tsx
import LogoAnimation from '@/components/LogoAnimation';
```

**步骤2：添加到Hero区域**
```tsx
const Home: React.FC = () => {
  return (
    <div style={STYLES.page}>
      {/* Logo动画 - 放在最顶部 */}
      <LogoAnimation />
      
      {/* 原有内容 */}
      <div style={STYLES.container}>
        <div style={STYLES.heroArea}>
          <div style={STYLES.heroBanner}>
            <BannerCarousel />
          </div>
          <div style={STYLES.heroHot}>
            <HotRanking />
          </div>
        </div>
        
        {/* 其他内容... */}
      </div>
    </div>
  );
};
```

### 2.2 Banner轮播集成

**修改文件：** `frontend/src/pages/Home/components/BannerCarousel.tsx`

**将Logo动画作为第一个轮播项：**
```tsx
import LogoAnimation from '@/components/LogoAnimation';

const BannerCarousel: React.FC = () => {
  const bannerItems = [
    {
      id: 'logo-animation',
      content: <LogoAnimation />,
      isFullWidth: true,
    },
    {
      id: 'banner-1',
      image: '/banner1.jpg',
      title: 'AI Agent安全检测',
    },
    // 其他轮播项...
  ];

  return (
    <Carousel autoplay>
      {bannerItems.map(item => (
        <div key={item.id}>
          {item.content || <img src={item.image} alt={item.title} />}
        </div>
      ))}
    </Carousel>
  );
};
```

### 2.3 独立页面

**创建新页面：** `frontend/src/pages/Intro/index.tsx`

```tsx
import LogoAnimation from '@/components/LogoAnimation';

const Intro: React.FC = () => {
  return <LogoAnimation />;
};

export default Intro;
```

**添加路由：**
```tsx
// frontend/src/router/index.tsx
<Route path="/intro" element={<Intro />} />
```

---

## 三、配置选项

### 3.1 自动播放时间

**默认配置：**
- Logo入场：0.8秒
- 旋转展开：1.2秒
- 标题滑入：1.5秒（延迟2秒）
- 副标题淡入：1秒（延迟2.8秒）

**自定义时间：**
```tsx
<LogoAnimation 
  logoDuration={1000}    // Logo动画时长（毫秒）
  titleDelay={2000}      // 标题延迟时间（毫秒）
  autoPlay={true}        // 自动播放
/>
```

### 3.2 尺寸调整

**默认尺寸：**
- Logo：200x200px
- 标题：68px
- 副标题：24px

**自定义尺寸：**
```css
/* 修改 LogoAnimation.css */
.logo-img {
  width: 150px;  /* 修改Logo宽度 */
  height: 150px; /* 修改Logo高度 */
}

.title {
  font-size: 48px; /* 修改标题大小 */
}
```

### 3.3 颜色主题

**默认主题：**
- 主色：#165DFF（蓝色）
- 辅色：#00D4FF（科技蓝）
- 背景：#000000（深色）

**适配官网主题：**
```css
/* 修改 LogoAnimation.css */
.logo-animation-wrapper {
  background: linear-gradient(135deg, #F5F7FA 0%, #E8ECF1 100%);
}

.title {
  color: #165DFF; /* 使用官网主色 */
  text-shadow: none;
}

.subtitle {
  color: rgba(22, 93, 255, 0.8);
}
```

---

## 四、性能优化

### 4.1 懒加载

**推荐方式：**
```tsx
import { lazy, Suspense } from 'react';

const LogoAnimation = lazy(() => import('@/components/LogoAnimation'));

const Home: React.FC = () => {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <LogoAnimation />
    </Suspense>
  );
};
```

### 4.2 条件渲染

**只在首页加载：**
```tsx
const [showAnimation, setShowAnimation] = useState(false);

useEffect(() => {
  // 检查是否首次访问
  const hasSeenAnimation = localStorage.getItem('hasSeenAnimation');
  if (!hasSeenAnimation) {
    setShowAnimation(true);
    localStorage.setItem('hasSeenAnimation', 'true');
  }
}, []);

return (
  <>
    {showAnimation && <LogoAnimation />}
    {/* 其他内容 */}
  </>
);
```

### 4.3 动画控制

**手动控制播放：**
```tsx
const [isPlaying, setIsPlaying] = useState(true);

<LogoAnimation isPlaying={isPlaying} />

<button onClick={() => setIsPlaying(!isPlaying)}>
  {isPlaying ? '暂停' : '播放'}
</button>
```

---

## 五、样式定制

### 5.1 修改背景

**渐变背景：**
```css
.logo-animation-wrapper {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

**纯色背景：**
```css
.logo-animation-wrapper {
  background: #1a1a2e;
}
```

**图片背景：**
```css
.logo-animation-wrapper {
  background: url('/background.jpg') center/cover;
}
```

### 5.2 修改动画速度

**加快动画：**
```css
.logo-img {
  animation-duration: 0.5s; /* 缩短为0.5秒 */
}

.title {
  animation-duration: 1s; /* 缩短为1秒 */
}
```

**减慢动画：**
```css
.logo-img {
  animation-duration: 2s; /* 延长为2秒 */
}

.title {
  animation-duration: 2s; /* 延长为2秒 */
}
```

### 5.3 移除某些效果

**移除粒子：**
```tsx
// 注释掉粒子创建代码
useEffect(() => {
  // createParticles(); // 注释掉
}, []);
```

**移除光环：**
```css
.outer-ring {
  display: none;
}
```

---

## 六、响应式适配

### 6.1 移动端优化

**自动适配：**
- Logo自动缩小到140px
- 标题缩小到36px
- 副标题缩小到16px

**自定义断点：**
```css
@media (max-width: 768px) {
  .logo-img {
    width: 100px; /* 移动端更小 */
    height: 100px;
  }

  .title {
    font-size: 28px;
    letter-spacing: 4px;
  }
}
```

### 6.2 平板适配

```css
@media (min-width: 769px) and (max-width: 1024px) {
  .logo-img {
    width: 160px;
    height: 160px;
  }

  .title {
    font-size: 48px;
  }
}
```

---

## 七、注意事项

### 7.1 图片路径

**确保Logo图片存在：**
```
public/yi-removebg-preview.png
```

**修改图片路径：**
```tsx
<img 
  src="/yi-removebg-preview.png"  // 相对于public目录
  alt="一鉴到底" 
  className="logo-img"
/>
```

### 7.2 样式冲突

**避免全局样式污染：**
```css
/* 使用特定的类名前缀 */
.logo-animation-wrapper {
  /* 避免使用通用类名如 .container */
}
```

### 7.3 性能监控

**检查帧率：**
```javascript
useEffect(() => {
  let frameCount = 0;
  const startTime = performance.now();
  
  const checkFPS = () => {
    frameCount++;
    const elapsed = performance.now() - startTime;
    
    if (elapsed >= 1000) {
      console.log(`FPS: ${frameCount}`);
      frameCount = 0;
    }
    
    requestAnimationFrame(checkFPS);
  };
  
  checkFPS();
}, []);
```

---

## 八、完整示例

### 8.1 首页集成示例

```tsx
// frontend/src/pages/Home/index.tsx
import React, { lazy, Suspense } from 'react';
import LogoAnimation from '@/components/LogoAnimation';
import BannerCarousel from './components/BannerCarousel';
import HotRanking from './components/HotRanking';

const Home: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F7FA' }}>
      {/* Logo动画 */}
      <LogoAnimation />
      
      {/* 主要内容 */}
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
          <div style={{ flex: 2 }}>
            <BannerCarousel />
          </div>
          <div style={{ flex: 1 }}>
            <HotRanking />
          </div>
        </div>
        
        {/* 其他内容 */}
      </div>
    </div>
  );
};

export default Home;
```

---

## 九、总结

### 9.1 集成步骤

1. ✅ 复制组件到 `frontend/src/components/LogoAnimation/`
2. ✅ 在首页导入组件
3. ✅ 添加到页面顶部
4. ✅ 确保Logo图片存在
5. ✅ 测试自动播放效果

### 9.2 推荐方案

- **方案1：首页顶部** - 作为独立的Hero区域
- **方案2：Banner轮播** - 作为轮播的第一项
- **方案3：独立页面** - 创建专门的介绍页

---

**创建时间：** 2025年1月29日
**更新时间：** 2025年1月29日
**作者：** AI助手
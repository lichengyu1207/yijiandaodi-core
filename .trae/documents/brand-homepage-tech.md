# 一鉴到底 - 品牌官网首页 技术架构文档

## 1. 架构设计

```mermaid
graph TB
    subgraph 前端应用
        A[App.tsx<br/>ConfigProvider + Router] --> B[FrontLayout]
        B --> C[BrandNavbar<br/>固定导航+滚动交互]
        B --> D[BrandHome 首页]
        D --> D1[HeroSection<br/>粒子动画 + 逐字标题]
        D --> D2[ValueCards<br/>三卡片联动滑入]
        D --> D3[ScenarioCarousel<br/>场景轮播演示]
        D --> D4[ExperienceEntry<br/>CTA呼吸动效]
    end

    subgraph 动画层
        E1[framer-motion<br/>组件级动画] --> D1
        E1 --> D2
        E1 --> D3
        E1 --> D4
        E2[Canvas + requestAnimationFrame<br/>粒子系统] --> D1
    end

    subgraph 路由调整
        F1[/ → BrandHome 新首页] --> B
        F2[/execution-center → 原 Home 信息流] --> B
        F3[/agent 保持不变] --> B
    end

    subgraph 现有组件复用
        G1[FrontHeader.tsx<br/>NAV_ITEMS 更新] --> C
        G2[Home/index.tsx<br/>保留供 execution-center 使用] --> F2
    end
```

## 2. 技术选型

| 技术 | 版本 | 用途 |
|------|------|------|
| React | ^18.3.1 | UI 框架 |
| TypeScript | ~5.6.2 | 类型安全 |
| framer-motion | ^11.11.0 (已安装) | 组件级动画：scroll 监听、variants、stagger、whileInView |
| Canvas API | 内置 | Hero 区智能体粒子节点网络 + 数据流动画 |
| React Router v6 | ^6.26.0 | 路由管理 |
| Ant Design 5 | ^5.21.0 | 基础 UI 组件（Button, Carousel 等） |
| Lucide React | ^1.16.0 | 图标库 |
| Vite | ^5.4.8 | 构建工具 |

**不引入新依赖**: framer-motion 已安装，Canvas 使用原生 API，无需额外包。

## 3. 文件结构

```
frontend/src/
├── pages/
│   └── BrandHome/                    # 新增：品牌官网首页
│       ├── index.tsx                 # 主页面（组装所有区块）
│       ├── BrandNavbar.tsx           # 品牌导航栏（独立于 FrontHeader）
│       ├── HeroSection.tsx           # 英雄区（粒子背景 + 标题动画）
│       ├── ValueCards.tsx            # 核心价值三卡片
│       ├── ScenarioCarousel.tsx      # 场景演示轮播
│       ├── ExperienceEntry.tsx       # 体验入口 CTA
│       └── components/
│           ├── ParticleNetwork.tsx   # Canvas 粒子网络组件
│           ├── TypewriterText.tsx    # 逐字渐入文字效果
│           └── GlowButton.tsx        # 发光按钮组件
│   └── Home/                         # 保留：原信息流首页
│       └── index.tsx                 # 不修改，供 /execution-center 复用
├── components/
│   └── FrontHeader.tsx               # 修改：更新 NAV_ITEMS
├── router/
│   └── index.tsx                     # 修改：/ 路由指向 BrandHome
└── styles/
    └── brand-home.css                # 新增：品牌官网专用样式
```

## 4. 路由定义

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `BrandHome` | **新品牌官网首页**（替换原 Home） |
| `/execution-center` | `Home` (原信息流) | 原 Home 内容迁移至此路由 |
| `/agent` | `AIChatCenter` | 保持不变 |
| `/login` | `Login` | 保持不变 |
| 其他前台路由 | 不变 | 保持现有路由结构 |

### 路由调整代码

```tsx
// router/index.tsx 变更:
// Before: { path: '/', element: <Home /> }
// After:  { path: '/', element: <BrandHome /> }
// Add:    { path: '/execution-center', element: <Home /> }
```

### FrontHeader 导航调整

```tsx
// FrontHeader.tsx NAV_ITEMS 变更:
// Before:
const NAV_ITEMS = [
  { key: '/', label: '首页' },
  { key: '/about', label: '关于我们' },
];

// After:
const NAV_ITEMS = [
  { key: '/#products', label: '产品' },
  { key: '/#scenarios', label: '协同场景' },
  { key: '/#hero', label: '立即校验' },      // 锚点滚动到 Hero 区
  { key: '/about', label: '关于我们' },
];
// 右侧「Agent 执行」按钮跳转改为 /execution-center
```

## 5. 组件设计规范

### 5.1 BrandNavbar 组件

```typescript
interface BrandNavbarProps {
  // 无 props，内部使用 useScroll 监听滚动
}
// 行为：
// - 固定定位 top:0, z-index:1000
// - scrollY < 50: background transparent
// - scrollY >= 50: background rgba(15,118,110,0.95), backdrop-filter blur(12px)
// - Logo 左侧，导航居中，CTA 按钮右侧
// - 移动端：<768px 时显示汉堡菜单
```

### 5.2 HeroSection 组件

```typescript
interface HeroSectionProps {
  onCTAClick: () => void;  // 点击 CTA 回调
}
// 子组件：
// - ParticleNetwork (Canvas): 渲染智能体节点连线动画
// - TypewriterText: 逐字显示主标题，stagger 50ms/字
// - 副标题: fade-in + 轻微上下浮动 (y: [0, -10, 0])
// - CTA 按钮: hover scale(1.05) + box-shadow glow(#14B8A6)
```

### 5.3 ValueCards 组件

```typescript
interface ValueCard {
  icon: React.ReactNode;     // SVG 图标
  title: string;             // 卡片标题
  description: string;       // 描述文本
  animationOrigin: 'left' | 'right' | 'bottom';  // 滑入方向
}
// 三张卡片数据：
// 1. 多智能体协同校验 (origin: right)
// 2. 人人可鉴·零门槛操作 (origin: left)
// 3. 全场景适配 (origin: bottom)
// framer-motion: whileInView + slide-in variants
```

### 5.4 ScenarioCarousel 组件

```typescript
interface Scenario {
  id: string;
  title: string;
  description: string;
  demoContent: React.ReactNode;  // 场景演示内容
}
// 三个场景：enterprise / developer / compliance
// 自动轮播 5s 切换，支持手动点击切换
// 切换动画: AnimatePresence + fade
// 点击展开 Modal 显示详细演示
```

### 5.5 ExperienceEntry 组件

```typescript
interface ExperienceEntryProps {
  onEnter: () => void;  // 进入系统回调
}
// 大尺寸 CTA 按钮 + 辅助说明文字
// 按钮: animate 循环 scale([1, 1.03, 1]) duration=2s repeat=Infinity
// click: ripple 效果 + navigate to /execution-center or /login
```

## 6. Canvas 粒子系统设计

### 6.1 ParticleNetwork 技术规格

```
渲染方式: HTML5 Canvas + requestAnimationFrame
粒子数量: 40-60 个（根据屏幕宽度自适应）
粒子属性:
  - position: { x, y } 随机分布
  - velocity: { vx, vy } 缓慢漂移
  - radius: 2-4px
  - color: rgba(20,184,166,0.6) (#14B8A6 半透明)
连线规则:
  - 两粒子距离 < 150px 时绘制连线
  - 连线透明度随距离衰减 (1 → 0)
  - 连线颜色: rgba(224,242,254,0.15) (#E0F2FE 极淡)
交互:
  - 鼠标靠近时粒子轻微排斥（距离 < 100px）
  - 性能优化: requestAnimationFrame + 节流 resize
清理:
  - 组件卸载时 cancelAnimationFrame + 清除 canvas
```

## 7. 动画实现细节

### 7.1 framer-motion 关键配置

| 区域 | 动画类型 | 配置要点 |
|------|---------|---------|
| 导航栏背景 | style animation | useScroll + useMotionValueEvent, bg opacity 0→0.95 |
| Hero 标题 | stagger children | variants: { hidden:{opacity:0,y:20}, visible:{opacity:1,y:0, staggerChildren:0.05} } |
| Hero 副标题 | fade + float | animate={{y:[0,-8,0]}} transition={{repeat:Infinity,duration:4}} |
| 价值卡片 | slide-in + hover | whileInView={{opacity:1,x:0}}, whileHover={{y:-8}} |
| 场景轮播 | AnimatePresence | mode="wait", initial=false, exit/fade 500ms |
| CTA 按钮 | hover + tap | whileHover={{scale:1.05}}, whileTap={{scale:0.97}} |
| 呼吸动效 | loop animate | animate={{scale:[1,1.03,1]}} transition={{duration:2,repeat:Infinity,ease:"easeInOut"}} |

### 7.2 滚动触发策略

```typescript
// 使用 framer-motion 的 whileInView 替代手动 scroll listener
// 阈值设置: viewport={{ once: true, amount: 0.3 }}
// 各区块触发顺序: Hero(立即) → Cards(scroll到30%) → Carousel(scroll到30%) → Entry(scroll到30%)
```

## 8. 图片资源规划

| 资源 | 规格 | 来源 |
|------|------|------|
| Logo | SVG 或 PNG 透明底 | 复用现有 /logo.png 或重新设计 |
| 智能体节点图标 | SVG 内联 | 自定义绘制（3种不同形态） |
| 场景演示插图 | 可选 SVG/CSS 实现 | CSS 动画优先，减少图片依赖 |
| 背景 | CSS 渐变 + Canvas | 无需图片文件 |

## 9. 性能预算

| 指标 | 目标值 |
|------|--------|
| 首屏 LCP | < 2.5s |
| FID | < 100ms |
| CLS | < 0.1 |
| Canvas FPS | 稳定 60fps（粒子数量自适应降级） |
| Bundle Size 增量 | < 50KB gzipped（纯组件代码） |

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Shield,
  GitBranch,
  Route,
  Terminal,
  Link,
  Network,
  Bug,
  ScanLine,
  EyeOff,
  Layers,
  FileCheck,
  Radar,
  Clock,
  Fingerprint,
  Star,
  ArrowRight,
  Sparkles,
  Flame,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Shield,
  GitBranch,
  Route,
  Terminal,
  Link,
  Network,
  Bug,
  ScanLine,
  EyeOff,
  Layers,
  FileCheck,
  Radar,
  Clock,
  Fingerprint,
};

interface Agent {
  id: string;
  name: string;
  nameEn: string;
  desc: string;
  category: string;
  rating: number;
  reviews: number;
  icon: string;
  gradient: string;
  tags: string[];
  isNew?: boolean;
  isHot?: boolean;
  coverImage: string;
}

const agents: Agent[] = [
  {
    id: 'ass-gateway',
    name: 'ASS 安全网关',
    nameEn: 'ASS Security Gateway',
    desc: '零信任架构下的统一安全入口，Prompt 注入检测、输入净化、内容分类、签名验签四重防线',
    category: '安全防护',
    rating: 4.9,
    reviews: 2341,
    icon: 'Shield',
    gradient: 'from-teal-500 to-emerald-600',
    tags: ['零信任', '注入检测', '签名验证'],
    isNew: true,
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Digital%20security%20gateway%20with%20glowing%20shield%20icon%2C%20teal%20and%20emerald%20gradient%20background%2C%20cybersecurity%20concept%2C%20modern%20tech%20illustration%2C%20clean%20minimalist%20design&image_size=landscape_16_9',
  },
  {
    id: 'dag-orchestrator',
    name: 'DAG 工作流编排',
    nameEn: 'Workflow Orchestrator',
    desc: '基于 DAG 有向无环图的智能任务编排引擎，支持条件分支、并行执行与容错重试',
    category: '流程编排',
    rating: 4.8,
    reviews: 1876,
    icon: 'GitBranch',
    gradient: 'from-cyan-500 to-blue-600',
    tags: ['DAG', '并行', '容错'],
    isHot: true,
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=DAG%20workflow%20orchestration%20with%20connected%20nodes%20and%20arrows%2C%20cyan%20and%20blue%20gradient%2C%20abstract%20network%20graph%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
  },
  {
    id: 'eihm-router',
    name: 'EIHM 成本路由',
    nameEn: 'EIHM Cost Router',
    desc: '多维度成本估算与最优节点选择，P2P 网络中智能调度至性价比最高的计算资源',
    category: '资源调度',
    rating: 4.7,
    reviews: 1205,
    icon: 'Route',
    gradient: 'from-amber-500 to-orange-600',
    tags: ['成本优化', 'P2P路由', '负载均衡'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Intelligent%20cost%20routing%20with%20multiple%20pathways%2C%20amber%20and%20orange%20gradient%2C%20network%20optimization%20concept%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
  },
  {
    id: 'sandbox-executor',
    name: 'Pyodide 沙箱执行',
    nameEn: 'Sandbox Executor',
    desc: '浏览器端 Python/WASM 沙箱，代码静态分析 + 隔离执行 + 结果收集全链路安全可控',
    category: '代码执行',
    rating: 4.9,
    reviews: 3102,
    icon: 'Terminal',
    gradient: 'from-violet-500 to-purple-600',
    tags: ['WASM沙箱', 'Pyodide', '隔离执行'],
    isNew: true,
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Secure%20sandbox%20code%20execution%20environment%2C%20violet%20and%20purple%20gradient%2C%20terminal%20window%20with%20code%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
  },
  {
    id: 'hashchain-audit',
    name: 'HashChain 审计存证',
    nameEn: 'HashChain Audit Trail',
    desc: '基于哈希链的不可篡改审计日志，每条操作记录链式关联，支持合规报告一键导出',
    category: '合规审计',
    rating: 4.8,
    reviews: 1543,
    icon: 'Link',
    gradient: 'from-emerald-500 to-teal-600',
    tags: ['HashChain', '存证', '合规'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Blockchain%20hash%20chain%20audit%20trail%2C%20emerald%20and%20teal%20gradient%2C%20linked%20blocks%20with%20digital%20signatures%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
  },
  {
    id: 'p2p-scheduler',
    name: 'P2P 任务调度器',
    nameEn: 'P2P Task Scheduler',
    desc: '分布式任务状态机管理，心跳检测 + 节点发现 + 闲时调度三位一体的智能调度系统',
    category: '资源调度',
    rating: 4.6,
    reviews: 987,
    icon: 'Network',
    gradient: 'from-blue-500 to-indigo-600',
    tags: ['状态机', '心跳', '分布式'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Distributed%20P2P%20task%20scheduler%20with%20network%20nodes%2C%20blue%20and%20indigo%20gradient%2C%20connected%20devices%20and%20tasks%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
  },
  {
    id: 'code-detector',
    name: '代码风险检测',
    nameEn: 'Code Risk Detector',
    desc: '多语言代码静态分析，危险函数识别、SQL注入/XSS/命令注入等安全漏洞扫描',
    category: '代码检测',
    rating: 4.9,
    reviews: 2890,
    icon: 'Bug',
    gradient: 'from-red-500 to-rose-600',
    tags: ['静态分析', '漏洞扫描', '多语言'],
    isHot: true,
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Code%20security%20vulnerability%20scanner%2C%20red%20and%20rose%20gradient%2C%20bug%20detection%20with%20magnifying%20glass%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
  },
  {
    id: 'content-moderator',
    name: '内容安全审核',
    nameEn: 'Content Moderator',
    desc: '文本/HTML 内容过滤与净化，XSS 防护、敏感信息脱敏、输出完整性校验一站式处理',
    category: '安全防护',
    rating: 4.7,
    reviews: 1654,
    icon: 'ScanLine',
    gradient: 'from-pink-500 to-rose-600',
    tags: ['内容过滤', 'XSS防护', '脱敏'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Content%20moderation%20and%20filtering%20system%2C%20pink%20and%20rose%20gradient%2C%20shield%20with%20filter%20icons%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
  },
  {
    id: 'data-masker',
    name: '数据脱敏引擎',
    nameEn: 'Data Masking Engine',
    desc: '手机号/身份证/银行卡/IP等敏感数据自动识别与遮蔽，支持自定义正则规则扩展',
    category: '隐私保护',
    rating: 4.8,
    reviews: 1321,
    icon: 'EyeOff',
    gradient: 'from-slate-500 to-gray-600',
    tags: ['脱敏', 'PII保护', '正则'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Data%20masking%20and%20privacy%20protection%20engine%2C%20slate%20and%20gray%20gradient%2C%20blurred%20sensitive%20data%20with%20lock%20icon%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
  },
  {
    id: 'result-aggregator',
    name: '结果聚合分发',
    nameEn: 'Result Aggregator',
    desc: '多节点执行结果的智能聚合，多数投票 + 延迟权重 + 分片排序三策略自适应选优',
    category: '结果处理',
    rating: 4.5,
    reviews: 756,
    icon: 'Layers',
    gradient: 'from-lime-500 to-green-600',
    tags: ['聚合', '多数投票', '去重'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Result%20aggregation%20and%20distribution%20system%2C%20lime%20and%20green%20gradient%2C%20multiple%20data%20streams%20merging%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
  },
  {
    id: 'compliance-reporter',
    name: '合规报告生成',
    nameEn: 'Compliance Reporter',
    desc: '等保/GDPR/个人信息保护法等多法规模板，审计轨迹可视化 + 报告自动生成导出',
    category: '合规审计',
    rating: 4.6,
    reviews: 892,
    icon: 'FileCheck',
    gradient: 'from-teal-600 to-cyan-600',
    tags: ['等保', 'GDPR', '报告'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Compliance%20report%20generation%20with%20documents%2C%20teal%20and%20cyan%20gradient%2C%20checklist%20and%20certificate%20icons%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
  },
  {
    id: 'node-discovery',
    name: '节点发现服务',
    nameEn: 'Node Discovery Service',
    desc: 'P2P 网络中节点的动态注册、健康检查与能力广播，支持节点分组与区域感知',
    category: '网络服务',
    rating: 4.4,
    reviews: 543,
    icon: 'Radar',
    gradient: 'from-indigo-500 to-violet-600',
    tags: ['P2P', '服务发现', '健康检查'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=P2P%20node%20discovery%20service%20with%20radar%20scan%2C%20indigo%20and%20violet%20gradient%2C%20network%20nodes%20being%20detected%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
  },
  {
    id: 'idle-detector',
    name: '闲时检测服务',
    nameEn: 'Idle Detection Service',
    desc: '利用节点空闲算力执行低优先级后台任务，最大化集群资源利用率',
    category: '资源调度',
    rating: 4.3,
    reviews: 421,
    icon: 'Clock',
    gradient: 'from-yellow-500 to-amber-600',
    tags: ['空闲利用', '后台任务', '节能'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Idle%20resource%20detection%20with%20clock%20and%20efficiency%20meter%2C%20yellow%20and%20amber%20gradient%2C%20green%20computing%20concept%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
  },
  {
    id: 'output-verifier',
    name: '输出签名验签',
    nameEn: 'Output Verifier',
    desc: '执行结果 HMAC-SHA256 签名与验签，防篡改 + 完整性校验确保输出可信可追溯',
    category: '安全防护',
    rating: 4.7,
    reviews: 1102,
    icon: 'Fingerprint',
    gradient: 'from-fuchsia-500 to-pink-600',
    tags: ['HMAC', '防篡改', '签名'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Digital%20signature%20verification%20with%20fingerprint%20scan%2C%20fuchsia%20and%20pink%20gradient%2C%20HMAC%20security%20seal%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
  },
];

const categories = [
  { key: 'all', label: '全部', count: 14 },
  { key: '安全防护', label: '安全防护', count: 4 },
  { key: '代码检测', label: '代码检测', count: 1 },
  { key: '合规审计', label: '合规审计', count: 2 },
  { key: '流程编排', label: '流程编排', count: 1 },
  { key: '资源调度', label: '资源调度', count: 3 },
  { key: '代码执行', label: '代码执行', count: 1 },
  { key: '隐私保护', label: '隐私保护', count: 1 },
];

function formatCalls(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  return n.toLocaleString();
}

// CG Animation: useCountUp Hook
function useCountUp(target: number, duration: number = 2, startOnMount: boolean = true) {
  const [count, setCount] = useState(0);
  const mountedRef = useRef(startOnMount);
  useEffect(() => {
    if (!startOnMount) return;
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutExpo
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration, startOnMount]);
  return { count, reset: () => setCount(0) };
}

// ════════════════════════════════════════════════════════
// CG Component: AmbientBackground — 背景装饰层
// ════════════════════════════════════════════════════════
function AmbientBackground() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 0,
    }}>
      {/* 光斑1 — 左上角大光斑 */}
      <motion.div
        animate={{
          x: [-20, 30, -20],
          y: [-10, 20, -10],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          top: '5%',
          left: '0%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(20,184,166,0.07) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      {/* 光斑2 — 右下角中光斑 */}
      <motion.div
        animate={{
          x: [20, -25, 20],
          y: [15, -10, 15],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 4,
        }}
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '0%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />
      {/* 网格背景 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage:
          'linear-gradient(rgba(15,118,110,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(15,118,110,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
    </div>
  );
}

// ════════════════════════════════════════════════════════
// CG Component: CardGlow — 鼠标跟随光晕组件
// ════════════════════════════════════════════════════════
const CardGlow = React.forwardRef<HTMLDivElement, { children: React.ReactNode; glowColor?: string }>(
  ({ children, glowColor = 'rgba(20,184,166,0.12)' }, ref) => {
    const mouseX = useMotionValue(-100);
    const mouseY = useMotionValue(-100);

    return (
      <motion.div
        ref={ref}
        onMouseMove={(e: React.MouseEvent) => {
          const rect = e.currentTarget.getBoundingClientRect();
          mouseX.set(e.clientX - rect.left);
          mouseY.set(e.clientY - rect.top);
        }}
        onMouseLeave={() => { mouseX.set(-100); mouseY.set(-100); }}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        <motion.div
          style={{
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
            pointerEvents: 'none',
            zIndex: 1,
            x: mouseX,
            y: mouseY,
            translateX: '-50%',
            translateY: '-50%',
            filter: 'blur(24px)',
          }}
        />
        <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
      </motion.div>
    );
  }
);

// ════════════════════════════════════════════════════════
// CG Animation Variants — 电影级动画变体定义
// ════════════════════════════════════════════════════════

const cardContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.09,
      delayChildren: 1.4, // 动画时间轴：1.40s 后卡片开始入场
    },
  },
};

const cardItemVariants = {
  hidden: (i: number) => ({
    opacity: 0,
    y: 60,
    rotateX: 8,
    rotateY: i % 2 === 0 ? -8 : 8,
    scale: 0.92,
  }),
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    rotateY: 0,
    scale: 1,
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

// 标题主文字 3D透视入场
const titleMainVariants = {
  hidden: {
    opacity: 0,
    rotateX: 12,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    rotateX: 0,
    scale: 1,
    transition: {
      duration: 1,
      ease: [0.22, 1, 0.36, 1] as const,
      delay: 0.35, // 时间轴：0.35s
    },
  },
};

// 副标题 fadeUp 入场
const subtitleVariants = (delay: number) => ({
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1] as const,
      delay,
    },
  },
});

// SVG虾图标弹性缩放入场
const shrimpIconVariants = {
  hidden: { opacity: 0, scale: 0 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 200,
      damping: 12,
      delay: 0.2, // 时间轴：0.20s
    },
  },
};

// 统计条整体入场
const statsBarVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as const,
      delay: 0.85, // 时间轴：0.85s
    },
  },
};

// 单个统计数字入场
const statItemVariants = (delay: number) => ({
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1] as const,
      delay,
    },
  },
});

// 分类Tab栏入场
const tabBarVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as const,
      delay: 1.2, // 时间轴：1.20s
    },
  },
};

// CTA按钮入场
const ctaVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1] as const,
      delay: 2.2, // 最后出现
    },
  },
};

// 顶部渐变分割线动画
const topLineVariants = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1] as const,
      delay: 0.1, // 时间轴：0.10s
    },
  },
};

// 卡片切换时的过渡效果
const cardTransitionVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.96,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.96,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

export default function XiaLiaSection() {
  const [activeCategory, setActiveCategory] = useState('all');
  const navigate = useNavigate();

  // CG Animation: 数字滚动（合理估算值，页面加载即启动）
  const { count: count1 } = useCountUp(4, 1.5);       // 智能体类型
  const { count: count2 } = useCountUp(18, 2);        // 加入的 Agent
  const { count: count3 } = useCountUp(12, 1.8);      // Skill 可调用
  const { count: count4 } = useCountUp(5200, 2.5);    // 次校验完成

  const filteredAgents =
    activeCategory === 'all'
      ? agents
      : agents.filter((a) => a.category === activeCategory);

  return (
    <section
      id="xialia"
      style={{
        background: '#FAFBFC',
        padding: '96px 0',
        position: 'relative',
        perspective: 1200,
        overflow: 'hidden',
      }}
    >
      {/* ═══ L0: 背景装饰层 ═══ */}
      <AmbientBackground />

      {/* ═══ 顶部渐变分割线（scaleX 0→1 入场） ═══ */}
      <motion.div
        variants={topLineVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: 1,
          background:
            'linear-gradient(90deg, transparent, rgba(15,118,110,0.15), rgba(20,184,166,0.25), rgba(15,118,110,0.15), transparent)',
          transformOrigin: 'center',
        }}
      />

      <div style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '0 24px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* ═══ L1: 电影级标题区 ═══ */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {/* SVG虾图标 — 弹性缩放入场 */}
          <motion.div
            variants={shrimpIconVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            style={{ display: 'inline-block', marginBottom: 12 }}
          >
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="clawGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#EF4444"/>
                  <stop offset="100%" stopColor="#DC2626"/>
                </linearGradient>
              </defs>
              {/* 身体 */}
              <ellipse cx="32" cy="38" rx="14" ry="16" fill="url(#clawGrad)"/>
              {/* 头部 */}
              <circle cx="32" cy="22" r="10" fill="url(#clawGrad)"/>
              {/* 眼睛 */}
              <circle cx="28" cy="20" r="2.5" fill="white"/>
              <circle cx="36" cy="20" r="2.5" fill="white"/>
              <circle cx="28.5" cy="20" r="1.2" fill="#1E293B"/>
              <circle cx="36.5" cy="20" r="1.2" fill="#1E293B"/>
              {/* 触角 */}
              <path d="M27 13 Q24 6 20 8" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <path d="M37 13 Q40 6 44 8" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              {/* 左钳 */}
              <ellipse cx="12" cy="34" rx="7" ry="5" fill="#EF4444" transform="rotate(-15 12 34)"/>
              <path d="M7 31 Q3 28 5 33 Q3 36 8 35" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              {/* 右钳 */}
              <ellipse cx="52" cy="34" rx="7" ry="5" fill="#EF4444" transform="rotate(15 52 34)"/>
              <path d="M57 31 Q61 28 59 33 Q61 36 56 35" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              {/* 尾巴节段 */}
              <rect x="28" y="52" width="8" height="6" rx="3" fill="#EF4444"/>
              <rect x="29" y="57" width="6" height="5" rx="2.5" fill="#DC2626"/>
              {/* 腿 */}
              <path d="M20 42 Q16 50 18 54" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <path d="M24 46 Q22 54 24 58" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <path d="M40 46 Q42 54 40 58" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <path d="M44 42 Q48 50 46 54" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" fill="none"/>
            </svg>
          </motion.div>

          {/* 主标题 "虾聊" — 3D透视入场 */}
          <motion.h2
            variants={titleMainVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            style={{
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #0F172A 0%, #14B8A6 40%, #06B6D4 70%, #0F766E 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: '0 0 8px',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
            }}
          >
            虾聊
          </motion.h2>

          {/* 副标题第一行 — stagger fadeUp */}
          <motion.p
            variants={subtitleVariants(0.55)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            style={{
              color: '#64748B',
              fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
              margin: '0 0 4px',
              fontWeight: 600,
            }}
          >
            好校验，虾说了算
          </motion.p>

          {/* 副标题第二行 — stagger fadeUp */}
          <motion.p
            variants={subtitleVariants(0.7)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            style={{
              color: '#94A3B8',
              fontSize: 'clamp(0.85rem, 1.5vw, 1rem)',
              margin: 0,
            }}
          >
            一鉴到底 Agent Skill 生态 — 多智能体协同校验
          </motion.p>
        </div>

        {/* ═══ L2: 数据统计条（电影级） ═══ */}
        <motion.div
          variants={statsBarVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 32,
            marginBottom: 48,
            flexWrap: 'wrap',
          }}
        >
          {[
            { value: count1.toLocaleString(), label: '智能体类型' },
            { value: count2.toLocaleString(), label: '加入的 Agent' },
            { value: count3.toLocaleString(), label: 'Skill 可调用' },
            { value: count4.toLocaleString(), label: '次校验完成' },
          ].map((stat, i) => (
            <React.Fragment key={stat.label}>
              <motion.div
                variants={statItemVariants(1.0 + i * 0.08)}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}
              >
                <span
                  style={{
                    color: '#14B8A6',
                    fontWeight: 800,
                    fontSize: 'clamp(1.4rem, 2.8vw, 2rem)',
                    letterSpacing: '-0.02em',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {stat.value}
                </span>
                <span
                  style={{
                    color: '#64748B',
                    fontSize: '0.94rem',
                    fontWeight: 500,
                  }}
                >
                  {stat.label}
                </span>
              </motion.div>
              {i < 2 && (
                <motion.span
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.25 + i * 0.08, duration: 0.4 }}
                  animate={{ opacity: [0.3, 0.5, 0.3] }}
                  style={{
                    color: 'rgba(100,116,139,0.35)',
                    fontWeight: 300,
                    fontSize: '1.2rem',
                  }}
                >
                  |
                </motion.span>
              )}
            </React.Fragment>
          ))}
        </motion.div>

        {/* ═══ L3: 分类标签栏 ═══ */}
        <motion.div
          variants={tabBarVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          style={{
            display: 'flex',
            overflowX: 'auto',
            gap: 8,
            marginBottom: 36,
            padding: '4px 0',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          <style>{`.xialia-tabs::-webkit-scrollbar { display: none; }`}</style>
          {categories.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className="xialia-tabs"
                style={{
                  flexShrink: 0,
                  borderRadius: 20,
                  padding: '8px 18px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                  transition: 'all 0.25s ease',
                  background: isActive ? 'rgba(15,118,110,0.08)' : '#F1F5F9',
                  color: isActive ? '#0F766E' : '#64748B',
                  fontWeight: isActive ? 600 : 400,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {cat.label}
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: '0.76rem',
                    opacity: isActive ? 1 : 0.65,
                  }}
                >
                  ({cat.count})
                </span>
                {/* Active tab 底部渐变线条动画 */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: 'linear-gradient(90deg, #14B8A6, #06B6D4, #14B8A6)',
                      borderRadius: '1px',
                    }}
                    transition={{
                      type: 'spring' as const,
                      stiffness: 380,
                      damping: 30,
                    }}
                  />
                )}
              </button>
            );
          })}
        </motion.div>

        {/* ═══ L4: Agent 卡片网格（电影级编排） ═══ */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={cardContainerVariants}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 24,
          }}
          className="xialia-grid"
        >
          <style>{`
            @media (max-width: 1199px) {
              .xialia-grid { grid-template-columns: repeat(3, 1fr); }
            }
            @media (max-width: 767px) {
              .xialia-grid { grid-template-columns: repeat(2, 1fr); }
            }
            @media (max-width: 479px) {
              .xialia-grid { grid-template-columns: 1fr; }
            }
          `}</style>
          <AnimatePresence mode="popLayout">
            {filteredAgents.map((agent, index) => {
              const IconComponent = iconMap[agent.icon];
              return (
                <CardGlow key={agent.id}>
                  <motion.div
                    layout
                    variants={cardItemVariants}
                    custom={index}
                    whileHover={{
                      y: -10,
                      rotateX: -3,
                      rotateY: 3,
                      boxShadow: '0 24px 48px rgba(15,118,110,0.18)',
                      transition: {
                        type: 'spring' as const,
                        stiffness: 260,
                        damping: 18,
                      },
                    }}
                    onClick={() => navigate(`/xialia/${agent.id}`)}
                    style={{
                      background: '#fff',
                      borderRadius: 16,
                      overflow: 'hidden',
                      border: '1px solid rgba(15,118,110,0.06)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      transformStyle: 'preserve-3d',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        'rgba(15,118,110,0.20)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        'rgba(15,118,110,0.06)';
                    }}
                  >
                    {/* Shine overlay - hover 时从左到右扫过一道白色光线 */}
                    <motion.div
                      initial={{ left: '-100%' }}
                      whileHover={{ left: '100%' }}
                      transition={{ duration: 0.6, ease: 'easeInOut' as const }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: '50%',
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
                        pointerEvents: 'none',
                        zIndex: 10,
                        borderRadius: 16,
                      }}
                    />

                    {/* Cover Header — 一鉴到底品牌渐变底纹 */}
                    <div
                      style={{
                        height: 160,
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      className={`bg-gradient-to-br ${agent.gradient}`}
                    >
                      {/* 品牌底纹装饰 */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background:
                            'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.12) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(0,0,0,0.08) 0%, transparent 50%)',
                        }}
                      />

                      {/* 封面区底部微妙渐变遮罩 */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: 40,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.06), transparent)',
                          pointerEvents: 'none',
                          zIndex: 1,
                        }}
                      />

                      {/* 一鉴到底 Logo — hover 时 scale + rotate */}
                      <motion.img
                        src="/logo.png"
                        alt="一鉴到底"
                        whileHover={{
                          scale: 1.08,
                          rotate: 3,
                          transition: { duration: 0.3, ease: 'easeOut' as const },
                        }}
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 14,
                          objectFit: 'cover',
                          border: '2.5px solid rgba(255,255,255,0.85)',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                          position: 'relative',
                          zIndex: 2,
                        }}
                      />

                      {/* Badge — NEW/HOT 保持脉冲动画 */}
                      {agent.isNew && (
                        <motion.span
                          animate={{ scale: [1, 1.06, 1], opacity: [1, 0.85, 1] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            zIndex: 3,
                            background:
                              'linear-gradient(135deg, #14B8A6, #0F766E)',
                            color: '#fff',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            letterSpacing: '0.05em',
                          }}
                        >
                          NEW
                        </motion.span>
                      )}
                      {agent.isHot && (
                        <motion.span
                          animate={{ scale: [1, 1.06, 1], opacity: [1, 0.85, 1] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            zIndex: 3,
                            background:
                              'linear-gradient(135deg, #EF4444, #DC2626)',
                            color: '#fff',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Flame size={11} />
                          HOT
                        </motion.span>
                      )}
                    </div>

                    {/* Card Body */}
                    <div style={{
                      padding: 16,
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      zIndex: 2,
                    }}>
                      <h3
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          color: '#1E293B',
                          margin: '0 0 2px',
                          lineHeight: 1.3,
                        }}
                      >
                        {agent.name}
                      </h3>
                      <p
                        style={{
                          fontSize: '0.78rem',
                          color: '#94A3B8',
                          fontStyle: 'italic',
                          margin: '0 0 8px',
                        }}
                      >
                        {agent.nameEn}
                      </p>
                      <p
                        style={{
                          fontSize: '0.85rem',
                          color: '#64748B',
                          lineHeight: 1.5,
                          margin: '0 0 12px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          flex: 1,
                        }}
                      >
                        {agent.desc}
                      </p>

                      {/* Rating & Calls */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          marginBottom: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Star
                            size={14}
                            fill="#FACC15"
                            stroke="#FACC15"
                          />
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: '#1E293B',
                            }}
                          >
                            {agent.rating}
                          </span>
                          <span
                            style={{
                              fontSize: '0.76rem',
                              color: '#94A3B8',
                            }}
                          >
                            ({agent.reviews.toLocaleString()}条评价)
                          </span>
                        </div>
                      </div>

                      {/* Tags */}
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        {agent.tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              borderRadius: 10,
                              background: '#F1F5F9',
                              color: '#64748B',
                              fontWeight: 500,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </CardGlow>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {/* ═══ L5: 底部 CTA ═══ */}
        <motion.div
          variants={ctaVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          style={{
            textAlign: 'center',
            marginTop: 56,
          }}
        >
          <motion.a
            href="#skills-docs"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: '#0F766E',
              fontSize: '1rem',
              fontWeight: 600,
              textDecoration: 'none',
              padding: '14px 32px',
              borderRadius: 12,
              background: 'rgba(15,118,110,0.06)',
              border: '1px solid rgba(15,118,110,0.12)',
              transition: 'all 0.25s ease',
            }}
            whileHover={{
              scale: 1.05,
              background: 'rgba(15,118,110,0.10)',
              borderColor: 'rgba(15,118,110,0.25)',
              boxShadow: '0 12px 32px rgba(15,118,110,0.18)',
            }}
          >
            查看全部 Skill 文档
            <motion.span
              animate={{ rotate: [0, 12, 0] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ display: 'inline-flex' }}
            >
              <ArrowRight size={17} />
            </motion.span>
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}

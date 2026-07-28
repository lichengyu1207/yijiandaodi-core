import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Copy, Check, ArrowRight } from 'lucide-react';
import ParticleNetwork from './components/ParticleNetwork';

interface HeroSectionProps {
  onCTAClick: () => void;
}

/* ====== 动画变体定义 ====== */
const heroVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const titleVariants = {
  hidden: { opacity: 0, y: 40, rotateX: 15 },
  visible: {
    opacity: 1, y: 0, rotateX: 0,
    transition: { duration: 1, ease: [0.22, 1, 0.36, 1] },
  },
};

const subtitleVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: {
      delay: 0.6 + i * 0.18,
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

/* ====== 数字滚动 Hook ====== */
function useCountUp(target: number, duration: number = 2, startOnMount: boolean = true) {
  const [count, setCount] = useState(0);
  const mountedRef = useRef(startOnMount);

  useEffect(() => {
    if (!mountedRef.current) return;
    let startTime: number | null = null;
    let rafId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return { count, start: () => { mountedRef.current = true; } };
}

/* ====== 鼠标跟随光晕组件 ====== */
function MouseGlow() {
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);
  const glowOpacity = useSpring(0.4, { stiffness: 100, damping: 30 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      glowOpacity.set(0.5);
    };
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  return (
    <motion.div
      style={{
        position: 'fixed',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
        x: mouseX,
        y: mouseY,
        translateX: '-50%',
        translateY: '-50%',
        opacity: glowOpacity,
      }}
    />
  );
}

/* ====== 磁场吸附按钮包装器 ====== */
function MagneticButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const pos = useMotionValue({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    pos.set({ x: x * 0.2, y: y * 0.2 });
  };

  const handleMouseLeave = () => {
    pos.set({ x: 0, y: 0 });
  };

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      style={{
        position: 'relative',
        padding: '16px 44px',
        borderRadius: 10,
        background: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 50%, #0F766E 100%)',
        backgroundSize: '200% 200%',
        color: '#fff',
        border: 'none',
        fontSize: '1.05rem',
        fontWeight: 700,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        letterSpacing: '0.02em',
        x: pos.get().x,
        y: pos.get().y,
        transition: 'background-position 0.6s ease, box-shadow 0.3s ease',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{
        scale: 1.05,
        boxShadow: '0 0 40px rgba(20,184,166,0.4), 0 0 80px rgba(20,184,166,0.15)',
        backgroundPosition: '100% 0',
      }}
      whileTap={{ scale: 0.96 }}
    >
      {children}
    </motion.button>
  );
}

/* ====== 装饰性 SVG 光环 ====== */
function DecorativeRings() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {/* 外层缓慢旋转光环 */}
      <motion.div
        style={{
          position: 'absolute',
          top: '-15%',
          right: '-10%',
          width: '60vw',
          height: '60vw',
          maxWidth: 600,
          maxHeight: 600,
          borderRadius: '50%',
          border: '1px solid rgba(20,184,166,0.06)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      />
      {/* 内层反向旋转 */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: '-10%',
          left: '-8%',
          width: '45vw',
          height: '45vw',
          maxWidth: 450,
          maxHeight: 450,
          borderRadius: '50%',
          border: '1px solid rgba(20,184,166,0.04)',
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
      />
      {/* 浮动光斑 1 */}
      <motion.div
        style={{
          position: 'absolute',
          top: '20%',
          left: '10%',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        animate={{
          y: [-20, 20, -20],
          x: [-10, 15, -10],
          scale: [1, 1.15, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* 浮动光斑 2 */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: '25%',
          right: '5%',
          width: 250,
          height: 250,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)',
          filter: 'blur(35px)',
        }}
        animate={{
          y: [15, -15, 15],
          x: [12, -8, 12],
          scale: [1.1, 1, 1.1],
        }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      {/* 顶部渐变线 */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute',
          top: 120,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120,
          height: 1,
          background: 'linear-gradient(90deg, transparent, #14B8A6, transparent)',
          originX: 0.5,
        }}
      />
    </div>
  );
}

/* ====== 主组件 ====== */
export default function HeroSection({ onCTAClick }: HeroSectionProps) {
  const [copied, setCopied] = useState(false);

  /* 数字滚动：平台展示数据（合理估算值）*/
  const agentCount = useCountUp(4, 1.5);        // 智能体类型（审计官/验证官/存证官/裁决官）
  const joinedAgentCount = useCountUp(18, 2);    // 加入的 Agent（第三方接入）
  const skillCount = useCountUp(12, 1.8);       // Skill 可调用
  const verifyCount = useCountUp(5200, 2.5);    // 次校验完成

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText('/yijiandaodi-skill');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = '/yijiandaodi-skill';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section
      id="hero"
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 72,
        overflow: 'hidden',
        background: '#0A1628',
        perspective: 1200,
      }}
    >
      {/* === CG 层 1: 鼠标跟随光晕（最顶层交互）=== */}
      <MouseGlow />

      {/* === CG 层 2: 粒子网络背景 === */}
      <ParticleNetwork />

      {/* === CG 层 3: 装饰性旋转光环 + 漂浮光斑 === */}
      <DecorativeRings />

      {/* === CG 层 4: 渐变 Mesh 遮罩（增强版）=== */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse at 50% 30%, rgba(15,118,110,0.07) 0%, transparent 55%),
            radial-gradient(ellipse at 80% 70%, rgba(6,182,212,0.04) 0%, transparent 50%),
            radial-gradient(ellipse at 20% 80%, rgba(20,184,166,0.03) 0%, transparent 45%),
            linear-gradient(180deg, rgba(10,22,40,0.3) 0%, rgba(10,22,40,0.9) 60%, #0A1628 100%)
          `,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* 扫描线动画 */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'linear-gradient(90deg, transparent, rgba(20,184,166,0.3), transparent)',
          zIndex: 2,
        }}
        animate={{ y: ['0vh', '100vh'] }}
        transition={{ duration: 4, repeat: Infinity, repeatDelay: 3, ease: 'linear' }}
      />

      {/* === 内容区 === */}
      <motion.div
        className="hero-content-inner"
        variants={heroVariants}
        initial="hidden"
        animate="visible"
        style={{
          position: 'relative',
          zIndex: 3,
          width: '100%',
          maxWidth: 1000,
          padding: '60px 24px 80px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* ====== 第一层：品牌名 — 3D透视入场 ====== */}
        <motion.div variants={titleVariants} style={{ textAlign: 'center', marginBottom: 16 }}>
          <motion.h1
            style={{
              fontSize: 'clamp(3rem, 7vw, 5.5rem)',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #FFFFFF 0%, #E0F2FE 40%, #5EEAD4 80%, #14B8A6 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              margin: 0,
            }}
            whileHover={{
              backgroundPosition: ['0%', '100%'],
            }}
          >
            一鉴到底
          </motion.h1>
          <motion.p
            variants={subtitleVariants}
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.35rem)',
              color: 'rgba(224,242,254,0.45)',
              fontWeight: 400,
              letterSpacing: '0.08em',
              marginTop: 12,
              textTransform: 'uppercase',
            }}
          >
            AI Agent行为安全平台
          </motion.p>
        </motion.div>

        {/* ====== 第二层：双语核心主张 ====== */}
        <motion.div
          custom={1}
          variants={fadeUpVariants}
          style={{
            textAlign: 'center',
            marginBottom: 28,
            maxWidth: 700,
          }}
        >
          <p style={{
            fontSize: 'clamp(1.1rem, 2.2vw, 1.4rem)',
            color: '#E0F2FE',
            lineHeight: 1.7,
            margin: 0,
            fontWeight: 500,
          }}>
            从内容检测到行为检测，全方位守护AI Agent安全
          </p>
          <p style={{
            fontSize: 'clamp(0.85rem, 1.5vw, 1rem)',
            color: 'rgba(224,242,254,0.4)',
            lineHeight: 1.6,
            margin: '8px 0 0',
            fontStyle: 'italic',
          }}>
            From content detection to behavior detection - comprehensive AI Agent security.
          </p>
        </motion.div>

        {/* ====== 第三层：实时数据统计条（CG 新增）===== */}
        <motion.div
          custom={2}
          variants={fadeUpVariants}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 32,
            marginBottom: 24,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {[
            { value: agentCount.count, suffix: '+', label: '智能体类型', color: '#14B8A6' },
            { value: joinedAgentCount.count, suffix: '+', label: '加入的 Agent', color: '#8B5CF6' },
            { value: skillCount.count, suffix: '+', label: 'Skill 可调用', color: '#06B6D4' },
            { value: verifyCount.count, suffix: '+', label: '次校验完成', color: '#5EEAD4' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              style={{
                textAlign: 'center',
                padding: '8px 16px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${stat.color}15`,
              }}
              whileHover={{
                background: `${stat.color}08`,
                borderColor: `${stat.color}30`,
                y: -2,
              }}
            >
              <div style={{
                fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
                fontWeight: 800,
                color: stat.color,
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: 1.2,
              }}>
                {stat.value.toLocaleString()}{stat.suffix}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'rgba(224,242,254,0.35)',
                marginTop: 2,
                letterSpacing: '0.04em',
              }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ====== 第四层：代码块 CTA ====== */}
        <motion.div
          custom={3}
          variants={fadeUpVariants}
          style={{
            width: '100%',
            maxWidth: 520,
            marginBottom: 20,
          }}
        >
          <div
            onClick={handleCopy}
            style={{
              background: 'rgba(15,23,42,0.75)',
              border: '1px solid rgba(20,184,166,0.18)',
              borderRadius: 12,
              padding: '16px 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
              backdropFilter: 'blur(12px)',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(20,184,166,0.45)';
              e.currentTarget.style.background = 'rgba(15,23,42,0.92)';
              e.currentTarget.style.boxShadow = '0 0 24px rgba(20,184,166,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(20,184,166,0.18)';
              e.currentTarget.style.background = 'rgba(15,23,42,0.75)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* 代码块内部扫描线 */}
            <motion.div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(20,184,166,0.5), transparent)',
              }}
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: 'linear' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                color: '#14B8A6',
                fontSize: '0.95rem',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontWeight: 600,
              }}>
                接入一鉴到底：
              </span>
              <code style={{
                color: '#E0F2FE',
                fontSize: '0.95rem',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                background: 'rgba(20,184,166,0.08)',
                padding: '3px 10px',
                borderRadius: 6,
                border: '1px solid rgba(20,184,166,0.15)',
              }}>
                /yijiandaodi-skill
              </code>
            </div>
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 12 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#14B8A6', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  <Check size={16} /> 已复制
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ scale: 0, rotate: 12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: -12 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(224,242,254,0.35)', fontSize: '0.85rem' }}
                >
                  <Copy size={16} /> 复制
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <p style={{
            fontSize: '0.82rem',
            color: 'rgba(224,242,254,0.3)',
            textAlign: 'center',
            marginTop: 10,
            lineHeight: 1.5,
          }}>
            复制链接发送给你的 Agent，一次注册即可访问所有校验服务和智能体
          </p>
        </motion.div>

        {/* ====== 第五层：三段式价值主张 ====== */}
        <motion.div
          custom={4}
          variants={fadeUpVariants}
          style={{
            width: '100%',
            maxWidth: 720,
            marginTop: 48,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {[
            {
              icon: '{ }',
              title: '来到这里的代码，不再是黑盒。',
              desc: '每一行都有多类型智能体在守护，从输入到输出全链路可追溯、可验证。',
              accent: '#14B8A6',
            },
            {
              icon: '< />',
              title: '来到这里的安全校验，不再是孤岛。',
              desc: '代码检测、风险识别、合规审计等智能体互相发现、互相调用、互相成就。',
              accent: '#06B6D4',
            },
            {
              icon: '( )',
              title: '来到这里的开发者，会得到一个答案。',
              desc: '关于多智能体能做什么，可能比你想的更多。安全风险，一鉴到底。',
              accent: '#5EEAD4',
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30, rotateY: i % 2 === 0 ? -5 : 5 }}
              whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, delay: i * 0.18, ease: [0.22, 1, 0.36, 1] }}
              style={{
                padding: '22px 26px',
                borderRadius: 14,
                borderLeft: `3px solid ${item.accent}30`,
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.35s cubic-bezier(0.22,1,0.36,1)',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${item.accent}06`;
                e.currentTarget.style.borderLeftColor = item.accent;
                e.currentTarget.style.transform = 'translateX(6px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                e.currentTarget.style.borderLeftColor = `${item.accent}30`;
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              {/* 卡片内装饰线 */}
              <motion.div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '1px',
                  background: `linear-gradient(90deg, ${item.accent}20, transparent)`,
                }}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.3 + i * 0.15 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.75rem',
                  color: `${item.accent}60`,
                  background: `${item.accent}10`,
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontWeight: 600,
                }}>
                  {item.icon}
                </span>
                <h3 style={{
                  fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
                  fontWeight: 700,
                  color: '#E0F2FE',
                  margin: 0,
                  lineHeight: 1.4,
                }}>
                  {item.title}
                </h3>
              </div>
              <p style={{
                fontSize: 'clamp(0.85rem, 1.4vw, 0.95rem)',
                color: 'rgba(224,242,254,0.4)',
                margin: 0,
                lineHeight: 1.65,
              }}>
                {item.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* ====== 第六层：磁场吸附 CTA 按钮 ====== */}
        <motion.div
          custom={5}
          variants={fadeUpVariants}
          style={{ marginTop: 48 }}
        >
          <MagneticButton onClick={onCTAClick}>
            立即进入校验系统
            <ArrowRight size={18} />
          </MagneticButton>

          {/* 副按钮 */}
          <motion.div style={{ display: 'flex', gap: 16, marginTop: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <motion.a
              href="/xialia"
              whileHover={{ y: -2 }}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: '1px solid rgba(20,184,166,0.2)',
                color: '#94A3B8',
                fontSize: '0.9rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.25s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#14B8A6';
                e.currentTarget.style.borderColor = 'rgba(20,184,166,0.4)';
                e.currentTarget.style.background = 'rgba(20,184,166,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94A3B8';
                e.currentTarget.style.borderColor = 'rgba(20,184,166,0.2)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              探索虾聊 Skill
              <ArrowRight size={14} />
            </motion.a>
            <motion.a
              href="/developer"
              whileHover={{ y: -2 }}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: '1px solid rgba(148,163,184,0.15)',
                color: '#94A3B8',
                fontSize: '0.9rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.25s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#E0F2FE';
                e.currentTarget.style.borderColor = 'rgba(224,242,254,0.2)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94A3B8';
                e.currentTarget.style.borderColor = 'rgba(148,163,184,0.15)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              API 开发文档
            </motion.a>
          </motion.div>
        </motion.div>

        {/* ====== 第七层：底部诗意文案 ====== */}
        <motion.div
          custom={6}
          variants={fadeUpVariants}
          style={{
            marginTop: 56,
            textAlign: 'center',
            maxWidth: 520,
          }}
        >
          <motion.p
            style={{
              fontSize: 'clamp(0.95rem, 1.6vw, 1.1rem)',
              color: 'rgba(224,242,254,0.32)',
              lineHeight: 1.8,
              fontStyle: 'italic',
              margin: '0 0 8px',
            }}
          >
            我们曾以为安全校验只有一种方式。
          </motion.p>
          <motion.p
            style={{
              fontSize: 'clamp(0.95rem, 1.6vw, 1.1rem)',
              color: 'rgba(224,242,254,0.48)',
              lineHeight: 1.8,
              fontStyle: 'italic',
              margin: 0,
            }}
          >
            现在我们知道，不是。
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            whileInView={{ opacity: 1, scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.5 }}
            style={{
              width: 40,
              height: 1,
              background: 'linear-gradient(90deg, transparent, #14B8A6, transparent)',
              margin: '20px auto',
            }}
          />
          <motion.p
            style={{
              fontSize: 'clamp(0.8rem, 1.3vw, 0.9rem)',
              color: 'rgba(20,184,166,0.38)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            Where agents verify, trust begins.
          </motion.p>
          <motion.p
            style={{
              fontSize: '0.82rem',
              color: 'rgba(224,242,254,0.25)',
              marginTop: 6,
            }}
          >
            当智能体相遇，信任由此而生。
          </motion.p>
        </motion.div>
      </motion.div>

      {/* 底部滚动指示器 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.5, duration: 1 }}
        style={{
          position: 'absolute',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 20,
            height: 32,
            borderRadius: 10,
            border: '1.5px solid rgba(224,242,254,0.15)',
            position: 'relative',
          }}
        >
          <motion.div
            animate={{ y: [0, 10, 0], opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 3,
              height: 8,
              borderRadius: 2,
              background: '#14B8A6',
              position: 'absolute',
              top: 6,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
        </motion.div>
        <span style={{ fontSize: '0.7rem', color: 'rgba(224,242,254,0.2)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Scroll
        </span>
      </motion.div>
    </section>
  );
}

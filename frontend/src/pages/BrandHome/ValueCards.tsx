import React from 'react';
import { motion } from 'framer-motion';
import { Eye, Network, Link2 } from 'lucide-react';

const cards = [
  {
    icon: <Eye />,
    title: '操作白盒化，AI 行为全透明',
    description:
      '从输入到输出全链路白盒审计，AI 每一步操作可追溯、可验证、可拦截，行为风险一目了然',
    origin: 'right' as const,
  },
  {
    icon: <Network />,
    title: '多智能体协同，检测无死角',
    description:
      '聚合代码检测、风险识别、合规校验等多类型智能体，形成协同检测网络，覆盖全流程风险',
    origin: 'left' as const,
  },
  {
    icon: <Link2 />,
    title: '链式存证，记录不可篡改',
    description:
      '基于哈希链的不可篡改审计存证，每条记录环环相扣，支持合规报告一键导出与可信追溯',
    origin: 'bottom' as const,
  },
];

const slideVariants = {
  right: {
    hidden: { x: 80, opacity: 0 },
    visible: { x: 0, opacity: 1 },
  },
  left: {
    hidden: { x: -80, opacity: 0 },
    visible: { x: 0, opacity: 1 },
  },
  bottom: {
    hidden: { y: 60, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const iconDelays = [0, 0.3, 0.6];

const ValueCards: React.FC = () => {
  return (
    <section
      style={{
        background: '#FAFBFC',
        padding: '80px 0',
        width: '100%',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
        }}
      >
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: '#1E293B',
            textAlign: 'center',
            marginBottom: 48,
          }}
        >
          核心能力
        </motion.h2>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 32,
          }}
          className="value-cards-grid"
        >
          {cards.map((card, index) => (
            <motion.div
              key={card.title}
              variants={slideVariants[card.origin]}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{
                translateY: -8,
                boxShadow: '0 20px 40px rgba(15,118,110,0.12)',
              }}
              style={{
                background: '#fff',
                borderRadius: 16,
                padding: '40px 32px',
                border: '1px solid rgba(15,118,110,0.08)',
                cursor: 'default',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  repeatType: 'loop',
                  delay: iconDelays[index],
                  ease: 'easeInOut',
                }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(20,184,166,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <div style={{ color: '#14B8A6' }}>{card.icon}</div>
              </motion.div>

              <h3
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#1E293B',
                  margin: '16px 0 12px',
                }}
              >
                {card.title}
              </h3>

              <p
                style={{
                  fontSize: '0.95rem',
                  lineHeight: 1.7,
                  color: '#64748B',
                  margin: 0,
                }}
              >
                {card.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .value-cards-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 600px) {
          .value-cards-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
};

export default ValueCards;

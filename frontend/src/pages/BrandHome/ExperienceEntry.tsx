import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface ExperienceEntryProps {
  onEnter: () => void;
}

const ExperienceEntry: React.FC<ExperienceEntryProps> = ({ onEnter }) => {
  const navigate = useNavigate();

  return (
    <section
      className="brand-experience-entry"
      style={{
        background: 'linear-gradient(180deg, #FAFBFC 0%, rgba(15,118,110,0.04) 100%)',
        padding: '96px 0',
        width: '100%',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 背景放射状光晕装饰 */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: '#1E293B',
            marginBottom: 16,
          }}
        >
          准备好开始了吗？
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontSize: '1.05rem',
            color: '#64748B',
            marginBottom: 32,
          }}
        >
          无需注册，即可体验多智能体协同校验 Demo
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <motion.button
            onClick={onEnter}
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(20,184,166,0.4)',
                '0 0 0 12px rgba(20,184,166,0)',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            whileHover={{
              scale: 1.05,
              boxShadow: '0 8px 30px rgba(15,118,110,0.35)',
            }}
            whileTap={{ scale: 0.97 }}
            style={{
              background: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '16px 48px',
              fontSize: '1.1rem',
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.5px',
              fontFamily: 'inherit',
            }}
          >
            立即进入校验系统
          </motion.button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          style={{
            marginTop: 20,
            fontSize: '0.9rem',
            color: '#94A3B8',
          }}
        >
          已有账号？{' '}
          <span
            onClick={() => navigate('/login')}
            style={{
              color: '#0F766E',
              cursor: 'pointer',
              fontWeight: 500,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            立即登录 →
          </span>
        </motion.p>

      </div>
    </section>
  );
};

export default ExperienceEntry;

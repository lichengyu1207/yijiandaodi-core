import { motion } from 'framer-motion';
import type { ReactNode, MouseEventHandler } from 'react';

interface GlowButtonProps {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'lg';
  pulse?: boolean;
}

const sizeStyles = {
  md: { padding: '12px 32px', fontSize: '1rem' },
  lg: { padding: '16px 48px', fontSize: '1.25rem' },
};

const variantStyles = {
  primary: {
    background: 'linear-gradient(135deg, #0F766E, #14B8A6)',
    color: '#fff',
    border: 'none',
  },
  secondary: {
    background: 'transparent',
    color: '#14B8A6',
    border: '2px solid #14B8A6',
  },
};

export default function GlowButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  pulse = false,
}: GlowButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      style={{
        ...sizeStyles[size],
        ...variantStyles[variant],
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 600,
        letterSpacing: '0.02em',
        outline: 'none',
        fontFamily: 'inherit',
      }}
      whileHover={{
        scale: 1.05,
        boxShadow: '0 0 24px rgba(20,184,166,0.4)',
      }}
      whileTap={{ scale: 0.97 }}
      animate={
        pulse
          ? {
              scale: [1, 1.03, 1],
            }
          : undefined
      }
      transition={
        pulse
          ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
          : undefined
      }
    >
      {children}
    </motion.button>
  );
}

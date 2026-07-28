import React, { useState, useEffect } from 'react';
import { Coffee } from 'lucide-react';
import TipModal from '../TipModal';

interface CoffeeButtonProps {
  receiverId: number;
  receiverName?: string;
  receiverAvatar?: string;
  contentType?: 'article' | 'user' | 'page';
  contentId?: number;
  size?: 'default' | 'small' | 'mini' | 'medium' | 'large';
  variant?: 'primary' | 'outline' | 'text';
  theme?: 'auto' | 'light' | 'dark';
  onSuccess?: (tipId: number) => void;
  onError?: (error: string) => void;
}

const isLightColor = (color: string): boolean => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
};

const THEME_CONFIG: Record<string, any> = {
  light: {
    bgColor: '#ffffff',
    textColor: '#1f1f1f',
    borderColor: '#d9d9d9',
    hoverBgColor: '#f5f5f5',
    shadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  dark: {
    bgColor: '#1f1f1f',
    textColor: '#ffffff',
    borderColor: '#434343',
    hoverBgColor: '#2a2a2a',
    shadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
};

const CoffeeButton: React.FC<CoffeeButtonProps> = ({
  receiverId,
  receiverName = '创作者',
  receiverAvatar,
  contentType,
  contentId,
  size = 'medium',
  variant = 'primary',
  theme = 'auto',
  onSuccess,
  onError,
}) => {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [parentBgColor, setParentBgColor] = useState('#ffffff');

  useEffect(() => {
    if (theme !== 'auto') return;

    const detectParentBg = () => {
      try {
        const parent = document.querySelector('[class*="dark"], [class*="light"]');
        if (parent?.classList.contains('dark')) {
          setParentBgColor('#1f1f1f');
        } else if (parent?.classList.contains('light')) {
          setParentBgColor('#ffffff');
        } else {
          setParentBgColor('#ffffff');
        }
      } catch (e) {
        setParentBgColor('#ffffff');
      }
    };

    detectParentBg();
  }, [theme]);

  const currentTheme = theme === 'auto'
    ? (isLightColor(parentBgColor) ? 'light' : 'dark')
    : theme;

  const config = THEME_CONFIG[currentTheme];

  const SIZE_STYLES: Record<string, any> = {
    mini: { padding: '2px 8px', fontSize: 11, iconSize: 14 as const, borderRadius: 12 },
    small: { padding: '6px 14px', fontSize: 12, iconSize: 14 as const, borderRadius: 16, gap: 5 },
    default: { padding: '8px 16px', fontSize: 14, iconSize: 18 as const, borderRadius: 8, gap: 6 },
    medium: { padding: '8px 20px', fontSize: 14, iconSize: 16 as const, borderRadius: 24, gap: 6 },
    large: { padding: '12px 28px', fontSize: 16, iconSize: 20 as const, borderRadius: 24, gap: 8 },
  };

  const VARIANT_STYLES: Record<string, any> = {
    primary: {
      background: theme === 'dark' ? config.bgColor : 'linear-gradient(135deg, #FFB800 0%, #FF8C00 100%)',
      color: theme === 'dark' ? config.textColor : '#FFFFFF',
      border: 'none',
      boxShadow: theme === 'dark' ? config.shadow : '0 2px 12px rgba(255, 140, 0, 0.35)',
      hoverBackground: theme === 'dark' ? config.hoverBgColor : 'linear-gradient(135deg, #FFC533 0%, #FFA033 100%)',
      hoverBoxShadow: theme === 'dark' ? '0 4px 12px rgba(0,0,0,0.4)' : '0 6px 20px rgba(255, 140, 0, 0.45)',
    },
    outline: {
      background: 'transparent',
      color: '#FF8C00',
      border: `2px solid ${currentTheme === 'dark' ? '#434343' : '#FF8C00'}`,
      boxShadow: 'none',
      hoverBackground: currentTheme === 'dark' ? '#2a2a2a' : '#FFF8F0',
      hoverBoxShadow: '0 2px 12px rgba(255, 140, 0, 0.2)',
    },
    text: {
      background: 'transparent',
      color: currentTheme === 'dark' ? '#ffffff' : '#FF8C00',
      border: 'none',
      boxShadow: 'none',
      hoverBackground: currentTheme === 'dark' ? '#2a2a2a' : 'rgba(255, 140, 0, 0.08)',
      hoverBoxShadow: 'none',
    },
  };

  const sizeStyle = SIZE_STYLES[size];
  const variantStyle = VARIANT_STYLES[variant];

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: sizeStyle.gap || 6,
          padding: sizeStyle.padding,
          background: variantStyle.background,
          color: variantStyle.color,
          border: variantStyle.border,
          borderRadius: sizeStyle.borderRadius,
          cursor: 'pointer',
          fontSize: sizeStyle.fontSize,
          fontWeight: 600,
          boxShadow: variantStyle.boxShadow,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          letterSpacing: '0.3px',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = variantStyle.hoverBackground;
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = variantStyle.hoverBoxShadow;

          const icon = e.currentTarget.querySelector('svg');
          if (icon) {
            icon.style.transform = 'rotate(15deg)';
            icon.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = variantStyle.background;
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = variantStyle.boxShadow;

          const icon = e.currentTarget.querySelector('svg');
          if (icon) {
            icon.style.transform = 'rotate(0deg)';
          }
        }}
      >
        <Coffee size={sizeStyle.iconSize} style={{ transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        {(size !== 'mini' && size !== 'small') && (
          <span>
            {variant === 'primary'
              ? '请我喝杯咖啡'
              : '赞赏作者'}
          </span>
        )}
      </button>

      <TipModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        receiverId={receiverId}
        receiverName={receiverName}
        receiverAvatar={receiverAvatar}
        contentType={contentType}
        contentId={contentId}
        onSuccess={(tipId) => {
          setModalOpen(false);
          onSuccess?.(tipId);
        }}
        onError={onError}
      />
    </>
  );
};

export default CoffeeButton;

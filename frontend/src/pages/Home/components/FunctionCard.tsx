import React from 'react';

interface FunctionCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  buttonText?: string;
  onAction?: () => void;
  tag?: string;
  tagColor?: string;
  isFeatured?: boolean;
}

const FunctionCard: React.FC<FunctionCardProps> = ({
  icon,
  iconBg,
  iconColor,
  title,
  description,
  buttonText = title.includes('Agent') ? '立即校验' : '立即使用',
  onAction,
  tag,
  tagColor,
  isFeatured = false,
}) => {
  const cardHeight = isFeatured ? 156 : 140;

  const cardBaseStyle: React.CSSProperties = {
    width: '100%',
    height: cardHeight,
    backgroundColor: isFeatured && tagColor
      ? `rgba(${parseInt(tagColor.slice(1, 3), 16)},${parseInt(tagColor.slice(3, 5), 16)},${parseInt(tagColor.slice(5, 7), 16)},0.03)`
      : '#FFFFFF',
    border: `1px solid ${isFeatured && tagColor ? `${tagColor}20` : '#E5E6EB'}`,
    borderRadius: 16,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
  };

  return (
    <div
      style={cardBaseStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = isFeatured ? 'translateY(-3px)' : 'translateY(-2px)';
        e.currentTarget.style.boxShadow = isFeatured
          ? '0 8px 24px rgba(0,0,0,0.1)'
          : '0 4px 12px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)';
      }}
    >
      {isFeatured && tagColor && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: `linear-gradient(to bottom, ${tagColor}, transparent)`,
          }}
        />
      )}

      {tag && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            backgroundColor: tagColor || '#165DFF',
            color: '#FFF',
            fontSize: isFeatured ? 11 : 10,
            fontWeight: 500,
            padding: isFeatured ? '3px 10px' : '2px 8px',
            borderRadius: 8,
            lineHeight: 1.4,
            userSelect: 'none',
          }}
        >
          {isFeatured ? '\u2728 ' + tag : tag}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ color: iconColor }}>{icon}</div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#1D2129',
              marginBottom: 4,
              lineHeight: '24px',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 14,
              color: '#86909C',
              lineHeight: '22px',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: isFeatured ? 2 : 1,
              WebkitBoxOrient: 'vertical' as const,
            }}
          >
            {description}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: 'auto',
          paddingTop: 6,
        }}
      >
        <div
          onClick={onAction}
          style={{
            backgroundColor: iconColor || '#165DFF',
            color: '#FFF',
            borderRadius: 12,
            padding: '8px 24px',
            fontSize: 14,
            fontWeight: 500,
            cursor: onAction ? 'pointer' : 'default',
            transition: 'background-color 0.2s ease',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => {
            if (onAction) {
              e.currentTarget.style.opacity = '0.85';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          {buttonText}
        </div>
      </div>
    </div>
  );
};

export default FunctionCard;

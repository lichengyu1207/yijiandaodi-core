import React, { useState } from 'react';
import ArticleCover from '@/components/ArticleCover';
import { FileText, Wrench, GraduationCap, Package } from 'lucide-react';

interface DigitalProductCardProps {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  originalPrice?: number;
  coverImage?: string;
  tags: string[];
  isHot?: boolean;
  isRecommend?: boolean;
  salesCount?: number;
  onClick?: () => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  template: <FileText size={16} />,
  tool: <Wrench size={16} />,
  course: <GraduationCap size={16} />,
  material: <Package size={16} />,
};

const CATEGORY_LABELS: Record<string, string> = {
  template: '模板',
  tool: '工具',
  course: '课程',
  material: '素材',
};

const STYLES = {
  card: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  badge: {
    position: 'absolute' as const,
    top: 10,
    left: 10,
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    color: '#FFFFFF',
    zIndex: 2,
  },
  content: {
    padding: '14px 16px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  categoryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#86909C',
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1D2129',
    lineHeight: 1.4,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
  },
  description: {
    fontSize: 13,
    color: '#4E5969',
    lineHeight: 1.5,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    flex: 1,
  },
  tagsContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  tag: {
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 11,
    backgroundColor: '#F2F3F5',
    color: '#4E5969',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    paddingTop: 4,
  },
  currentPrice: {
    fontSize: 22,
    fontWeight: 700,
    color: '#FF7D00',
  },
  originalPrice: {
    fontSize: 13,
    color: '#C9CDD4',
    textDecoration: 'line-through',
  },
  salesInfo: {
    fontSize: 12,
    color: '#86909C',
    marginLeft: 'auto',
  },
};

const DigitalProductCard: React.FC<DigitalProductCardProps> = ({
  id,
  title,
  description,
  category,
  price,
  originalPrice,
  tags,
  isHot,
  isRecommend,
  salesCount,
  onClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getBadge = () => {
    if (isHot) {
      return { text: '热门', bg: '#F53F3F' };
    }
    if (isRecommend) {
      return { text: '推荐', bg: '#7C3AED' };
    }
    return { text: '新品', bg: '#00B42A' };
  };

  const badge = getBadge();

  return (
    <div
      style={{
        ...STYLES.card,
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.12)' : '0 2px 12px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div style={{ position: 'relative', height: 160 }}>
        <ArticleCover
          title={title}
          width="100%"
          height="100%"
        />
        <div style={{
          ...STYLES.badge,
          backgroundColor: badge.bg,
        }}>
          {badge.text}
        </div>
      </div>

      <div style={STYLES.content}>
        <div style={STYLES.categoryRow}>
          {CATEGORY_ICONS[category] || <FileText size={16} />}
          <span>{CATEGORY_LABELS[category] || category}</span>
        </div>

        <div style={STYLES.title}>{title}</div>

        <div style={STYLES.description}>{description}</div>

        <div style={STYLES.tagsContainer}>
          {(tags || []).slice(0, 3).map((tag) => (
            <span key={tag} style={STYLES.tag}>{tag}</span>
          ))}
        </div>

        <div style={STYLES.priceRow}>
          <span style={STYLES.currentPrice}>¥{price}</span>
          {originalPrice && originalPrice > price && (
            <span style={STYLES.originalPrice}>¥{originalPrice}</span>
          )}
          {salesCount !== undefined && (
            <span style={STYLES.salesInfo}>已售 {salesCount}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DigitalProductCard;

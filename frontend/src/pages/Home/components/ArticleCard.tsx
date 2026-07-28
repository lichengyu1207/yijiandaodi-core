import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Eye,
} from 'lucide-react';
import ArticleCover from '@/components/ArticleCover';

interface ArticleCardProps {
  article: {
    id: number | string;
    title: string;
    summary: string;
    /** 封面图 URL（后台上传） */
    coverImage?: string;
    /** 多图 URL 列表（最多3张，用于三图模式） */
    galleryImages?: string[];
    categoryName: string;
    authorName?: string;
    readCount?: number;
    likeCount?: number;
    publishTime?: string;
    xinfaTag?: string;
    isPinned?: boolean;
    isHot?: boolean;
    pitfallCount?: number;
    learnedCount?: number;
    userHasPitfalled?: boolean;
    userHasLearned?: boolean;
    ctaText?: string;
    ctaLink?: string;
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  '安全审计': '#3B82F6',
  '合规检测': '#8B5CF6',
  '身份验证': '#10B981',
  '数据存证': '#F59E0B',
  '漏洞扫描': '#EF4444',
  '风险评估': '#F97316',
  '应急响应': '#EC4899',
  '行业动态': '#06B6D4',
};

const XINFA_TAG_STYLES: Record<string, { background: string }> = {
  'Agent避坑': { background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' },
  '开发保命': { background: 'linear-gradient(135deg, #EC4899, #F9A8D4)' },
  '企业合规': { background: 'linear-gradient(135deg, #059669, #6EE7B7)' },
  '踩坑实录': { background: 'linear-gradient(135deg, #F59E0B, #FCD34D)' },
};

function formatTime(timeStr: string): string {
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return days + '天前';
    if (days < 30) return Math.floor(days / 7) + '周前';
    if (days < 365) return Math.floor(days / 30) + '个月前';
    return Math.floor(days / 365) + '年前';
  } catch {
    return '';
  }
}

function formatReadCount(count: number): string {
  if (!count) return '0';
  if (count >= 10000) return (count / 10000).toFixed(1) + '万';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
  return String(count);
}

/**
 * 判断信息流卡片布局模式
 * - 有封面图 → 'single' 单图模式（左文右图）
 * - 无封面但有多图 → 'triple' 三图模式
 * - 都没有 → 'text-only' 纯文字模式（仿知乎无图帖子）
 */
function detectLayoutMode(article: ArticleCardProps['article']): 'single' | 'triple' | 'text-only' {
  const hasCover = !!article.coverImage;
  const hasGallery = Array.isArray(article.galleryImages) && article.galleryImages.length > 0;

  if (hasCover) return 'single';
  if (hasGallery) return 'triple';
  return 'text-only';
}

/* 响应式断点工具函数：判断是否为移动端 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article }) => {
  const navigate = useNavigate();
  const catColor = CATEGORY_COLORS[article.categoryName] || '#64748B';
  const isMobile = useIsMobile();

  const [userHasPitfalled, setUserHasPitfalled] = useState(article.userHasPitfalled || false);
  const [userHasLearned, setUserHasLearned] = useState(article.userHasLearned || false);
  const [pitfallCount, setPitfallCount] = useState(article.pitfallCount || 0);
  const [learnedCount, setLearnedCount] = useState(article.learnedCount || 0);

  const handlePitfallToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setUserHasPitfalled(prev => {
      setPitfallCount(c => prev ? c - 1 : c + 1);
      return !prev;
    });
  }, []);

  const handleLearnedToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setUserHasLearned(prev => {
      setLearnedCount(c => prev ? c - 1 : c + 1);
      return !prev;
    });
  }, []);

  const hasXinfaTag = !!article.xinfaTag && !!XINFA_TAG_STYLES[article.xinfaTag];
  const xinfaStyle = hasXinfaTag ? XINFA_TAG_STYLES[article.xinfaTag!] : null;

  const layoutMode = detectLayoutMode(article);

  // ========== 纯文字模式（无图）— 类似知乎文字帖 ==========
  if (layoutMode === 'text-only') {
    return (
      <div
        className={isMobile ? 'app-card' : ''}
        style={{
          backgroundColor: '#FFFFFF',
          border: article.isPinned ? '1.5px solid #165DFF' : '1px solid #E2E8F0',
          borderRadius: isMobile ? 12 : 16,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          padding: isMobile ? '14px 16px' : '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 8 : 10,
          position: 'relative',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}
        onClick={() => navigate('/cases/' + article.id)}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = 'translateY(-2px)';
          el.style.boxShadow = article.isPinned
            ? '0 12px 32px rgba(22,93,255,0.18)'
            : '0 8px 24px rgba(0,0,0,0.08)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)';
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate('/cases/' + article.id);
          }
        }}
      >
        {/* 置顶标签 */}
        {article.isPinned && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 700, color: '#fff',
            backgroundColor: 'rgba(220,38,38,0.9)',
            padding: '3px 8px', borderRadius: 8, alignSelf: 'flex-start',
          }}>
            精选
          </span>
        )}

        {/* 标题 — 纯文字模式下标题更大更醒目 */}
        <h3 style={{
          fontSize: 17, fontWeight: 600, color: '#0F172A',
          margin: 0, lineHeight: '26px',
          display: '-webkit-box' as const,
          WebkitLineClamp: 2 as number,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {article.title}
        </h3>

        {/* 摘要 */}
        {article.summary && (
          <p style={{
            fontSize: 14, color: '#64748B', margin: 0,
            lineHeight: '22px',
            display: '-webkit-box' as const,
            WebkitLineClamp: 2 as number,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {article.summary}
          </p>
        )}

        {/* 标签栏 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {hasXinfaTag && xinfaStyle && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, padding: '3px 10px',
              borderRadius: 12, color: '#fff', background: xinfaStyle.background,
            }}>
              {article.xinfaTag}
            </span>
          )}
          <span style={{
            fontSize: 12, fontWeight: 400, padding: '2px 8px',
            borderRadius: 4, color: catColor,
            backgroundColor: catColor + '10', opacity: 0.75,
          }}>
            {article.categoryName}
          </span>

          {/* Meta 信息行内显示 */}
          <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 'auto' }}>
            {formatReadCount(article.readCount || 0)} 阅读
          </span>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            <Clock size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />
            {formatTime(article.publishTime || '')}
          </span>
        </div>
      </div>
    );
  }

  // ========== 单图/三图模式 — 桌面端左文右图 / 移动端上文下图 ==========
  const isTriple = layoutMode === 'triple';

  return (
    <div
      className={isMobile ? 'app-card' : ''}
      style={{
        backgroundColor: '#FFFFFF',
        border: article.isPinned ? '1.5px solid #165DFF' : '1px solid #E2E8F0',
        borderRadius: isMobile ? 12 : 16,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        display: isMobile ? 'flex' : 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        position: 'relative',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        marginBottom: isMobile ? 10 : 0,
      }}
      onClick={() => navigate('/cases/' + article.id)}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-3px)';
        el.style.boxShadow = article.isPinned
          ? '0 12px 32px rgba(22,93,255,0.18)'
          : '0 8px 24px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)';
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate('/cases/' + article.id);
        }
      }}
    >
      {/* 左侧：内容区 */}
      <div style={{
        flex: 1,
        minWidth: 0,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        {/* 标签栏 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 22 }}>
          {hasXinfaTag && xinfaStyle && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, padding: '3px 10px',
              borderRadius: 12, color: '#fff', background: xinfaStyle.background,
              alignSelf: 'flex-start',
            }}>
              {article.xinfaTag}
            </span>
          )}
          <span style={{
            display: 'inline-block', fontSize: 12, fontWeight: 400,
            padding: '2px 8px', borderRadius: 4,
            alignSelf: 'flex-start', color: catColor,
            backgroundColor: catColor + '10', opacity: 0.75,
          }}>
            {article.categoryName}
          </span>
        </div>

        {/* 标题 — 2行截断 */}
        <h3 style={{
          fontSize: isMobile ? 15 : 15, fontWeight: 600, color: '#0F172A',
          margin: 0, lineHeight: '22px',
          height: 44,
          display: '-webkit-box' as const,
          WebkitLineClamp: 2 as number,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {article.title}
        </h3>

        {/* 摘要 — 2行截断 */}
        <p style={{
          fontSize: 13, color: '#64748B', margin: 0,
          lineHeight: '20px', height: 40,
          display: '-webkit-box' as const,
          WebkitLineClamp: isMobile ? 2 : 2 as number,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden', flex: 1,
        }}>
          {article.summary}
        </p>

        {/* 互动按钮 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
          <button
            onClick={handlePitfallToggle}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 10,
              border: '1px solid #E2E8F0',
              background: userHasPitfalled ? '#FEF2F2' : '#fff',
              color: userHasPitfalled ? '#DC2626' : '#64748B',
              fontSize: 11, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
              transition: 'all 0.15s ease',
            }}
          >
            踩过坑 {pitfallCount}
          </button>
          <button
            onClick={handleLearnedToggle}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 10,
              border: '1px solid #E2E8F0',
              background: userHasLearned ? '#F0FDF4' : '#fff',
              color: userHasLearned ? '#059669' : '#64748B',
              fontSize: 11, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
              transition: 'all 0.15s ease',
            }}
          >
            学到了 {learnedCount}
          </button>
        </div>

        {/* Meta 行 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          fontSize: 11, color: '#94A3B8', marginTop: 4,
        }}>
          <span>{article.authorName || ''}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Eye size={12} />{formatReadCount(article.readCount || 0)}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Clock size={12} />{formatTime(article.publishTime || '')}
          </span>
        </div>
      </div>

      {/* 右侧：图片区（移动端变为底部全宽） */}
      <div style={{
        width: isMobile ? '100%' : (isTriple ? 200 : 160),
        minWidth: isMobile ? '100%' : (isTriple ? 200 : 160),
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        height: isMobile ? 180 : 'auto',
      }}>
        <ArticleCover
          imageUrl={article.coverImage}
          galleryImages={article.galleryImages}
          title={article.title}
          xinfaTag={article.xinfaTag}
          categoryName={article.categoryName}
          index={Number(article.id) || 0}
          width="100%"
          height="100%"
          layoutMode={layoutMode}
        />
        {article.isPinned && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 700, color: '#fff',
            backgroundColor: 'rgba(220,38,38,0.9)',
            padding: '2px 7px', borderRadius: 6, zIndex: 2,
          }}>
            精选
          </div>
        )}
      </div>
    </div>
  );
};

export default ArticleCard;

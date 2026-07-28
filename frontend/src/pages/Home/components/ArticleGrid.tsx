import { useState, useEffect, useRef, useCallback } from 'react';
import type { Article } from '@/types/article';
import ArticleCard from './ArticleCard';
import ArticleCover from '@/components/ArticleCover';

interface ArticleGridProps {
  articles: Article[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  sortMode?: string;
  onSortChange?: (mode: string) => void;
  activeZone?: string;
  onZoneChange?: (zone: string) => void;
}

const ZONES = [
  { id: 'all', label: '全部', icon: '📋', activeBg: '#165DFF' },
  { id: 'dev', label: '个人开发者', icon: '👨‍💻', activeBg: '#7C3AED' },
  { id: 'enterprise', label: '企业部署', icon: '🏢', activeBg: '#059669' },
  { id: 'multi_agent', label: '多智能体', icon: '🤖', activeBg: '#DC2626' },
  { id: 'pitfall_records', label: '真实踩坑', icon: '⚠️', activeBg: '#EA580C' },
];

const SORT_OPTIONS = [
  { value: 'featured', label: '🔥 精选' },
  { value: 'hot_pitfalls', label: '最热踩坑' },
  { value: 'latest', label: '最新发布' },
];

const STYLES = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap' as const,
  },
  zoneBtn: (active: boolean, bg: string) => ({
    padding: '6px 14px',
    borderRadius: 20,
    border: 'none',
    background: active ? bg : '#F8FAFC',
    color: active ? '#fff' : '#64748B',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  }),
  sortArea: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  sortLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  sortBtn: (active: boolean) => ({
    padding: '4px 10px',
    borderRadius: 14,
    border: 'none',
    background: active ? '#165DFF' : 'transparent',
    color: active ? '#fff' : '#94A3B8',
    fontSize: 12,
    cursor: 'pointer',
  }),
  featuredSection: {
    marginBottom: 24,
  },
  featuredHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  featuredTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0F172A',
  },
  featuredBadge: {
    fontSize: 11,
    color: '#94A3B8',
    background: '#FEF2F2',
    padding: '2px 8px',
    borderRadius: 10,
  },
  featuredScroll: {
    display: 'flex',
    gap: 16,
    overflowX: 'auto',
    paddingBottom: 8,
  },
  featuredCard: {
    minWidth: 340,
    flex: '0 0 auto',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    display: 'flex',
    flexDirection: 'row',
    height: 180,
  },
  featuredCardImage: {
    width: '60%',
    position: 'relative' as const,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  featuredCardContent: {
    width: '40%',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
  },
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 20,
    alignItems: 'stretch',
  },
  empty: {
    gridColumn: '1 / -1',
    textAlign: 'center' as const,
    padding: '80px 24px',
    color: '#94A3B8',
  },
  skeleton: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 6,
    overflow: 'hidden' as const,
  },
  skeletonImage: {
    width: '100%',
    paddingTop: '56.25%',
    background: '#F1F5F9',
  },
  skeletonContent: { padding: 16 },
  skeletonTag: { width: 60, height: 22, borderRadius: 4, background: '#F1F5F9', marginBottom: 10 },
  skeletonTitle: { width: '85%', height: 18, borderRadius: 4, background: '#F1F5F9', marginBottom: 10 },
  skeletonLine: (w: number) => ({ width: w + '%', height: 12, borderRadius: 4, background: '#F1F5F9', marginBottom: 8 }),
  skeletonMeta: { width: '70%', height: 11, borderRadius: 4, background: '#F1F5F9', marginTop: 8 },
  loadMore: {
    gridColumn: '1 / -1',
    textAlign: 'center' as const,
    padding: '24px 0',
  },
} as const;

function SkeletonCard() {
  return (
    <div style={STYLES.skeleton}>
      <div style={STYLES.skeletonImage} />
      <div style={STYLES.skeletonContent}>
        <div style={STYLES.skeletonTag} />
        <div style={STYLES.skeletonTitle} />
        <div style={STYLES.skeletonLine(100)} />
        <div style={STYLES.skeletonLine(92)} />
        <div style={STYLES.skeletonLine(68)} />
        <div style={STYLES.skeletonMeta} />
      </div>
    </div>
  );
}

function FeaturedCard({ article }: { article: Article }) {
  const handleClick = () => {
    window.location.href = '/cases/' + article.id;
  };

  return (
    <div
      style={STYLES.featuredCard}
      onClick={handleClick}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.location.href = '/cases/' + article.id;
        }
      }}
    >
      <div style={STYLES.featuredCardImage}>
        <ArticleCover
          title={article.title}
          xinfaTag={article.xinfaTag}
          categoryName={article.categoryName}
          index={Number(article.id) || 0}
          width="100%"
          height="100%"
        />
      </div>
      <div style={STYLES.featuredCardContent}>
        <span style={{
          display: 'inline-block',
          fontSize: 11,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 4,
          marginBottom: 8,
          alignSelf: 'flex-start',
          color: '#DC2626',
          backgroundColor: '#FEF2F2',
        }}>
          {article.categoryName}
        </span>
        <h3 style={{
          fontSize: 15,
          fontWeight: 700,
          color: '#0F172A',
          margin: '0 0 8px',
          lineHeight: 1.4,
          display: '-webkit-box' as const,
          WebkitLineClamp: 2 as number,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}>
          {article.title}
        </h3>
        <p style={{
          fontSize: 12,
          color: '#64748B',
          margin: 0,
          lineHeight: 1.6,
          display: '-webkit-box' as const,
          WebkitLineClamp: 2 as number,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}>
          {article.summary}
        </p>
      </div>
    </div>
  );
}

const ArticleGrid: React.FC<ArticleGridProps> = ({
  articles,
  loading = false,
  hasMore,
  onLoadMore,
  sortMode = 'latest',
  onSortChange,
  activeZone = 'all',
  onZoneChange,
}) => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && !loading && hasMore && onLoadMore) {
        onLoadMore();
      }
    },
    [loading, hasMore, onLoadMore]
  );

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!hasMore || !onLoadMore) return;

    observerRef.current = new IntersectionObserver(handleObserver, { rootMargin: '200px' });
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [handleObserver, hasMore, onLoadMore]);

  const pinnedArticles = (articles || []).filter(
    (a): a is Article & { isPinned: boolean } => (a as any).isPinned === true
  );

  if (loading && (!articles || articles.length === 0)) {
    return (
      <>
        <style>{`
          @media (max-width: 1199px) { .home-article-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 16 !important; } }
          @media (max-width: 767px) { .home-article-grid { grid-template-columns: 1fr !important; gap: 12px !important; } }
          @media (max-width: 767px) { .featured-scroll-area { flex-direction: column !important; overflow-x: visible !important; } .featured-scroll-area > div { min-width: 100% !important; width: 100% !important; flex-direction: column !important; height: auto !important; } .featured-scroll-area > div img { position: relative !important; paddingTop: 50%; } }
        `}</style>

        <div style={STYLES.toolbar}>
          {ZONES.map((zone) => (
            <button key={zone.id} style={STYLES.zoneBtn(activeZone === zone.id, zone.activeBg)}>
              <span>{zone.icon}</span>
              <span>{zone.label}</span>
            </button>
          ))}
          <div style={STYLES.sortArea}>
            <span style={STYLES.sortLabel}>排序：</span>
            {SORT_OPTIONS.map((opt) => (
              <button key={opt.value} style={STYLES.sortBtn(sortMode === opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="home-article-grid" style={STYLES.container}>
          {[...Array(9)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <>
        <div style={STYLES.toolbar}>
          {ZONES.map((zone) => (
            <button key={zone.id} style={STYLES.zoneBtn(activeZone === zone.id, zone.activeBg)}>
              <span>{zone.icon}</span>
              <span>{zone.label}</span>
            </button>
          ))}
          <div style={STYLES.sortArea}>
            <span style={STYLES.sortLabel}>排序：</span>
            {SORT_OPTIONS.map((opt) => (
              <button key={opt.value} style={STYLES.sortBtn(sortMode === opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ ...STYLES.empty, gridColumn: '1 / -1' }}>
          <p style={{ fontSize: 16, margin: 0 }}>兄弟们还没踩过这个坑，稍后来看看 👀</p>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @media (max-width: 1199px) { .home-article-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 16 !important; } }
        @media (max-width: 767px) { .home-article-grid { grid-template-columns: 1fr !important; gap: 12px !important; } }
        @media (max-width: 767px) { .featured-scroll-area { flex-direction: column !important; overflow-x: visible !important; } .featured-scroll-area > div { min-width: 100% !important; width: 100% !important; flex-direction: column !important; height: auto !important; } .featured-scroll-area > div > div:first-child { width: 100% !important; position: relative !important; padding-top: 50% !important; } .featured-scroll-area > div > div:last-child { width: 100% !important; } }
      `}</style>

      <div style={STYLES.toolbar}>
        {ZONES.map((zone) => (
          <button
            key={zone.id}
            onClick={() => onZoneChange?.(zone.id)}
            style={STYLES.zoneBtn(activeZone === zone.id, zone.activeBg)}
          >
            <span>{zone.icon}</span>
            <span>{zone.label}</span>
          </button>
        ))}

        <div style={STYLES.sortArea}>
          <span style={STYLES.sortLabel}>排序：</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSortChange?.(opt.value)}
              style={STYLES.sortBtn(sortMode === opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {sortMode === 'featured' && pinnedArticles.length > 0 && (
        <div style={STYLES.featuredSection}>
          <div style={STYLES.featuredHeader}>
            <span style={STYLES.featuredTitle}>🔥 今日精选 · Agent 安全必读</span>
            <span style={STYLES.featuredBadge}>每天更新3条</span>
          </div>
          <div className="featured-scroll-area" style={STYLES.featuredScroll}>
            {pinnedArticles.slice(0, 3).map((article) => (
              <FeaturedCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}

      <div className="home-article-grid" style={STYLES.container}>
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
        {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
        {loading && hasMore && [...Array(4)].map((_, i) => <SkeletonCard key={'sk-' + i} />)}
        {!hasMore && articles.length > 0 && (
          <div style={STYLES.loadMore}>
            <span style={{ fontSize: 13, color: '#94A3B8' }}>— 已加载全部内容 —</span>
          </div>
        )}
      </div>
    </>
  );
};

export default ArticleGrid;

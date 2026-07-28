import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight } from 'lucide-react';
import type { Article } from '@/types/article';

interface HotRankingProps {
  articles: Article[];
  onRefresh?: () => void;
  onRefreshRequest?: () => void;
}

const STYLES = {
  wrapper: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E6EB',
    borderRadius: 6,
    height: 280,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 18px',
    borderBottom: '1px solid #E5E6EB',
    flexShrink: 0,
  },
  headerIcon: { color: '#165DFF' },
  headerTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1D2129',
    margin: 0,
    flex: 1,
  },
  headerDesc: {
    fontSize: 11,
    color: '#86909C',
  },
  list: {
    listStyle: 'none',
    padding: '6px 14px',
    margin: 0,
    overflowY: 'auto' as const,
    flex: 1,
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '9px 2px',
    cursor: 'pointer',
    borderBottom: '1px solid #F2F3F5',
    transition: 'background-color 0.15s ease',
  },
  rank: (index: number) => ({
    width: 20,
    height: 20,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: index < 3 ? '#165DFF' : '#F2F3F5',
    color: index < 3 ? '#FFFFFF' : '#86909C',
  }),
  info: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 13,
    fontWeight: 500,
    color: '#1D2129',
    margin: '0 0 2px',
    lineHeight: 1.45,
    display: '-webkit-box' as const,
    WebkitLineClamp: 2 as number,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  },
  arrowIcon: {
    color: '#C9CDD4',
    flexShrink: 0,
    marginTop: 2,
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#86909C',
    fontSize: 13,
  },
} as const;

const HotRanking: React.FC<HotRankingProps> = ({ articles }) => {
  const navigate = useNavigate();
  const items = [...articles].sort((a, b) => (b.readCount || 0) - (a.readCount || 0)).slice(0, 8);

  return (
    <div style={STYLES.wrapper}>
      <div style={STYLES.header}>
        <BookOpen size={17} style={STYLES.headerIcon} />
        <h3 style={STYLES.headerTitle}>推荐阅读</h3>
        <span style={STYLES.headerDesc}>精选好文</span>
      </div>

      {items.length === 0 ? (
        <div style={STYLES.empty}>暂无推荐内容</div>
      ) : (
        <ul style={STYLES.list}>
          {items.map((article, i) => (
            <li
              key={article.id}
              style={STYLES.item}
              onClick={() => navigate(`/cases/${article.id}`)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLLIElement).style.backgroundColor = '#F7F8FA';
                const arrow = e.currentTarget.querySelector('.item-arrow');
                if (arrow) (arrow as HTMLElement).style.color = '#165DFF';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLLIElement).style.backgroundColor = 'transparent';
                const arrow = e.currentTarget.querySelector('.item-arrow');
                if (arrow) (arrow as HTMLElement).style.color = '#C9CDD4';
              }}
            >
              <span style={STYLES.rank(i)}>{i + 1}</span>
              <div style={STYLES.info}>
                <p style={STYLES.title}>{article.title}</p>
              </div>
              <ArrowRight size={14} className="item-arrow" style={STYLES.arrowIcon} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default HotRanking;

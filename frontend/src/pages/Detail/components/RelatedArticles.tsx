import { Eye } from 'lucide-react';
import type { Article } from '@/types/article';
import ArticleCover from '@/components/ArticleCover';

interface RelatedArticlesProps {
  articles: Article[];
  currentArticleId: number;
  currentCategoryId?: number;
}

const RelatedArticles: React.FC<RelatedArticlesProps> = ({
  articles,
  currentArticleId,
  currentCategoryId,
}) => {
  const getRelatedArticles = (): Article[] => {
    let related = articles.filter(a => a.id !== currentArticleId);

    if (currentCategoryId) {
      const sameCategory = related.filter(a => a.categoryId === currentCategoryId);
      const otherCategory = related.filter(a => a.categoryId !== currentCategoryId);
      related = [...sameCategory, ...otherCategory];
    }

    return related.slice(0, 5);
  };

  const relatedArticles = getRelatedArticles();

  if (relatedArticles.length === 0) return null;

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>🔥 同类踩坑，提前避雷</h3>
      <p style={styles.guideText}>看了这篇的兄弟还踩过这些坑 ↓</p>
      <div style={styles.list}>
        {relatedArticles.map((article, index) => (
          <a
            key={article.id}
            href={`/cases/${article.id}`}
            style={{
              ...styles.item,
              borderBottom: index < relatedArticles.length - 1 ? '1px solid #E2E8F0' : 'none',
            }}
          >
            <div style={{ ...styles.thumbnail, overflow: 'hidden', flexShrink: 0 }}>
              <ArticleCover
                title={article.title}
                xinfaTag={(article as any)?.xinfaTag}
                categoryName={article.categoryName}
                index={Number(article.id) || 0}
                width="100%"
                height="100%"
              />
            </div>
            <div style={styles.content}>
              {(article as any)?.xinfaTag && (
                <span style={styles.xinfaTagSmall}>{(article as any).xinfaTag}</span>
              )}
              <h4 style={styles.articleTitle}>{article.title}</h4>
              <div style={styles.meta}>
                <Eye size={14} style={{ color: '#94A3B8' }} />
                <span style={styles.readCount}>{article.readCount.toLocaleString()}</span>
                {Math.floor(article.readCount * 0.12) > 0 && (
                  <>
                    <span style={styles.metaDot}>·</span>
                    <span style={styles.pitCount}>🔥 {Math.floor(article.readCount * 0.12)}人踩过</span>
                  </>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    marginTop: '20px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 6px 0',
    paddingBottom: '12px',
    borderBottom: '2px solid #FEE2E2',
  },
  guideText: {
    fontSize: '13px',
    color: '#EF4444',
    margin: '0 0 16px 0',
    fontWeight: 500,
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  item: {
    display: 'flex',
    gap: '12px',
    padding: '12px 0',
    textDecoration: 'none',
    transition: 'all 0.2s ease',
  },
  thumbnail: {
    width: '80px',
    height: '60px',
    borderRadius: '6px',
    objectFit: 'cover' as const,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    minWidth: 0,
  },
  xinfaTagSmall: {
    display: 'inline-block',
    fontSize: '10.5px',
    fontWeight: 600,
    color: '#7C3AED',
    background: 'rgba(124,58,237,0.08)',
    padding: '1px 8px',
    borderRadius: '10px',
    marginBottom: '4px',
    alignSelf: 'flex-start',
  },
  articleTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#334155',
    margin: '0',
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
    transition: 'color 0.2s',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '6px',
  },
  readCount: {
    fontSize: '13px',
    color: '#94A3B8',
  },
  metaDot: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  pitCount: {
    fontSize: '12px',
    color: '#EF4444',
    fontWeight: 500,
  },
};

export default RelatedArticles;

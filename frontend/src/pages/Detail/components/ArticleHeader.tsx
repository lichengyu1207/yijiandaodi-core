import { useState } from 'react';
import { Heart, Bookmark, Share2, Eye, Calendar, User, Clock, FileIcon, Flame, AlertTriangle } from 'lucide-react';
import ArticleCover from '@/components/ArticleCover';
import type { Article } from '@/types/article';

interface ArticleHeaderProps {
  article: any;
  isLiked?: boolean;
  likeCount?: number;
  onLike?: () => void;
  isBookmarked?: boolean;
  onBookmark?: () => void;
}

const ArticleHeader: React.FC<ArticleHeaderProps> = ({ article, isLiked: parentLiked, likeCount: parentLikeCount, onLike, isBookmarked: parentBookmarked, onBookmark }) => {
  const [isBookmarked, setIsBookmarked] = useState(parentBookmarked ?? false);
  const [pitCounted, setPitCounted] = useState(false);
  const [learned, setLearned] = useState(false);
  const isLiked = parentLiked ?? false;
  const likeCount = parentLikeCount ?? article?.likeCount ?? 0;

  const formatRelativeTime = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return '刚刚';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}天前`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}个月前`;
    return `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`;
  };

  const formatPublishDate = (dateString: string): string => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const handleLike = () => {
    if (onLike) onLike();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: article?.title || '', text: article?.summary || '', url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('链接已复制到剪贴板');
    }
  };

  const pubTime = article?.publishTime || article?.created_at || article?.date_published || '';
  const categoryName = article?.categoryName || article?.category?.name || '';
  const readCount = article?.readCount ?? article?.read_count ?? 0;
  const xinfaTag = article?.xinfaTag || '';
  const hookLine = article?.hookLine || '';

  const pitBaseCount = Math.max(Math.floor(readCount * 0.12), 3);

  return (
    <div style={styles.container}>
      {/* 封面图 */}
      <div style={styles.coverWrapper}>
        <ArticleCover
          title={article?.title || ''}
          xinfaTag={article?.xinfaTag}
          categoryName={article?.categoryName}
          index={Number(article?.id) || 0}
          width="100%"
          height="100%"
        />
        {categoryName && (
          <div style={styles.categoryBadge}>
            <FileIcon size={12} />
            {categoryName}
          </div>
        )}
        {xinfaTag && (
          <div style={styles.xinfaBadge}>⚡ {xinfaTag}</div>
        )}
      </div>

      {/* 标题 */}
      <h1 style={styles.title}>{article?.title || ''}</h1>

      {/* 心法标签（胶囊样式） */}
      {xinfaTag && (
        <div style={styles.xinfaTagRow}>
          <span style={styles.xinfaTagCapsule}>{xinfaTag}</span>
        </div>
      )}

      {/* 扎心钩子展示区 */}
      {hookLine && (
        <div style={styles.hookLineBox}>
          <span style={styles.hookQuoteLeft}>"</span>
          <span style={styles.hookText}>{hookLine}</span>
          <span style={styles.hookQuoteRight}>"</span>
        </div>
      )}

      {/* 分享人信息 + 发布时间 */}
      <div style={styles.authorBlock}>
        <img src={article?.avatar || ''} alt={article?.authorName || ''} style={styles.avatarLarge} />
        <div style={styles.authorInfo}>
          <div style={styles.authorTopRow}>
            <User size={14} style={{ color: '#7C3AED', flexShrink: 0 }} />
            <span style={styles.authorName}>{article?.authorName || '一鉴到底'}</span>
            <span style={styles.sharerTag}>分享人</span>
          </div>
          <div style={styles.publishInfo}>
            <Calendar size={13} style={{ color: '#94A3B8', flexShrink: 0 }} />
            <span style={styles.publishTime}>发表于 {formatRelativeTime(pubTime)}</span>
            <span style={styles.publishFullTime}>{formatPublishDate(pubTime)}</span>
            <span style={styles.dotSeparator}>·</span>
            <Eye size={13} style={{ color: '#94A3B8', flexShrink: 0 }} />
            <span style={styles.publishTime}>{readCount.toLocaleString()} 次阅读</span>
            <span style={styles.dotSeparator}>·</span>
            <Flame size={13} style={{ color: '#EF4444', flexShrink: 0 }} />
            <span style={styles.fireCount}>{pitBaseCount}位兄弟已踩过此坑</span>
          </div>
        </div>
      </div>

      {/* 踩坑/学到了互动按钮 */}
      <div style={styles.pitActionBar}>
        <button
          onClick={() => setPitCounted(!pitCounted)}
          style={{
            ...styles.pitButton,
            color: pitCounted ? '#FFF' : '#EF4444',
            backgroundColor: pitCounted ? '#EF4444' : '#FEF2F2',
            borderColor: pitCounted ? '#EF4444' : '#FECACA',
          }}
        >
          <AlertTriangle size={15} fill={pitCounted ? '#FFF' : 'none'} />
          <span>{pitCounted ? `已踩坑 (+1)` : '踩过这个坑'}</span>
        </button>
        <button
          onClick={() => setLearned(!learned)}
          style={{
            ...styles.pitButton,
            color: learned ? '#FFF' : '#16A34A',
            backgroundColor: learned ? '#16A34A' : '#F0FDF4',
            borderColor: learned ? '#16A34A' : '#BBF7D0',
          }}
        >
          <span>{learned ? '已学到 ✓' : '学到了'}</span>
        </button>
      </div>

      {/* 分隔线 */}
      <div style={styles.divider} />

      {/* 操作按钮栏 */}
      <div style={styles.actionBar}>
        <button onClick={handleLike} style={{
          ...styles.actionButton,
          color: isLiked ? '#EF4444' : '#64748B',
          backgroundColor: isLiked ? '#FEE2E2' : '#F1F5F9',
        }}>
          <Heart size={18} fill={isLiked ? '#EF4444' : 'none'} />
          <span>{likeCount.toLocaleString()}</span>
        </button>

        <button onClick={() => { setIsBookmarked(!isBookmarked); if (onBookmark) onBookmark(); }} style={{
          ...styles.actionButton,
          color: isBookmarked ? '#2563EB' : '#64748B',
          backgroundColor: isBookmarked ? '#DBEAFE' : '#F1F5F9',
        }}>
          <Bookmark size={18} fill={isBookmarked ? '#2563EB' : 'none'} />
          <span>{isBookmarked ? '已收藏' : '收藏'}</span>
        </button>

        <button onClick={handleShare} style={{ ...styles.actionButton, color: '#64748B', backgroundColor: '#F1F5F9' }}>
          <Share2 size={18} />
          <span>分享</span>
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: '32px',
  },
  coverWrapper: {
    width: '100%',
    height: '400px',
    borderRadius: '6px',
    overflow: 'hidden',
    marginBottom: '24px',
    position: 'relative' as const,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  categoryBadge: {
    position: 'absolute' as const,
    top: 16,
    left: 16,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 14px',
    borderRadius: 20,
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(4px)',
    fontSize: 13,
    fontWeight: 600,
    color: '#1A6BA8',
  },
  xinfaBadge: {
    position: 'absolute' as const,
    top: 16,
    right: 16,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 14px',
    borderRadius: 20,
    background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
    backdropFilter: 'blur(4px)',
    fontSize: 13,
    fontWeight: 600,
    color: '#FFFFFF',
  },
  title: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 16px 0',
    lineHeight: 1.35,
  },

  xinfaTagRow: {
    marginBottom: '16px',
  },
  xinfaTagCapsule: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 16px',
    borderRadius: 20,
    background: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(236,72,153,0.10))',
    border: '1px solid rgba(124,58,237,0.25)',
    fontSize: 13,
    fontWeight: 600,
    color: '#7C3AED',
  },

  hookLineBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 4,
    padding: '20px 24px',
    marginBottom: '20px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, rgba(124,58,237,0.05), rgba(236,72,153,0.05))',
    borderLeft: '4px solid #7C3AED',
  },
  hookQuoteLeft: {
    fontSize: '36px',
    lineHeight: 1,
    color: '#7C3AED',
    opacity: 0.5,
    fontFamily: 'Georgia, serif',
    flexShrink: 0,
    marginTop: '-4px',
  },
  hookQuoteRight: {
    fontSize: '36px',
    lineHeight: 1,
    color: '#7C3AED',
    opacity: 0.5,
    fontFamily: 'Georgia, serif',
    flexShrink: 0,
    alignSelf: 'flex-end',
    marginBottom: '-8px',
  },
  hookText: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#4C1D95',
    lineHeight: 1.6,
    flex: 1,
  },

  authorBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '16px 20px',
    background: 'linear-gradient(135deg, #FAF5FF, #FDF2F8)',
    borderRadius: '8px',
    marginBottom: 16,
    border: '1px solid rgba(124,58,237,0.12)',
  },
  avatarLarge: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    border: '2px solid #FFFFFF',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    flexShrink: 0,
  },
  authorInfo: {
    flex: 1,
    minWidth: 0,
  },
  authorTopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  authorName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#0F172A',
  },
  sharerTag: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 500,
    color: '#7C3AED',
    background: 'rgba(124,58,237,0.10)',
    padding: '2px 10px',
    borderRadius: 10,
  },
  publishInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  publishTime: {
    fontSize: 13,
    color: '#64748B',
  },
  publishFullTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  dotSeparator: {
    color: '#CBD5E1',
    margin: '0 2px',
    fontSize: 13,
  },
  fireCount: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: 500,
  },

  pitActionBar: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
  },
  pitButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 18px',
    border: '1px solid',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    transition: 'all 0.25s ease',
    background: 'transparent',
  },

  divider: {
    height: 1,
    background: '#E2E8F0',
    marginBottom: 16,
  },

  actionBar: {
    display: 'flex',
    gap: 12,
    paddingTop: 4,
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 18px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.2s ease',
  },
};

export default ArticleHeader;

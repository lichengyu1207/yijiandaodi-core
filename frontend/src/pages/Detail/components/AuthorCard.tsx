import { useState, useEffect } from 'react';
import { FileIcon, Eye, Users } from 'lucide-react';
import { followAuthor, getFollowStatus } from '@/api/frontApi';

interface AuthorCardProps {
  author: {
    name: string;
    avatar: string;
    bio?: string;
    id?: number;
  };
  articleCount?: number;
  totalReads?: number;
  articleId?: number | string;
  followerCount?: number;
  isInitiallyFollowed?: boolean;
}

const AuthorCard: React.FC<AuthorCardProps> = ({
  author,
  articleCount = 0,
  totalReads = 0,
  articleId,
  followerCount = 0,
  isInitiallyFollowed = false,
}) => {
  const [isFollowing, setIsFollowing] = useState(isInitiallyFollowed);
  const [followers, setFollowers] = useState(followerCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (articleId) {
      loadFollowStatus();
    }
  }, [articleId]);

  const loadFollowStatus = async () => {
    try {
      const res: any = await getFollowStatus(articleId!);
      if (res) {
        setIsFollowing(res.is_followed || false);
        setFollowers(res.follower_count || 0);
      }
    } catch (error) {
      console.error('获取关注状态失败:', error);
    }
  };

  const handleFollow = async () => {
    if (!articleId) {
      alert('文章ID缺失，无法执行关注操作');
      return;
    }

    if (loading) return;

    setLoading(true);
    try {
      console.log('关注操作 - articleId:', articleId);
      const res: any = await followAuthor(articleId!);
      console.log('关注API返回:', res);

      if (res) {
        setIsFollowing(res.followed || false);
        setFollowers(res.follower_count || 0);

        if (res.message) {
          alert(res.message);
        }
      }
    } catch (error: any) {
      console.error('关注操作失败:', error);
      alert(error?.message || '关注操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.leftSection}>
        <img src={author.avatar || 'https://via.placeholder.com/56'} alt={author.name} style={styles.avatar} />
        <div style={styles.info}>
          <h3 style={styles.name}>{author.name}</h3>
          <p style={styles.bio}>{author.bio || ''}</p>
          <div style={styles.publishRow}>
            <span style={styles.statInline}><FileIcon size={13} />{articleCount} 篇文章</span>
            <span style={styles.statDivider}>·</span>
            <span style={styles.statInline}><Eye size={13} />{totalReads >= 10000 ? `${(totalReads / 10000).toFixed(1)}w` : totalReads.toLocaleString()} 阅读</span>
            <span style={styles.statDivider}>·</span>
            <span style={styles.statInline}><Users size={13} />{followers} 粉丝</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleFollow}
        disabled={loading}
        style={{
          ...styles.followButton,
          borderColor: isFollowing ? '#2563EB' : '#2563EB',
          color: isFollowing ? '#FFFFFF' : '#2563EB',
          backgroundColor: isFollowing ? '#2563EB' : 'transparent',
          opacity: loading ? 0.7 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '处理中...' : (isFollowing ? '已关注' : '+ 关注')}
      </button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    marginBottom: '28px',
    gap: 16,
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    border: '2px solid #F1F5F9',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: '17px',
    fontWeight: 600,
    color: '#0F172A',
    margin: '0 0 4px 0',
  },
  bio: {
    fontSize: '13.5px',
    color: '#64748B',
    margin: '0 0 8px 0',
    lineHeight: 1.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  publishRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  statInline: {
    fontSize: 13,
    color: '#94A3B8',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  followButton: {
    padding: '9px 22px',
    border: '1px solid #2563EB',
    borderRadius: '6px',
    background: 'transparent',
    color: '#2563EB',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },
};

export default AuthorCard;

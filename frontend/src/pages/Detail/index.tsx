import { useParams } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import {
  getArticleDetail,
  likeArticle,
  getArticleComments,
  addArticleComment,
  getLikeStatus,
  getFollowStatus,
  favoriteArticle,
  getFavoriteStatus,
} from '@/api/frontApi';
import type { Article } from '@/types/article';
import ArticleHeader from './components/ArticleHeader';
import ArticleContent from './components/ArticleContent';
import TableOfContents from './components/TableOfContents';
import AuthorCard from './components/AuthorCard';
import RelatedArticles from './components/RelatedArticles';
import CommentSection from './components/CommentSection';
import AgentTimeline from './components/AgentTimeline';
import CoffeeButton from '@/components/CoffeeButton';

const Detail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [currentLikeCount, setCurrentLikeCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [comments, setComments] = useState<any[]>([]);

  const loadArticle = useCallback(() => {
    if (!id) return;
    setLoading(true);
    getArticleDetail(id)
      .then((res: any) => {
        // 兼容多种返回格式：直接对象 或 {data: {...}} 包裹
        const data = res?.data || res;
        // 字段名映射：下划线 → 驼峰
        setArticle({
          id: data.id,
          title: data.title,
          summary: data.summary || '',
          content: data.content || '',
          coverImage: data.cover_image || data.coverImage || '',
          categoryName: data.category_name || data.category?.name || '',
          categoryId: data.category || data.categoryId,
          authorName: data.author_name || data.author?.name || data.authorName || '一鉴到底',
          avatar: data.avatar || data.author?.avatar || '',
          publishTime: data.publish_time || data.published_at || data.publishTime || data.created_at,
          readCount: data.read_count ?? data.readCount ?? 0,
          likeCount: data.like_count ?? data.likeCount ?? 0,
          commentCount: data.comment_count ?? data.commentCount ?? 0,
          isRecommended: data.is_recommended ?? data.isRecommended ?? false,
          tags: data.tags || [],
          author: data.author || { name: data.author_name, avatar: data.avatar, id: data.author?.id },
          author_articles: data.author_articles || [],
          related_articles: data.related_articles || [],
          authorArticleCount: data.author_article_count ?? 0,
          authorTotalReads: data.author_total_reads ?? 0,
          isFollowed: data.is_followed ?? false,
          followerCount: data.follower_count ?? 0,
          xinfaTag: data.xinfa_tag ?? data.xinfaTag ?? '',
          hookLine: data.hook_line ?? data.hookLine ?? '',
          realCaseTitle: data.real_case_title ?? data.realCaseTitle ?? '',
          realCaseContent: data.real_case_content ?? data.realCaseContent ?? '',
          solutionSteps: data.solution_steps ?? data.solutionSteps ?? [],
          actionCommand: data.action_command ?? data.actionCommand ?? '',
          ctaButton: data.cta_button ?? data.ctaButton ?? null,
        });
        setCurrentLikeCount(data.like_count ?? data.likeCount ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const loadComments = useCallback(() => {
    if (!id) return;
    getArticleComments(id).then((res: any) => {
      setComments(res?.results || res?.data || []);
    }).catch(() => {
      setComments([]);
    });
  }, [id]);

  useEffect(() => {
    loadArticle();
    loadComments();
    loadUserStatus();
  }, [loadArticle, loadComments]);

  const loadUserStatus = useCallback(async () => {
    if (!id) return;
    try {
      const [likeRes, followRes, favRes]: any = await Promise.all([
        getLikeStatus(id),
        getFollowStatus(id),
        getFavoriteStatus(id),
      ]);

      if (likeRes) {
        setIsLiked(likeRes.is_liked || false);
        setCurrentLikeCount(prev => likeRes.like_count || prev);
      }

      if (followRes) {
        setArticle((prev: any) => ({
          ...prev,
          isFollowed: followRes.is_followed || false,
          followerCount: followRes.follower_count || 0,
        }));
      }

      if (favRes) {
        setIsBookmarked(favRes.favorited || false);
      }
    } catch (error) {
      console.error('获取用户状态失败:', error);
    }
  }, [id]);

  const handleLike = async () => {
    if (!id) return;
    try {
      const res: any = await likeArticle(id);
      setIsLiked(res.liked);
      setCurrentLikeCount(res.like_count);
    } catch (err) {
      console.error('点赞失败:', err);
    }
  };

  const handleFavorite = async () => {
    if (!id) return;
    try {
      const res: any = await favoriteArticle(id);
      setIsBookmarked(res.favorited);
    } catch (err) {
      console.error('收藏操作失败:', err);
    }
  };

  const handleAddComment = async (content: string, parentId?: number | null) => {
    if (!id || !content.trim()) return false;
    try {
      await addArticleComment(id, { content: content.trim(), parent_comment: parentId || null });
      loadComments();
      return true;
    } catch (err) {
      console.error('评论失败:', err);
      return false;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
        加载中...
      </div>
    );
  }

  if (!article) {
    return <NotFound />;
  }

  const author = article?.author || null;
  const authorArticleCount = (article as any)?.authorArticleCount ?? 0;
  const authorTotalReads = (article as any)?.authorTotalReads ?? 0;
  const isFollowed = (article as any)?.isFollowed ?? false;
  const followerCount = (article as any)?.followerCount ?? 0;

  return (
    <div style={styles.container}>
      <div style={styles.layout}>
        <main style={styles.mainContent}>
          <ArticleHeader
            article={article}
            isLiked={isLiked}
            likeCount={currentLikeCount}
            onLike={handleLike}
            isBookmarked={isBookmarked}
            onBookmark={handleFavorite}
          />
          {author && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <AuthorCard
                  author={author}
                  articleCount={authorArticleCount}
                  totalReads={authorTotalReads}
                  articleId={article.id || id}
                  followerCount={followerCount}
                  isInitiallyFollowed={isFollowed}
                />
              </div>
              <div style={{
                padding: '20px',
                background: '#FFF',
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}>
                <CoffeeButton
                  receiverId={author.id || parseInt(id || '1')}
                  receiverName={author.name || authorName}
                  receiverAvatar={author.avatar}
                  contentType="article"
                  contentId={parseInt(article.id || id || '0')}
                  size="medium"
                  variant="primary"
                  onSuccess={(tipId) => {
                    console.log('打赏成功:', tipId);
                  }}
                  onError={(error) => {
                    console.error('打赏失败:', error);
                  }}
                />
              </div>
            </div>
          )}
          <ArticleContent content={article.content} article={article} />
          <AgentTimeline articleId={article.id || id} />
          <CommentSection comments={comments} onAddComment={handleAddComment} />
        </main>

        <aside className="detail-sidebar" style={styles.sidebar}>
          <TableOfContents content={article.content} />
          <RelatedArticles
            articles={article?.related_articles || []}
            currentArticleId={article.id}
            currentCategoryId={article.category?.id || article.categoryId}
          />
        </aside>
      </div>
    </div>
  );
};

const NotFound: React.FC = () => (
  <div style={notFoundStyles.container}>
    <div style={notFoundStyles.content}>
      <h1 style={notFoundStyles.title}>404</h1>
      <p style={notFoundStyles.message}>文章未找到</p>
      <p style={notFoundStyles.description}>
        抱歉，您访问的文章不存在或已被删除。
      </p>
      <a href="/" style={notFoundStyles.link}>
        返回首页
      </a>
    </div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1400',
    margin: '0 auto',
    padding: '32px 24px',
    minHeight: 'calc(100vh - 200px)',
  },
  layout: {
    display: 'flex',
    gap: '32px',
    alignItems: 'flex-start',
  },
  mainContent: {
    flex: 1,
    minWidth: 0,
    maxWidth: '800px',
  },
  sidebar: {
    width: '380px',
    flexShrink: 0,
    position: 'sticky' as const,
    top: '80px',
    alignSelf: 'flex-start',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
};

const notFoundStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    padding: '40px 24px',
  },
  content: {
    textAlign: 'center' as const,
  },
  title: {
    fontSize: '120px',
    fontWeight: 700,
    color: '#E2E8F0',
    margin: '0',
    lineHeight: 1,
  },
  message: {
    fontSize: '28px',
    fontWeight: 600,
    color: '#0F172A',
    margin: '20px 0 12px 0',
  },
  description: {
    fontSize: '16px',
    color: '#64748B',
    margin: '0 0 24px 0',
  },
  link: {
    display: 'inline-block',
    padding: '12px 28px',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    textDecoration: 'none',
    borderRadius: 6,
    fontWeight: 500,
    transition: 'background-color 0.2s',
  },
};

export default Detail;

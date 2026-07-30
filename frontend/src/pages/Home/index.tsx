import { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Button, Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import FilterBar from './components/FilterBar';
import BannerCarousel from './components/BannerCarousel';
import HotRanking from './components/HotRanking';
const ArticleGrid = lazy(() => import('./components/ArticleGrid'));
const AgentRoles = lazy(() => import('./components/AgentRoles'));
const AgentAssistant = lazy(() => import('./components/AgentAssistant'));
const PromoCardFeed = lazy(() => import('./components/PromoCardFeed'));
const HotSkillsCarousel = lazy(() => import('./components/HotSkillsCarousel'));
const PaymentModal = lazy(() => import('@/components/PaymentModal'));
const AffiliateCenter = lazy(() => import('@/components/AffiliateCenter'));
const MallProductSection = lazy(() => import('./components/MallProductSection'));
const FunctionCardsSection = lazy(() => import('./components/FunctionCardsSection'));
const DigitalProductSection = lazy(() => import('@/components/DigitalProductSection'));
const ArticleEditor = lazy(() => import('@/components/ArticleEditor'));
import FirstOrderPromoBanner from '@/components/FirstOrderPromoBanner';
import { getArticles, getHotArticles } from '@/api/frontApi';
import type { Article } from '@/types/article';

const STYLES = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#F5F7FA',
  },
  container: {
    maxWidth: 1440,
    margin: '0 auto',
    padding: 24,
    boxSizing: 'border-box' as const,
  },
  heroArea: {
    display: 'flex',
    gap: 20,
    alignItems: 'start',
    marginBottom: 20,
  },
  heroBanner: {
    flex: '2',
    minWidth: 0,
  },
  heroHot: {
    flex: '1',
    minWidth: 0,
    position: 'sticky' as const,
    top: 96,
  },
} as const;

const LoadingFallback = () => (
  <div style={{ textAlign: 'center', padding: 40, color: '#86909C' }}>
    加载中...
  </div>
);

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | number | null>(null);
  const [activeXinfaTag, setActiveXinfaTag] = useState<string | null>(null);
  const [sortValue, setSortValue] = useState('-publish_time');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [feedSortMode, setFeedSortMode] = useState('featured');
  const [feedActiveZone, setFeedActiveZone] = useState('all');
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [hotArticles, setHotArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantRoleId, setAssistantRoleId] = useState<string>('auditor');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [affiliateOpen, setAffiliateOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const searchDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleOpenAffiliate = () => setAffiliateOpen(true);
    window.addEventListener('open-affiliate-center', handleOpenAffiliate);
    return () => window.removeEventListener('open-affiliate-center', handleOpenAffiliate);
  }, []);

  const loadArticles = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (pageNum === 1) setLoading(true);
    try {
      const res: any = await getArticles({
        category: selectedCategory ?? undefined,
        sort: sortValue as any,
        search: searchKeyword || undefined,
        xinfaTag: activeXinfaTag || undefined,
        page: pageNum,
        page_size: 12,
      });
      const raw = res?.data || res;
      const results = Array.isArray(raw) ? raw : (raw?.results || raw?.data || []);
      setArticles(prev => append ? [...prev, ...results] : results);
      const totalCount = res?.count || raw?.count || results.length;
      setHasMore(results.length > 0 && results.length >= 12);
    } catch (err) {
      console.error('加载文章失败:', err);
      if (!append) setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, sortValue, searchKeyword, activeXinfaTag]);

  useEffect(() => {
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }
    searchDebounceTimer.current = setTimeout(() => {
      setPage(1);
      loadArticles(1, false);
    }, 300);
    return () => {
      if (searchDebounceTimer.current) {
        clearTimeout(searchDebounceTimer.current);
      }
    };
  }, [selectedCategory, sortValue, searchKeyword]);

  useEffect(() => {
    getHotArticles().then((res: any) => {
      const raw = res?.data || res;
      setHotArticles(Array.isArray(raw) ? raw : (raw?.results || []));
    }).catch(() => setHotArticles([]));
  }, []);

  const handleRefreshHotArticles = useCallback(async () => {
    try {
      const res: any = await getHotArticles();
      const raw = res?.data || res;
      setHotArticles(Array.isArray(raw) ? raw : (raw?.results || []));
    } catch (err) {
      console.error('刷新热点文章失败:', err);
    }
  }, []);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadArticles(nextPage, true);
  };

  return (
    <>
      <div style={STYLES.page}>
        <div className="home-container" style={STYLES.container}>
          <FirstOrderPromoBanner onClaimed={() => setPaymentOpen(true)} />

          <FilterBar
                selectedCategory={selectedCategory}
                onSelectCategory={(id) => { setSelectedCategory(id); setActiveXinfaTag(null); }}
                sortValue={sortValue}
                onSortChange={(val) => setSortValue(val)}
                onSearch={(keyword) => setSearchKeyword(keyword)}
                activeXinfaTag={activeXinfaTag}
                onXinfaTagChange={(tagId) => {
                  setActiveXinfaTag(tagId === activeXinfaTag ? null : tagId);
                  setSelectedCategory(null);
                }}
              />

              {/* 上段：轮播图(左2/3) + 热点榜(右1/3, sticky吸顶) */}
              <div className="home-hero-area" style={STYLES.heroArea}>
                <div className="home-hero-banner" style={STYLES.heroBanner}>
                  <BannerCarousel articles={articles} />
                </div>
                <div className="home-hero-hot" style={STYLES.heroHot}>
                  <HotRanking articles={hotArticles} onRefreshRequest={handleRefreshHotArticles} />
                </div>
              </div>

              {/* 数字商品专区：入门好物 */}
              <Suspense fallback={<LoadingFallback />}>
                <DigitalProductSection />
              </Suspense>

              {/* 安全功能中心：4个分类卡片 */}
              <Suspense fallback={<LoadingFallback />}>
                <FunctionCardsSection />
              </Suspense>

              {/* 热度轮播: Top9技能 3秒自动切换 */}
              <Suspense fallback={<LoadingFallback />}>
                <HotSkillsCarousel onSkillClick={() => setPaymentOpen(true)} />
              </Suspense>

              {/* 下段：信息流卡片，每行3个 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1D2129' }}>信息流</h2>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setEditorOpen(true)}
                  style={{
                    borderRadius: 8,
                    height: 40,
                    paddingLeft: 20,
                    paddingRight: 20,
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(22,93,255,0.3)',
                  }}
                >
                  发布内容（上传封面）
                </Button>
              </div>
              <Suspense fallback={<LoadingFallback />}>
                <ArticleGrid
                  articles={articles}
                  loading={loading}
                  hasMore={hasMore}
                  onLoadMore={handleLoadMore}
                  sortMode={feedSortMode}
                  onSortChange={setFeedSortMode}
                  activeZone={feedActiveZone}
                  onZoneChange={setFeedActiveZone}
                />
              </Suspense>

              {/* 会员推广卡片 - 信息流穿插 */}
              <Suspense fallback={<LoadingFallback />}>
                <PromoCardFeed position="feed_middle" maxCards={2} style={{ marginTop: 16, marginBottom: 8 }} />
              </Suspense>

              {/* 数字商城 · 热门产品推荐 */}
              <Suspense fallback={<LoadingFallback />}>
                <MallProductSection />
              </Suspense>

              {/* 四角色Agent展示面板 */}
              <Suspense fallback={<LoadingFallback />}>
                <AgentRoles onOpenAssistant={(roleId) => { setAssistantRoleId(roleId); setAssistantOpen(true); }} />
              </Suspense>

              {/* 智能助手弹窗 */}
              <Suspense fallback={null}>
                <AgentAssistant
                  open={assistantOpen}
                  onClose={() => setAssistantOpen(false)}
                  initialRoleId={assistantRoleId}
                />
              </Suspense>

              {/* 付费弹窗 */}
              <Suspense fallback={null}>
                <PaymentModal
                  visible={paymentOpen}
                  onClose={() => setPaymentOpen(false)}
                  onPaymentSuccess={() => {
                    console.log('支付成功回调');
                  }}
                />
              </Suspense>

              {/* 分销中心 */}
              <Suspense fallback={null}>
                <AffiliateCenter
                  visible={affiliateOpen}
                  onClose={() => setAffiliateOpen(false)}
                />
              </Suspense>

              {/* 发布内容编辑器（含封面图/多图上传） */}
              <Suspense fallback={null}>
                <ArticleEditor
                  open={editorOpen}
                  articleId={null}
                  onClose={() => setEditorOpen(false)}
                  onSuccess={() => {
                    setEditorOpen(false);
                    loadArticles(1, false);
                  }}
                />
              </Suspense>
        </div>
      </div>
    </>
  );
};

export default Home;

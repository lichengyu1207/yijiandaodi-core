import { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Button, Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import LogoAnimation from '@/components/LogoAnimation';
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
  const [showLogoAnimation, setShowLogoAnimation] = useState(true);
  const searchDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Logo动画显示5秒后自动隐藏
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLogoAnimation(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

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
      console.error('Failed to load articles:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, sortValue, searchKeyword, activeXinfaTag]);

  const loadHotArticles = useCallback(async () => {
    try {
      const res: any = await getHotArticles({ limit: 10 });
      const raw = res?.data || res;
      setHotArticles(Array.isArray(raw) ? raw : (raw?.results || raw?.data || []));
    } catch (err) {
      console.error('Failed to load hot articles:', err);
    }
  }, []);

  useEffect(() => {
    loadArticles(1);
    loadHotArticles();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadArticles(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedCategory, sortValue, searchKeyword, activeXinfaTag]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadArticles(nextPage, true);
    }
  }, [loading, hasMore, page, loadArticles]);

  return (
    <div style={STYLES.page}>
      {/* Logo动画 - 自动播放5秒后消失 */}
      {showLogoAnimation && <LogoAnimation />}
      
      {/* 主要内容 */}
      <div style={STYLES.container}>
        <FirstOrderPromoBanner />
        
        <div style={STYLES.heroArea}>
          <div style={STYLES.heroBanner}>
            <BannerCarousel />
          </div>
          <div style={STYLES.heroHot}>
            <HotRanking />
          </div>
        </div>

        <FunctionCardsSection />

        <Suspense fallback={<LoadingFallback />}>
          <AgentRoles />
        </Suspense>

        <FilterBar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          sortValue={sortValue}
          onSortChange={setSortValue}
          searchKeyword={searchKeyword}
          onSearchChange={setSearchKeyword}
          activeXinfaTag={activeXinfaTag}
          onXinfaTagChange={setActiveXinfaTag}
        />

        <Suspense fallback={<LoadingFallback />}>
          <ArticleGrid
            articles={articles}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
          />
        </Suspense>

        <Suspense fallback={<LoadingFallback />}>
          <PromoCardFeed
            sortMode={feedSortMode}
            activeZone={feedActiveZone}
            onSortModeChange={setFeedSortMode}
            onZoneChange={setFeedActiveZone}
          />
        </Suspense>

        <Suspense fallback={<LoadingFallback />}>
          <HotSkillsCarousel />
        </Suspense>

        <Suspense fallback={<LoadingFallback />}>
          <MallProductSection />
        </Suspense>

        <Suspense fallback={<LoadingFallback />}>
          <DigitalProductSection />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        {assistantOpen && (
          <AgentAssistant
            roleId={assistantRoleId}
            onClose={() => setAssistantOpen(false)}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {paymentOpen && (
          <PaymentModal onClose={() => setPaymentOpen(false)} />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {affiliateOpen && (
          <AffiliateCenter onClose={() => setAffiliateOpen(false)} />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {editorOpen && (
          <ArticleEditor onClose={() => setEditorOpen(false)} />
        )}
      </Suspense>
    </div>
  );
};

export default Home;
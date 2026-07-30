import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Input, Select, Button, Card, Tag, Image, Pagination, Empty,
  Row, Col, Tabs, Spin, Badge, message
} from 'antd';
import {
  SearchOutlined, AppstoreOutlined, UnorderedListOutlined,
  FireOutlined, ShoppingCartOutlined
} from '@ant-design/icons';
import { mallApi, type ProductItem } from '@/api/mallApi';

const { Search } = Input;

function safeTags(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
    catch { return raw.split(',').map((s) => s.trim()).filter(Boolean); }
  }
  return [];
}

const DEFAULT_COVER = '/media/yi.jpg';

const STYLES = {
  page: { minHeight: '100vh', backgroundColor: '#F5F7FA', paddingBottom: 60 },
  container: { maxWidth: 1200, margin: '0 auto', padding: '20px 24px', boxSizing: 'border-box' as const },
  searchBar: {
    display: 'flex', gap: 12, alignItems: 'center',
    marginBottom: 20, flexWrap: 'wrap' as const,
    padding: '16px 20px', background: '#fff', borderRadius: 6,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  hotSection: { marginBottom: 20 },
  hotScroll: {
    display: 'flex', gap: 14, overflowX: 'auto' as const, paddingBottom: 10,
    scrollbarWidth: 'none' as const,
  },
  hotCard: {
    width: 200, flexShrink: 0, borderRadius: 6, overflow: 'hidden' as const,
    cursor: 'pointer', transition: 'all 0.25s ease',
  },
  categoryTabs: { marginBottom: 16 },
  productGrid: {
    display: 'grid', gap: 20,
    gridTemplateColumns: 'repeat(3, 1fr)',
  },
  productListMode: { display: 'flex', flexDirection: 'column' as const, gap: 14 },
  productCard: {
    cursor: 'pointer', transition: 'all 0.25s ease', borderRadius: 6,
    overflow: 'hidden' as const, background: '#fff',
  },
  coverImg: { width: '100%', height: 200, objectFit: 'cover' as const, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  infoArea: { padding: 14 },
  titleText: { fontSize: 15, fontWeight: 600, color: '#1E293B', marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', lineHeight: 1.4 },
  tagRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginBottom: 8 },
  priceArea: { display: 'flex', alignItems: 'baseline', gap: 8 },
  currentPrice: { fontSize: 22, fontWeight: 700, color: '#F5222D' },
  originalPrice: { fontSize: 13, color: '#86909C', textDecoration: 'line-through' },
  statsRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  hotBadge: { position: 'absolute' as const, top: 8, left: 8, zIndex: 2 },
  paginationWrap: { display: 'flex', justifyContent: 'center', marginTop: 32, paddingTop: 20 },
  listModeItem: {
    display: 'flex', gap: 16, padding: 16, cursor: 'pointer',
    transition: 'all 0.25s ease', borderRadius: 6, background: '#fff',
    border: '1px solid #E2E8F0',
  },
  listThumb: { width: 160, height: 120, objectFit: 'cover' as const, borderRadius: 6, flexShrink: 0 },
  listInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between' },
} as const;

const CATEGORY_OPTIONS = [
  { label: '全部分类', value: '' },
  { label: '模板', value: 'template' },
  { label: '工具', value: 'tool' },
  { label: '课程', value: 'course' },
  { label: '素材', value: 'material' },
];

const SORT_OPTIONS = [
  { label: '最新上架', value: '-created_at' },
  { label: '最热销量', value: '-sales_count' },
  { label: '价格升序', value: 'price' },
  { label: '价格降序', value: '-price' },
];

const ProductList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [sort, setSort] = useState('-created_at');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('all');

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [hotProducts, setHotProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(12);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: pageSize, ordering: sort };
      if (keyword) params.search = keyword;
      if (activeTab !== 'all') params.category = activeTab;
      if (category && !params.category) params.category = category;
      const res: any = await mallApi.getProducts(params);
      const list = res?.results || res?.data || res || [];
      setProducts(list);
      setTotal(res?.count || list.length);
    } catch (err) {
      console.error('加载产品列表失败:', err);
      message.error('加载产品失败');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, keyword, sort, activeTab, category, pageSize]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    mallApi.getHotProducts().then((res: any) => {
      setHotProducts(res?.results || res?.data || res || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    mallApi.getCategories().then((res: any) => {
      const cats = res?.results || res?.data || res || [];
      if (Array.isArray(cats)) setCategories(cats.map((c: any) => {
        if (typeof c === 'string') return c;
        return c.category_name || c.category || c.name || c.label || String(c.category || '');
      }));
    }).catch(() => {});
  }, []);

  const handleSearch = (val: string) => {
    setKeyword(val);
    setPage(1);
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setPage(1);
  };

  const goToProduct = (id: number) => {
    navigate('/mall/product/' + id);
  };

  const addToCart = (e: React.MouseEvent, item: ProductItem) => {
    e.stopPropagation();
    const cart = JSON.parse(localStorage.getItem('mall_cart') || '[]');
    const existIdx = cart.findIndex((c: any) => c.product_id === item.id);
    if (existIdx >= 0) {
      cart[existIdx].quantity += 1;
    } else {
      cart.push({
        product_id: item.id,
        title: item.title,
        price: item.price,
        cover_image: item.cover_image,
        quantity: 1,
      });
    }
    localStorage.setItem('mall_cart', JSON.stringify(cart));
    message.success('已加入购物车');
  };

  const allTabs = [{ key: 'all', label: '全部' }, ...categories.map(c => ({ key: c, label: c }))];

  return (
    <div style={STYLES.page}>
      <div style={STYLES.container}>
        <div style={STYLES.searchBar}>
          <Search
            placeholder="搜索产品名称、关键词..."
            allowClear
            onSearch={handleSearch}
            onChange={(e) => { if (!e.target.value) { setKeyword(''); setPage(1); }}}
            style={{ width: 280 }}
            enterButton={<Button icon={<SearchOutlined />}>搜索</Button>}
          />
          <Select
            value={category}
            onChange={(v) => { setCategory(v); setPage(1); }}
            options={CATEGORY_OPTIONS}
            style={{ width: 140 }}
            placeholder="分类"
          />
          <Select
            value={sort}
            onChange={(v) => { setSort(v); setPage(1); }}
            options={SORT_OPTIONS}
            style={{ width: 140 }}
            placeholder="排序"
          />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <Button
              type={viewMode === 'grid' ? 'primary' : 'default'}
              icon={<AppstoreOutlined />}
              onClick={() => setViewMode('grid')}
            />
            <Button
              type={viewMode === 'list' ? 'primary' : 'default'}
              icon={<UnorderedListOutlined />}
              onClick={() => setViewMode('list')}
            />
          </div>
        </div>

        {hotProducts.length > 0 && (
          <div style={STYLES.hotSection}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <FireOutlined style={{ color: '#F5222D', fontSize: 18 }} />
              <span style={{ fontWeight: 700, fontSize: 17, color: '#1D2129' }}>爆款推荐</span>
            </div>
            <div style={STYLES.hotScroll}>
              {hotProducts.slice(0, 10).map((item) => (
                <Card
                  key={item.id}
                  hoverable
                  style={STYLES.hotCard}
                  cover={
                    <div style={{ position: 'relative' }}>
                      {item.is_hot && (
                        <Badge.Ribbon text="爆" color="#F5222D" style={STYLES.hotBadge} />
                      )}
                      <Image
                        alt={item.title}
                        src={item.cover_image || DEFAULT_COVER}
                        preview={false}
                        fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='130'%3E%3Crect fill='%23E2E8F0' width='200' height='130'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394A3B8' font-size='14'%3E暂无图片%3C/text%3E%3C/svg%3E"
                        style={{ width: '100%', height: 130, objectFit: 'cover' }}
                      />
                    </div>
                  }
                  onClick={() => goToProduct(item.id)}
                >
                  <div style={{ padding: '4px 0' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </div>
                    <div style={STYLES.priceArea}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#F5222D' }}>¥{item.price}</span>
                      {item.original_price > item.price && (
                        <span style={STYLES.originalPrice}>¥{item.original_price}</span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={allTabs}
          style={STYLES.categoryTabs}
          size="large"
        />

        <Spin spinning={loading}>
          {products.length === 0 && !loading ? (
            <Empty description="暂无相关产品" style={{ padding: '80px 0' }}>
              <Button type="primary" onClick={() => { setKeyword(''); setCategory(''); setActiveTab('all'); setPage(1); }}>
                重置筛选
              </Button>
            </Empty>
          ) : viewMode === 'grid' ? (
            <div style={STYLES.productGrid} className="product-grid-responsive">
              {products.map((item) => (
                <Card
                  key={item.id}
                  hoverable
                  style={STYLES.productCard}
                  onMouseEnter={(e: React.MouseEvent) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e: React.MouseEvent) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  onClick={() => goToProduct(item.id)}
                  styles={{ body: { padding: 0 } }}
                >
                  <div style={{ position: 'relative' }}>
                    {item.is_hot && (
                      <Badge.Ribbon text="爆" color="#F5222D" style={STYLES.hotBadge} />
                    )}
                    <Image
                      alt={item.title}
                      src={item.cover_image || DEFAULT_COVER}
                      preview={false}
                      fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='260'%3E%3Crect fill='%23E2E8F0' width='400' height='260'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394A3B8' font-size='16'%3E暂无图片%3C/text%3E%3C/svg%3E"
                      style={STYLES.coverImg}
                    />
                  </div>
                  <div style={STYLES.infoArea}>
                    <div style={STYLES.titleText}>{item.title}</div>
                    <div style={STYLES.tagRow}>
                      {safeTags(item.tags).slice(0, 3).map((tag) => (
                        <Tag key={tag} color="blue" style={{ fontSize: 11, marginRight: 0 }}>{tag}</Tag>
                      ))}
                    </div>
                    <div style={STYLES.priceArea}>
                      <span style={STYLES.currentPrice}>¥{item.price}</span>
                      {item.original_price > item.price && (
                        <span style={STYLES.originalPrice}>¥{item.original_price}</span>
                      )}
                    </div>
                    <div style={STYLES.statsRow}>
                      <span style={{ fontSize: 12, color: '#94A3B8' }}>
                        已售 {item.sales_count}
                      </span>
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        icon={<ShoppingCartOutlined />}
                        onClick={(e) => addToCart(e, item)}
                        style={{ borderRadius: 6 }}
                      >
                        加购
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div style={STYLES.productListMode}>
              {products.map((item) => (
                <div
                  key={item.id}
                  style={STYLES.listModeItem}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                  onClick={() => goToProduct(item.id)}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {item.is_hot && (
                      <Badge.Ribbon text="爆" color="#F5222D" style={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }} />
                    )}
                    <Image
                      alt={item.title}
                      src={item.cover_image || DEFAULT_COVER}
                      preview={false}
                      fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='120'%3E%3Crect fill='%23E5E6EB' width='160' height='120'/%3E%3C/svg%3E"
                      style={STYLES.listThumb}
                    />
                  </div>
                  <div style={STYLES.listInfo}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#1E293B', marginBottom: 6 }}>{item.title}</div>
                      <div style={STYLES.tagRow}>{safeTags(item.tags).slice(0, 4).map((t) => <Tag key={t} color="blue" style={{ fontSize: 11, marginRight: 0 }}>{t}</Tag>)}</div>
                      <div style={{ fontSize: 13, color: '#64748B', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                        {item.description || '暂无描述'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={STYLES.priceArea}>
                        <span style={STYLES.currentPrice}>¥{item.price}</span>
                        {item.original_price > item.price && <span style={STYLES.originalPrice}>¥{item.original_price}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#86909C' }}>已售{item.sales_count}</span>
                        <Button size="small" ghost type="primary" icon={<ShoppingCartOutlined />} onClick={(e) => addToCart(e, item)} style={{ borderRadius: 6 }}>加购</Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Spin>

        {total > pageSize && (
          <div style={STYLES.paginationWrap}>
            <Pagination
              current={page}
              total={total}
              pageSize={pageSize}
              onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              showSizeChanger={false}
              showQuickJumper
              showTotal={(t) => '共 ' + t + ' 个产品'}
            />
          </div>
        )}
      </div>

      <style>{`
        .ant-tabs-nav { margin-bottom: 16px !important; }
        @media (max-width: 768px) {
          .product-grid-responsive { grid-template-columns: repeat(2, 1fr) !important; gap: 12px; }
        }
        @media (max-width: 480px) {
          .product-grid-responsive { grid-template-columns: 1fr !important; gap: 12px; }
        }
      `}</style>
    </div>
  );
};

export default ProductList;

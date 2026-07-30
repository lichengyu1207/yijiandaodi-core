import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Carousel, Card, Tag, Button, Row, Col, Typography } from 'antd';
import {
  FireOutlined,
  AppstoreOutlined,
  ToolOutlined,
  ReadOutlined,
  PictureOutlined,
  RightOutlined,
  ShoppingOutlined,
  ThunderboltOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { mallApi, type ProductItem } from '@/api/mallApi';

const { Title, Text } = Typography;

const STYLES = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#F5F7FA',
    paddingBottom: 60,
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '20px 24px',
    boxSizing: 'border-box' as const,
  },
  bannerSection: {
    marginBottom: 32,
  },
  bannerCard: {
    height: 280,
    borderRadius: 6,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  bannerContent: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#1D2129',
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  hotScrollArea: {
    display: 'flex',
    gap: 16,
    overflowX: 'auto' as const,
    paddingBottom: 12,
    scrollbarWidth: 'none' as const,
    msOverflowStyle: 'none' as const,
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 32,
  },
  categoryCard: {
    textAlign: 'center' as const,
    padding: '28px 16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: '#fff',
    border: '1px solid #E5E6EB',
    borderRadius: 6,
  },
  categoryIcon: {
    fontSize: 36,
    marginBottom: 12,
    color: '#165DFF',
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 20,
    marginBottom: 24,
  },
  productCard: {
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    borderRadius: 6,
    overflow: 'hidden' as const,
  },
  productImage: {
    width: '100%',
    height: 180,
    objectFit: 'cover' as const,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  productInfo: {
    padding: 14,
  },
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
  },
  currentPrice: {
    fontSize: 20,
    fontWeight: 700,
    color: '#F5222D',
  },
  originalPrice: {
    fontSize: 13,
    color: '#86909C',
    textDecoration: 'line-through',
  },
  moreLink: {
    textAlign: 'center' as const,
    paddingTop: 10,
  },
} as const;

const BANNERS = [
  {
    bg: '#165DFF',
    title: '新用户专享',
    subtitle: '首单立减20% · 限时优惠',
    tag: '限时特惠',
  },
  {
    bg: '#0E42D2',
    title: '爆款模板',
    subtitle: '精选优质模板 · 一键复用',
    tag: '热门推荐',
  },
  {
    bg: '#4080FF',
    title: '企业套餐',
    subtitle: '团队协作 · 高效赋能',
    tag: '企业优选',
  },
];

const CATEGORIES = [
  { key: 'template', label: '模板', icon: <AppstoreOutlined />, color: '#1890FF', desc: '精选模板资源' },
  { key: 'tool', label: '工具', icon: <ToolOutlined />, color: '#52C41A', desc: '效率提升工具' },
  { key: 'course', label: '课程', icon: <ReadOutlined />, color: '#FAAD14', desc: '专业培训课程' },
  { key: 'material', label: '素材', icon: <PictureOutlined />, color: '#EB2F96', desc: '设计素材库' },
];

const DEFAULT_COVER = '/media/yi.jpg';

function safeTags(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
    catch { return raw.split(',').map((s) => s.trim()).filter(Boolean); }
  }
  return [];
}

const MallIndex: React.FC = () => {
  const navigate = useNavigate();
  const [hotProducts, setHotProducts] = useState<ProductItem[]>([]);
  const [latestProducts, setLatestProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [hotRes, latestRes]: any[] = await Promise.all([
          mallApi.getHotProducts(),
          mallApi.getProducts({ page: 1, page_size: 4, ordering: '-created_at' }),
        ]);
        const hotList = hotRes?.results || hotRes?.data || hotRes || [];
        setHotProducts(hotList);
        const latestList = latestRes?.results || latestRes?.data || latestRes || [];
        setLatestProducts(latestList);
      } catch (err) {
        console.error('加载商城数据失败:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const goToProduct = (id: number) => {
    navigate('/mall/product/' + id);
  };

  const goToList = (category?: string) => {
    if (category) {
      navigate('/mall/products?category=' + category);
    } else {
      navigate('/mall/products');
    }
  };

  return (
    <div style={STYLES.page}>
      <div className="mall-container" style={STYLES.container}>
        {/* Banner 轮播 */}
        <div style={STYLES.bannerSection}>
          <Carousel autoplay dots={{ className: 'mall-banner-dots' }} effect="fade">
            {BANNERS.map((b, i) => (
              <div key={i}>
                <div
                  style={{
                    ...STYLES.bannerCard,
                    background: b.bg,
                  }}
                >
                  <div style={STYLES.bannerContent}>
                    <Tag color="red" style={{ fontSize: 13, marginBottom: 12 }}>
                      {b.tag}
                    </Tag>
                    <Title level={2} style={{ color: '#fff', margin: 0, marginBottom: 8 }}>
                      {b.title}
                    </Title>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16 }}>
                      {b.subtitle}
                    </Text>
                  </div>
                </div>
              </div>
            ))}
          </Carousel>
        </div>

        {/* 爆款推荐区 */}
        <div style={{ ...STYLES.sectionTitle, marginBottom: 16 }}>
          <FireOutlined style={{ color: '#F5222D' }} />
          <span>爆款推荐</span>
        </div>
        <div style={STYLES.hotScrollArea}>
          {hotProducts.length > 0 ? (
            hotProducts.slice(0, 8).map((item) => (
              <Card
                key={item.id}
                hoverable
                style={{
                  width: 220,
                  flexShrink: 0,
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
                cover={
                  <img
                    alt={item.title}
                    src={item.cover_image || DEFAULT_COVER}
                    style={{ height: 130, objectFit: 'cover' }}
                    onClick={() => goToProduct(item.id)}
                  />
                }
                onClick={() => goToProduct(item.id)}
              >
                <div style={{ padding: '4px 0' }}>
                  <Text strong ellipsis={{ tooltip: item.title }} style={{ fontSize: 14, display: 'block' }}>
                    {item.title}
                  </Text>
                  <div style={STYLES.priceRow}>
                    <span style={STYLES.currentPrice}>¥{item.price}</span>
                    {item.original_price > item.price && (
                      <span style={STYLES.originalPrice}>¥{item.original_price}</span>
                    )}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Text type="secondary">暂无爆款产品</Text>
          )}
        </div>

        {/* 分类快捷入口 */}
        <div style={{ ...STYLES.sectionTitle, marginTop: 32, marginBottom: 16 }}>
          <AppstoreOutlined style={{ color: '#1890FF' }} />
          <span>分类导航</span>
        </div>
        <div className="mall-category-grid" style={STYLES.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <div
              key={cat.key}
              style={{
                ...STYLES.categoryCard,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              onClick={() => goToList(cat.key)}
            >
              <div style={{ ...STYLES.categoryIcon, color: cat.color }}>{cat.icon}</div>
              <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>
                {cat.label}
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>{cat.desc}</Text>
            </div>
          ))}
        </div>

        {/* 最新上架 */}
        <div style={{ ...STYLES.sectionTitle, marginBottom: 16 }}>
          <ThunderboltOutlined style={{ color: '#FAAD14' }} />
          <span>最新上架</span>
        </div>
        <Row gutter={[20, 20]}>
          {latestProducts.map((item) => (
            <Col xs={12} sm={12} md={6} lg={6} key={item.id}>
              <Card
                hoverable
                style={STYLES.productCard}
                cover={
                  <img
                    alt={item.title}
                    src={item.cover_image || DEFAULT_COVER}
                    style={STYLES.productImage}
                    onClick={() => goToProduct(item.id)}
                  />
                }
                onClick={() => goToProduct(item.id)}
              >
                <div style={STYLES.productInfo}>
                  <Text strong ellipsis={{ tooltip: item.title }} style={{ fontSize: 14, display: 'block' }}>
                    {item.title}
                  </Text>
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {safeTags(item.tags).slice(0, 2).map((tag) => (
                      <Tag key={tag} color="blue" style={{ fontSize: 11, marginRight: 0 }}>
                        {tag}
                      </Tag>
                    ))}
                  </div>
                  <div style={STYLES.priceRow}>
                    <span style={STYLES.currentPrice}>¥{item.price}</span>
                    {item.original_price > item.price && (
                      <span style={STYLES.originalPrice}>¥{item.original_price}</span>
                    )}
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
                      已售{item.sales_count}
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {/* 浏览更多 */}
        <div style={STYLES.moreLink}>
          <Button
            type="link"
            size="large"
            icon={<RightOutlined />}
            onClick={() => goToList()}
            style={{ fontSize: 15 }}
          >
            浏览全部产品
          </Button>
        </div>
      </div>

      <style>{`
        .mall-banner-dots li button {
          background: rgba(255,255,255,0.5) !important;
          width: 8px;
          height: 8px;
          border-radius: 4px;
        }
        .mall-banner-dots li.ant-carousel-dot-active button {
          background: #fff !important;
          width: 24px;
        }
        @media (max-width: 991px) {
          .mall-category-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .mall-product-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 767px) {
          .mall-category-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .mall-product-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default MallIndex;

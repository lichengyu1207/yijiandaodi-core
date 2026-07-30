import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Breadcrumb, Image, Button, Tag, Tabs, Card, Row, Col,
  Spin, Empty, message, Typography, Space
} from 'antd';
import {
  ShoppingCartOutlined, HeartOutlined, ShareAltOutlined,
  ArrowLeftOutlined, EyeOutlined, ShoppingOutlined,
  CheckCircleOutlined, WarningOutlined
} from '@ant-design/icons';
import { mallApi, type ProductItem } from '@/api/mallApi';

const { Title, Paragraph, Text } = Typography;

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
  page: { minHeight: '100vh', backgroundColor: '#F5F7FA', paddingTop: 0, paddingLeft: 0, paddingRight: 0, paddingBottom: 60 },
  container: { maxWidth: 1100, margin: '0 auto', paddingTop: 20, paddingLeft: 24, paddingRight: 24, paddingBottom: 20, boxSizing: 'border-box' as const },
  breadcrumb: { marginBottom: 24 },
  mainArea: {
    display: 'flex',
    flexDirection: 'row',
    gap: 32,
    background: '#fff',
    padding: 28,
    borderRadius: 6,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    marginBottom: 28,
  },
  imageSection: { flex: '1 1 480px', minWidth: 0 },
  mainImageWrap: {
    width: '100%',
    height: 400,
    borderRadius: 6,
    overflow: 'hidden' as const,
    marginBottom: 14,
    border: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  mainImage: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' as const },
  thumbRow: { display: 'flex', gap: 10, overflowX: 'auto' as const, scrollbarWidth: 'none' as const, msOverflowStyle: 'none' as const },
  thumbItem: {
    width: 72, height: 54, borderRadius: 4, overflow: 'hidden' as const,
    cursor: 'pointer', flexShrink: 0, border: '2px solid transparent',
    transition: 'border-color 0.2s',
  },
  thumbActive: { borderColor: '#165DFF' },
  infoSection: { flex: '1 1 420px', minWidth: 0 },
  productTitle: {
    fontSize: 24, fontWeight: 700, color: '#1E293B',
    lineHeight: 1.35, marginBottom: 16,
  },
  priceBlock: {
    background: '#FFF7F6', padding: '16px 20px', borderRadius: 6,
    marginBottom: 18, borderLeft: '3px solid #F5222D',
  },
  priceCurrent: { fontSize: 32, fontWeight: 800, color: '#F5222D', marginRight: 12 },
  priceOriginal: { fontSize: 16, color: '#86909C', textDecoration: 'line-through' },
  discountTag: { marginLeft: 12 },
  tagRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 18 },
  statRow: {
    display: 'flex', gap: 24, marginBottom: 18,
    padding: '12px 0', borderTop: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9',
  },
  statItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#64748B' },
  stockInfo: { fontSize: 14, color: '#64748B', marginBottom: 22 },
  actionBtns: { display: 'flex', gap: 12, alignItems: 'center' },
  buyBtn: {
    height: 48, fontSize: 17, fontWeight: 600, borderRadius: 6,
    flex: '1 1 auto',
  },
  cartBtn: { height: 48, fontSize: 15, borderRadius: 6, flex: '0 0 auto' },
  iconBtn: { height: 48, width: 48, borderRadius: 6, flexShrink: 0 },
  tabSection: {
    background: '#fff', borderRadius: 6,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    padding: '20px 28px',
  },
  relatedGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
  },
  relatedCard: { cursor: 'pointer', transition: 'all 0.25s ease', borderRadius: 6, overflow: 'hidden' as const },
  relatedImg: { width: '100%', height: 140, objectFit: 'cover' as const },
  relatedInfo: { padding: 12 },
} as const;

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeThumb, setActiveThumb] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState<ProductItem[]>([]);
  const [activeTab, setActiveTab] = useState('detail');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    mallApi.getProductDetail(id).then((res: any) => {
      const data = res?.data || res;
      if (data) setProduct(data);
      return data;
    }).then((data) => {
      if (data?.category) {
        return mallApi.getProducts({ category: data.category, page_size: 4 });
      }
      return null;
    }).then((res: any) => {
      if (res) {
        const list = res?.results || res?.data || res || [];
        setRelatedProducts(list.filter((p: ProductItem) => p.id !== Number(id)).slice(0, 4));
      }
    }).catch((err) => {
      console.error('加载产品详情失败:', err);
      message.error('加载产品详情失败');
    }).finally(() => { setLoading(false); });
  }, [id]);

  const imageList = (): string[] => {
    if (!product) return [];
    const images: string[] = [];
    if (product.cover_image) images.push(product.cover_image);
    try {
      const extraImages = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
      if (Array.isArray(extraImages)) {
        extraImages.forEach((img: string) => { if (img && !images.includes(img)) images.push(img); });
      }
    } catch { /* ignore */ }
    if (images.length === 0) {
      images.push(DEFAULT_COVER);
    }
    return images;
  };

  const getDiscount = (): number => {
    if (!product || !product.original_price || product.original_price <= product.price) return 0;
    return Math.round((1 - product.price / product.original_price) * 100);
  };

  const handleBuyNow = () => {
    if (!product) return;
    const cart = JSON.parse(localStorage.getItem('mall_cart') || '[]');
    const existIdx = cart.findIndex((c: any) => c.product_id === product.id);
    if (existIdx >= 0) {
      cart[existIdx].quantity += 1;
    } else {
      cart.push({
        product_id: product.id,
        title: product.title,
        price: product.price,
        cover_image: product.cover_image,
        quantity: 1,
      });
    }
    localStorage.setItem('mall_cart', JSON.stringify(cart));
    navigate('/mall/cart');
  };

  const addToCart = () => {
    if (!product) return;
    const cart = JSON.parse(localStorage.getItem('mall_cart') || '[]');
    const existIdx = cart.findIndex((c: any) => c.product_id === product.id);
    if (existIdx >= 0) {
      cart[existIdx].quantity += 1;
    } else {
      cart.push({
        product_id: product.id,
        title: product.title,
        price: product.price,
        cover_image: product.cover_image,
        quantity: 1,
      });
    }
    localStorage.setItem('mall_cart', JSON.stringify(cart));
    message.success('已加入购物车');
  };

  const images = imageList();
  const discount = getDiscount();

  if (loading) {
    return (
      <div style={{ ...STYLES.page, ...STYLES.container, display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!product) {
    return (
      <div style={STYLES.page}>
        <div style={STYLES.container}>
          <Empty description="产品不存在或已下架">
            <Button type="primary" onClick={() => navigate('/mall/products')}>
              返回商城
            </Button>
          </Empty>
        </div>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'detail',
      label: '产品详情',
      children: (
        <div style={{ minHeight: 200 }}>
          <Paragraph style={{ fontSize: 15, lineHeight: 1.85, color: '#334155' }}>
            {product.description || '暂无详细描述信息。'}
          </Paragraph>
          <div style={{ marginTop: 20 }}>
            <Text strong style={{ color: '#1E293B' }}>产品标签：</Text>
            <Space size={6} wrap style={{ marginTop: 8 }}>
              {safeTags(product.tags).map((tag) => <Tag key={tag} color="blue">{tag}</Tag>)}
            </Space>
          </div>
          <div style={{ marginTop: 16 }}>
            <Text strong style={{ color: '#1E293B' }}>分类：</Text>
            <Tag>{product.category_display || product.category}</Tag>
          </div>
          <div style={{ marginTop: 16 }}>
            <Text strong style={{ color: '#1D2129' }}>上架时间：</Text>
            <Text type="secondary">{product.created_at}</Text>
          </div>
        </div>
      ),
    },
    {
      key: 'reviews',
      label: '用户评价',
      children: (
        <Empty description="暂无评价，快来发表第一条评价吧！" style={{ padding: '60px 0' }} />
      ),
    },
    {
      key: 'related',
      label: '相关推荐 (' + relatedProducts.length + ')',
      children:
        relatedProducts.length > 0 ? (
          <div style={STYLES.relatedGrid}>
            {relatedProducts.map((item) => (
              <Card
                key={item.id}
                hoverable
                style={STYLES.relatedCard}
                cover={
                  <img
                    alt={item.title}
                    src={item.cover_image || DEFAULT_COVER}
                    style={STYLES.relatedImg}
                  />
                }
                onClick={() => navigate('/mall/product/' + item.id)}
              >
                <div style={STYLES.relatedInfo}>
                  <Text ellipsis={{ tooltip: item.title }} strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>{item.title}</Text>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#F5222D' }}>¥{item.price}</span>
                  {item.original_price > item.price && (
                    <span style={{ fontSize: 12, color: '#86909C', textDecoration: 'line-through', marginLeft: 6 }}>¥{item.original_price}</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Empty description="暂无相关推荐" />
        ),
    },
  ];

  return (
    <div style={STYLES.page}>
      <div style={STYLES.container}>
        {/* 面包屑 */}
        <Breadcrumb style={STYLES.breadcrumb} items={[
          { title: <a onClick={() => navigate('/')}>首页</a> },
          { title: <a onClick={() => navigate('/mall')}>商城</a> },
          { title: <a onClick={() => navigate('/mall/products')}>{product.category_display || product.category}</a> },
          { title: product.title },
        ]} />

        {/* 主内容区 */}
        <div style={STYLES.mainArea} className="detail-main-area">
          {/* 左侧图片区 */}
          <div style={STYLES.imageSection}>
            <div style={STYLES.mainImageWrap}>
              <Image
                src={images[activeThumb]}
                preview={{
                  src: images[activeThumb],
                  countRender: () => (activeThumb + 1) + ' / ' + images.length,
                }}
                fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23E5E6EB' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2386909C'%3E暂无图片%3C/text%3E%3C/svg%3E"
                style={STYLES.mainImage}
              />
            </div>
            {images.length > 1 && (
              <div style={STYLES.thumbRow}>
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    style={{
                      ...STYLES.thumbItem,
                      ...(idx === activeThumb ? STYLES.thumbActive : {}),
                    }}
                    onClick={() => setActiveThumb(idx)}
                  >
                    <img alt={'缩略图' + (idx + 1)} src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 右侧信息区 */}
          <div style={STYLES.infoSection}>
            <Title level={3} style={STYLES.productTitle}>{product.title}</Title>

            {/* 价格区域 */}
            <div style={STYLES.priceBlock}>
              <span style={STYLES.priceCurrent}>¥{product.price}</span>
              {product.original_price > product.price && (
                <>
                  <span style={STYLES.priceOriginal}>¥{product.original_price}</span>
                  {discount > 0 && (
                    <Tag color="red" style={STYLES.discountTag}>{discount}% OFF</Tag>
                  )}
                </>
              )}
            </div>

            {/* 标签 */}
            <div style={STYLES.tagRow}>
              {safeTags(product.tags).map((tag) => (
                <Tag key={tag} color="blue">{tag}</Tag>
              ))}
              {product.is_hot && <Tag color="red">🔥 爆款</Tag>}
              {product.is_recommend && <Tag color="gold">⭐ 推荐</Tag>}
            </div>

            {/* 统计 */}
            <div style={STYLES.statRow}>
              <div style={STYLES.statItem}><ShoppingOutlined /> 已售 {product.sales_count}</div>
              <div style={STYLES.statItem}><EyeOutlined /> 浏览 {product.view_count}</div>
            </div>

            {/* 库存 */}
            <div style={STYLES.stockInfo}>
              {product.stock > 0 ? (
                <><CheckCircleOutlined style={{ color: '#52C41A', marginRight: 6 }} /><Text type="success">库存充足（{product.stock}件）</Text></>
              ) : (
                <><WarningOutlined style={{ color: '#F5222D', marginRight: 6 }} /><Text type="danger">暂时缺货</Text></>
              )}
            </div>

            {/* 操作按钮 */}
            <div style={STYLES.actionBtns}>
              <Button
                type="primary"
                size="large"
                icon={<ShoppingCartOutlined />}
                style={STYLES.buyBtn}
                disabled={product.status !== 'active'}
                onClick={handleBuyNow}
              >
                立即购买
              </Button>
              <Button
                size="large"
                icon={<ShoppingOutlined />}
                style={STYLES.cartBtn}
                disabled={product.status !== 'active'}
                onClick={addToCart}
              >
                加入购物车
              </Button>
              <Button
                size="large"
                icon={<HeartOutlined />}
                ghost
                style={{ ...STYLES.iconBtn, borderColor: '#FF4D4F', color: '#FF4D4F' }}
                onClick={() => message.success('已收藏')}
              />
              <Button
                size="large"
                icon={<ShareAltOutlined />}
                ghost
                style={STYLES.iconBtn}
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  message.success('链接已复制');
                }}
              />
            </div>
          </div>
        </div>

        {/* Tab切换区 */}
        <div style={STYLES.tabSection}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .detail-main-area { flex-direction: column !important; padding: 16px !important; gap: 20px !important; }
          .detail-main-area .ant-image { max-width: 100% !important; }
        }
        @media (max-width: 480px) {
          .detail-main-area { padding: 12px !important; }
        }
      `}</style>
    </div>
  );
};

export default ProductDetail;

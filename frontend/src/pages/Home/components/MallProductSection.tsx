import { useState, useEffect } from 'react';
import { Card, Tag, Button, Row, Col, Spin, Empty, Typography, Space } from 'antd';
import { ShoppingOutlined, FireOutlined, StarOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { mallApi, type ProductItem } from '@/api/mallApi';

const { Text, Title } = Typography;

const DEFAULT_COVER = '/media/yi.jpg';

function getCoverUrl(item: ProductItem): string {
  if (item.cover_image) return item.cover_image;
  return DEFAULT_COVER;
}

function safeTags(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
    catch { return raw.split(',').map((s) => s.trim()).filter(Boolean); }
  }
  return [];
}

export default function MallProductSection() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mallApi.getHotProducts().then((res: any) => {
      const list = res?.results || res?.data || res || [];
      setProducts(Array.isArray(list) ? list : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (products.length === 0 && !loading) return null;

  return (
    <>
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingOutlined style={{ fontSize: 20, color: '#7C3AED' }} />
          <Title level={4} style={{ margin: 0, color: '#1E293B' }}>数字商城 · 热门推荐</Title>
          <Tag color="volcano" icon={<FireOutlined />} style={{ borderRadius: 4 }}>HOT</Tag>
        </div>
        <Button
          type="link"
          icon={<ArrowRightOutlined />}
          onClick={() => navigate('/mall/products')}
          style={{ borderRadius: 6 }}
        >
          查看全部
        </Button>
      </div>

      <Spin spinning={loading}>
        <Row gutter={[12, 12]} className="mall-product-row">
          {(products.length > 0 ? products.slice(0, 4) : [1,2,3,4]).map((item: any) =>
            loading ? (
              <Col xs={24} sm={12} md={6} key={'skeleton-' + item}>
                <Card loading style={{ borderRadius: 6 }} />
              </Col>
            ) : (
              <Col xs={24} sm={12} md={6} lg={6} xl={6} key={item.id} onClick={() => navigate('/mall/product/' + item.id)}>
                <Card
                  style={{
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  styles={{ body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column' } }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div className="mall-product-img-wrap" style={{
                    height: 150,
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    <img
                      src={getCoverUrl(item)}
                      alt={item.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {item.is_hot && (
                      <Tag color="red" style={{ position: 'absolute', top: 8, left: 8, borderRadius: 4 }}>爆</Tag>
                    )}
                    {item.category === 'template' && (
                      <Tag color="blue" style={{ position: 'absolute', top: 8, right: 8, borderRadius: 4 }}>模板</Tag>
                    )}
                    {item.category === 'tool' && (
                      <Tag color="green" style={{ position: 'absolute', top: 8, right: 8, borderRadius: 4 }}>工具</Tag>
                    )}
                    {item.category === 'course' && (
                      <Tag color="orange" style={{ position: 'absolute', top: 8, right: 8, borderRadius: 4 }}>课程</Tag>
                    )}
                    {item.category === 'material' && (
                      <Tag color="magenta" style={{ position: 'absolute', top: 8, right: 8, borderRadius: 4 }}>素材</Tag>
                    )}
                  </div>
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <Text strong ellipsis={{ tooltip: item.title }} style={{ fontSize: 13, display: 'block', marginBottom: 6, minHeight: 36 }}>
                      {item.title}
                    </Text>
                    <div style={{ marginBottom: 8 }}>
                      {safeTags(item.tags).slice(0, 2).map((t) => (
                        <Tag key={t} color="blue" style={{ fontSize: 10, marginRight: 4, borderRadius: 3 }}>{t}</Tag>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text className="mall-product-price-text" style={{ fontSize: 18, fontWeight: 700, color: '#F5222D' }}>
                          {'¥' + item.price}
                        </Text>
                        {Number(item.original_price) > Number(item.price) && (
                          <Text delete type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                            {'¥' + item.original_price}
                          </Text>
                        )}
                      </div>
                      <Space size={4}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          <StarOutlined /> {item.sales_count}
                        </Text>
                      </Space>
                    </div>
                  </div>
                </Card>
              </Col>
            )
          )}
        </Row>
      </Spin>

      {!loading && products.length > 4 && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Button
            type="default"
            size="large"
            icon={<ShoppingOutlined />}
            onClick={() => navigate('/mall')}
            style={{ borderRadius: 6, paddingLeft: 32, paddingRight: 32 }}
          >
            进入数字商城，探索更多优质资源
          </Button>
        </div>
      )}
    </div>
    <style>{`
      @media (max-width: 768px) {
        .mall-product-row .ant-col {
          max-width: 100% !important;
          flex: 0 0 100% !important;
        }
        .mall-product-img-wrap {
          height: 160px !important;
        }
        .mall-product-price-text {
          font-size: 20px !important;
        }
      }
    `}</style>
    </>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Spin, Empty, Row, Col, Button } from 'antd';
import { ShoppingOutlined, FireOutlined, ArrowRightOutlined } from '@ant-design/icons';
import DigitalProductCard from '@/components/DigitalProductCard';
import { mallApi, type ProductItem } from '@/api/mallApi';

const { Title } = Typography;

const DEFAULT_PRODUCTS: ProductItem[] = [
  {
    id: 1,
    title: 'AI 文本安全检测包',
    description: '包含100次文本检测额度，支持AI文案、论文、简历等多场景检测',
    category: 'tool',
    price: 99,
    original_price: 199,
    cover_image: '',
    tags: ['热门', '新人专享'],
    is_hot: true,
    sales_count: 1280,
  },
  {
    id: 2,
    title: '内容合规审计月卡',
    description: '无限次内容合规检测，含图片鉴别+URL扫描+文件分析全功能',
    category: 'template',
    price: 299,
    original_price: 599,
    cover_image: '',
    tags: ['推荐', '企业首选'],
    is_recommend: true,
    sales_count: 856,
  },
  {
    id: 3,
    title: 'Agent 安全校验套件',
    description: '多Agent协同检测注入、泄露、越权、投毒风险，上线前必查',
    category: 'course',
    price: 499,
    original_price: 999,
    cover_image: '',
    tags: ['核心', '限时特惠'],
    is_hot: true,
    sales_count: 432,
  },
];

const DigitalProductSection: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductItem[]>(DEFAULT_PRODUCTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mallApi.getHotProducts()
      .then((res: any) => {
        const list = res?.results || res?.data || res || [];
        if (Array.isArray(list) && list.length > 0) {
          setProducts(list);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingOutlined style={{ fontSize: 20, color: '#FF7D00' }} />
          <Title level={4} style={{ margin: 0, color: '#1E293B' }}>入门好物</Title>
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#FFF',
            background: 'linear-gradient(135deg, #FF7D00, #FF5722)',
            padding: '2px 8px', borderRadius: 10,
          }}>NEW</span>
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
        <Row gutter={[12, 12]} className="digital-product-row">
          {products.slice(0, 3).map((item: any) => (
            <Col xs={24} sm={12} md={8} key={item.id}>
              <DigitalProductCard
                id={item.id}
                title={item.title}
                description={item.description}
                category={item.category || 'template'}
                price={Number(item.price) || 0}
                originalPrice={Number(item.original_price) || undefined}
                tags={Array.isArray(item.tags) ? item.tags : []}
                isHot={!!item.is_hot}
                isRecommend={!!item.is_recommend}
                salesCount={item.sales_count || 0}
                onClick={() => navigate('/mall/product/' + item.id)}
              />
            </Col>
          ))}
        </Row>
      </Spin>
      <style>{`
        @media (max-width: 768px) {
          .digital-product-row .ant-col {
            max-width: 100% !important;
            flex: 0 0 100% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default DigitalProductSection;

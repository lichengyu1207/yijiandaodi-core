import { useState } from 'react';
import { Modal, message } from 'antd';
import { CheckCircle, ShoppingCart, Tag } from 'lucide-react';
import ArticleCover from '@/components/ArticleCover';
import { createOrder, mockPay, type DigitalProduct } from '@/api/paymentApi';

interface ProductDetailModalProps {
  visible: boolean;
  product: DigitalProduct | null;
  onClose: () => void;
}

const STYLES = {
  modal: {
    maxWidth: 600,
  },
  imageContainer: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  infoSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#1D2129',
    marginBottom: 12,
    lineHeight: 1.3,
  },
  priceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  currentPrice: {
    fontSize: 32,
    fontWeight: 800,
    color: '#FF7D00',
  },
  originalPrice: {
    fontSize: 18,
    color: '#C9CDD4',
    textDecoration: 'line-through',
  },
  discountBadge: {
    background: '#FFF1F0',
    color: '#F53F3F',
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
  },
  description: {
    fontSize: 14,
    color: '#4E5969',
    lineHeight: 1.8,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F7F8FA',
    borderRadius: 8,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1D2129',
    marginBottom: 12,
  },
  benefitItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 0',
    borderBottom: '1px solid #F2F3F5',
    fontSize: 14,
    color: '#4E5969',
  },
  buyButton: {
    width: '100%',
    height: 52,
    background: 'linear-gradient(135deg, #FF7D00 0%, #EA580C 100%)',
    border: 'none',
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.25s ease',
    marginTop: 20,
  },
};

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  visible,
  product,
  onClose,
}) => {
  const [buying, setBuying] = useState(false);

  if (!product) return null;

  const handleBuy = async () => {
    setBuying(true);
    try {
      const orderRes: any = await createOrder('digital_product');
      const orderNo = orderRes?.data?.order_no || orderRes?.order_no;
      if (orderNo) {
        await mockPay(orderNo);
        message.success('购买成功！');
        onClose();
      }
    } catch (err) {
      console.error('购买失败:', err);
      message.error('购买失败，请重试');
    } finally {
      setBuying(false);
    }
  };

  const discount = product.original_price && product.original_price > product.price
    ? product.original_price - product.price
    : 0;

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      styles={{ body: { padding: 24 } }}
    >
      <div style={STYLES.imageContainer}>
        <ArticleCover
          title={product.title}
          width="100%"
          height="100%"
        />
      </div>

      <div style={STYLES.infoSection}>
        <h2 style={STYLES.title}>{product.title}</h2>

        <div style={STYLES.priceRow}>
          <span style={STYLES.currentPrice}>¥{product.price}</span>
          {product.original_price && product.original_price > product.price && (
            <>
              <span style={STYLES.originalPrice}>¥{product.original_price}</span>
              <span style={STYLES.discountBadge}>
                <Tag size={13} style={{ marginRight: 4 }} />
                省 ¥{discount.toFixed(2)}
              </span>
            </>
          )}
        </div>

        <div style={STYLES.description}>{product.description}</div>

        <h3 style={STYLES.benefitsTitle}>商品权益</h3>
        <div>
          {['即时下载，永久使用', '持续更新，免费升级', '专业技术支持', '7天无理由退款'].map((item) => (
            <div key={item} style={STYLES.benefitItem}>
              <CheckCircle size={18} style={{ color: '#00B42A', flexShrink: 0 }} />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <button
          style={{
            ...STYLES.buyButton,
            opacity: buying ? 0.7 : 1,
            cursor: buying ? 'not-allowed' : 'pointer',
          }}
          onClick={handleBuy}
          disabled={buying}
          onMouseEnter={(e) => {
            if (!buying) e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <ShoppingCart size={20} />
          {buying ? '处理中...' : '立即购买'}
        </button>
      </div>
    </Modal>
  );
};

export default ProductDetailModal;

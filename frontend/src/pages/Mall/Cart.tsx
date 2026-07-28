import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Card, Image, InputNumber, Checkbox,
  Popconfirm, Empty, message, Space, Typography
} from 'antd';
import {
  ShoppingCartOutlined, DeleteOutlined, ClearOutlined,
  ArrowLeftOutlined, ShopOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

const DEFAULT_COVER = '/media/yi.jpg';

interface CartItem {
  product_id: number;
  title: string;
  price: number;
  cover_image: string;
  quantity: number;
}

const STYLES = {
  page: { minHeight: '100vh', backgroundColor: '#F8FAFC', paddingBottom: 120 },
  container: { maxWidth: 1100, margin: '0 auto', padding: '20px 24px', boxSizing: 'border-box' as const },
  headerBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: { fontSize: 22, fontWeight: 700, color: '#1D2129' },
  cartTableWrap: {
    background: '#fff', borderRadius: 6,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  thumbImg: { width: 80, height: 60, objectFit: 'cover' as const, borderRadius: 4 },
  priceText: { fontWeight: 600, color: '#1D2129' },
  subtotalText: { fontWeight: 700, color: '#F5222D', fontSize: 15 },
  bottomBar: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    background: '#fff',
    borderTop: '1px solid #E2E8F0',
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
    boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
  },
  bottomLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  bottomRight: { display: 'flex', alignItems: 'center', gap: 24 },
  totalArea: { display: 'flex', alignItems: 'baseline', gap: 6 },
  totalLabel: { fontSize: 15, color: '#64748B' },
  totalPrice: { fontSize: 28, fontWeight: 800, color: '#F5222D' },
  checkoutBtn: { height: 46, minWidth: 140, fontSize: 16, borderRadius: 6, fontWeight: 600 },
  emptyWrap: { padding: '80px 0' },
} as const;

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);

  useEffect(() => {
    loadCart();
  }, []);

  useEffect(() => {
    setSelectedKeys(cartItems.map((item) => item.product_id));
  }, [cartItems]);

  const loadCart = () => {
    try {
      const data = JSON.parse(localStorage.getItem('mall_cart') || '[]');
      setCartItems(data);
    } catch {
      setCartItems([]);
    }
  };

  const saveCart = (items: CartItem[]) => {
    localStorage.setItem('mall_cart', JSON.stringify(items));
    setCartItems(items);
  };

  const updateQuantity = (productId: number, qty: number) => {
    if (qty < 1) return;
    const items = cartItems.map((item) =>
      item.product_id === productId ? { ...item, quantity: qty } : item
    );
    saveCart(items);
  };

  const removeItem = (productId: number) => {
    const items = cartItems.filter((item) => item.product_id !== productId);
    saveCart(items);
    setSelectedKeys(selectedKeys.filter((k) => k !== productId));
    message.success('已移除商品');
  };

  const clearCart = () => {
    localStorage.removeItem('mall_cart');
    setCartItems([]);
    setSelectedKeys([]);
    message.success('购物车已清空');
  };

  const selectedItems = cartItems.filter((item) => selectedKeys.includes(item.product_id));
  const totalCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const isAllSelected = cartItems.length > 0 && selectedKeys.length === cartItems.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(cartItems.map((item) => item.product_id));
    }
  };

  const toggleSelect = (id: number) => {
    if (selectedKeys.includes(id)) {
      setSelectedKeys(selectedKeys.filter((k) => k !== id));
    } else {
      setSelectedKeys([...selectedKeys, id]);
    }
  };

  const handleCheckout = () => {
    if (selectedItems.length === 0) {
      message.warning('请先选择要结算的商品');
      return;
    }
    navigate('/mall/orders?action=checkout&items=' + encodeURIComponent(JSON.stringify(selectedItems)));
  };

  if (cartItems.length === 0) {
    return (
      <div style={STYLES.page}>
        <div style={STYLES.container}>
          <div style={STYLES.headerBar}>
            <Title level={4} style={{ margin: 0 }}>
              <ShoppingCartOutlined style={{ marginRight: 8 }} /> 购物车
            </Title>
          </div>
          <Empty
            description="购物车是空的"
            style={STYLES.emptyWrap}
          >
            <Button type="primary" size="large" icon={<ShopOutlined />} onClick={() => navigate('/mall/products')} style={{ borderRadius: 6 }}>
              去逛逛
            </Button>
          </Empty>
        </div>
      </div>
    );
  }

  const columns = [
    {
      title: '',
      key: 'select',
      width: 50,
      render: (_: any, record: CartItem) => (
        <Checkbox
          checked={selectedKeys.includes(record.product_id)}
          onChange={() => toggleSelect(record.product_id)}
        />
      ),
    },
    {
      title: '商品信息',
      key: 'product',
      render: (_: any, record: CartItem) => (
        <Space>
          <Image
            src={record.cover_image || DEFAULT_COVER}
            preview={false}
            fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Crect fill='%23E5E6EB' width='80' height='60'/%3E%3C/svg%3E"
            style={STYLES.thumbImg}
          />
          <Text strong style={{ maxWidth: 280 }}>{record.title}</Text>
        </Space>
      ),
    },
    {
      title: '单价',
      dataIndex: 'price',
      width: 120,
      align: 'right' as const,
      render: (price: number) => <span style={STYLES.priceText}>¥{price}</span>,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 150,
      align: 'center' as const,
      render: (qty: number, record: CartItem) => (
        <InputNumber
          min={1}
          max={999}
          value={qty}
          onChange={(val) => val && updateQuantity(record.product_id, val)}
          style={{ width: 110 }}
        />
      ),
    },
    {
      title: '小计',
      key: 'subtotal',
      width: 120,
      align: 'right' as const,
      render: (_: any, record: CartItem) => (
        <span style={STYLES.subtotalText}>¥{(record.price * record.quantity).toFixed(2)}</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: CartItem) => (
        <Popconfirm
          title="确定删除该商品？"
          onConfirm={() => removeItem(record.product_id)}
          okText="删除"
          cancelText="取消"
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={STYLES.page}>
      <div style={STYLES.container}>
        {/* 头部 */}
        <div style={STYLES.headerBar}>
          <Title level={4} style={{ margin: 0 }}>
            <ShoppingCartOutlined style={{ marginRight: 8 }} />
            购物车 ({cartItems.length})
          </Title>
          <Popconfirm
            title="确定清空购物车？"
            onConfirm={clearCart}
            okText="清空"
            cancelText="取消"
          >
            <Button icon={<ClearOutlined />} danger ghost>清空购物车</Button>
          </Popconfirm>
        </div>

        {/* 购物车列表 */}
        <div style={STYLES.cartTableWrap}>
          <Table
            dataSource={cartItems}
            columns={columns}
            rowKey="product_id"
            pagination={false}
            size="middle"
          />
        </div>

        {/* 底部结算栏 */}
        <div style={STYLES.bottomBar} className="cart-bottom-bar">
          <div style={STYLES.bottomLeft}>
            <Checkbox checked={isAllSelected} onChange={toggleSelectAll}>
              全选
            </Checkbox>
            <Text type="secondary">
              已选 {totalCount} 件商品
            </Text>
          </div>
          <div style={STYLES.bottomRight}>
            <div style={STYLES.totalArea}>
              <span style={STYLES.totalLabel}>合计：</span>
              <span style={STYLES.totalPrice}>¥{totalPrice.toFixed(2)}</span>
            </div>
            <Button
              type="primary"
              size="large"
              style={{ ...STYLES.checkoutBtn }} className="cart-checkout-btn"
              disabled={selectedItems.length === 0}
              onClick={handleCheckout}
            >
              去结算（{selectedItems.length}）
            </Button>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .cart-bottom-bar { padding: 10px 16px !important; flex-wrap: wrap; gap: 8px; }
          .cart-bottom-bar .cart-total-area { font-size: 14px !important; }
          .cart-bottom-bar .cart-total-price { font-size: 22px !important; }
          .cart-checkout-btn { min-width: 110px !important; height: 40px !important; font-size: 14px !important; }
        }
        @media (max-width: 480px) {
          .cart-container { padding: 12px 12px !important; }
          .cart-bottom-bar { padding: 8px 12px !important; }
        }
      `}</style>
    </div>
  );
};

export default Cart;

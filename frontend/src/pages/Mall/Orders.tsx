import { useState, useEffect } from 'react';
import {
  Card, Statistic, Tabs, Table, Tag, Button, Modal,
  Space, Typography, Empty, Spin, message, Descriptions, Timeline
} from 'antd';
import {
  ClockCircleOutlined, SendOutlined, CheckCircleOutlined,
  DollarOutlined, EyeOutlined, PayCircleOutlined,
  CloseOutlined, FileTextOutlined
} from '@ant-design/icons';
import { mallApi, type OrderItem } from '@/api/mallApi';

const { Title, Text } = Typography;

const STYLES = {
  page: { minHeight: '100vh', backgroundColor: '#F8FAFC', paddingBottom: 60 },
  container: { maxWidth: 1200, margin: '0 auto', padding: '20px 24px', boxSizing: 'border-box' as const },
  headerTitle: { fontSize: 22, fontWeight: 700, color: '#1E293B', marginBottom: 20 },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    borderRadius: 6,
    overflow: 'hidden',
    cursor: 'default',
    transition: 'box-shadow 0.2s ease',
  },
  tableWrap: {
    background: '#fff', borderRadius: 6,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    padding: '16px 20px',
  },
  orderNoText: { fontFamily: 'monospace', color: '#165DFF', fontWeight: 600 },
  productListInline: { display: 'flex', flexWrap: 'wrap' as const, gap: 8, alignItems: 'center' },
  modalContent: { maxHeight: '70vh', overflowY: 'auto' as const },
} as const;

interface OrderStats {
  pending_count: number;
  paid_count: number;
  shipped_count: number;
  completed_count: number;
  cancelled_count: number;
  refunded_count: number;
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'orange', label: '待付款' },
  paid: { color: 'blue', label: '待发货' },
  shipped: { color: 'purple', label: '已发货' },
  completed: { color: 'green', label: '已完成' },
  cancelled: { color: 'default', label: '已取消' },
  refunded: { color: 'red', label: '退款中' },
};

const PAY_METHOD_MAP: Record<string, string> = {
  alipay: '支付宝',
  wechat: '微信支付',
  bank: '银行转账',
  balance: '余额支付',
};

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OrderItem | null>(null);

  useEffect(() => {
    loadOrders();
    loadStats();
  }, [activeTab, page]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: 10 };
      if (activeTab !== 'all') params.status = activeTab;
      const res: any = await mallApi.getMyOrders(params);
      const list = res?.results || res?.data || res || [];
      setOrders(list);
      setTotal(res?.count || list.length);
    } catch (err) {
      console.error('加载订单失败:', err);
      message.error('加载订单列表失败');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res: any = await mallApi.getOrderStats();
      setStats(res?.data || res || null);
    } catch { /* ignore */ }
  };

  const showDetail = (order: OrderItem) => {
    setCurrentOrder(order);
    setDetailModalOpen(true);
  };

  const handleCancelOrder = async (orderId: number) => {
    try {
      await mallApi.cancelOrder(orderId);
      message.success('订单已取消');
      loadOrders();
      loadStats();
    } catch (err) {
      message.error('取消订单失败');
    }
  };

  const handlePay = async (order: OrderItem) => {
    try {
      await mallApi.createPayment({ order_id: order.id, pay_method: 'alipay' });
      message.info('跳转支付页面...');
    } catch (err) {
      message.error('发起支付失败');
    }
  };

  const tabItems = [
    { key: 'all', label: '全部订单' },
    { key: 'pending', label: '待付款' },
    { key: 'paid', label: '待发货' },
    { key: 'shipped', label: '已发货' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
  ];

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      width: 180,
      render: (no: string) => <span style={STYLES.orderNoText}>{no}</span>,
    },
    {
      title: '商品信息',
      key: 'items',
      width: 280,
      render: (_: any, record: OrderItem) => (
        <div style={STYLES.productListInline}>
          {record.items.map((item, idx) => (
            <Tag key={idx} style={{ margin: 0 }}>
              {item.title} x{item.quantity}
            </Tag>
          ))}
          {record.items.length > 2 && (
            <Tag color="processing">等{record.items.length}件</Tag>
          )}
        </div>
      ),
    },
    {
      title: '金额',
      dataIndex: 'pay_amount',
      width: 110,
      align: 'right' as const,
      render: (amt: number) => (
        <Text strong style={{ color: '#F5222D' }}>¥{Number(amt).toFixed(2)}</Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      align: 'center' as const,
      render: (status: string) => {
        const s = STATUS_MAP[status];
        return s ? <Tag color={s.color}>{s.label}</Tag> : <Tag>{status}</Tag>;
      },
    },
    {
      title: '支付方式',
      dataIndex: 'pay_method',
      width: 100,
      render: (method: string) => PAY_METHOD_MAP[method] || method || '-',
    },
    {
      title: '下单时间',
      dataIndex: 'created_at',
      width: 170,
      render: (t: string) => t ? t.replace('T', ' ').substring(0, 19) : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: OrderItem) => {
        const actions: React.ReactNode[] = [];
        if (record.status === 'pending') {
          actions.push(
            <Button key="pay" type="primary" size="small" icon={<PayCircleOutlined />} onClick={() => handlePay(record)}>
              去支付
            </Button>
          );
          actions.push(
            <Button key="cancel" danger size="small" ghost icon={<CloseOutlined />} onClick={() => handleCancelOrder(record.id)}>
              取消
            </Button>
          );
        } else {
          actions.push(
            <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>
              查看详情
            </Button>
          );
        }
        return <Space size={4}>{actions}</Space>;
      },
    },
  ];

  return (
    <div style={STYLES.page}>
      <div style={STYLES.container}>
        <Title level={4} style={STYLES.headerTitle}>我的订单</Title>

        {/* 统计卡片 */}
        <div style={STYLES.statsRow}>
          <Card style={STYLES.statCard}>
            <Statistic
              title="待付款"
              value={stats?.pending_count || 0}
              prefix={<ClockCircleOutlined style={{ color: '#FAAD14' }} />}
              valueStyle={{ color: '#FAAD14' }}
            />
          </Card>
          <Card style={STYLES.statCard}>
            <Statistic
              title="待发货"
              value={stats?.paid_count || 0}
              prefix={<SendOutlined style={{ color: '#165DFF' }} />}
              valueStyle={{ color: '#165DFF' }}
            />
          </Card>
          <Card style={STYLES.statCard}>
            <Statistic
              title="已完成"
              value={stats?.completed_count || 0}
              prefix={<CheckCircleOutlined style={{ color: '#52C41A' }} />}
              valueStyle={{ color: '#52C41A' }}
            />
          </Card>
          <Card style={STYLES.statCard}>
            <Statistic
              title="退款中"
              value={stats?.refunded_count || 0}
              prefix={<DollarOutlined style={{ color: '#F5222D' }} />}
              valueStyle={{ color: '#F5222D' }}
            />
          </Card>
        </div>

        {/* 状态Tab */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => { setActiveTab(key); setPage(1); }}
          items={tabItems}
          size="large"
          style={{ background: '#fff', borderRadius: 6, padding: '0 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          className="orders-tabs-wrap"
        />

        {/* 订单表格 */}
        <div style={STYLES.tableWrap} className="orders-table-wrap">
          <Spin spinning={loading}>
            {orders.length === 0 && !loading ? (
              <Empty description="暂无订单记录" style={{ padding: '60px 0' }} />
            ) : (
              <>
                <Table
                  dataSource={orders}
                  columns={columns}
                  rowKey="id"
                  pagination={{
                    current: page,
                    total,
                    pageSize: 10,
                    onChange: (p) => setPage(p),
                    showTotal: (t) => '共 ' + t + ' 条订单',
                    size: 'default',
                  }}
                  scroll={{ x: 1020 }}
                />
              </>
            )}
          </Spin>
        </div>
      </div>

      {/* 订单详情Modal */}
      <Modal
        title="订单详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>关闭</Button>,
        ]}
        width={680}
      >
        {currentOrder && (
          <div style={STYLES.modalContent}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="订单号" span={2}>
                <span style={STYLES.orderNoText}>{currentOrder.order_no}</span>
              </Descriptions.Item>
              <Descriptions.Item label="订单状态">
                <Tag color={STATUS_MAP[currentOrder.status]?.color || 'default'}>
                  {currentOrder.status_display || STATUS_MAP[currentOrder.status]?.label || currentOrder.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="支付方式">
                {PAY_METHOD_MAP[currentOrder.pay_method] || currentOrder.pay_method || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="商品总额">¥{Number(currentOrder.total_amount).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="实付金额">
                <Text strong style={{ color: '#F5222D' }}>¥{Number(currentOrder.pay_amount).toFixed(2)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="支付时间">{currentOrder.pay_time ? currentOrder.pay_time.replace('T', ' ').substring(0, 19) : '-'}</Descriptions.Item>
              <Descriptions.Item label="下单时间">{currentOrder.created_at ? currentOrder.created_at.replace('T', ' ').substring(0, 19) : '-'}</Descriptions.Item>
              {currentOrder.shipping_info && (
                <Descriptions.Item label="收货信息" span={2}>{currentOrder.shipping_info}</Descriptions.Item>
              )}
              {currentOrder.remark && (
                <Descriptions.Item label="备注" span={2}>{currentOrder.remark}</Descriptions.Item>
              )}
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <Title level={5}><FileTextOutlined /> 商品明细</Title>
              <Table
                dataSource={currentOrder.items}
                columns={[
                  { title: '产品名称', dataIndex: 'title', ellipsis: true },
                  { title: '单价', dataIndex: 'price', render: (p: number) => '¥' + p },
                  { title: '数量', dataIndex: 'quantity', align: 'center' as const },
                  { title: '小计', key: 'sub', render: (_: any, r: any) => <Text strong>¥{(r.price * r.quantity).toFixed(2)}</Text> },
                ]}
                pagination={false}
                rowKey="product_id"
                size="small"
              />
            </div>
          </div>
        )}
      </Modal>
      <style>{`
        @media (max-width: 768px) {
          .orders-stats-row { grid-template-columns: repeat(2, 1fr) !important; gap: 12px; }
          .orders-container { padding: 12px 16px !important; }
          .orders-tabs-wrap { padding: 0 12px !important; }
          .orders-table-wrap { padding: 10px 12px !important; overflow-x: auto; }
        }
        @media (max-width: 480px) {
          .orders-stats-row { grid-template-columns: 1fr 1fr !important; gap: 8px; }
          .orders-container { padding: 8px 10px !important; }
          .orders-modal { width: 95% !important; max-width: none !important; margin: 10px auto !important; }
        }
      `}</style>
    </div>
  );
};

export default Orders;

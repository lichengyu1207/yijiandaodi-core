import { useState, useEffect } from 'react';
import { Card, Tag, Table, Modal, Button, Typography, Spin, Empty, Row, Col } from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  UndoOutlined,
  EyeOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { mallApi, type OrderItem } from '@/api/mallApi';

const { Text, Title } = Typography;

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
  pageTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#1D2129',
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: '20px 24px',
    border: '1px solid #E5E6EB',
    transition: 'box-shadow 0.2s ease',
  },
  statHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  },
  statLabel: {
    fontSize: 14,
    color: '#86909C',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1D2129',
    lineHeight: 1.2,
  },
  tableCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    border: '1px solid #E5E6EB',
    marginTop: 20,
    overflow: 'hidden' as const,
  },
  tableHeader: {
    padding: '16px 24px',
    borderBottom: '1px solid #E5E6EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1D2129',
  },
  tableWrap: {
    padding: '0 12px 12px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid #F2F3F5',
  },
  detailLabel: {
    color: '#86909C',
    fontSize: 14,
    flexShrink: 0,
  },
  detailValue: {
    color: '#1D2129',
    fontSize: 14,
    textAlign: 'right' as const,
    wordBreak: 'break-all' as const,
  },
  emptyWrap: {
    padding: 80,
    textAlign: 'center' as const,
  },
  loadingWrap: {
    padding: 100,
    textAlign: 'center' as const,
  },
} as const;

const STATUS_MAP: Record<string, { color: string; label?: string }> = {
  pending: { color: 'processing', label: '待支付' },
  paid: { color: 'success', label: '已支付' },
  completed: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '支付失败' },
  refunded: { color: 'default', label: '已退款' },
  expired: { color: 'default', label: '已过期' },
};

const TYPE_MAP: Record<string, { color: string; label: string }> = {
  per_use: { color: 'blue', label: '按次付费' },
  vip_monthly: { color: 'gold', label: '月度会员' },
  vip_yearly_199: { color: 'purple', label: '年度会员(199)' },
  vip_yearly_599: { color: 'magenta', label: '年度会员(599)' },
  vip_enterprise: { color: 'red', label: '企业版' },
  combo_security: { color: 'cyan', label: '安全套餐' },
  combo_content: { color: 'orange', label: '内容套餐' },
};

function inferOrderType(order: OrderItem): string {
  if (!order.items || order.items.length === 0) return '';
  return order.items[0].title || '';
}

function matchTypeKey(title: string): string {
  for (const key of Object.keys(TYPE_MAP)) {
    if (title.toLowerCase().includes(key) || title.includes(TYPE_MAP[key].label.replace(/[()]/g, ''))) {
      return key;
    }
  }
  if (title.includes('按次') || title.includes('单次')) return 'per_use';
  if (title.includes('月')) return 'vip_monthly';
  if (title.includes('企业')) return 'vip_enterprise';
  if (title.includes('安全')) return 'combo_security';
  if (title.includes('内容')) return 'combo_content';
  if (title.includes('年') || title.includes('年度')) return 'vip_yearly_199';
  return '';
}

const OrderCenter: React.FC = () => {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OrderItem | null>(null);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        const res: any = await mallApi.getOrders();
        const list = res?.results || res?.data || res || [];
        setOrders(list);
      } catch (err) {
        console.error('加载订单数据失败:', err);
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, []);

  const stats = {
    pending: orders.filter((o) => o.status === 'pending').length,
    paid: orders.filter((o) => o.status === 'paid').length,
    completed: orders.filter((o) => o.status === 'completed').length,
    refunded: orders.filter((o) => o.status === 'refunded').length,
  };

  const STAT_CARDS = [
    {
      key: 'pending',
      icon: <ClockCircleOutlined />,
      iconBg: '#E8F3FF',
      iconColor: '#165DFF',
      label: '待支付',
      value: stats.pending,
    },
    {
      key: 'paid',
      icon: <DollarOutlined />,
      iconBg: '#E8FFEC',
      iconColor: '#00B42A',
      label: '已支付',
      value: stats.paid,
    },
    {
      key: 'completed',
      icon: <CheckCircleOutlined />,
      iconBg: '#E8FFEC',
      iconColor: '#00B42A',
      label: '已完成',
      value: stats.completed,
    },
    {
      key: 'refunded',
      icon: <UndoOutlined />,
      iconBg: '#F2F3F5',
      iconColor: '#86909C',
      label: '已退款',
      value: stats.refunded,
    },
  ];

  const showDetail = (record: OrderItem) => {
    setCurrentOrder(record);
    setModalVisible(true);
  };

  const renderTypeTag = (order: OrderItem) => {
    const title = inferOrderType(order);
    const key = matchTypeKey(title);
    if (key && TYPE_MAP[key]) {
      const t = TYPE_MAP[key];
      return <Tag color={t.color}>{t.label}</Tag>;
    }
    return <Tag>{title || '未知类型'}</Tag>;
  };

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      ellipsis: true,
      render: (text: string) => (
        <Text copyable={{ text }} style={{ fontFamily: 'monospace', fontSize: 13 }}>
          {text}
        </Text>
      ),
    },
    {
      title: '类型',
      key: 'type',
      width: 130,
      render: (_: any, record: OrderItem) => renderTypeTag(record),
    },
    {
      title: '金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      render: (val: number) => (
        <Text strong style={{ color: '#F53F3F', fontSize: 15 }}>
          ¥{Number(val).toFixed(2)}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const s = STATUS_MAP[status];
        return s ? <Tag color={s.color}>{s.label || status}</Tag> : <Tag>{status}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => (
        <Text style={{ color: '#86909C', fontSize: 13 }}>{text}</Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: OrderItem) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => showDetail(record)}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div className="ordercenter-page" style={STYLES.page}>
      <div style={STYLES.container}>
        <div style={STYLES.pageTitle}>
          <ShoppingOutlined />
          订单中心
        </div>

        {/* 统计卡片 */}
        <Row gutter={[16, 16]}>
          {STAT_CARDS.map((card) => (
            <Col xs={12} sm={12} md={6} key={card.key}>
              <div
                style={{
                  ...STYLES.statCard,
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={STYLES.statHeader}>
                  <div
                    style={{
                      ...STYLES.statIconWrap,
                      backgroundColor: card.iconBg,
                      color: card.iconColor,
                    }}
                  >
                    {card.icon}
                  </div>
                  <span style={STYLES.statLabel}>{card.label}</span>
                </div>
                <div style={STYLES.statValue}>{card.value}</div>
              </div>
            </Col>
          ))}
        </Row>

        {/* 订单表格 */}
        <div style={STYLES.tableCard}>
          <div style={STYLES.tableHeader}>
            <span style={STYLES.tableTitle}>订单列表</span>
            <Text type="secondary" style={{ fontSize: 13 }}>
              共 {orders.length} 条记录
            </Text>
          </div>

          {loading ? (
            <div style={{ ...STYLES.loadingWrap, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <Spin size="large" />
              <span style={{ fontSize: 13, color: '#86909C' }}>加载中...</span>
            </div>
          ) : orders.length === 0 ? (
            <div style={STYLES.emptyWrap}>
              <Empty
                description={
                  <span style={{ color: '#86909C' }}>暂无订单数据</span>
                }
              />
            </div>
          ) : (
            <div style={STYLES.tableWrap}>
              <Table<OrderItem>
                rowKey="id"
                dataSource={orders}
                columns={columns}
                pagination={{ pageSize: 10, size: 'small', showTotal: (total) => `共 ${total} 条` }}
                scroll={{ x: 800 }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 详情弹窗 */}
      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        title={
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            <FileTextOutlined style={{ marginRight: 8 }} />
            订单详情
          </span>
        }
        width={560}
      >
        {currentOrder && (
          <div>
            <div style={STYLES.detailRow}>
              <span style={STYLES.detailLabel}>订单号</span>
              <span style={STYLES.detailValue}>{currentOrder.order_no}</span>
            </div>
            <div style={STYLES.detailRow}>
              <span style={STYLES.detailLabel}>订单状态</span>
              <span style={STYLES.detailValue}>
                {(() => {
                  const s = STATUS_MAP[currentOrder.status];
                  return s ? <Tag color={s.color}>{s.label || currentOrder.status}</Tag> : <Tag>{currentOrder.status}</Tag>;
                })()}
              </span>
            </div>
            <div style={STYLES.detailRow}>
              <span style={STYLES.detailLabel}>订单类型</span>
              <span style={STYLES.detailValue}>{renderTypeTag(currentOrder)}</span>
            </div>
            <div style={STYLES.detailRow}>
              <span style={STYLES.detailLabel}>总金额</span>
              <span style={{ ...STYLES.detailValue, color: '#F53F3F', fontWeight: 600, fontSize: 15 }}>
                ¥{Number(currentOrder.total_amount).toFixed(2)}
              </span>
            </div>
            <div style={STYLES.detailRow}>
              <span style={STYLES.detailLabel}>实付金额</span>
              <span style={{ ...STYLES.detailValue, fontWeight: 600 }}>
                ¥{Number(currentOrder.pay_amount).toFixed(2)}
              </span>
            </div>
            <div style={STYLES.detailRow}>
              <span style={STYLES.detailLabel}>支付方式</span>
              <span style={STYLES.detailValue}>{currentOrder.pay_method || '-'}</span>
            </div>
            <div style={STYLES.detailRow}>
              <span style={STYLES.detailLabel}>支付时间</span>
              <span style={STYLES.detailValue}>{currentOrder.pay_time || '-'}</span>
            </div>
            <div style={STYLES.detailRow}>
              <span style={STYLES.detailLabel}>创建时间</span>
              <span style={STYLES.detailValue}>{currentOrder.created_at}</span>
            </div>
            <div style={STYLES.detailRow}>
              <span style={STYLES.detailLabel}>更新时间</span>
              <span style={STYLES.detailValue}>{currentOrder.updated_at}</span>
            </div>
            <div style={{ ...STYLES.detailRow, borderBottom: 'none', flexDirection: 'column' as const, gap: 6 }}>
              <span style={STYLES.detailLabel}>商品明细</span>
              <div style={{ width: '100%' }}>
                {currentOrder.items && currentOrder.items.length > 0 ? (
                  currentOrder.items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: '#F7F8FA',
                        borderRadius: 6,
                        marginBottom: idx < currentOrder.items!.length - 1 ? 6 : 0,
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{item.title}</span>
                      <span style={{ fontSize: 13, color: '#1D2129' }}>
                        ¥{item.price} × {item.quantity}
                      </span>
                    </div>
                  ))
                ) : (
                  <Text type="secondary" style={{ fontSize: 13 }}>无商品明细</Text>
                )}
              </div>
            </div>
            {currentOrder.remark && (
              <div style={{ ...STYLES.detailRow, borderBottom: 'none' }}>
                <span style={STYLES.detailLabel}>备注</span>
                <span style={STYLES.detailValue}>{currentOrder.remark}</span>
              </div>
            )}
          </div>
        )}
      </Modal>
      <style>{`
        @media (max-width: 768px) {
          .ordercenter-page { padding: 12px 16px !important; }
        }
      `}</style>
    </div>
  );
};

export default OrderCenter;

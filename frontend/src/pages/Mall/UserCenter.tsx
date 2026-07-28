import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Menu, Card, Button, Table, Tag, InputNumber, Select,
  Input, Form, Modal, message, Space, Typography, Empty, Spin,
  Descriptions, Popconfirm, Switch, Row, Col
} from 'antd';
import {
  FileTextOutlined, HeartOutlined, UploadOutlined,
  WalletOutlined, SettingOutlined, FireOutlined,
  PlusOutlined, EditOutlined,
  CheckCircleOutlined, ClockCircleOutlined, CloseOutlined,
  SendOutlined
} from '@ant-design/icons';
import { mallApi, type ProductItem, type OrderItem, type WithdrawalRecordItem, type HotTemplateItem } from '@/api/mallApi';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const DEFAULT_COVER = '/media/yi.jpg';

const STYLES = {
  page: { minHeight: '100vh', backgroundColor: '#F8FAFC' },
  layout: { minHeight: '100vh', maxWidth: 1300, margin: '0 auto', background: '#F8FAFC' },
  siderBg: { background: '#fff', borderRadius: '0 6px 6px 0', borderRight: '1px solid #E2E8F0', height: 'calc(100vh)' },
  contentArea: { padding: '24px 28px', minHeight: 'calc(100vh - 48px)' },
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#1E293B', marginBottom: 20 },
  balanceCard: {
    background: 'linear-gradient(135deg, #1890FF 0%, #096dd9 100%)',
    borderRadius: 6, color: '#fff', padding: '28px 32px', marginBottom: 24,
  },
  balanceAmount: { fontSize: 42, fontWeight: 800, color: '#fff', lineHeight: 1.2 },
  formCard: { borderRadius: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 24, padding: 24 },
  tableWrap: { background: '#fff', borderRadius: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '16px 20px' },
  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  productImg: { width: '100%', height: 150, objectFit: 'cover' as const, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  templateCard: { cursor: 'pointer', transition: 'all 0.25s ease', borderRadius: 6, overflow: 'hidden' as const },
} as const;

const MENU_ITEMS = [
  { key: 'orders', icon: <FileTextOutlined />, label: '我的订单' },
  { key: 'favorites', icon: <HeartOutlined />, label: '我的收藏' },
  { key: 'published', icon: <UploadOutlined />, label: '我的发布' },
  { key: 'withdrawal', icon: <WalletOutlined />, label: '收益提现' },
  { key: 'templates', icon: <FireOutlined />, label: '爆款模板库' },
  { key: 'settings', icon: <SettingOutlined />, label: '账户设置' },
];

const WITHDRAWAL_STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'orange', label: '待审核' },
  approved: { color: 'blue', label: '已通过' },
  rejected: { color: 'red', label: '已拒绝' },
  completed: { color: 'green', label: '已完成' },
};

const UserCenter: React.FC = () => {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('orders');
  const [form] = Form.useForm();

  // 我的订单
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // 我的发布
  const [myProducts, setMyProducts] = useState<ProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // 提现
  const [balance, setBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecordItem[]>([]);
  const [withdrawing, setWithdrawing] = useState(false);

  // 模板
  const [templates, setTemplates] = useState<HotTemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateDetailModal, setTemplateDetailModal] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<HotTemplateItem | null>(null);

  // 产品编辑
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [productForm] = Form.useForm();
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [activeMenu]);

  const loadOrders = async () => {
    if (activeMenu !== 'orders') return;
    setOrdersLoading(true);
    try {
      const res: any = await mallApi.getMyOrders({ page_size: 10 });
      setOrders(res?.results || res?.data || res || []);
    } catch (err) {
      console.error('加载订单失败:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadMyProducts = async () => {
    if (activeMenu !== 'published') return;
    setProductsLoading(true);
    try {
      const res: any = await mallApi.getMyProducts({ page_size: 12 });
      setMyProducts(res?.results || res?.data || res || []);
    } catch (err) {
      console.error('加载我的产品失败:', err);
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    if (activeMenu === 'published') loadMyProducts();
  }, [activeMenu]);

  const loadWithdrawals = async () => {
    try {
      const res: any = await mallApi.getMyWithdrawals({ page_size: 10 });
      setWithdrawals(res?.results || res?.data || res || []);
    } catch (err) {
      console.error('加载提现记录失败:', err);
    }
  };

  useEffect(() => {
    if (activeMenu === 'withdrawal') {
      loadWithdrawals();
      setBalance(1280.50); // 模拟余额，实际应从接口获取
    }
  }, [activeMenu]);

  const loadTemplates = async () => {
    if (activeMenu !== 'templates') return;
    setTemplatesLoading(true);
    try {
      const res: any = await mallApi.getTrendingTemplates({ page_size: 9 });
      setTemplates(res?.results || res?.data || res || []);
    } catch (err) {
      console.error('加载模板失败:', err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    if (activeMenu === 'templates') loadTemplates();
  }, [activeMenu]);

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'on_sale' ? 'off_sale' : 'on_sale';
    try {
      await mallApi.toggleProductStatus(id, newStatus);
      message.success(newStatus === 'on_sale' ? '已上架' : '已下架');
      loadMyProducts();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const handleEditProduct = (item: ProductItem) => {
    setEditingProduct(item);
    productForm.setFieldsValue({
      title: item.title,
      description: item.description,
      category: item.category,
      price: item.price,
      original_price: item.original_price,
      is_hot: item.is_hot,
      is_recommend: item.is_recommend,
      stock: item.stock === -1 ? undefined : item.stock,
    });
    setProductModalOpen(true);
  };

  const handleCreateProduct = () => {
    setEditingProduct(null);
    productForm.resetFields();
    productForm.setFieldsValue({ category: 'template', stock: -1, is_hot: false, is_recommend: false });
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (values: any) => {
    setSavingProduct(true);
    try {
      const payload = {
        ...values,
        stock: values.stock || -1,
        tags: JSON.stringify(values.tags ? values.tags.split(',').map((t: string) => t.trim()) : []),
        images: JSON.stringify([]),
        status: 'on_sale',
      };
      if (editingProduct) {
        await mallApi.updateProduct(editingProduct.id, payload);
        message.success('产品更新成功');
      } else {
        await mallApi.createProduct(payload);
        message.success('产品发布成功');
      }
      setProductModalOpen(false);
      setEditingProduct(null);
      loadMyProducts();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '保存失败');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleApplyWithdrawal = async (values: { amount: number; method: string; account: string; remark?: string }) => {
    setWithdrawing(true);
    try {
      await mallApi.applyWithdrawal(values);
      message.success('提现申请已提交');
      form.resetFields();
      loadWithdrawals();
    } catch (err) {
      message.error('提现申请失败');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleUseTemplate = async (id: number) => {
    try {
      await mallApi.useTemplate(id);
      message.success('模板使用成功！');
    } catch (err) {
      message.error('使用模板失败');
    }
  };

  const renderContent = () => {
    switch (activeMenu) {
      case 'orders':
        return (
          <>
            <Title level={4} style={STYLES.pageTitle}>我的订单</Title>
            <Spin spinning={ordersLoading}>
              <div style={STYLES.tableWrap}>
                {orders.length === 0 ? (
                  <Empty description="暂无订单" style={{ padding: '60px 0' }}>
                    <Button type="primary" onClick={() => navigate('/mall/products')} style={{ borderRadius: 6 }}>去购物</Button>
                  </Empty>
                ) : (
                  <Table
                    dataSource={orders}
                    columns={[
                      { title: '订单号', dataIndex: 'order_no', width: 180, ellipsis: true },
                      { title: '金额', dataIndex: 'pay_amount', width: 110, align: 'right' as const, render: (a: number) => <Text strong style={{ color: '#F5222D' }}>¥{Number(a).toFixed(2)}</Text> },
                      { title: '状态', dataIndex: 'status', width: 100, render: (s: string) => {
                        const map: Record<string, string> = { pending: 'orange', paid: 'blue', shipped: 'purple', completed: 'green', cancelled: 'default', refunded: 'red' };
                        const labels: Record<string, string> = { pending: '待付款', paid: '待发货', shipped: '已发货', completed: '已完成', cancelled: '已取消', refunded: '退款中' };
                        return <Tag color={map[s]}>{labels[s] || s}</Tag>;
                      }},
                      { title: '时间', dataIndex: 'created_at', width: 170, render: (t: string) => t ? t.replace('T', ' ').substring(0, 19) : '-' },
                      { title: '操作', key: 'action', width: 120, render: (_: any, r: OrderItem) => (
                        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => message.info('查看详情：' + r.order_no)}>详情</Button>
                      )},
                    ]}
                    rowKey="id"
                    pagination={{ pageSize: 8 }}
                    size="middle"
                  />
                )}
              </div>
            </Spin>
          </>
        );

      case 'favorites':
        return (
          <>
            <Title level={4} style={STYLES.pageTitle}>我的收藏</Title>
            <Empty description="暂无收藏内容" style={{ padding: '80px 0' }} />
          </>
        );

      case 'published':
        return (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Title level={4} style={{ margin: 0 }}>我的发布</Title>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateProduct} style={{ borderRadius: 6 }}>发布新产品</Button>
            </div>
            <Spin spinning={productsLoading}>
              {myProducts.length === 0 ? (
                <Empty description="暂未发布任何产品" style={{ padding: '60px 0' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateProduct} style={{ borderRadius: 6 }}>立即发布</Button>
                </Empty>
              ) : (
                <div style={STYLES.productGrid}>
                  {myProducts.map((item) => (
                    <Card
                      key={item.id}
                      hoverable
                      style={{ borderRadius: 6, overflow: 'hidden' }}
                      cover={
                        <img
                          alt={item.title}
                          src={item.cover_image || DEFAULT_COVER}
                          style={STYLES.productImg}
                        />
                      }
                    >
                      <div style={{ padding: '4px 0' }}>
                        <Text strong ellipsis={{ tooltip: item.title }} style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>{item.title}</Text>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 18, fontWeight: 700, color: '#F5222D' }}>¥{item.price}</span>
                          <Tag color={item.status === 'on_sale' ? 'green' : 'default'}>
                            {item.status === 'on_sale' ? '上架中' : '已下架'}
                          </Tag>
                        </div>
                        <Space size={8}>
                          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditProduct(item)}>编辑</Button>
                          <Popconfirm
                            title={'确定' + (item.status === 'on_sale' ? '下架' : '上架') + '？'}
                            onConfirm={() => handleToggleStatus(item.id, item.status)}
                          >
                            <Button size="small">
                              {item.status === 'on_sale' ? '下架' : '上架'}
                            </Button>
                          </Popconfirm>
                        </Space>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Spin>
          </>
        );

      case 'withdrawal':
        return (
          <>
            <Title level={4} style={STYLES.pageTitle}>收益提现</Title>

            {/* 余额展示 */}
            <div style={STYLES.balanceCard}>
              <Text style={{ fontSize: 15, opacity: 0.85, display: 'block', marginBottom: 8 }}>可用余额（元）</Text>
              <div style={STYLES.balanceAmount}>¥{balance.toFixed(2)}</div>
              <Text style={{ fontSize: 13, opacity: 0.7, marginTop: 8, display: 'inline-block' }}>预计到账时间：1-3个工作日</Text>
            </div>

            {/* 提现表单 */}
            <Card style={STYLES.formCard} title={<><WalletOutlined style={{ marginRight: 8 }} />提现申请</>}>
              <Form
                form={form}
                layout="vertical"
                onFinish={handleApplyWithdrawal}
                initialValues={{ method: 'alipay' }}
              >
                <Form.Item name="amount" label="提现金额（元）" rules={[{ required: true, message: '请输入提现金额' }, { type: 'number', min: 1, message: '最低提现1元' }]}>
                  <InputNumber min={1} max={balance} precision={2} placeholder="请输入金额" style={{ width: '100%' }} prefix="¥" />
                </Form.Item>
                <Form.Item name="method" label="提现方式" rules={[{ required: true }]}>
                  <Select options={[
                    { value: 'alipay', label: '支付宝' },
                    { value: 'wechat', label: '微信支付' },
                    { value: 'bank', label: '银行卡' },
                  ]} />
                </Form.Item>
                <Form.Item name="account" label="收款账号" rules={[{ required: true, message: '请输入收款账号' }]}>
                  <Input placeholder="请输入支付宝账号/微信号/银行卡号" />
                </Form.Item>
                <Form.Item name="remark" label="备注（选填）">
                  <Input.TextArea rows={2} placeholder="备注信息..." />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={withdrawing} block size="large" style={{ borderRadius: 6, height: 44, fontWeight: 600 }}>
                    申请提现
                  </Button>
                </Form.Item>
              </Form>
            </Card>

            {/* 提现记录 */}
            <div style={STYLES.tableWrap}>
              <Title level={5}>提现记录</Title>
              <Table
                dataSource={withdrawals}
                columns={[
                  { title: '申请时间', dataIndex: 'created_at', width: 170, render: (t: string) => t ? t.replace('T', ' ').substring(0, 19) : '-' },
                  { title: '金额', dataIndex: 'amount', width: 120, align: 'right' as const, render: (a: number) => <Text strong style={{ color: '#F5222D' }}>¥{Number(a).toFixed(2)}</Text> },
                  { title: '方式', dataIndex: 'method', width: 100, render: (m: string) => ({ alipay: '支付宝', wechat: '微信', bank: '银行卡' }[m] || m) },
                  { title: '状态', dataIndex: 'status', width: 100, render: (s: string) => {
                    const ws = WITHDRAWAL_STATUS_MAP[s];
                    return ws ? <Tag color={ws.color}>{ws.label}</Tag> : <Tag>{s}</Tag>;
                  }},
                  { title: '备注', dataIndex: 'remark', ellipsis: true },
                ]}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                size="small"
              />
            </div>
          </>
        );

      case 'templates':
        return (
          <>
            <Title level={4} style={STYLES.pageTitle}>爆款模板库</Title>
            <Spin spinning={templatesLoading}>
              {templates.length === 0 ? (
                <Empty description="暂无热门模板" style={{ padding: '60px 0' }} />
              ) : (
                <div style={STYLES.productGrid}>
                  {(templates || []).map((tpl) => (
                    <Card
                      key={tpl.id}
                      hoverable
                      style={STYLES.templateCard}
                      onClick={() => { setCurrentTemplate(tpl); setTemplateDetailModal(true); }}
                    >
                      <div style={{ padding: '8px 4px' }}>
                        <Text strong ellipsis={{ tooltip: tpl.title }} style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>{tpl.title}</Text>
                        {tpl.rating >= 4.5 && <Tag color="red" style={{ marginBottom: 6 }}>🔥 热门爆款</Tag>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Space size={12}>
                            <Text type="secondary" style={{ fontSize: 12 }}>评分: {tpl.rating || '-'}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>使用: {tpl.usage_count || 0}次</Text>
                          </Space>
                          <Button type="primary" size="small" ghost style={{ borderRadius: 6 }} onClick={(e) => { e.stopPropagation(); handleUseTemplate(tpl.id); }}>
                            使用模板
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Spin>

            {/* 模板详情Modal */}
            <Modal
              title={currentTemplate?.title || '模板详情'}
              open={templateDetailModal}
              onCancel={() => setTemplateDetailModal(false)}
              footer={[
                <Button key="cancel" onClick={() => setTemplateDetailModal(false)}>关闭</Button>,
                <Button key="use" type="primary" onClick={() => currentTemplate && handleUseTemplate(currentTemplate.id)} style={{ borderRadius: 6 }}>
                  立即使用
                </Button>,
              ]}
              width={600}
            >
              {currentTemplate && (
                <div>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="标题">{currentTemplate.title}</Descriptions.Item>
                    <Descriptions.Item label="描述">{currentTemplate.description || '暂无描述'}</Descriptions.Item>
                    <Descriptions.Item label="分类">{currentTemplate.category}</Descriptions.Item>
                    <Descriptions.Item label="评分">{currentTemplate.rating || '-'}</Descriptions.Item>
                    <Descriptions.Item label="使用次数">{currentTemplate.usage_count || 0}</Descriptions.Item>
                    {currentTemplate.template_content && (
                      <Descriptions.Item label="模板内容">
                        <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 6, fontSize: 12, maxHeight: 200, overflow: 'auto' }}
                          dangerouslySetInnerHTML={{ __html: sanitizeHTML(currentTemplate.template_content) }}
                        />
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </div>
              )}
            </Modal>
          </>
        );

      case 'settings':
        return (
          <>
            <Title level={4} style={STYLES.pageTitle}>账户设置</Title>
            <Card style={STYLES.formCard} title="基本信息">
              <Form layout="vertical">
                <Form.Item label="昵称"><Input placeholder="请输入昵称" /></Form.Item>
                <Form.Item label="邮箱"><Input placeholder="请输入邮箱" /></Form.Item>
                <Form.Item label="手机号"><Input placeholder="请输入手机号" /></Form.Item>
                <Form.Item><Button type="primary" style={{ borderRadius: 6 }}>保存修改</Button></Form.Item>
              </Form>
            </Card>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div style={STYLES.page}>
      <Layout style={STYLES.layout}>
        <Sider width={220} style={STYLES.siderBg}>
          <div style={{ padding: '24px 16px' }}>
            <Title level={5} style={{ textAlign: 'center', marginBottom: 24, color: '#1E293B' }}>个人中心</Title>
            <Menu
              mode="inline"
              selectedKeys={[activeMenu]}
              onClick={({ key }) => setActiveMenu(key)}
              items={MENU_ITEMS}
              style={{ border: 'none' }}
            />
          </div>
        </Sider>
        <Content style={STYLES.contentArea}>
          {renderContent()}
        </Content>
      </Layout>

      <Modal
        title={editingProduct ? '编辑产品' : '发布新产品'}
        open={productModalOpen}
        destroyOnHidden
        onCancel={() => { setProductModalOpen(false); setEditingProduct(null); }}
        footer={null}
        width={640}
      >
        <Form
          form={productForm}
          layout="vertical"
          onFinish={handleSaveProduct}
          initialValues={{ category: 'template', stock: -1, is_hot: false, is_recommend: false }}
        >
          <Form.Item name="title" label="产品标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入产品标题" style={{ borderRadius: 6 }} />
          </Form.Item>
          <Form.Item name="description" label="产品描述" rules={[{ required: true, message: '请输入描述' }]}>
            <Input.TextArea rows={3} placeholder="请输入产品详细描述" style={{ borderRadius: 6 }} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="分类" rules={[{ required: true }]}>
                <Select style={{ width: '100%', borderRadius: 6 }}
                  options={[
                    { value: 'template', label: '模板' },
                    { value: 'tool', label: '工具' },
                    { value: 'course', label: '课程' },
                    { value: 'material', label: '素材' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tags" label="标签">
                <Input placeholder="多个标签用逗号分隔" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="price" label="售价" rules={[{ required: true }]}>
                <InputNumber min={0} precision={2} style={{ width: '100%', borderRadius: 6 }} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="original_price" label="原价">
                <InputNumber min={0} precision={2} style={{ width: '100%', borderRadius: 6 }} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="stock" label="库存(-1无限)">
                <InputNumber min={-1} style={{ width: '100%', borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="is_hot" label="爆款推荐" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_recommend" label="首页推荐" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ textAlign: 'right', margin: 0, paddingTop: 16 }}>
            <Space>
              <Button onClick={() => { setProductModalOpen(false); setEditingProduct(null); }} style={{ borderRadius: 6 }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={savingProduct} icon={<EditOutlined />} style={{ borderRadius: 6 }}>
                {editingProduct ? '保存修改' : '立即发布'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserCenter;

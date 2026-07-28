import { useState, useEffect } from 'react';
import { Card, Button, Tag, Row, Col, Table, Modal, Form, Input, Select, message, Space, Statistic, Badge, Steps, Typography, Divider, Descriptions, Alert, Tooltip, Progress } from 'antd';
import { Package, ShieldCheck, Crown, Zap, Building2, CheckCircle2, ArrowRight, TrendingUp, Users, CalendarDays, FileText, Award, Phone, Mail } from 'lucide-react';
import { packageApi, type ScenarioPackage, type EnterpriseAuditService } from '@/api/packageApi';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

const { Title, Text, Paragraph } = Typography;

const TIER_COLORS: Record<string, string> = {
  essential: '#52C41A', professional: '#165DFF', enterprise: '#FA8C16', flagship: '#F53F3F',
};
const TIER_LABELS: Record<string, string> = {
  essential: '基础审计版', professional: '专业审计版', enterprise: '企业旗舰版', flagship: '至尊定制版',
};
const SCOPE_ICONS: Record<string, string> = {
  ai_content: '🤖', agent_security: '🤖', rag_compliance: '📚',
  data_classification: '🔐', api_security: '🔗', full_stack: '🏆',
};

export default function PackagesAndAudit() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState('packages');
  const [packages, setPackages] = useState<ScenarioPackage[]>([]);
  const [auditServices, setAuditServices] = useState<EnterpriseAuditService[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<ScenarioPackage | null>(null);
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<EnterpriseAuditService | null>(null);
  const [form] = Form.useForm();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [pkgRes, svcRes] = await Promise.all([
        packageApi.getFeaturedPackages(),
        packageApi.getAuditServices(),
      ]);
      setPackages(pkgRes.data.results || pkgRes.data || []);
      setAuditServices(svcRes.data.results || svcRes.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handlePurchase() {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!selectedPackage) return;
    try {
      const res = await packageApi.purchasePackage(selectedPackage.id);
      message.success(`套餐订单已创建！订单号: ${res.data.data.order_no}`);
      setPurchaseModalOpen(false);
      navigate('/order-center');
    } catch (e: any) {
      message.error(e.response?.data?.message || '购买失败');
    }
  }

  async function handleSubmitInquiry() {
    try {
      const values = await form.validateFields();
      await packageApi.submitAuditInquiry({ ...values, service_id: selectedService!.id });
      message.success('咨询已提交！我们将在24小时内联系您');
      setInquiryModalOpen(false);
      form.resetFields();
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.response?.data?.message || '提交失败');
    }
  }

  return (
    <div style={{ padding: '24px 48px', maxWidth: 1400, margin: '0 auto', background: '#F2F3F5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Package size={28} color="#165DFF" />
          <Title level={2} style={{ margin: 0 }}>场景联动 & 企业审计</Title>
          <ShieldCheck size={28} color="#FA8C16" />
        </div>
        <Paragraph style={{ fontSize: 16, color: '#86909C', maxWidth: 700, margin: '0 auto' }}>
          S+A+B 场景组合套餐，仅需单独购买价的 <Text strong style={{ color: '#F53F3F' }}>60%</Text>；
          企业级AI安全年度审计，利润率高达 <Text strong style={{ color: '#52C41A' }}>80%+</Text>
        </Paragraph>
      </div>

      {/* Tab Switch */}
      <Row gutter={16} justify="center" style={{ marginBottom: 32 }}>
        <Col>
          <Button
            type={activeTab === 'packages' ? 'primary' : 'default'}
            size="large"
            icon={<Crown size={18} />}
            onClick={() => setActiveTab('packages')}
            style={activeTab === 'packages' ? { height: 44, paddingLeft: 24, paddingRight: 24, borderRadius: 22 } : {}}
          >
            场景联动套餐
          </Button>
        </Col>
        <Col>
          <Button
            type={activeTab === 'audit' ? 'primary' : 'default'}
            size="large"
            icon={<ShieldCheck size={18} />}
            onClick={() => setActiveTab('audit')}
            style={activeTab === 'audit' ? { height: 44, paddingLeft: 24, paddingRight: 24, borderRadius: 22 } : {}}
          >
            企业安全审计服务
          </Button>
        </Col>
      </Row>

      {/* ===== SCENARIO PACKAGES TAB ===== */}
      {activeTab === 'packages' && (
        <div>
          {/* ARPU Banner */}
          <Alert
            type="info"
            showIcon icon={<TrendingUp />}
            message={
              <span>
                <strong>提升ARPU值策略：</strong> 套餐价格仅为单独购买总价的 60%，用户节省最高 40%，
                同时锁定用户1年使用权，显著提升LTV（客户终身价值）
              </span>
            }
            style={{ marginBottom: 24 }}
          />

          <Row gutter={[20, 20]}>
            {packages.map((pkg) => (
              <Col xs={24} md={12} lg={8} key={pkg.id}>
                <Card
                  hoverable
                  style={{
                    position: 'relative',
                    border: pkg.is_featured ? '2px solid #165DFF' : '1px solid #E5E6EB',
                    borderRadius: 16,
                    overflow: 'hidden',
                    height: '100%',
                  }}
                >
                  {pkg.is_featured && (
                    <div style={{ position: 'absolute', top: -1, right: 20, background: '#165DFF', color: '#fff', padding: '4px 16px', borderRadius: '0 0 10px 10px', fontSize: 12, fontWeight: 600 }}>
                      🔥 推荐
                    </div>
                  )}

                  {/* Tier Badges */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    {(pkg.tier_badges || []).map(badge => (
                      <Tag key={badge} style={{ fontSize: 13, padding: '4px 10px' }}>{badge}</Tag>
                    ))}
                  </div>

                  <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>{pkg.name}</Title>
                  <Paragraph ellipsis={{ rows: 2 }} style={{ color: '#86909C', fontSize: 14, minHeight: 44 }}>
                    {pkg.description}
                  </Paragraph>

                  {/* Price Section */}
                  <div style={{ background: 'linear-gradient(135deg, #FFF7E6 0%, #FFFFFF 100%)', padding: 16, borderRadius: 12, margin: '16px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                      <Text delete style={{ color: '#86909C', fontSize: 14 }}>¥{pkg.original_total_price}</Text>
                      <Text style={{ fontSize: 32, fontWeight: 800, color: '#F53F3F' }}>¥{pkg.package_price}</Text>
                      <Tag color="red" style={{ marginLeft: 'auto' }}>省 ¥{pkg.saved_amount}</Tag>
                    </div>
                    <Progress percent={pkg.discount_percent} strokeColor="#52C41A" showInfo={false} size="small" />
                    <Text type="secondary" style={{ fontSize: 12 }}>仅相当于单独购买价的 {pkg.discount_percent}%</Text>
                  </div>

                  {/* Included Features */}
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>包含权益：</Text>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      {(pkg.included_features || []).slice(0, 5).map(feat => (
                        <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <CheckCircle2 size={14} color="#52C41A" />{feat}
                        </div>
                      ))}
                      {(pkg.included_features || []).length > 5 && (
                        <Text type="secondary" style={{ fontSize: 12 }}>+{(pkg.included_features || []).length - 5}项更多...</Text>
                      )}
                    </Space>
                  </div>

                  {/* Meta Info */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 13, color: '#86909C' }}>
                    <span><CalendarDays size={14} /> {pkg.validity_days}天有效</span>
                    <span><Users size={14} /> 最多{pkg.max_users}人</span>
                    <span><Zap size={14} /> 已售{pkg.sales_count}</span>
                  </div>

                  <Button
                    type="primary"
                    block
                    size="large"
                    icon={<Package />}
                    onClick={() => { setSelectedPackage(pkg); setPurchaseModalOpen(true); }}
                    style={{ borderRadius: 10, height: 46, fontWeight: 600, fontSize: 15 }}
                  >
                    立即购买 — 立省 ¥{pkg.saved_amount}
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Value Comparison */}
          <Card title={<span><TrendingUp /> 套餐价值对比</span>} style={{ marginTop: 24 }}>
            <Table dataSource={packages} rowKey="id" pagination={false} size="middle"
              columns={[
                { title: '套餐名称', dataIndex: 'name', width: 250 },
                { title: '原价合计', dataIndex: 'original_total_price', render: (v: string) => `¥${v}` },
                { title: '套餐价', dataIndex: 'package_price', render: (v: string) => <Text strong style={{ color: '#F53F3F' }}>¥{v}</Text> },
                { title: '折扣比例', dataIndex: 'discount_percent', render: (v: number) => <Tag color="green">{v}%</Tag> },
                { title: '节省金额', dataIndex: 'saved_amount', render: (v: string) => <Text type="success">-¥{v}</Text> },
                { title: 'ARPU提升', render: () => <Text type="warning">+67%</Text> },
              ]}
            />
          </Card>
        </div>
      )}

      {/* ===== ENTERPRISE AUDIT TAB ===== */}
      {activeTab === 'audit' && (
        <div>
          {/* Profit Margin Banner */}
          <Alert
            type="warning"
            showIcon icon={<Award />}
            message={
              <span>
                <strong>高利润率产品线：</strong> 基础审计服务起价 ¥50,000/年，成本约 ¥10,000（技术人力），
                利润率稳定在 <strong>80%</strong> 以上。企业旗舰版（全栈审计）报价 ¥150,000/年，利润率可达 <strong>85%</strong>
              </span>
            }
            style={{ marginBottom: 24 }}
          />

          {/* Service Cards */}
          <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
            {auditServices.filter(s => s.is_recommended).map(svc => (
              <Col xs={24} lg={12} key={svc.id}>
                <Card
                  hoverable
                  style={{
                    border: svc.is_recommended ? '2px solid #FA8C16' : '1px solid #E5E6EB',
                    borderRadius: 16,
                    height: '100%',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 24 }}>{SCOPE_ICONS[svc.scope] || '🛡️'}</span>
                        <Title level={4} style={{ margin: 0 }}>{svc.name}</Title>
                      </div>
                      <Space size={8}>
                        <Tag color={TIER_COLORS[svc.audit_tier]}>{svc.tier_display}</Tag>
                        <Tag>{svc.scope_display}</Tag>
                        {svc.is_recommended && <Badge count="推荐" style={{ backgroundColor: '#FA8C16' }} />}
                      </Space>
                    </div>
                  </div>

                  <Paragraph ellipsis={{ rows: 3 }} style={{ color: '#4E5969', fontSize: 14, marginBottom: 16 }}>
                    {svc.description}
                  </Paragraph>

                  {/* Pricing */}
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={12}>
                      <Statistic title="基础价格" value={Number(svc.base_price)} prefix="¥" suffix="/年"
                        valueStyle={{ fontSize: 22, color: '#165DFF' }} />
                    </Col>
                    <Col span={12}>
                      <Statistic title="利润率" value={svc.profit_margin} suffix="%"
                        valueStyle={{ fontSize: 22, color: '#52C41A' }} />
                    </Col>
                  </Row>

                  {/* Deliverables */}
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>交付物：</Text>
                    <Space wrap size={[4, 8]}>
                      {(svc.deliverables || []).map(d => (
                        <Tag key={d} color="blue" style={{ fontSize: 12 }}><FileText size={12} /> {d}</Tag>
                      ))}
                    </Space>
                  </div>

                  {/* Service Details Grid */}
                  <Row gutter={[12, 8]} style={{ marginBottom: 16, fontSize: 13 }}>
                    <Col span={8}><CalendarDays size={14} /> {svc.audit_days}工作日</Col>
                    <Col span={8}><Building2 size={14} /> 现场{svc.on_site_visits}次</Col>
                    <Col span={8}><FileText size={14} /> 报告{svc.report_count}份</Col>
                  </Row>

                  <Row gutter={[12, 8]} style={{ marginBottom: 16, fontSize: 13 }}>
                    <Col span={8}>
                      <Tag color={svc.includes_remediation ? 'success' : 'default'}>整改建议</Tag>
                    </Col>
                    <Col span={8}>
                      <Tag color={svc.includes_certification ? 'success' : 'default'}>认证辅导</Tag>
                    </Col>
                    <Col span={8}>
                      <Tag color={svc.includes_training ? 'success' : 'default'}>培训服务</Tag>
                    </Col>
                  </Row>

                  {/* Compliance Standards */}
                  <div style={{ marginBottom: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>符合标准：</Text>
                    <Space wrap size={4}>
                      {(svc.compliance_standards || []).map(std => (
                        <Tag key={std} style={{ fontSize: 11 }}>{std}</Tag>
                      ))}
                    </Space>
                  </div>

                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                    适用规模：{svc.target_company_size} | 聚焦行业：{(svc.industry_focus || []).join(' / ')}
                  </Text>

                  <Button
                    type="primary"
                    block
                    size="large"
                    icon={<Phone size={18} />}
                    onClick={() => { setSelectedService(svc); setInquiryModalOpen(true); }}
                    style={{
                      borderRadius: 10, height: 46,
                      background: svc.is_recommended ? 'linear-gradient(135deg, #FA8C16, #FF7D00)' : undefined,
                      borderColor: 'transparent',
                      fontWeight: 600,
                    }}
                  >
                    立即咨询 — ¥{(Number(svc.base_price) / 10000).toFixed(0)}万/年起
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>

          {/* All Services Table */}
          <Card title={<span><ShieldCheck /> 全部审计服务定价矩阵</span>} style={{ marginTop: 16 }}>
            <Table dataSource={auditServices} rowKey="id" pagination={false} size="middle"
              columns={[
                { title: '服务名称', dataIndex: 'name', width: 280 },
                { title: '级别', dataIndex: 'tier_display', width: 90,
                  render: (t: string, r: EnterpriseAuditService) =>
                    <Tag color={TIER_COLORS[r.audit_tier]}>{t}</Tag> },
                { title: '范围', dataIndex: 'scope_display', width: 120 },
                { title: '基础价格', dataIndex: 'base_price', width: 110,
                  render: (p: string) => <Text strong>¥{Number(p).toLocaleString()}</Text> },
                { title: '最低报价', dataIndex: 'min_price', width: 110,
                  render: (p: string) => <Text>¥{Number(p).toLocaleString()}</Text> },
                { title: '利润率', dataIndex: 'profit_margin', width: 80,
                  render: (m: number) => <Progress percent={m} size="small" format={() => `${m}%`} /> },
                { title: '审计周期', dataIndex: 'audit_days', width: 80,
                  render: (d: number) => `${d}工作日` },
                { title: '现场次数', dataIndex: 'on_site_visits', width: 70 },
                { title: '报告数量', dataIndex: 'report_count', width: 70 },
                { title: '整改+认证+培训', width: 160,
                  render: (_: any, r: EnterpriseAuditService) => (
                    <Space size={2}>
                      {r.includes_remediation && <Tag color="success" size="small">整改</Tag>}
                      {r.includes_certification && <Tag color="orange" size="small">认证</Tag>}
                      {r.includes_training && <Tag color="blue" size="small">培训</Tag>}
                    </Space>
                  )},
              ]}
            />

            <Divider />

            {/* Stats Summary */}
            <Row gutter={[24, 16]} justify="center">
              <Col>
                <Statistic title="服务总数" value={auditServices.length} prefix={<ShieldCheck />} />
              </Col>
              <Col>
                <Statistic title="最低起步价" value={50000} prefix="¥" suffix="/年" valueStyle={{ color: '#165DFF' }} />
              </Col>
              <Col>
                <Statistic title="平均利润率" value={
                  Math.round(auditServices.reduce((sum, s) => sum + s.profit_margin, 0) / auditServices.length)
                } suffix="%" valueStyle={{ color: '#52C41A' }} />
              </Col>
              <Col>
                <Statistic title="最高客单价" value={150000} prefix="¥" suffix="/年" valueStyle={{ color: '#FA8C16' }} />
              </Col>
            </Row>
          </Card>
        </div>
      )}

      {/* Purchase Modal */}
      <Modal
        title={`购买：${selectedPackage?.name}`}
        open={purchaseModalOpen}
        onOk={handlePurchase}
        onCancel={() => setPurchaseModalOpen(false)}
        okText="确认购买"
        cancelText="取消"
        width={520}
      >
        {selectedPackage && (
          <div>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="S级场景">{selectedPackage.s_scenario_name || '—'} (¥{selectedPackage.s_scenario_price})</Descriptions.Item>
              <Descriptions.Item label="A级场景">{selectedPackage.a_scenario_name || '—'} (¥{selectedPackage.a_scenario_price})</Descriptions.Item>
              <Descriptions.Item label="B级场景（可选）">
                <Select placeholder="选择一个B级增强场景（可选）" style={{ width: '100%' }} allowClear>
                  {(selectedPackage.b_scenarios_list || []).map(b => (
                    <Select.Option key={b.id} value={b.id}>{b.title} (¥{b.price})</Select.Option>
                  ))}
                </Select>
              </Descriptions.Item>
              <Descriptions.Item label="原价合计"><Text delete>¥{selectedPackage.original_total_price}</Text></Descriptions.Item>
              <Descriptions.Item label="套餐价"><Text strong style={{ color: '#F53F3F', fontSize: 18 }}>¥{selectedPackage.package_price}</Text></Descriptions.Item>
              <Descriptions.Item label="节省金额"><Text type="success" style={{ fontSize: 16 }}>¥{selectedPackage.saved_amount}</Text></Descriptions.Item>
              <Descriptions.Item label="有效期">{selectedPackage.validity_days}天</Descriptions.Item>
            </Descriptions>
            <Alert type="info" showIcon message="购买后系统将自动创建订单，可在订单中心查看并支付" />
          </div>
        )}
      </Modal>

      {/* Inquiry Modal */}
      <Modal
        title={`咨询服务：${selectedService?.name}`}
        open={inquiryModalOpen}
        onCancel={() => setInquiryModalOpen(false)}
        footer={null}
        width={560}
      >
        {selectedService && (
          <div>
            <Alert
              type="info"
              showIcon
              message={`基础报价：¥${Number(selectedService.base_price).toLocaleString()}/年 | 审计周期：${selectedService.audit_days}工作日`}
              style={{ marginBottom: 16 }}
            />
            <Form form={form} layout="vertical" onFinish={handleSubmitInquiry}>
              <Form.Item name="company_name" label="企业名称" rules={[{ required: true, message: '请输入企业名称' }]}>
                <Input prefix={<Building2 size={16} />} placeholder="请输入您的企业全称" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="contact_person" label="联系人" rules={[{ required: true, message: '请输入联系人姓名' }]}>
                    <Input placeholder="您的姓名" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="contact_phone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
                    <Input prefix={<Phone size={16} />} placeholder="手机号码" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="contact_email" label="电子邮箱" rules={[{ required: true, type: 'email', message: '请输入有效的邮箱地址' }]}>
                <Input prefix={<Mail size={16} />} placeholder="用于接收方案和报价" />
              </Form.Item>
              <Form.Item name="employee_count" label="企业人数（可选）">
                <Select placeholder="选择大致规模">
                  <Select.Option value="<50">50人以下</Select.Option>
                  <Select.Option value="50-200">50-200人</Select.Option>
                  <Select.Option value="200-500">200-500人</Select.Option>
                  <Select.Option value="500-2000">500-2000人</Select.Option>
                  <Select.Option value=">2000">2000人以上</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="industry" label="所属行业（可选）">
                <Input placeholder="如：金融科技、医疗健康、政务等" />
              </Form.Item>
              <Form.Item name="requirements" label="特殊需求描述（可选）">
                <Input.TextArea rows={3} placeholder="请简要描述您的安全审计需求或关注点..." />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block size="large" icon={<Mail size={18} />}>
                  提交咨询 — 我们24小时内联系您
                </Button>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}

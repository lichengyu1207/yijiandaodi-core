import { useState, useEffect } from 'react';
import { Card, Button, Tag, Modal, Select, Input, InputNumber, DatePicker, message, Table, Progress, Row, Col, Alert, Empty, Badge, Statistic, Descriptions, Tabs, Timeline, Form, Switch, Slider, Space, Tooltip } from 'antd';
import {
  Building2, ShieldAlert, CheckCircle2,
  FileText, Sparkles, Activity, Bell, Settings, Gauge,
  TrendingUp, Users, Lock, Eye, Clock, Target, Radar,
  BarChart3, PieChart as PieChartIcon, LineChart, Database,
  ChevronRight, Zap, Bug, Search, Download, PlayCircle,
  RefreshCw, ShieldCheck, XCircle, Info, AlertTriangle,
} from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { cScenarioApi, type EnterpriseAuditItem } from '@/api/cScenarioApi';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const AUDIT_SCOPES = [
  { value: 'full_content', label: '全量内容审计' }, { value: 'ai_generated_only', label: '仅AI生成检测' },
  { value: 'sensitive_data', label: '敏感数据审计' }, { value: 'compliance_focused', label: '合规专项审计' },
  { value: 'custom', label: '自定义范围' },
];
const FREQUENCIES = [
  { value: 'realtime', label: '实时监控' }, { value: 'hourly', label: '每小时' },
  { value: 'daily', label: '每日' }, { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' }, { value: 'manual', label: '手动触发' },
];
const SEVERITY_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  critical: { color: '#F53F3F', icon: <XCircle size={14} />, label: '严重' },
  high: { color: '#FF7D00', icon: <AlertTriangle size={14} />, label: '高' },
  medium: { color: '#FA8C16', icon: <AlertTriangle size={14} />, label: '中' },
  low: { color: '#86909C', icon: <Info size={14} />, label: '低' },
  info: { color: '#165DFF', icon: <Info size={14} />, label: '信息' },
};

export default function EnterpriseAuditPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [list, setList] = useState<EnterpriseAuditItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [current, setCurrent] = useState<EnterpriseAuditItem | null>(null);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState('dashboard');

  const [form] = Form.useForm();

  useEffect(() => { loadData(); loadStats(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await cScenarioApi.enterpriseAudit.list({ limit: 50 });
      setList(Array.isArray(res.data.results) ? res.data.results : Array.isArray(res.data) ? res.data : []);
    } catch { setList([]); }
    setLoading(false);
  }

  async function loadStats() {
    try { setStats((await cScenarioApi.enterpriseAudit.stats()).data); } catch {}
  }

  async function handleRunAudit() {
    if (!isAuthenticated) { navigate('/login'); return; }
    await form.validateFields();
    const values = form.getFieldsValue();
    setAuditing(true);
    try {
      const res = await cScenarioApi.enterpriseAudit.runAudit({
        enterprise_name: values.enterprise_name,
        industry: values.industry || '',
        employee_count: values.employee_count || 0,
        contact_person: values.contact_person,
        contact_email: values.contact_email,
        audit_name: values.audit_name,
        audit_scope: values.audit_scope,
        scheduled_frequency: values.scheduled_frequency || 'manual',
        audit_config: { keywords: values.keywords || '', rules: values.rules || '' },
        contract_value: values.contract_value || null,
        audit_period_start: values.audit_period_start?.format('YYYY-MM-DD') || null,
        audit_period_end: values.audit_period_end?.format('YYYY-MM-DD') || null,
      });
      message.success(`企业安全审计完成！发现 ${res.data.data.risk_items_found} 个风险项`);
      setCurrent(res.data.data); setDetailOpen(true);
      form.resetFields(); loadData(); loadStats();
    } catch (e: any) { message.error(e.response?.data?.detail || e.message || '审计失败'); }
    setAuditing(false);
  }

  function openDetail(r: EnterpriseAuditItem) { setCurrent(r); setDetailOpen(true); }

  const columns: ColumnsType<EnterpriseAuditItem> = [
    { title: '企业名称', dataIndex: 'enterprise_name', width: 150, ellipsis: true },
    { title: '审计任务', dataIndex: 'audit_name', width: 160, ellipsis: true },
    { title: '范围', width: 120, render: (_, r) => <Tag color="blue">{r.scope_display}</Tag> },
    { title: '风险评分', width: 90, render: (_, r) => {
      const score = r.overall_risk_score;
      return <span style={{ fontWeight: 700, fontSize: 15, color: score > 70 ? '#F53F3F' : score > 40 ? '#FA8C16' : '#00B42A' }}>{score}</span>;
    }},
    { title: '合规分', width: 80, render: (_, r) => <span style={{ fontWeight: 600 }}>{r.compliance_score}</span> },
    { title: '风险项', width: 80, render: (_, r) => <Badge count={r.risk_items_found} style={{ backgroundColor: r.risk_items_found > 0 ? '#F53F3F' : '#00B42A' }} /> },
    { title: '状态', width: 90, render: (_, r) => <Badge status={r.status === 'completed' ? 'success' : r.status === 'running' ? 'processing' : 'default'} text={r.status === 'completed' ? '已完成' : r.status === 'running' ? '审计中' : r.status === 'configured' ? '已配置' : r.status} /> },
    { title: '合同金额', width: 100, render: (_, r) => r.contract_value ? `¥${Number(r.contract_value).toLocaleString()}` : '-' },
    { title: '操作', width: 80, fixed: 'right', render: (_, r) => <Button type="link" icon={<Eye />} onClick={() => openDetail(r)}>详情</Button> },
  ];

  const alertColumns: ColumnsType<any> = [
    { title: '严重程度', width: 90, render: (_, r) => {
      const s = SEVERITY_CONFIG[r.severity]; return s ? <Tag color={s.color} style={{ borderRadius: 6 }}>{s.icon} {s.label}</Tag> : '-';
    }},
    { title: '类型', width: 130, dataIndex: 'alert_type' },
    { title: '标题', ellipsis: true, dataIndex: 'title' },
    { title: '状态', width: 80, dataIndex: 'status', render: (s: string) =>
      <Badge status={s === 'active' ? 'error' : s === 'resolved' ? 'success' : 'default'} text={s === 'active' ? '活跃' : s === 'resolved' ? '已解决' : s} /> },
    { title: '时间', width: 160, dataIndex: 'created_at', render: (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '-' },
  ];

  return (
    <div style={{ padding: '24px 48px', maxWidth: 1440, margin: '0 auto', background: '#F2F3F5', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{
        textAlign: 'center', marginBottom: 28, padding: '34px 28px',
        background: 'linear-gradient(135deg, #0d1b2a 0%, #1b263b 40%, #415a77 100%)',
        borderRadius: 16, color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -10, width: 240, height: 240, background: 'rgba(245,63,63,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -20, width: 200, height: 200, background: 'rgba(22,93,255,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Building2 size={26} color="#4FC3F7" />
            <Tag color="#4FC3F7" style={{ borderRadius: 20, fontWeight: 700, border: 'none', color: '#0d1b2a' }}>C级独家场景</Tag>
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>企业级 AI 内容安全审计</h1>
          <p style={{ margin: '8px 0 0', fontSize: 15, opacity: 0.9, maxWidth: 760, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 }}>
            全量内容审计 · 实时监控 · 风险告警 · 合规对标(等保2.0/ISO27001/PIPL) · 高管仪表盘
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
            {[{ label: '企业客户≥20家', icon: <Building2 /> }, { label: '6大审计模块', icon: <ShieldAlert /> },
              { label: '实时风险告警', icon: <Bell /> }, { label: '等保2.0对标', icon: <Lock /> }].map((item, i) =>
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, opacity: 0.92 }}>{item.icon}<span>{item.label}</span></div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
        {[
          { label: '审计任务总数', value: stats.total || 0, icon: Database, color: '#165DFF', bg: '#E8F3FF' },
          { label: '运行中', value: stats.running || 0, icon: RefreshCw, color: '#FA8C16', bg: '#FFF7E8' },
          { label: '活跃告警', value: stats.active_alerts || 0, icon: Bell, color: '#F53F3F', bg: '#FFECE8' },
          { label: '严重告警', value: stats.critical_active || 0, icon: XCircle, color: '#F53F3F', bg: '#FFECE8' },
        ].map((card, i) => (
          <Col xs={12} sm={6} key={i}>
            <Card size="small" style={{ borderRadius: 10, borderLeft: `4px solid ${card.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <card.icon size={17} style={{ color: card.color }} />
                </div>
                <div><div style={{ fontSize: 24, fontWeight: 800, color: '#1D2129' }}>{card.value}</div><div style={{ fontSize: 11, color: '#86909C' }}>{card.label}</div></div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Main Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} size="large" style={{ marginBottom: 24 }}
        items={[
          { key: 'dashboard', label: <span><BarChart3 /> 监控仪表盘</span> },
          { key: 'new-audit', label: <span><PlayCircle /> 发起审计</span> },
          { key: 'history', label: <span><Database /> 审计历史</span> },
          { key: 'alerts', label: <span><Bell /> 告警中心</span> },
        ]}
      />

      {/* Tab Content */}
      {activeTab === 'new-audit' && (
        <Row gutter={24}>
          <Col xs={24} lg={14}>
            <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#165DFF' }}><Settings size={18} /> 审计配置</span>}
              style={{ borderRadius: 14 }} styles={{ header: { borderBottom: '2px solid rgba(22,93,255,0.2)' } }}>
              <Form form={form} layout="vertical" size="large">
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="enterprise_name" label="企业名称 *" rules={[{ required: true }]}>
                      <Input placeholder="如：XX科技有限公司" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="industry" label="行业领域">
                      <Input placeholder="如：金融/医疗/教育/互联网/制造" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="employee_count" label="员工规模"><InputNumber min={1} style={{ width: '100%' }} placeholder="人数" /></Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="contact_person" label="负责人 *" rules={[{ required: true }]}>
                      <Input placeholder="姓名" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="contact_email" label="联系邮箱 *" rules={[{ required: true, type: 'email' }]}>
                      <Input placeholder="email@example.com" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="audit_name" label="审计任务名称 *" rules={[{ required: true }]}>
                  <Input placeholder="如：2025年度Q1 AI内容安全审计" />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="audit_scope" label="审计范围 *" rules={[{ required: true }]}>
                      <Select options={AUDIT_SCOPES} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="scheduled_frequency" label="监控频率">
                      <Select options={FREQUENCIES} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="contract_value" label="合同金额(元/年)">
                      <InputNumber min={50000} step={10000} style={{ width: '100%' }} placeholder="≥50000" formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="audit_period_start" label="审计周期起始">
                      <DatePicker style={{ width: '100%' }} format='YYYY-MM-DD' />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="audit_period_end" label="审计周期结束">
                      <DatePicker style={{ width: '100%' }} format='YYYY-MM-DD' />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="keywords" label="敏感关键词(逗号分隔)">
                  <Input.TextArea rows={2} placeholder="如：密码,API Key,身份证,银行卡,商业秘密..." />
                </Form.Item>
                <Form.Item name="rules" label="自定义规则">
                  <Input.TextArea rows={2} placeholder="自定义审计规则描述..." />
                </Form.Item>

                <Button type="primary" size="large" block loading={auditing} icon={<Sparkles />} onClick={handleRunAudit}
                  style={{ borderRadius: 10, height: 48, fontSize: 16, fontWeight: 700, background: 'linear-gradient(135deg, #165DFF, #36CFC9)' }}>
                  {auditing ? '正在执行全量审计...' : '🚀 启动企业安全审计'}
                </Button>
              </Form>
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title={<span style={{ fontSize: 15, fontWeight: 700 }}>📋 审计能力矩阵</span>} style={{ borderRadius: 14, height: '100%' }}>
              {[
                { module: '① 全量内容扫描', desc: '文档/邮件/聊天/代码分类+敏感信息发现+L1-L4分级', icon: Database, color: '#165DFF' },
                { module: '② AI生成监控', desc: '实时API检测+内部AI使用率+外部发布审核+工具合规', icon: Zap, color: '#722ED1' },
                { module: '③ 数据泄露检测', desc: 'PII暴露+商业秘密保护+跨境传输+权限异常', icon: ShieldAlert, color: '#F53F3F' },
                { module: '④ 合规对标', desc: '网安法+数据安全法+PIPL+等保2.0三级+ISO27001', icon: Scale, color: '#00B42A' },
                { module: '⑤ 安全态势感知', desc: '风险热力图+趋势分析+TOP排行+整改闭环', icon: Radar, color: '#FA8C16' },
                { module: '⑥ 高管报告', desc: 'C级一页纸+ROI量化+影响评估+行动建议', icon: BarChart3, color: '#36CFC9' },
              ].map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 16px', background: i % 2 === 0 ? '#FAFBFC' : '#FFF', borderRadius: 10, marginBottom: 10, borderLeft: `4px solid ${m.color}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${m.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <m.icon size={18} style={{ color: m.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1D2129' }}>{m.module}</div>
                    <div style={{ fontSize: 12.5, color: '#86909C', marginTop: 2 }}>{m.desc}</div>
                  </div>
                </div>
              ))}
            </Card>
          </Col>
        </Row>
      )}

      {(activeTab === 'history') && (
        <Card style={{ borderRadius: 14 }} extra={<Button size="small" icon={<RefreshCw />} onClick={() => loadData()}>刷新</Button>}>
          <Table columns={columns} dataSource={list} rowKey="id" size="middle"
            pagination={{ pageSize: 8, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 1100 }} loading={loading} />
        </Card>
      )}

      {activeTab === 'alerts' && (
        <Card title={<span style={{ fontSize: 15, fontWeight: 700 }}>🔔 告警中心</span>} style={{ borderRadius: 14 }}
          extra={<Space><Tag color="red">严重 {stats.critical_active || 0}</Tag><Tag color="orange">高 {stats.active_alerts ? Math.max(0, (stats.active_alerts || 0) - (stats.critical_active || 0)) : 0}</Tag></Space>}>
          <Table columns={alertColumns}
            dataSource={(list.flatMap((a: any) => (a.active_alerts || []).map((al: any) => ({ ...al, _auditId: a.id }))) || [])}
            rowKey={(r) => r.alert_id || r.id} size="middle"
            pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条告警` }} scroll={{ x: 700 }}
            locale={{ emptyText: <Empty description="暂无告警记录，发起审计后自动生成" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '60px 0' }} /> }}
          />
        </Card>
      )}

      {activeTab === 'dashboard' && (
        <div>
          {!current ? (
            <Empty description={<span style={{ color: '#86909C' }}>请先在「发起审计」页面创建并执行一次审计任务，即可在此查看监控仪表盘</span>}
              image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '80px 0' }} />
          ) : (
            <Row gutter={[20, 20]}>
              {/* Risk Score */}
              <Col span={24}>
                <Card style={{ borderRadius: 14, background: current.overall_risk_score > 60 ? '#FFF1F0' : current.overall_risk_score > 30 ? '#FFF7E8' : '#F6FFED', border: `2px solid ${current.overall_risk_score > 60 ? '#F53F3F' : current.overall_risk_score > 30 ? '#FA8C16' : '#00B42A'}` }}>
                  <Row align="middle" gutter={24}>
                    <Col>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, color: '#86909C', marginBottom: 4 }}>综合风险评分</div>
                        <div style={{ fontSize: 52, fontWeight: 900, color: current.overall_risk_score > 60 ? '#F53F3F' : current.overall_risk_score > 30 ? '#FA8C16' : '#00B42A' }}>{current.overall_risk_score}</div>
                      </div>
                    </Col>
                    <Col flex="auto">
                      <Row gutter={[16, 12]}>
                        {[
                          ['合规评分', current.compliance_score, '#00B42A'],
                          ['扫描项目', current.total_items_scanned, '#165DFF'],
                          ['风险项数', current.risk_items_found, '#F53F3F'],
                          ['严重风险', current.critical_count, '#F53F3F'],
                          ['高风险', current.high_count, '#FF7D00'],
                          ['中风险', current.medium_count, '#FA8C16'],
                          ['低风险', current.low_count, '#86909C'],
                          ['活跃告警', (current.active_alerts || []).length, '#F53F3F'],
                        ].map(([label, val, color], i) => (
                          <Col span={6} key={i}>
                            <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.7)', borderRadius: 8 }}>
                              <div style={{ fontSize: 20, fontWeight: 800, color }}>{val ?? 0}</div>
                              <div style={{ fontSize: 11, color: '#86909C' }}>{label}</div>
                            </div>
                          </Col>
                        ))}
                      </Row>
                    </Col>
                  </Row>
                </Card>
              </Col>

              {/* Alerts */}
              {(current.active_alerts || []).length > 0 && (
                <Col span={24}>
                  <Card title={`🚨 活跃告警 (${(current.active_alerts || []).length})`} style={{ borderRadius: 14 }}>
                    <Timeline mode="left" items={
                      (current.active_alerts as any[]).map((alert: any, i: number) => ({
                        color: SEVERITY_CONFIG[alert.severity]?.color || '#86909C',
                        children: (<div key={i}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <Tag color={SEVERITY_CONFIG[alert.severity]?.color || '#86909C'} style={{ borderRadius: 4, fontWeight: 600 }}>{SEVERITY_CONFIG[alert.severity]?.label || alert.severity}</Tag>
                            <strong>{alert.title}</strong>
                          </div>
                          <p style={{ margin: 0, fontSize: 13, color: '#4E5969', lineHeight: 1.6 }}>{alert.description || ''}</p>
                          {alert.remediation_recommendation && (
                            <div style={{ marginTop: 6, padding: '6px 10px', background: '#E8FFEA', borderRadius: 6, fontSize: 12, color: '#00B42A' }}>
                              💡 建议: {alert.remediation_recommendation}
                            </div>
                          )}
                        </div>),
                      }))
                    } />
                  </Card>
                </Col>
              )}

              {/* Compliance */}
              {Object.keys(current.compliance_standards || {}).length > 0 && (
                <Col span={24}>
                  <Card title="📋 合规对标结果" style={{ borderRadius: 14 }}>
                    <Row gutter={[16, 12]}>
                      {Object.entries(current.compliance_standards).map(([std, data]: [string, any], i) => (
                        <Col xs={12} md={6} key={i}>
                          <div style={{ padding: '14px', background: '#FAFBFC', borderRadius: 10, textAlign: 'center' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1D2129', marginBottom: 6 }}>{std.replace(/_/g, ' ').toUpperCase()}</div>
                            <Progress type="circle" percent={data.score || 0} size={64}
                              strokeColor={data.score >= 80 ? '#00B42A' : data.score >= 50 ? '#FA8C16' : '#F53F3F'} />
                            {(data.gaps || []).length > 0 && (
                              <div style={{ fontSize: 11, color: '#F53F3F', marginTop: 4 }}>{data.gaps.length} 项差距</div>
                            )}
                          </div>
                        </Col>
                      ))}
                    </Row>
                  </Card>
                </Col>
              )}
            </Row>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700, color: '#165DFF' }}>
          <Building2 /> 企业审计报告 — {current?.enterprise_name}
        </span>}
        open={detailOpen} onCancel={() => setDetailOpen(false)} destroyOnHidden width={900}
        footer={[<Button key="close" type="primary" onClick={() => setDetailOpen(false)} style={{ borderRadius: 7 }}>关闭</Button>]}>
        {current && (() => {
          const alerts = current.active_alerts || [];
          const compliance = typeof current.compliance_standards === 'object' ? current.compliance_standards : {};

          return (
            <div>
              <Descriptions bordered column={2} size="small" style={{ marginBottom: 18 }}>
                <Descriptions.Item label="企业名称">{current.enterprise_name}</Descriptions.Item>
                <Descriptions.Item label="审计任务">{current.audit_name}</Descriptions.Item>
                <Descriptions.Item label="审计范围">{current.scope_display}</Descriptions.Item>
                <Descriptions.Item label="监控频率">{current.scheduled_frequency}</Descriptions.Item>
                <Descriptions.Item label="综合风险评分"><strong style={{ color: current.overall_risk_score > 60 ? '#F53F3F' : '#00B42A', fontSize: 18 }}>{current.overall_risk_score}</strong></Descriptions.Item>
                <Descriptions.Item label="合规评分"><strong style={{ color: current.compliance_score >= 80 ? '#00B42A' : '#FA8C16', fontSize: 18 }}>{current.compliance_score}</strong></Descriptions.Item>
                <Descriptions.Item label="扫描项目">{current.total_items_scanned}</Descriptions.Item>
                <Descriptions.Item label="风险项">{current.risk_items_found}</Descriptions.Item>
                <Descriptions.Item label="严重">{current.critical_count}</Descriptions.Item>
                <Descriptions.Item label="高">{current.high_count}</Descriptions.Item>
                <Descriptions.Item label="中">{current.medium_count}</Descriptions.Item>
                <Descriptions.Item label="低">{current.low_count}</Descriptions.Item>
                <Descriptions.Item label="合同金额" span={2}>{current.contract_value ? `¥${Number(current.contract_value).toLocaleString()}/年` : '-'}</Descriptions.Item>
              </Descriptions>

              {/* Severity Distribution */}
              <Row gutter={[12, 12]} style={{ marginBottom: 18 }}>
                {[
                  ['严重', current.critical_count, '#F53F3F'], ['高', current.high_count, '#FF7D00'],
                  ['中', current.medium_count, '#FA8C16'], ['低', current.low_count, '#86909C'],
                ].map(([label, val, color]) => (
                  <Col xs={12} sm={6} key={String(label)}>
                    <div style={{ textAlign: 'center', padding: '14px 10px', background: `${color}10`, borderRadius: 10, border: `1px solid ${color}30` }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color }}>{val}</div>
                      <div style={{ fontSize: 12, color: '#86909C' }}>{String(label)}风险</div>
                    </div>
                  </Col>
                ))}
              </Row>

              {/* Active Alerts in Modal */}
              {alerts.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>🚨 活跃告警 ({alerts.length})</h4>
                  {(alerts as any[]).map((alert: any, i: number) => {
                    const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
                    return (
                      <div key={i} style={{ padding: '12px 16px', background: i % 2 === 0 ? '#FAFBFC' : '#FFF', borderRadius: 8, marginBottom: 6, borderLeft: `4px solid ${sev.color}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Tag color={sev.color} style={{ borderRadius: 4, fontWeight: 600 }}>{sev.icon} {sev.label}</Tag>
                          <strong>{alert.alert_type}: {alert.title}</strong>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4E5969', lineHeight: 1.6 }}>{alert.description}</p>
                        {alert.affected_resource && <div style={{ fontSize: 12, color: '#86909C', marginTop: 4 }}>📍 资源: {alert.affected_resource}</div>}
                        {alert.regulatory_reference && <div style={{ fontSize: 12, color: '#165DFF', marginTop: 2 }}>📜 法规: {alert.regulatory_reference}</div>}
                        {alert.remediation_recommendation && <div style={{ marginTop: 6, padding: '6px 10px', background: '#E8FFEA', borderRadius: 6, fontSize: 12, color: '#00B42A' }}>💡 {alert.remediation_recommendation}</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Compliance Standards */}
              {Object.keys(compliance).length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>📋 合规对标详情</h4>
                  {Object.entries(compliance).map(([std, data]: [string, any], i) => (
                    <div key={i} style={{ padding: '12px 16px', background: '#FAFBFC', borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <strong style={{ fontSize: 14 }}>{std.replace(/_/g, ' ').toUpperCase()}</strong>
                        <Progress percent={data.score || 0} size="small"
                          style={{ width: 120 }} strokeColor={data.score >= 80 ? '#00B42A' : data.score >= 50 ? '#FA8C16' : '#F53F3F'} />
                      </div>
                      {(data.gaps || []).length > 0 && (
                        <div style={{ fontSize: 12, color: '#F53F3F' }}>差距: {(data.gaps as string[]).join(' · ')}</div>
                      )}
                      {(data.passed_controls !== undefined) && (
                        <div style={{ fontSize: 12, color: '#86909C', marginTop: 2 }}>通过控制项: {data.passed_controls}/{data.total_controls}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Full Report */}
              {current.detailed_audit_report && (
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>📄 详细审计报告</h4>
                  <div style={{ padding: '14px 18px', background: '#F7F8FA', borderRadius: 8, fontSize: 13.5, color: '#4E5969', lineHeight: 1.85, whiteSpace: 'pre-wrap', maxHeight: 350, overflowY: 'auto' }}>
                    {current.detailed_audit_report}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

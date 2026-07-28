import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Select, DatePicker, Input, Modal,
  message, Popconfirm, Tooltip, Row, Col, Statistic, Typography, Tabs,
  Badge, Progress, Empty, Spin, Alert, Descriptions, Collapse, Divider
} from 'antd';
import {
  DashboardOutlined, FileSearchOutlined, SafetyCertificateOutlined,
  BellOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined,
  CloseCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined,
  EyeOutlined, DeleteOutlined, ExportOutlined, ThunderboltOutlined,
  ClockCircleOutlined, FilterOutlined, DownloadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  securityCenterApi,
  type DashboardSummary,
  type UnifiedLogEntry,
  type AlertItem,
} from '@/api/securityCenterApi';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;

const SCORE_LEVEL_CONFIG: Record<string, { color: string; text: string; bgColor: string; icon: any }> = {
  excellent: { color: '#52C41A', text: '优秀', bgColor: '#F6FFED', icon: <CheckCircleOutlined /> },
  good: { color: '#1890FF', text: '良好', bgColor: '#E6F7FF', icon: <SafetyCertificateOutlined /> },
  warning: { color: '#FAAD14', text: '警告', bgColor: '#FFFBE6', icon: <WarningOutlined /> },
  danger: { color: '#FF4D4F', text: '危险', bgColor: '#FFF2F0', icon: <CloseCircleOutlined /> },
  critical: { color: '#CF1322', text: '严重', bgColor: '#FFF1F0', icon: <ExclamationCircleOutlined /> },
};

const SEVERITY_MAP: Record<string, { color: string; text: string }> = {
  info: { color: '#999', text: '信息' }, low: { color: '#52C41A', text: '低' },
  medium: { color: '#FAAD14', text: '中' }, high: { color: '#FF4D4F', text: '高' },
  critical: { color: '#CF1322', text: '严重' },
};

const ALERT_STATUS_MAP: Record<string, { color: string; text: string }> = {
  active: { color: '#FF4D4F', text: '活跃' }, acknowledged: { color: '#FAAD14', text: '已确认' },
  resolved: { color: '#52C41A', text: '已解决' }, suppressed: { color: '#999', text: '已抑制' },
};

const LOG_TYPE_MAP: Record<string, { label: string; color: string }> = {
  operation: { label: '操作日志', color: '#1890FF' },
  content_audit: { label: '内容审核', color: '#FAAD14' },
  rag: { label: 'RAG操作', color: '#722ED1' },
  permission: { label: '权限审计', color: '#13C2C2' },
};

export default function SecurityCenter() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [logs, setLogs] = useState<UnifiedLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertStats, setAlertStats] = useState<any>(null);
  const [logFilters, setLogFilters] = useState({ log_type: '', search: '' });
  const [alertFilters, setAlertFilters] = useState({ severity: '', status: '' });
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [currentLog, setCurrentLog] = useState<UnifiedLogEntry | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs();
    if (activeTab === 'alerts') { fetchAlerts(); fetchAlertStats(); }
  }, [activeTab]);

  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const res = await securityCenterApi.getDashboardSummary();
      setDashboardData(res?.data?.data || res?.data || null);
    } catch {} finally {
      setLoadingDashboard(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params: any = {};
      if (logFilters.log_type) params.log_type = logFilters.log_type;
      if (logFilters.search) params.search = logFilters.search;
      const res = await securityCenterApi.getUnifiedLogs(params);
      const payload = res?.data || res;
      const listData = payload?.results || payload?.data || payload || [];
      setLogs(Array.isArray(listData) ? listData : []);
    } catch { setLogs([]); } finally { setLogsLoading(false); }
  }, [logFilters]);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const params: any = {};
      if (alertFilters.severity) params.severity = alertFilters.severity;
      if (alertFilters.status) params.status = alertFilters.status;
      const res = await securityCenterApi.getAlerts(params);
      const payload = res?.data || res;
      const listData = payload?.results || payload?.data || payload || [];
      setAlerts(Array.isArray(listData) ? listData : []);
    } catch { setAlerts([]); } finally { setAlertsLoading(false); }
  }, [alertFilters]);

  const fetchAlertStats = useCallback(async () => {
    try {
      const res = await securityCenterApi.getAlertStatistics();
      setAlertStats(res?.data?.data || null);
    } catch {}
  }, []);

  const handleResolveAlert = async (id: number) => {
    try {
      await securityCenterApi.resolveAlert(id);
      message.success('告警已解决');
      fetchAlerts(); fetchAlertStats(); fetchDashboard();
    } catch { message.error('操作失败'); }
  };

  const handleAcknowledgeAlert = async (id: number) => {
    try {
      await securityCenterApi.acknowledgeAlert(id);
      message.success('已确认');
      fetchAlerts(); fetchAlertStats();
    } catch { message.error('操作失败'); }
  };

  const openLogDetail = (record: UnifiedLogEntry) => {
    setCurrentLog(record);
    setDetailModalOpen(true);
  };

  const scoreConfig = SCORE_LEVEL_CONFIG[dashboardData?.score_level || 'good'] || SCORE_LEVEL_CONFIG.good;

  const logColumns: ColumnsType<UnifiedLogEntry> = [
    {
      title: '日志类型', dataIndex: 'log_type', width: 110,
      filters: Object.entries(LOG_TYPE_MAP).map(([v, l]) => ({ text: l.label, value: v })),
      onFilter: (value, record) => record.log_type === value,
      render: (type: string) => {
        const cfg = LOG_TYPE_MAP[type];
        return cfg ? <Tag color={cfg.color} style={{ borderRadius: 4 }}>{cfg.label}</Tag> : type;
      },
    },
    { title: '来源', dataIndex: 'source', width: 90 },
    { title: '用户', dataIndex: 'user', width: 100, ellipsis: true },
    { title: '操作/动作', dataIndex: 'action', width: 160, ellipsis: true },
    {
      title: '详情', dataIndex: 'detail', width: 220, ellipsis: true,
      render: (text: string) => <Text style={{ fontSize: 12 }}>{text}</Text>,
    },
    {
      title: '结果', dataIndex: 'result', width: 90,
      render: (result: string) => (
        result === 'success' || result === 'passed'
          ? <Tag color="green" style={{ borderRadius: 4 }}>通过</Tag>
          : result === 'blocked' || result === 'failed'
            ? <Tag color="red" style={{ borderRadius: 4 }}>拦截</Tag>
            : <Tag color="orange" style={{ borderRadius: 4 }}>{result}</Tag>
      ),
    },
    {
      title: '风险等级', dataIndex: 'risk_level', width: 90,
      render: (level: string) => level ? (
        <Tag color={SEVERITY_MAP[level]?.color || '#999'} style={{ borderRadius: 4 }}>
          {{ low: '低', medium: '中', high: '高', critical: '严重' }[level] || level}
        </Tag>
      ) : '-',
    },
    {
      title: '时间', dataIndex: 'created_at', width: 170, defaultSortOrder: 'descend' as const,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (t: string) => <Text style={{ fontSize: 11, color: '#666' }}>{dayjs(t).format('YYYY-MM-DD HH:mm:ss')}</Text>,
    },
    {
      title: '操作', key: 'action', width: 80, fixed: 'right' as const,
      render: (_, record) => (
        <Tooltip title="查看详情">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openLogDetail(record)} />
        </Tooltip>
      ),
    },
  ];

  const alertColumns: ColumnsType<AlertItem> = [
    {
      title: '严重程度', dataIndex: 'severity', width: 100,
      render: (sev: string) => {
        const s = SEVERITY_MAP[sev];
        return s ? <Tag color={s.color} style={{ borderRadius: 4, fontWeight: 600 }}>{s.text}</Tag> : sev;
      },
    },
    { title: '告警标题', dataIndex: 'title', width: 250, ellipsis: true, render: (t: string) => <Text strong>{t}</Text> },
    {
      title: '分类', dataIndex: 'category', width: 100,
      render: (cat: string) => ({
        vulnerability: <Tag color="#FF4D4F" style={{ borderRadius: 4 }}>漏洞</Tag>,
        risk_event: <Tag color="#FAAD14" style={{ borderRadius: 4 }}>风险事件</Tag>,
        audit_anomaly: <Tag color="#722ED1" style={{ borderRadius: 4 }}>审计异常</Tag>,
        content_violation: <Tag color="#EC4899" style={{ borderRadius: 4 }}>内容违规</Tag>,
        system: <Tag color="#999" style={{ borderRadius: 4 }}>系统</Tag>,
        permission: <Tag color="#13C2C2" style={{ borderRadius: 4 }}>权限</Tag>,
      }[cat] || cat),
    },
    {
      title: '状态', dataIndex: 'status', width: 95,
      render: (st: string) => {
        const s = ALERT_STATUS_MAP[st];
        return s ? <Tag color={s.color} style={{ borderRadius: 4 }}>{s.text}</Tag> : st;
      },
    },
    { title: '处理人', dataIndex: 'assignee_name', width: 90, ellipsis: true, render: (n: string) => n || '-' },
    {
      title: '触发时间', dataIndex: 'triggered_at', width: 170,
      sorter: (a, b) => new Date(a.triggered_at).getTime() - new Date(b.triggered_at).getTime(),
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作', key: 'action', width: 200, fixed: 'right' as const,
      render: (_: any, record: AlertItem) => (
        <Space size="small">
          {record.status === 'active' && (
            <>
              <Button type="link" size="small" onClick={() => handleAcknowledgeAlert(record.id)}>确认</Button>
              <Popconfirm title="标记为已解决？" onConfirm={() => handleResolveAlert(record.id)}>
                <Button type="link" size="small" danger>解决</Button>
              </Popconfirm>
            </>
          )}
          {record.status !== 'active' && <Tag color="default" style={{ borderRadius: 4 }}>已完成</Tag>}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F8FAFC', minHeight: '100vh' }}>
      <Title level={4} style={{ marginBottom: 16, color: '#1E293B' }}>
        <SafetyCertificateOutlined style={{ marginRight: 8 }} /> 统一安全中心
      </Title>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="middle"
        items={[
          {
            key: 'dashboard',
            label: <span><DashboardOutlined /> 安全仪表盘</span>,
            children: renderDashboard(),
          },
          {
            key: 'logs',
            label: <span><FileSearchOutlined /> 审计日志中心</span>,
            children: renderLogs(),
          },
          {
            key: 'test',
            label: <span><ThunderboltOutlined /> 检验中心</span>,
            children: renderTestCenter(),
          },
          {
            key: 'alerts',
            label: <span><Badge count={alertStats?.active || 0} size="small"><BellOutlined /></Badge> 告警中心</span>,
            children: renderAlerts(),
          },
        ]}
        style={{
          '& .antTabsNav': { marginBottom: 16 },
          '.antTabsTab': { borderRadius: '6px 6px 0 0 !important' },
        }}
      />

      <Modal
        title={<Space><EyeOutlined /><span>日志详情</span></Space>}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        destroyOnHidden
        footer={[<Button key="close" onClick={() => setDetailModalOpen(false)} style={{ borderRadius: 6 }}>关闭</Button>]}
        width={640}
      >
        {currentLog && (
          <Descriptions column={2} size="small" bordered style={{ borderRadius: 6 }}>
            <Descriptions.Item label="日志类型">{LOG_TYPE_MAP[currentLog.log_type]?.label || currentLog.log_type}</Descriptions.Item>
            <Descriptions.Item label="来源">{currentLog.source}</Descriptions.Item>
            <Descriptions.Item label="用户">{currentLog.user}</Descriptions.Item>
            <Descriptions.Item label="动作">{currentLog.action}</Descriptions.Item>
            <Descriptions.Item label="结果">{currentLog.result}</Descriptions.Item>
            <Descriptions.Item label="风险等级">{currentLog.risk_level || '-'}</Descriptions.Item>
            <Descriptions.Item label="IP地址">{currentLog.ip_address || '-'}</Descriptions.Item>
            <Descriptions.Item label="时间">{dayjs(currentLog.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            <Descriptions.Item label="详情内容" span={2}>
              <div style={{ padding: 8, background: '#F8FAFC', borderRadius: 4, maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 13 }}>
                {currentLog.detail || '-'}
              </div>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );

  function renderDashboard() {
    if (loadingDashboard) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
    if (!dashboardData) return <Empty description="暂无数据" />;

    return (
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col span={8}>
            <Card style={{ borderRadius: 6, borderLeft: `4px solid ${scoreConfig.color}`, background: scoreConfig.bgColor }}>
              <Row align="middle" gutter={16}>
                <Col>
                  <Progress
                    type="circle"
                    percent={dashboardData.security_score}
                    size={80}
                    strokeColor={scoreConfig.color}
                    format={(p) => <Text strong style={{ fontSize: 24, color: scoreConfig.color }}>{p}</Text>}
                  />
                </Col>
                <Col flex="auto">
                  <Title level={5} style={{ margin: 0, color: scoreConfig.color }}>{scoreConfig.icon} {scoreConfig.text}</Title>
                  <Text type="secondary">安全综合评分</Text>
                  <br />
                  <Text style={{ fontSize: 12, color: '#666' }}>
                    基于漏洞、风险事件、告警综合计算
                  </Text>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #FF4D4F' }}>
              <Statistic title="今日事件" value={dashboardData.today_events} valueStyle={{ fontSize: 26, color: '#FF4D4F' }} />
              <Text style={{ fontSize: 11, color: '#999' }}>全部安全相关事件</Text>
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #FAAD14' }}>
              <Statistic title="活跃告警" value={dashboardData.open_alerts} valueStyle={{ fontSize: 26, color: '#FAAD14' }} />
              <Text style={{ fontSize: 11, color: '#999' }}>待处理告警数</Text>
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #CF1322' }}>
              <Statistic title="严重告警" value={dashboardData.critical_alerts} valueStyle={{ fontSize: 26, color: '#CF1322' }} />
              <Text style={{ fontSize: 11, color: '#999' }}>需立即处理</Text>
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #722ED1' }}>
              <Statistic title="未修复漏洞" value={dashboardData.unresolved_vulns} valueStyle={{ fontSize: 26, color: '#722ED1' }} />
              <Text style={{ fontSize: 11, color: '#999' }}>open 状态</Text>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6 }}>
              <Statistic title="今日拦截" value={dashboardData.today_blocked} prefix={<CloseCircleOutlined style={{ color: '#FF4D4F' }} />} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6 }}>
              <Statistic title="今日审核" value={dashboardData.today_audits} prefix={<FileSearchOutlined style={{ color: '#1890FF' }} />} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6 }}>
              <Statistic title="生效规则" value={dashboardData.active_rules} prefix={<SafetyCertificateOutlined style={{ color: '#52C41A' }} />} />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" style={{ borderRadius: 6 }} title="最近7日趋势" extra={<Button icon={<ReloadOutlined />} size="small" onClick={fetchDashboard} />}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120, padding: '10px 0' }}>
                {(dashboardData.trend_7d || []).map((item, i) => {
                  const maxEvents = Math.max(...(dashboardData.trend_7d || []).map(d => d.events), 1);
                  const heightPct = (item.events / maxEvents) * 100;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                        <Tooltip title={`${item.date}: ${item.events}次事件 / ${item.blocked}次拦截`}>
                          <div style={{
                            width: '70%',
                            height: `${Math.max(heightPct, 3)}%`,
                            background: item.blocked > 0 ? 'linear-gradient(to top, #FF4D4F, #FF7875)' : '#1890FF',
                            borderRadius: '4px 4px 0 0',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: 4,
                          }} />
                        </Tooltip>
                      </div>
                      <Text style={{ fontSize: 10, color: '#999', marginTop: 4 }}>{item.date.slice(5)}</Text>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 4 }}>
                <span style={{ fontSize: 11 }}><span style={{ display: 'inline-block', width: 10, height: 10, background: '#1890FF', borderRadius: 2, marginRight: 4 }}/> 正常</span>
                <span style={{ fontSize: 11 }}><span style={{ display: 'inline-block', width: 10, height: 10, background: '#FF4D4F', borderRadius: 2, marginRight: 4 }}/> 含拦截</span>
              </div>
            </Card>
          </Col>
        </Row>

        {dashboardData.recent_alerts && dashboardData.recent_alerts.length > 0 && (
          <Card
            size="small"
            style={{ borderRadius: 6 }}
            title={
              <Space><BellOutlined /><span>近期告警（最新{Math.min(dashboardData.recent_alerts.length, 5)}条）</span></Space>
            }
            extra={<Button type="link" onClick={() => setActiveTab('alerts')}>查看全部 →</Button>}
          >
            {dashboardData.recent_alerts.map((alert) => {
              const sev = SEVERITY_MAP[alert.severity];
              return (
                <div key={alert.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', marginBottom: 6, borderRadius: 6,
                  background: alert.severity === 'critical' ? '#FFF1F0' :
                    alert.severity === 'high' ? '#FFF2F0' : '#FAFAFA',
                  border: `1px solid ${sev?.color || '#f0f0f0'}30`,
                }}>
                  <Space>
                    <Tag color={sev?.color} style={{ borderRadius: 4, fontWeight: 600 }}>{sev?.text}</Tag>
                    <Text strong>{alert.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{alert.category}</Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(alert.triggered_at).format('MM-DD HH:mm')}
                  </Text>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    );
  }

  function renderLogs() {
    return (
      <div>
        <Card size="small" style={{ borderRadius: 6, marginBottom: 16 }}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <Space wrap size="middle">
            <Select
              placeholder="日志类型"
              allowClear
              style={{ width: 130, borderRadius: 6 }}
              value={logFilters.log_type || undefined}
              onChange={(v) => setLogFilters(f => ({ ...f, log_type: v || '' }))}
              options={[
                { label: '操作日志', value: 'operation' },
                { label: '内容审核', value: 'content_audit' },
                { label: 'RAG操作', value: 'rag' },
                { label: '权限审计', value: 'permission' },
              ]}
            />
            <Input
              placeholder="搜索..."
              prefix={<SearchOutlined style={{ color: '#999' }} />}
              value={logFilters.search}
              onChange={(e) => setLogFilters(f => ({ ...f, search: e.target.value }))}
              onPressEnter={fetchLogs}
              allowClear
              style={{ width: 220, borderRadius: 6 }}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchLogs} style={{ borderRadius: 6 }}>刷新</Button>
            <Button icon={<ExportOutlined />} style={{ borderRadius: 6 }}>导出</Button>
          </Space>
        </Card>

        <Card size="small" style={{ borderRadius: 6 }}>
          <Table
            columns={logColumns}
            dataSource={logs}
            rowKey="id"
            loading={logsLoading}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条日志`,
              showQuickJumper: true,
              size: 'small',
            }}
            scroll={{ x: 1300 }}
            size="small"
            locale={{ emptyText: <Empty description="暂无日志记录" /> }}
          />
        </Card>
      </div>
    );
  }

  function renderTestCenter() {
    return (
      <div>
        <Card size="small" style={{ borderRadius: 6, textAlign: 'center', padding: '60px 40px' }}>
          <ThunderboltOutlined style={{ fontSize: 64, color: '#1890FF', marginBottom: 16 }} />
          <Title level={4}>安全检验引擎</Title>
          <Text type="secondary" style={{ fontSize: 15, maxWidth: 500, display: 'block', margin: '0 auto 24px' }}>
            运行自动化安全测试用例，检测系统中的潜在漏洞和风险点。
            支持全量检测、快速检测、以及自定义测试场景。
          </Text>
          <Space size="large">
            <Button type="primary" size="large" icon={<ThunderboltOutlined />}
              style={{ borderRadius: 6, height: 48, paddingLeft: 24, paddingRight: 24, fontSize: 15 }}
              onClick={() => window.location.href = '/admin/security-test'}
            >
              进入检验中心
            </Button>
            <Button size="large" icon={<FileSearchOutlined />}
              style={{ borderRadius: 6, height: 48, paddingLeft: 24, paddingRight: 24, fontSize: 15 }}
              onClick={() => window.location.href = '/admin/risk-control'}
            >
              风控规则管理
            </Button>
          </Space>
          <Divider style={{ maxWidth: 400, margin: '32px auto' }} />
          <Row gutter={32} justify="center">
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 6, textAlign: 'center' }}>
                <Text strong style={{ fontSize: 28, color: '#1890FF' }}>20+</Text>
                <br /><Text type="secondary">预置测试用例</Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 6, textAlign: 'center' }}>
                <Text strong style={{ fontSize: 28, color: '#722ED1' }}>6</Text>
                <br /><Text type="secondary">检测分类</Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 6, textAlign: 'center' }}>
                <Text strong style={{ fontSize: 28, color: '#52C41A' }}>实时</Text>
                <br /><Text type="secondary">自动漏洞追踪</Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 6, textAlign: 'center' }}>
                <Text strong style={{ fontSize: 28, color: '#FAAD14' }}>报告</Text>
                <br /><Text type="secondary">一键生成报表</Text>
              </Card>
            </Col>
          </Row>
        </Card>
      </div>
    );
  }

  function renderAlerts() {
    return (
      <div>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #FF4D4F', textAlign: 'center' }}>
              <Statistic title="活跃告警" value={alertStats?.active || 0} valueStyle={{ fontSize: 26, color: '#FF4D4F' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #CF1322', textAlign: 'center' }}>
              <Statistic title="严重" value={alertStats?.by_severity?.critical || 0} valueStyle={{ fontSize: 22, color: '#CF1322' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #FF4D4F', textAlign: 'center' }}>
              <Statistic title="高危" value={alertStats?.by_severity?.high || 0} valueStyle={{ fontSize: 22, color: '#FF4D4F' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #FAAD14', textAlign: 'center' }}>
              <Statistic title="中等" value={alertStats?.by_severity?.medium || 0} valueStyle={{ fontSize: 22, color: '#FAAD14' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #52C41A', textAlign: 'center' }}>
              <Statistic title="已解决" value={alertStats?.by_status?.resolved || 0} valueStyle={{ fontSize: 22, color: '#52C41A' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #1890FF', textAlign: 'center' }}>
              <Statistic title="总计" value={alertStats?.total || 0} valueStyle={{ fontSize: 22, color: '#1890FF' }} />
            </Card>
          </Col>
        </Row>

        <Card size="small" style={{ borderRadius: 6, marginBottom: 16 }}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <Space wrap size="middle">
            <Select placeholder="严重程度" allowClear style={{ width: 110, borderRadius: 6 }}
              value={alertFilters.severity || undefined}
              onChange={(v) => setAlertFilters(f => ({ ...f, severity: v || '' }))}
              options={[
                { label: '严重', value: 'critical' }, { label: '高', value: 'high' },
                { label: '中', value: 'medium' }, { label: '低', value: 'low' }, { label: '信息', value: 'info' },
              ]}
            />
            <Select placeholder="状态" allowClear style={{ width: 110, borderRadius: 6 }}
              value={alertFilters.status || undefined}
              onChange={(v) => setAlertFilters(f => ({ ...f, status: v || '' }))}
              options={[
                { label: '活跃', value: 'active' }, { label: '已确认', value: 'acknowledged' },
                { label: '已解决', value: 'resolved' }, { label: '已抑制', value: 'suppressed' },
              ]}
            />
            <Divider type="vertical" />
            <Button icon={<ReloadOutlined />} onClick={() => { fetchAlerts(); fetchAlertStats(); }} style={{ borderRadius: 6 }}>刷新</Button>
          </Space>
        </Card>

        <Card size="small" style={{ borderRadius: 6 }}>
          <Table
            columns={alertColumns}
            dataSource={alerts}
            rowKey="id"
            loading={alertsLoading}
            pagination={{
              pageSize: 12,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条告警`,
              showQuickJumper: true,
              size: 'small',
            }}
            scroll={{ x: 1100 }}
            size="small"
            locale={{ emptyText: <Empty description="暂无告警，系统运行正常 🎉" /> }}
          />
        </Card>
      </div>
    );
  }
}

function SearchOutlined(props: any) {
  return <span {...props} style={{ ...props.style }} />;
}

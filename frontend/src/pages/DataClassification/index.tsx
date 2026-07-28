import { useState, useEffect } from 'react';
import { Card, Table, Tag, Tabs, Statistic, Row, Col, Badge, Space, Button, Modal, Form, Input, Select, message, Descriptions, Timeline, Empty, Spin, Alert, Progress, Tooltip, Typography } from 'antd';
import { ShieldCheck, Database, Lock, Eye, FileSearch, Shield, AlertTriangle, CheckCircle, ClockCircle, FileOutput, Scale, BookOpen } from 'lucide-react';
import { dcApi, type DataSensitivityLevel, type DataCategory, type DataFieldTag, type ClassificationRecord, type ExportApproval, type ComplianceDashboard } from '@/api/dataClassificationApi';

const { Title, Text, Paragraph } = Typography;

const LEVEL_COLORS: Record<string, string> = {
  L1: '#52C41A', L2: '#165DFF', L3: '#FA8C16', L4: '#F53F3F',
};
const LEVEL_LABELS: Record<string, string> = {
  L1: 'L1-公开', L2: 'L2-内部', L3: 'L3-机密', L4: 'L4-绝密',
};

export default function DataClassificationCenter() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
  const [levels, setLevels] = useState<DataSensitivityLevel[]>([]);
  const [categories, setCategories] = useState<DataCategory[]>([]);
  const [fieldTags, setFieldTags] = useState<DataFieldTag[]>([]);
  const [records, setRecords] = useState<ClassificationRecord[]>([]);
  const [exports, setExports] = useState<ExportApproval[]>([]);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [dashRes, levelsRes] = await Promise.all([
        dcApi.getDashboard(), dcApi.getLevels(),
      ]);
      setDashboard(dashRes.data.data);
      setLevels(levelsRes.data.results || levelsRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadTabData(tab: string) {
    if (tab === 'fields') {
      try { const res = await dcApi.getFieldTags(); setFieldTags(res.data.results || res.data); } catch {}
    } else if (tab === 'records') {
      try { const res = await dcApi.getClassificationRecords(); setRecords(res.data.results || res.data); } catch {}
    } else if (tab === 'exports') {
      try { const res = await dcApi.getExportApprovals(); setExports(res.data.results || res.data); } catch {}
    }
  }

  function handleTabChange(key: string) {
    setActiveTab(key);
    loadTabData(key);
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', background: '#F2F3F5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <ShieldCheck size={28} color="#165DFF" />
        <Title level={3} style={{ margin: 0 }}>数据分类分级管理中心</Title>
        <Tag color="blue" style={{ marginLeft: 8 }}>数据安全法合规</Tag>
      </div>

      {dashboard && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card size="small">
              <Statistic title="已标注字段" value={dashboard.summary.total_tagged_fields} prefix={<Database size={14} />} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="PII字段" value={dashboard.summary.pii_field_count} valueStyle={{ color: '#FA8C16' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="加密字段" value={dashboard.summary.encrypted_field_count} prefix={<Lock size={14} />} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="近期操作" value={dashboard.summary.recent_classification_actions} suffix="/30d" />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="待审批导出" value={dashboard.summary.pending_export_approvals}
                valueStyle={{ color: dashboard.summary.pending_export_approvals > 0 ? '#F53F3F' : undefined }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="DPO数量" value={dashboard.summary.active_dpo_count} prefix={<Shield size={14} />} />
            </Card>
          </Col>
        </Row>
      )}

      <Tabs activeKey={activeTab} onChange={handleTabChange} items={[
        { key: 'dashboard', label: (<span><Scale size={14} /> 合规总览</span>) },
        { key: 'levels', label: (<span><Lock size={14} /> 敏感级别</span>) },
        { key: 'categories', label: (<span><BookOpen size={14} /> 数据分类</span>) },
        { key: 'fields', label: (<span><Eye size={14} /> PII字段标签</span>) },
        { key: 'records', label: (<span><FileSearch size={14} /> 分级记录</span>) },
        { key: 'exports', label: (<span><FileOutput size={14} /> 导出审批</span>) },
      ]} />

      {activeTab === 'dashboard' && dashboard && (
        <div>
          <Alert
            type={Object.values(dashboard.compliance_status).every(Boolean) ? 'success' : 'warning'}
            showIcon icon={<ShieldCheck />}
            message="合规状态检查"
            description={
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {Object.entries(dashboard.compliance_status).map(([key, val]) => (
                  <Tag key={key} color={val ? 'success' : 'error'} style={{ fontSize: 13 }}>
                    {val ? '✓' : '✗'} {key.replace(/_/g, ' ')}
                  </Tag>
                ))}
              </div>
            }
            style={{ marginBottom: 16 }}
          />

          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card title="敏感级别分布" size="small">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Object.entries(dashboard.level_breakdown).map(([code, info]) => (
                    <div key={code}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text strong>{LEVEL_LABELS[code] || code}</Text>
                        <Text>{info.field_count} 字段</Text>
                      </div>
                      <Progress percent={Math.min(100, Math.round(info.field_count / Math.max(1, dashboard.summary.total_tagged_fields) * 100))}
                        strokeColor={info.color} showInfo={false} />
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="法律依据覆盖" size="small">
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  {dashboard.legal_basises.map((basis, i) => (
                    <Tag key={i} color="blue" style={{ padding: '4px 10px', fontSize: 13 }}>{basis}</Tag>
                  ))}
                  {dashboard.legal_basises.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无法律依据标注" />}
                </Space>
              </Card>
            </Col>
          </Row>

          <Card title="PII覆盖率" size="small" style={{ marginTop: 16 }}>
            <Progress type="dashboard" percent={dashboard.summary.pii_coverage_pct}
              format={(p) => `${p}%`}
              strokeColor={dashboard.summary.pii_coverage_pct > 80 ? '#52C41A' : dashboard.summary.pii_coverage_pct > 50 ? '#FA8C16' : '#F53F3F'}
            />
            <Text type="secondary" style={{ marginTop: 8, display: 'block', fontSize: 12 }}>
              已标注 {dashboard.summary.pii_field_count} 个PII字段 / 总计 {dashboard.summary.total_tagged_fields} 个字段
            </Text>
          </Card>
        </div>
      )}

      {activeTab === 'levels' && (
        <Table dataSource={levels} rowKey="id" pagination={false} size="middle"
          columns={[
            { title: '代码', dataIndex: 'code', width: 80,
              render: (code: string) => <Tag color={LEVEL_COLORS[code]} style={{ fontWeight: 700 }}>{code}</Tag> },
            { title: '名称', dataIndex: 'name', width: 100 },
            { title: '说明', dataIndex: 'description', ellipsis: true },
            { title: '保留天数', dataIndex: 'retention_days', width: 90, render: (d: number) => `${d}天` },
            { title: '需加密', dataIndex: 'encryption_required', width: 70,
              render: (v: boolean) => v ? <Badge status="success" text="是" /> : <Badge status="default" text="否" /> },
            { title: '访问日志', dataIndex: 'access_log_required', width: 80,
              render: (v: boolean) => v ? <Badge status="success" text="是" /> : <Badge status="default" text="否" /> },
            { title: '导出审批', dataIndex: 'export_approval_required', width: 80,
              render: (v: boolean) => v ? <Badge status="warning" text="需审批" /> : <Badge status="default" text="免审" /> },
            { title: 'DPO审核', dataIndex: 'dpo_review_required', width: 75,
              render: (v: boolean) => v ? <Badge status="error" text="必须" /> : <Badge status="default" text="不需要" /> },
            { title: '允许角色', dataIndex: 'allowed_roles', width: 160,
              render: (roles: string[]) => roles?.map(r => <Tag key={r}>{r}</Tag>) },
          ]}
        />
      )}

      {activeTab === 'categories' && (
        <Table dataSource={categories} rowKey="id" pagination={false} size="middle"
          columns={[
            { title: '代码', dataIndex: 'code', width: 180, ellipsis: true },
            { title: '名称', dataIndex: 'name', width: 150 },
            { title: '类型', dataIndex: 'category_type_display', width: 120 },
            { title: '默认级别', dataIndex: 'default_level_code', width: 90,
              render: (c: string) => c ? <Tag color={LEVEL_COLORS[c]}>{c}</Tag> : '-' },
            { title: '跨境传输', dataIndex: 'cross_border_transfer_allowed', width: 85,
              render: (v: boolean) => v ? <Tag color="success">允许</Tag> : <Tag color="error">禁止</Tag> },
            { title: '法律依据', dataIndex: 'legal_basis', ellipsis: true },
            { title: '合规要求', dataIndex: 'compliance_requirements', width: 280,
              render: (reqs: string[]) => reqs?.map((r, i) => <Tag key={i} color="blue">{r}</Tag>) },
          ]}
        />
      )}

      {activeTab === 'fields' && (
        <Spin spinning={loading}>
          <Table dataSource={fieldTags} rowKey="id" pagination={{ pageSize: 20 }} size="small"
            columns={[
              { title: '字段路径', dataIndex: 'field_path', width: 260, ellipsis: true,
                render: (t: string) => <Text code style={{ fontSize: 12 }}>{t}</Text> },
              { title: '中文名', dataIndex: 'field_label', width: 120 },
              { title: 'PII类型', dataIndex: 'pii_type_display', width: 110 },
              { title: '敏感级别', dataIndex: 'level_code', width: 85,
                render: (c: string) => <Tag color={LEVEL_COLORS[c]}>{LEVEL_LABELS[c] || c}</Tag> },
              { title: '数据分类', dataIndex: 'category_name', width: 130, ellipsis: true },
              { title: '脱敏规则', dataIndex: 'mask_rule', width: 85,
                render: (r: string) => ({ none: '不脱敏', partial: '部分脱敏', full: '完全脱敏', hash: '哈希替换' })[r] || r },
              { title: '静态加密', dataIndex: 'is_encrypted_at_rest', width: 75,
                render: (v: boolean) => v ? <Lock size={14} color="#F53F3F" /> : '-' },
              { title: '法律依据', dataIndex: 'legal_basis', width: 200, ellipsis: true },
            ]}
          />
        </Spin>
      )}

      {activeTab === 'records' && (
        <Table dataSource={records} rowKey="id" pagination={{ pageSize: 15 }} size="small"
          columns={[
            { title: '对象', render: (_, r) => <Text code>{r.object_type}#{r.object_id}</Text>, width: 180 },
            { title: '操作类型', dataIndex: 'action_type', width: 110,
              render: (t: string) => ({
                auto_classified: <Tag color="cyan">自动分级</Tag>,
                manual_classified: <Tag color="blue">手动分级</Tag>,
                level_changed: <Tag color="orange">级别变更</Tag>,
                access_granted: <Tag color="green">访问授权</Tag>,
                access_denied: <Tag color="red">访问拒绝</Tag>,
                exported: <Tag>数据导出</Tag>,
                deleted: <Tag color="default">数据删除</Tag>,
              }[t] || t) },
            { title: '敏感级别', dataIndex: 'level_code', width: 85,
              render: (c: string) => c ? <Tag color={LEVEL_COLORS[c]}>{c}</Tag> : '-' },
            { title: '操作人', dataIndex: 'operator_name', width: 100 },
            { title: '原因/备注', dataIndex: 'reason', ellipsis: true },
            { title: 'IP地址', dataIndex: 'ip_address', width: 130 },
            { title: '时间', dataIndex: 'created_at', width: 170,
              render: (t: string) => new Date(t).toLocaleString('zh-CN') },
          ]}
        />
      )}

      {activeTab === 'exports' && (
        <Table dataSource={exports} rowKey="id" pagination={{ pageSize: 10 }} size="small"
          columns={[
            { title: 'ID', dataIndex: 'id', width: 50 },
            { title: '申请人', dataIndex: 'requester_name', width: 100 },
            { title: '状态', dataIndex: 'status', width: 85,
              render: (s: string) => (({
                pending: <Badge status="processing" text="待审批" />,
                approved: <Badge status="success" text="已批准" />,
                rejected: <Badge status="error" text="已拒绝" />,
                expired: <Badge status="default" text="已过期" />,
                revoked: <Badge status="warning" text="已撤销" />,
              })[s] || s) },
            { title: '最高敏感级', dataIndex: 'max_sensitivity_level', width: 95,
              render: (c: string) => c ? <Tag color={LEVEL_COLORS[c]}>{c}</Tag> : '-' },
            { title: '用途', dataIndex: 'purpose', ellipsis: true },
            { title: '格式', dataIndex: 'export_format', width: 60 },
            { title: '下载次数', dataIndex: 'download_count', width: 70 },
            { title: '申请时间', dataIndex: 'created_at', width: 170,
              render: (t: string) => new Date(t).toLocaleString('zh-CN') },
          ]}
        />
      )}
    </div>
  );
}

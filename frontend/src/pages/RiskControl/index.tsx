import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Switch, Tag, Space,
  message, Popconfirm, Tooltip, Tabs, Badge, InputNumber, Row, Col, Statistic,
  Divider, Alert, Typography, Empty, Spin, Upload, Collapse
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined,
  PlayCircleOutlined, DownloadOutlined, UploadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, WarningOutlined,
  ExperimentOutlined, FileProtectOutlined, EyeOutlined,
  StopOutlined, ReloadOutlined, FilterOutlined
} from '@ant-design/icons';
import type { ColumnsType, TableRowSelection } from 'antd/es/table';
import { riskControlApi, type RegexRuleItem, type TestResult, type CategoryStat } from '@/api/riskControlApi';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { Panel } = Collapse;

const CATEGORY_OPTIONS = [
  { value: 'sensitive_word', label: '敏感词', color: '#EF4444' },
  { value: 'spam', label: '垃圾广告', color: '#F59E0B' },
  { value: 'political', label: '政治敏感', color: '#8B5CF6' },
  { value: 'pornography', label: '色情低俗', color: '#EC4899' },
  { value: 'violence', label: '暴力恐吓', color: '#F97316' },
  { value: 'personal_info', label: '个人信息', color: '#06B6D4' },
];

const SEVERITY_MAP: Record<string, { color: string; text: string }> = {
  low: { color: '#52C41A', text: '低风险' },
  medium: { color: '#FAAD14', text: '中风险' },
  high: { color: '#FF4D4F', text: '高风险' },
  critical: { color: '#CF1322', text: '严重' },
};

const ACTION_MAP: Record<string, { color: string; text: string }> = {
  warn: { color: '#FAAD14', text: '警告' },
  block: { color: '#FF4D4F', text: '拦截' },
  replace: { color: '#1890FF', text: '替换' },
  review: { color: '#722ED1', text: '人工审核' },
};

export default function RiskControl() {
  const [rules, setRules] = useState<RegexRuleItem[]>([]);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RegexRuleItem | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testPattern, setTestPattern] = useState('');
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();
  const [importModalOpen, setImportModalOpen] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (activeCategory) params.category = activeCategory;
      if (searchText) params.search = searchText;
      const res = await riskControlApi.getRules(params);
      const payload = res?.data || res;
      const listData = payload?.results || payload?.data || payload || [];
      setRules(Array.isArray(listData) ? listData : []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, searchText]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await riskControlApi.getCategories();
      setCategories(res?.data?.data || []);
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await riskControlApi.getStatistics();
      setStats(res?.data?.data || null);
    } catch {}
  }, []);

  useEffect(() => {
    fetchRules();
    fetchCategories();
    fetchStats();
  }, [fetchRules, fetchCategories, fetchStats]);

  const handleCreate = async (values: any) => {
    try {
      if (editingRule) {
        await riskControlApi.updateRule(editingRule.id, values);
        message.success('规则更新成功');
      } else {
        await riskControlApi.createRule(values);
        message.success('规则创建成功');
      }
      setModalOpen(false);
      setEditingRule(null);
      form.resetFields();
      fetchRules();
      fetchStats();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await riskControlApi.deleteRule(id);
      message.success('删除成功');
      fetchRules();
      fetchStats();
    } catch {
      message.error('删除失败');
    }
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      await riskControlApi.updateRule(id, { is_enabled: enabled });
      message.success(enabled ? '已启用' : '已禁用');
      fetchRules();
      fetchStats();
    } catch {
      message.error('操作失败');
    }
  };

  const handleBatchToggle = async (enabled: boolean) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择规则');
      return;
    }
    try {
      const res = await riskControlApi.batchToggle(selectedRowKeys as number[], enabled);
      message.success(res?.data?.message || `批量${enabled ? '启用' : '禁用'}成功`);
      setSelectedRowKeys([]);
      fetchRules();
      fetchStats();
    } catch {
      message.error('批量操作失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择规则');
      return;
    }
    try {
      const res = await riskControlApi.batchDelete(selectedRowKeys as number[]);
      message.success(res?.data?.message || '批量删除成功');
      setSelectedRowKeys([]);
      fetchRules();
      fetchStats();
    } catch {
      message.error('批量删除失败');
    }
  };

  const runTest = async () => {
    if (!testText.trim()) {
      message.warning('请输入测试文本');
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      let res;
      if (testPattern) {
        res = await riskControlApi.testRawPattern({ text: testText, pattern: testPattern });
      } else {
        message.warning('请输入正则表达式或选择已有规则');
        setTestLoading(false);
        return;
      }
      const data = res?.data || res;
      setTestResult(data?.data);
      if (!data?.data?.valid) {
        message.error(`正则表达式无效: ${data?.data?.error}`);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '测试失败');
    } finally {
      setTestLoading(false);
    }
  };

  const openEdit = (record: RegexRuleItem) => {
    setEditingRule(record);
    form.setFieldsValue({
      name: record.name,
      category: record.category,
      pattern: record.pattern,
      description: record.description,
      severity: record.severity,
      action: record.action,
      replacement: record.replacement,
      is_enabled: record.is_enabled,
      tags: record.tags || [],
      sort_order: record.sort_order,
    });
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ severity: 'medium', action: 'warn', sort_order: 0, is_enabled: true });
    setModalOpen(true);
  };

  const openTestWithRule = (record: RegexRuleItem) => {
    setTestPattern(record.pattern);
    setTestText('');
    setTestResult(null);
    setTestModalOpen(true);
  };

  const handleExport = async () => {
    try {
      const res = await riskControlApi.exportRules(activeCategory ? { category: activeCategory } : {});
      const dataStr = JSON.stringify(res?.data?.data || [], null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `regex_rules_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const rules = Array.isArray(data) ? data : data?.data || [];
        if (!rules.length) {
          message.error('文件中没有有效的规则数据');
          return;
        }
        const res = await riskControlApi.batchImport(rules, true);
        message.success(res?.data?.message || '导入成功');
        setImportModalOpen(false);
        fetchRules();
        fetchStats();
        fetchCategories();
      } catch {
        message.error('文件格式错误，请上传JSON格式文件');
      }
    };
    reader.readAsText(file);
    return false;
  };

  const columns: ColumnsType<RegexRuleItem> = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true,
      render: (text: string) => <Text strong style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      filters: CATEGORY_OPTIONS.map(c => ({ text: c.label, value: c.value })),
      onFilter: (value, record) => record.category === value,
      render: (cat: string) => {
        const opt = CATEGORY_OPTIONS.find(c => c.value === cat);
        return opt ? <Tag color={opt.color} style={{ borderRadius: 4 }}>{opt.label}</Tag> : cat;
      },
    },
    {
      title: '正则表达式',
      dataIndex: 'pattern',
      key: 'pattern',
      width: 220,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <code style={{
            background: '#F1F5F9', padding: '2px 6px', borderRadius: 4,
            fontSize: 12, color: '#475569', fontFamily: 'monospace'
          }}>
            {text.length > 30 ? text.slice(0, 30) + '...' : text}
          </code>
        </Tooltip>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (sev: string) => {
        const s = SEVERITY_MAP[sev];
        return s ? <Tag color={s.color} style={{ borderRadius: 4 }}>{s.text}</Tag> : sev;
      },
    },
    {
      title: '处置动作',
      dataIndex: 'action',
      key: 'action',
      width: 90,
      render: (act: string) => {
        const a = ACTION_MAP[act];
        return a ? <Tag color={a.color} style={{ borderRadius: 4 }}>{a.text}</Tag> : act;
      },
    },
    {
      title: '匹配次数',
      dataIndex: 'match_count',
      key: 'match_count',
      width: 90,
      sorter: (a, b) => a.match_count - b.match_count,
      render: (count: number) => (
        <Text style={{ color: count > 0 ? '#1890FF' : '#999' }}>
          {count.toLocaleString()}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      width: 80,
      render: (enabled: boolean, record: RegexRuleItem) => (
        <Switch
          size="small"
          checked={enabled}
          onChange={(checked) => handleToggle(record.id, checked)}
          checkedChildren="开"
          unCheckedChildren="关"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: RegexRuleItem) => (
        <Space size="small">
          <Tooltip title="测试">
            <Button type="link" size="small" icon={<ExperimentOutlined />} onClick={() => openTestWithRule(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm title="确定删除此规则？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rowSelection: TableRowSelection<RegexRuleItem> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  return (
    <div style={{ padding: 24, background: '#F8FAFC', minHeight: '100vh' }}>
      <Title level={4} style={{ marginBottom: 20, color: '#1E293B' }}>
        <FileProtectOutlined style={{ marginRight: 8 }} /> 正则规则风控库
      </Title>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderLeft: '3px solid #1890FF' }}>
              <Statistic title="总规则数" value={stats.total_rules} valueStyle={{ fontSize: 22 }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderLeft: '3px solid #52C41A' }}>
              <Statistic title="已启用" value={stats.enabled_rules} valueStyle={{ fontSize: 22, color: '#52C41A' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderLeft: '3px solid #999' }}>
              <Statistic title="已禁用" value={stats.disabled_rules} valueStyle={{ fontSize: 22, color: '#999' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderLeft: '3px solid #FAAD14' }}>
              <Statistic title="总匹配次数" value={stats.total_matches} valueStyle={{ fontSize: 22, color: '#FAAD14' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderLeft: '3px solid #FF4D4F' }}>
              <Statistic title="拦截数" value={stats.blocked_count} valueStyle={{ fontSize: 22, color: '#FF4D4F' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderLeft: '3px solid #722ED1' }}>
              <Statistic title="今日审核" value={stats.today_audits} valueStyle={{ fontSize: 22, color: '#722ED1' }} />
            </Card>
          </Col>
        </Row>
      )}

      <Card size="small" style={{ borderRadius: 6, marginBottom: 16 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Space wrap size="middle">
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ borderRadius: 6 }}>
            新增规则
          </Button>
          <Button icon={<PlayCircleOutlined />} onClick={() => setTestModalOpen(true)} style={{ borderRadius: 6 }}>
            正则测试工具
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport} style={{ borderRadius: 6 }}>
            导出规则
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)} style={{ borderRadius: 6 }}>
            批量导入
          </Button>
          <Divider type="vertical" />
          <Button
            icon={<CheckCircleOutlined />}
            onClick={() => handleBatchToggle(true)}
            disabled={selectedRowKeys.length === 0}
            style={{ borderRadius: 6 }}
          >
            批量启用 ({selectedRowKeys.length})
          </Button>
          <Button
            icon={<StopOutlined />}
            onClick={() => handleBatchToggle(false)}
            disabled={selectedRowKeys.length === 0}
            style={{ borderRadius: 6 }}
          >
            批量禁用
          </Button>
          <Popconfirm title={`确定删除选中的 ${selectedRowKeys.length} 条规则？`} onConfirm={handleBatchDelete}
            okText="确定" cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}
              disabled={selectedRowKeys.length === 0}
              style={{ borderRadius: 6 }}
            >
              批量删除
            </Button>
          </Popconfirm>
          <Divider type="vertical" />
          <Input
            placeholder="搜索规则名/正则/描述..."
            prefix={<SearchOutlined style={{ color: '#999' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={() => fetchRules()}
            allowClear
            style={{ width: 240, borderRadius: 6 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchRules} style={{ borderRadius: 6 }}>刷新</Button>
        </Space>

        <div style={{ marginTop: 12 }}>
          <Space size={[8, 8]} wrap>
            <Button
              size="small"
              type={!activeCategory ? 'primary' : 'default'}
              onClick={() => setActiveCategory('')}
              style={{ borderRadius: 6 }}
            >
              全部
            </Button>
            {CATEGORY_OPTIONS.map(cat => (
              <Button
                key={cat.value}
                size="small"
                type={activeCategory === cat.value ? 'primary' : 'default'}
                onClick={() => setActiveCategory(activeCategory === cat.value ? '' : cat.value)}
                style={{ borderRadius: 6 }}
              >
                {cat.label}
                <Badge
                  count={categories.find(c => c.value === cat.value)?.count || 0}
                  size="small"
                  style={{ marginLeft: 4, backgroundColor: activeCategory === cat.value ? '#fff' : cat.color, color: activeCategory === cat.value ? cat.color : '#fff' }}
                />
              </Button>
            ))}
          </Space>
        </div>
      </Card>

      <Card size="small" style={{ borderRadius: 6 }}>
        <Table
          columns={columns}
          dataSource={rules}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条规则`,
            showQuickJumper: true,
            size: 'small',
          }}
          scroll={{ x: 1100 }}
          size="small"
          locale={{ emptyText: <Empty description="暂无规则，点击上方「新增规则」开始添加" /> }}
        />
      </Card>

      <Modal
        title={editingRule ? '编辑规则' : '新增规则'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingRule(null); form.resetFields(); }}
        destroyOnHidden
        footer={null}
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}
          initialValues={{ severity: 'medium', action: 'warn', is_enabled: true, sort_order: 0 }}
        >
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="如：手机号检测" maxLength={200} style={{ borderRadius: 6 }} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
                <Select placeholder="选择分类" options={CATEGORY_OPTIONS.map(c => ({ label: c.label, value: c.value }))} style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="severity" label="风险等级">
                <Select
                  placeholder="选择风险等级"
                  options={[
                    { label: '低风险', value: 'low' },
                    { label: '中风险', value: 'medium' },
                    { label: '高风险', value: 'high' },
                    { label: '严重', value: 'critical' },
                  ]}
                  style={{ borderRadius: 6 }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="pattern" label="正则表达式" rules={[{ required: true, message: '请输入正则表达式' }]}>
            <TextArea rows={3} placeholder='如：1[3-9]\d{9}' style={{ borderRadius: 6, fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item name="description" label="规则描述">
            <TextArea rows={2} placeholder="描述规则的用途和匹配场景" maxLength={500} style={{ borderRadius: 6 }} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="action" label="处置动作">
                <Select
                  options={[
                    { label: '警告', value: 'warn' },
                    { label: '拦截', value: 'block' },
                    { label: '替换', value: 'replace' },
                    { label: '人工审核', value: 'review' },
                  ]}
                  style={{ borderRadius: 6 }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="replacement" label="替换文本（动作=替换时）">
                <Input placeholder="替换后的文本" maxLength={500} style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sort_order" label="排序值">
                <InputNumber min={0} max={9999} style={{ width: '100%', borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_enabled" label="是否启用" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setModalOpen(false); setEditingRule(null); form.resetFields(); }} style={{ borderRadius: 6 }}>取消</Button>
              <Button type="primary" htmlType="submit" style={{ borderRadius: 6 }}>
                {editingRule ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space><ExperimentOutlined /><span>正则测试工具</span></Space>
        }
        open={testModalOpen}
        onCancel={() => { setTestModalOpen(false); setTestResult(null); }}
        destroyOnHidden
        footer={null}
        width={720}
      >
        <Form layout="vertical">
          <Form.Item label="正则表达式">
            <Input
              value={testPattern}
              onChange={(e) => { setTestPattern(e.target.value); setTestResult(null); }}
              placeholder='输入正则表达式，如：1[3-9]\d{9}'
              style={{ fontFamily: 'monospace', borderRadius: 6 }}
            />
          </Form.Item>
          <Form.Item label="测试文本">
            <TextArea
              rows={4}
              value={testText}
              onChange={(e) => { setTestText(e.target.value); setTestResult(null); }}
              placeholder="输入待检测的文本内容..."
              style={{ borderRadius: 6 }}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={runTest} loading={testLoading} style={{ borderRadius: 6 }}>
              执行测试
            </Button>
          </Form.Item>
        </Form>

        {testResult && (
          <div style={{ marginTop: 16 }}>
            <Alert
              type={testResult.valid ? (testResult.matched ? 'warning' : 'success') : 'error'}
              message={
                testResult.valid
                  ? (testResult.matched
                    ? `匹配成功！命中 ${testResult.match_count} 处`
                    : '未匹配任何内容')
                  : `正则表达式无效: ${testResult.error}`
              }
              icon={testResult.valid
                ? (testResult.matched ? <WarningOutlined /> : <CheckCircleOutlined />)
                : <CloseCircleOutlined />
              }
              style={{ borderRadius: 6, marginBottom: 12 }}
            />

            {testResult.valid && testResult.matched && (
              <Collapse defaultActiveKey={['matches']} size="small" style={{ borderRadius: 6 }}>
                <Panel header={`匹配详情（共 ${testResult.matches?.length || 0} 条）`} key="matches">
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {testResult.matches?.map((m, i) => (
                      <div key={i} style={{
                        padding: '6px 10px',
                        margin: '4px 0',
                        background: '#FEF2F2',
                        borderRadius: 4,
                        border: '1px solid #FECACA',
                        fontSize: 13,
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                      }}>
                        <Text strong style={{ marginRight: 8, color: '#DC2626' }}>#{i + 1}</Text>
                        <Text copyable={{ text: m }}>{String(m).length > 80 ? String(m).slice(0, 80) + '...' : m}</Text>
                      </div>
                    ))}
                  </div>
                </Panel>
                {testResult.matched_text && (
                  <Panel header="首个匹配位置" key="position">
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Text>匹配文本：</Text>
                      <Text code style={{ background: '#FEF2F2', color: '#DC2626', padding: '2px 8px', borderRadius: 4 }}>
                        {testResult.matched_text}
                      </Text>
                      {testResult.position && (
                        <>
                          <Text>位置：</Text>
                          <Tag color="blue">[{testResult.position[0]} - {testResult.position[1]}]</Tag>
                        </>
                      )}
                    </div>
                  </Panel>
                )}
              </Collapse>
            )}

            {!testResult.valid && testResult.error && (
              <Alert
                type="error"
                message="正则语法错误"
                description={testResult.error}
                style={{ borderRadius: 6 }}
              />
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={<Space><UploadOutlined /><span>批量导入规则</span></Space>}
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        destroyOnHidden
        footer={null}
        width={520}
      >
        <div style={{ padding: '20px 0' }}>
          <Upload.Dragger
            accept=".json"
            beforeUpload={handleImport}
            showUploadList={false}
            multiple={false}
            style={{ borderRadius: 6, padding: '40px 20px' }}
          >
            <p className="ant-upload-drag-icon"><UploadOutlined style={{ fontSize: 48, color: '#1890FF' }} /></p>
            <p className="ant-upload-text" style={{ fontWeight: 600 }}>点击或拖拽JSON文件到此处</p>
            <p className="ant-upload-hint" style={{ color: '#999' }}>
              支持从导出的规则文件导入。将自动覆盖同名规则。
            </p>
          </Upload.Dragger>
          <div style={{ marginTop: 16, padding: 12, background: '#F0FDF4', borderRadius: 6, border: '1px solid #BBF7D0' }}>
            <Text style={{ color: '#166534', fontSize: 13 }}>
              <strong>导入格式说明：</strong><br/>
              文件需为JSON数组格式，每条记录包含 name、category、pattern 字段。
              可选字段：description、severity、action、replacement、tags、sort_order、is_enabled。
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  );
}

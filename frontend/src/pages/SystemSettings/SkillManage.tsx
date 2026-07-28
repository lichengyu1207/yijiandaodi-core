import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Switch, Tag, Space,
  message, Popconfirm, Row, Col, Statistic, Typography, Divider,
  InputNumber, Slider, ColorPicker
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, ReloadOutlined,
  SaveOutlined, SearchOutlined, ArrowUpOutlined, ArrowDownOutlined,
  ExperimentOutlined, FireOutlined, StarOutlined, ThunderboltOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  getAdminSkillList, createSkill, updateSkill, deleteSkill,
  toggleSkillStatus, batchToggleSkills, batchDeleteSkills,
  type SkillConfigItem
} from '@/api/skillConfigApi';

const { TextArea } = Input;
const { Text } = Typography;

const TIER_OPTIONS = [
  { value: 'core', label: '核心鉴别场景' },
  { value: 'security', label: '安全融合层' },
  { value: 'product', label: '产品融合层' },
  { value: 'vertical', label: '垂直场景层' },
  { value: 'monetization', label: '变现生态层' },
  { value: 'multilingual', label: '多语言蓝海层' },
  { value: 'professional', label: '专业领域层' },
  { value: 'special', label: '特殊内容层' },
  { value: 'compliance', label: '合规审计层' },
  { value: 'ai-detect', label: 'AI检测同行层' },
  { value: 'content-security', label: '内容安全同行层' },
  { value: 'ai-governance', label: 'AI治理同行层' },
  { value: 'vertical-peer', label: '垂直场景同行层' },
  { value: 'infoflow-detect', label: '信息流检测层' },
  { value: 'traffic-optimize', label: '流量优化层' },
  { value: 'infoflow-compliance', label: '信息流合规层' },
  { value: 'multimodal-infoflow', label: '多模态信息流层' },
  { value: 'context-understanding', label: '上下文理解层' },
  { value: 'long-conversation', label: '长对话管理层' },
  { value: 'context-risk-control', label: '上下文风控层' },
  { value: 'vertical-context', label: '垂直上下文层' },
  { value: 'retrieval-system', label: '检索系统层' },
  { value: 'cluster-management', label: '集群管理层' },
  { value: 'file-operation', label: '文件操作层' },
  { value: 'voice-input', label: '语音输入层' },
  { value: 'general-agent', label: '通用Agent层' },
  { value: 'enterprise-agent', label: '企业Agent层' },
  { value: 'vertical-agent', label: '垂直Agent层' },
  { value: 'multi-agent-collab', label: '多Agent协作层' },
];

const MONETIZATION_OPTIONS = [
  { value: 'free+pay', label: '免费基础+按次付费' },
  { value: 'member+pay', label: '会员免费+按次付费' },
  { value: 'pay+enterprise', label: '按次付费+企业定制' },
  { value: 'enterprise', label: '企业定制' },
  { value: 'free', label: '完全免费' },
];

const STATUS_OPTIONS = [
  { value: 'online', label: '上线' },
  { value: 'offline', label: '下线' },
  { value: 'beta', label: '内测' },
  { value: 'coming_soon', label: '即将上线' },
];

const STATUS_COLOR_MAP: Record<string, string> = {
  online: 'green',
  offline: 'red',
  beta: 'blue',
  coming_soon: 'orange',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  online: '已上线',
  offline: '已下线',
  beta: '内测中',
  coming_soon: '即将上线',
};

const TIER_SHORT_MAP: Record<string, string> = {
  core: '核心', security: '安全', product: '产品', vertical: '垂直',
  monetization: '变现', multilingual: '多语', professional: '专业',
  special: '特殊', compliance: '合规',
};

const TIER_COLOR_MAP: Record<string, string> = {
  core: '#165DFF', security: '#F5222D', product: '#FA8C16', vertical: '#52C41A',
  monetization: '#722ED1', multilingual: '#13C2C2', professional: '#EB2F96',
  special: '#FAAD14', compliance: '#999999',
};

export default function SkillManage() {
  const [skills, setSkills] = useState<SkillConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [filterTier, setFilterTier] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SkillConfigItem | null>(null);
  const [form] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, recommended: 0 });

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize };
      if (filterStatus) params.status = filterStatus;
      if (filterTier) params.tier = filterTier;
      if (searchKeyword) params.search = searchKeyword;
      const res = await getAdminSkillList(params);
      const data = res?.data || res;
      const results = data?.results || [];
      setSkills(results);
      setTotal(data?.count || data?.total || results.length);
    } catch {} finally { setLoading(false); }
  }, [page, pageSize, filterStatus, filterTier, searchKeyword]);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    setStats({
      total: skills.length ? total : 0,
      online: skills.filter(s => s.status === 'online').length,
      offline: skills.filter(s => s.status === 'offline').length,
      recommended: skills.filter(s => s.is_recommended).length,
    });
  }, [skills, total]);

  const handleSearch = () => { setPage(1); fetchList(); };

  const handleSave = async (values: any) => {
    try {
      let keywordsArr: string[] = [];
      if (typeof values.keywords === 'string') {
        keywordsArr = values.keywords.split(',').map((s: string) => s.trim()).filter(Boolean);
      } else if (Array.isArray(values.keywords)) {
        keywordsArr = values.keywords;
      }
      const payload = { ...values, keywords: keywordsArr };

      if (editing) {
        await updateSkill(editing.id, payload);
        message.success('技能更新成功');
      } else {
        await createSkill(payload);
        message.success('技能创建成功');
      }
      setModalOpen(false); setEditing(null); form.resetFields();
      fetchList();
    } catch { message.error('操作失败'); }
  };

  const handleToggleStatus = async (record: SkillConfigItem) => {
    const newStatus = record.status === 'online' ? 'offline' : 'online';
    try {
      await toggleSkillStatus(record.id, newStatus);
      message.success(`已${newStatus === 'online' ? '上线' : '下线'}`);
      fetchList();
    } catch { message.error('操作失败'); }
  };

  const handleBatchToggle = async (status: string) => {
    if (selectedRowKeys.length === 0) { message.warning('请先选择技能'); return; }
    try {
      await batchToggleSkills(selectedRowKeys, status);
      message.success(`批量${status === 'online' ? '上线' : '下线'}成功`);
      setSelectedRowKeys([]);
      fetchList();
    } catch { message.error('批量操作失败'); }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) { message.warning('请先选择技能'); return; }
    try {
      await batchDeleteSkills(selectedRowKeys);
      message.success('批量删除成功');
      setSelectedRowKeys([]);
      fetchList();
    } catch { message.error('批量删除失败'); }
  };

  const columns: ColumnsType<SkillConfigItem> = [
    { title: 'ID', dataIndex: 'id', width: 55, align: 'center' },
    {
      title: '名称', dataIndex: 'name', width: 160, ellipsis: true,
      render: (t: string) => <Text strong style={{ fontSize: 13 }}>{t}</Text>,
    },
    {
      title: '分类', dataIndex: 'category', width: 100,
      render: (t: string) => <Tag color="geekblue" style={{ borderRadius: 4 }}>{t}</Tag>,
    },
    {
      title: '主场景', dataIndex: 'main_scenario', width: 110,
      render: (t: string) => <Tag color="cyan" style={{ borderRadius: 4 }}>{t}</Tag>,
    },
    {
      title: '层级', dataIndex: 'tier', width: 90,
      render: (t: string) => <Tag color={TIER_COLOR_MAP[t] || '#999'} style={{ borderRadius: 4 }}>{TIER_SHORT_MAP[t] || t}</Tag>,
    },
    {
      title: '变现类型', dataIndex: 'monetization_type', width: 130,
      render: (t: string) => MONETIZATION_OPTIONS.find(o => o.value === t)?.label || t,
    },
    { title: '权重', dataIndex: 'weight', width: 60, align: 'center', sorter: (a, b) => a.weight - b.weight },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (t: string) => <Tag color={STATUS_COLOR_MAP[t]} style={{ borderRadius: 4 }}>{STATUS_LABEL_MAP[t] || t}</Tag>,
    },
    {
      title: '推荐', dataIndex: 'is_recommended', width: 55, align: 'center',
      render: (v: boolean) => v ? <StarOutlined style={{ color: '#FAAD14' }} /> : <Text type="secondary">-</Text>,
    },
    {
      title: '热门', dataIndex: 'is_hot', width: 55, align: 'center',
      render: (v: boolean) => v ? <FireOutlined style={{ color: '#FF4D4F' }} /> : <Text type="secondary">-</Text>,
    },
    {
      title: '新上线', dataIndex: 'is_new', width: 65, align: 'center',
      render: (v: boolean) => v ? <ThunderboltOutlined style={{ color: '#165DFF' }} /> : <Text type="secondary">-</Text>,
    },
    { title: '使用次数', dataIndex: 'usage_count', width: 80, align: 'center' },
    { title: '创建时间', dataIndex: 'created_at', width: 150, render: (t: string) => t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-' },
    {
      title: '操作', width: 180, fixed: 'right' as const,
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(r);
            form.setFieldsValue({
              ...r,
              keywords: Array.isArray(r.keywords) ? r.keywords.join(', ') : '',
            });
            setModalOpen(true);
          }}>编辑</Button>
          <Button
            type="link" size="small"
            icon={r.status === 'online' ? <ArrowDownOutlined /> : <ArrowUpOutlined />}
            onClick={() => handleToggleStatus(r)}
          >
            {r.status === 'online' ? '下线' : '上线'}
          </Button>
          <Popconfirm title="确定删除该技能？" onConfirm={async () => {
            try { await deleteSkill(r.id); message.success('已删除'); fetchList(); } catch { message.error('删除失败'); }
          }}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #165DFF' }}>
            <Statistic title="总技能数" value={total} prefix={<ExperimentOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #52C41A' }}>
            <Statistic title="已上线" value={stats.online} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #FF4D4F' }}>
            <Statistic title="已下线" value={stats.offline} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #FAAD14' }}>
            <Statistic title="推荐数" value={stats.recommended} prefix={<StarOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ borderRadius: 6, marginBottom: 16 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Space wrap>
          <Input
            placeholder="搜索关键词/名称"
            allowClear
            style={{ width: 200, borderRadius: 6 }}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 120, borderRadius: 6 }}
            value={filterStatus}
            onChange={(v) => setFilterStatus(v || '')}
            options={STATUS_OPTIONS}
          />
          <Select
            placeholder="层级筛选"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 160, borderRadius: 6 }}
            value={filterTier}
            onChange={(v) => setFilterTier(v || '')}
            options={TIER_OPTIONS}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} style={{ borderRadius: 6 }}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); fetchList(); }} style={{ borderRadius: 6 }}>刷新</Button>
        </Space>
      </Card>

      <Card size="small" style={{ borderRadius: 6, marginBottom: 16 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditing(null); form.resetFields();
            form.setFieldsValue({ status: 'online', tier: 'core', weight: 10, dev_days: 3, is_new: true, is_recommended: false, is_hot: false, sort_order: 0, monetization_type: 'free+pay', icon_name: 'Zap', icon_color: '#165DFF' });
            setModalOpen(true);
          }} style={{ borderRadius: 6 }}>新增技能</Button>
          <Button icon={<ArrowUpOutlined />} onClick={() => handleBatchToggle('online')} disabled={selectedRowKeys.length === 0} style={{ borderRadius: 6 }}>批量上线</Button>
          <Button icon={<ArrowDownOutlined />} onClick={() => handleBatchToggle('offline')} disabled={selectedRowKeys.length === 0} style={{ borderRadius: 6 }}>批量下线</Button>
          <Popconfirm title={`确定删除选中的 ${selectedRowKeys.length} 个技能？`} onConfirm={handleBatchDelete}>
            <Button danger icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0} style={{ borderRadius: 6 }}>批量删除</Button>
          </Popconfirm>
        </Space>
      </Card>

      <Card size="small" style={{ borderRadius: 6 }}>
        <Table
          columns={columns}
          dataSource={skills}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as number[]),
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共${t}条`,
            size: 'small',
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          scroll={{ x: 1500 }}
          size="small"
        />
      </Card>

      <Modal
        title={editing ? '编辑技能' : '新增技能'}
        open={modalOpen}
        destroyOnHidden
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        footer={null}
        width={720}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            status: 'online', tier: 'core', weight: 10, dev_days: 3,
            is_new: true, is_recommended: false, is_hot: false,
            sort_order: 0, monetization_type: 'free+pay',
            icon_name: 'Zap', icon_color: '#165DFF',
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="功能名称" rules={[{ required: true, message: '请输入名称' }]}>
                <Input placeholder="如：AI文本鉴伪" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="功能分类" rules={[{ required: true }]}>
                <Input placeholder="如：内容安全" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="main_scenario" label="对应主场景">
                <Input placeholder="如：文本鉴伪" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="keywords" label="关键词（逗号分隔）">
                <Input placeholder="AI, 鉴伪, 检测, 文本" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="功能描述">
            <TextArea rows={2} placeholder="简要描述该技能的功能..." style={{ borderRadius: 6 }} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="tier" label="所属层级" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" options={TIER_OPTIONS} style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="monetization_type" label="变现类型" rules={[{ required: true }]}>
                <Select options={MONETIZATION_OPTIONS} style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                <Select options={STATUS_OPTIONS} style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="weight" label={`推荐权重: ${Form.useWatch('weight', form) || 0}`}>
                <Slider min={0} max={100} marks={{ 0: '0', 50: '50', 100: '100' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sort_order" label="排序顺序">
                <InputNumber min={0} style={{ width: '100%', borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dev_days" label="开发周期(天)">
                <InputNumber min={0} style={{ width: '100%', borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="icon_name" label="图标名称">
                <Input placeholder="Zap" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="icon_color" label="图标颜色">
                <ColorPicker format="hex" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Form.Item name="is_recommended" label="是否推荐" valuePropName="checked">
                  <Switch checkedChildren="是" unCheckedChildren="否" />
                </Form.Item>
                <Form.Item name="is_hot" label="是否热门" valuePropName="checked">
                  <Switch checkedChildren="是" unCheckedChildren="否" />
                </Form.Item>
                <Form.Item name="is_new" label="是否新上线" valuePropName="checked">
                  <Switch checkedChildren="是" unCheckedChildren="否" />
                </Form.Item>
              </Space>
            </Col>
          </Row>

          <Divider />
          <Form.Item style={{ textAlign: 'right', margin: 0 }}>
            <Space>
              <Button onClick={() => { setModalOpen(false); setEditing(null); }} style={{ borderRadius: 6 }}>取消</Button>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} style={{ borderRadius: 6 }}>
                {editing ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Space,
  message, Popconfirm, Row, Col, Statistic, Typography, Spin, InputNumber, App
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, PlusOutlined,
  EditOutlined, DeleteOutlined, SwapOutlined, AppstoreOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { functionCardApi } from '@/api/logCenterApi';

const { TextArea } = Input;
const { Text } = Typography;

const ICON_CHOICES = [
  'Shield', 'Image', 'Link', 'FileSearch', 'ScanLine', 'Lock',
  'Eye', 'Code', 'Database', 'Globe', 'AlertTriangle',
  'CheckCircle', 'Zap', 'Cpu', 'Fingerprint', 'Key',
  'Wifi', 'Mail', 'Users', 'Settings'
];

const COLOR_PRESETS = [
  '#165DFF', '#00B42A', '#FF7D00', '#F53F3F',
  '#722ED1', '#0FC6C2', '#F7BA1E', '#86909C'
];

interface FunctionCard {
  id: number;
  name: string;
  icon: string;
  icon_color: string;
  description: string;
  prompt_template: string;
  knowledge_base?: { id: number; name: string };
  sort_order: number;
  weight: number;
  status: string;
}

interface KnowledgeBase {
  id: number;
  name: string;
}

interface CardStats {
  total: number;
  online: number;
  offline: number;
  highWeight: number;
}

export default function FunctionCardManage() {
  const { modal } = App.useApp();

  const [cards, setCards] = useState<FunctionCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [stats, setStats] = useState<CardStats>({ total: 0, online: 0, offline: 0, highWeight: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await functionCardApi.getFunctionCards({
        page,
        page_size: pageSize,
        search: keyword || undefined,
        status: statusFilter || undefined,
      });
      const data = res?.data || res;
      const list = data?.results || data || [];
      setCards(list);
      setTotal(data?.total || list.length);

      if (page === 1 && !keyword && !statusFilter) {
        calcStats(list);
      }
    } catch {} finally { setLoading(false); }
  }, [page, pageSize, keyword, statusFilter]);

  const fetchAllCardsForStats = useCallback(async () => {
    try {
      const res = await functionCardApi.getFunctionCards({ page_size: 9999 });
      const data = res?.data || res;
      const list = data?.results || data || [];
      calcStats(list);
    } catch {}
  }, []);

  const calcStats = (list: FunctionCard[]) => {
    setStats({
      total: list.length,
      online: list.filter(c => c.status === 'online').length,
      offline: list.filter(c => c.status === 'offline').length,
      highWeight: list.filter(c => c.weight >= 150).length,
    });
  };

  const fetchKnowledgeBases = useCallback(async () => {
    try {
      const res = await functionCardApi.getKnowledgeBases();
      const data = res?.data || res;
      setKnowledgeBases(data?.results || data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);
  useEffect(() => { fetchAllCardsForStats(); }, [fetchAllCardsForStats]);
  useEffect(() => { fetchKnowledgeBases(); }, [fetchKnowledgeBases]);

  const handleSearch = () => { setPage(1); fetchCards(); };
  const handleReset = () => { setKeyword(''); setStatusFilter(''); setPage(1); };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ sort_order: 0, weight: 100, status: 'online' });
    setModalOpen(true);
  };

  const handleEdit = (record: FunctionCard) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name,
      icon: record.icon,
      icon_color: record.icon_color,
      description: record.description,
      prompt_template: record.prompt_template || '',
      knowledge_base: record.knowledge_base?.id || undefined,
      sort_order: record.sort_order,
      weight: record.weight,
      status: record.status,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, any>) => {
    setSaving(true);
    try {
      if (editingId) {
        await functionCardApi.updateFunctionCard(editingId, values);
        message.success('卡片已更新');
      } else {
        await functionCardApi.createFunctionCard(values);
        message.success('卡片已创建');
      }
      setModalOpen(false);
      setEditingId(null);
      form.resetFields();
      fetchCards();
      fetchAllCardsForStats();
    } catch { message.error('操作失败'); } finally { setSaving(false); }
  };

  const handleToggleStatus = async (record: FunctionCard) => {
    try {
      await functionCardApi.toggleCardStatus(record.id);
      message.success(`已${record.status === 'online' ? '下线' : '上线'}`);
      fetchCards();
      fetchAllCardsForStats();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: number) => {
    try {
      await functionCardApi.deleteFunctionCard(id);
      message.success('卡片已删除');
      fetchCards();
      fetchAllCardsForStats();
    } catch { message.error('删除失败'); }
  };

  const columns: ColumnsType<FunctionCard> = [
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 80,
      sorter: (a: FunctionCard, b: FunctionCard) => a.sort_order - b.sort_order,
    },
    {
      title: '图标',
      width: 120,
      render: (_, r) => (
        <Tag style={{ borderRadius: 4 }}>
          <span style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: r.icon_color || '#165DFF',
            marginRight: 6,
          }} />
          {r.icon}
        </Tag>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      width: 140,
      render: (t: string) => <Text strong style={{ color: '#165DFF' }}>{t}</Text>,
    },
    {
      title: '简介',
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Prompt',
      dataIndex: 'prompt_template',
      width: 180,
      ellipsis: true,
      render: (t: string) => t ? t.substring(0, 30) + (t.length > 30 ? '...' : '') : '-',
    },
    {
      title: '知识库',
      width: 120,
      render: (_, r) => r.knowledge_base?.name || '-',
    },
    {
      title: '权重',
      dataIndex: 'weight',
      width: 90,
      sorter: (a: FunctionCard, b: FunctionCard) => a.weight - b.weight,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) =>
        status === 'online' ? (
          <Tag color="success" style={{ borderRadius: 4 }}>上线</Tag>
        ) : (
          <Tag style={{ borderRadius: 4, color: '#86909C', background: '#F2F3F5' }}>下线</Tag>
        ),
    },
    {
      title: '操作',
      width: 220,
      fixed: 'right' as const,
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
            编辑
          </Button>
          <Popconfirm
            title={`确定${r.status === 'online' ? '下线' : '上线'}该卡片？`}
            onConfirm={() => handleToggleStatus(r)}
          >
            <Button type="link" size="small" icon={<SwapOutlined />}>
              {r.status === 'online' ? '下线' : '上线'}
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确定删除该卡片？"
            description="删除后不可恢复"
            onConfirm={() => handleDelete(r.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F5F7FA', minHeight: '100vh' }}>
      <Text strong style={{ fontSize: 18, marginBottom: 16, display: 'block', color: '#1D2129' }}>
        <AppstoreOutlined style={{ marginRight: 8, color: '#165DFF' }} />
        功能卡片管理
      </Text>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #165DFF' }}>
            <Statistic title="总卡片数" value={stats.total} valueStyle={{ color: '#165DFF', fontSize: 24 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #00B42A' }}>
            <Statistic title="已上线" value={stats.online} valueStyle={{ color: '#00B42A', fontSize: 24 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #86909C' }}>
            <Statistic title="已下线" value={stats.offline} valueStyle={{ color: '#86909C', fontSize: 24 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #722ED1' }}>
            <Statistic title="高权重推荐(>=150)" value={stats.highWeight} valueStyle={{ color: '#722ED1', fontSize: 24 }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ borderRadius: 6, marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
        <Space wrap>
          <Input
            placeholder="搜索名称/简介"
            allowClear
            style={{ width: 240, borderRadius: 6 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined style={{ color: '#86909C' }} />}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 140, borderRadius: 6 }}
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
            options={[
              { value: 'online', label: '上线' },
              { value: 'offline', label: '下线' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ borderRadius: 6, background: '#165DFF', borderColor: '#165DFF' }}>
            新增卡片
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchCards} style={{ borderRadius: 6 }}>
            刷新
          </Button>
        </Space>
      </Card>

      <Card size="small" style={{ borderRadius: 6 }}>
        <Table
          columns={columns}
          dataSource={cards}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
            size: 'small',
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          scroll={{ x: 1200 }}
          size="small"
        />
      </Card>

      <Modal
        title={editingId ? '编辑功能卡片' : '新增功能卡片'}
        open={modalOpen}
        destroyOnHidden
        onCancel={() => { setModalOpen(false); setEditingId(null); form.resetFields(); }}
        footer={null}
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="功能名称" rules={[{ required: true, message: '请输入功能名称' }, { max: 100, message: '最多100个字符' }]}>
            <Input placeholder="请输入功能名称" style={{ borderRadius: 6 }} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="icon" label="图标选择" rules={[{ required: true, message: '请选择图标' }]}>
                <Select placeholder="请选择图标" style={{ borderRadius: 6 }}>
                  {ICON_CHOICES.map(icon => (
                    <Select.Option key={icon} value={icon}>{icon}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="icon_color" label="图标颜色">
                <Select placeholder="请选择颜色" style={{ borderRadius: 6 }}>
                  {COLOR_PRESETS.map(color => (
                    <Select.Option key={color} value={color}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', backgroundColor: color }} />
                        {color}
                      </span>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="功能简介" rules={[{ required: true, message: '请输入功能简介' }, { max: 200, message: '最多200个字符' }]}>
            <TextArea rows={2} placeholder="请输入功能简介" style={{ borderRadius: 6 }} />
          </Form.Item>

          <Form.Item name="prompt_template" label="场景Prompt模板">
            <TextArea rows={3} placeholder="配置该功能的AI提示词模板..." style={{ borderRadius: 6 }} />
          </Form.Item>

          <Form.Item name="knowledge_base" label="关联知识库">
            <Select placeholder="请选择关联的知识库（可选）" allowClear style={{ borderRadius: 6 }}>
              {knowledgeBases.map(kb => (
                <Select.Option key={kb.id} value={kb.id}>{kb.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sort_order" label="排序值">
                <InputNumber min={0} defaultValue={0} style={{ width: '100%', borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="weight" label="推荐权重" rules={[{ type: 'number', min: 0, max: 999, message: '范围0-999' }]}>
                <InputNumber min={0} max={999} defaultValue={100} style={{ width: '100%', borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="status" label="状态">
            <Select style={{ borderRadius: 6 }}>
              <Select.Option value="online">上线</Select.Option>
              <Select.Option value="offline">下线</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', margin: 0 }}>
            <Space>
              <Button onClick={() => { setModalOpen(false); setEditingId(null); form.resetFields(); }} style={{ borderRadius: 6 }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={saving} style={{ borderRadius: 6, background: '#165DFF', borderColor: '#165DFF' }}>
                {editingId ? '保存' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

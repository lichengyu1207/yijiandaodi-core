import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Switch, Tag, Space,
  message, Popconfirm, Row, Col, Statistic, InputNumber, ColorPicker
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, ReloadOutlined,
  PictureOutlined, UpCircleOutlined, DownCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  getAdminBannerList, createBanner, updateBanner, deleteBanner,
  type BannerItem
} from '@/api/bannerApi';

const { TextArea } = Input;

const PRESET_COLORS = ['#2563EB', '#7C3AED', '#059669', '#DC2626', '#EA580C', '#0891B2', '#4F46E5', '#BE185D'];

const LINK_TYPE_OPTIONS = [
  { value: 'article', label: '文章' },
  { value: 'url', label: '外部链接' },
  { value: 'action', label: '内部动作' },
];

const LINK_TYPE_COLORS: Record<string, string> = {
  article: 'blue',
  url: 'orange',
  action: 'purple',
};

const LINK_TYPE_LABELS: Record<string, string> = {
  article: '文章',
  url: '外部链接',
  action: '内部动作',
};

export default function BannerManage() {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BannerItem | null>(null);
  const [form] = Form.useForm();

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await getAdminBannerList();
      const data = res?.data || res;
      setBanners(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleSave = async (values: any) => {
    try {
      if (editing) {
        await updateBanner(editing.id, values);
        message.success('轮播图更新成功');
      } else {
        await createBanner(values);
        message.success('轮播图创建成功');
      }
      setModalOpen(false); setEditing(null); form.resetFields();
      fetchList();
    } catch { message.error('操作失败'); }
  };

  const handleToggleStatus = async (record: BannerItem) => {
    try {
      const newStatus = record.status === 'active' ? 'inactive' : 'active';
      await updateBanner(record.id, { ...record, status: newStatus });
      message.success(newStatus === 'active' ? '已上线' : '已下线');
      fetchList();
    } catch { message.error('操作失败'); }
  };

  const stats = {
    total: banners.length,
    active: banners.filter(b => b.status === 'active').length,
    inactive: banners.filter(b => b.status === 'inactive').length,
    clicks: banners.reduce((s, b) => s + (b.click_count || 0), 0),
  };

  const columns: ColumnsType<BannerItem> = [
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 60,
      render: (v: number) => <span style={{ color: '#999', fontSize: 12 }}>↑↓{v}</span>,
    },
    {
      title: '标题', dataIndex: 'title', width: 160,
      render: (t: string) => <span style={{ fontWeight: 600 }}>{t}</span>,
    },
    {
      title: '副标题', dataIndex: 'subtitle', width: 180, ellipsis: true,
      render: (t: string) => t || '-',
    },
    {
      title: '分类标签', dataIndex: 'category_tag', width: 100,
      render: (t: string) => t ? <Tag color="cyan" style={{ borderRadius: 4 }}>{t}</Tag> : '-',
    },
    {
      title: '背景色', dataIndex: 'bg_color', width: 80,
      render: (c: string) => (
        <span style={{
          display: 'inline-block',
          width: 32, height: 20, borderRadius: 4,
          backgroundColor: c, border: '1px solid #e0e0e0',
          verticalAlign: 'middle',
        }} />
      ),
    },
    {
      title: '链接类型', dataIndex: 'link_type', width: 90,
      render: (t: string) => (
        <Tag color={LINK_TYPE_COLORS[t] || 'default'} style={{ borderRadius: 4 }}>
          {LINK_TYPE_LABELS[t] || t}
        </Tag>
      ),
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v: string) => v === 'active'
        ? <Tag color="green" style={{ borderRadius: 4 }}>启用</Tag>
        : <Tag style={{ borderRadius: 4 }}>停用</Tag>,
    },
    { title: '排序权重', dataIndex: 'sort_order', width: 80 },
    {
      title: '点击次数', dataIndex: 'click_count', width: 80,
      render: (v: number) => v || 0,
    },
    {
      title: '更新时间', dataIndex: 'updated_at', width: 150,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作', width: 180, fixed: 'right' as const,
      render: (_, r) => (
        <Space size="small">
          <Button type="link" icon={<EditOutlined />} onClick={() => {
            setEditing(r); form.setFieldsValue(r); setModalOpen(true);
          }} />
          <Button
            type="link"
            icon={r.status === 'active' ? <DownCircleOutlined /> : <UpCircleOutlined />}
            onClick={() => handleToggleStatus(r)}
            style={{ color: r.status === 'active' ? '#faad14' : '#52c41a' }}
          />
          <Popconfirm title="确定删除该轮播图？" onConfirm={async () => {
            await deleteBanner(r.id); message.success('已删除'); fetchList();
          }}>
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #1890FF' }}>
            <Statistic title="总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #52C41A' }}>
            <Statistic title="启用中" value={stats.active} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #999' }}>
            <Statistic title="停用中" value={stats.inactive} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #722ED1' }}>
            <Statistic title="总点击量" value={stats.clicks} />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ borderRadius: 6, marginBottom: 16 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditing(null); form.resetFields();
            form.setFieldsValue({
              link_type: 'article',
              bg_color: '#2563EB',
              sort_order: 0,
              status: 'active',
            });
            setModalOpen(true);
          }} style={{ borderRadius: 6 }}>新增轮播图</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchList} style={{ borderRadius: 6 }} />
        </Space>
      </Card>

      <Card size="small" style={{ borderRadius: 6 }}>
        <Table
          columns={columns}
          dataSource={banners}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 1200 }}
          size="small"
        />
      </Card>

      <Modal
        title={editing ? '编辑轮播图' : '新增轮播图'}
        open={modalOpen}
        destroyOnHidden
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            link_type: 'article',
            bg_color: '#2563EB',
            sort_order: 0,
            status: 'active',
          }}
        >
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="轮播图标题" style={{ borderRadius: 6 }} />
          </Form.Item>
          <Form.Item name="subtitle" label="副标题">
            <Input placeholder="副标题（可选）" style={{ borderRadius: 6 }} />
          </Form.Item>
          <Form.Item name="description" label="详细描述">
            <TextArea rows={3} placeholder="详细描述内容" style={{ borderRadius: 6 }} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="image_url" label="封面图片URL">
                <Input placeholder="https://..." style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="link_url" label="跳转链接URL">
                <Input placeholder="https://..." style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="link_type" label="链接类型">
                <Select options={LINK_TYPE_OPTIONS} style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category_tag" label="分类标签">
                <Input placeholder="如：推荐、热门" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sort_order" label="排序权重">
                <InputNumber min={0} max={9999} style={{ width: '100%', borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="bg_color" label="背景颜色">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Form.Item name="bg_color" noStyle>
                    <ColorPicker
                      presets={[{
                        label: '预设色',
                        colors: PRESET_COLORS.map(c => ({ color: c, label: c })),
                      }]}
                      size="middle"
                      style={{ borderRadius: 6 }}
                    />
                  </Form.Item>
                  <Space size={4} wrap>
                    {PRESET_COLORS.map(c => (
                      <span
                        key={c}
                        style={{
                          width: 22, height: 22, borderRadius: 4, cursor: 'pointer',
                          backgroundColor: c, border: '2px solid #fff',
                          boxShadow: '0 0 0 1px #d9d9d9',
                        }}
                        onClick={() => form.setFieldValue('bg_color', c)}
                      />
                    ))}
                  </Space>
                </div>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ textAlign: 'right', margin: 0 }}>
            <Space>
              <Button onClick={() => { setModalOpen(false); setEditing(null); }} style={{ borderRadius: 6 }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" icon={<PictureOutlined />} style={{ borderRadius: 6 }}>
                {editing ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
import { useState, useEffect } from 'react';
import { Table, Button, Tag, Space, Popconfirm, Modal, Form, Input, InputNumber, Typography, App } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { contentApi, Category } from '@/api/content';
import './Categories.css';

const { Title } = Typography;

const generateSlug = (name: string): string => {
  return name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
};

const Categories: React.FC = () => {
  const { message } = App.useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data: any = await contentApi.getCategories();
      setCategories(Array.isArray(data) ? data : (data?.results || []));
    } catch {
      message.error('获取分类列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: Category) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name,
      slug: record.slug,
      description: record.description,
      sort_order: record.sort_order,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await contentApi.deleteCategory(id);
      message.success('删除成功');
      fetchCategories();
    } catch {
      message.error('删除失败');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setModalLoading(true);
      if (editingId) {
        await contentApi.updateCategory(editingId, values);
        message.success('更新成功');
      } else {
        await contentApi.createCategory({
          ...values,
          slug: values.slug || generateSlug(values.name),
        });
        message.success('创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      fetchCategories();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(editingId ? '更新失败' : '创建失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingId) {
      const slug = generateSlug(e.target.value);
      form.setFieldValue('slug', slug);
    }
  };

  const columns = [
    {
      title: '分类名称',
      dataIndex: 'name',
      key: 'name',
      width: '25%',
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
      width: '20%',
      render: (slug: string) => <code style={{ color: '#1A6BA8', background: '#F0F7FC', padding: '2px 8px', borderRadius: 4 }}>{slug}</code>,
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '文章数量',
      dataIndex: 'article_count',
      key: 'article_count',
      width: 100,
      align: 'center' as const,
      render: (count: number) => <Tag color="#1A6BA8">{count}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: Category) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该分类吗？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="categories-page">
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>分类管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增分类
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={categories}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        className="category-table"
      />

      <Modal
        title={editingId ? '编辑分类' : '新增分类'}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        confirmLoading={modalLoading}
        okText="确定"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="category-form">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="请输入分类名称" onChange={handleNameChange} maxLength={50} />
          </Form.Item>
          <Form.Item name="slug" label="Slug" rules={[{ required: true, message: '请输入 Slug' }]}>
            <Input placeholder="自动生成或手动输入" maxLength={100} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="可选，分类描述" rows={3} maxLength={200} />
          </Form.Item>
          <Form.Item name="sort_order" label="排序号" initialValue={0}>
            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Categories;

import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Space, Popconfirm, Modal, Form, Input, InputNumber, Select, Switch, TreeSelect, Typography, App } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, FolderOutlined, MenuOutlined, AppstoreOutlined } from '@ant-design/icons';
import { rbacApi } from '@/api/rbacApi';
import './Menus.css';

const { Title } = Typography;

interface MenuItem {
  id: number;
  name: string;
  code: string;
  type: 'directory' | 'menu' | 'button';
  path?: string;
  component?: string;
  icon?: string;
  sort_order: number;
  visible: boolean;
  status: 'active' | 'inactive';
  parent_id?: number | null;
  children?: MenuItem[];
}

interface MenuTreeNode {
  title: string;
  value: number;
  key: number;
  children?: MenuTreeNode[];
}

const typeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  directory: { label: '目录', color: '#722ED1', icon: <FolderOutlined /> },
  menu: { label: '菜单', color: '#1A6BA8', icon: <MenuOutlined /> },
  button: { label: '按钮', color: '#389e0d', icon: <AppstoreOutlined /> },
};

const Menus: React.FC = () => {
  const { message } = App.useApp();
  const [menuTree, setMenuTree] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchMenus = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await rbacApi.getMenuTree();
      setMenuTree(Array.isArray(res) ? res : (res?.data || []));
    } catch {
      message.error('获取菜单列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  const convertToTreeData = (menus: MenuItem[], level = 0): MenuTreeNode[] => {
    return menus.map((item) => ({
      title: item.name,
      value: item.id,
      key: item.id,
      children: item.children ? convertToTreeData(item.children, level + 1) : undefined,
    }));
  };

  const handleAddRoot = () => {
    setEditingId(null);
    setParentId(null);
    form.resetFields();
    form.setFieldsValue({ visible: true, sort_order: 0 });
    setModalOpen(true);
  };

  const handleAddChild = (record: MenuItem) => {
    setEditingId(null);
    setParentId(record.id);
    form.resetFields();
    form.setFieldsValue({ visible: true, sort_order: 0 });
    setModalOpen(true);
  };

  const handleEdit = (record: MenuItem) => {
    setEditingId(record.id);
    setParentId(record.parent_id || null);
    form.setFieldsValue({
      parent_id: record.parent_id,
      name: record.name,
      code: record.code,
      type: record.type,
      path: record.path,
      component: record.component,
      icon: record.icon,
      sort_order: record.sort_order,
      visible: record.visible,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await rbacApi.deleteMenu(id);
      message.success('删除成功');
      fetchMenus();
    } catch {
      message.error('删除失败');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setModalLoading(true);
      if (editingId) {
        await rbacApi.updateMenu(editingId, values);
        message.success('更新成功');
      } else {
        await rbacApi.createMenu({ ...values, parent_id: parentId });
        message.success('创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      setEditingId(null);
      setParentId(null);
      fetchMenus();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(editingId ? '更新失败' : '创建失败');
    } finally {
      setModalLoading(false);
    }
  };

  const renderNameWithIcon = (record: MenuItem) => {
    const config = typeConfig[record.type];
    return (
      <Space size={4}>
        <span style={{ color: config?.color }}>{config?.icon}</span>
        <span>{record.name}</span>
      </Space>
    );
  };

  const columns = [
    {
      title: '菜单名称',
      dataIndex: 'name',
      key: 'name',
      width: '18%',
      render: (_: string, record: MenuItem) => renderNameWithIcon(record),
    },
    {
      title: '菜单编码',
      dataIndex: 'code',
      key: 'code',
      width: '15%',
      render: (code: string) => (
        <code style={{ color: '#1A6BA8', background: '#F0F7FC', padding: '2px 8px', borderRadius: 4 }}>{code}</code>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      align: 'center' as const,
      render: (type: string) => {
        const config = typeConfig[type];
        return config ? <Tag color={config.color}>{config.label}</Tag> : <Tag>{type}</Tag>;
      },
    },
    {
      title: '路由路径',
      dataIndex: 'path',
      key: 'path',
      width: '14%',
      ellipsis: true,
      render: (path: string | undefined) => path || '--',
    },
    {
      title: '组件路径',
      dataIndex: 'component',
      key: 'component',
      width: '16%',
      ellipsis: true,
      render: (component: string | undefined) => component || '--',
    },
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 100,
      render: (icon: string | undefined) => icon || '--',
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 70,
      align: 'center' as const,
    },
    {
      title: '可见',
      dataIndex: 'visible',
      key: 'visible',
      width: 70,
      align: 'center' as const,
      render: (visible: boolean) => (
        <Switch size="small" checked={visible} disabled />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      align: 'center' as const,
      render: (status: string) => (
        <Tag color={status === 'active' ? '#389e0d' : '#999'}>{status === 'active' ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: MenuItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => handleAddChild(record)}
          >
            新增子菜单
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm title="确定删除该菜单吗？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="menus-page">
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>菜单管理</Title>
        <Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={handleAddRoot}>
            新建菜单
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchMenus}>
            刷新
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={menuTree}
        rowKey="id"
        loading={loading}
        pagination={false}
        className="menu-table"
        expandable={{
          defaultExpandAllRows: true,
        }}
      />

      <Modal
        title={editingId ? '编辑菜单' : (parentId ? '新增子菜单' : '新建菜单')}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => {
          setModalOpen(false);
          setEditingId(null);
          setParentId(null);
          form.resetFields();
        }}
        confirmLoading={modalLoading}
        okText="确定"
        cancelText="取消"
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical" className="menu-form">
          <Form.Item name="parent_id" label="上级菜单">
            <TreeSelect
              placeholder="请选择上级菜单（不选则为顶级）"
              treeData={[{ title: '顶级菜单', value: 0, key: 0, children: convertToTreeData(menuTree) }]}
              allowClear
              treeDefaultExpandAll
              dropdownStyle={{ maxHeight: 300, overflow: 'auto' }}
            />
          </Form.Item>
          <Form.Item name="name" label="菜单名称" rules={[{ required: true, message: '请输入菜单名称' }]}>
            <Input placeholder="请输入菜单名称" maxLength={50} />
          </Form.Item>
          <Form.Item name="code" label="菜单编码" rules={[{ required: true, message: '请输入菜单编码' }]}>
            <Input placeholder="请输入菜单编码，如 system:user" maxLength={100} />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="menu" rules={[{ required: true, message: '请选择类型' }]}>
            <Select placeholder="请选择类型">
              <Select.Option value="directory">目录</Select.Option>
              <Select.Option value="menu">菜单</Select.Option>
              <Select.Option value="button">按钮</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="path" label="路由路径">
            <Input placeholder="请输入路由路径，如 /system/user" maxLength={200} />
          </Form.Item>
          <Form.Item name="component" label="组件路径">
            <Input placeholder="请输入组件路径，如 /system/user/index" maxLength={200} />
          </Form.Item>
          <Form.Item name="icon" label="图标">
            <Input placeholder="请输入图标名称，如 UserOutlined" maxLength={50} />
          </Form.Item>
          <Form.Item name="sort_order" label="排序序号" initialValue={0}>
            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="visible" label="是否可见" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="可见" unCheckedChildren="隐藏" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Menus;

import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Select, Switch,
  Typography, Popconfirm, App, Input, InputNumber, Tree, Card
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  FolderOpenOutlined, LockOutlined, ApiOutlined, SafetyCertificateOutlined
} from '@ant-design/icons';
import { rbacApi, RoleItem, PermItem, RoleCreateData } from '@/api/rbacApi';
import type { DataNode } from 'antd/es/tree';
import './Roles.css';

const { Title, Text } = Typography;

const dataScopeMap: Record<string, { label: string; color: string }> = {
  all: { label: '全部数据', color: '#cf1322' },
  role: { label: '本角色数据', color: '#1A6BA8' },
  self: { label: '本人数据', color: '#8C8C8C' },
};

const permIconMap: Record<string, React.ReactNode> = {
  menu: <FolderOpenOutlined style={{ color: '#1A6BA8' }} />,
  button: <LockOutlined style={{ color: '#8C8C8C' }} />,
  api: <ApiOutlined style={{ color: '#389e0d' }} />,
};

const Roles: React.FC = () => {
  const { message, modal } = App.useApp();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
  const [permTree, setPermTree] = useState<PermItem[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [permSaving, setPermSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [isCreate, setIsCreate] = useState(false);
  const [form] = Form.useForm();

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await rbacApi.getRoles();
      setRoles(Array.isArray(res) ? res : (res?.data || res?.results?.data || res?.results || []));
    } catch {
      message.error('获取角色列表失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const fetchPermissionTree = useCallback(async () => {
    setPermLoading(true);
    try {
      const res: any = await rbacApi.getPermissionTree();
      setPermTree(Array.isArray(res) ? res : (res?.data || res?.results?.data || res?.results || []));
    } catch {
      message.error('获取权限树失败');
    } finally {
      setPermLoading(false);
    }
  }, [message]);

  const fetchRoleDetail = useCallback(async (role: RoleItem) => {
    setPermLoading(true);
    try {
      const detail: any = await rbacApi.getRoleDetail(role.id);
      const d = detail.data || detail;
      setCheckedKeys(d.permission_ids || []);
      if (!permTree.length) {
        await fetchPermissionTree();
      }
    } catch {
      message.error('获取角色详情失败');
    } finally {
      setPermLoading(false);
    }
  }, [message, permTree.length, fetchPermissionTree]);

  const handleRowClick = async (record: RoleItem) => {
    setSelectedRole(record);
    await fetchRoleDetail(record);
  };

  const handleCreate = () => {
    setIsCreate(true);
    setEditingRole(null);
    form.resetFields();
    form.setFieldsValue({
      status: true,
      sort_order: 0,
      data_scope: 'self',
    });
    setModalOpen(true);
  };

  const handleEdit = (record: RoleItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsCreate(false);
    setEditingRole(record);
    form.setFieldsValue({
      name: record.name,
      code: record.code,
      description: record.description || '',
      data_scope: record.data_scope,
      status: record.status,
      sort_order: record.sort_order,
    });
    setModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setModalLoading(true);
      if (isCreate) {
        await rbacApi.createRole(values as RoleCreateData);
        message.success('角色创建成功');
      } else if (editingRole) {
        const { code, ...updateData } = values;
        await rbacApi.updateRole(editingRole.id, updateData as Partial<RoleCreateData>);
        message.success('角色更新成功');
      }
      setModalOpen(false);
      setEditingRole(null);
      form.resetFields();
      fetchRoles();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(isCreate ? '创建失败' : '更新失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (record: RoleItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await rbacApi.deleteRole(record.id);
      message.success('删除成功');
      if (selectedRole?.id === record.id) {
        setSelectedRole(null);
        setCheckedKeys([]);
      }
      fetchRoles();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setPermSaving(true);
    try {
      await rbacApi.assignPermissions(selectedRole.id, checkedKeys as number[]);
      message.success('权限分配保存成功');
    } catch {
      message.error('权限分配保存失败');
    } finally {
      setPermSaving(false);
    }
  };

  const convertToTreeData = (nodes: PermItem[]): DataNode[] => {
    return nodes.map((node) => ({
      key: node.id,
      title: (
        <span className="perm-tree-node">
          <span className="perm-icon">{permIconMap[node.type] || <LockOutlined />}</span>
          <span className="perm-name">{node.name}</span>
        </span>
      ),
      icon: permIconMap[node.type],
      children: node.children ? convertToTreeData(node.children) : undefined,
    }));
  };

  const columns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      width: '18%',
      render: (name: string) => <Text strong style={{ fontWeight: 600 }}>{name}</Text>,
    },
    {
      title: '角色编码',
      dataIndex: 'code',
      key: 'code',
      width: '16%',
      render: (code: string) => <Text code>{code}</Text>,
    },
    {
      title: '数据范围',
      dataIndex: 'data_scope',
      key: 'data_scope',
      width: '14%',
      render: (scope: string) => {
        const info = dataScopeMap[scope];
        return info ? <Tag color={info.color}>{info.label}</Tag> : <Tag>{scope}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: '10%',
      align: 'center' as const,
      render: (status: boolean) => (
        <Tag color={status ? '#389e0d' : '#999'}>{status ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '用户数',
      dataIndex: 'user_count',
      key: 'user_count',
      width: '10%',
      align: 'center' as const,
      render: (count: number) => count ?? 0,
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: '8%',
      align: 'center' as const,
      render: (order: number) => order ?? 0,
    },
    {
      title: '操作',
      key: 'action',
      width: '24%',
      render: (_: unknown, record: RoleItem) => (
        <Space size="small" onClick={(e) => e.stopPropagation()}>
          <Button
            type="link"
            size="small"
            icon={<SafetyCertificateOutlined />}
            onClick={(e) => handleRowClick(record)}
          >
            编辑权限
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => handleEdit(record, e)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定删除角色「${record.name}」吗？`}
            onConfirm={(e) => handleDelete(record, e as React.MouseEvent)}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
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
    <div className="roles-page">
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>角色管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建角色
        </Button>
      </div>

      <div className="roles-layout">
        <div className="roles-left">
          <Table
            columns={columns}
            dataSource={roles}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            className="role-table"
            rowClassName={(record) =>
              selectedRole?.id === record.id ? 'role-row-selected' : ''
            }
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
              style: { cursor: 'pointer' },
            })}
          />
        </div>

        <div className="roles-right">
          {selectedRole ? (
            <Card
              className="perm-card"
              title={
                <Space>
                  <SafetyCertificateOutlined style={{ color: '#1A6BA8' }} />
                  <span>权限分配 - {selectedRole.name}</span>
                </Space>
              }
              extra={
                <Button
                  type="primary"
                  size="small"
                  loading={permSaving}
                  onClick={handleSavePermissions}
                >
                  保存权限分配
                </Button>
              }
            >
              <Tree
                checkable
                checkedKeys={checkedKeys}
                onCheck={(keys) => {
                  setCheckedKeys(keys as React.Key[]);
                }}
                treeData={convertToTreeData(permTree)}
                loading={permLoading}
                defaultExpandAll
                className="perm-tree"
              />
            </Card>
          ) : (
            <Card className="perm-card perm-card-empty">
              <div className="empty-hint">
                <SafetyCertificateOutlined style={{ fontSize: 32, color: '#D9D9D9', marginBottom: 12 }} />
                <Text type="secondary">请选择一个角色以查看和编辑权限</Text>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal
        title={isCreate ? '新建角色' : `编辑角色 - ${editingRole?.name || ''}`}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => { setModalOpen(false); setEditingRole(null); }}
        confirmLoading={modalLoading}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
        width={520}
      >
        <Form form={form} layout="vertical" className="role-form">
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="请输入角色名称" maxLength={50} />
          </Form.Item>
          <Form.Item name="code" label="角色编码" rules={[{ required: true, message: '请输入角色编码' }]}>
            <Input placeholder="请输入角色编码" disabled={!isCreate} maxLength={50} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述" rows={3} maxLength={200} />
          </Form.Item>
          <Form.Item name="data_scope" label="数据权限范围">
            <Select placeholder="请选择数据权限范围">
              <Select.Option value="all">全部数据</Select.Option>
              <Select.Option value="role">本角色数据</Select.Option>
              <Select.Option value="self">仅本人数据</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序序号">
            <InputNumber min={0} max={9999} style={{ width: '100%' }} placeholder="数字越小越靠前" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Roles;

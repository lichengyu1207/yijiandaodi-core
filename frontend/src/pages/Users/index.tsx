import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Space, Modal, Form, Select, Switch, Typography, Input, Popconfirm, App, Avatar } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
  UserOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { rbacApi, UserManageItem, RoleItem } from '@/api/rbacApi';
import './Users.css';

const { Title } = Typography;
const { Search } = Input;

const roleColorMap: Record<string, string> = {
  super_admin: '#cf1322',
  admin: '#1A6BA8',
  editor: '#389e0d',
  viewer: '#B8B3AC',
};

const getRoleColor = (code: string): string => {
  return roleColorMap[code] || '#1677ff';
};

interface ModalType {
  type: 'create' | 'edit' | null;
  user: UserManageItem | null;
}

const Users: React.FC = () => {
  const { message } = App.useApp();
  const [users, setUsers] = useState<UserManageItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [modalState, setModalState] = useState<ModalType>({ type: null, user: null });
  const [modalLoading, setModalLoading] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetchRoles = useCallback(async () => {
    try {
      const data: any = await rbacApi.getRoles();
      setRoles(Array.isArray(data) ? data : (data?.results || []));
    } catch {
      message.error('获取角色列表失败');
    }
  }, [message]);

  const fetchUsers = useCallback(async (page = currentPage, size = pageSize) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: size };
      if (searchText) params.search = searchText;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const res: any = await rbacApi.getUserManageList(params);
      const data = res?.data || res;
      const arr = Array.isArray(data) ? data : (data?.data || data?.results?.data || data?.results || []);
      setUsers(arr);
      setTotal(res?.count || data?.count || arr.length);
    } catch {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchText, roleFilter, statusFilter, message]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    fetchUsers(1, pageSize);
  }, [searchText, roleFilter, statusFilter]);

  useEffect(() => {
    if (currentPage > 1) {
      fetchUsers();
    }
  }, [currentPage]);

  const handleSearch = (value: string) => {
    setSearchText(value);
    setCurrentPage(1);
  };

  const handleRoleFilterChange = (value: string | undefined) => {
    setRoleFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string | undefined) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleTableChange = (pagination: any) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  };

  const openCreateModal = () => {
    createForm.resetFields();
    setModalState({ type: 'create', user: null });
  };

  const openEditModal = (record: UserManageItem) => {
    editForm.setFieldsValue({
      email: record.email,
      is_active: record.is_active,
      role_ids: record.roles?.map((r: RoleItem) => r.id) || [],
    });
    setModalState({ type: 'edit', user: record });
  };

  const closeModal = () => {
    setModalState({ type: null, user: null });
    setModalLoading(false);
  };

  const handleCreateUser = async () => {
    try {
      const values = await createForm.validateFields();
      if (values.password !== values.confirm_password) {
        message.error('两次输入的密码不一致');
        return;
      }
      setModalLoading(true);
      await rbacApi.createUser({
        username: values.username,
        email: values.email,
        password: values.password,
        role_ids: values.role_ids || [],
      });
      message.success('用户创建成功');
      closeModal();
      fetchUsers(1, pageSize);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || '创建用户失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    try {
      const values = await editForm.validateFields();
      if (!modalState.user) return;
      setModalLoading(true);
      await rbacApi.updateUser(modalState.user.id, {
        email: values.email,
        is_active: values.is_active,
        role_ids: values.role_ids || [],
      });
      message.success('用户更新成功');
      closeModal();
      fetchUsers(currentPage, pageSize);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || '更新用户失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      await rbacApi.deleteUser(id);
      message.success('用户删除成功');
      fetchUsers(currentPage, pageSize);
    } catch {
      message.error('删除用户失败');
    }
  };

  const handleResetPassword = async (userId: number) => {
    try {
      await rbacApi.resetPassword(userId);
      message.success('密码已重置为默认密码：12345678');
    } catch {
      message.error('重置密码失败');
    }
  };

  const handleToggleStatus = async (user: UserManageItem) => {
    try {
      await rbacApi.updateUser(user.id, { is_active: !user.is_active });
      message.success(user.is_active ? '已禁用用户' : '已启用用户');
      fetchUsers(currentPage, pageSize);
    } catch {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: '15%',
      render: (username: string, record: UserManageItem) => (
        <Space size="middle">
          <Avatar
            size="small"
            icon={<UserOutlined />}
            src={record.avatar}
            style={{ backgroundColor: '#1A6BA8' }}
          />
          <span style={{ fontWeight: 500 }}>{username}</span>
        </Space>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: '22%',
      ellipsis: true,
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      width: 180,
      render: (roles: RoleItem[]) =>
        roles && roles.length > 0 ? (
          <Space size={[4, 4]} wrap>
            {roles.map((role) => (
              <Tag key={role.id} color={getRoleColor(role.code)}>
                {role.name}
              </Tag>
            ))}
          </Space>
        ) : (
          <Tag color="#999">未分配</Tag>
        ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 90,
      align: 'center' as const,
      render: (active: boolean) => (
        <Tag color={active ? '#389e0d' : '#999'}>{active ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'date_joined',
      key: 'date_joined',
      width: 170,
      render: (t: string) => (t ? new Date(t).toLocaleString('zh-CN') : '--'),
    },
    {
      title: '最后登录',
      dataIndex: 'last_login',
      key: 'last_login',
      width: 170,
      render: (t: string | null) => (t ? new Date(t).toLocaleString('zh-CN') : '--'),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right' as const,
      render: (_: any, record: UserManageItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要重置该用户的密码吗？"
            description="重置后密码将变为默认密码：12345678"
            onConfirm={() => handleResetPassword(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" icon={<KeyOutlined />}>
              重置密码
            </Button>
          </Popconfirm>
          <Switch
            size="small"
            checked={record.is_active}
            onChange={() => handleToggleStatus(record)}
            checkedChildren="启"
            unCheckedChildren="禁"
          />
          <Popconfirm
            title="确定要删除该用户吗？"
            description="删除后无法恢复"
            onConfirm={() => handleDeleteUser(record.id)}
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
    <div className="users-page">
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>
          用户管理
        </Title>
        <Space size="middle" wrap>
          <Search
            placeholder="搜索用户名/邮箱"
            allowClear
            onSearch={handleSearch}
            onChange={(e) => e.target.value === '' && setSearchText('')}
            style={{ width: 220 }}
            prefix={<SearchOutlined style={{ color: '#B8B3AC' }} />}
          />
          <Select
            placeholder="角色筛选"
            allowClear
            value={roleFilter}
            onChange={handleRoleFilterChange}
            style={{ width: 130 }}
            options={roles.map((r) => ({ label: r.name, value: r.code }))}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            value={statusFilter}
            onChange={handleStatusFilterChange}
            style={{ width: 110 }}
            options={[
              { label: '启用', value: 'active' },
              { label: '禁用', value: 'inactive' },
            ]}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
          >
            新增用户
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchUsers(currentPage, pageSize)}
          >
            刷新
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 条`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 1200 }}
        className="user-table"
        size="middle"
      />

      <Modal
        title="新增用户"
        open={modalState.type === 'create'}
        onOk={handleCreateUser}
        onCancel={closeModal}
        confirmLoading={modalLoading}
        okText="创建"
        cancelText="取消"
        destroyOnHidden
        width={520}
      >
        {/* 创建用户表单 */}
        <Form form={createForm} layout="vertical" className="user-form">
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 2, max: 50, message: '用户名长度为2-50个字符' },
            ]}
          >
            <Input placeholder="请输入用户名" prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码长度至少8位' },
            ]}
          >
            <Input.Password placeholder="请输入密码（至少8位）" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入密码" />
          </Form.Item>
          <Form.Item name="role_ids" label="选择角色">
            <Select
              mode="multiple"
              placeholder="请选择角色（可多选）"
              allowClear
              options={roles.map((r) => ({ label: r.name, value: r.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`编辑用户 - ${modalState.user?.username || ''}`}
        open={modalState.type === 'edit'}
        onOk={handleUpdateUser}
        onCancel={closeModal}
        confirmLoading={modalLoading}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
        width={480}
      >
        <Form form={editForm} layout="vertical" className="user-form">
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item name="is_active" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item name="role_ids" label="选择角色">
            <Select
              mode="multiple"
              placeholder="请选择角色（可多选）"
              allowClear
              options={roles.map((r) => ({ label: r.name, value: r.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Users;

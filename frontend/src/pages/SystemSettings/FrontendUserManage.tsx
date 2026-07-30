import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Space,
  message, Popconfirm, Row, Col, Statistic, Typography, Spin
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, EyeOutlined,
  StopOutlined, CheckCircleOutlined, EditOutlined,
  UserOutlined, TeamOutlined, CloseCircleOutlined, PlusCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { systemManageApi } from '@/api/logCenterApi';

const { TextArea } = Input;
const { Text } = Typography;

interface FrontendUser {
  id: number;
  username: string;
  nickname: string;
  phone: string;
  date_joined: string;
  login_count: number;
  is_active: boolean;
  is_banned: boolean;
  remark?: string;
}

interface UserStats {
  total_users: number;
  active_users: number;
  banned_users: number;
  today_new: number;
}

interface BrowseRecord {
  id: number;
  page_url: string;
  page_title: string;
  ip_address: string;
  duration: number;
  visited_at: string;
}

export default function FrontendUserManage() {
  const [users, setUsers] = useState<FrontendUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [stats, setStats] = useState<UserStats>({ total_users: 0, active_users: 0, banned_users: 0, today_new: 0 });

  const [browseModalOpen, setBrowseModalOpen] = useState(false);
  const [browseRecords, setBrowseRecords] = useState<BrowseRecord[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseUser, setBrowseUser] = useState<string>('');

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetForm] = Form.useForm();
  const [resetSaving, setResetSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await systemManageApi.getFrontendUsers({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
      });
      const data = res?.data || res;
      setUsers(data?.results || []);
      setTotal(data?.total || 0);
    } catch {} finally { setLoading(false); }
  }, [page, pageSize, keyword, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await systemManageApi.getFrontendUserStats();
      const data = res?.data || res;
      setStats(data || {});
    } catch {}
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // 添加定时刷新机制（每30秒刷新一次）
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUsers();
      fetchStats();
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, [fetchUsers, fetchStats]);

  // 手动刷新函数
  const handleManualRefresh = () => {
    fetchUsers();
    fetchStats();
    message.success('数据已刷新');
  };

  const handleSearch = () => { setPage(1); fetchUsers(); };
  const handleReset = () => { setKeyword(''); setStatusFilter(''); setPage(1); };

  const handleBan = async (id: number) => {
    try {
      await systemManageApi.banUser(id, '违规操作');
      message.success('已禁用该用户');
      fetchUsers();
      fetchStats();
    } catch { message.error('操作失败'); }
  };

  const handleUnban = async (id: number) => {
    try {
      await systemManageApi.unbanUser(id);
      message.success('已解除禁用');
      fetchUsers();
      fetchStats();
    } catch { message.error('操作失败'); }
  };

  const handleOpenBrowse = async (record: FrontendUser) => {
    setBrowseUser(record.nickname || record.username);
    setBrowseModalOpen(true);
    setBrowseLoading(true);
    try {
      const res = await systemManageApi.getUserBrowseRecords(record.id);
      const data = res?.data || res;
      setBrowseRecords(data?.results || data || []);
    } catch { setBrowseRecords([]); } finally { setBrowseLoading(false); }
  };

  const handleOpenReset = (record: FrontendUser) => {
    setResetUserId(record.id);
    resetForm.setFieldsValue({ nickname: record.nickname, phone: record.phone, remark: record.remark || '' });
    setResetModalOpen(true);
  };

  const handleResetSubmit = async (values: { nickname: string; phone: string; remark: string }) => {
    if (!resetUserId) return;
    setResetSaving(true);
    try {
      await systemManageApi.resetUserInfo(resetUserId, values);
      message.success('用户信息已更新');
      setResetModalOpen(false);
      setResetUserId(null);
      resetForm.resetFields();
      fetchUsers();
    } catch { message.error('操作失败'); } finally { setResetSaving(false); }
  };

  const renderStatus = (record: FrontendUser) => {
    if (record.is_banned) return <Tag color="error" style={{ borderRadius: 4 }}>已禁用</Tag>;
    if (!record.is_active) return <Tag color="default" style={{ borderRadius: 4, color: '#86909C' }}>未激活</Tag>;
    return <Tag color="success" style={{ borderRadius: 4 }}>正常</Tag>;
  };

  const columns: ColumnsType<FrontendUser> = [
    {
      title: '账号',
      dataIndex: 'username',
      width: 140,
      render: (t: string) => <Text strong style={{ color: '#165DFF' }}>{t}</Text>,
    },
    { title: '昵称', dataIndex: 'nickname', width: 120, ellipsis: true },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    {
      title: '注册时间',
      dataIndex: 'date_joined',
      width: 170,
      sorter: (a: FrontendUser, b: FrontendUser) => new Date(a.date_joined).getTime() - new Date(b.date_joined).getTime(),
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '登录次数',
      dataIndex: 'login_count',
      width: 100,
      sorter: (a: FrontendUser, b: FrontendUser) => a.login_count - b.login_count,
      render: (v: number) => <Text>{v} 次</Text>,
    },
    {
      title: '状态',
      width: 100,
      render: (_, r) => renderStatus(r),
    },
    {
      title: '操作',
      width: 240,
      fixed: 'right' as const,
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleOpenBrowse(r)}>
            浏览记录
          </Button>
          {r.is_banned ? (
            <Popconfirm title="确定解除禁用？" onConfirm={() => handleUnban(r.id)}>
              <Button type="link" size="small" icon={<CheckCircleOutlined />} style={{ color: '#52C41A' }}>
                解禁
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm title="确定禁用该用户？" description="禁用后用户将无法登录系统" onConfirm={() => handleBan(r.id)}>
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                禁用
              </Button>
            </Popconfirm>
          )}
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenReset(r)}>
            重置信息
          </Button>
        </Space>
      ),
    },
  ];

  const browseColumns: ColumnsType<BrowseRecord> = [
    { title: '页面URL', dataIndex: 'page_url', ellipsis: true, render: (u: string) => <Text style={{ fontSize: 12 }} copyable>{{ text: u }}</Text> },
    { title: '标题', dataIndex: 'page_title', width: 160, ellipsis: true },
    { title: 'IP地址', dataIndex: 'ip_address', width: 140 },
    {
      title: '停留时长',
      dataIndex: 'duration',
      width: 100,
      render: (v: number) => {
        if (v < 60) return `${v}秒`;
        if (v < 3600) return `${Math.floor(v / 60)}分${v % 60}秒`;
        const h = Math.floor(v / 3600);
        const m = Math.floor((v % 3600) / 60);
        return `${h}时${m}分`;
      },
    },
    {
      title: '访问时间',
      dataIndex: 'visited_at',
      width: 170,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F5F7FA', minHeight: '100vh' }}>
      <Text strong style={{ fontSize: 18, marginBottom: 16, display: 'block', color: '#1D2129' }}>
        <TeamOutlined style={{ marginRight: 8, color: '#165DFF' }} />
        前台注册用户管理
      </Text>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #165DFF' }}>
            <Statistic title="总用户数" value={stats.total_users} prefix={<UserOutlined />} valueStyle={{ color: '#165DFF', fontSize: 24 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #00B42A' }}>
            <Statistic title="活跃用户" value={stats.active_users} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#00B42A', fontSize: 24 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #F53F3F' }}>
            <Statistic title="已禁用" value={stats.banned_users} prefix={<CloseCircleOutlined />} valueStyle={{ color: '#F53F3F', fontSize: 24 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #722ED1' }}>
            <Statistic title="今日新增" value={stats.today_new} prefix={<PlusCircleOutlined />} valueStyle={{ color: '#722ED1', fontSize: 24 }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ borderRadius: 6, marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
        <Space wrap>
          <Input
            placeholder="搜索账号/昵称/手机号"
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
              { value: 'active', label: '正常' },
              { value: 'banned', label: '已禁用' },
              { value: 'inactive', label: '未激活' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} style={{ borderRadius: 6, background: '#165DFF', borderColor: '#165DFF' }}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset} style={{ borderRadius: 6 }}>
            重置
          </Button>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleManualRefresh}
            loading={loading}
            style={{ borderRadius: 6, marginLeft: 8 }}
          >
            刷新数据
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchUsers} style={{ borderRadius: 6 }}>
            刷新
          </Button>
        </Space>
      </Card>

      <Card size="small" style={{ borderRadius: 6 }}>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            size: 'small',
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          scroll={{ x: 1100 }}
          size="small"
        />
      </Card>

      <Modal
        title={`浏览记录 - ${browseUser}`}
        open={browseModalOpen}
        destroyOnHidden
        onCancel={() => { setBrowseModalOpen(false); setBrowseRecords([]); }}
        footer={null}
        width={900}
      >
        {browseLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <Table
            columns={browseColumns}
            dataSource={browseRecords}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10, size: 'small', showTotal: (t) => `共 ${t} 条` }}
            scroll={{ x: 800 }}
          />
        )}
      </Modal>

      <Modal
        title="重置用户信息"
        open={resetModalOpen}
        destroyOnHidden
        onCancel={() => { setResetModalOpen(false); setResetUserId(null); resetForm.resetFields(); }}
        footer={null}
        width={520}
      >
        <Form form={resetForm} layout="vertical" onFinish={handleResetSubmit}>
          <Form.Item name="nickname" label="昵称" rules={[{ max: 50, message: '昵称最多50个字符' }]}>
            <Input placeholder="请输入新昵称" style={{ borderRadius: 6 }} />
          </Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }]}>
            <Input placeholder="请输入新手机号" maxLength={11} style={{ borderRadius: 6 }} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注信息" style={{ borderRadius: 6 }} />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', margin: 0 }}>
            <Space>
              <Button onClick={() => { setResetModalOpen(false); setResetUserId(null); resetForm.resetFields(); }} style={{ borderRadius: 6 }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={resetSaving} style={{ borderRadius: 6, background: '#165DFF', borderColor: '#165DFF' }}>
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

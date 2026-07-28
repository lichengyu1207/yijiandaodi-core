import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Input, Select, DatePicker, Space, Card, Typography, App, Collapse } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { rbacApi } from '@/api/rbacApi';
import type { Dayjs } from 'dayjs';
import './AuditLogs.css';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;

interface AuditLog {
  id: number;
  operator_name: string;
  target_type: 'user' | 'role' | 'permission' | 'menu';
  target_name: string;
  action: string;
  detail_before?: string | object | null;
  detail_after?: string | object | null;
  ip_address: string;
  created_at: string;
}

const targetTypeConfig: Record<string, { label: string; color: string }> = {
  user: { label: '用户', color: '#1A6BA8' },
  role: { label: '角色', color: '#722ED1' },
  permission: { label: '权限', color: '#389e0d' },
  menu: { label: '菜单', color: '#FA8C16' },
};

const actionColorMap: Record<string, string> = {
  assign_role: '#389e0d',
  remove_role: '#cf1322',
  assign_permission: '#1A6BA8',
  remove_permission: '#FA8C16',
  create_role: '#52c41a',
  update_role: '#1677ff',
  delete_role: '#ff4d4f',
  create_user: '#52c41a',
  update_user: '#1677ff',
  delete_user: '#ff4d4f',
  create_menu: '#52c41a',
  update_menu: '#1677ff',
  delete_menu: '#ff4d4f',
};

const actionLabelMap: Record<string, string> = {
  assign_role: '分配角色',
  remove_role: '移除角色',
  assign_permission: '分配权限',
  remove_permission: '移除权限',
  create_role: '创建角色',
  update_role: '更新角色',
  delete_role: '删除角色',
  create_user: '创建用户',
  update_user: '更新用户',
  delete_user: '删除用户',
  create_menu: '创建菜单',
  update_menu: '更新菜单',
  delete_menu: '删除菜单',
};

const AuditLogs: React.FC = () => {
  const { message } = App.useApp();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [targetTypeFilter, setTargetTypeFilter] = useState<string | undefined>(undefined);
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [keyword, setKeyword] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page: current,
        page_size: pageSize,
      };
      if (targetTypeFilter && targetTypeFilter !== 'all') params.target_type = targetTypeFilter;
      if (actionFilter && actionFilter !== 'all') params.action = actionFilter;
      if (dateRange?.[0]) params.start_date = dateRange[0].format('YYYY-MM-DD');
      if (dateRange?.[1]) params.end_date = dateRange[1].format('YYYY-MM-DD');
      if (keyword) params.keyword = keyword;

      const res: any = await rbacApi.getAuditLogs(params);
      const data = res?.data || res;
      const arr = Array.isArray(data) ? data : (data?.data || data?.results?.data || data?.results || []);
      setLogs(arr);
      setTotal(res?.count || data?.count || arr.length);
    } catch {
      message.error('获取审计日志失败');
    } finally {
      setLoading(false);
    }
  }, [current, pageSize, targetTypeFilter, actionFilter, dateRange, keyword]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = () => {
    setCurrent(1);
    fetchLogs();
  };

  const handleReset = () => {
    setTargetTypeFilter(undefined);
    setActionFilter(undefined);
    setDateRange(null);
    setKeyword('');
    setCurrent(1);
  };

  const renderJsonDetail = (detail: string | object | null | undefined, label: string) => {
    if (!detail) return <span style={{ color: '#999' }}>--</span>;

    let content: string;
    try {
      content = typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
    } catch {
      content = String(detail);
    }

    return (
      <Collapse
        size="small"
        ghost
        items={[{
          key: '1',
          label: <span style={{ cursor: 'pointer', color: '#1A6BA8' }}>查看{label}</span>,
          children: (
            <pre style={{
              background: '#F5F5F5',
              padding: 12,
              borderRadius: 6,
              fontSize: 12,
              maxHeight: 300,
              overflow: 'auto',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {content}
            </pre>
          ),
        }]}
      />
    );
  };

  const columns = [
    {
      title: '操作人',
      dataIndex: 'operator_name',
      key: 'operator_name',
      width: 120,
      fixed: 'left' as const,
    },
    {
      title: '目标类型',
      dataIndex: 'target_type',
      key: 'target_type',
      width: 100,
      render: (type: string) => {
        const config = targetTypeConfig[type];
        return config ? <Tag color={config.color}>{config.label}</Tag> : <Tag>{type}</Tag>;
      },
    },
    {
      title: '目标名称',
      dataIndex: 'target_name',
      key: 'target_name',
      width: 140,
      ellipsis: true,
    },
    {
      title: '操作动作',
      dataIndex: 'action',
      key: 'action',
      width: 110,
      render: (action: string) => (
        <Tag color={actionColorMap[action] || '#999'}>
          {actionLabelMap[action] || action}
        </Tag>
      ),
    },
    {
      title: '变更前内容',
      dataIndex: 'detail_before',
      key: 'detail_before',
      width: 140,
      render: (detail: string | object | null) => renderJsonDetail(detail, '变更前'),
    },
    {
      title: '变更后内容',
      dataIndex: 'detail_after',
      key: 'detail_after',
      width: 140,
      render: (detail: string | object | null) => renderJsonDetail(detail, '变更后'),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
      render: (ip: string) => (
        <code style={{ color: '#666', background: '#F5F5F5', padding: '2px 8px', borderRadius: 4 }}>{ip}</code>
      ),
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (t: string) => (t ? new Date(t).toLocaleString('zh-CN') : '--'),
    },
  ];

  return (
    <div className="audit-logs-page">
      <Title level={4} style={{ marginBottom: 20 }}>权限审计日志</Title>

      <Card className="filter-card" size="small">
        <Space wrap size="middle">
          <Select
            placeholder="目标类型"
            value={targetTypeFilter}
            onChange={setTargetTypeFilter}
            allowClear
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部类型' },
              ...Object.entries(targetTypeConfig).map(([key, val]) => ({ value: key, label: val.label })),
            ]}
          />
          <Select
            placeholder="操作动作"
            value={actionFilter}
            onChange={setActionFilter}
            allowClear
            style={{ width: 150 }}
            options={[
              { value: 'all', label: '全部动作' },
              ...Object.entries(actionLabelMap).map(([key, val]) => ({ value: key, label: val })),
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
            placeholder={['开始日期', '结束日期']}
            style={{ width: 240 }}
          />
          <Input
            placeholder="搜索关键词"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
            style={{ width: 180 }}
            prefix={<SearchOutlined style={{ color: '#999' }} />}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          current,
          pageSize,
          total,
          showTotal: (t) => `共 ${t} 条`,
          showSizeChanger: true,
          showQuickJumper: true,
          onChange: (page, size) => {
            setCurrent(page);
            setPageSize(size);
          },
        }}
        className="audit-table"
      />
    </div>
  );
};

export default AuditLogs;

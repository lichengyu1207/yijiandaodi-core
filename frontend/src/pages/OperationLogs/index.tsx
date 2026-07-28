import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Input, Select, DatePicker, Space, Card, Typography, App } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { rbacApi } from '@/api/rbacApi';
import type { Dayjs } from 'dayjs';
import './OperationLogs.css';

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface OperationLog {
  id: number;
  operator_name: string;
  module: string;
  action: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  ip_address: string;
  result: 'success' | 'failed';
  duration: number;
  created_at: string;
  message?: string;
}

const moduleConfig: Record<string, { label: string; color: string }> = {
  user_management: { label: '用户管理', color: '#1A6BA8' },
  role_management: { label: '角色管理', color: '#722ED1' },
  menu_management: { label: '菜单管理', color: '#389e0d' },
  content_management: { label: '内容管理', color: '#FA8C16' },
  system: { label: '系统设置', color: '#cf1322' },
};

const actionConfig: Record<string, { label: string; color: string }> = {
  create: { label: '新增', color: '#389e0d' },
  update: { label: '修改', color: '#1A6BA8' },
  delete: { label: '删除', color: '#cf1322' },
  export: { label: '导出', color: '#FA8C16' },
  import: { label: '导入', color: '#722ED1' },
  login: { label: '登录', color: '#52c41a' },
  logout: { label: '登出', color: '#999' },
};

const methodColorMap: Record<string, string> = {
  GET: '#389e0d',
  POST: '#1A6BA8',
  PUT: '#FA8C16',
  DELETE: '#cf1322',
  PATCH: '#722ED1',
};

const OperationLogs: React.FC = () => {
  const { message } = App.useApp();
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [moduleFilter, setModuleFilter] = useState<string | undefined>(undefined);
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);
  const [resultFilter, setResultFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [keyword, setKeyword] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page: current,
        page_size: pageSize,
      };
      if (moduleFilter && moduleFilter !== 'all') params.module = moduleFilter;
      if (actionFilter && actionFilter !== 'all') params.action = actionFilter;
      if (resultFilter && resultFilter !== 'all') params.result = resultFilter;
      if (dateRange?.[0]) params.start_date = dateRange[0].format('YYYY-MM-DD');
      if (dateRange?.[1]) params.end_date = dateRange[1].format('YYYY-MM-DD');
      if (keyword) params.keyword = keyword;

      const res: any = await rbacApi.getOperationLogs(params);
      const data = res?.data || res;
      const arr = Array.isArray(data) ? data : (data?.data || data?.results?.data || data?.results || []);
      setLogs(arr);
      setTotal(res?.count || data?.count || arr.length);
    } catch {
      message.error('获取操作日志失败');
    } finally {
      setLoading(false);
    }
  }, [current, pageSize, moduleFilter, actionFilter, resultFilter, dateRange, keyword]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = () => {
    setCurrent(1);
    fetchLogs();
  };

  const handleReset = () => {
    setModuleFilter(undefined);
    setActionFilter(undefined);
    setResultFilter(undefined);
    setDateRange(null);
    setKeyword('');
    setCurrent(1);
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
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 110,
      render: (module: string) => {
        const config = moduleConfig[module];
        return config ? <Tag color={config.color}>{config.label}</Tag> : <Tag>{module}</Tag>;
      },
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 90,
      render: (action: string) => {
        const config = actionConfig[action];
        return config ? <Tag color={config.color}>{config.label}</Tag> : <Tag>{action}</Tag>;
      },
    },
    {
      title: '请求方法',
      dataIndex: 'method',
      key: 'method',
      width: 95,
      align: 'center' as const,
      render: (method: string) => (
        <Tag color={methodColorMap[method] || '#999'} style={{ fontWeight: 600 }}>
          {method}
        </Tag>
      ),
    },
    {
      title: '请求URL',
      dataIndex: 'url',
      key: 'url',
      width: '18%',
      ellipsis: true,
      render: (url: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{url}</span>
      ),
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
      title: '执行结果',
      dataIndex: 'result',
      key: 'result',
      width: 90,
      align: 'center' as const,
      render: (result: string) => (
        <Tag color={result === 'success' ? '#389e0d' : '#cf1322'} style={{ fontWeight: 500 }}>
          {result === 'success' ? '成功' : '失败'}
        </Tag>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      align: 'center' as const,
      render: (duration: number) => (
        <span style={{ color: duration > 1000 ? '#cf1322' : duration > 500 ? '#FA8C16' : '#389e0d' }}>
          {duration}ms
        </span>
      ),
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (t: string) => (t ? new Date(t).toLocaleString('zh-CN') : '--'),
    },
    {
      title: '执行消息',
      dataIndex: 'message',
      key: 'message',
      width: '14%',
      ellipsis: true,
      render: (msg: string | undefined) => msg || '--',
    },
  ];

  return (
    <div className="operation-logs-page">
      <Title level={4} style={{ marginBottom: 20 }}>操作日志</Title>

      <Card className="filter-card" size="small">
        <Space wrap size="middle">
          <Select
            placeholder="模块"
            value={moduleFilter}
            onChange={setModuleFilter}
            allowClear
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部模块' },
              ...Object.entries(moduleConfig).map(([key, val]) => ({ value: key, label: val.label })),
            ]}
          />
          <Select
            placeholder="操作类型"
            value={actionFilter}
            onChange={setActionFilter}
            allowClear
            style={{ width: 130 }}
            options={[
              { value: 'all', label: '全部类型' },
              ...Object.entries(actionConfig).map(([key, val]) => ({ value: key, label: val.label })),
            ]}
          />
          <Select
            placeholder="执行结果"
            value={resultFilter}
            onChange={setResultFilter}
            allowClear
            style={{ width: 120 }}
            options={[
              { value: 'all', label: '全部结果' },
              { value: 'success', label: '成功' },
              { value: 'failed', label: '失败' },
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
        scroll={{ x: 1400 }}
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
        className="log-table"
      />
    </div>
  );
};

export default OperationLogs;

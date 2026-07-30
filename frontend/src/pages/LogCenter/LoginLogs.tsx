import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Card,
  Tag,
  Select,
  DatePicker,
  Input,
  Button,
  Space,
  Typography,
  App,
  Row,
  Col,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import { logCenterApi } from '@/api/logCenterApi';

const { RangePicker } = DatePicker;
const { Title } = Typography;

interface LoginLogItem {
  id?: number;
  username: string;
  ip_address: string;
  device_info: string;
  login_time: string;
  status: string;
  logout_time: string;
}

interface LoginStats {
  today_login_count: number;
  today_failed_count: number;
  active_user_count: number;
  online_count: number;
}

const statusMap: Record<string, { color: string; label: string }> = {
  success: { color: '#00B42A', label: '成功' },
  failed: { color: '#F53F3F', label: '失败' },
  logout: { color: '#86909C', label: '退出' },
  timeout: { color: '#FF7D00', label: '超时' },
  kicked: { color: '#F53F3F', label: '被踢' },
};

const LoginLogs: React.FC = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LoginLogItem[]>([]);
  const [stats, setStats] = useState<LoginStats>({
    today_login_count: 0,
    today_failed_count: 0,
    active_user_count: 0,
    online_count: 0,
  });
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [timeRange, setTimeRange] = useState<[string, string] | undefined>(
    undefined
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page: current,
        page_size: pageSize,
      };
      if (username) params.username = username;
      if (status) params.status = status;
      if (timeRange) {
        params.start_time = timeRange[0];
        params.end_time = timeRange[1];
      }
      const res = await logCenterApi.getLoginLogs(params);
      const list = res?.results || res?.data || res || [];
      setData(Array.isArray(list) ? list : []);
      setTotal(res?.count ?? (Array.isArray(list) ? list.length : 0));
    } catch {
      message.error('获取登录日志失败');
    } finally {
      setLoading(false);
    }
  }, [current, pageSize, username, status, timeRange, message]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await logCenterApi.getLoginStats();
      setStats({
        today_login_count: res?.today_login_count ?? 0,
        today_failed_count: res?.today_failed_count ?? 0,
        active_user_count: res?.active_user_count ?? 0,
        online_count: res?.online_count ?? 0,
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleExport = async () => {
    try {
      const params: Record<string, unknown> = {};
      if (username) params.username = username;
      if (status) params.status = status;
      if (timeRange) {
        params.start_time = timeRange[0];
        params.end_time = timeRange[1];
      }
      await logCenterApi.exportLoginLogs(params);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const columns: ColumnsType<LoginLogItem> = [
    {
      title: '账号',
      dataIndex: 'username',
      key: 'username',
      width: 140,
      ellipsis: true,
    },
    {
      title: '登录IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 150,
      ellipsis: true,
    },
    {
      title: '登录设备',
      dataIndex: 'device_info',
      key: 'device_info',
      width: 180,
      ellipsis: true,
    },
    {
      title: '登录时间',
      dataIndex: 'login_time',
      key: 'login_time',
      width: 180,
      render: (t: string) =>
        t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const item = statusMap[s];
        return item ? (
          <Tag color={item.color}>{item.label}</Tag>
        ) : (
          <Tag>{s || '-'}</Tag>
        );
      },
    },
    {
      title: '退出时间',
      dataIndex: 'logout_time',
      key: 'logout_time',
      width: 180,
      render: (t: string) =>
        t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F5F7FA', minHeight: '100%' }}>
      <Title level={4} style={{ color: '#1D2129', marginBottom: 16 }}>
        登录日志
      </Title>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card
            size="small"
            style={{
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #E5E6EB',
            }}
          >
            <div style={{ fontSize: 14, color: '#86909C', marginBottom: 4 }}>
              今日登录数
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: '#165DFF',
              }}
            >
              {stats.today_login_count}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            style={{
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #E5E6EB',
            }}
          >
            <div style={{ fontSize: 14, color: '#86909C', marginBottom: 4 }}>
              今日失败数
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: '#F53F3F',
              }}
            >
              {stats.today_failed_count}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            style={{
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #E5E6EB',
            }}
          >
            <div style={{ fontSize: 14, color: '#86909C', marginBottom: 4 }}>
              活跃用户数
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: '#00B42A',
              }}
            >
              {stats.active_user_count}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            style={{
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #E5E6EB',
            }}
          >
            <div style={{ fontSize: 14, color: '#86909C', marginBottom: 4 }}>
              当前在线
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: '#165DFF',
              }}
            >
              {stats.online_count}
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        style={{
          borderRadius: 6,
          background: '#fff',
          border: '1px solid #E5E6EB',
        }}
      >
        <Space wrap style={{ marginBottom: 16 }} size="middle">
          <Input
            placeholder="请输入账号"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onPressEnter={() => setCurrent(1)}
            allowClear
            style={{ width: 200, borderRadius: 6 }}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="选择状态"
            value={status}
            onChange={(v) => setStatus(v)}
            allowClear
            style={{ width: 140, borderRadius: 6 }}
            options={[
              { label: '全部', value: '' },
              { label: '成功', value: 'success' },
              { label: '失败', value: 'failed' },
              { label: '正常退出', value: 'logout' },
              { label: '会话超时', value: 'timeout' },
              { label: '被踢下线', value: 'kicked' },
            ]}
          />
          <RangePicker
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setTimeRange([
                  dates[0].toISOString(),
                  dates[1].toISOString(),
                ]);
              } else {
                setTimeRange(undefined);
              }
            }}
            style={{ borderRadius: 6 }}
          />
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            style={{ borderRadius: 6, backgroundColor: '#165DFF' }}
          >
            导出
          </Button>
        </Space>

        <Table<LoginLogItem>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          scroll={{ x: 1000 }}
          pagination={{
            current,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (page, size) => {
              setCurrent(page);
              setPageSize(size);
            },
          }}
        />
      </Card>
    </div>
  );
};

export default LoginLogs;

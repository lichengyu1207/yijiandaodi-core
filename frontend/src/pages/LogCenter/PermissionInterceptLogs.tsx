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
import { SearchOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { logCenterApi } from '@/api/logCenterApi';

const { RangePicker } = DatePicker;
const { Title } = Typography;

interface PermissionInterceptItem {
  id?: number;
  username: string;
  intercept_type: string;
  target_resource: string;
  request_method: string;
  request_url: string;
  ip_address: string;
  detail: string;
  created_at: string;
}

interface PermissionInterceptStats {
  total_count: number;
  today_count: number;
  api_unauthorized_count: number;
  menu_unauthorized_count: number;
}

const interceptTypeConfig: Record<string, { label: string; color: string }> = {
  menu_unauthorized: { label: '越权访问菜单', color: '#F53F3F' },
  api_unauthorized: { label: '越权调用接口', color: '#FF7D00' },
  button_denied: { label: '无权限按钮点击', color: '#F53F3F' },
  token_expired: { label: 'Token过期访问', color: '#86909C' },
  token_invalid: { label: '无效Token访问', color: '#86909C' },
  rate_limited: { label: '频率限制拦截', color: '#FF7D00' },
};

const methodColorMap: Record<string, string> = {
  GET: '#165DFF',
  POST: '#00B42A',
  PUT: '#722ED1',
  DELETE: '#F53F3F',
  PATCH: '#FF7D00',
};

const interceptTypeOptions = [
  { label: '全部', value: '' },
  ...Object.entries(interceptTypeConfig).map(([value, { label }]) => ({
    label,
    value,
  })),
];

const PermissionInterceptLogs: React.FC = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PermissionInterceptItem[]>([]);
  const [stats, setStats] = useState<PermissionInterceptStats>({
    total_count: 0,
    today_count: 0,
    api_unauthorized_count: 0,
    menu_unauthorized_count: 0,
  });
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [interceptType, setInterceptType] = useState<string | undefined>(
    undefined
  );
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
      if (keyword) params.keyword = keyword;
      if (interceptType) params.intercept_type = interceptType;
      if (timeRange) {
        params.start_time = timeRange[0];
        params.end_time = timeRange[1];
      }
      const res = await logCenterApi.getPermissionIntercepts(params);
      const list = res?.results || res?.data || res || [];
      setData(Array.isArray(list) ? list : []);
      setTotal(res?.count ?? (Array.isArray(list) ? list.length : 0));
    } catch {
      message.error('获取权限拦截日志失败');
    } finally {
      setLoading(false);
    }
  }, [current, pageSize, keyword, interceptType, timeRange, message]);

  const fetchStats = useCallback(async () => {
    try {
      const params: Record<string, unknown> = {};
      if (keyword) params.keyword = keyword;
      if (interceptType) params.intercept_type = interceptType;
      if (timeRange) {
        params.start_time = timeRange[0];
        params.end_time = timeRange[1];
      }
      const res = await logCenterApi.getPermissionIntercepts({
        ...params,
        page: 1,
        page_size: 1,
      });
      setStats({
        total_count: res?.count ?? 0,
        today_count: res?.today_count ?? 0,
        api_unauthorized_count: res?.api_unauthorized_count ?? 0,
        menu_unauthorized_count: res?.menu_unauthorized_count ?? 0,
      });
    } catch {
      // ignore
    }
  }, [keyword, interceptType, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleExport = async () => {
    try {
      const params: Record<string, unknown> = {};
      if (keyword) params.keyword = keyword;
      if (interceptType) params.intercept_type = interceptType;
      if (timeRange) {
        params.start_time = timeRange[0];
        params.end_time = timeRange[1];
      }
      await logCenterApi.exportPermissionIntercepts(params);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const handleReset = () => {
    setKeyword('');
    setInterceptType(undefined);
    setTimeRange(undefined);
    setCurrent(1);
  };

  const columns: ColumnsType<PermissionInterceptItem> = [
    {
      title: '账号',
      dataIndex: 'username',
      key: 'username',
      width: 140,
      ellipsis: true,
    },
    {
      title: '拦截类型',
      dataIndex: 'intercept_type',
      key: 'intercept_type',
      width: 160,
      render: (t: string) => {
        const item = interceptTypeConfig[t];
        return item ? (
          <Tag color={item.color}>{item.label}</Tag>
        ) : (
          <Tag>{t || '-'}</Tag>
        );
      },
    },
    {
      title: '目标资源',
      dataIndex: 'target_resource',
      key: 'target_resource',
      width: 180,
      ellipsis: true,
    },
    {
      title: '请求方法',
      dataIndex: 'request_method',
      key: 'request_method',
      width: 100,
      render: (m: string) => {
        const color = methodColorMap[m?.toUpperCase()] || '#86909C';
        return (
          <Tag style={{ fontWeight: 600 }} color={color}>
            {m || '-'}
          </Tag>
        );
      },
    },
    {
      title: '请求URL',
      dataIndex: 'request_url',
      key: 'request_url',
      width: 240,
      ellipsis: true,
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 150,
      ellipsis: true,
    },
    {
      title: '拦截详情',
      dataIndex: 'detail',
      key: 'detail',
      width: 220,
      ellipsis: true,
    },
    {
      title: '拦截时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (t: string) =>
        t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F5F7FA', minHeight: '100%' }}>
      <Title level={4} style={{ color: '#1D2129', marginBottom: 16 }}>
        权限拦截日志
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
              总拦截数
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: '#165DFF',
              }}
            >
              {stats.total_count}
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
              今日拦截数
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: '#F53F3F',
              }}
            >
              {stats.today_count}
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
              API越权数
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: '#FF7D00',
              }}
            >
              {stats.api_unauthorized_count}
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
              菜单越权数
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: '#F53F3F',
              }}
            >
              {stats.menu_unauthorized_count}
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
            placeholder="搜索账号/资源/URL"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={() => setCurrent(1)}
            allowClear
            style={{ width: 220, borderRadius: 6 }}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="拦截类型"
            value={interceptType}
            onChange={(v) => setInterceptType(v)}
            allowClear
            style={{ width: 170, borderRadius: 6 }}
            options={interceptTypeOptions}
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
            icon={<ReloadOutlined />}
            onClick={handleReset}
            style={{ borderRadius: 6 }}
          >
            重置
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            style={{ borderRadius: 6, backgroundColor: '#165DFF' }}
          >
            导出
          </Button>
        </Space>

        <Table<PermissionInterceptItem>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          scroll={{ x: 1300 }}
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

export default PermissionInterceptLogs;

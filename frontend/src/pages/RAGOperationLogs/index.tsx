import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Select, Input, Space, Typography, App, Tag, Collapse } from 'antd';
import {
  History,
  Filter,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { ragAuditApi, RAGOpLogItem, RAGOpLogStats } from '@/api/ragAuditApi';

const { Title } = Typography;
const { Panel } = Collapse;

const actionConfig: Record<string, { label: string; color: string }> = {
  upload: { label: '文档上传', color: '#3B82F6' },
  delete: { label: '文档删除', color: '#EF4444' },
  re_vectorize: { label: '重新向量化', color: '#F59E0B' },
  search: { label: '检索查询', color: '#8B5CF6' },
  ask: { label: 'RAG问答', color: '#10B981' },
  category_create: { label: '创建分类', color: '#06B6D4' },
  category_update: { label: '更新分类', color: '#0EA5E9' },
  category_delete: { label: '删除分类', color: '#6366F1' },
  chunk_delete: { label: '删除分片', color: '#F97316' },
  export: { label: '导出数据', color: '#84CC16' },
};

const styles = {
  container: {
    padding: '24px',
    background: '#F8FAFC',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1E293B',
    margin: 0,
  },
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    background: '#FFFFFF',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  },
  statLabel: {
    fontSize: '13px',
    color: '#64748B',
    marginBottom: '8px',
    fontWeight: 500,
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#1E293B',
  },
  statValuePrimary: {
    color: '#2563EB',
  },
  statValueSuccess: {
    color: '#059669',
  },
  statValueWarning: {
    color: '#D97706',
  },
  filterCard: {
    background: '#FFFFFF',
    borderRadius: '8px',
    padding: '16px 20px',
    marginBottom: '16px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  },
  tableCard: {
    background: '#FFFFFF',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  },
  chartContainer: {
    background: '#FFFFFF',
    borderRadius: '8px',
    padding: '20px',
    marginTop: '16px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  },
  chartTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1E293B',
    marginBottom: '16px',
  },
  chartBars: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '180px',
    gap: '12px',
    paddingTop: '20px',
  },
  chartBarWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
    height: '100%',
  },
  chartBar: {
    width: '100%',
    maxWidth: '60px',
    background: '#2563EB',
    borderRadius: '6px 6px 0 0',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    position: 'relative' as const,
    minHeight: '4px',
  },
  chartBarLabel: {
    fontSize: '12px',
    color: '#64748B',
    textAlign: 'center' as const,
  },
  chartBarValue: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#2563EB',
  },
  jsonViewer: {
    background: '#F1F5F9',
    borderRadius: '6px',
    padding: '12px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#334155',
    overflow: 'auto',
    maxHeight: '200px',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
  },
  iconBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
};

const RAGOperationLogs: React.FC = () => {
  const { message } = App.useApp();
  const [logs, setLogs] = useState<RAGOpLogItem[]>([]);
  const [stats, setStats] = useState<RAGOpLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [targetTypeFilter, setTargetTypeFilter] = useState<string | undefined>(undefined);
  const [keyword, setKeyword] = useState('');
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res: any = await ragAuditApi.getStatistics();
      const data = res?.data || res;
      setStats(data);
    } catch {
      message.error('获取统计数据失败');
    } finally {
      setStatsLoading(false);
    }
  }, [message]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page: current,
        page_size: pageSize,
      };
      if (actionFilter && actionFilter !== 'all') params.action = actionFilter;
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (targetTypeFilter && targetTypeFilter !== 'all') params.target_type = targetTypeFilter;
      if (keyword) params.search = keyword;

      const res: any = await ragAuditApi.getLogs(params);
      const data = res?.data || res;
      const arr = Array.isArray(data) ? data : (data?.results || []);
      setLogs(arr);
      setTotal(res?.count || data?.count || arr.length);
    } catch {
      message.error('获取审计日志失败');
    } finally {
      setLoading(false);
    }
  }, [current, pageSize, actionFilter, statusFilter, targetTypeFilter, keyword, message]);

  useEffect(() => {
    fetchStats();
    fetchLogs();
  }, [fetchStats, fetchLogs]);

  const handleSearch = () => {
    setCurrent(1);
    fetchLogs();
  };

  const handleReset = () => {
    setActionFilter(undefined);
    setStatusFilter(undefined);
    setTargetTypeFilter(undefined);
    setKeyword('');
    setCurrent(1);
  };

  const maxChartCount = stats?.recent_7_days
    ? Math.max(...stats.recent_7_days.map(d => d.count), 1)
    : 1;

  const avgDuration = logs.length > 0
    ? Math.round(logs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / logs.length)
    : 0;

  const successRate = stats && stats.total > 0
    ? ((stats.success / stats.total) * 100).toFixed(1)
    : '0.0';

  const columns = [
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (t: string) => (t ? new Date(t).toLocaleString('zh-CN') : '--'),
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 110,
      render: (action: string) => {
        const config = actionConfig[action];
        return config ? (
          <Tag color={config.color} style={{ fontWeight: 500, borderRadius: '4px' }}>
            {config.label}
          </Tag>
        ) : <Tag>{action}</Tag>;
      },
    },
    {
      title: '目标名称',
      dataIndex: 'target_name',
      key: 'target_name',
      width: '18%',
      ellipsis: true,
      render: (name: string) => name || '--',
    },
    {
      title: '操作用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (user: string) => user || '--',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      align: 'center' as const,
      render: (status: string) => {
        if (status === 'success') {
          return (
            <Tag icon={<CheckCircle size={12} />} color="#389e0d" style={{ fontWeight: 500 }}>
              成功
            </Tag>
          );
        }
        return (
          <Tag icon={<XCircle size={12} />} color="#cf1322" style={{ fontWeight: 500 }}>
            失败
          </Tag>
        );
      },
    },
    {
      title: '耗时',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      width: 80,
      align: 'center' as const,
      render: (ms: number) => {
        const color = ms > 1000 ? '#cf1322' : ms > 500 ? '#FA8C16' : '#389e0d';
        return (
          <span style={{ color, fontWeight: 500 }}>
            {ms}ms
          </span>
        );
      },
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 140,
      render: (ip: string) => ip || '--',
    },
  ];

  const expandedRowRender = (record: RAGOpLogItem) => {
    const hasRequestDetail = record.request_detail && Object.keys(record.request_detail).length > 0;
    const hasError = record.error_message;

    return (
      <div style={{ padding: '12px 0' }}>
        {hasRequestDetail && (
          <div style={{ marginBottom: hasError ? '12px' : 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              请求详情
            </div>
            <pre style={styles.jsonViewer}>
              {JSON.stringify(record.request_detail, null, 2)}
            </pre>
          </div>
        )}
        {hasError && (
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#DC2626', marginBottom: '6px' }}>
              错误信息
            </div>
            <pre style={{ ...styles.jsonViewer, background: '#FEF2F2', color: '#991B1B' }}>
              {record.error_message}
            </pre>
          </div>
        )}
        {!hasRequestDetail && !hasError && (
          <span style={{ color: '#94A3B8', fontSize: '13px' }}>暂无详细信息</span>
        )}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <History size={24} color="#2563EB" />
        <Title level={4} style={styles.title}>RAG 操作审计</Title>
      </div>

      {/* 统计卡片 */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>今日操作数</div>
          <div style={{ ...styles.statValue, ...styles.statValuePrimary }}>
            {statsLoading ? '-' : stats?.today || 0}
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>总操作数</div>
          <div style={styles.statValue}>
            {statsLoading ? '-' : stats?.total || 0}
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>成功率</div>
          <div style={{ ...styles.statValue, ...styles.statValueSuccess }}>
            {statsLoading ? '-' : `${successRate}%`}
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>平均耗时</div>
          <div style={{ ...styles.statValue, ...styles.statValueWarning }}>
            {loading ? '-' : `${avgDuration}ms`}
          </div>
        </div>
      </div>

      {/* 筛选区 */}
      <div style={styles.filterCard}>
        <Space wrap size="middle">
          <Select
            placeholder="操作类型"
            value={actionFilter}
            onChange={setActionFilter}
            allowClear
            style={{ width: 150 }}
            options={[
              { value: 'all', label: '全部类型' },
              ...Object.entries(actionConfig).map(([key, val]) => ({ value: key, label: val.label })),
            ]}
          />
          <Select
            placeholder="状态"
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
            style={{ width: 120 }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'success', label: '成功' },
              { value: 'failed', label: '失败' },
              { value: 'partial', label: '部分成功' },
            ]}
          />
          <Select
            placeholder="目标类型"
            value={targetTypeFilter}
            onChange={setTargetTypeFilter}
            allowClear
            style={{ width: 130 }}
            options={[
              { value: 'all', label: '全部目标' },
              { value: 'document', label: '文档' },
              { value: 'category', label: '分类' },
              { value: 'chunk', label: '分片' },
              { value: 'search', label: '检索' },
              { value: 'ask', label: '问答' },
            ]}
          />
          <Input
            placeholder="搜索目标名称/用户名"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
            style={{ width: 200 }}
            prefix={<Search size={16} color="#94A3B8" />}
          />
          <Button
            type="primary"
            icon={<Search size={16} />}
            onClick={handleSearch}
            style={{
              background: '#2563EB',
              borderColor: '#2563EB',
              borderRadius: '6px',
            }}
          >
            搜索
          </Button>
          <Button
            icon={<Filter size={16} />}
            onClick={handleReset}
            style={{ borderRadius: '6px' }}
          >
            重置
          </Button>
        </Space>
      </div>

      {/* 日志表格 */}
      <div style={styles.tableCard}>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1100 }}
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
          expandable={{
            expandedRowRender,
            expandedRowKeys,
            onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as React.Key[]),
            expandRowByClick: true,
          }}
          size="middle"
        />
      </div>

      {/* 近7日趋势图 */}
      {stats?.recent_7_days && stats.recent_7_days.length > 0 && (
        <div style={styles.chartContainer}>
          <div style={styles.chartTitle}>
            <Clock size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            近 7 日操作趋势
          </div>
          <div style={styles.chartBars}>
            {stats.recent_7_days.map((day, index) => {
              const heightPercent = (day.count / maxChartCount) * 100;
              return (
                <div key={index} style={styles.chartBarWrapper}>
                  <div style={styles.chartBarValue}>{day.count}</div>
                  <div
                    style={{
                      ...styles.chartBar,
                      height: `${Math.max(heightPercent, 2)}%`,
                      opacity: 0.8 + (index / stats!.recent_7_days.length) * 0.2,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'scaleY(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = String(0.8 + (index / stats!.recent_7_days.length) * 0.2);
                      e.currentTarget.style.transform = 'scaleY(1)';
                    }}
                  />
                  <div style={styles.chartBarLabel}>
                    {day.date.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RAGOperationLogs;

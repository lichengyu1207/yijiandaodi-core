import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Select, DatePicker, Input, Divider,
  Modal, message, Popconfirm, Tooltip, Row, Col, Statistic, Typography,
  Empty, Collapse, Descriptions
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, DeleteOutlined, EyeOutlined,
  WarningOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, FileProtectOutlined, FilterOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { riskControlApi, type AuditLogItem } from '@/api/riskControlApi';

const { Text, Title } = Typography;
const { Panel } = Collapse;
const { RangePicker } = DatePicker;

const RESULT_MAP: Record<string, { color: string; text: string; icon: any }> = {
  passed: { color: '#52C41A', text: '通过', icon: <CheckCircleOutlined /> },
  blocked: { color: '#FF4D4F', text: '已拦截', icon: <CloseCircleOutlined /> },
  warning: { color: '#FAAD14', text: '警告', icon: <WarningOutlined /> },
  pending: { color: '#722ED1', text: '待审核', icon: <ClockCircleOutlined /> },
};

const RISK_COLOR: Record<string, string> = {
  low: '#52C41A',
  medium: '#FAAD14',
  high: '#FF4D4F',
  critical: '#CF1322',
};

export default function RiskControlAudit() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [filters, setFilters] = useState({
    result: '',
    risk_level: '',
    source: '',
    date_from: '',
    date_to: '',
  });
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [currentLog, setCurrentLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.result) params.result = filters.result;
      if (filters.risk_level) params.risk_level = filters.risk_level;
      if (filters.source) params.source = filters.source;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      const res = await riskControlApi.getAuditLogs(params);
      const payload = res?.data || res;
      const listData = payload?.results || payload?.data || payload || [];
      setLogs(Array.isArray(listData) ? listData : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await riskControlApi.getAuditStatistics();
      setStats(res?.data?.data || null);
    } catch {}
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [fetchLogs, fetchStats]);

  const handleDelete = async (id: number) => {
    try {
      await riskControlApi.deleteAuditLog(id);
      message.success('删除成功');
      fetchLogs();
      fetchStats();
    } catch {
      message.error('删除失败');
    }
  };

  const openDetail = (record: AuditLogItem) => {
    setCurrentLog(record);
    setDetailModalOpen(true);
  };

  const columns: ColumnsType<AuditLogItem> = [
    {
      title: '检测结果',
      dataIndex: 'result',
      key: 'result',
      width: 100,
      render: (result: string) => {
        const r = RESULT_MAP[result];
        return r ? (
          <Tag color={r.color} icon={r.icon} style={{ borderRadius: 4 }}>{r.text}</Tag>
        ) : result;
      },
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 90,
      render: (level: string) => (
        <Tag color={RISK_COLOR[level] || '#999'} style={{ borderRadius: 4 }}>
          {{ low: '低', medium: '中', high: '高', critical: '严重' }[level] || level}
        </Tag>
      ),
    },
    {
      title: '内容预览',
      dataIndex: 'content',
      key: 'content',
      width: 280,
      ellipsis: true,
      render: (text: string) => (
        <Text style={{ fontSize: 13 }}>
          {text.length > 60 ? text.slice(0, 60) + '...' : text}
        </Text>
      ),
    },
    {
      title: '命中规则数',
      dataIndex: 'total_matches',
      key: 'total_matches',
      width: 100,
      sorter: (a, b) => a.total_matches - b.total_matches,
      render: (count: number) => (
        <Text style={{ color: count > 0 ? '#FF4D4F' : '#999', fontWeight: count > 0 ? 600 : 400 }}>
          {count} 条
        </Text>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 80,
    },
    {
      title: '用户',
      dataIndex: 'username_display',
      key: 'username_display',
      width: 100,
      ellipsis: true,
    },
    {
      title: '处理耗时',
      dataIndex: 'processing_time_ms',
      key: 'processing_time_ms',
      width: 100,
      render: (ms: number) => (
        <Text style={{ color: ms > 500 ? '#FF4D4F' : '#52C41A' }}>{ms}ms</Text>
      ),
    },
    {
      title: '检测时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      defaultSortOrder: 'descend' as const,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (time: string) => (
        <Text style={{ fontSize: 12, color: '#666' }}>{dayjs(time).format('YYYY-MM-DD HH:mm:ss')}</Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      render: (_: any, record: AuditLogItem) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
          </Tooltip>
          <Popconfirm title="确定删除此日志？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#F8FAFC', minHeight: '100vh' }}>
      <Title level={4} style={{ marginBottom: 20, color: '#1E293B' }}>
        <FileProtectOutlined style={{ marginRight: 8 }} /> 内容审核日志
      </Title>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderLeft: '3px solid #1890FF' }}>
              <Statistic title="总检测次数" value={stats.total} valueStyle={{ fontSize: 22 }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderLeft: '3px solid #52C41A' }}>
              <Statistic title="今日检测" value={stats.today_total} valueStyle={{ fontSize: 22, color: '#52C41A' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderLeft: '3px solid #FF4D4F' }}>
              <Statistic title="拦截次数" value={stats.by_result?.blocked || 0} valueStyle={{ fontSize: 22, color: '#FF4D4F' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderLeft: '3px solid #FAAD14' }}>
              <Statistic title="警告次数" value={stats.by_result?.warning || 0} valueStyle={{ fontSize: 22, color: '#FAAD14' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderLeft: '3px solid #722ED1' }}>
              <Statistic title="本周检测" value={stats.week_total} valueStyle={{ fontSize: 22, color: '#722ED1' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 6, borderLeft: '3px solid #06B6D4' }}>
              <Statistic title="通过率"
                value={stats.total > 0 ? ((stats.by_result?.passed || 0) / stats.total * 100).toFixed(1) : 0}
                suffix="%"
                valueStyle={{ fontSize: 22, color: '#06B6D4' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card size="small" style={{ borderRadius: 6, marginBottom: 16 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Space wrap size="middle">
          <Select
            placeholder="检测结果"
            allowClear
            style={{ width: 120, borderRadius: 6 }}
            value={filters.result || undefined}
            onChange={(v) => setFilters(f => ({ ...f, result: v || '' }))}
            options={[
              { label: '通过', value: 'passed' },
              { label: '已拦截', value: 'blocked' },
              { label: '警告', value: 'warning' },
              { label: '待审核', value: 'pending' },
            ]}
          />
          <Select
            placeholder="风险等级"
            allowClear
            style={{ width: 110, borderRadius: 6 }}
            value={filters.risk_level || undefined}
            onChange={(v) => setFilters(f => ({ ...f, risk_level: v || '' }))}
            options={[
              { label: '低', value: 'low' },
              { label: '中', value: 'medium' },
              { label: '高', value: 'high' },
              { label: '严重', value: 'critical' },
            ]}
          />
          <Select
            placeholder="来源"
            allowClear
            style={{ width: 110, borderRadius: 6 }}
            value={filters.source || undefined}
            onChange={(v) => setFilters(f => ({ ...f, source: v || '' }))}
            options={[
              { label: 'Web', value: 'web' },
              { label: 'API', value: 'api' },
              { label: '移动端', value: 'mobile' },
              { label: '批量', value: 'batch' },
            ]}
          />
          <RangePicker
            size="middle"
            style={{ borderRadius: 6 }}
            onChange={(dates) => {
              setFilters(f => ({
                ...f,
                date_from: dates?.[0]?.format('YYYY-MM-DD') || '',
                date_to: dates?.[1]?.format('YYYY-MM-DD') || '',
              }));
            }}
          />
          <Divider type="vertical" />
          <Input
            placeholder="搜索内容..."
            prefix={<SearchOutlined style={{ color: '#999' }} />}
            onPressEnter={() => fetchLogs()}
            allowClear
            style={{ width: 200, borderRadius: 6 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => { fetchLogs(); fetchStats(); }} style={{ borderRadius: 6 }}>刷新</Button>
        </Space>
      </Card>

      <Card size="small" style={{ borderRadius: 6 }}>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条日志`,
            showQuickJumper: true,
            size: 'small',
          }}
          scroll={{ x: 1200 }}
          size="small"
          locale={{ emptyText: <Empty description="暂无审核日志" /> }}
        />
      </Card>

      <Modal
        title={
          <Space><EyeOutlined /><span>审核详情</span></Space>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        destroyOnHidden
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)} style={{ borderRadius: 6 }}>关闭</Button>,
        ]}
        width={700}
      >
        {currentLog && (
          <div>
            <Descriptions column={2} size="small" bordered style={{ borderRadius: 6, marginBottom: 16 }}>
              <Descriptions.Item label="检测结果">
                <Tag color={RESULT_MAP[currentLog.result]?.color}>{RESULT_MAP[currentLog.result]?.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="风险等级">
                <Tag color={RISK_COLOR[currentLog.risk_level]}>{{ low: '低', medium: '中', high: '高', critical: '严重' }[currentLog.risk_level]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="总命中数">{currentLog.total_matches}</Descriptions.Item>
              <Descriptions.Item label="处理耗时">{currentLog.processing_time_ms}ms</Descriptions.Item>
              <Descriptions.Item label="来源">{currentLog.source}</Descriptions.Item>
              <Descriptions.Item label="用户">{currentLog.username_display}</Descriptions.Item>
              <Descriptions.Item label="IP地址" span={2}>{currentLog.ip_address || '-'}</Descriptions.Item>
              <Descriptions.Item label="检测时间" span={2}>{dayjs(currentLog.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            </Descriptions>

            <Title level={5}>原始内容</Title>
            <div style={{
              padding: 12, background: '#F8FAFC', borderRadius: 6,
              border: '1px solid #E2E8F0', maxHeight: 200, overflowY: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 13,
            }}>
              {currentLog.content}
            </div>

            {currentLog.matched_rules && currentLog.matched_rules.length > 0 && (
              <>
                <Title level={5} style={{ marginTop: 16 }}>命中规则详情</Title>
                <Collapse defaultActiveKey={['0']} size="small">
                  {currentLog.matched_rules.map((rule: any, idx: number) => (
                    <Panel
                      header={
                        <Space>
                          <Tag color="#FF4D4F">{rule.category_display || rule.category}</Tag>
                          <Text strong>{rule.rule_name}</Text>
                          <Tag color="blue">命中{rule.match_count}次</Tag>
                        </Space>
                      }
                      key={String(idx)}
                    >
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label="正则表达式">
                          <code style={{
                            background: '#F1F5F9', padding: '2px 8px', borderRadius: 4,
                            fontFamily: 'monospace', fontSize: 12,
                          }}>
                            {rule.pattern}
                          </code>
                        </Descriptions.Item>
                        <Descriptions.Item label="处置动作">
                          <Tag>{ACTION_DISPLAY[rule.action] || rule.action}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="匹配内容">
                          <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                            {(rule.matches || []).map((m: string, i: number) => (
                              <div key={i} style={{
                                padding: '3px 8px', margin: '2px 0',
                                background: '#FEF2F2', borderRadius: 4,
                                fontSize: 12, fontFamily: 'monospace',
                              }}>
                                {String(m)}
                              </div>
                            ))}
                          </div>
                        </Descriptions.Item>
                      </Descriptions>
                    </Panel>
                  ))}
                </Collapse>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

const ACTION_DISPLAY: Record<string, string> = {
  warn: '警告',
  block: '拦截',
  replace: '替换',
  review: '人工审核',
};

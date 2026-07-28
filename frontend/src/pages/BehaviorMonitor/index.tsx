/**
 * Agent行为监控仪表盘
 * 
 * 功能：
 * - API调用行为监控
 * - 数据访问行为监控
 * - 权限使用行为监控
 * - Tool调用序列行为监控
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Card, Typography, Row, Col, Statistic, Table, Tag, Button, Space,
  Progress, Timeline, Alert, Badge, Tooltip, Tabs, Empty, Spin
} from 'antd';
import {
  Activity, AlertTriangle, Shield, Clock, TrendingUp, Eye,
  CheckCircle, Lock, Zap, Settings, RefreshCw, Download,
  BarChart2, PieChart, LineChart
} from 'lucide-react';
import { behaviorApi } from '@/api/behaviorApi';
import type { BehaviorLog, AnomalyDetection, BehaviorBaseline } from '@/api/behaviorApi';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

// 颜色配置
const COLORS = {
  safe: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
  critical: '#7F1D1D',
  low: '#86909C',
  medium: '#F59E0B',
  high: '#DC2626',
  primary: '#2563EB',
  purple: '#722ED1',
};

// Agent图标映射
const AGENT_ICONS = {
  auditor: <Eye size={20} style={{ color: COLORS.danger }} />,
  verifier: <CheckCircle size={20} style={{ color: COLORS.primary }} />,
  archiver: <Lock size={20} style={{ color: COLORS.safe }} />,
  judge: <Shield size={20} style={{ color: COLORS.warning }} />,
};

const BehaviorMonitorDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [behaviors, setBehaviors] = useState<BehaviorLog[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyDetection[]>([]);
  const [baselines, setBaselines] = useState<BehaviorBaseline[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // 加载总览数据
  useEffect(() => {
    loadOverview();
    loadBehaviors();
    loadAnomalies();
    loadBaselines();
  }, []);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const res = await behaviorApi.getOverview();
      if (res.success) {
        setOverview(res.data);
      }
    } catch (error) {
      console.error('加载总览数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBehaviors = async () => {
    try {
      const res = await behaviorApi.getBehaviorList({ page: 1, page_size: 20 });
      if (res.success) {
        setBehaviors(res.data.behaviors);
      }
    } catch (error) {
      console.error('加载行为日志失败:', error);
    }
  };

  const loadAnomalies = async () => {
    try {
      const res = await behaviorApi.getAnomalyList({ page: 1, page_size: 20 });
      if (res.success) {
        setAnomalies(res.data.anomalies);
      }
    } catch (error) {
      console.error('加载异常检测失败:', error);
    }
  };

  const loadBaselines = async () => {
    try {
      const res = await behaviorApi.getBaselineList({ is_active: true });
      if (res.success) {
        setBaselines(res.data.baselines);
      }
    } catch (error) {
      console.error('加载基线模型失败:', error);
    }
  };

  const loadStatistics = async (timeRange: string = 'day') => {
    try {
      const res = await behaviorApi.getStatistics({ time_range: timeRange });
      if (res.success) {
        setStatistics(res.data);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  };

  const handleBuildBaseline = async () => {
    try {
      const res = await behaviorApi.buildAllBaselines();
      if (res.success) {
        // 刷新基线列表
        loadBaselines();
      }
    } catch (error) {
      console.error('建立基线模型失败:', error);
    }
  };

  // 行为日志表格列定义
  const behaviorColumns = [
    {
      title: 'Agent',
      dataIndex: 'agent_code',
      key: 'agent_code',
      render: (code: string, record: BehaviorLog) => (
        <Space>
          {AGENT_ICONS[code as keyof typeof AGENT_ICONS]}
          <Text strong>{record.agent_name}</Text>
        </Space>
      ),
    },
    {
      title: '行为类型',
      dataIndex: 'behavior_type',
      key: 'behavior_type',
      render: (type: string) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          api_call: { color: COLORS.primary, text: 'API调用' },
          data_access: { color: COLORS.safe, text: '数据访问' },
          permission_use: { color: COLORS.warning, text: '权限使用' },
          tool_call: { color: COLORS.purple, text: 'Tool调用' },
          session_create: { color: COLORS.primary, text: '会话创建' },
          session_complete: { color: COLORS.safe, text: '会话完成' },
        };
        const config = typeMap[type] || { color: COLORS.low, text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      render: (level: string) => {
        const levelColors: Record<string, string> = {
          low: COLORS.safe,
          medium: COLORS.warning,
          high: COLORS.danger,
          critical: COLORS.critical,
        };
        return (
          <Tag color={levelColors[level]}>
            {level === 'low' ? '低风险' : level === 'medium' ? '中风险' : level === 'high' ? '高风险' : '严重'}
          </Tag>
        );
      },
    },
    {
      title: '风险评分',
      dataIndex: 'risk_score',
      key: 'risk_score',
      render: (score: number) => (
        <Progress
          percent={score}
          size="small"
          strokeColor={score > 70 ? COLORS.danger : score > 30 ? COLORS.warning : COLORS.safe}
          format={(percent) => `${percent}`}
        />
      ),
    },
    {
      title: '异常分数',
      dataIndex: 'anomaly_score',
      key: 'anomaly_score',
      render: (score: number) => (
        <Text style={{ color: score > 0.7 ? COLORS.danger : score > 0.3 ? COLORS.warning : COLORS.safe }}>
          {score.toFixed(2)}
        </Text>
      ),
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '异常',
      dataIndex: 'is_anomaly',
      key: 'is_anomaly',
      render: (isAnomaly: boolean) => (
        <Badge status={isAnomaly ? 'error' : 'success'} text={isAnomaly ? '异常' : '正常'} />
      ),
    },
  ];

  // 异常检测表格列定义
  const anomalyColumns = [
    {
      title: '异常类型',
      dataIndex: 'anomaly_type',
      key: 'anomaly_type',
      render: (type: string) => <Tag color={COLORS.danger}>{type}</Tag>,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: string) => {
        const colors: Record<string, string> = {
          low: COLORS.low,
          medium: COLORS.warning,
          high: COLORS.danger,
          critical: COLORS.critical,
        };
        return <Tag color={colors[severity]}>{severity.toUpperCase()}</Tag>;
      },
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      render: (confidence: number) => `${confidence.toFixed(2)}`,
    },
    {
      title: 'Agent',
      dataIndex: 'agent_name',
      key: 'agent_name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusColors: Record<string, string> = {
          detected: COLORS.danger,
          investigating: COLORS.warning,
          resolved: COLORS.safe,
          false_positive: COLORS.low,
        };
        const statusText: Record<string, string> = {
          detected: '已检测',
          investigating: '调查中',
          resolved: '已解决',
          false_positive: '误报',
        };
        return <Tag color={statusColors[status]}>{statusText[status]}</Tag>;
      },
    },
    {
      title: '检测时间',
      dataIndex: 'detected_at',
      key: 'detected_at',
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div style={{ padding: '24px 40px', minHeight: '100vh', background: '#F7F8FA' }}>
      {/* 页面标题 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            <Activity size={28} style={{ marginRight: 12, color: COLORS.primary }} />
            Agent行为基线建模引擎
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            API调用、数据访问、权限使用、Tool调用序列全面监控
          </Text>
        </div>
      </motion.div>

      {/* 核心指标卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="今日行为总数"
                value={overview?.today?.total_count || 0}
                prefix={<Activity size={20} style={{ color: COLORS.primary }} />}
                valueStyle={{ color: COLORS.primary }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="异常行为数量"
                value={overview?.today?.anomaly_count || 0}
                prefix={<AlertTriangle size={20} style={{ color: COLORS.danger }} />}
                valueStyle={{ color: COLORS.danger }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="高风险行为"
                value={overview?.today?.high_risk_count || 0}
                prefix={<Shield size={20} style={{ color: COLORS.warning }} />}
                valueStyle={{ color: COLORS.warning }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="异常率"
                value={(overview?.today?.anomaly_rate * 100 || 0).toFixed(1)}
                suffix="%"
                prefix={<TrendingUp size={20} />}
                valueStyle={{ color: overview?.today?.anomaly_rate > 0.1 ? COLORS.danger : COLORS.safe }}
              />
            </Card>
          </Col>
        </Row>
      </motion.div>

      {/* 操作按钮 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        style={{ marginBottom: 24 }}
      >
        <Space>
          <Button type="primary" icon={<RefreshCw size={16} />} onClick={loadOverview}>
            刷新数据
          </Button>
          <Button icon={<Settings size={16} />} onClick={handleBuildBaseline}>
            建立基线模型
          </Button>
          <Button icon={<Download size={16} />}>
            导出报告
          </Button>
        </Space>
      </motion.div>

      {/* 主要内容区域 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* 总览 */}
          <TabPane
            tab={
              <span>
                <BarChart2 size={16} style={{ marginRight: 8 }} />
                监控总览
              </span>
            }
            key="overview"
          >
            <Row gutter={[16, 16]}>
              {/* Agent分布 */}
              <Col xs={24} md={12}>
                <Card title="Agent行为分布" style={{ height: 300 }}>
                  {overview?.agent_distribution?.length > 0 ? (
                    <div style={{ paddingTop: 20 }}>
                      {overview.agent_distribution.map((item: any) => (
                        <div key={item.agent_code} style={{ marginBottom: 12 }}>
                          <Space>
                            {AGENT_ICONS[item.agent_code as keyof typeof AGENT_ICONS]}
                            <Text strong>{item.agent_code}</Text>
                          </Space>
                          <Progress
                            percent={(item.count / overview.today.total_count) * 100}
                            strokeColor={COLORS.primary}
                            format={(percent) => `${item.count}`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description="暂无数据" />
                  )}
                </Card>
              </Col>

              {/* 行为类型分布 */}
              <Col xs={24} md={12}>
                <Card title="行为类型分布" style={{ height: 300 }}>
                  {overview?.behavior_type_distribution?.length > 0 ? (
                    <div style={{ paddingTop: 20 }}>
                      {overview.behavior_type_distribution.map((item: any) => (
                        <div key={item.behavior_type} style={{ marginBottom: 12 }}>
                          <Text>{item.behavior_type}</Text>
                          <Progress
                            percent={(item.count / overview.today.total_count) * 100}
                            strokeColor={COLORS.purple}
                            format={(percent) => `${item.count}`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description="暂无数据" />
                  )}
                </Card>
              </Col>

              {/* 风险等级分布 */}
              <Col xs={24} md={12}>
                <Card title="风险等级分布" style={{ height: 300 }}>
                  {overview?.risk_distribution?.length > 0 ? (
                    <div style={{ paddingTop: 20 }}>
                      {overview.risk_distribution.map((item: any) => {
                        const colors: Record<string, string> = {
                          low: COLORS.safe,
                          medium: COLORS.warning,
                          high: COLORS.danger,
                          critical: COLORS.critical,
                        };
                        return (
                          <div key={item.risk_level} style={{ marginBottom: 12 }}>
                            <Tag color={colors[item.risk_level]}>
                              {item.risk_level === 'low' ? '低风险' : 
                               item.risk_level === 'medium' ? '中风险' : 
                               item.risk_level === 'high' ? '高风险' : '严重'}
                            </Tag>
                            <Progress
                              percent={(item.count / overview.today.total_count) * 100}
                              strokeColor={colors[item.risk_level]}
                              format={(percent) => `${item.count}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Empty description="暂无数据" />
                  )}
                </Card>
              </Col>

              {/* 基线模型状态 */}
              <Col xs={24} md={12}>
                <Card title="基线模型覆盖情况" style={{ height: 300 }}>
                  {baselines.length > 0 ? (
                    <div style={{ paddingTop: 20 }}>
                      {baselines.slice(0, 5).map((baseline) => (
                        <div key={baseline.id} style={{ marginBottom: 12 }}>
                          <Space>
                            <Tag color={COLORS.primary}>{baseline.agent_code}</Tag>
                            <Tag color={COLORS.purple}>{baseline.baseline_type}</Tag>
                            <Text type="secondary">样本数: {baseline.sample_count}</Text>
                          </Space>
                          <Progress
                            percent={baseline.accuracy * 100}
                            strokeColor={COLORS.safe}
                            format={(percent) => `准确率 ${percent}%`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description="暂无基线模型" />
                  )}
                </Card>
              </Col>
            </Row>
          </TabPane>

          {/* 行为日志 */}
          <TabPane
            tab={
              <span>
                <Clock size={16} style={{ marginRight: 8 }} />
                行为日志
              </span>
            }
            key="behaviors"
          >
            <Card>
              <Table
                dataSource={behaviors}
                columns={behaviorColumns}
                rowKey="id"
                loading={loading}
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                }}
              />
            </Card>
          </TabPane>

          {/* 异常检测 */}
          <TabPane
            tab={
              <span>
                <AlertTriangle size={16} style={{ marginRight: 8 }} />
                异常检测
              </span>
            }
            key="anomalies"
          >
            <Card>
              <Table
                dataSource={anomalies}
                columns={anomalyColumns}
                rowKey="id"
                loading={loading}
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                }}
              />
            </Card>
          </TabPane>

          {/* 基线模型 */}
          <TabPane
            tab={
              <span>
                <Settings size={16} style={{ marginRight: 8 }} />
                基线模型
              </span>
            }
            key="baselines"
          >
            <Card>
              <Table
                dataSource={baselines}
                columns={[
                  {
                    title: 'Agent',
                    dataIndex: 'agent_code',
                    key: 'agent_code',
                    render: (code: string) => (
                      <Space>
                        {AGENT_ICONS[code as keyof typeof AGENT_ICONS]}
                        <Text strong>{code}</Text>
                      </Space>
                    ),
                  },
                  {
                    title: '基线类型',
                    dataIndex: 'baseline_type',
                    key: 'baseline_type',
                    render: (type: string) => <Tag color={COLORS.purple}>{type}</Tag>,
                  },
                  {
                    title: '版本',
                    dataIndex: 'version',
                    key: 'version',
                  },
                  {
                    title: '样本数',
                    dataIndex: 'sample_count',
                    key: 'sample_count',
                  },
                  {
                    title: '准确率',
                    dataIndex: 'accuracy',
                    key: 'accuracy',
                    render: (accuracy: number) => (
                      <Progress
                        percent={accuracy * 100}
                        size="small"
                        strokeColor={COLORS.safe}
                        format={(percent) => `${percent}%`}
                      />
                    ),
                  },
                  {
                    title: '状态',
                    dataIndex: 'is_active',
                    key: 'is_active',
                    render: (active: boolean) => (
                      <Badge status={active ? 'success' : 'default'} text={active ? '激活' : '未激活'} />
                    ),
                  },
                  {
                    title: '更新时间',
                    dataIndex: 'updated_at',
                    key: 'updated_at',
                    render: (time: string) => new Date(time).toLocaleString('zh-CN'),
                  },
                ]}
                rowKey="id"
                loading={loading}
              />
            </Card>
          </TabPane>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default BehaviorMonitorDashboard;
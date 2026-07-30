/**
 * 三份报告交付页面
 * 
 * 功能：
 * 1. 创作时间线报告 - 记录创作过程、时间戳证据链
 * 2. 素材风险报告 - 图片AI生成概率、版权风险评估
 * 3. 账号资产报告 - 校验历史、安全积分、行为图谱
 */

import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
  Progress,
  Tag,
  List,
  Empty,
  Spin,
  message,
  Modal,
  DatePicker,
  Divider,
} from 'antd';
import {
  FileTextOutlined,
  FileImageOutlined,
  TrophyOutlined,
  DownloadOutlined,
  ClockCircleOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { RangePickerProps } from 'antd/es/date-picker';
import dayjs from 'dayjs';

import {
  generateReport,
  quickGenerateReport,
  getReportList,
  getReportDetail,
  downloadReport,
  getAccountAsset,
} from '../../api/reportApi';

const { Title, Text, Paragraph } = Typography;

interface Report {
  id: string;
  report_type: string;
  title: string;
  status: string;
  summary: string;
  safety_score: number;
  total_checks: number;
  created_at: string;
  download_url: string;
}

interface AccountAsset {
  safety_points: number;
  trust_score: number;
  total_checks: number;
  text_checks: number;
  image_checks: number;
  marketing_checks: number;
  total_evidences: number;
}

const MyReports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [asset, setAsset] = useState<AccountAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 获取报告列表
      const reportsRes = await getReportList();
      setReports(reportsRes.data || []);

      // 获取账号资产
      const assetRes = await getAccountAsset();
      setAsset(assetRes.data);
    } catch (error) {
      console.error('加载报告数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (reportType: string, startDate?: string, endDate?: string) => {
    setGenerateLoading(true);
    try {
      const res = await generateReport({
        report_type: reportType as any,
        start_date: startDate,
        end_date: endDate,
      });

      message.success('报告生成成功！');
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '报告生成失败');
    } finally {
      setGenerateLoading(false);
      setDateModalVisible(false);
    }
  };

  const handleQuickGenerate = async () => {
    setGenerateLoading(true);
    try {
      const res = await quickGenerateReport();
      message.success('综合报告生成成功！');
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '报告生成失败');
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleDownload = (reportId: string) => {
    const url = downloadReport(reportId);
    window.open(url, '_blank');
  };

  const showDateModal = (reportType: string) => {
    setSelectedReportType(reportType);
    setDateModalVisible(true);
  };

  const handleDateConfirm = (dates: any) => {
    if (dates) {
      const startDate = dates[0].toISOString();
      const endDate = dates[1].toISOString();
      handleGenerateReport(selectedReportType, startDate, endDate);
    }
  };

  const getReportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      timeline: '创作时间线报告',
      material_risk: '素材风险报告',
      account_asset: '账号资产报告',
      full: '综合报告',
    };
    return labels[type] || type;
  };

  const getReportTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      timeline: '#165DFF',
      material_risk: '#FF7D00',
      account_asset: '#722ED1',
      full: '#00B42A',
    };
    return colors[type] || '#999';
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      pending: { color: 'processing', text: '生成中' },
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '生成失败' },
    };
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <FileTextOutlined style={{ marginRight: 8 }} />
        三份报告交付
      </Title>
      <Paragraph>
        作品信息采集 → 三份报告交付（创作时间线/素材风险/账号资产）
      </Paragraph>

      <Divider />

      {/* 账号资产卡片 */}
      <Card style={{ marginBottom: 24 }}>
        <Title level={4}>
          <TrophyOutlined style={{ marginRight: 8, color: '#722ED1' }} />
          账号资产
        </Title>
        <Row gutter={24}>
          <Col span={6}>
            <Statistic
              title="安全积分"
              value={asset?.safety_points || 0}
              suffix="分"
              valueStyle={{ color: '#722ED1' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="信任评分"
              value={asset?.trust_score || 0}
              suffix="/ 100"
              valueStyle={{ color: '#165DFF' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="检测总数"
              value={asset?.total_checks || 0}
              valueStyle={{ color: '#00B42A' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="存证数量"
              value={asset?.total_evidences || 0}
              valueStyle={{ color: '#FF7D00' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 快速生成按钮 */}
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="large">
          <Title level={4}>
            <SafetyOutlined style={{ marginRight: 8, color: '#00B42A' }} />
            一键生成综合报告
          </Title>
          <Button
            type="primary"
            size="large"
            icon={<FileTextOutlined />}
            loading={generateLoading}
            onClick={handleQuickGenerate}
          >
            生成三合一报告（最近30天）
          </Button>
        </Space>
      </Card>

      {/* 分类型生成 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card
            hoverable
            style={{ borderColor: '#165DFF' }}
            onClick={() => showDateModal('timeline')}
          >
            <Space direction="vertical" align="center" style={{ width: '100%' }}>
              <ClockCircleOutlined style={{ fontSize: 48, color: '#165DFF' }} />
              <Title level={4}>创作时间线报告</Title>
              <Text type="secondary">记录创作过程、时间戳证据链</Text>
              <Button type="primary" ghost>
                生成报告
              </Button>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            hoverable
            style={{ borderColor: '#FF7D00' }}
            onClick={() => showDateModal('material_risk')}
          >
            <Space direction="vertical" align="center" style={{ width: '100%' }}>
              <FileImageOutlined style={{ fontSize: 48, color: '#FF7D00' }} />
              <Title level={4}>素材风险报告</Title>
              <Text type="secondary">AI生成检测、版权风险评估</Text>
              <Button type="primary" ghost style={{ borderColor: '#FF7D00', color: '#FF7D00' }}>
                生成报告
              </Button>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            hoverable
            style={{ borderColor: '#722ED1' }}
            onClick={() => handleGenerateReport('account_asset')}
          >
            <Space direction="vertical" align="center" style={{ width: '100%' }}>
              <TrophyOutlined style={{ fontSize: 48, color: '#722ED1' }} />
              <Title level={4}>账号资产报告</Title>
              <Text type="secondary">校验历史、安全积分统计</Text>
              <Button type="primary" ghost style={{ borderColor: '#722ED1', color: '#722ED1' }}>
                生成报告
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 报告列表 */}
      <Card>
        <Title level={4}>历史报告</Title>
        <Spin spinning={loading}>
          {reports.length === 0 ? (
            <Empty description="暂无报告，请先生成" />
          ) : (
            <List
              dataSource={reports}
              renderItem={(report) => (
                <List.Item
                  actions={[
                    report.status === 'completed' && (
                      <Button
                        type="link"
                        icon={<DownloadOutlined />}
                        onClick={() => handleDownload(report.id)}
                      >
                        下载
                      </Button>
                    ),
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <FileTextOutlined
                        style={{
                          fontSize: 24,
                          color: getReportTypeColor(report.report_type),
                        }}
                      />
                    }
                    title={
                      <Space>
                        <Text>{report.title}</Text>
                        <Tag color={getReportTypeColor(report.report_type)}>
                          {getReportTypeLabel(report.report_type)}
                        </Tag>
                        {getStatusTag(report.status)}
                      </Space>
                    }
                    description={
                      <Space split={<Divider type="vertical" />}>
                        <Text type="secondary">
                          检测数: {report.total_checks}
                        </Text>
                        <Text type="secondary">
                          安全评分: {report.safety_score?.toFixed(1) || 0}
                        </Text>
                        <Text type="secondary">
                          {dayjs(report.created_at).format('YYYY-MM-DD HH:mm')}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Spin>
      </Card>

      {/* 时间范围选择Modal */}
      <Modal
        title="选择时间范围"
        open={dateModalVisible}
        onCancel={() => setDateModalVisible(false)}
        footer={null}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Text>请选择报告统计的时间范围：</Text>
          <DatePicker.RangePicker
            style={{ width: '100%' }}
            showTime
            onChange={(dates) => {
              if (dates) {
                handleDateConfirm(dates);
              }
            }}
            disabledDate={(current) => current && current > dayjs().endOf('day')}
          />
          <Text type="secondary">
            报告类型: {getReportTypeLabel(selectedReportType)}
          </Text>
        </Space>
      </Modal>
    </div>
  );
};

export default MyReports;
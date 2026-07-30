import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Select, Button, Tag, Typography, Spin, App } from 'antd';
import { FileTextOutlined, UserOutlined, CloudServerOutlined, ExportOutlined } from '@ant-design/icons';
import { dataApi, DataOverview, ExportRecord } from '@/api/data';
import './DataManage.css';

const { Title } = Typography;

const DataManage: React.FC = () => {
  const { message } = App.useApp();
  const [overview, setOverview] = useState<DataOverview | null>(null);
  const [history, setHistory] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([dataApi.getOverview(), dataApi.getExportHistory()])
      .then(([ov, hi]) => {
        setOverview((ov as any).data || ov);
        setHistory(Array.isArray(hi) ? hi : ((hi as any)?.results || []));
      })
      .catch(() => message.error('加载数据失败'))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async (type: string) => {
    setExporting(true);
    try {
      await dataApi.exportData(type);
      message.success('导出成功');
      const hi = await dataApi.getExportHistory();
      setHistory(Array.isArray(hi) ? hi : ((hi as any)?.results || []));
      if (overview) {
        setOverview({ ...overview });
      }
    } catch {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    { title: '文件名', dataIndex: 'file_name', key: 'file_name' },
    {
      title: '类型',
      dataIndex: 'export_type',
      key: 'export_type',
      render: (t: string) => {
        const map: Record<string, string> = { articles: '文章数据', users: '用户数据', login_logs: '登录日志' };
        return <Tag>{map[t] || t}</Tag>;
      },
    },
    { title: '记录数', dataIndex: 'record_count', key: 'record_count' },
    { title: '导出人', dataIndex: 'created_by_name', key: 'created_by_name' },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '--' },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div className="data-manage-page">
      <Title level={4} style={{ marginBottom: 24 }}>数据管理</Title>

      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card className="stat-card-mini">
            <Statistic title="文章总数" value={overview?.article_count || 0} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card className="stat-card-mini">
            <Statistic title="已发布" value={overview?.published_count || 0} valueStyle={{ color: '#1A6BA8' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card className="stat-card-mini">
            <Statistic title="草稿" value={overview?.draft_count || 0} valueStyle={{ color: '#B8B3AC' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card className="stat-card-mini">
            <Statistic title="用户数" value={overview?.user_count || 0} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card className="stat-card-mini">
            <Statistic title="分类数" value={overview?.category_count || 0} prefix={<CloudServerOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card className="stat-card-mini">
            <Statistic title="今日登录" value={overview?.today_login_count || 0} valueStyle={{ color: '#107C10' }} />
          </Card>
        </Col>
      </Row>

      <Card title="数据导出" style={{ marginBottom: 24 }}>
        <Select
          placeholder="选择要导出的数据类型"
          style={{ width: 240, marginRight: 12 }}
          options={[
            { value: 'articles', label: '文章数据' },
            { value: 'users', label: '用户数据' },
            { value: 'login_logs', label: '登录日志' },
          ]}
        />
        <Button type="primary" icon={<ExportOutlined />} loading={exporting} onClick={() => {
          const sel = document.querySelector('.ant-select-selection-item') as HTMLElement;
          if (sel && sel.textContent) {
            const map: Record<string, string> = { '文章数据': 'articles', '用户数据': 'users', '登录日志': 'login_logs' };
            handleExport(map[sel.textContent] || '');
          } else {
            message.warning('请先选择导出类型');
          }
        }}>导出</Button>
      </Card>

      <Card title="导出历史">
        <Table dataSource={history} rowKey="id" columns={columns} pagination={{ pageSize: 10 }} size="middle" />
      </Card>
    </div>
  );
};

export default DataManage;

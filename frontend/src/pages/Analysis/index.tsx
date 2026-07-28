import { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Spin, Progress } from 'antd';
import { BarChartOutlined, PieChartOutlined, UserOutlined } from '@ant-design/icons';
import { dataApi, AnalysisData } from '@/api/data';
import './Analysis.css';

const { Title, Paragraph } = Typography;

const Analysis: React.FC = () => {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dataApi.getAnalysis()
      .then((res) => {
        setData((res as any).data || res);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!data) return <Paragraph type="secondary">暂无分析数据</Paragraph>;

  const maxTrend = Math.max(...data.article_trend.map((d) => d.count), 1);
  const maxLogin = Math.max(...data.login_trend.map((d) => d.count), 1);
  const totalStatus = data.article_status_dist.reduce((s, d) => s + d.value, 0) || 1;
  const totalRoles = data.user_role_dist.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div className="analysis-page">
      <Title level={4} style={{ marginBottom: 24 }}>数据分析</Title>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={12}>
          <Card title={<><BarChartOutlined /> 近7天文章发布趋势</>} className="analysis-card">
            <div className="bar-chart">
              {data.article_trend.map((d) => (
                <div key={d.date} className="bar-row">
                  <span className="bar-label">{d.date.slice(5)}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(d.count / maxTrend) * 100}%` }} />
                  </div>
                  <span className="bar-value">{d.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<><PieChartOutlined /> 文章状态分布</>} className="analysis-card">
            <div className="dist-list">
              {data.article_status_dist.map((d) => (
                <div key={d.name} className="dist-item">
                  <span className="dist-name">{d.name}</span>
                  <Progress
                    percent={Math.round((d.value / totalStatus) * 100)}
                    format={() => `${d.value}`}
                    strokeColor={d.name === '已发布' ? '#1A6BA8' : '#B8B3AC'}
                    size="small"
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<><UserOutlined /> 用户角色分布</>} className="analysis-card">
            <div className="dist-list">
              {data.user_role_dist.map((d) => (
                <div key={d.name} className="dist-item">
                  <span className="dist-name">{d.name}</span>
                  <Progress
                    percent={totalRoles > 0 ? Math.round((d.value / totalRoles) * 100) : 0}
                    format={() => `${d.value}`}
                    strokeColor="#1A6BA8"
                    size="small"
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<><BarChartOutlined /> 近30天登录趋势</>} className="analysis-card">
            <div className="bar-chart compact">
              {data.login_trend.filter((_, i) => i % 3 === 0).map((d) => (
                <div key={d.date} className="bar-row">
                  <span className="bar-label">{d.date.slice(5)}</span>
                  <div className="bar-track">
                    <div className="bar-fill login-bar" style={{ width: `${(d.count / maxLogin) * 100}%` }} />
                  </div>
                  <span className="bar-value">{d.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Analysis;

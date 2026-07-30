import { useState, useEffect } from 'react';
import { Card, Table, Form, Input, Button, Tag, Typography, Row, Col, Statistic, Spin, App } from 'antd';
import {
  SafetyCertificateOutlined,
  LockOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoginOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { authApi, LoginLog } from '@/api/auth';
import './Security.css';

const { Title, Text } = Typography;

interface SecurityStats {
  today_logins: number;
  recent_failures: number;
  total_users: number;
  active_sessions: number;
}

const Security: React.FC = () => {
  const { message } = App.useApp();
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [passwordForm] = Form.useForm();
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [stats, setStats] = useState<SecurityStats>({
    today_logins: 0,
    recent_failures: 0,
    total_users: 0,
    active_sessions: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchLoginLogs = async () => {
    setLogsLoading(true);
    try {
      const data: any = await authApi.getLoginLogs();
      setLoginLogs(Array.isArray(data) ? data : (data?.results || []));
      calcStats(Array.isArray(data) ? data : (data?.results || []));
    } catch {
      message.error('获取登录日志失败');
    } finally {
      setLogsLoading(false);
      setStatsLoading(false);
    }
  };

  const calcStats = (logs: LoginLog[]) => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    let todayCount = 0;
    let recentFailCount = 0;
    logs.forEach((log) => {
      if (log.login_time?.startsWith(todayStr)) todayCount++;
      if (log.status === 'failed') recentFailCount++;
    });
    setStats((prev) => ({
      ...prev,
      today_logins: todayCount,
      recent_failures: recentFailCount,
    }));
  };

  useEffect(() => {
    fetchLoginLogs();
  }, []);

  const handlePasswordChange = async () => {
    try {
      const values = await passwordForm.validateFields();
      if (values.new_password !== values.confirm_password) {
        message.error('两次输入的密码不一致');
        return;
      }
      setPasswordLoading(true);
      await authApi.changePassword({
        old_password: values.old_password,
        new_password: values.new_password,
      });
      message.success('密码修改成功');
      passwordForm.resetFields();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || '密码修改失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  const logColumns = [
    {
      title: 'IP 地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: '30%',
      render: (ip: string) => <Text code>{ip}</Text>,
    },
    {
      title: '登录时间',
      dataIndex: 'login_time',
      key: 'login_time',
      width: '35%',
      render: (t: string) => (t ? new Date(t).toLocaleString('zh-CN') : '--'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center' as const,
      render: (status: string) =>
        status === 'success' ? (
          <Tag icon={<CheckCircleOutlined />} color="#389e0d">
            成功
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="#cf1322">
            失败
          </Tag>
        ),
    },
  ];

  return (
    <div className="security-page">
      <div className="security-header">
        <Title level={4} style={{ margin: 0 }}>
          <SafetyCertificateOutlined style={{ marginRight: 8 }} />
          安全中心
        </Title>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <span>
                <HistoryOutlined style={{ marginRight: 8 }} />
                登录日志
              </span>
            }
            variant="borderless"
            className="security-card"
          >
            <Table
              columns={logColumns}
              dataSource={loginLogs}
              rowKey="id"
              loading={logsLoading}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              size="middle"
              className="log-table"
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <span>
                <LockOutlined style={{ marginRight: 8 }} />
                修改密码
              </span>
            }
            variant="borderless"
            className="security-card"
          >
            <Form form={passwordForm} layout="vertical" className="password-form">
              <Form.Item name="old_password" label="旧密码" rules={[{ required: true, message: '请输入旧密码' }]}>
                <Input.Password placeholder="请输入当前密码" prefix={<LockOutlined className="input-icon" />} />
              </Form.Item>
              <Form.Item name="new_password" label="新密码" rules={[{ required: true, message: '请输入新密码' }]}>
                <Input.Password placeholder="请输入新密码" prefix={<LockOutlined className="input-icon" />} />
              </Form.Item>
              <Form.Item name="confirm_password" label="确认密码" rules={[{ required: true, message: '请再次输入新密码' }]}>
                <Input.Password placeholder="请再次输入新密码" prefix={<LockOutlined className="input-icon" />} />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" block loading={passwordLoading} onClick={handlePasswordChange}>
                  修改密码
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            title={
              <span>
                <SafetyCertificateOutlined style={{ marginRight: 8 }} />
                安全概览
              </span>
            }
            variant="borderless"
            className="security-card"
          >
            {statsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin />
              </div>
            ) : (
              <Row gutter={[24, 16]}>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="今日登录"
                    value={stats.today_logins}
                    prefix={<LoginOutlined style={{ color: '#1A6BA8' }} />}
                    valueStyle={{ color: '#1A6BA8' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="最近失败次数"
                    value={stats.recent_failures}
                    prefix={<WarningOutlined style={{ color: stats.recent_failures > 0 ? '#cf1322' : '#B8B3AC' }} />}
                    valueStyle={{ color: stats.recent_failures > 0 ? '#cf1322' : '#B8B3AC' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="总登录记录"
                    value={loginLogs.length}
                    prefix={<HistoryOutlined style={{ color: '#389e0d' }} />}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="成功率"
                    value={loginLogs.length > 0 ? Math.round(((loginLogs.length - stats.recent_failures) / loginLogs.length) * 100) : 100}
                    suffix="%"
                    prefix={<CheckCircleOutlined style={{ color: '#389e0d' }} />}
                    valueStyle={{ color: '#389e0d' }}
                  />
                </Col>
              </Row>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Security;

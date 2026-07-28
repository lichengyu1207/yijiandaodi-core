import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Tag, Spin, Descriptions, Space } from 'antd';
import { UserOutlined, EditOutlined, LinkOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import request from '@/utils/request';

interface ApplicationStatus {
  id: string;
  display_name: string;
  bio: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  review_comment: string;
  reviewed_at: string | null;
  created_at: string;
}

const STATUS_CONFIG = {
  pending: { color: 'orange', icon: <ClockCircleOutlined />, text: '待审核' },
  approved: { color: 'green', icon: <CheckCircleOutlined />, text: '已通过' },
  rejected: { color: 'red', icon: <CloseCircleOutlined />, text: '已拒绝' },
};

const CreatorApplicationPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | null>(null);
  const [isCreator, setIsCreator] = useState(false);

  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    checkApplicationStatus();
  }, []);

  const checkApplicationStatus = async () => {
    try {
      // 检查是否已经是创作者
      if (user?.is_creator) {
        setIsCreator(true);
        setChecking(false);
        return;
      }

      // 检查申请状态
      const res = await request.get('/api/tipping/application/my_application/');
      const data = (res as any)?.data;
      if (data) {
        setApplicationStatus(data as ApplicationStatus);
      }
    } catch (error) {
      console.error('检查申请状态失败', error);
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const res = await request.post('/api/tipping/application/', {
        display_name: values.display_name || user?.username,
        bio: values.bio || '',
        reason: values.reason,
        portfolio_url: values.portfolio_url || '',
        social_links: {},
      });

      const data = (res as any);
      if (data.success) {
        message.success('申请已提交，请等待管理员审核');
        setApplicationStatus({
          id: data.data.id,
          display_name: data.data.display_name,
          bio: values.bio || '',
          reason: values.reason,
          status: 'pending',
          review_comment: '',
          reviewed_at: null,
          created_at: data.data.created_at,
        });
      } else {
        message.error(data.message || '申请失败');
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '申请失败');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', padding: 20, textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#86909C' }}>正在检查申请状态...</div>
      </div>
    );
  }

  // 已是创作者
  if (isCreator) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', padding: 20 }}>
        <Card style={{ borderRadius: 12, textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#00B42A', marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>您已是创作者</h2>
          <p style={{ color: '#86909C', marginBottom: 24 }}>
            您已经拥有创作者身份，可以直接使用创作者功能
          </p>
          <Button type="primary" size="large" onClick={() => navigate('/admin/creator-stats')}>
            进入创作者中心
          </Button>
        </Card>
      </div>
    );
  }

  // 有待审核/已审核的申请
  if (applicationStatus) {
    const statusConfig = STATUS_CONFIG[applicationStatus.status];
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', padding: 20 }}>
        <Card style={{ borderRadius: 12 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            {statusConfig.icon}
            <Tag color={statusConfig.color} style={{ fontSize: 14, padding: '4px 12px', marginLeft: 8 }}>
              {statusConfig.text}
            </Tag>
          </div>

          <Descriptions bordered column={1} labelStyle={{ width: 120 }}>
            <Descriptions.Item label="申请昵称">{applicationStatus.display_name}</Descriptions.Item>
            <Descriptions.Item label="申请理由">{applicationStatus.reason}</Descriptions.Item>
            <Descriptions.Item label="申请时间">
              {new Date(applicationStatus.created_at).toLocaleString('zh-CN')}
            </Descriptions.Item>
            {applicationStatus.status !== 'pending' && (
              <Descriptions.Item label="审核时间">
                {applicationStatus.reviewed_at ? new Date(applicationStatus.reviewed_at).toLocaleString('zh-CN') : '-'}
              </Descriptions.Item>
            )}
            {applicationStatus.review_comment && (
              <Descriptions.Item label="审核备注">{applicationStatus.review_comment}</Descriptions.Item>
            )}
          </Descriptions>

          {applicationStatus.status === 'pending' && (
            <div style={{ textAlign: 'center', marginTop: 24, color: '#86909C' }}>
              您的申请正在审核中，请耐心等待管理员审核
            </div>
          )}

          {applicationStatus.status === 'approved' && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Button type="primary" onClick={() => navigate('/admin/creator-stats')}>
                进入创作者中心
              </Button>
            </div>
          )}

          {applicationStatus.status === 'rejected' && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Button type="primary" onClick={() => setApplicationStatus(null)}>
                重新申请
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // 申请表
  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 20 }}>
      <Card style={{ borderRadius: 12 }} title={
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          <EditOutlined style={{ marginRight: 8, color: '#165DFF' }} />
          申请成为创作者
        </div>
      }>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="display_name"
            label="创作者昵称"
            initialValue={user?.username}
            rules={[{ required: true, message: '请填写昵称' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="您的创作者昵称" maxLength={50} />
          </Form.Item>

          <Form.Item
            name="bio"
            label="个人简介"
          >
            <Input.TextArea rows={3} placeholder="介绍一下自己..." maxLength={500} />
          </Form.Item>

          <Form.Item
            name="reason"
            label="申请理由"
            rules={[{ required: true, message: '请填写申请理由' }]}
          >
            <Input.TextArea rows={4} placeholder="为什么想成为创作者？您有什么内容创作经验？" maxLength={1000} />
          </Form.Item>

          <Form.Item
            name="portfolio_url"
            label="作品集链接"
          >
            <Input prefix={<LinkOutlined />} placeholder="https://..." />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading} size="large">
                提交申请
              </Button>
              <Button onClick={() => navigate(-1)}>
                返回
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 16, padding: '12px 16px', background: '#F7F8FA', borderRadius: 8, fontSize: 13, color: '#86909C' }}>
          <strong>申请说明：</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            <li>提交申请后，管理员会在1-3个工作日内审核</li>
            <li>审核通过后，您将获得创作者身份，可以使用内容发布、数据统计等功能</li>
            <li>如有疑问，请联系管理员</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default CreatorApplicationPage;
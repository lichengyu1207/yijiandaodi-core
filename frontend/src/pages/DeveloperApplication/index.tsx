import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Tag, Spin, Descriptions, Space, Select } from 'antd';
import { ApiOutlined, LinkOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import request from '@/utils/request';

interface ApplicationStatus {
  id: number;
  company: string;
  use_case: string;
  reason: string;
  requested_tier: string;
  status: 'pending' | 'approved' | 'rejected';
  review_comment: string;
  reviewed_at: string | null;
  created_at: string;
}

const TIER_OPTIONS = [
  { value: 'free', label: '免费版（日限100次，月限3000次）' },
  { value: 'pro', label: '专业版（日限500次，月限15000次）' },
  { value: 'team', label: '团队版（日限2000次，月限60000次）' },
];

const STATUS_CONFIG = {
  pending: { color: 'orange', icon: <ClockCircleOutlined />, text: '待审核' },
  approved: { color: 'green', icon: <CheckCircleOutlined />, text: '已通过' },
  rejected: { color: 'red', icon: <CloseCircleOutlined />, text: '已拒绝' },
};

const DeveloperApplicationPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | null>(null);
  const [isDeveloper, setIsDeveloper] = useState(false);

  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    checkApplicationStatus();
  }, []);

  const checkApplicationStatus = async () => {
    try {
      // 检查是否已经是开发者
      if (user?.is_developer) {
        setIsDeveloper(true);
        setChecking(false);
        return;
      }

      // 检查申请状态
      const res = await request.get('/api/auth/dev-application/my_application/');
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
      const res = await request.post('/api/auth/dev-application/', {
        company: values.company || '',
        website: values.website || '',
        contact_email: values.contact_email || user?.email,
        use_case: values.use_case || '',
        reason: values.reason,
        requested_tier: values.requested_tier || 'free',
      });

      const data = (res as any);
      if (data.success) {
        message.success('申请已提交，请等待管理员审核');
        setApplicationStatus({
          id: data.data.id,
          company: values.company || '',
          use_case: values.use_case || '',
          reason: values.reason,
          requested_tier: data.data.requested_tier,
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

  // 已是开发者
  if (isDeveloper) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', padding: 20 }}>
        <Card style={{ borderRadius: 12, textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#00B42A', marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>您已是API开发者</h2>
          <p style={{ color: '#86909C', marginBottom: 24 }}>
            您已经拥有API开发者身份，可以使用API密钥管理功能
          </p>
          <Button type="primary" size="large" onClick={() => navigate('/admin/api-keys')}>
            进入开发者中心
          </Button>
        </Card>
      </div>
    );
  }

  // 有待审核/已审核的申请
  if (applicationStatus) {
    const statusConfig = STATUS_CONFIG[applicationStatus.status];
    const tierLabel = TIER_OPTIONS.find(t => t.value === applicationStatus.requested_tier)?.label || applicationStatus.requested_tier;

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
            <Descriptions.Item label="申请套餐">{tierLabel}</Descriptions.Item>
            <Descriptions.Item label="公司/组织">{applicationStatus.company || '无'}</Descriptions.Item>
            <Descriptions.Item label="使用场景">{applicationStatus.use_case || '无'}</Descriptions.Item>
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
              <Button type="primary" onClick={() => navigate('/admin/api-keys')}>
                进入开发者中心
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
          <ApiOutlined style={{ marginRight: 8, color: '#165DFF' }} />
          申请API开发者权限
        </div>
      }>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="requested_tier"
            label="申请套餐"
            initialValue="free"
            rules={[{ required: true, message: '请选择套餐' }]}
          >
            <Select options={TIER_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="company"
            label="公司/组织"
          >
            <Input placeholder="您的公司或组织名称" maxLength={100} />
          </Form.Item>

          <Form.Item
            name="website"
            label="网站"
          >
            <Input prefix={<LinkOutlined />} placeholder="https://..." />
          </Form.Item>

          <Form.Item
            name="contact_email"
            label="联系邮箱"
            initialValue={user?.email}
          >
            <Input type="email" placeholder="您的联系邮箱" />
          </Form.Item>

          <Form.Item
            name="use_case"
            label="使用场景"
          >
            <Input.TextArea rows={3} placeholder="描述您的API使用场景，如：自动化检测、批量处理等" maxLength={500} />
          </Form.Item>

          <Form.Item
            name="reason"
            label="申请理由"
            rules={[{ required: true, message: '请填写申请理由' }]}
          >
            <Input.TextArea rows={4} placeholder="为什么需要API访问权限？您计划如何使用？" maxLength={500} />
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
          <strong>API开发者权益：</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            <li>获取API密钥，调用AI检测、RAG检索等服务</li>
            <li>查看API调用统计、配额使用情况</li>
            <li>根据套餐等级获得不同的调用限额</li>
            <li>申请审核通过后自动解锁开发者功能</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default DeveloperApplicationPage;
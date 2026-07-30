import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Modal, Input, message, Space, Spin, Descriptions } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import request from '@/utils/request';

interface ApplicationItem {
  id: string;
  user_id: number;
  username: string;
  email: string;
  display_name: string;
  bio: string;
  reason: string;
  portfolio_url: string;
  created_at: string;
}

const CreatorReviewPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [reviewModal, setReviewModal] = useState(false);
  const [currentApp, setCurrentApp] = useState<ApplicationItem | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const res = await request.get('/api/tipping/application/pending_list/');
      const data = (res as any)?.data || [];
      setApplications(data as ApplicationItem[]);
    } catch (error) {
      message.error('加载申请列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (app: ApplicationItem) => {
    setCurrentApp(app);
    setReviewComment('');
    setReviewModal(true);
  };

  const submitReview = async (action: 'approve' | 'reject') => {
    if (!currentApp) return;

    setReviewing(true);
    try {
      const res = await request.post(`/api/tipping/application/${currentApp.id}/review/`, {
        action,
        comment: reviewComment,
      });

      const data = (res as any);
      if (data.success) {
        message.success(`审核完成：${action === 'approve' ? '已通过' : '已拒绝'}`);
        setReviewModal(false);
        loadApplications();
      } else {
        message.error(data.message || '审核失败');
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '审核失败');
    } finally {
      setReviewing(false);
    }
  };

  const columns: ColumnsType<ApplicationItem> = [
    {
      title: '申请人',
      dataIndex: 'username',
      width: 120,
      render: (text: string) => <span style={{ fontWeight: 600 }}>{text}</span>,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 180,
      ellipsis: true,
    },
    {
      title: '申请昵称',
      dataIndex: 'display_name',
      width: 120,
    },
    {
      title: '申请理由',
      dataIndex: 'reason',
      ellipsis: true,
      width: 200,
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      width: 160,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: () => (
        <Tag color="orange" icon={<ClockCircleOutlined />}>
          待审核
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button type="primary" size="small" onClick={() => handleReview(record)}>
          审核
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Card
        title={
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            <UserOutlined style={{ marginRight: 8, color: '#165DFF' }} />
            创作者申请审核
            <Tag color="orange" style={{ marginLeft: 8 }}>
              {applications.length} 待审核
            </Tag>
          </div>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : applications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#86909C' }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#00B42A', marginBottom: 16 }} />
            <div>暂无待审核申请</div>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={applications}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 900 }}
          />
        )}
      </Card>

      {/* 审核弹窗 */}
      <Modal
        title="审核申请"
        open={reviewModal}
        onCancel={() => setReviewModal(false)}
        footer={null}
        width={600}
      >
        {currentApp && (
          <>
            <Descriptions bordered column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="申请人">{currentApp.username}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{currentApp.email}</Descriptions.Item>
              <Descriptions.Item label="申请昵称">{currentApp.display_name}</Descriptions.Item>
              <Descriptions.Item label="个人简介">{currentApp.bio || '无'}</Descriptions.Item>
              <Descriptions.Item label="申请理由">{currentApp.reason}</Descriptions.Item>
              <Descriptions.Item label="作品集">
                {currentApp.portfolio_url ? (
                  <a href={currentApp.portfolio_url} target="_blank" rel="noopener noreferrer">
                    {currentApp.portfolio_url}
                  </a>
                ) : '无'}
              </Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {new Date(currentApp.created_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>审核备注（可选）：</div>
              <Input.TextArea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="填写审核备注..."
              />
            </div>

            <Space style={{ width: '100%', justifyContent: 'center' }}>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={reviewing}
                onClick={() => submitReview('approve')}
                style={{ background: '#00B42A' }}
              >
                通过
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                loading={reviewing}
                onClick={() => submitReview('reject')}
              >
                拒绝
              </Button>
              <Button onClick={() => setReviewModal(false)}>取消</Button>
            </Space>
          </>
        )}
      </Modal>
    </div>
  );
};

export default CreatorReviewPage;
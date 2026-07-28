import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Switch, Tag, Space,
  message, Popconfirm, Tabs, Row, Col, Statistic, Typography, Divider,
  InputNumber, Slider, Empty, Spin
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, ReloadOutlined,
  FileProtectOutlined, CustomerServiceOutlined, AudioOutlined,
  SettingOutlined, SaveOutlined, ExperimentOutlined,
  MessageOutlined, SearchOutlined, EyeOutlined, FilterOutlined,
  UserOutlined, RobotOutlined, PictureOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  systemApi,
  type PrivacyAgreementItem,
  type AutoReplyItem,
  type IMMessageItem,
} from '@/api/systemApi';
import BannerManage from './BannerManage';
import SkillManage from './SkillManage';

const { TextArea } = Input;
const { Text, Title } = Typography;

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState('privacy');

  return (
    <div style={{ padding: 24, background: '#F8FAFC', minHeight: '100vh' }}>
      <Title level={4} style={{ marginBottom: 20, color: '#1E293B' }}>
        <SettingOutlined style={{ marginRight: 8 }} /> 系统设置中心
      </Title>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="middle"
        items={[
          {
            key: 'privacy',
            label: <span><FileProtectOutlined /> 隐私协议</span>,
            children: <PrivacySettings />,
          },
          {
            key: 'im',
            label: <span><CustomerServiceOutlined /> IM客服管理</span>,
            children: <IMManagement />,
          },
          {
            key: 'voice',
            label: <span><AudioOutlined /> 语音助手</span>,
            children: <VoiceSettings />,
          },
          {
            key: 'banners',
            label: <span><PictureOutlined /> 轮播图管理</span>,
            children: <BannerManage />,
          },
          {
            key: 'skills',
            label: <span><ExperimentOutlined /> 技能配置管理</span>,
            children: <SkillManage />,
          },
        ]}
      />
    </div>
  );
}

function PrivacySettings() {
  const [agreements, setAgreements] = useState<PrivacyAgreementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PrivacyAgreementItem | null>(null);
  const [form] = Form.useForm();

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await systemApi.getAgreements();
      const data = res?.data || res;
      setAgreements(data?.results || data?.data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleSave = async (values: any) => {
    try {
      if (editing) {
        await systemApi.updateAgreement(editing.id, values);
        message.success('协议更新成功');
      } else {
        await systemApi.createAgreement(values);
        message.success('协议创建成功');
      }
      setModalOpen(false); setEditing(null); form.resetFields();
      fetchList();
    } catch { message.error('操作失败'); }
  };

  const columns: ColumnsType<PrivacyAgreementItem> = [
    { title: '标题', dataIndex: 'title', width: 180, render: (t: string) => <Text strong>{t}</Text> },
    {
      title: '类型', dataIndex: 'agreement_type', width: 100,
      render: (t: string) => ({
        privacy: <Tag color="red" style={{ borderRadius: 4 }}>隐私政策</Tag>,
        terms: <Tag color="blue" style={{ borderRadius: 4 }}>服务条款</Tag>,
        cookie: <Tag color="green" style={{ borderRadius: 4 }}>Cookie政策</Tag>,
      }[t] || t),
    },
    { title: '版本', dataIndex: 'version', width: 70 },
    {
      title: '状态', dataIndex: 'is_active', width: 80,
      render: (v: boolean) => v ? <Tag color="green" style={{ borderRadius: 4 }}>生效中</Tag> : <Tag style={{ borderRadius: 4 }}>已停用</Tag>,
    },
    { title: '必选', dataIndex: 'is_required', width: 60, render: (v: boolean) => v ? '是' : '-' },
    { title: '更新时间', dataIndex: 'updated_at', width: 170, render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作', width: 140, fixed: 'right' as const,
      render: (_, r) => (
        <Space size="small">
          <Button type="link" icon={<EditOutlined />} onClick={() => {
            setEditing(r); form.setFieldsValue(r); setModalOpen(true);
          }} />
          <Popconfirm title="确定删除？" onConfirm={async () => {
            await systemApi.deleteAgreement(r.id); message.success('已删除'); fetchList();
          }}>
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card size="small" style={{ borderRadius: 6, marginBottom: 16 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditing(null); form.resetFields();
            form.setFieldsValue({ version: '2.0', is_active: true, is_required: true });
            setModalOpen(true);
          }} style={{ borderRadius: 6 }}>新增协议</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchList} style={{ borderRadius: 6 }} />
        </Space>
      </Card>
      <Card size="small" style={{ borderRadius: 6 }}>
        <Table columns={columns} dataSource={agreements} rowKey="id" loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共${t}条`, size: 'small' }}
          scroll={{ x: 900 }} size="small"
        />
      </Card>
      <Modal title={editing ? '编辑协议' : '新增协议'} open={modalOpen} destroyOnHidden
        onCancel={() => { setModalOpen(false); setEditing(null); }} footer={null} width={700}>
        <Form form={form} layout="vertical" onFinish={handleSave}
          initialValues={{ version: '1.0', is_active: true, is_required: true }}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="如：隐私政策 v2.0" style={{ borderRadius: 6 }} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="agreement_type" label="类型" rules={[{ required: true }]}>
                <Select options={[{label:'隐私政策',value:'privacy'},{label:'服务条款',value:'terms'},{label:'Cookie政策',value:'cookie'}]} style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="version" label="版本号">
                <Input placeholder="1.0" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_required" label="是否必选" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="is_active" label="生效状态" valuePropName="checked">
            <Switch checkedChildren="生效" unCheckedChildren="停用" />
          </Form.Item>
          <Form.Item name="content" label="协议内容（支持HTML）" rules={[{ required: true }]}>
            <TextArea rows={10} placeholder='<h3>一、信息收集</h3>\n<p>我们收集以下信息...</p>' style={{ borderRadius: 6, fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', margin: 0 }}>
            <Space>
              <Button onClick={() => { setModalOpen(false); setEditing(null); }} style={{ borderRadius: 6 }}>取消</Button>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} style={{ borderRadius: 6 }}>{editing ? '更新' : '创建'}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function IMManagement() {
  const [subTab, setSubTab] = useState('messages');

  return (
    <Tabs
      activeKey={subTab}
      onChange={setSubTab}
      size="small"
      type="card"
      items={[
        {
          key: 'messages',
          label: <span><MessageOutlined /> 用户消息</span>,
          children: <IMMessageManage />,
        },
        {
          key: 'replies',
          label: <span><RobotOutlined /> 自动回复规则</span>,
          children: <IMAutoReplySettings />,
        },
      ]}
    />
  );
}

function IMMessageManage() {
  const [messages, setMessages] = useState<IMMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterSender, setFilterSender] = useState<string>('');
  const [filterSession, setFilterSession] = useState<string>('');
  const [filterKeyword, setFilterKeyword] = useState<string>('');
  const [stats, setStats] = useState({ total_messages: 0, total_sessions: 0, user_messages: 0, auto_replies: 0 });
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSession, setDetailSession] = useState('');

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await systemApi.getAdminIMMessages({
        page,
        page_size: pageSize,
        sender_type: filterSender || undefined,
        session_id: filterSession || undefined,
        keyword: filterKeyword || undefined,
      });
      const data = res?.data || res;
      setMessages(data?.results || []);
      setTotal(data?.total || 0);
      if (data?.stats) setStats(data.stats);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchMessages(); }, [page, pageSize]);

  const handleSearch = () => { setPage(1); fetchMessages(); };
  const handleMarkRead = async (sessionId: string) => {
    try {
      await systemApi.markIMRead({ session_id: sessionId });
      message.success('已标记为已读');
      fetchMessages();
    } catch {}
  };

  const senderTypeMap: Record<string, { color: string; label: string; icon: any }> = {
    user: { color: '#1890FF', label: '用户', icon: <UserOutlined /> },
    agent: { color: '#52C41A', label: '客服', icon: <CustomerServiceOutlined /> },
    auto_reply: { color: '#722ED1', label: '自动回复', icon: <RobotOutlined /> },
    system: { color: '#999', label: '系统', icon: <SettingOutlined /> },
  };

  const columns: ColumnsType<IMMessageItem> = [
    {
      title: '发送者', dataIndex: 'sender_type', width: 100,
      render: (t: string) => {
        const info = senderTypeMap[t] || { color: '#999', label: t, icon: null };
        return <Tag color={info.color} icon={info.icon} style={{ borderRadius: 4 }}>{info.label}</Tag>;
      },
    },
    { title: '会话ID', dataIndex: 'session_id', width: 160, ellipsis: true },
    {
      title: '消息内容', dataIndex: 'content', ellipsis: true,
      render: (c: string) => <Text style={{ fontSize: 12, maxWidth: 300 }}>{c}</Text>,
    },
    {
      title: '消息类型', dataIndex: 'message_type', width: 80,
      render: (t: string) => ({ text: '文本', image: '图片', file: '文件' }[t] || t),
    },
    {
      title: '已读', dataIndex: 'is_read', width: 60,
      render: (v: boolean) => v ? <Tag color="#EEE" style={{ borderRadius: 4, color: '#999' }}>已读</Tag> : <Tag color="red" style={{ borderRadius: 4 }}>未读</Tag>,
    },
    { title: '时间', dataIndex: 'created_at', width: 160, render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss') },
    {
      title: '操作', width: 120, fixed: 'right' as const,
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setDetailSession(r.session_id); setDetailOpen(true); }}>
            会话
          </Button>
          {!r.is_read && r.sender_type === 'user' && (
            <Button type="link" size="small" onClick={() => handleMarkRead(r.session_id)}>标已读</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #1890FF' }}><Statistic title="总消息数" value={stats.total_messages} /></Card></Col>
        <Col span={6}><Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #722ED1' }}><Statistic title="会话数" value={stats.total_sessions} /></Card></Col>
        <Col span={6}><Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #52C41A' }}><Statistic title="用户消息" value={stats.user_messages} /></Card></Col>
        <Col span={6}><Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #FAAD14' }}><Statistic title="自动回复" value={stats.auto_replies} /></Card></Col>
      </Row>

      <Card size="small" style={{ borderRadius: 6, marginBottom: 16 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Space wrap>
          <Select
            placeholder="发送者筛选"
            allowClear
            style={{ width: 120, borderRadius: 6 }}
            value={filterSender || undefined}
            onChange={(v) => { setFilterSender(v || ''); }}
            options={[
              { value: 'user', label: '用户' },
              { value: 'agent', label: '客服' },
              { value: 'auto_reply', label: '自动回复' },
              { value: 'system', label: '系统' },
            ]}
          />
          <Input
            placeholder="会话ID搜索"
            allowClear
            style={{ width: 180, borderRadius: 6 }}
            value={filterSession}
            onChange={(e) => setFilterSession(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Input
            placeholder="消息内容搜索"
            allowClear
            style={{ width: 180, borderRadius: 6 }}
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} style={{ borderRadius: 6 }}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchMessages} style={{ borderRadius: 6 }} />
        </Space>
      </Card>

      <Card size="small" style={{ borderRadius: 6 }}>
        <Table
          columns={columns}
          dataSource={messages}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => '共' + t + '条消息',
            size: 'small',
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          scroll={{ x: 1000 }}
          size="small"
          rowClassName={(record) => !record.is_read && record.sender_type === 'user' ? 'im-unread-row' : ''}
        />
      </Card>

      <Modal
        title={'会话详情 - ' + detailSession}
        open={detailOpen}
        destroyOnHidden
        onCancel={() => { setDetailOpen(false); setDetailSession(''); }}
        footer={[
          <Button key="markread" onClick={() => { handleMarkRead(detailSession); setDetailOpen(false); }}>
            标记全部已读
          </Button>,
          <Button key="close" onClick={() => { setDetailOpen(false); setDetailSession(''); }}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        <SessionDetail sessionId={detailSession} />
      </Modal>

      <style>{`
        .im-unread-row { background-color: #FFF7E6; }
        .im-unread-row:hover > td { background-color: #FFE7BA !important; }
      `}</style>
    </>
  );
}

function SessionDetail({ sessionId }: { sessionId: string }) {
  const [msgs, setMsgs] = useState<IMMessageItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    systemApi.getIMHistory({ session_id: sessionId, limit: 100 }).then((res: any) => {
      setMsgs(res?.data || []);
    }).finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>;

  return (
    <div style={{ maxHeight: 500, overflowY: 'auto', padding: '8px 0' }}>
      {msgs.length === 0 ? (
        <Empty description="暂无消息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : msgs.map((msg) => (
        <div key={msg.id} style={{
          display: 'flex',
          marginBottom: 12,
          justifyContent: msg.sender_type === 'user' ? 'flex-end' : 'flex-start',
        }}>
          <div style={{
            maxWidth: '75%',
            padding: '8px 14px',
            borderRadius: msg.sender_type === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
            background: msg.sender_type === 'user' ? '#1890FF' : '#F1F5F9',
            color: msg.sender_type === 'user' ? '#fff' : '#334155',
            fontSize: 13,
            lineHeight: 1.6,
            wordBreak: 'break-word',
          }}>
            <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 2 }}>
              {msg.sender_type === 'user' ? '用户' : msg.sender_type === 'auto_reply' ? 'AI自动回复' : '系统'}
              {' · ' + dayjs(msg.created_at).format('HH:mm:ss')}
            </div>
            {msg.content}
          </div>
        </div>
      ))}
    </div>
  );
}

function IMAutoReplySettings() {
  const [replies, setReplies] = useState<AutoReplyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AutoReplyItem | null>(null);
  const [form] = Form.useForm();

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await systemApi.getAutoReplies();
      const data = res?.data || res;
      setReplies(data?.results || data?.data || []);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { fetchList(); }, []);

  const handleSave = async (values: any) => {
    try {
      if (editing) {
        await systemApi.updateAutoReply(editing.id, values);
        message.success('规则更新成功');
      } else {
        await systemApi.createAutoReply(values);
        message.success('规则创建成功');
      }
      setModalOpen(false); setEditing(null); form.resetFields();
      fetchList();
    } catch { message.error('操作失败'); }
  };

  const triggerTypes = [
    { value: 'keyword', label: '关键词匹配' }, { value: 'regex', label: '正则表达式' },
    { value: 'welcome', label: '欢迎语' }, { value: 'offline', label: '离线回复' },
    { value: 'default', label: '默认回复' },
  ];
  const triggerColors: Record<string, string> = { keyword: '#1890FF', regex: '#722ED1', welcome: '#52C41A', offline: '#FAAD14', default: '#999' };

  const columns: ColumnsType<AutoReplyItem> = [
    {
      title: '触发类型', dataIndex: 'trigger_type', width: 110,
      render: (t: string) => <Tag color={triggerColors[t]} style={{ borderRadius: 4 }}>{triggerTypes.find(x=>x.value===t)?.label||t}</Tag>,
    },
    { title: '关键词/正则', dataIndex: 'keyword', width: 150, ellipsis: true },
    { title: '回复内容', dataIndex: 'reply_content', ellipsis: true, render: (c: string) => <Text style={{ fontSize: 12 }}>{c}</Text> },
    { title: '优先级', dataIndex: 'priority', width: 70, sorter: (a: AutoReplyItem, b: AutoReplyItem) => a.priority - b.priority },
    { title: '匹配次数', dataIndex: 'match_count', width: 90 },
    {
      title: '启用', dataIndex: 'is_enabled', width: 60,
      render: (v: boolean) => v ? <Tag color="green" style={{ borderRadius: 4 }}>开</Tag> : <Tag style={{ borderRadius: 4 }}>关</Tag>,
    },
    {
      title: '操作', width: 120, fixed: 'right' as const,
      render: (_, r) => (
        <Space size="small">
          <Button type="link" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }} />
          <Popconfirm title="确定删除？" onConfirm={async () => { await systemApi.deleteAutoReply(r.id); message.success('已删除'); fetchList(); }}>
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #1890FF' }}><Statistic title="总规则数" value={replies.length} /></Card></Col>
        <Col span={6}><Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #52C41A' }}><Statistic title="已启用" value={replies.filter(r=>r.is_enabled).length} /></Card></Col>
        <Col span={6}><Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #722ED1' }}><Statistic title="总匹配" value={replies.reduce((s,r)=>s+r.match_count,0)} /></Card></Col>
        <Col span={6}><Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #FAAD14' }}><Statistic title="默认回复" value={replies.filter(r=>r.trigger_type==='default').length} /></Card></Col>
      </Row>

      <Card size="small" style={{ borderRadius: 6, marginBottom: 16 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditing(null); form.resetFields(); form.setFieldsValue({ trigger_type: 'keyword', priority: 50, is_enabled: true }); setModalOpen(true);
          }} style={{ borderRadius: 6 }}>新增规则</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchList} style={{ borderRadius: 6 }} />
        </Space>
      </Card>
      <Card size="small" style={{ borderRadius: 6 }}>
        <Table columns={columns} dataSource={replies} rowKey="id" loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => '共' + t + '条', size: 'small' }}
          scroll={{ x: 900 }} size="small"
        />
      </Card>
      <Modal title={editing ? '编辑自动回复' : '新增自动回复'} open={modalOpen} destroyOnHidden
        onCancel={() => { setModalOpen(false); setEditing(null); }} footer={null} width={580}>
        <Form form={form} layout="vertical" onFinish={handleSave}
          initialValues={{ trigger_type: 'keyword', priority: 50, is_enabled: true }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="trigger_type" label="触发类型" rules={[{ required: true }]}>
                <Select options={triggerTypes} style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="优先级（数字越大越优先）">
                <InputNumber min={0} max={100} style={{ width: '100%', borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="keyword" label="关键词/正则/留空则不限制">
            <Input placeholder="如：你好 / 你好|您好 / ^你好.*" style={{ borderRadius: 6 }} />
          </Form.Item>
          <Form.Item name="reply_content" label="回复内容" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="输入自动回复的内容..." style={{ borderRadius: 6 }} />
          </Form.Item>
          <Form.Item name="is_enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item style={{ textAlign: 'right', margin: 0 }}>
            <Space>
              <Button onClick={() => { setModalOpen(false); setEditing(null); }} style={{ borderRadius: 6 }}>取消</Button>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} style={{ borderRadius: 6 }}>{editing ? '更新' : '创建'}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function VoiceSettings() {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchConfig(); }, []);
  const fetchConfig = async () => {
    setLoading(true);
    try { const res = await systemApi.getVoiceConfig(); setConfig(res?.data || {}); } catch {}
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      Object.keys(config).forEach(k => {
        if (k === 'voice_enabled') {
          payload[k] = String(!!config[k]);
        } else {
          payload[k] = String(config[k] ?? '');
        }
      });
      await systemApi.updateVoiceConfig(payload);
      message.success('语音配置已保存');
    } catch { message.error('保存失败'); }
    setSaving(false);
  };

  const voiceOn = !!config.voice_enabled;

  return (
    <div>
      <Row gutter={[24, 16]}>
        {[
          { label: '语音开关', key: 'voice_enabled', icon: <AudioOutlined />, format: (v: any) => !!v ? '开启' : '关闭' },
          { label: '唤醒词', key: 'wake_word', icon: <AudioOutlined />, format: (v: any) => v ? '"' + v + '"' : '-' },
          { label: '语音语言', key: 'voice_language', icon: <AudioOutlined />, format: (v: any) => v || '-' },
          { label: 'TTS引擎', key: 'tts_engine', icon: <AudioOutlined />, format: (v: any) => v === 'browser' ? '浏览器内置' : (v || '-') },
          { label: 'STT引擎', key: 'stt_engine', icon: <AudioOutlined />, format: (v: any) => v === 'browser' ? '浏览器内置' : (v || '-') },
          { label: '最长录音(秒)', key: 'max_record_seconds', icon: <AudioOutlined />, format: (v: any) => (v || '-') + 's' },
        ].map(item => (
          <Col span={8} key={item.key}>
            <Card size="small" style={{ borderRadius: 6, borderTop: '3px solid #7C3AED' }}>
              <Statistic title={item.label} value={config[item.key] != null ? item.format(config[item.key]) : '-'} prefix={item.icon} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" style={{ borderRadius: 6, marginTop: 16 }} title="配置编辑">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>语音开关</Text>
            <Switch checkedChildren="开" unCheckedChildren="关" checked={voiceOn} onChange={(v) => setConfig(c => ({ ...c, voice_enabled: v }))} />
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>唤醒词</Text>
            <Input value={config.wake_word || ''} onChange={(e) => setConfig(c => ({ ...c, wake_word: e.target.value }))} style={{ borderRadius: 6 }} />
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>语音语言</Text>
            <Select value={config.voice_language || 'zh-CN'} onChange={(v) => setConfig(c => ({ ...c, voice_language: v }))} style={{ width: '100%', borderRadius: 6 }}
              options={[{label:'简体中文',value:'zh-CN'},{label:'English',value:'en-US'},{label:'繁體中文',value:'zh-TW'}]}
            />
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>最长录音秒数</Text>
            <Slider min={5} max={120} step={5} value={Number(config.max_record_seconds || 30)} onChange={(v) => setConfig(c => ({ ...c, max_record_seconds: v }) as any)} />
          </div>
        </div>
        <Divider />
        <div style={{ textAlign: 'right' }}>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave} style={{ borderRadius: 6 }}>保存配置</Button>
        </div>
      </Card>
    </div>
  );
}

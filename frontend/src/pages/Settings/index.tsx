import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Spin, Typography, App } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { dataApi, SystemConfigItem } from '@/api/data';
import { useAuthStore } from '@/store/useAuthStore';
import './Settings.css';

const { Title, Paragraph } = Typography;

const defaultConfigs: SystemConfigItem[] = [
  { key: 'site_name', value: '一鉴到底', value_type: 'string', description: '站点名称' },
  { key: 'site_description', value: '智能数据验证平台', value_type: 'string', description: '站点描述' },
  { key: 'contact_email', value: 'admin@fangdudu.top', value_type: 'string', description: '联系邮箱' },
  { key: 'maintenance_mode', value: 'false', value_type: 'boolean', description: '维护模式' },
];

const Settings: React.FC = () => {
  const { message } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const fetchUserInfo = useAuthStore((state) => state.fetchUserInfo);

  const [configLoading, setConfigLoading] = useState(true);
  const [configs, setConfigs] = useState<SystemConfigItem[]>(defaultConfigs);
  const [savingConfig, setSavingConfig] = useState(false);
  const [profileForm] = Form.useForm();
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    dataApi.getConfigs()
      .then((res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.data || []);
        if (list.length > 0) setConfigs(list);
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        username: user.username,
        email: user.email || '',
        avatar: user.avatar || '',
      });
    }
  }, [user]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await dataApi.updateConfigs(configs);
      message.success('配置保存成功');
    } catch {
      message.error('保存失败');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleUpdateConfig = (index: number, field: keyof SystemConfigItem, val: string) => {
    const next = [...configs];
    next[index] = { ...next[index], [field]: val };
    setConfigs(next);
  };

  const handleSaveProfile = async () => {
    try {
      const values = await profileForm.validateFields();
      setSavingProfile(true);
      await dataApi.updateProfile(values);
      await fetchUserInfo();
      message.success('个人信息更新成功');
    } catch (err: any) {
      if (!err?.errorFields) message.error('更新失败');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="settings-page">
      <Title level={4} style={{ marginBottom: 24 }}>系统设置</Title>

      <Card className="settings-card" title="站点配置">
        {configLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <div className="config-list">
            {configs.map((item, idx) => (
              <div key={item.key} className="config-item">
                <div className="config-label">
                  <span className="config-key">{item.description}</span>
                  <span className="config-desc">{item.key}</span>
                </div>
                <Input
                  value={item.value}
                  onChange={(e) => handleUpdateConfig(idx, 'value', e.target.value)}
                  style={{ maxWidth: 320 }}
                />
              </div>
            ))}
          </div>
        )}
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={savingConfig}
          onClick={handleSaveConfig}
          style={{ marginTop: 16 }}
        >
          保存配置
        </Button>
      </Card>

      <Card className="settings-card" title="个人信息" style={{ marginTop: 20 }}>
        <Form form={profileForm} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="用户名" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="邮箱地址" type="email" />
          </Form.Item>
          <Form.Item name="avatar" label="头像URL">
            <Input placeholder="头像图片链接" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" icon={<SaveOutlined />} loading={savingProfile} onClick={handleSaveProfile}>
              保存个人信息
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Settings;

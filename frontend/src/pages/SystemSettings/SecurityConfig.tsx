import { useState, useEffect } from 'react';
import {
  Card, InputNumber, Switch, Button, message, Popconfirm,
  Typography, Row, Col, Divider, Spin, Space, Input
} from 'antd';
import {
  SafetyCertificateOutlined, ApiOutlined, LockOutlined,
  ToolOutlined, SaveOutlined, ReloadOutlined, DeleteOutlined
} from '@ant-design/icons';
import { systemManageApi } from '@/api/logCenterApi';

const { TextArea } = Input;
const { Text } = Typography;

interface ConfigItem {
  config_key: string;
  config_value: string;
  label?: string;
}

const defaultConfig: Record<string, string | number | boolean> = {
  token_expire_seconds: 86400,
  session_timeout_seconds: 7200,
  max_login_attempts: 5,
  login_lockout_minutes: 30,
  api_whitelist: '/api/auth/login/,/api/auth/register/,/api/front/,/api/mall/,/api/media/',
  password_min_length: 8,
  password_require_uppercase: true,
  password_require_lowercase: true,
  password_require_digit: true,
  password_require_special: false,
  default_password: 'Yjdd@2026!',
  log_retention_days: 90,
};

export default function SecurityConfig() {
  const [config, setConfig] = useState<Record<string, any>>({ ...defaultConfig });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await systemManageApi.getSecurityConfigs();
      const data = res?.data || res;
      const list: ConfigItem[] = Array.isArray(data) ? data : (data?.results || data?.data || []);
      const merged = { ...defaultConfig };
      list.forEach((item: ConfigItem) => {
        if (item.config_key in merged) {
          const val = item.config_value;
          if (['password_require_uppercase', 'password_require_lowercase', 'password_require_digit', 'password_require_special'].includes(item.config_key)) {
            merged[item.config_key] = val === 'true' || val === true || val === '1';
          } else if (['token_expire_seconds', 'session_timeout_seconds', 'max_login_attempts', 'login_lockout_minutes', 'password_min_length', 'log_retention_days'].includes(item.config_key)) {
            merged[item.config_key] = Number(val) || defaultConfig[item.config_key];
          } else {
            merged[item.config_key] = val;
          }
        }
      });
      setConfig(merged);
    } catch {}
    setLoading(false);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(config)) {
        let strValue: string;
        if (typeof value === 'boolean') {
          strValue = String(value);
        } else {
          strValue = String(value ?? '');
        }
        await systemManageApi.updateSecurityConfig(key, strValue);
      }
      message.success('所有配置保存成功');
    } catch {
      message.error('部分配置保存失败');
    }
    setSaving(false);
  };

  const handleRefreshCache = async () => {
    setRefreshing(true);
    try {
      await systemManageApi.refreshCache();
      message.success('系统缓存刷新成功');
    } catch {
      message.error('缓存刷新失败');
    }
    setRefreshing(false);
  };

  const handleCleanupLogs = async () => {
    setCleaningUp(true);
    try {
      const days = Number(config.log_retention_days) || 90;
      await systemManageApi.cleanupLogs(days);
      message.success('已清理 ' + days + ' 天前的过期日志');
    } catch {
      message.error('日志清理失败');
    }
    setCleaningUp(false);
  };

  const updateField = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const cardStyle = { borderRadius: 6, marginBottom: 16 };
  const labelStyle = { color: '#1D2129', fontWeight: 500, marginBottom: 6, display: 'block' };
  const hintStyle = { color: '#86909C', fontSize: 12, marginTop: 2 };
  const inputStyle = { borderRadius: 6 };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#F5F7FA', minHeight: '100vh' }}>
      <div style={{ marginBottom: 20 }}>
        <Text strong style={{ fontSize: 18, color: '#1D2129' }}>
          <SafetyCertificateOutlined style={{ marginRight: 8, color: '#165DFF' }} />
          系统安全配置
        </Text>
      </div>

      <Card
        title={<><SafetyCertificateOutlined style={{ color: '#165DFF', marginRight: 8 }} />Token & 会话配置</>}
        size="small"
        style={cardStyle}
      >
        <Row gutter={[24, 16]}>
          <Col span={12}>
            <label style={labelStyle}>Token 过期时间</label>
            <InputNumber
              min={60}
              max={2592000}
              value={config.token_expire_seconds}
              onChange={(v) => updateField('token_expire_seconds', v)}
              suffix="秒"
              style={{ width: '100%', ...inputStyle }}
            />
            <div style={hintStyle}>默认 86400 秒（24小时）</div>
          </Col>
          <Col span={12}>
            <label style={labelStyle}>会话超时时间</label>
            <InputNumber
              min={60}
              max={86400}
              value={config.session_timeout_seconds}
              onChange={(v) => updateField('session_timeout_seconds', v)}
              suffix="秒"
              style={{ width: '100%', ...inputStyle }}
            />
            <div style={hintStyle}>默认 7200 秒（2小时）</div>
          </Col>
          <Col span={12}>
            <label style={labelStyle}>最大登录尝试次数</label>
            <InputNumber
              min={1}
              max={20}
              value={config.max_login_attempts}
              onChange={(v) => updateField('max_login_attempts', v)}
              style={{ width: '100%', ...inputStyle }}
            />
            <div style={hintStyle}>超过此次数将锁定账号，默认 5 次</div>
          </Col>
          <Col span={12}>
            <label style={labelStyle}>登录锁定分钟数</label>
            <InputNumber
              min={5}
              max={1440}
              value={config.login_lockout_minutes}
              onChange={(v) => updateField('login_lockout_minutes', v)}
              suffix="分钟"
              style={{ width: '100%', ...inputStyle }}
            />
            <div style={hintStyle}>锁定后需等待的时间，默认 30 分钟</div>
          </Col>
        </Row>
      </Card>

      <Card
        title={<><ApiOutlined style={{ color: '#165DFF', marginRight: 8 }} />接口白名单配置</>}
        size="small"
        style={cardStyle}
      >
        <label style={labelStyle}>白名单路径</label>
        <TextArea
          rows={5}
          value={config.api_whitelist}
          onChange={(e) => updateField('api_whitelist', e.target.value)}
          placeholder={'每行一个路径，例如：\n/api/auth/login/\n/api/auth/register/\n/api/front/'}
          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13 }}
        />
        <div style={hintStyle}>这些接口无需 Token 校验即可访问，请谨慎配置</div>
      </Card>

      <Card
        title={<><LockOutlined style={{ color: '#165DFF', marginRight: 8 }} />密码规则 & 初始密码配置</>}
        size="small"
        style={cardStyle}
      >
        <Row gutter={[24, 16]}>
          <Col span={12}>
            <label style={labelStyle}>密码最小长度</label>
            <InputNumber
              min={6}
              max={32}
              value={config.password_min_length}
              onChange={(v) => updateField('password_min_length', v)}
              style={{ width: '100%', ...inputStyle }}
            />
            <div style={hintStyle}>默认最少 8 个字符</div>
          </Col>
          <Col span={12}>
            <label style={labelStyle}>初始默认密码</label>
            <Input.Password
              value={config.default_password}
              onChange={(e) => updateField('default_password', e.target.value)}
              placeholder="设置新用户的初始密码"
              style={{ ...inputStyle }}
            />
            <div style={hintStyle}>新用户注册或重置时的默认密码，当前值：{config.default_password || '(未设置)'}</div>
          </Col>
        </Row>
        <Divider style={{ margin: '16px 0' }} />
        <label style={{ ...labelStyle, marginBottom: 12 }}>密码复杂度要求</label>
        <Row gutter={[24, 12]}>
          <Col span={6}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checkedChildren="是"
                unCheckedChildren="否"
                checked={!!config.password_require_uppercase}
                onChange={(v) => updateField('password_require_uppercase', v)}
              />
              <Text style={{ color: '#1D2129' }}>需要大写字母</Text>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checkedChildren="是"
                unCheckedChildren="否"
                checked={!!config.password_require_lowercase}
                onChange={(v) => updateField('password_require_lowercase', v)}
              />
              <Text style={{ color: '#1D2129' }}>需要小写字母</Text>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checkedChildren="是"
                unCheckedChildren="否"
                checked={!!config.password_require_digit}
                onChange={(v) => updateField('password_require_digit', v)}
              />
              <Text style={{ color: '#1D2129' }}>需要数字</Text>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checkedChildren="是"
                unCheckedChildren="否"
                checked={!!config.password_require_special}
                onChange={(v) => updateField('password_require_special', v)}
              />
              <Text style={{ color: '#1D2129' }}>需要特殊字符</Text>
            </div>
          </Col>
        </Row>
      </Card>

      <Card
        title={<><ToolOutlined style={{ color: '#165DFF', marginRight: 8 }} />系统维护操作</>}
        size="small"
        style={cardStyle}
      >
        <Row gutter={[24, 16]} align="middle">
          <Col span={12}>
            <label style={labelStyle}>日志自动清理周期</label>
            <InputNumber
              min={7}
              max={365}
              value={config.log_retention_days}
              onChange={(v) => updateField('log_retention_days', v)}
              suffix="天"
              style={{ width: '100%', ...inputStyle }}
            />
            <div style={hintStyle}>自动清理超过此天数的日志记录，默认 90 天</div>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Space size="middle">
              <Button
                icon={<SaveOutlined />}
                type="primary"
                loading={saving}
                onClick={handleSaveAll}
                style={{ borderRadius: 6, background: '#165DFF', borderColor: '#165DFF' }}
              >
                保存所有配置
              </Button>
              <Popconfirm
                title="确定要刷新系统缓存吗？"
                description="刷新后部分配置将立即生效"
                onConfirm={handleRefreshCache}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  icon={<ReloadOutlined />}
                  loading={refreshing}
                  style={{ borderRadius: 6 }}
                >
                  刷新系统缓存
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确定要清理过期日志吗？"
                description={'将清理 ' + (config.log_retention_days || 90) + ' 天前的所有过期日志，此操作不可恢复'}
                onConfirm={handleCleanupLogs}
                okText="确定清理"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={cleaningUp}
                  style={{ borderRadius: 6 }}
                >
                  清理过期日志
                </Button>
              </Popconfirm>
            </Space>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Checkbox, Typography, App, Tabs } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/useAuthStore';
import { authApi } from '@/api/auth';
import logoImg from '@/assets/logo.png';
import ParticleNetwork from '@/pages/brandhome/components/ParticleNetwork';
import './Login.css';

const { Text } = Typography;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const { message } = App.useApp();

  const onLoginFinish = async (values: { username: string; password: string; remember: boolean }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      if (values.remember) {
        localStorage.setItem('remembered_username', values.username);
      } else {
        localStorage.removeItem('remembered_username');
      }
      message.success('登录成功');
      // 所有登录用户都进入后台，RBAC 通过侧边菜单权限控制可见功能
      const from = (location.state as any)?.from || '/admin';
      navigate(from, { replace: true });
    } catch (error: any) {
      const msg = error?.response?.data?.detail || error?.response?.data?.message || error?.message || '登录失败，请检查用户名和密码';
      if (error?.response?.data?.username) {
        message.error(String(error.response.data.username[0]));
      } else if (error?.response?.data?.password) {
        message.error(String(error.response.data.password[0]));
      } else if (error?.response?.data?.confirm_password) {
        message.error(String(error.response.data.confirm_password[0]));
      } else {
        message.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onRegisterFinish = async (values: { username: string; password: string; confirm_password: string; email?: string }) => {
    setRegisterLoading(true);
    try {
      await authApi.register({
        username: values.username,
        password: values.password,
        confirm_password: values.confirm_password,
        email: values.email,
        privacy_agreed: true,
      });
      message.success('注册成功！请使用新账号登录');
      setActiveTab('login');
      // 注册成功即视为已同意隐私协议，不再弹窗
      if (typeof window !== 'undefined') {
        localStorage.setItem('privacy_consent', 'true');
        localStorage.setItem('privacy_consent_time', new Date().toISOString());
      }
    } catch (error: any) {
      const errData = error?.response?.data;
      if (errData?.username) {
        message.error(String(errData.username[0]));
      } else if (errData?.password) {
        message.error(String(errData.password[0]));
      } else if (errData?.confirm_password) {
        message.error(String(errData.confirm_password[0]));
      } else {
        message.error(errData?.message || errData?.detail || '注册失败，请稍后重试');
      }
    } finally {
      setRegisterLoading(false);
    }
  };

  const rememberedUsername = localStorage.getItem('remembered_username') || '';
  // 支持 ?tab=register&username=xxx：桌面端降级跳转「先设置密码」时预填注册页与用户名
  const queryTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
  const queryUsername = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('username') || '') : '';
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(queryTab === 'register' ? 'register' : 'login');

  return (
    <div className="login-page">
      {/* ===== 左侧品牌区 — Hero 风格 ===== */}
      <div className="login-left">
        {/* 粒子网络背景 */}
        <ParticleNetwork />

        {/* 渐变遮罩层 */}
        <div className="left-overlay" />

        {/* 内容区 */}
        <motion.div
          className="left-inner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          {/* Logo */}
          <motion.div
            className="left-logo-wrap"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <img src={logoImg} alt="一鉴到底" className="left-logo" />
          </motion.div>

          {/* 品牌名 */}
          <motion.h1
            className="left-title"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            一鉴到底
          </motion.h1>

          <motion.p
            className="left-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            AI Agent行为安全平台
          </motion.p>

          {/* 核心主张 */}
          <motion.div
            className="left-claim"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
          >
            <p className="claim-zh">从内容检测到行为检测</p>
            <p className="claim-en">From content detection to behavior detection</p>
          </motion.div>

          {/* 三段式价值主张 — Coze 经典模式 */}
          <motion.div
            className="left-values"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            {[
              {
                title: '代码不再是黑盒',
                desc: '每一行都有多类型智能体在守护，全链路可追溯、可验证。',
              },
              {
                title: '校验不再是孤岛',
                desc: '代码检测、风险识别、合规审计等智能体互相发现、互相成就。',
              },
              {
                title: '安全一鉴到底',
                desc: '关于多智能体能做什么，可能比你想的更多。',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                className={`value-card ${i === 2 ? 'value-card-highlight' : ''}`}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.9 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
              >
                <h3 className="value-title">{item.title}</h3>
                <p className="value-desc">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* 底部诗意文案 */}
          <motion.div
            className="left-poetry"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.5 }}
          >
            <p className="poetry-line poetry-dim">
              我们曾以为安全校验只有一种方式。
            </p>
            <p className="poetry-line poetry-light">
              现在我们知道，不是。
            </p>
            <p className="poetry-brand">Where agents verify, trust begins.</p>
          </motion.div>
        </motion.div>
      </div>

      {/* ===== 右侧表单区（保持不变）===== */}
      <div className="login-right">
        <div className="right-form-area">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'login' | 'register')}
            centered
            size="middle"
            items={[
              {
                key: 'login',
                label: '账号登录',
                children: (
                  <>
                    <Text className="form-subtitle">欢迎回来，请登录您的账户</Text>
                    <Form
                      name="login"
                      initialValues={{ remember: true, username: rememberedUsername }}
                      onFinish={onLoginFinish}
                      autoComplete="off"
                      size="large"
                      layout="vertical"
                    >
                      <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                        <Input prefix={<UserOutlined />} placeholder="用户名" />
                      </Form.Item>

                      <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                        <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                      </Form.Item>

                      <Form.Item>
                        <div className="login-form-options">
                          <Form.Item name="remember" valuePropName="checked" noStyle>
                            <Checkbox>记住登录状态</Checkbox>
                          </Form.Item>
                          <a href="#!" className="forgot-link">忘记密码？</a>
                        </div>
                      </Form.Item>

                      <Form.Item style={{ marginBottom: 0 }}>
                        <Button type="primary" htmlType="submit" loading={loading} block className="login-btn">
                          登 录
                        </Button>
                      </Form.Item>
                    </Form>
                  </>
                ),
              },
              {
                key: 'register',
                label: '注册账号',
                children: (
                  <>
                    <Text className="form-subtitle">创建新账户，加入一鉴到底</Text>
                    <Form
                      name="register"
                      onFinish={onRegisterFinish}
                      autoComplete="off"
                      size="large"
                      layout="vertical"
                      initialValues={{ username: queryUsername || undefined }}
                    >
                      <Form.Item name="username" rules={[
                        { required: true, message: '请输入用户名' },
                        { min: 3, message: '用户名至少3个字符' },
                      ]}>
                        <Input prefix={<UserOutlined />} placeholder="用户名（字母/数字/下划线/中文）" />
                      </Form.Item>

                      <Form.Item name="email" rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}>
                        <Input prefix={<MailOutlined />} placeholder="邮箱（选填）" />
                      </Form.Item>

                      <Form.Item name="password" rules={[
                        { required: true, message: '请输入密码' },
                        { min: 8, message: '密码至少8个字符' },
                      ]}>
                        <Input.Password prefix={<LockOutlined />} placeholder="密码（至少8位）" />
                      </Form.Item>

                      <Form.Item name="confirm_password" dependencies={['password']} rules={[
                        { required: true, message: '请确认密码' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue('password') === value) {
                              return Promise.resolve();
                            }
                            return Promise.reject(new Error('两次输入的密码不一致'));
                          },
                        }),
                      ]}>
                        <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
                      </Form.Item>

                      {/* 隐私协议 & 用户条款 */}
                      <Form.Item
                        name="agreement"
                        valuePropName="checked"
                        rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('请阅读并同意隐私政策和用户协议')) }]}
                      >
                        <Checkbox
                          className="register-agreement"
                          onChange={(e) => {
                            // 勾选时立即写入，关闭全局 PrivacyAgreementModal 弹窗
                            if (e.target.checked && typeof window !== 'undefined') {
                              localStorage.setItem('privacy_consent', 'true');
                              localStorage.setItem('privacy_consent_time', new Date().toISOString());
                            }
                          }}
                        >
                          我已阅读并同意{' '}
                          <a href="/privacy" target="_blank" rel="noreferrer">《隐私政策》</a>
                          {' '}和{' '}
                          <a href="/terms" target="_blank" rel="noreferrer">《用户服务协议》</a>
                        </Checkbox>
                      </Form.Item>

                      <Form.Item style={{ marginBottom: 0 }}>
                        <Button type="primary" htmlType="submit" loading={registerLoading} block className="login-btn">
                          注 册
                        </Button>
                      </Form.Item>
                    </Form>
                  </>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
};

export default Login;

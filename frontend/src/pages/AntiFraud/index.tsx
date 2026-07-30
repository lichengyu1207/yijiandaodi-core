import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { Card, Button, Tag, Modal, Input, Select, message, Table, Progress, Row, Col, Alert, Empty, Badge, Statistic, Space, Tooltip, Segmented, Result, Spin, Typography, Divider, Timeline, Descriptions, Popconfirm } from 'antd';
import {
  ShieldAlert, ShieldCheck, CheckCircle2,
  Bot, Fingerprint, Monitor, Globe, Lock, Ban, Unlock,
  Activity, Radar, Users, UserX, Clock, Zap,
  Eye, Search, RefreshCw, AlertTriangle, Crosshair,
  Server, Wifi, WifiOff, MapPin, Cpu,
  ChevronRight, PlayCircle, Download, Settings,
  ScanLine, FileSearch, Gavel, TrendingUp, TrendingDown,
  Database, Network, UserCheck, UserMinus, Target,
} from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import {
  antiFraudApi, type AntiFraudEvent, type FraudRuleItem,
  type UserRiskProfileItem, type DashboardStats,
} from '@/api/antiFraudApi';
import { useAuthStore } from '@/store/useAuthStore';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  info: { color: '#165DFF', bg: '#E8F3FF', icon: <Info size={14} />, label: '信息' },
  low: { color: '#86909C', bg: '#F2F3F5', icon: <Info size={14} />, label: '低风险' },
  medium: { color: '#FA8C16', bg: '#FFF7E8', icon: <AlertTriangle size={14} />, label: '中风险' },
  high: { color: '#FF7D00', bg: '#FFF0E6', icon: <AlertTriangle size={14} />, label: '高风险' },
  critical: { color: '#F53F3F', bg: '#FFECE8', icon: <ShieldAlert size={14} />, label: '严重' },
};

function Info({ size = 12 }: { size?: number }) { return <Info size={size} />; }

const EVENT_TYPE_MAP: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  register: { icon: <UserCheck size={14} />, color: '#00B42A', label: '注册' },
  login: { icon: <Unlock size={14} />, color: '#165DFF', label: '登录' },
  login_failed: { icon: <Lock size={14} />, color: '#F53F3F', label: '登录失败' },
  logout: { icon: <LogOut size={14} />, color: '#86909C', label: '登出' },
  password_change: { icon: <Settings size={14} />, color: '#722ED1', label: '改密' },
  password_reset: { icon: <RefreshCw size={14} />, color: '#FA8C16', label: '重置密码' },
  suspicious_behavior: { icon: <AlertTriangle size={14} />, color: '#FF7D00', label: '可疑行为' },
  account_takeover_attempt: { icon: <ShieldAlert size={14} />, color: '#F53F3F', label: '接管尝试' },
  bulk_registration: { icon: <Users size={14} />, color: '#D9363E', label: '批量注册' },
  velocity_violation: { icon: <Zap size={14} />, color: '#FA8C16', label: '频率违规' },
  device_anomaly: { icon: <Monitor size={14} />, color: '#722ED1', label: '设备异常' },
  ip_reputation_alert: { icon: <Globe size={14} />, color: '#F472B6', label: 'IP信誉告警' },
};

function LogOut({ size }: { size?: number }) { return null as any; }

const ACTION_CONFIG: Record<string, { color: string; label: string }> = {
  none: { color: '#default', label: '无动作' },
  pass: { color: 'green', label: '放行' },
  challenge: { color: 'orange', label: '验证码' },
  step_up_auth: { color: 'blue', label: '增强认证' },
  block: { color: 'red', label: '拦截' },
  freeze_account: { color: 'volcano', label: '冻结账号' },
  flag_for_review: { color: 'gold', label: '标记待审' },
};

const RISK_LEVEL_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  trusted: { color: '#00B42A', bg: '#E8FFEA', label: '可信用户' },
  normal: { color: '#165DFF', bg: '#E8F3FF', label: '正常用户' },
  watched: { color: '#FA8C16', bg: '#FFF7E8', label: '关注用户' },
  suspicious: { color: '#FF7D00', bg: '#FFF0E6', label: '可疑用户' },
  restricted: { color: '#F53F3F', bg: '#FFECE8', label: '受限用户' },
  banned: { color: '#D9363E', bg: '#FFF1F0', label: '封禁用户' },
};

export default function AntiFraudPage() {
  const { isAuthenticated, user } = useAuthStore();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const [events, setEvents] = useState<AntiFraudEvent[]>([]);
  const [rules, setRules] = useState<FraudRuleItem[]>([]);
  const [profiles, setProfiles] = useState<UserRiskProfileItem[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events' | 'rules' | 'profiles'>('dashboard');
  const [eventFilter, setEventFilter] = useState({ event_type: '', severity: '', hours: '24' });
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionUserId, setActionUserId] = useState('');
  const [actionType, setActionType] = useState('freeze');
  const [actionReason, setActionReason] = useState('');
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<AntiFraudEvent | null>(null);

  useEffect(() => { loadDashboard(); loadRules(); if (isAdmin) loadProfiles(); }, []);

  async function loadDashboard() {
    try {
      const res = await antiFraudApi.events.dashboardStats();
      setDashboardStats(res.data);
      setEvents(res.data.recent_critical_events || []);
    } catch {}
  }

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await antiFraudApi.events.list(eventFilter);
      setEvents(Array.isArray(res.data.results) ? res.data.results : Array.isArray(res.data) ? res.data : []);
    } catch { setEvents([]); }
    setLoading(false);
  }

  async function loadRules() {
    try {
      const res = await antiFraudApi.rules.activeRules();
      setRules(Array.isArray(res.data) ? res.data : []);
    } catch {}
  }

  async function loadProfiles() {
    try {
      const res = await antiFraudApi.profiles.highRiskUsers();
      setProfiles(Array.isArray(res.data.results) ? res.data.results : Array.isArray(res.data) ? res.data : []);
    } catch {}
  }

  async function handleTakeAction() {
    if (!actionUserId) return;
    try {
      await antiFraudApi.events.takeAction({
        action_type: actionType,
        user_id: actionUserId,
        reason: actionReason,
        duration_hours: 24,
      });
      message.success(`已执行操作: ${actionType}`);
      setActionModalOpen(false); setActionReason(''); setActionUserId('');
      loadProfiles(); loadDashboard(); loadEvents();
    } catch (e: any) {
      message.error(e.response?.data?.error || e.response?.data?.detail || '操作失败');
    }
  }

  function openEventDetail(evt: AntiFraudEvent) { setCurrentEvent(evt); setEventDetailOpen(true); }

  const eventColumns: ColumnsType<AntiFraudEvent> = [
    { title: '时间', dataIndex: 'created_at', width: 160, defaultSortOrder: 'descend',
      render: (t: string) => <span style={{ fontSize: 12 }}>{t ? new Date(t).toLocaleString('zh-CN') : '-'}</span> },
    { title: '事件类型', width: 110, render: (_, r) => {
      const et = EVENT_TYPE_MAP[r.event_type];
      return et ? <Tag color={et.color} style={{ borderRadius: 4 }}>{et.icon} {et.label}</Tag> : <Tag>{r.event_type_display}</Tag>;
    }},
    { title: '严重度', width: 85, render: (_, r) => {
      const sc = SEVERITY_CONFIG[r.severity];
      return sc ? <Tag color={sc.color} style={{ borderRadius: 4, fontWeight: 600 }}>{sc.label}</Tag> : '-';
    }},
    { title: '处置', width: 80, render: (_, r) => {
      const ac = ACTION_CONFIG[r.action_taken];
      return ac ? <Tag color={ac.color}>{ac.label}</Tag> : r.action_taken;
    }},
    { title: '风险分', width: 70, align: 'center', render: (_, r) =>
      <Progress type="circle" percent={Math.min(r.risk_score, 100)} size={36}
        strokeColor={r.risk_score >= 70 ? '#F53F3F' : r.risk_score >= 40 ? '#FA8C16' : '#00B42A'}
        format={() => ''} />
    },
    { title: 'IP地址', width: 130, render: (_, r) => (
      <Tooltip title={`代理检测 / 数据中心IP / Tor节点`}>
        <code style={{ fontSize: 12, background: '#F2F3F5', padding: '1px 6px', borderRadius: 4 }}>{r.ip_address || '-'}</code>
      </Tooltip>
    )},
    { title: '触发规则', width: 140, render: (_, r) =>
      <div>{(r.triggered_rules || []).slice(0, 3).map((rule: string, i: number) =>
        <Tag key={i} color="purple" style={{ borderRadius: 4, fontSize: 10, marginBottom: 2, display: 'inline-block', marginRight: 2 }}>{rule}</Tag>
      )}
      {(r.triggered_rules || []).length > 3 && <Tag style={{ borderRadius: 4, fontSize: 10 }}>+{(r.triggered_rules || []).length - 3}</Tag>}
      </div>,
    },
    { title: '拦截', width: 60, align: 'center', render: (_, r) =>
      r.is_blocked ? <Ban size={16} color="#F53F3F" /> : <CheckCircle2 size={14} color="#00B42A" />,
    },
    { title: '操作', width: 70, fixed: 'right', render: (_, r) => <Button type="link" size="small" icon={<Eye />} onClick={() => openEventDetail(r)}>详情</Button> },
  ];

  const profileColumns: ColumnsType<UserRiskProfileItem> = [
    { title: '用户', width: 140, render: (_, r) => (
      <div><strong style={{ fontSize: 13 }}>{r.username}</strong><div style={{ fontSize: 11, color: '#86909C' }}>{r.email || '-'}</div></div>
    )},
    { title: '风险等级', width: 110, render: (_, r) => {
      const rc = RISK_LEVEL_CONFIG[r.risk_level];
      return rc ? <Tag color={rc.color} style={{ borderRadius: 6, fontWeight: 700 }}>{rc.label}</Tag> : '-';
    }},
    { title: '综合评分', width: 100, render: (_, r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Progress type="circle" percent={r.overall_risk_score} size={40}
          strokeColor={r.overall_risk_score >= 70 ? '#F53F3F' : r.overall_risk_score >= 40 ? '#FA8C16' : '#00B42A'}
          format={(p) => <span style={{ fontSize: 11, fontWeight: 800 }}>{p}</span>} />
      </div>
    )},
    { title: '6维分解', width: 220, render: (_, r) => (
      <Space size={2}>
        <Tooltip title="注册"><Tag color={r.registration_risk_score > 50 ? 'red' : 'green'} style={{ borderRadius: 4, fontSize: 10 }}>注册{r.registration_risk_score.toFixed(0)}</Tag></Tooltip>
        <Tooltip title="登录"><Tag color={r.login_risk_score > 50 ? 'red' : 'green'} style={{ borderRadius: 4, fontSize: 10 }}>登录{r.login_risk_score.toFixed(0)}</Tag></Tooltip>
        <Tooltip title="行为"><Tag color={r.behavior_risk_score > 50 ? 'red' : 'green'} style={{ borderRadius: 4, fontSize: 10 }}>行为{r.behavior_risk_score.toFixed(0)}</Tag></Tooltip>
        <Tooltip title="设备"><Tag color={r.device_risk_score > 50 ? 'red' : 'green'} style={{ borderRadius: 4, fontSize: 10 }}>设备{r.device_risk_score.toFixed(0)}</Tag></Tooltip>
        <Tooltip title="IP"><Tag color={r.ip_risk_score > 50 ? 'red' : 'green'} style={{ borderRadius: 4, fontSize: 10 }}>IP{r.ip_risk_score.toFixed(0)}</Tag></Tooltip>
        <Tooltip title="频率"><Tag color={r.velocity_risk_score > 50 ? 'red' : 'green'} style={{ borderRadius: 4, fontSize: 10 }}>频率{r.velocity_risk_score.toFixed(0)}</Tag></Tooltip>
      </Space>
    )},
    { title: '状态', width: 120, render: (_, r) => (
      <Space size={2}>
        {r.is_frozen && <Tag color="volcano" style={{ borderRadius: 4 }}><Lock size={10} /> 冻结</Tag>}
        {r.requires_mfa && <Tag color="blue" style={{ borderRadius: 4 }}><ShieldCheck size={10} /> MFA</Tag>}
        <Tag color={r.blocked_events > 0 ? 'red' : 'default'} style={{ borderRadius: 4 }}>拦截{r.blocked_events}</Tag>
      </Space>
    )},
    { title: '事件/拦截', width: 90, render: (_, r) => <span style={{ fontSize: 12 }}>{r.total_events}/{r.blocked_events}</span> },
    { title: '管理操作', width: 180, fixed: 'right', render: (_, r) => (
      <Space size={4}>
        <Popconfirm title={`确定冻结用户 ${r.username}?`} onConfirm={() => {
          setActionUserId(String(r.user)); setActionType('freeze'); setActionReason('管理员手动冻结'); handleTakeAction();
        }}>
          <Button size="small" danger icon={<Ban />} disabled={r.is_frozen}>冻结</Button>
        </Popconfirm>
        <Popconfirm title={`确定解冻用户 ${r.username}?`} onConfirm={() => {
          setActionUserId(String(r.user)); setActionType('unfreeze'); setActionReason('管理员手动解冻'); handleTakeAction();
        }}>
          <Button size="small" icon={<Unlock />} disabled={!r.is_frozen}>解冻</Button>
        </Popconfirm>
        <Button size="small" type="link" onClick={() => { setActionUserId(String(r.user)); setActionModalOpen(true); }}>更多</Button>
      </Space>
    )},
  ];

  const stats = dashboardStats?.events;
  const profs = dashboardStats?.user_profiles;

  return (
    <div style={{ padding: '20px 32px', maxWidth: 1540, margin: '0 auto', background: '#F2F3F5', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{
        textAlign: 'center', marginBottom: 24, padding: '28px 24px',
        background: 'linear-gradient(135deg, #0a0f1a 0%, #0d1b2a 25%, #1b263b 50%, #16213e 75%, #0f172a 100%)',
        borderRadius: 16, color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, right: '10%', width: 350, height: 350, background: 'rgba(245,63,63,0.05)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -60, left: '5%', width: 400, height: 400, background: 'rgba(22,93,255,0.04)', borderRadius: '50%' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <ShieldAlert size={26} color="#F53F3F" />
            <Radar size={22} color="#4FC3F7" />
            <Tag color="#F53F3F" style={{ borderRadius: 20, fontWeight: 800, border: 'none', color: '#0a0f1a', fontSize: 13 }}>Security v2.0</Tag>
          </div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, letterSpacing: 0.5 }}>账号反欺诈与异常行为检测</h1>
          <p style={{ margin: '8px 0 0', fontSize: 15, opacity: 0.9, maxWidth: 800, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 }}>
            8维度实时风控引擎 · 设备指纹识别 · 行为生物分析 · 关联图谱挖掘
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              ['设备指纹', <Fingerprint />], ['IP信誉', <Globe />], ['行为分析', <Activity />],
              ['频率检测', <Zap />], ['规则引擎', <Gavel />], ['实时拦截', <Ban />],
              ['关联图谱', <Network />], ['画像评估', <Target />],
            ].map(([label, icon], i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                background: 'rgba(255,255,255,0.07)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)',
                fontSize: 12.5, fontWeight: 500,
              }}>{icon}<span>{label}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <Segmented
        value={activeTab}
        onChange={(v) => { setActiveTab(v as any); if (v === 'events') loadEvents(); }}
        block size="large"
        style={{ marginBottom: 18, borderRadius: 10, padding: 4, background: '#fff' }}
        options={[
          { label: <span><Radar size={14} /> 实时监控台</span>, value: 'dashboard' },
          { label: <span><Activity size={14} /> 风险事件流 ({events.length})</span>, value: 'events' },
          { label: <span><Settings size={14} /> 风控规则 ({rules.length})</span>, value: 'rules' },
          ...(isAdmin ? [{ label: <span><Users size={14} /> 用户画像</span>, value: 'profiles' }] : []),
        ]}
      />

      {/* ===== TAB: DASHBOARD ===== */}
      {activeTab === 'dashboard' && (
        <>
          {/* Top Stats Row */}
          <Row gutter={[14, 14]} style={{ marginBottom: 18 }}>
            {[
              { label: '24h总事件', value: stats?.total_24h || 0, icon: Activity, color: '#165DFF', bg: '#E8F3FF' },
              { label: '拦截事件', value: stats?.blocked_24h || 0, icon: Ban, color: '#F53F3F', bg: '#FFECE8' },
              { label: '严重告警', value: stats?.critical_24h || 0, icon: ShieldAlert, color: '#D9363E', bg: '#FFF1F0' },
              { label: '高风险', value: stats?.high_24h || 0, icon: AlertTriangle, color: '#FF7D00', bg: '#FFF0E6' },
              { label: '平均风险分', value: typeof stats?.avg_risk_score === 'number' ? stats.avg_risk_score.toFixed(1) : '-', icon: Gauge, color: stats?.avg_risk_score > 50 ? '#F53F3F' : '#00B42A', bg: stats?.avg_risk_score > 50 ? '#FFECE8' : '#E8FFEA' },
            ].map((card, i) => (
              <Col xs={12} sm={8} md={4} key={i}>
                <Card size="small" style={{ borderRadius: 10, borderLeft: `4px solid ${card.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <card.icon size={17} style={{ color: card.color }} />
                    </div>
                    <div><div style={{ fontSize: 24, fontWeight: 800, color: '#1D2129' }}>{card.value}</div>
                      <div style={{ fontSize: 11, color: '#86909C' }}>{card.label}</div></div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[18, 18]}>
            {/* Left: User Profile Distribution + Top IPs */}
            <Col xs={24} lg={12}>
              <Card size="small" title={<span style={{ fontSize: 14, fontWeight: 700 }}>👥 用户风险分布</span>} style={{ borderRadius: 10, marginBottom: 18 }}>
                <Row gutter={[10, 10]}>
                  {[
                    { key: 'trusted', label: '可信用户', color: '#00B42A' },
                    { key: 'normal', label: '正常用户', color: '#165DFF' },
                    { key: 'watched', label: '关注用户', color: '#FA8C16' },
                    { key: 'suspicious', label: '可疑用户', color: '#FF7D00' },
                    { key: 'restricted', label: '受限用户', color: '#F53F3F' },
                    { key: 'banned', label: '封禁用户', color: '#D9363E' },
                    { key: 'frozen', label: '冻结用户', color: '#FAAD14' },
                  ].map(({ key, label, color }) => (
                    <Col span={8} key={key}>
                      <div style={{ textAlign: 'center', padding: '10px 8px', background: `${color}10`, borderRadius: 8, marginBottom: 6 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color }}>{profs?.[key] ?? 0}</div>
                        <div style={{ fontSize: 11.5, color: '#86909C' }}>{label}</div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>

              <Card size="small" title={<span style={{ fontSize: 14, fontWeight: 700 }}>🌐 高风险 IP TOP10</span>} style={{ borderRadius: 10 }}>
                {(dashboardStats?.top_risk_ips || []).length > 0 ? (
                  <div>
                    {(dashboardStats.top_risk_ips as Array<{ ip: string; count: number }>).map((item, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 10px', borderBottom: i < 9 ? '1px solid #F0F0F0' : 'none',
                        fontSize: 13,
                      }}>
                        <code style={{ background: '#FFF1F0', padding: '2px 8px', borderRadius: 4, color: '#F53F3F', fontSize: 12 }}>{item.ip}</code>
                        <Badge count={item.count} style={{ backgroundColor: item.count > 20 ? '#F53F3F' : item.count > 5 ? '#FF7D00' : '#FA8C16', boxShadow: 'none' }} />
                      </div>
                    ))}
                  </div>
                ) : <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '30px 0' }} />}
              </Card>
            </Col>

            {/* Right: Event Type Breakdown + Recent Critical Events */}
            <Col xs={24} lg={12}>
              <Card size="small" title={<span style={{ fontSize: 14, fontWeight: 700 }}>📊 事件类型分布</span>} style={{ borderRadius: 10, marginBottom: 18 }}>
                {stats?.by_event_type && Object.keys(stats.by_event_type).length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {Object.entries(stats.by_event_type).map(([type, count]: [string, any], i) => {
                      const et = EVENT_TYPE_MAP[type];
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                          background: '#FAFBFC', borderRadius: 10, border: `1px solid ${et?.color || '#E5E6EB'}40`,
                        }}>
                          {et?.icon || <Activity size={14} />}
                          <strong style={{ fontSize: 14, color: et?.color || '#4E5969' }}>{count}</strong>
                          <span style={{ fontSize: 12, color: '#86909C' }}>{et?.label || type}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : <Empty description="暂无数据" />}
              </Card>

              <Card size="small"
                title={<span style={{ fontSize: 14, fontWeight: 700 }}>🚨 最近严重/高风险事件</span>}
                extra={<Button size="small" icon={<RefreshCw />} onClick={() => loadDashboard()}>刷新</Button>}
                style={{ borderRadius: 10 }}
              >
                {events.length > 0 ? (
                  <Timeline
                    mode="left"
                    items={events.slice(0, 8).map((evt) => ({
                      color: evt.severity === 'critical' ? '#F53F3F' : evt.severity === 'high' ? '#FF7D00' : '#FA8C16',
                      children: (
                        <div style={{ paddingBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <Tag color={SEVERITY_CONFIG[evt.severity]?.color || '#86909C'} style={{ borderRadius: 4, fontSize: 11 }}>
                              {SEVERITY_CONFIG[evt.severity]?.label || evt.severity}
                            </Tag>
                            <Tag color={ACTION_CONFIG[evt.action_taken]?.color || 'default'} style={{ borderRadius: 4, fontSize: 11 }}>
                              {ACTION_CONFIG[evt.action_taken]?.label || evt.action_taken}
                            </Tag>
                            <span style={{ fontSize: 11, color: '#86909C' }}>风险分: {evt.risk_score.toFixed(0)}</span>
                          </div>
                          <div style={{ fontSize: 12.5, color: '#4E5969' }}>
                            {EVENT_TYPE_MAP[evt.event_type]?.icon || <Activity size={12} />}{' '}
                            {EVENT_TYPE_MAP[evt.event_type]?.label || evt.event_type_display} |{' '}
                            <code style={{ fontSize: 11, background: '#F2F3F5', padding: '0 4px', borderRadius: 3 }}>{evt.ip_address || '-'}</code>
                          </div>
                          <div style={{ fontSize: 11, color: '#C9CDD4', marginTop: 2 }}>
                            {new Date(evt.created_at).toLocaleString('zh-CN')}
                            {' '}<Button type="link" size="small" style={{ padding: 0, fontSize: 11, height: 20 }} onClick={() => openEventDetail(evt)}>详情 →</Button>
                          </div>
                        </div>
                      ),
                    }))}
                  />
                ) : <Empty description="暂无高风险事件 ✅" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />}
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* ===== TAB: EVENTS ===== */}
      {activeTab === 'events' && (
        <Card title={<span style={{ fontSize: 15, fontWeight: 700 }}>📋 全部风险事件流</span>} style={{ borderRadius: 14 }}
          extra={
            <Space>
              <Select value={eventFilter.hours} onChange={(v) => { setEventFilter({ ...eventFilter, hours: v }); setTimeout(() => loadEvents(), 100); }}
                size="small" style={{ width: 80 }}>
                <option value="1">1小时</option>
                <option value="6">6小时</option>
                <option value="24">24小时</option>
                <option value="168">7天</option>
              </Select>
              <Select value={eventFilter.severity} onChange={(v) => { setEventFilter({ ...eventFilter, severity: v }); setTimeout(() => loadEvents(), 100); }}
                allowClear size="small" placeholder="严重度" style={{ width: 100 }}>
                <option value="critical">严重</option>
                <option value="high">高风险</option>
                <option value="medium">中风险</option>
              </Select>
              <Select value={eventFilter.event_type} onChange={(v) => { setEventFilter({ ...eventFilter, event_type: v }); setTimeout(() => loadEvents(), 100); }}
                allowClear size="small" placeholder="事件类型" style={{ width: 130 }}>
                {Object.entries(EVENT_TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
              <Button size="small" icon={<RefreshCw />} onClick={() => loadEvents()}>刷新</Button>
            </Space>
          }
        >
          <Table columns={eventColumns} dataSource={events} rowKey="id" size="middle"
            pagination={{ pageSize: 12, showTotal: (t) => `共 ${t} 条`, showSizeChanger: false }}
            scroll={{ x: 1100 }} loading={loading} />
        </Card>
      )}

      {/* ===== TAB: RULES ===== */}
      {activeTab === 'rules' && (
        <Row gutter={[18, 18]}>
          {rules.map((rule, i) => (
            <Col xs={24} md={12} xl={8} key={i}>
              <Card size="small" style={{ borderRadius: 10, borderLeft: `4px solid ${
                rule.action === 'block' ? '#F53F3F' : rule.action === 'freeze' ? '#D9363E' :
                rule.action === 'challenge' ? '#FA8C16' : rule.action === 'step_up_auth' ? '#165DFF' : '#86909C'
              }` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <div>
                    <Tag color="#722ED1" style={{ borderRadius: 4, fontWeight: 700 }}>{rule.rule_code}</Tag>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{rule.rule_name}</div>
                  </div>
                  <Tag color={
                    rule.action === 'block' ? 'red' : rule.action === 'freeze' ? 'volcano' :
                    rule.action === 'challenge' ? 'orange' : rule.action === 'step_up_auth' ? 'blue' : 'default'
                  } style={{ borderRadius: 4 }}>{ACTION_CONFIG[rule.action]?.label || rule.action}</Tag>
                </div>
                <p style={{ fontSize: 12.5, color: '#4E5969', lineHeight: 1.6, marginBottom: 10, minHeight: 36 }}>{rule.description}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F0F0F0', paddingTop: 8, fontSize: 12, color: '#86909C' }}>
                  <span>优先级: <strong style={{ color: '#1D2129' }}>{rule.priority}</strong></span>
                  <span>命中: <strong style={{ color: '#165DFF' }}>{rule.hit_count}</strong></span>
                  <span>拦截: <strong style={{ color: '#F53F3F' }}>{rule.block_count}</strong></span>
                  <span>权重: <strong>{rule.weight}x</strong></span>
                </div>
              </Card>
            </Col>
          ))}
          {rules.length === 0 && (
            <Col span={24}><Empty description="暂无活跃的风控规则" image={Empty.PRESENTED_IMAGE_SIMPLE} /></Col>
          )}
        </Row>
      )}

      {/* ===== TAB: PROFILES ===== */}
      {activeTab === 'profiles' && isAdmin && (
        <Card title={<span style={{ fontSize: 15, fontWeight: 700 }}>👤 用户风险画像（高风险）</span>} style={{ borderRadius: 14 }}
          extra={<Space>
            <Button size="small" icon={<RefreshCw />} onClick={() => loadProfiles()}>刷新</Button>
            <Button size="small" type="primary" icon={<UserPlus />} onClick={() => setActionModalOpen(true)}>手动处置</Button>
          </Space>
        }>
          <Table columns={profileColumns} dataSource={profiles} rowKey="id" size="middle"
            pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 名高风险用户` }}
            scroll={{ x: 1100 }} />
        </Card>
      )}

      {/* ===== EVENT DETAIL MODAL ===== */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: '#F53F3F' }}>
          <ShieldAlert size={18} /> 风险事件详情 #{currentEvent?.id?.slice(-8)}
        </span>}
        open={eventDetailOpen} onCancel={() => setEventDetailOpen(false)} destroyOnHidden width={800}
        footer={[<Button key="close" type="primary" danger onClick={() => setEventDetailOpen(false)}>关闭</Button>]}
      >
        {currentEvent && (() => {
          const sc = SEVERITY_CONFIG[currentEvent.severity] || SEVERITY_CONFIG.info;
          return (
            <div>
              <div style={{ textAlign: 'center', padding: '18px', background: sc.bg, borderRadius: 12, marginBottom: 16, border: `1.5px solid ${sc.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
                  {sc.icon}
                  <span style={{ fontSize: 18, fontWeight: 800, color: sc.color }}>{sc.label}</span>
                  <Tag color={ACTION_CONFIG[currentEvent.action_taken]?.color || 'default'}>
                    处置: {ACTION_CONFIG[currentEvent.action_taken]?.label || currentEvent.action_taken}
                  </Tag>
                  {currentEvent.is_blocked && <Tag color="red"><Ban size={12} /> 已拦截</Tag>}
                </div>
                <Row gutter={[20, 8]} justify="center">
                  <Col><Statistic title="风险评分" value={currentEvent.risk_score} suffix="/100"
                    valueStyle={{ color: currentEvent.risk_score >= 70 ? '#F53F3F' : currentEvent.risk_score >= 40 ? '#FA8C16' : '#00B42A', fontWeight: 800 }} /></Col>
                  <Col><Statistic title="触发规则" value={currentEvent.triggered_rules?.length || 0} suffix="个"
                    valueStyle={{ color: '#722ED1', fontWeight: 800 }} /></Col>
                  <Col><Statistic title="处理耗时" value={currentEvent.processing_time_ms} suffix="ms"
                    valueStyle={{ color: '#86909C', fontWeight: 800 }} /></Col>
                </Row>
              </div>

              <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
                <Descriptions.Item label="事件类型">{EVENT_TYPE_MAP[currentEvent.event_type]?.label || currentEvent.event_type_display}</Descriptions.Item>
                <Descriptions.Item label="IP地址"><code>{currentEvent.ip_address || '-'}</code></Descriptions.Item>
                <Descriptions.Item label="请求路径">{currentEvent.request_path || '-'}</Descriptions.Item>
                <Descriptions.Item label="请求方法">{currentEvent.request_method}</Descriptions.Item>
                <Descriptions.Item label="尝试用户名">{currentEvent.username_attempted || '-'}</Descriptions.Item>
                <Descriptions.Item label="会话ID">{currentEvent.session_id || '-'}</Descriptions.Item>
                <Descriptions.Item label="拦截原因" span={2}>{currentEvent.block_reason || '-'}</Descriptions.Item>
              </Descriptions>

              {currentEvent.risk_indicators && currentEvent.risk_indicators.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Divider orientation="left" orientationMargin="0"><span style={{ fontSize: 13, fontWeight: 700 }}>⚡ 风险指标详情</span></Divider>
                  {currentEvent.risk_indicators.map((ind: Record<string, any>, i: number) => (
                    <div key={i} style={{
                      padding: '8px 12px', marginBottom: 6, borderRadius: 6,
                      background: ind.severity === 'critical' ? '#FFF1F0' : ind.severity === 'high' ? '#FFF7E8' : '#FAFBFC',
                      borderLeft: `3px solid ${SEVERITY_CONFIG[ind.severity]?.color || '#E5E6EB'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <strong style={{ fontSize: 13 }}>{ind.indicator_id}: {ind.title}</strong>
                        <Tag color={SEVERITY_CONFIG[ind.severity]?.color || 'default'} style={{ borderRadius: 4, fontSize: 10 }}>
                          {SEVERITY_CONFIG[ind.severity]?.label || ind.severity} (+{ind.score_impact})
                        </Tag>
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: '#4E5969' }}>{ind.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {currentEvent.user_agent && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>User-Agent:</Text>
                  <pre style={{ fontSize: 11, background: '#F7F8FA', padding: '8px 12px', borderRadius: 6, maxHeight: 80, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {currentEvent.user_agent.substring(0, 500)}
                  </pre>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* ===== ADMIN ACTION MODAL ===== */}
      <Modal
        title={<span style={{ fontWeight: 800, color: '#F53F3F' }}><Ban size={18} /> 管理员处置操作</span>}
        open={actionModalOpen} onCancel={() => setActionModalOpen(false)} onOk={handleTakeAction}
        okText="执行操作" cancelText="取消"
        destroyOnHidden width={480}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>目标用户ID</label>
          <Input value={actionUserId} onChange={(e) => setActionUserId(e.target.value)} placeholder="输入用户ID" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>处置类型</label>
          <Select value={actionType} onChange={(v) => setActionType(v)} style={{ width: '100%' }}>
            <option value="freeze">❄️ 冻结账号</option>
            <option value="unfreeze">🔓 解除冻结</option>
            <option value="ban">🚫 永久封禁</option>
            <option value="require_mfa">🛡️ 要求MFA认证</option>
            <option value="clear_mfa">✅ 取消MFA要求</option>
          </Select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>处置原因</label>
          <TextArea rows={3} value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="请填写处置原因（将记录到审计日志）" />
        </div>
        <Alert type="warning" showIcon message="此操作将被记录到审计日志，请谨慎操作。" />
      </Modal>
    </div>
  );
}

function Gauge({ size }: { size?: number }) { return <Activity size={size || 16} />; }
function UserPlus({ size }: { size?: number }) { return <Users size={size || 16} />; }

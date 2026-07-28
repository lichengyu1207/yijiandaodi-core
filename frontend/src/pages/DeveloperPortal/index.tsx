import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Key, Plus, Trash2, Copy, Eye, EyeOff, RefreshCw,
  BarChart3, Clock, Zap, Shield, Code, Terminal,
  CheckCircle2, AlertTriangle, ArrowRight, ExternalLink,
  Globe, Users, TrendingUp, Activity, Cpu, Lock,
  Coins, FileCode2, Server, Sparkles, ChevronRight,
} from 'lucide-react';
import { message, Modal, Tag, Tabs } from 'antd';

/* ── 品牌色 ─────────────────────────── */
const BRAND = {
  primary: '#0F766E',
  primaryLight: '#14B8A6',
  primaryDark: '#0D9488',
  accent: '#2563EB',
  amber: '#D97706',
  rose: '#E11D48',
  emerald: '#059669',
};

const API_ENDPOINTS = [
  {
    method: 'POST', path: '/api/p2p/v1/skills/list', name: 'Skill 列表查询',
    desc: '获取全部可用 Skill 元数据（公开接口）', color: BRAND.primaryLight, auth: false,
    example: `import requests

resp = requests.get("https://yijiandaodi.com/api/p2p/v1/skills/list")
data = resp.json()["data"]
for s in data["skills"]:
    print(f"{s['id']:20s} | {s['name']:12s} | ⭐{s['rating']}")`,
  },
  {
    method: 'GET', path: '/api/p2p/v1/skills/{id}/detail', name: 'Skill 详情获取',
    desc: '返回 Skill 完整 SKILL.md 内容 + 安装命令 + 下载链接', color: BRAND.accent, auth: false,
    example: `import requests

skill_id = "ass-gateway"
resp = requests.get(f"https://yijiandaodi.com/api/p2p/v1/skills/{skill_id}/detail")
data = resp.json()["data"]

print(f"名称:   {data['name']}")
print(f"版本:   {data.get('version')}")
print(f"安装:   {data['install_command']}")
print(f"\\n--- SKILL.md 预览 ---")
print(data["skill_md"][:500])`,
  },
  {
    method: 'GET', path: '/api/p2p/v1/skills/{id}/download', name: 'Skill ZIP 下载',
    desc: '动态生成 ZIP 包（README.md + SKILL.md + config.template.yaml）', color: BRAND.emerald, auth: false,
    example: `import requests

skill_id = "dag-orchestrator"
resp = requests.get(
    f"https://yijiandaodi.com/api/p2p/v1/skills/{skill_id}/download",
    stream=True,
)

with open(f"{skill_id}.zip", "wb") as f:
    for chunk in resp.iter_content(8192):
        f.write(chunk)

print(f"✅ 已下载 {skill_id}.zip")`,
  },
  {
    method: 'POST', path: '/api/open/detect/text', name: 'AI 文本检测',
    desc: '检测文本是否为 AI 生成（需 API Key）', color: BRAND.amber, auth: true,
    example: `import requests

API_KEY = "yjdp_your_key_here"
url = "https://yijiandaodi.com/api/open/detect/text"

response = requests.post(url, headers={
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}, json={
    "text": "这是一段需要检测的文本内容...",
    "scenario": "text",
})

result = response.json()
print(f"检测结果: {result['data']['levelText']}")
print(f"AI 概率:   {result['data']['aiProbability']}%")`,
  },
];

/* ── Styles ─────────────────────────── */
const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #F0FDFA 0%, #FFFFFF 40%)',
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '32px 24px 80px',
  },

  /* Hero 区域 */
  hero: {
    textAlign: 'center' as const,
    padding: '48px 0 40px',
    position: 'relative' as const,
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 16px',
    borderRadius: 20,
    background: `${BRAND.primary}10`,
    border: `1px solid ${BRAND.primary}25`,
    fontSize: 13,
    fontWeight: 600,
    color: BRAND.primaryDark,
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 'clamp(28px, 4vw, 40px)',
    fontWeight: 800,
    color: '#0F172A',
    marginBottom: 12,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#64748B',
    maxWidth: 600,
    margin: '0 auto 28px',
    lineHeight: 1.7,
  },
  heroActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 28px',
    borderRadius: 12,
    background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryLight})`,
    color: '#FFF',
    border: 'none',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    boxShadow: `0 4px 16px ${BRAND.primary}30`,
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 28px',
    borderRadius: 12,
    background: '#FFF',
    color: '#334155',
    border: '1.5px solid #E2E8F0',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.25s ease',
  },

  /* 统计卡片 */
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 36,
  },
  statCard: (accent: string) => ({
    background: '#FFF',
    borderRadius: 16,
    border: '1px solid rgba(0,0,0,0.06)',
    padding: '22px 20px',
    position: 'relative' as const,
    overflow: 'hidden',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  }),
  statIconWrap: (accent: string) => ({
    width: 42,
    height: 42,
    borderRadius: 12,
    background: `${accent}10`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    color: accent,
  }),
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    color: '#0F172A',
    lineHeight: 1,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: 500,
  },

  /* Tab 导航 */
  tabNav: {
    display: 'flex',
    gap: 4,
    background: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 28,
  },
  tabBtn: (active: boolean) => ({
    flex: 1,
    padding: '11px 20px',
    borderRadius: 11,
    border: 'none',
    background: active ? '#FFF' : 'transparent',
    color: active ? BRAND.primaryDark : '#64748B',
    fontSize: 14,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  }),

  /* 密钥卡片 */
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: '#0F172A',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  createBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 20px',
    borderRadius: 10,
    background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryLight})`,
    color: '#FFF',
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  keyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
    gap: 16,
  },
  keyCard: {
    background: '#FFF',
    borderRadius: 16,
    border: '1px solid rgba(0,0,0,0.06)',
    padding: '22px',
    transition: 'box-shadow 0.2s ease',
  },
  keyTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  keyName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#0F172A',
    marginBottom: 4,
  },
  keyValueBox: {
    background: '#F8FAFC',
    borderRadius: 10,
    padding: '12px 16px',
    fontFamily: '"SF Mono", Consolas, monospace',
    fontSize: 13,
    color: '#334155',
    border: '1px solid #E2E8F0',
    letterSpacing: 0.3,
    position: 'relative' as const,
    marginBottom: 12,
  },
  keyMeta: {
    display: 'flex',
    gap: 16,
    fontSize: 12,
    color: '#94A3B8',
    flexWrap: 'wrap' as const,
  },
  revokeBtn: {
    padding: '5px 12px',
    borderRadius: 8,
    border: '1px solid #FEE2E2',
    background: '#FFF',
    color: BRAND.rose,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    transition: 'all 0.15s ease',
  },

  /* 空状态 */
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#94A3B8',
  },

  /* 用量面板 */
  usageGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20,
  },
  panelCard: {
    background: '#FFF',
    borderRadius: 16,
    border: '1px solid rgba(0,0,0,0.06)',
    padding: 24,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0F172A',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logItem: (isLast: boolean) => ({
    padding: '10px 0',
    borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
    fontSize: 13,
  }),

  /* API 文档 */
  docTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    background: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid rgba(0,0,0,0.06)',
    marginBottom: 24,
  },
  docHead: {
    background: '#F8FAFC',
  },
  docCell: {
    padding: '14px 18px',
    fontSize: 13,
    borderBottom: '1px solid #F1F5F9',
  },
  methodBadge: (method: string, color: string) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    background: `${color}12`,
    color: color,
    letterSpacing: 0.5,
  }),
  codeBlock: {
    background: '#0F172A',
    color: '#E2E8F0',
    borderRadius: 14,
    padding: '24px',
    fontFamily: '"SF Mono", Consolas, monospace',
    fontSize: 13,
    lineHeight: 1.75,
    overflowX: 'auto' as const,
    whiteSpace: 'pre' as const,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  ctaBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '28px 32px',
    borderRadius: 16,
    background: `linear-gradient(135deg, ${BRAND.primary}08, ${BRAND.accent}06)`,
    border: `1px solid ${BRAND.primary}15`,
    marginTop: 28,
  },
  ctaTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: '#0F172A',
    marginBottom: 4,
  },
  ctaDesc: {
    fontSize: 13,
    color: '#64748B',
  },

  /* 未登录遮罩 */
  loginGate: {
    textAlign: 'center' as const,
    padding: '100px 20px',
  },
} as const;

/* ── 组件 ───────────────────────────── */

function StatCard({ icon, accent, value, label }: { icon: React.ReactNode; accent: string; value: string | number; label: string }) {
  return (
    <div style={S.statCard(accent)} onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.07)'; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}>
      <div style={S.statIconWrap(accent)}>{icon}</div>
      <div style={S.statValue}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

function KeyCard({ k, onRevoke, onCopy, onToggleReveal, revealed }: {
  k: any; onRevoke: () => void; onCopy: (t: string) => void;
  onToggleReveal: () => void; revealed: boolean;
}) {
  return (
    <div
      style={S.keyCard}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.07)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
    >
      <div style={S.keyTop}>
        <div>
          <div style={S.keyName}>
            <Lock size={15} style={{ marginRight: 6, color: BRAND.primary, verticalAlign: -1 }} />
            {k.name}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Tag color={k.key_type === 'production' ? BRAND.primary : '#94A3B8'} style={{ margin: 0, borderRadius: 6 }}>
              {k.key_type === 'production' ? '正式环境' : '测试环境'}
            </Tag>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>调用 {k.total_calls || 0} 次</span>
          </div>
        </div>
        <button style={S.revokeBtn} onClick={onRevoke}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEE2E2'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FFF'; }}>
          <Trash2 size={12} /> 撤销
        </button>
      </div>

      <div style={S.keyValueBox}>
        <span>{revealed ? (k.key_preview.replace('****', k.key_last_4 || '****')) : k.key_preview}</span>
        <button
          onClick={onToggleReveal}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4,
          }}
        >
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      <div style={S.keyMeta}>
        <span><Clock size={12} style={{ marginRight: 3, verticalAlign: -1 }} /> 速率 {k.rate_limit_per_minute}/min</span>
        <span><Zap size={12} style={{ marginRight: 3, verticalAlign: -1 }} /> 日限额 {k.daily_quota || '跟随账号'}</span>
        <span>最后使用: {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : '从未'}</span>
      </div>
    </div>
  );
}

/* ── 主组件 ─────────────────────────── */
const DeveloperPortal: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useSEO(
    'API 开发者平台 - 一鉴到底',
    '接入一鉴到底多智能体协同校验能力，管理 API Key、查看用量统计、查阅接口文档',
    ['开发者平台', 'API Key', '用量统计', 'Skill 接口']
  );

  const [activeTab, setActiveTab] = useState<'keys' | 'usage' | 'docs'>('keys');
  const [keys, setKeys] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [usageStats, setUsageStats] = useState<any>(null);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newRawKey, setNewRawKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());
  const [docTab, setDocTab] = useState(0);

  useEffect(() => {
    if (!isAuthenticated()) return;
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profRes, keysRes, statsRes] = await Promise.all([
        fetch('/api/auth/developer/profile/', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/auth/developer/my_keys/', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/auth/developer/usage_stats/', { headers: authHeaders() }).then(r => r.json()),
      ]);
      if (profRes.success) setProfile(profRes.data);
      if (keysRes.success) setKeys(keysRes.data || []);
      if (statsRes.success) setUsageStats(statsRes.data);
    } catch (e) { /* silent */ }
  };

  const authHeaders = () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) { message.warning('请输入密钥名称'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/developer/create_key/', {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();
      if (data.success) {
        setNewRawKey(data.data.raw_key);
        message.success('密钥创建成功！请立即复制保存');
        loadData();
      } else { message.error(data.message || '创建失败'); }
    } catch (e) { message.error('网络错误'); }
    setLoading(false);
  };

  const handleRevokeKey = async (id: number) => {
    Modal.confirm({
      title: '确认撤销此 API 密钥？',
      content: '撤销后使用该密钥的所有调用将立即失效，不可恢复。',
      okText: '确认撤销',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await fetch('/api/auth/developer/revoke_key/', {
          method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        message.success('密钥已撤销');
        loadData();
      },
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  const toggleReveal = (id: number) => {
    setRevealedKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 未登录
  if (!isAuthenticated()) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.loginGate}>
            <div style={{
              width: 72, height: 72, borderRadius: 20, background: `${BRAND.primary}10`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
              color: BRAND.primary,
            }}>
              <Shield size={32} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>请先登录</h2>
            <p style={{ color: '#64748B', fontSize: 15, maxWidth: 400, margin: '0 auto 28px', lineHeight: 1.6 }}>
              登录后即可管理 API 密钥、查看用量统计、接入多智能体协同校验能力
            </p>
            <button style={S.btnPrimary} onClick={() => navigate('/login')}>
              立即登录 <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 预计算统计值（避免 Babel 解析复杂 JSX 表达式）
  const statTotalCalls = (profile && profile.total_calls) || 0;
  const statTodayCalls = (profile && profile.calls_today) || 0;
  const statRemainingDaily = (profile && profile.remaining_daily) || 0;
  const statActiveKeyCount = keys.length;

  // 预计算用量值
  let uToday = 0, uMonth = 0, uAvgMs = '0ms', uTokens = '0';
  if (usageStats) {
    uToday = usageStats.today_count || 0;
    uMonth = usageStats.month_count || 0;
    uAvgMs = (usageStats.avg_response_ms || 0) + 'ms';
    uTokens = (usageStats.total_tokens || 0).toLocaleString();
  }

  return (
    <div className="dev-portal" style={S.page}>
      {/* Hero */}
      <div style={S.container}>
        <div style={S.hero}>
          <div style={S.heroBadge}>
            <Sparkles size={14} /> 开放平台 v3.0
          </div>
          <h1 style={S.heroTitle}>API 开发者中心</h1>
          <p style={S.heroSubtitle}>
            接入一鉴到底七层架构执行引擎能力 — Skill 生态、AI 安全审计、P2P 协同调度，
            <br />几分钟内完成对接，构建你的 AI 应用
          </p>
          <div style={S.heroActions}>
            <button style={S.btnPrimary} onClick={() => setActiveTab('keys')}>
              <Key size={16} /> 管理 API Key
            </button>
            <a href="/xialia" style={{ textDecoration: 'none' }}>
              <button style={S.btnSecondary}>
                <ExternalLink size={16} /> 浏览 Skill 市场
              </button>
            </a>
          </div>
        </div>

        {/* 核心指标 */}
        <div style={S.statsRow}>
          <StatCard icon={<Activity size={20} />} accent={BRAND.primary} value={statTotalCalls} label="累计调用次数" />
          <StatCard icon={<Zap size={20} />} accent={BRAND.amber} value={statTodayCalls} label="今日调用" />
          <StatCard icon={<Clock size={20} />} accent={BRAND.emerald} value={statRemainingDaily} label="今日剩余配额" />
          <StatCard icon={<Key size={20} />} accent={BRAND.accent} value={`${statActiveKeyCount}`} label="活跃 API Key" />
        </div>

        {/* Tab 导航 */}
        <div style={S.tabNav}>
          {([
            { key: 'keys', label: 'API 密钥', icon: <Key size={16} /> },
            { key: 'usage', label: '用量统计', icon: <BarChart3 size={16} /> },
            { key: 'docs', label: 'API 文档', icon: <FileCode2 size={16} /> },
          ] as Array<{key: string; label: string; icon: React.ReactNode}>).map(tab => (
            <button
              key={tab.key}
              style={S.tabBtn(activeTab === tab.key)}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════ Tab: API 密钥 ══════════ */}
        {activeTab === 'keys' && (
          <>
            <div style={S.sectionHeader}>
              <div style={S.sectionTitle}><Cpu size={18} /> 我的密钥</div>
              <button style={S.createBtn} onClick={() => setShowNewKeyModal(true)}>
                <Plus size={15} /> 创建新密钥
              </button>
            </div>

            {keys.length === 0 ? (
              <div style={{ ...S.emptyState, background: '#FFF', borderRadius: 16, border: '1px dashed #CBD5E1' }}>
                <Key size={44} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                <p style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginBottom: 8 }}>还没有创建 API 密钥</p>
                <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>创建密钥后即可开始调用一鉴到底的所有开放接口</p>
                <button style={S.createBtn} onClick={() => setShowNewKeyModal(true)}>
                  <Plus size={15} /> 立即创建
                </button>
              </div>
            ) : (
              <div className="dev-key-grid" style={S.keyGrid}>
                {keys.map(k => (
                  <KeyCard
                    key={k.id}
                    k={k}
                    revealed={revealedKeys.has(k.id)}
                    onToggleReveal={() => toggleReveal(k.id)}
                    onRevoke={() => handleRevokeKey(k.id)}
                    onCopy={copyToClipboard}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ══════════ Tab: 用量统计 ══════════ */}
        {activeTab === 'usage' && usageStats && (
          <>
            <div style={{ ...S.statsRow, marginBottom: 24 }}>
              <StatCard icon={<Zap size={20} />} accent={BRAND.primary} value={uToday} label="今日调用" />
              <StatCard icon={<TrendingUp size={20} />} accent={BRAND.accent} value={uMonth} label="本月调用" />
              <StatCard icon={<Server size={20} />} accent={BRAND.emerald} value={uAvgMs} label="平均响应时间" />
              <StatCard icon={<Coins size={20} />} accent={BRAND.amber} value={uTokens} label="累计 Token" />
            </div>

            <div style={S.usageGrid}>
              <div style={S.panelCard}>
                <div style={S.panelTitle}><BarChart3 size={16} /> 按 API 类型分布</div>
                {(usageStats.by_api_type || []).map((t: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < (usageStats.by_api_type.length - 1) ? '1px solid #F1F5F9' : 'none' }}>
                    <span style={{ fontSize: 13, color: '#33455B' }}>{t.api_type}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary }}>{t.count} 次</span>
                  </div>
                ))}
              </div>
              <div style={S.panelCard}>
                <div style={S.panelTitle}><Clock size={16} /> 最近调用记录</div>
                {(usageStats.recent_logs || []).slice(0, 8).map((log: any, i: number) => (
                  <div key={i} style={S.logItem(i >= Math.min(8, (usageStats.recent_logs || []).length) - 1)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{log.api_type_display || log.api_type}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: '1px 8px', borderRadius: 4,
                        background: log.status_code === 200 ? '#ECFDF5' : '#FEF2F2',
                        color: log.status_code === 200 ? BRAND.emerald : BRAND.rose,
                      }}>
                        {log.status_code}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>{log.input_preview || '-'} &middot; {new Date(log.created_at).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══════════ Tab: API 文档 ══════════ */}
        {activeTab === 'docs' && (
          <>
            {/* 接口列表 */}
            <table style={S.docTable}>
              <thead>
                <tr style={S.docHead}>
                  <th style={{ ...S.docCell, fontWeight: 700 }}>方法</th>
                  <th style={{ ...S.docCell, fontWeight: 700 }}>端点路径</th>
                  <th style={{ ...S.docCell, fontWeight: 700 }}>名称</th>
                  <th style={{ ...S.docCell, fontWeight: 700 }}>说明</th>
                  <th style={{ ...S.docCell, fontWeight: 700 }}>认证</th>
                </tr>
              </thead>
              <tbody>
                {API_ENDPOINTS.map((ep, i) => (
                  <tr key={i} onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#FAFBFC'; }} onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}>
                    <td style={S.docCell}>
                      <span style={S.methodBadge(ep.method, ep.color)}>{ep.method}</span>
                    </td>
                    <td style={{ ...S.docCell, fontFamily: '"SF Mono", Consolas, monospace', fontSize: 12, color: BRAND.primaryDark }}>{ep.path}</td>
                    <td style={{ ...S.docCell, fontWeight: 600 }}>{ep.name}</td>
                    <td style={{ ...S.docCell, color: '#64748B' }}>{ep.desc}</td>
                    <td style={S.docCell}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: ep.auth ? '#FEF3C7' : '#ECFDF5', color: ep.auth ? '#D97706' : '#059669',
                      }}>
                        {ep.auth ? '需认证' : '公开'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 代码示例 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {API_ENDPOINTS.filter(ep => ep.example).map((ep, i) => (
                <button
                  key={i}
                  onClick={() => setDocTab(i)}
                  style={{
                    padding: '8px 18px', borderRadius: 10, border: 'none',
                    background: docTab === i ? BRAND.primary : '#F1F5F9',
                    color: docTab === i ? '#FFF' : '#64748B',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >{ep.name}</button>
              ))}
            </div>
            <div style={S.codeBlock}>
              {API_ENDPOINTS[docTab] && API_ENDPOINTS[docTab].example || ''}
            </div>

            {/* CTA */}
            <div style={S.ctaBar}>
              <div>
                <div style={S.ctaTitle}>准备好接入了？</div>
                <div style={S.ctaDesc}>获取 API Key，几分钟内即可完成对接</div>
              </div>
              <button
                style={S.btnPrimary}
                onClick={() => { setActiveTab('keys'); setTimeout(() => setShowNewKeyModal(true), 100); }}
              >
                <Key size={16} /> 获取 API Key <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* 创建密钥弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={18} color={BRAND.primary} />
            创建新 API 密钥
          </div>
        }
        open={showNewKeyModal}
        onCancel={() => { setShowNewKeyModal(false); setNewRawKey(''); setNewKeyName(''); }}
        footer={null}
        destroyOnClose
        width={480}
      >
        {!newRawKey ? (
          <div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#33455B', marginBottom: 6 }}>密钥名称</label>
              <input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="例如：我的项目-生产环境"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10,
                  border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 0.2s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = BRAND.primary}
                onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#33455B', marginBottom: 6 }}>环境类型</label>
              <select style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
                boxSizing: 'border-box', appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
              }}>
                <option value="sandbox">测试环境（推荐先用这个）</option>
                <option value="production">正式环境</option>
              </select>
            </div>
            <button
              onClick={handleCreateKey}
              disabled={!newKeyName.trim() || loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                background: newKeyName.trim() ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryLight})` : '#CBD5E1',
                color: '#FFF', fontSize: 15, fontWeight: 600,
                cursor: newKeyName.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              {loading ? '创建中...' : '创建密钥'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={20} color={BRAND.emerald} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}>API 密钥已生成！</span>
            </div>
            <div style={{
              padding: '10px 14px', borderRadius: 10, background: '#FEF2F2',
              border: '1px solid #FECACA', marginBottom: 16, fontSize: 13, color: BRAND.rose,
            }}>
              请立即复制保存，关闭后将无法再次查看完整密钥！
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#F8FAFC', padding: '14px 16px', borderRadius: 10,
              border: '1px solid #E2E8F0',
            }}>
              <code style={{ flex: 1, fontFamily: '"SF Mono", Consolas, monospace', fontSize: 13, wordBreak: 'break-all', color: '#0F172A' }}>
                {newRawKey}
              </code>
              <button onClick={() => copyToClipboard(newRawKey)} style={{
                padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${BRAND.primary}`,
                background: '#FFF', color: BRAND.primary, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                whiteSpace: 'nowrap', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${BRAND.primary}08`}
              onMouseLeave={e => e.currentTarget.style.background = '#FFF'}
              ><Copy size={14} /> 复制</button>
            </div>
            <button
              onClick={() => { setShowNewKeyModal(false); setNewRawKey(''); setNewKeyName(''); }}
              style={{
                width: '100%', marginTop: 18, padding: '11px', borderRadius: 10,
                border: '1.5px solid #E2E8F0', background: '#FFF', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, color: '#33455B', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.background = '#FFF'}
            >我已保存，关闭</button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DeveloperPortal;

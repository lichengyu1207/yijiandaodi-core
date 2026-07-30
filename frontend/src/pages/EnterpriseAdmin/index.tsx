import React, { useState, useEffect, useCallback } from 'react';
import { enterpriseApi, EnterpriseInfo, DashboardData, EnterpriseMember, EnterpriseApiKeyDetail, RechargeRecord, UsageLogItem } from '../../api/enterpriseApi';

const TABS = [
  { key: 'dashboard', label: '控制台' },
  { key: 'members', label: '成员管理' },
  { key: 'apikeys', label: 'API密钥' },
  { key: 'recharge', label: '充值管理' },
  { key: 'usage', label: '用量日志' },
] as const;

type TabKey = typeof TABS[number]['key'];

const PLAN_COLORS: Record<string, string> = {
  starter: '#6B7280',
  professional: '#3B82F6',
  enterprise_premium: '#8B5CF6',
};

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  active: { color: '#10B981', label: '正常' },
  trial: { color: '#F59E0B', label: '试用' },
  suspended: { color: '#EF4444', label: '停用' },
  expired: { color: '#9CA3AF', label: '过期' },
};

const ROLE_BADGE: Record<string, string> = {
  owner: '#EF4444',
  admin: '#F59E0B',
  developer: '#3B82F6',
  analyst: '#8B5CF6',
  viewer: '#6B7280',
};

const btnStyle: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 6, border: 'none', background: '#3B82F6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, outline: 'none',
};

export default function EnterpriseAdmin() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [enterprise, setEnterprise] = useState<EnterpriseInfo | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [members, setMembers] = useState<EnterpriseMember[]>([]);
  const [apiKeys, setApiKeys] = useState<EnterpriseApiKeyDetail[]>([]);
  const [recharges, setRecharges] = useState<RechargeRecord[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [entRes, dashRes, memRes, keyRes, rcRes] = await Promise.allSettled([
        enterpriseApi.getMyEnterprise(),
        enterpriseApi.getDashboard(),
        enterpriseApi.listMembers(),
        enterpriseApi.listApiKeys(),
        enterpriseApi.getRechargeHistory(),
      ]);
      if (entRes.status === 'fulfilled') setEnterprise(entRes.value.data?.data || null);
      if (dashRes.status === 'fulfilled') setDashboard(dashRes.value.data?.data || null);
      if (memRes.status === 'fulfilled') setMembers(memRes.value.data?.data || []);
      if (keyRes.status === 'fulfilled') setApiKeys(keyRes.value.data?.data || []);
      if (rcRes.status === 'fulfilled') setRecharges(rcRes.value.data?.data || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateKey = async () => {
    const name = prompt('请输入API密钥名称（如：生产环境-主服务）');
    if (!name) return;
    try {
      const res = await enterpriseApi.createApiKey({ name });
      if (res.data.success) {
        setNewKey(res.data.data.key);
        alert('API密钥创建成功！请立即复制保存，关闭后无法再次查看完整密钥。');
        loadData();
      }
    } catch {}
  };

  const handleRevokeKey = async (keyId: number, name: string) => {
    if (!confirm('确定要禁用密钥 "' + name + '" 吗？')) return;
    await enterpriseApi.revokeApiKey({ key_id: keyId });
    alert('密钥已禁用');
    loadData();
  };

  const handleSubmitRecharge = async () => {
    const amountStr = prompt('请输入充值金额（最低100元）');
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount < 100) { alert('金额无效'); return; }
    const res = await enterpriseApi.submitRecharge({ amount, recharge_type: 'balance', payment_method: 'bank_transfer' });
    if (res.data.success) {
      alert('充值申请已提交！交易号: ' + res.data.data.transaction_no);
      loadData();
    }
  };

  if (!enterprise && !loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16 }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>🏢</div>
        <div style={{ fontSize: 18, color: '#6B7280' }}>暂无企业账号</div>
        <button onClick={async () => {
          const name = prompt('请输入企业名称');
          if (!name) return;
          await enterpriseApi.createEnterprise({ name });
          loadData();
        }} style={btnStyle}>创建企业账号</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>🏢 企业管理中心</h2>
          {enterprise && <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: 14 }}>{enterprise.name} · {enterprise.plan_display}</p>}
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, fontSize: 12, background: STATUS_MAP[enterprise?.status || 'active']?.color + '15', color: STATUS_MAP[enterprise?.status || 'active']?.color }}>
          ● {STATUS_MAP[enterprise?.status || 'active']?.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #F3F4F6' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#111827' : '#6B7280',
              borderBottom: activeTab === tab.key ? '2px solid #3B82F6' : '2px solid transparent',
            }}>{tab.label}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>加载中...</div> :
      activeTab === 'dashboard' && dashboard ? <DashboardTab enterprise={enterprise!} dashboard={dashboard} /> :
      activeTab === 'members' ? <MembersTab members={members} onRefresh={loadData} /> :
      activeTab === 'apikeys' ? <ApiKeysTab keys={apiKeys} newKey={newKey} onCreate={handleCreateKey} onRevoke={handleRevokeKey} /> :
      activeTab === 'recharge' ? <RechargeTab recharges={recharges} balance={enterprise?.balance || '0'} onSubmit={handleSubmitRecharge} /> :
      activeTab === 'usage' ? <UsageTab onRefresh={() => enterpriseApi.getUsageLogs().then(r => setUsageLogs(r.data?.data || []))} logs={usageLogs} /> :
      null}

      {newKey && (
        <div onClick={() => setNewKey(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div onClick={(e: any) => e.stopPropagation()} style={{ background: '#fff', padding: 32, borderRadius: 8, width: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 16px' }}>🔑 API密钥（请立即复制）</h3>
            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: 16, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all', userSelect: 'all' }}>{newKey}</div>
            <p style={{ margin: '12px 0 0', color: '#EF4444', fontSize: 13 }}>⚠️ 关闭此窗口后无法再次查看完整密钥</p>
            <button onClick={() => setNewKey(null)} style={{ ...btnStyle, marginTop: 16, width: '100%' }}>我已复制，关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardTab({ enterprise, dashboard }: { enterprise: EnterpriseInfo; dashboard: DashboardData }) {
  const ov = dashboard.overview;
  const usagePct = ov.api_usage_pct;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: '账户余额', value: '¥' + ov.balance, icon: '💰', color: '#10B981' },
          { label: 'API已调用', value: ov.api_calls_used.toLocaleString() + '/' + ov.api_calls_limit.toLocaleString(), icon: '📡', color: '#3B82F6' },
          { label: '成员数', value: ov.member_count + '/' + ov.members_limit, icon: '👥', color: '#8B5CF6' },
          { label: '活跃密钥', value: String(ov.active_keys), icon: '🔑', color: '#F59E0B' },
        ].map(card => (
          <div key={card.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
              </div>
              <span style={{ fontSize: 24 }}>{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 20 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 15 }}>API 使用率</h4>
          <div style={{ height: 12, background: '#E5E7EB', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: Math.min(usagePct, 100) + '%', background: usagePct > 80 ? '#EF4444' : usagePct > 50 ? '#F59E0B' : '#3B82F6', borderRadius: 6 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6B7280' }}>
            <span>{ov.api_calls_used.toLocaleString()} 次已使用</span><span>{usagePct.toFixed(1)}%</span><span>{ov.api_calls_limit.toLocaleString()} 次限额</span>
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 20 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 15 }}>活跃成员</h4>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {dashboard.active_members.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < dashboard.active_members.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <span style={{ fontSize: 14 }}>{m.username}</span>
                <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 10, fontSize: 11, background: (ROLE_BADGE[m.role] || '#6B7280') + '15', color: ROLE_BADGE[m.role] || '#6B7280' }}>{m.role_display}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 20 }}>
        <h4 style={{ margin: '0 0 16px', fontSize: 15 }}>最近操作日志</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['接口路径', '方法', '状态码', '耗时(ms)', '成本', '时间'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dashboard.recent_logs.slice(0, 10).map((log, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                <td style={{ padding: '8px 12px', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.endpoint || '-'}</td>
                <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: log.method === 'GET' ? '#DBEAFE' : log.method === 'POST' ? '#D1FAE5' : '#FEF3C7', color: log.method === 'GET' ? '#2563EB' : log.method === 'POST' ? '#059669' : '#D97706' }}>{log.method}</span></td>
                <td style={{ padding: '8px 12px', color: log.status_code >= 400 ? '#EF4444' : '#10B981' }}>{log.status_code}</td>
                <td style={{ padding: '8px 12px', color: '#6B7280' }}>{log.response_time_ms}ms</td>
                <td style={{ padding: '8px 12px' }}>¥{log.cost}</td>
                <td style={{ padding: '8px 12px', color: '#9CA3AF', whiteSpace: 'nowrap', fontSize: 12 }}>{log.created_at?.slice(0, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MembersTab({ members, onRefresh }: { members: EnterpriseMember[]; onRefresh: () => void }) {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('developer');

  const handleAdd = async () => {
    if (!username.trim()) return;
    try {
      const res = await enterpriseApi.addMember({ username: username.trim(), role });
      alert(res.data.message); setUsername(''); onRefresh();
    } catch (e: any) { alert(e?.response?.data?.message || '添加失败'); }
  };

  return (
    <div>
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="输入用户名或邮箱邀请成员" style={inputStyle} />
        <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputStyle, width: 130 }}>
          <option value="owner">创始人</option><option value="admin">管理员</option>
          <option value="developer">开发者</option><option value="analyst">分析师</option><option value="viewer">只读</option>
        </select>
        <button onClick={handleAdd} style={btnStyle}>+ 邀请成员</button>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6B7280' }}>共 {members.length} 人</span>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#F9FAFB' }}>
            {['用户名', '角色', '部门/职位', '状态', '加入时间', '操作'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={m.id} style={{ borderBottom: i < members.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                <td style={{ padding: '10px 14px' }}><span style={{ fontWeight: m.is_self ? 600 : 400 }}>{m.username}</span>{m.is_self && <span style={{ marginLeft: 6, fontSize: 11, color: '#3B82F6' }}>(我)</span>}</td>
                <td style={{ padding: '10px 14px' }}>
                  <select value={m.role} onChange={e => enterpriseApi.updateMemberRole({ member_id: m.id, role: e.target.value }).then(onRefresh)} disabled={m.is_self || m.role === 'owner'}
                    style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #D1D5DB', fontSize: 11, background: (ROLE_BADGE[m.role] || '#6B7280') + '12', color: ROLE_BADGE[m.role] || '#6B7280' }}>
                    {Object.keys(ROLE_BADGE).map(r => <option key={r} value={r}>{r === m.role ? m.role_display : r}</option>)}
                  </select>
                </td>
                <td style={{ padding: '10px 14px', color: '#6B7280', fontSize: 12 }}>{m.department}{m.position ? ' / ' + m.position : ''}</td>
                <td style={{ padding: '10px 14px' }}><span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 10, fontSize: 11, background: m.status === 'active' ? '#D1FAE5' : '#FEF3C7', color: m.status === 'active' ? '#059669' : '#D97706' }}>{m.status_display}</span></td>
                <td style={{ padding: '10px 14px', color: '#9CA3AF', fontSize: 12, whiteSpace: 'nowrap' }}>{m.joined_at?.slice(0, 10)}</td>
                <td style={{ padding: '10px 14px' }}>
                  {!m.is_self && m.role !== 'owner' && <button onClick={() => { if (confirm('移除 "' + m.username + '"?')) enterpriseApi.removeMember({ member_id: m.id }).then(onRefresh); }} style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 11 }}>移除</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApiKeysTab({ keys, newKey, onCreate, onRevoke }: { keys: EnterpriseApiKeyDetail[]; newKey: string | null; onCreate: () => void; onRevoke: (id: number, name: string) => void }) {
  const typeColor: Record<string, string> = { production: '#3B82F6', sandbox: '#F59E0B', readonly: '#6B7280' };
  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: '#6B7280' }}>共 {keys.length} 个密钥</span>
        <button onClick={onCreate} style={btnStyle}>+ 创建新密钥</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
        {keys.map(k => (
          <div key={k.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{k.name}</div>
                <code style={{ display: 'inline-block', marginTop: 4, padding: '4px 10px', background: '#F3F4F6', borderRadius: 4, fontSize: 12, fontFamily: 'monospace', color: '#374151' }}>{k.key_preview}</code>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: (typeColor[k.key_type] || '#6B7280') + '12', color: typeColor[k.key_type] || '#6B7280' }}>{k.key_type_display || k.key_type}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#6B7280' }}>
              <div>总调用: <strong style={{ color: '#111827' }}>{k.total_calls.toLocaleString()}</strong></div>
              <div>速率限制: <strong style={{ color: '#111827' }}>{k.rate_limit_per_minute}/min</strong></div>
              <div>日限额: <strong style={{ color: '#111827' }}>{k.daily_quota.toLocaleString()}</strong></div>
              <div>月限额: <strong style={{ color: '#111827' }}>{k.monthly_quota.toLocaleString()}</strong></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>最后使用: {k.last_used_at ? k.last_used_at.slice(0, 16) : '从未'}</span>
              {k.is_active ? <button onClick={() => onRevoke(k.id, k.name)} style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 11 }}>禁用</button>
               : <span style={{ fontSize: 11, color: '#9CA3AF' }}>已禁用</span>}
            </div>
          </div>
        ))}
        {keys.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#9CA3AF' }}>暂无API密钥，点击上方按钮创建</div>}
      </div>
    </div>
  );
}

function RechargeTab({ recharges, balance, onSubmit }: { recharges: RechargeRecord[]; balance: string; onSubmit: () => void }) {
  const statusDot: Record<string, string> = { pending: '#F59E0B', approved: '#3B82F6', completed: '#10B981', rejected: '#EF4444', refunded: '#6B7280' };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 8, padding: 24, color: '#fff' }}>
          <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 4 }}>当前余额</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>¥{balance}</div>
          <button onClick={onSubmit} style={{ ...btnStyle, marginTop: 16, background: '#fff', color: '#764ba2', border: 'none' }}>+ 申请充值</button>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 24 }}>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>充值记录</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {['待处理', '已完成', '已拒绝'].map(label => {
              const count = recharges.filter(r => r.status_display === label).length;
              return (<div key={label} style={{ textAlign: 'center', padding: 12, background: '#F9FAFB', borderRadius: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: label === '已完成' ? '#10B981' : label === '待处理' ? '#F59E0B' : '#EF4444' }}>{count}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{label}</div>
              </div>);
            })}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#F9FAFB' }}>
            {['交易号', '类型', '金额', '支付方式', '状态', '申请时间'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {recharges.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < recharges.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11 }}>{r.transaction_no.slice(0, 18)}...</td>
                <td style={{ padding: '10px 14px' }}>{r.recharge_type_display}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>¥{r.amount}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#6B7280' }}>{r.payment_method === 'bank_transfer' ? '银行汇款' : r.payment_method === 'alipay' ? '支付宝' : r.payment_method === 'wechat' ? '微信' : '系统'}</td>
                <td style={{ padding: '10px 14px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: statusDot[r.status] || '#6B7280' }}>● {r.status_display}</span></td>
                <td style={{ padding: '10px 14px', color: '#9CA3AF', fontSize: 12, whiteSpace: 'nowrap' }}>{r.created_at?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {recharges.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>暂无充值记录</div>}
      </div>
    </div>
  );
}

function UsageTab({ onRefresh, logs }: { onRefresh: () => void; logs: UsageLogItem[] }) {
  const [page, setPage] = useState(1);
  const loadedRef = React.useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      onRefresh();
    }
  }, []);

  const resTypeColor: Record<string, string> = { api_call: '#3B82F6', skill_execute: '#8B5CF6', report_download: '#10B981', storage_usage: '#F59E0B', member_seat: '#EF4444' };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: '#6B7280' }}>共 {logs.length} 条日志</span>
        <button onClick={() => { setPage(1); onRefresh(); }} style={{ ...btnStyle, padding: '6px 16px', fontSize: 12 }}>刷新</button>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#F9FAFB' }}>
            {['资源类型', '接口路径', '方法', '状态码', '耗时(ms)', '成本', '操作人', '时间'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={log.id} style={{ borderBottom: i < Math.min(logs.length, 20) - 1 ? '1px solid #F9FAFB' : 'none' }}>
                <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: (resTypeColor[log.resource_type] || '#6B7280') + '12', color: resTypeColor[log.resource_type] || '#6B7280' }}>{log.resource_type_display}</span></td>
                <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.endpoint || '-'}</td>
                <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 6px', borderRadius: 3, fontSize: 10, background: log.method === 'GET' ? '#DBEAFE' : '#D1FAE5', color: log.method === 'GET' ? '#2563EB' : '#059669' }}>{log.method}</span></td>
                <td style={{ padding: '8px 12px', color: log.status_code >= 400 ? '#EF4444' : '#10B981', fontWeight: 500 }}>{log.status_code}</td>
                <td style={{ padding: '8px 12px', color: '#6B7280' }}>{log.response_time_ms}ms</td>
                <td style={{ padding: '8px 12px' }}>¥{log.cost}</td>
                <td style={{ padding: '8px 12px', fontSize: 12 }}>{log.member_username || log.api_key_name || '-'}</td>
                <td style={{ padding: '8px 12px', color: '#9CA3AF', whiteSpace: 'nowrap', fontSize: 12 }}>{log.created_at?.slice(0, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>暂无用量日志</div>}
      </div>
    </div>
  );
}
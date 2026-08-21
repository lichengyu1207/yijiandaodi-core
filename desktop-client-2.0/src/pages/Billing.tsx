/**
 * 月度账单页（需求 4.2.3 两级计费配套）
 *
 * 对接后端：
 * - GET /api/billing/summary        实时账单摘要（本月已用/套餐剩余/超限挂账/预估费用/建议）
 * - GET /api/billing/monthly-detail 月度账单明细（按天聚合）
 *
 * 展示：本月已用/套餐剩余/预估费用 + 月度按天消费条形图 + 账单明细表。
 */
import { useState, useEffect, useCallback } from 'react'
import { billingService, BillingSummary, BillingDayItem } from '../services/billingService'
import { authService } from '../services/authService'

/** 短时间格式：MM-DD HH:mm */
function formatShortTime(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const PLAN_META: Record<string, { label: string; color: string }> = {
  free: { label: '免费版', color: 'var(--text-tertiary)' },
  basic: { label: '基础版', color: 'var(--brand-primary)' },
  professional: { label: '专业版', color: 'var(--status-info)' },
  enterprise: { label: '企业版', color: 'var(--status-warning)' },
}

const VIP_META: Record<number, { label: string; color: string }> = {
  1: { label: '基础版', color: 'var(--brand-primary)' },
  2: { label: '专业版', color: 'var(--status-info)' },
  3: { label: '企业版', color: 'var(--status-warning)' },
}

const ADVICE_META: Record<string, { title: string; detail: string; color: string; bg: string }> = {
  bind_key: {
    title: '建议绑定自有 API Key',
    detail: '当前为免费用户，绑定自有 Key 后调用不再消耗平台额度。',
    color: 'var(--status-info)',
    bg: 'rgba(59, 130, 246, 0.08)',
  },
  upgrade: {
    title: '套餐额度已用尽',
    detail: '本月调用已超出套餐额度，超出部分按量挂账，建议升级套餐。',
    color: 'var(--status-error)',
    bg: 'rgba(239, 68, 68, 0.08)',
  },
  watch: {
    title: '接近套餐额度上限',
    detail: '本月调用已接近套餐额度 80%，请留意后续消费。',
    color: 'var(--status-warning)',
    bg: 'rgba(245, 158, 11, 0.10)',
  },
  ok: {
    title: '消费状态正常',
    detail: '本月消费在套餐额度范围内，无异常。',
    color: 'var(--status-success)',
    bg: 'rgba(34, 197, 94, 0.08)',
  },
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** 月度按天消费条形图（轻量 div 实现） */
function DailyCostBars({ days, maxCost }: { days: BillingDayItem[]; maxCost: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160 }}>
      {days.map((d) => (
        <div
          key={d.date}
          title={`${d.date} · ¥${d.cost.toFixed(4)} · ${d.calls} 次调用`}
          style={{
            flex: 1,
            background: d.cost > 0 ? 'var(--brand-primary)' : 'var(--bg-tertiary)',
            height: maxCost > 0 ? `${Math.max((d.cost / maxCost) * 100, 2)}%` : '2%',
            minHeight: d.cost > 0 ? 3 : 2,
            borderRadius: '3px 3px 0 0',
            opacity: d.cost > 0 ? 1 : 0.6,
          }}
        />
      ))}
    </div>
  )
}

/** 会员 / 兑换码（所有用户）+ 管理员生成兑换码 */
function RedeemSection({ isAdmin, onChanged, summary }: {
  isAdmin: boolean; onChanged: () => void; summary: BillingSummary | null
}) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<'redeem' | 'gen' | null>(null)

  // 管理员生成兑换码表单
  const [genDays, setGenDays] = useState('30')
  const [genCount, setGenCount] = useState('1')
  const [genUses, setGenUses] = useState('1')
  const [genExpireDays, setGenExpireDays] = useState('')
  const [genRemark, setGenRemark] = useState('')
  const [codesList, setCodesList] = useState<Array<Record<string, any>>>([])

  const loadCodes = async () => {
    if (!isAdmin) return
    try {
      setCodesList(await authService.listRedemptions())
    } catch { /* 忽略 */ }
  }
  useEffect(() => { loadCodes() }, [isAdmin])

  const doRedeem = async () => {
    setBusy('redeem')
    setMsg(null)
    try {
      const res = await authService.redeemCode(code.trim())
      setMsg({ ok: true, text: res.message })
      setCode('')
      onChanged()
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || '兑换失败' })
    } finally {
      setBusy(null)
    }
  }

  const contactAdmin = () => {
    setNotice('请通过前往「系统设置 → 关于/帮助」或直接告知本机设备所有者（管理员），由管理员为您开通或续期会员。支付开通功能暂未接入。')
  }

  const doGenerate = async () => {
    setBusy('gen')
    setMsg(null)
    try {
      let expire_at: string | null = null
      const days = genExpireDays ? Math.max(1, parseInt(genExpireDays || '0', 10) || 1) : 0
      if (days > 0) {
        expire_at = new Date(Date.now() + days * 86400000).toISOString()
      }
      const res = await authService.generateRedemptions({
        days: parseInt(genDays || '30', 10) || 30,
        count: Math.max(1, parseInt(genCount || '1', 10) || 1),
        total_uses: Math.max(1, parseInt(genUses || '1', 10) || 1),
        expire_at,
        remark: genRemark.trim(),
      })
      const list: string[] = res?.data?.codes || []
      setMsg({ ok: true, text: `${res.message}${list.length ? '：' + list.join('、') : ''}` })
      await loadCodes()
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || '生成失败' })
    } finally {
      setBusy(null)
    }
  }

  const fieldStyle: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 6,
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13,
  }
  const actBtn: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
    background: 'var(--brand-primary)', color: '#fff', fontSize: 13, fontWeight: 600,
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: 16, alignItems: 'start' }}>
      {/* 用户：兑换 / 试用 */}
      <div className="card" style={{ padding: 20 }}>
        <div className="card-title" style={{ margin: 0 }}>会员 / 兑换码</div>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: (summary?.is_vip ? VIP_META[summary.vip_level]?.color : 'var(--text-tertiary)') || 'var(--text-tertiary)' }}>
            {summary?.is_vip ? (VIP_META[summary.vip_level]?.label || '会员') : '免费版'}
          </span>
          {summary?.vip_expire_at && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              到期 {summary.vip_expire_at.slice(0, 10)}
            </span>
          )}
          {!summary?.is_vip && (
            <span style={{ fontSize: 12, color: 'var(--status-warning)' }}>会员已过期，请开通/续期</span>
          )}
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="输入兑换码，如 YJD-XXXX-XXXX-XXXX"
            style={{ ...fieldStyle, flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter') doRedeem() }}
          />
          <button type="button" style={{ ...actBtn, background: 'var(--status-success)' }} disabled={busy === 'redeem'} onClick={doRedeem}>
            {busy === 'redeem' ? '兑换中...' : '开通/续期'}
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          支付开通功能暂未接入，如需开通/续期请
          <a type="button" onClick={contactAdmin} style={{ color: 'var(--brand-primary)', cursor: 'pointer', textDecoration: 'underline', marginLeft: 4 }}>
            联系管理员
          </a>
          ，或使用管理员发放的兑换码。
        </div>
        {msg && (
          <div style={{ marginTop: 10, fontSize: 12, color: msg.ok ? 'var(--status-success)' : 'var(--status-error)' }}>
            {msg.text}
          </div>
        )}
        {notice && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--brand-primary)', lineHeight: 1.6 }}>
            {notice}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)' }}>
          首次注册已自动赠送 1 个月基础版；兑换码由管理员生成，过期/已用完/无效均会明确提示，错误兑换不影响登录。
        </div>
      </div>

      {/* 管理员：生成兑换码 */}
      {isAdmin && (
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ margin: 0 }}>生成兑换码（管理员）</div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input value={genDays} onChange={(e) => setGenDays(e.target.value)} placeholder="开通天数(默认30)" style={fieldStyle} />
            <input value={genCount} onChange={(e) => setGenCount(e.target.value)} placeholder="数量(默认1)" style={fieldStyle} />
            <input value={genUses} onChange={(e) => setGenUses(e.target.value)} placeholder="每码可兑次数(1=一次性)" style={fieldStyle} />
            <input value={genExpireDays} onChange={(e) => setGenExpireDays(e.target.value)} placeholder="兑换码有效期(天,可空)" style={fieldStyle} />
            <input value={genRemark} onChange={(e) => setGenRemark(e.target.value)} placeholder="备注（如：9.9元/月活动）" style={{ ...fieldStyle, gridColumn: '1 / -1' }} />
          </div>
          <button type="button" style={{ ...actBtn, marginTop: 10 }} disabled={busy === 'gen'} onClick={doGenerate}>
            {busy === 'gen' ? '生成中...' : '生成兑换码'}
          </button>
          {codesList.length > 0 && (
            <div style={{ marginTop: 12, maxHeight: 220, overflow: 'auto' }}>
              {codesList.map((r) => (
                <div key={r.code} style={{ fontSize: 11, padding: '4px 0', borderTop: '1px solid var(--border-secondary)', color: 'var(--text-secondary)' }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{r.code}</span>
                  {' '}· {r.days}天 · 已兑 {r.used_count}/{r.total_uses} · {r.status}
                  {r.remark ? ` · ${r.remark}` : ''}
                  {(r.records || []).length > 0 && (
                    <div style={{ marginTop: 4, paddingLeft: 8, color: 'var(--text-tertiary)' }}>
                      {(r.records || []).map((rec: any, i: number) => (
                        <div key={i}>兑换用户 #{rec.user_id ?? '-'} {rec.username} · {formatShortTime(rec.created_at)}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Billing() {
  const today = new Date()
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [days, setDays] = useState<BillingDayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (m: string) => {
    setLoading(true)
    setError('')
    try {
      const [summaryResp, detailResp] = await Promise.all([
        billingService.getSummary(),
        billingService.getMonthlyDetail(m),
      ])
      setSummary(summaryResp.data)
      setDays(detailResp.data.days)
    } catch (e: any) {
      setError(e?.message || '加载账单失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(month)
  }, [month, load])

  const planMeta = PLAN_META[summary?.plan.plan_type || 'free'] || PLAN_META.free
  const advice = summary ? ADVICE_META[summary.advice] || ADVICE_META.ok : ADVICE_META.ok
  const maxCost = Math.max(...days.map((d) => d.cost), 0)
  const isCurrentMonth = month === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <RedeemSection isAdmin={authService.isAdmin()} summary={summary} onChanged={() => load(month)} />
      {/* 头部：标题 + 月份切换 */}
      <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="card-title" style={{ margin: 0 }}>月度账单</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
            实时消费账单 · 套餐剩余与费用明细 · 超限按量挂账
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            style={btnStyle}
            disabled={loading}
          >
            ‹
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', minWidth: 80, textAlign: 'center' }}>
            {month}
          </span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            style={{ ...btnStyle, opacity: isCurrentMonth ? 0.4 : 1 }}
            disabled={loading || isCurrentMonth}
          >
            ›
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>加载中...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--status-error)' }}>{error}</div>
      ) : (
        <>
          {/* 概要统计卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--text-primary)' }}>¥{summary?.usage.cost.toFixed(4)}</div>
              <div className="stat-label">本月已用（元）</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--brand-primary)' }}>{summary?.usage.calls.toLocaleString()}</div>
              <div className="stat-label">调用次数</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--status-warning)' }}>
                {summary?.plan_remaining === null ? '—' : summary?.plan_remaining.toLocaleString()}
              </div>
              <div className="stat-label">套餐剩余（次）</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--status-info)' }}>¥{summary?.projected_month_cost.toFixed(2)}</div>
              <div className="stat-label">预估月末费用（元）</div>
            </div>
          </div>

          {/* 当前套餐 + 建议 */}
          <div className="card" style={{ padding: 20, display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: advice.bg, fontSize: 12, fontWeight: 700, color: planMeta.color }}>
                {planMeta.label}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                  当前套餐：{planMeta.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {summary?.plan.is_plan
                    ? `月费 ¥${summary?.plan.monthly_price.toLocaleString()} · 额度 ${summary?.plan.api_limit === -1 ? '不限' : `${summary?.plan.api_limit.toLocaleString()} 次`}`
                    : '免费用户 · 按次计费或绑定自有 Key 免配额'}
                </div>
                {summary && summary.plan.is_plan && summary.plan.api_limit > 0 && (
                  <div style={{ marginTop: 10, width: 240 }}>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(summary.plan.api_limit > 0 ? (summary.usage.calls / summary.plan.api_limit) * 100 : 0, 100)}%`,
                          height: '100%',
                          borderRadius: 4,
                          background: (summary.plan_remaining ?? 0) === 0 ? 'var(--status-error)' : 'var(--brand-primary)',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                      已用 {summary.usage.calls.toLocaleString()} / {summary.plan.api_limit.toLocaleString()} 次
                      {summary.over_quota.calls > 0 && (
                        <span style={{ color: 'var(--status-error)' }}>
                          {' '}· 超限 {summary.over_quota.calls} 次挂账 ¥{summary.over_quota.cost.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ maxWidth: 360, border: `1px solid ${advice.color}`, background: advice.bg, borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: advice.color }}>{advice.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{advice.detail}</div>
            </div>
          </div>

          {/* 月度按天消费条形图 */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ margin: 0 }}>每日消费（{month}）</div>
            <div style={{ marginTop: 16 }}>
              <DailyCostBars days={days} maxCost={maxCost} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
              <span>1 日</span>
              <span>{summary?.month}</span>
              <span>{days.length ? days[days.length - 1].date.slice(-2) : ''} 日</span>
            </div>
          </div>

          {/* 账单明细表 */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ margin: 0 }}>账单明细</div>
            {days.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>该月暂无消费记录</div>
            ) : (
              <div style={{ marginTop: 12, border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', background: 'var(--bg-tertiary)', padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  <div>日期</div>
                  <div style={{ textAlign: 'right' }}>费用（元）</div>
                  <div style={{ textAlign: 'right' }}>Tokens</div>
                  <div style={{ textAlign: 'right' }}>调用次数</div>
                </div>
                {days.map((d, i) => (
                  <div key={d.date} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)',
                    borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none',
                  }}>
                    <div style={{ color: 'var(--text-secondary)' }}>{d.date}</div>
                    <div style={{ textAlign: 'right', fontWeight: 600, color: d.cost > 0 ? 'var(--status-warning)' : 'var(--text-tertiary)' }}>
                      ¥{d.cost.toFixed(4)}
                    </div>
                    <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{d.tokens.toLocaleString()}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{d.calls.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 6,
  border: '1px solid var(--border-primary)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: 16,
  cursor: 'pointer',
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

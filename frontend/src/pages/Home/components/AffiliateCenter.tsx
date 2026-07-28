import React, { useState, useEffect } from 'react';
import {
  X,
  TrendingUp,
  Users,
  Wallet,
  Copy,
  Check,
  Link2,
  QrCode,
  ArrowUpRight,
  Clock,
  ArrowRight,
  Gift,
  Crown,
  Star,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { message, Tabs } from 'antd';
import {
  getAffiliateDashboard,
  generateInviteLink,
  getCommissions,
  requestWithdrawal,
  getWithdrawals,
  type AffiliateDashboard,
  type InviteLinkData,
} from '@/api/affiliateApi';

interface AffiliateCenterProps {
  visible: boolean;
  onClose: () => void;
}

const AffiliateCenter: React.FC<AffiliateCenterProps> = ({ visible, onClose }) => {
  const [dashboard, setDashboard] = useState<AffiliateDashboard | null>(null);
  const [inviteLink, setInviteLink] = useState<InviteLinkData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'commissions' | 'withdraw'>('overview');
  const [copied, setCopied] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (visible) {
      loadDashboard();
      loadInviteLink();
    }
    window.addEventListener('open-affiliate-center', handleOpenEvent);
    return () => window.removeEventListener('open-affiliate-center', handleOpenEvent);
  }, [visible]);

  const handleOpenEvent = () => {};

  const loadDashboard = async () => {
    try {
      const res = await getAffiliateDashboard();
      if (res.success && res.data) {
        setDashboard(res.data);
      }
    } catch (e) {}
  };

  const loadInviteLink = async () => {
    try {
      const res = await generateInviteLink();
      if (res.success && res.data) {
        setInviteLink(res.data);
      }
    } catch (e) {}
  };

  const handleCopyLink = () => {
    if (inviteLink?.invite_url) {
      navigator.clipboard.writeText(inviteLink.invite_url);
      setCopied(true);
      message.success('邀请链接已复制');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !dashboard) return;
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      message.warning('请输入有效金额');
      return;
    }
    if (amount < dashboard.min_withdrawal) {
      message.warning(`最低提现${dashboard.min_withdrawal}元`);
      return;
    }

    setWithdrawing(true);
    try {
      const res = await requestWithdrawal(amount);
      if (res.success) {
        message.success('提现申请已提交！');
        setWithdrawAmount('');
        loadDashboard();
      } else {
        message.error(res.message || '提现失败');
      }
    } catch (e) {
      message.error('操作失败');
    } finally {
      setWithdrawing(false);
    }
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.55)',
      zIndex: 1200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div
        style={{
          width: '100%',
          maxWidth: 600,
          maxHeight: '88vh',
          background: '#FFFFFF',
          borderRadius: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #E5E6EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #FFF7E8 0%, #FFF 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #F5A623, #FF6B35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <TrendingUp size={22} style={{ color: '#FFF' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1D2129' }}>
                分销中心
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#86909C' }}>
                邀请好友 · 获得{dashboard?.commission_rate || 20}%佣金
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: 'none',
              background: '#F2F3F5',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#86909C',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Stats Cards */}
        {dashboard && (
          <div style={{
            padding: '14px 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            borderBottom: '1px solid #F2F3F5',
          }}>
            {[
              { label: '累积佣金', value: '¥' + dashboard.total_commission.toFixed(2), icon: Wallet, color: '#F5A623', bg: '#FFF7E8' },
              { label: '可提现', value: '¥' + dashboard.available.toFixed(2), icon: TrendingUp, color: '#00B42A', bg: '#F0FFF4' },
              { label: '已邀请', value: dashboard.total_invited + '人', icon: Users, color: '#165DFF', bg: '#F0F5FF' },
              { label: '已提现', value: '¥' + dashboard.withdrawn.toFixed(2), icon: ArrowUpRight, color: '#86909C', bg: '#F7F8FA' },
            ].map((stat, i) => (
              <div key={i} style={{
                padding: '10px',
                borderRadius: 8,
                background: stat.bg,
                textAlign: 'center',
              }}>
                <stat.icon size={16} style={{ color: stat.color, marginBottom: 4 }} />
                <div style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: stat.color,
                  marginTop: 2,
                }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: '#86909C', marginTop: 1 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Bar */}
        <div style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid #E5E6EB',
          padding: '0 24px',
        }}>
          {([
            { key: 'overview', label: '推广中心' },
            { key: 'commissions', label: '佣金记录' },
            { key: 'withdraw', label: '申请提现' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 18px',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #F5A623' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === tab.key ? '#F5A623' : '#86909C',
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {activeTab === 'overview' && (
            <>
              {/* Invite Link Card */}
              <div style={{
                borderRadius: 10,
                border: '2px dashed #F5A623',
                background: 'linear-gradient(135deg, #FFFBF0, #FFF)',
                padding: '18px',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Gift size={20} style={{ color: '#F5A623' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1D2129' }}>
                    你的专属邀请链接
                  </span>
                </div>

                {inviteLink ? (
                  <div style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}>
                    <div style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 6,
                      background: '#F7F8FA',
                      fontSize: 12,
                      color: '#4E5969',
                      wordBreak: 'break-all',
                      fontFamily: 'monospace',
                    }}>
                      {inviteLink.invite_url}
                    </div>
                    <button
                      onClick={handleCopyLink}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 6,
                        border: 'none',
                        background: copied ? '#00B42A' : '#F5A623',
                        color: '#FFF',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? '已复制' : '复制'}
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#C9CDD4', padding: 10 }}>
                    加载中...
                  </div>
                )}

                {/* Invite Code Badge */}
                {inviteLink && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid #F5E6C8',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: '#FFF7E8',
                      border: '1px solid #F5E6C8',
                    }}>
                      <QrCode size={14} style={{ color: '#F5A623' }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#F5A623' }}>
                        邀请码: {inviteLink.invite_code}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: '#86909C',
                      flex: 1,
                    }}>
                      好友注册时填写此码，他首次付款你即获{dashboard?.commission_rate || 20}%佣金
                    </div>
                  </div>
                )}
              </div>

              {/* How it works */}
              <div style={{
                borderRadius: 10,
                background: '#FAFBFC',
                padding: '16px',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1D2129', marginBottom: 12 }}>
                  分销规则
                </div>
                {[
                  { step: '1', title: '获取邀请链接', desc: '点击上方复制你的专属链接' },
                  { step: '2', title: '分享给好友', desc: '通过微信/微博/QQ分享给朋友' },
                  { step: '3', title: '好友注册付款', desc: '好友通过链接注册并完成首次付款' },
                  { step: '4', title: '获得佣金', desc: `自动获得${dashboard?.commission_rate || 20}%付款额作为佣金` },
                ].map((item) => (
                  <div key={item.step} style={{
                    display: 'flex',
                    gap: 10,
                    marginBottom: 10,
                    alignItems: 'flex-start',
                  }}>
                    <div style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: '#F5A623',
                      color: '#FFF',
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {item.step}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1D2129', marginBottom: 1 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#86909C' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Invited Users Preview */}
              {dashboard?.invited_users && dashboard.invited_users.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#1D2129',
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <Users size={14} />
                    最近邀请 ({dashboard.total_invited}人)
                  </div>
                  {dashboard.invited_users.slice(0, 5).map((user, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: i < 4 ? '1px solid #F2F3F5' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#E8F3FF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#165DFF',
                        }}>
                          {user.username[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1D2129' }}>
                            {user.username}
                          </div>
                          <div style={{ fontSize: 10, color: '#86909C' }}>
                            {user.joined_at ? user.joined_at.slice(0, 10) : ''} 加入
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#00B42A' }}>
                          +{'¥' + user.total_spent.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 10, color: '#86909C' }}>
                          {user.total_orders}单
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'commissions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(dashboard?.recent_commissions || []).length > 0 ? (
                dashboard.recent_commissions.map((c) => (
                  <div key={c.id} style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: '1px solid #E5E6EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: '#F0FFF4',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <TrendingUp size={14} style={{ color: '#00B42A' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1D2129' }}>
                          付款佣金
                        </div>
                        <div style={{ fontSize: 10, color: '#86909C' }}>
                          {c.order_no || '-'} · {c.created_at ? c.created_at.slice(0, 16) : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#00B42A',
                      }}>
                        +{'¥' + c.amount.toFixed(2)}
                      </div>
                      <div style={{
                        fontSize: 10,
                        color: c.status === 'settled' ? '#00B42A' : '#86909C',
                        fontWeight: 500,
                      }}>
                        {c.status === 'settled' ? '已结算' : c.status}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: 40,
                  color: '#C9CDD4',
                  fontSize: 13,
                }}>
                  暂无佣金记录，邀请好友后即可查看
                </div>
              )}
            </div>
          )}

          {activeTab === 'withdraw' && (
            <div>
              {/* Withdraw Form */}
              <div style={{
                borderRadius: 10,
                border: '1px solid #E5E6EB',
                padding: '18px',
                marginBottom: 16,
              }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#1D2129',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Wallet size={18} style={{ color: '#165DFF' }} />
                  申请提现
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#4E5969',
                    marginBottom: 6,
                  }}>
                    提现金额 (元)
                  </label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder={`最低 ${dashboard?.min_withdrawal || 50} 元，可用 ${dashboard?.available?.toFixed(2) || '0.00'} 元`}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 6,
                      border: '1px solid #C9CDD4',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  marginBottom: 14,
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 11,
                      color: '#86909C',
                      marginBottom: 4,
                    }}>银行名称</label>
                    <input placeholder='选填'
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #C9CDD4',
                        fontSize: 12,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }} />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 11,
                      color: '#86909C',
                      marginBottom: 4,
                    }}>账号</label>
                    <input placeholder='选填'
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #C9CDD4',
                        fontSize: 12,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }} />
                  </div>
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={withdrawing || !withdrawAmount}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 8,
                    border: 'none',
                    background: withdrawing || !withdrawAmount ? '#C9CDD4' : '#165DFF',
                    color: '#FFF',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: withdrawing || !withdrawAmount ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {withdrawing ? (
                    <>
                      <div style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        border: '2px solid #FFF',
                        borderTopColor: 'transparent',
                        animation: 'spin 0.6s linear infinite',
                      }} />
                      提交中...
                    </>
                  ) : (
                    <>
                      <ArrowUpRight size={16} />
                      申请提现
                    </>
                  )}
                </button>
              </div>

              {/* Tips */}
              <div style={{
                padding: '12px 14px',
                borderRadius: 8,
                background: '#FFF7E8',
                border: '1px solid #FFE7BA',
                display: 'flex',
                gap: 8,
                fontSize: 11,
                color: '#B68503',
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>提现规则:</div>
                  <ul style={{ margin: 0, paddingLeft: 14, lineHeight: 1.6 }}>
                    <li>最低提现{dashboard?.min_withdrawal || 50}元</li>
                    <li>手续费 1%，实际到账 = 申请金额 x 99%</li>
                    <li>1-3个工作日内到账</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AffiliateCenter;

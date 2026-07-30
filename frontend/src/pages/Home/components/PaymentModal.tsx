import React, { useState, useEffect } from 'react';
import {
  Crown,
  Zap,
  Check,
  X,
  Clock,
  ShieldCheck,
  Gift,
  Building2,
  CreditCard,
  ArrowRight,
  AlertCircle,
  Star,
  TrendingUp,
  Users,
  Lock,
  Sparkles,
} from 'lucide-react';
import { message, Tabs } from 'antd';
import {
  getUserQuota,
  useQuota,
  createOrder,
  mockPay,
  getMyOrders,
  getMembershipPlans,
  getFirstOrderPromo,
  applyFirstOrderDiscount,
  type UserQuotaData,
  type OrderItem,
  type FirstOrderPromoInfo,
} from '@/api/paymentApi';
import type { MembershipPlanItem } from '@/api/affiliateApi';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onPaymentSuccess?: () => void;
}

const BASIC_PLANS = [
  {
    key: 'per_use',
    name: '按次检测',
    price: '¥19',
    originalPrice: '¥29',
    desc: '单次使用，解锁完整报告',
    icon: <Zap size={22} />,
    color: '#165DFF',
    bg: '#F0F5FF',
    features: ['完整检测报告', '下载PDF/文本', '不限时间'],
    popular: false,
  },
  {
    key: 'vip_monthly',
    name: '月度会员',
    price: '¥99',
    originalPrice: '¥199',
    desc: '30天无限次 + 全部 200+ 技能',
    icon: <Crown size={22} />,
    color: '#F5A623',
    bg: '#FFF7E8',
    features: ['30天无限次', '\u200b200+技能全解锁', '优先体验新功能', '客服优先'],
    popular: false,
  },
];

const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  onPaymentSuccess,
}) => {
  const [quota, setQuota] = useState<UserQuotaData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('vip_yearly_199');
  const [paying, setPaying] = useState(false);
  const [orderNo, setOrderNo] = useState<string>('');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [activeTab, setActiveTab] = useState<'pay' | 'orders'>('pay');
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlanItem[]>([]);
  const [showCombo, setShowCombo] = useState(false);
  const [firstOrderPromo, setFirstOrderPromo] = useState<FirstOrderPromoInfo | null>(null);
  const [discountInfo, setDiscountInfo] = useState<any>(null);
  const [couponCode, setCouponCode] = useState<string>('');

  useEffect(() => {
    if (visible) {
      loadQuota();
      loadOrders();
      loadMembershipPlans();
      loadFirstOrderPromo();
    }
  }, [visible]);

  const loadQuota = async () => {
    try {
      const res = await getUserQuota();
      if (res.success && res.data) {
        setQuota(res.data);
      }
    } catch (e) {}
  };

  const loadOrders = async () => {
    try {
      const res = await getMyOrders();
      if (res.success && res.data) {
        setOrders(res.data.orders || []);
      }
    } catch (e) {}
  };

  const loadMembershipPlans = async () => {
    try {
      const res = await getMembershipPlans();
      if (res.success && res.data?.plans) {
        setMembershipPlans(res.data.plans);
      }
    } catch (e) {}
  };

  const loadFirstOrderPromo = async () => {
    try {
      const res = await getFirstOrderPromo();
      if (res.success && res.data && res.data.user_has_claimed) {
        setFirstOrderPromo(res.data);
        if (res.data.user_coupon_code) {
          setCouponCode(res.data.user_coupon_code);
          await applyDiscountForPlan(selectedPlan);
        }
      } else if (res.success && res.data) {
        setFirstOrderPromo(res.data);
      }
    } catch (e) {}
  };

  const applyDiscountForPlan = async (planType: string) => {
    try {
      const res = await applyFirstOrderDiscount(planType);
      if (res.success && res.data?.can_apply) {
        setDiscountInfo(res.data.discount_info);
        setCouponCode(res.data.coupon_code || '');
      } else {
        setDiscountInfo(null);
        if (!res.data?.has_coupon) {
          setCouponCode('');
        }
      }
    } catch (e) {
      setDiscountInfo(null);
    }
  };

  const handleFreeUse = async () => {
    if (!quota || quota.free_remaining <= 0) {
      message.warning('今日免费次数已用完');
      return;
    }
    try {
      const res = await useQuota('free');
      if (res.success) {
        message.success(res.message || '免费使用成功');
        loadQuota();
        onPaymentSuccess?.();
      }
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handlePay = async () => {
    if (paying) return;
    setPaying(true);
    try {
      const orderRes = await createOrder(selectedPlan, couponCode || undefined);
      if (orderRes.success && orderRes.data) {
        setOrderNo(orderRes.data.order_no);

        const payRes = await mockPay(orderRes.data.order_no);
        if (payRes.success) {
          message.success('支付成功！');
          loadQuota();
          loadOrders();
          onPaymentSuccess?.();
          setTimeout(onClose || (() => {}), 1500);
        }
      }
    } catch (e) {
      message.error('支付失败，请重试');
    } finally {
      setPaying(false);
    }
  };

  const getCurrentPriceDisplay = (): string => {
    if (discountInfo && discountInfo.final_price) {
      return '¥' + discountInfo.final_price.toFixed(2);
    }
    const allPlans = [...BASIC_PLANS, ...membershipPlans.map(p => ({
      key: p.plan_type,
      name: p.plan_name,
      price: '¥' + p.price,
      originalPrice: p.original_price > 0 ? '¥' + p.original_price : '',
      desc: p.description,
      icon: <Crown size={22} />,
      color: p.badge_color || '#165DFF',
      bg: p.badge_color ? p.badge_color + '15' : '#F0F5FF',
      features: p.features || [],
      popular: p.is_hot,
      badge_text: p.badge_text,
      badge_color: p.badge_color,
      duration_days: p.duration_days,
      vip_level: p.vip_level,
    }))];
    const found = allPlans.find(p => p.key === selectedPlan);
    return found?.price || '¥199';
  };

  const getOriginalPriceDisplay = (): string => {
    if (discountInfo && discountInfo.original_price) {
      return '¥' + discountInfo.original_price.toFixed(2);
    }
    const allPlans = [...BASIC_PLANS, ...membershipPlans.map(p => ({
      key: p.plan_type,
      originalPrice: p.original_price > 0 ? '¥' + p.original_price : '',
    }))];
    const found = allPlans.find(p => p.key === selectedPlan);
    return found?.originalPrice || '';
  };

  if (!visible) return null;

  const comboPlans = membershipPlans.filter(p =>
    p.plan_type.startsWith('combo_') || p.plan_type.includes('yearly') || p.plan_type.includes('enterprise')
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.55)',
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div
        style={{
          width: '100%',
          maxWidth: 560,
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
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #E02020, #F5A623)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <CreditCard size={20} style={{ color: '#FFF' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1D2129' }}>
                AI检测中心
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#86909C' }}>
                {quota ? (quota.is_vip ? 'VIP' + quota.vip_level + '会员' : '普通用户') : ''} · 选择套餐
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, background: '#F2F3F5', borderRadius: 6, padding: 2 }}>
              {(['pay', 'orders'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '5px 14px',
                    border: 'none',
                    borderRadius: 5,
                    background: activeTab === tab ? '#FFF' : 'transparent',
                    color: activeTab === tab ? '#1D2129' : '#86909C',
                    fontSize: 12,
                    fontWeight: activeTab === tab ? 600 : 400,
                    cursor: 'pointer',
                    boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {tab === 'pay' ? '购买套餐' : `我的订单(${orders.length})`}
                </button>
              ))}
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
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {activeTab === 'pay' ? (
            <>
              {/* Free Quota Banner */}
              {quota && (
                <div style={{
                  marginBottom: 14,
                  padding: '12px 16px',
                  borderRadius: 8,
                  background: quota.free_remaining > 0 ? '#F0FFF4' : '#FFF1F0',
                  border: '1px solid ' + (quota.free_remaining > 0 ? '#B7EB8F' : '#FFCCC7'),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <div style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: quota.free_remaining > 0 ? '#00B42A' : '#F53F3F',
                    minWidth: 48,
                    textAlign: 'center',
                  }}>
                    {quota.free_remaining}/{quota.free_limit}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: quota.free_remaining > 0 ? '#00B42A' : '#F53F3F',
                      marginBottom: 1,
                    }}>
                      {quota.free_remaining > 0
                        ? '今日还有 ' + quota.free_remaining + ' 次免费'
                        : '今日免费次数已用完'}
                    </div>
                    <div style={{ fontSize: 11, color: '#86909C' }}>
                      已使用 {quota.free_used_today}/{quota.free_limit}
                    </div>
                  </div>
                  {quota.free_remaining > 0 && (
                    <button
                      onClick={handleFreeUse}
                      style={{
                        padding: '5px 14px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#00B42A',
                        color: '#FFF',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      免费使用
                    </button>
                  )}
                </div>
              )}

              {/* First Order Promo Banner */}
              {firstOrderPromo && (
                <div style={{
                  marginBottom: 14,
                  borderRadius: 8,
                  background: (firstOrderPromo.extra_config?.bg_color || '#FFFBEA'),
                  borderLeft: '3px solid ' + (firstOrderPromo.extra_config?.border_color || '#FF7D00'),
                  padding: '10px 14px',
                  boxShadow: '0 2px 8px rgba(255,125,0,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <Gift size={18} style={{ color: firstOrderPromo.extra_config?.accent_color || '#FF7D00', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: (firstOrderPromo.extra_config?.border_color || '#FF7D00') }}>
                      {firstOrderPromo.extra_config?.banner_text || '新人专享 首单5折'}
                    </div>
                    {discountInfo && (
                      <div style={{ fontSize: 11, color: '#92400E', marginTop: 2 }}>
                        可省 ¥{discountInfo.discount_amount.toFixed(2)}
                      </div>
                    )}
                  </div>
                  {firstOrderPromo.user_has_claimed ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      color: (firstOrderPromo.extra_config?.accent_color || '#FF7D00'),
                    }}>
                      <Check size={12} />
                      已领取{couponCode ? ` · ${couponCode.slice(0, 8)}...` : ''}
                    </div>
                  ) : (
                    <span style={{
                      fontSize: 10,
                      color: '#86909C',
                    }}>
                      未领取
                    </span>
                  )}
                </div>
              )}

              {/* Plan Type Tabs */}
              <div style={{
                display: 'flex',
                gap: 8,
                marginBottom: 14,
                background: '#F7F8FA',
                borderRadius: 8,
                padding: 4,
              }}>
                {[
                  { key: 'basic', label: '基础套餐' },
                  { key: 'combo', label: '场景套餐', hot: true },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setShowCombo(t.key === 'combo')}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      border: 'none',
                      borderRadius: 6,
                      background: showCombo === (t.key === 'combo') ? '#FFF' : 'transparent',
                      color: showCombo === (t.key === 'combo') ? '#1D2129' : '#86909C',
                      fontSize: 13,
                      fontWeight: showCombo === (t.key === 'combo') ? 600 : 400,
                      cursor: 'pointer',
                      boxShadow: showCombo === (t.key === 'combo') ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    {t.label}
                    {t.hot && (
                      <span style={{
                        fontSize: 9,
                        background: '#E02020',
                        color: '#FFF',
                        padding: '1px 5px',
                        borderRadius: 3,
                        fontWeight: 700,
                      }}>HOT</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Price Plans */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!showCombo ? (
                  BASIC_PLANS.map((plan) => renderPlanCard(plan))
                ) : (
                  <>
                    {membershipPlans.filter(p =>
                      !['per_use', 'vip_monthly'].includes(p.plan_type)
                    ).map((plan) => {
                      const isSelected = selectedPlan === plan.plan_type;
                      return (
                        <div
                          key={plan.id}
                          onClick={() => setSelectedPlan(plan.plan_type)}
                          style={{
                            position: 'relative',
                            padding: '14px 16px',
                            borderRadius: 10,
                            border: '2px solid ' + (isSelected ? (plan.badge_color || '#165DFF') : '#E5E6EB'),
                            background: isSelected ? ((plan.badge_color || '#165DFF') + '12') : '#FFF',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          {plan.badge_text && (
                            <div style={{
                              position: 'absolute',
                              top: -1,
                              right: 16,
                              background: plan.badge_color || '#E02020',
                              color: '#FFF',
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 10px',
                              borderRadius: '0 0 6px 6px',
                            }}>
                              {plan.badge_text}
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              background: (plan.badge_color || '#165DFF') + '15',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: plan.badge_color || '#165DFF',
                              flexShrink: 0,
                            }}>
                              {plan.plan_type.includes('enterprise') ? <Building2 size={20} /> :
                               plan.plan_type.includes('security') ? <ShieldCheck size={20} /> :
                               plan.plan_type.includes('content') ? <Sparkles size={20} /> :
                               <Crown size={20} />}
                            </div>

                            <div style={{ flex: 1 }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 8,
                                marginBottom: 3,
                              }}>
                                {plan.original_price > 0 && (
                                  <span style={{
                                    fontSize: 11,
                                    color: '#86909C',
                                    textDecoration: 'line-through',
                                  }}>
                                    {'¥' + plan.original_price}
                                  </span>
                                )}
                                <span style={{
                                  fontSize: 22,
                                  fontWeight: 800,
                                  color: isSelected ? (plan.badge_color || '#165DFF') : '#1D2129',
                                }}>
                                  {'¥' + plan.price}
                                </span>
                                {plan.duration_days > 0 && (
                                  <span style={{ fontSize: 11, color: '#86909C' }}>
                                    /{plan.duration_days >= 365 ? Math.floor(plan.duration_days / 365) + '年' : plan.duration_days + '天'}
                                  </span>
                                )}
                              </div>

                              <div style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#1D2129',
                                marginBottom: 5,
                              }}>
                                {plan.plan_name}
                              </div>

                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                {(plan.features || []).slice(0, 5).map((f, fi) => (
                                  <span key={fi} style={{
                                    fontSize: 10,
                                    color: plan.badge_color || '#165DFF',
                                    background: (plan.badge_color || '#165DFF') + '10',
                                    padding: '2px 7px',
                                    borderRadius: 4,
                                    fontWeight: 500,
                                  }}>
                                    <Check size={9} style={{ marginRight: 3 }} />
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {isSelected && (
                              <div style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: plan.badge_color || '#165DFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                marginTop: 2,
                              }}>
                                <Check size={12} style={{ color: '#FFF' }} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Pay Button */}
              <div>
                {discountInfo && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginBottom: 8,
                  }}>
                    <span style={{
                      fontSize: 12,
                      color: '#86909C',
                      textDecoration: 'line-through',
                    }}>
                      {getOriginalPriceDisplay()}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#F53F3F',
                      background: '#FFF1F0',
                      padding: '1px 6px',
                      borderRadius: 4,
                    }}>
                      省 ¥{discountInfo.discount_amount.toFixed(2)}
                    </span>
                  </div>
                )}
                <button
                  onClick={handlePay}
                  disabled={paying}
                  style={{
                    width: '100%',
                    marginTop: discountInfo ? 0 : 14,
                    padding: '14px',
                    borderRadius: 8,
                    border: 'none',
                    background: paying ? '#C9CDD4' : (discountInfo ? 'linear-gradient(135deg, #FF7D00, #E02020)' : 'linear-gradient(135deg, #E02020, #F5A623)'),
                    color: '#FFF',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: paying ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {paying ? (
                    <>
                      <div style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: '2px solid #FFF',
                        borderTopColor: 'transparent',
                        animation: 'spin 0.6s linear infinite',
                      }} />
                      处理中...
                    </>
                  ) : (
                    <>
                      立即支付 {getCurrentPriceDisplay()}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                marginTop: 8,
              }}>
                <p style={{
                  textAlign: 'center',
                  fontSize: 10,
                  color: '#C9CDD4',
                  margin: 0,
                }}>
                  支持微信/支付宝实 · 安全加密 · 即时到账
                </p>
              </div>

              {/* Affiliate CTA */}
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #FFF7E8, #F0F5FF)',
                border: '1px dashed #F5A623',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
              }} onClick={() => {
                onClose();
                setTimeout(() => window.dispatchEvent(new CustomEvent('open-affiliate-center')), 300);
              }}>
                <TrendingUp size={18} style={{ color: '#F5A623', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1D2129' }}>
                    邀请好友赚钱 · 获得 20% 佣金
                  </div>
                  <div style={{ fontSize: 10, color: '#86909C' }}>
                    分享邀请链接，朋友付款你赚钱
                  </div>
                </div>
                <ArrowRight size={14} style={{ color: '#F5A623' }} />
              </div>
            </>
          ) : (
            /* Orders List */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.length > 0 ? orders.map((o) => (
                <div key={o.id} style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid #E5E6EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1D2129', marginBottom: 2 }}>
                      {o.subject}
                    </div>
                    <div style={{ fontSize: 11, color: '#86909C' }}>
                      {o.order_no} · {o.created_at ? o.created_at.slice(0, 16) : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: o.status === 'paid' ? '#00B42A' : '#86909C',
                    }}>
                      {o.status_display}
                    </div>
                    <div style={{ fontSize: 12, color: '#1D2129', fontWeight: 600 }}>
                      {'¥' + o.amount}
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{
                  textAlign: 'center',
                  padding: 40,
                  color: '#C9CDD4',
                  fontSize: 13,
                }}>
                  暂无订单记录
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function renderPlanCard(plan: typeof BASIC_PLANS[0]) {
    const isSelected = selectedPlan === plan.key;
    return (
      <div
        key={plan.key}
        onClick={() => setSelectedPlan(plan.key)}
        style={{
          position: 'relative',
          padding: '14px 16px',
          borderRadius: 10,
          border: '2px solid ' + (isSelected ? plan.color : '#E5E6EB'),
          background: isSelected ? plan.bg + '40' : '#FFF',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {plan.popular && (
          <div style={{
            position: 'absolute',
            top: -1,
            right: 16,
            background: plan.color,
            color: '#FFF',
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 10px',
            borderRadius: '0 0 6px 6px',
          }}>
            推荐
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: plan.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: plan.color,
            flexShrink: 0,
          }}>
            {plan.icon}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              marginBottom: 3,
            }}>
              <span style={{
                fontSize: 11,
                color: '#86909C',
                textDecoration: 'line-through',
              }}>
                {plan.originalPrice}
              </span>
              <span style={{
                fontSize: 22,
                fontWeight: 800,
                color: isSelected ? plan.color : '#1D2129',
              }}>
                {plan.price}
              </span>
              {plan.key.includes('monthly') && (
                <span style={{ fontSize: 12, color: '#86909C' }}>/月</span>
              )}
            </div>

            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#1D2129',
              marginBottom: 5,
            }}>
              {plan.name}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {plan.features.map((f, fi) => (
                <span key={fi} style={{
                  fontSize: 10,
                  color: plan.color,
                  background: plan.bg,
                  padding: '2px 7px',
                  borderRadius: 4,
                  fontWeight: 500,
                }}>
                  <Check size={9} style={{ marginRight: 3 }} />
                  {f}
                </span>
              ))}
            </div>
          </div>

          {isSelected && (
            <div style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: plan.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 2,
            }}>
              <Check size={12} style={{ color: '#FFF' }} />
            </div>
          )}
        </div>
      </div>
    );
  }
};

export default PaymentModal;

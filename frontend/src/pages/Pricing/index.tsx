import { useState } from 'react';
import { useSEO } from '@/hooks/useSEO';
import { Check, ChevronDown, ChevronUp, Star, Crown, Building2, HelpCircle } from 'lucide-react';
import { message } from 'antd';
import { createOrder } from '@/api/paymentApi';
import PaymentModal from '@/components/PaymentModal';

const PLANS = [
  {
    id: 'value',
    icon: <Star size={20} />,
    name: '超值版',
    price: 199,
    originalPrice: 2388,
    monthlyPrice: 16.6,
    badge: null,
    tags: ['12个月权益', '年度专属技能库', '基础审计工具'],
    features: [
      '每月 300 次技能调用',
      '12 个核心安全技能',
      '基础 Prompt 模板包（30个）',
      '社区技术支持',
      '月度安全报告',
      '课程 9 折优惠',
    ],
    ctaText: '立即开通',
    highlighted: false,
  },
  {
    id: 'premium',
    icon: <Crown size={20} />,
    name: '尊享版',
    price: 599,
    originalPrice: 1188,
    monthlyPrice: 49.9,
    badge: '最受欢迎',
    tags: ['无限次调用', '私有RAG 1000页', '专属顾问'],
    features: [
      '无限次技能调用',
      '全部安全技能解锁',
      '私有 RAG 知识库（1000页）',
      '高级 Prompt 模板包（100+）',
      '1 对 1 技术顾问',
      '优先工单响应',
      '课程 7 折优惠',
      'API 调用额度翻倍',
    ],
    ctaText: '立即开通',
    highlighted: true,
  },
  {
    id: 'enterprise',
    icon: <Building2 size={20} />,
    name: '企业定制',
    price: 5999,
    originalPrice: 12000,
    monthlyPrice: 499.9,
    badge: '企业首选',
    tags: ['私有部署', '无限账号', '7×24支持'],
    features: [
      '私有化部署（含运维）',
      '不限账号数量',
      '全部功能 + 定制开发',
      '私有 RAG 无容量限制',
      '专属客户成功经理',
      '7×24 小时技术支持',
      'SLA 保障协议',
      '定期安全巡检报告',
    ],
    ctaText: '联系销售',
    highlighted: false,
  },
];

const FAQS = [
  {
    q: '年度会员和按月付费有什么区别？',
    a: '年度会员享受更大折扣力度，同时包含月度用户没有的专属权益，如年度技能库更新、专属模板包等。超值版年付相当于月均 ¥16.6，比单独购买节省超过 90%。',
  },
  {
    q: '企业定制方案包含哪些服务？',
    a: '企业定制方案包含私有化部署、无限账号、定制化功能开发、专属客户成功经理、7×24 技术支持和 SLA 保障。具体交付内容根据需求评估后确定，起价 ¥5999/年。',
  },
  {
    q: '会员到期后数据会保留吗？',
    a: '会员到期后你的历史使用记录、已生成的报告和配置都会保留。但高级功能和调用配额将恢复为免费版限制。续费后即可恢复正常使用。',
  },
  {
    q: '可以升级或降级套餐吗？',
    a: '支持随时升级套餐，差价按剩余时间比例折算。降级需在当前周期结束前申请，下一周期生效。企业定制方案不支持自助升降级，请联系销售顾问。',
  },
];

const COMPARISON_ROWS = [
  { feature: '技能调用次数', value: '300次/月', premium: '无限', enterprise: '无限' },
  { feature: '可用安全技能数', value: '12个', premium: '全部', enterprise: '全部 + 定制' },
  { feature: 'RAG 知识库容量', value: '-', premium: '1000页', enterprise: '无限制' },
  { feature: 'Prompt 模板数量', value: '30个', premium: '100+', enterprise: '定制' },
  { feature: '技术支持渠道', value: '社区', premium: '1对1顾问', enterprise: '7×24专线' },
  { feature: 'API 调用额度', value: '标准', premium: '翻倍', enterprise: '无限制' },
  { feature: '课程折扣', value: '9折', premium: '7折', enterprise: '免费' },
  { feature: '私有部署', value: '-', premium: '-', enterprise: '包含' },
];

const S = {
  page: { minHeight: '100vh', backgroundColor: '#F5F7FA', padding: '40px 0 80px' },
  container: { maxWidth: 1160, margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' as const },
  hero: { textAlign: 'center' as const, marginBottom: 48 },
  heroTitle: { fontSize: 32, fontWeight: 700, color: '#1D2129', marginBottom: 12, letterSpacing: '-0.5px' },
  heroSub: { fontSize: 16, color: '#86909C', lineHeight: 1.6 },
  cardsRow: { display: 'flex', gap: 20, marginBottom: 56, alignItems: 'stretch', flexWrap: 'wrap' as const },
  card: (h: boolean) => ({
    flex: '1 1 300px' as const,
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    border: h ? '2px solid #165DFF' : '1px solid #E5E6EB',
    borderRadius: 12,
    padding: '32px 28px 28px',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    cursor: 'pointer',
    boxShadow: h ? '0 4px 16px rgba(22,93,255,0.12)' : '0 2px 12px rgba(0,0,0,0.04)',
  }),
  badge: (isHot: boolean) => ({
    position: 'absolute' as const,
    top: -12,
    left: '50%',
    transform: 'translateX(-50%)',
    background: isHot ? '#165DFF' : '#1D2129',
    color: '#FFF',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 16px',
    borderRadius: 9999,
    whiteSpace: 'nowrap' as const,
  }),
  cardHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 },
  cardIcon: { width: 36, height: 36, borderRadius: 8, background: '#F2F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#165DFF' },
  cardName: { fontSize: 18, fontWeight: 700, color: '#1D2129' },
  priceArea: { marginBottom: 20 },
  priceWrapper: { display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 },
  priceSymbol: { fontSize: 18, fontWeight: 600, color: '#FF7D00' },
  priceNum: { fontSize: 42, fontWeight: 800, color: '#FF7D00', lineHeight: 1, fontFamily: "'Inter', sans-serif" },
  priceUnit: { fontSize: 14, color: '#86909C', marginLeft: 2 },
  originalPrice: { fontSize: 14, color: '#C9CDD4', textDecoration: 'line-through' },
  monthlyNote: { fontSize: 13, color: '#86909C', marginTop: 4 },
  tagList: { display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 20 },
  tag: { fontSize: 12, color: '#165DFF', backgroundColor: '#E8F3FF', padding: '3px 10px', borderRadius: 4 },
  featureList: { flex: 1, marginBottom: 24 },
  featureItem: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', fontSize: 14, color: '#4E5969' },
  featureCheck: { width: 16, height: 16, minWidth: 16, color: '#00B42A', marginTop: 2 },
  ctaBtn: (h: boolean) => ({
    width: '100%',
    height: 44,
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    background: h ? '#165DFF' : '#FFFFFF',
    color: h ? '#FFF' : '#165DFF',
    border: h ? 'none' : '1px solid #165DFF',
    transition: 'all 0.2s ease',
  }),
  sectionTitle: { fontSize: 24, fontWeight: 700, color: '#1D2129', marginBottom: 24, textAlign: 'center' as const },
  faqSection: { maxWidth: 800, margin: '0 auto 56px' },
  faqItem: { border: '1px solid #E5E6EB', borderRadius: 8, marginBottom: 10, backgroundColor: '#FFF', overflow: 'hidden' },
  faqHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px',
    cursor: 'pointer', userSelect: 'none' as const, transition: 'background-color 0.15s ease',
    border: 'none', background: 'none', width: '100%', textAlign: 'left' as const,
  },
  faqQ: { fontSize: 15, fontWeight: 600, color: '#1D2129', display: 'flex', alignItems: 'center', gap: 8 },
  faqA: { padding: '0 20px 16px', fontSize: 14, color: '#4E5969', lineHeight: 1.7 },
  tableSection: { marginBottom: 40, overflowX: 'auto' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden' },
  th: { padding: '14px 20px', fontSize: 13, fontWeight: 600, color: '#86909C', borderBottom: '1px solid #E5E6EB', textAlign: 'center' as const, backgroundColor: '#FAFBFC' },
  td: { padding: '12px 20px', fontSize: 14, color: '#4E5969', textAlign: 'center' as const, borderBottom: '1px solid #F2F3F5' },
  tdFirst: { textAlign: 'left' as const, fontWeight: 500, color: '#1D2129' },
};

const Pricing: React.FC = () => {
  useSEO(
    '会员定价 - 一鉴到底AI Agent行为安全平台',
    '选择适合你的会员方案，从个人开发者到企业团队，总有一款适合你',
    ['会员定价', 'AI Agent安全', '行为检测', 'Agent开发', '企业服务']
  );
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<{
    order_no: string;
    order_type: string;
    amount: number | string;
    subject: string;
    status?: string;
  } | null>(null);

  // 订单类型映射
  const orderTypeMap: Record<string, string> = {
    value: 'vip_yearly_199',
    premium: 'vip_yearly_599',
    enterprise: 'vip_enterprise',
  };

  const handlePurchase = async (planId: string, price: number, planName: string) => {
    const orderType = orderTypeMap[planId];
    if (!orderType) {
      message.error('暂不支持该套餐购买');
      return;
    }

    try {
      const res = await createOrder(orderType);
      if (res.success && res.data) {
        setCurrentOrder({
          order_no: res.data.order_no,
          order_type: orderType,
          amount: res.data.amount,
          subject: res.data.subject,
          status: res.data.status,
        });
        setPayModalVisible(true);
      } else {
        message.error(res.message || '创建订单失败');
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || '创建订单失败，请重试');
    }
  };

  return (
    <div style={S.page}>
      <div className="pricing-page-container" style={S.container}>
        <div style={S.hero}>
          <h1 className="pricing-hero-title" style={S.heroTitle}>选择适合你的方案</h1>
          <p className="pricing-hero-sub" style={S.heroSub}>从个人开发者到企业团队，总有一款适合你</p>
        </div>

        <div className="pricing-cards-row" style={S.cardsRow}>
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              style={S.card(plan.highlighted)}
              onMouseEnter={(e) => {
                if (!plan.highlighted) e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = plan.highlighted ? '0 4px 16px rgba(22,93,255,0.12)' : '0 2px 12px rgba(0,0,0,0.04)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {plan.badge && <div style={S.badge(plan.badge === '最受欢迎')}>{plan.badge}</div>}
              <div style={S.cardHeader}>
                <div style={S.cardIcon}>{plan.icon}</div>
                <span style={S.cardName}>{plan.name}</span>
              </div>
              <div style={S.priceArea}>
                <div style={S.priceWrapper}>
                  <span style={S.priceSymbol}>¥</span>
                  <span style={S.priceNum}>{plan.price}</span>
                  <span style={S.priceUnit}>/年</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={S.originalPrice}>原价 ¥{plan.originalPrice}/年</span>
                  <span style={S.monthlyNote}>约 ¥{plan.monthlyPrice}/月</span>
                </div>
              </div>
              <div style={S.tagList}>
                {plan.tags.map((t) => (
                  <span key={t} style={S.tag}>{t}</span>
                ))}
              </div>
              <div style={S.featureList}>
                {plan.features.map((f) => (
                  <div key={f} style={S.featureItem}>
                    <Check size={16} style={S.featureCheck} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <button
                style={S.ctaBtn(plan.highlighted)}
                onMouseEnter={(e) => {
                  if (plan.highlighted) e.currentTarget.style.background = '#0E42D2';
                  else e.currentTarget.style.background = '#E8F3FF';
                }}
                onMouseLeave={(e) => {
                  if (plan.highlighted) e.currentTarget.style.background = '#165DFF';
                  else e.currentTarget.style.background = '#FFFFFF';
                }}
                onClick={() => handlePurchase(plan.id, plan.price, plan.name)}
              >
                {plan.ctaText}
              </button>
            </div>
          ))}
        </div>

        <h2 style={{ ...S.sectionTitle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <HelpCircle size={24} /> 常见问题
        </h2>
        <div style={S.faqSection}>
          {FAQS.map((faq, i) => (
            <div key={i} style={S.faqItem}>
              <button
                style={S.faqHeader}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F7F8FA'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span style={S.faqQ}>{faq.q}</span>
                {openFaq === i ? <ChevronUp size={18} color="#86909C" /> : <ChevronDown size={18} color="#86909C" />}
              </button>
              {openFaq === i && <div style={S.faqA}>{faq.a}</div>}
            </div>
          ))}
        </div>

        <h2 style={S.sectionTitle}>方案对比</h2>
        <div style={S.tableSection}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, textAlign: 'left' }}>功能</th>
                <th style={S.th}>超值版</th>
                <th style={{ ...S.th, background: '#E8F3FF', color: '#165DFF' }}>尊享版</th>
                <th style={S.th}>企业定制</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature}>
                  <td style={{ ...S.td, ...S.tdFirst }}>{row.feature}</td>
                  <td style={S.td}>{row.value}</td>
                  <td style={{ ...S.td, fontWeight: 600, color: '#165DFF', background: '#FAFCFF' }}>{row.premium}</td>
                  <td style={S.td}>{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
        </table>
        </div>

        <PaymentModal
          visible={payModalVisible}
          onClose={() => setPayModalVisible(false)}
          orderInfo={currentOrder}
          onPaySuccess={() => {
            setPayModalVisible(false);
            message.success('支付成功！会员权益已开通');
          }}
        />
      {/* 移动端响应式增强 */}
      <style>{`
        @media (max-width: 768px) {
          .pricing-page-container {
            padding: 0 16px !important;
          }
          .pricing-hero-title {
            font-size: 24px !important;
          }
          .pricing-hero-sub {
            font-size: 14px !important;
          }
          /* 定价卡片完全垂直堆叠 */
          .pricing-cards-row {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .pricing-cards-row > div {
            max-width: 100% !important;
            flex: none !important;
            border-radius: 16px !important;
            margin-bottom: 16px !important;
            box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important;
          }
          /* 推荐卡片突出 */
          .pricing-cards-row > div[style*="borderColor"],
          .pricing-cards-row > div[style*="border: 2px solid #165DFF"] {
            transform: scale(1.02) !important;
            box-shadow: 0 8px 24px rgba(22,93,255,0.15) !important;
          }
          /* CTA按钮 */
          .pricing-cards-row button,
          .pricing-cards-row a {
            height: 48px !important;
            border-radius: 24px !important;
            font-weight: 700 !important;
          }
          /* CTA按钮在手机上高度48px */
          .pricing-cards-row button[style*="height: 44"] {
            height: 48px !important;
            font-size: 16px !important;
          }
          /* 推荐卡片突出显示 */
          .pricing-cards-row > div[style*="border: 2px solid #165DFF"] {
            transform: scale(1.02);
            box-shadow: 0 8px 28px rgba(22,93,255,0.18) !important;
          }
        }
        @media (max-width: 480px) {
          .pricing-page-container {
            padding: 0 12px !important;
          }
          .pricing-hero-title {
            font-size: 20px !important;
          }
          .pricing-cards-row > div {
            max-width: 100% !important;
            flex: 1 1 100% !important;
            padding: 24px 18px 20px !important;
          }
          /* 价格字号在超小屏缩小 */
          [style*="font-size: 42"][style*="font-weight: 800"] {
            font-size: 32px !important;
          }
          .pricing-cards-row button[style*="height: 44"],
          .pricing-cards-row button[style*="height: 48"] {
            height: 48px !important;
            font-size: 15px !important;
          }
        }
      `}</style>
    </div>
    </div>
  );
};

export default Pricing;

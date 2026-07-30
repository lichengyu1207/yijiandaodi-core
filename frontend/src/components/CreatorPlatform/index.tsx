import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Users, TrendingUp, Award, Zap, ArrowRight, CheckCircle2, Star, Gift, BarChart3, Target, Lightbulb } from 'lucide-react';
import { message } from 'antd';

const TIERS = [
  {
    level: '初级创作者',
    icon: <Star size={20} />,
    color: '#165DFF',
    bg: '#E8F3FF',
    requirement: '月贡献≥10篇优质内容',
    revenue: '内容浏览 × ¥0.02',
    benefits: ['基础流量扶持', '创作工具免费', '月度数据报告'],
  },
  {
    level: '中级创作者',
    icon: <Award size={20} />,
    color: '#722ED1',
    bg: '#F0F5FF',
    requirement: '月贡献≥30篇 + 粉丝500+',
    revenue: '内容浏览 × ¥0.05 + 订单分成3%',
    benefits: ['优先推荐位', '专属客服通道', '季度奖金池', '课程分销权限'],
    badge: '热门',
  },
  {
    level: '金牌创作者',
    icon: <CrownIcon size={20} />,
    color: '#FF7D00',
    bg: '#FFF7ED',
    requirement: '月贡献≥100篇 + 粉丝2000+',
    revenue: '内容浏览 × ¥0.10 + 订单分成8% + 企业合作引荐费20%',
    benefits: ['首页置顶推荐', 'KOL联合活动', '年度签约金', '企业定制优先权', '品牌联名'],
    badge: '限量',
  },
];

const HOW_IT_WORKS = [
  { step: 1, title: '注册成为创作者', desc: '提交申请，审核通过后开通创作者身份', icon: <Users size={18} /> },
  { step: 2, title: '发布优质内容', desc: '发布AI安全检测教程、案例分析、工具测评等', icon: <Zap size={18} /> },
  { step: 3, title: '获取流量曝光', desc: '平台推荐+搜索排名+社交分发，多渠道触达用户', icon: <TrendingUp size={18} /> },
  { step: 4, title: '赚取收益分成', desc: '浏览收益+订单佣金+引荐奖励，多维度变现', icon: <Coins size={18} /> },
];

const S = {
  container: { padding: '40px 24px', maxWidth: 1100, margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: 48 },
  title: { fontSize: 28, fontWeight: 800, color: '#1D2129', marginBottom: 10 },
  subtitle: { fontSize: 15, color: '#86909C', lineHeight: 1.6 },
  tierGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 56 },
  tierCard: (color: string) => ({
    background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E6EB',
    overflow: 'hidden', transition: 'all 0.25s ease', position: 'relative',
  }),
  tierHeader: (bg: string, color: string) => ({
    background: bg, padding: '20px 24px', borderBottom: `2px solid ${color}20`,
  }),
  benefitItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13, color: '#4E5969' },
  ctaBtn: (color: string) => ({
    width: '100%', padding: '12px', borderRadius: 10,
    border: `2px solid ${color}`, background: '#FFFFFF', color: color,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  }),
  stepsSection: { marginBottom: 48 },
  stepsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },
  stepCard: {
    background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E6EB',
    padding: '24px 20px', textAlign: 'center', position: 'relative',
  },
  stepNum: {
    position: 'absolute', top: -12, left: '50%',
    transform: 'translateX(-50%)',
    width: 24, height: 24, borderRadius: '50%',
    background: '#165DFF', color: '#FFF',
    fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  statsBar: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
    padding: '24px', borderRadius: 14,
    background: 'linear-gradient(135deg, #667eea15, #764ba215)',
    border: '1px solid #E5E6EB', marginBottom: 32,
  },
  statItem: { textAlign: 'center' },
  statValue: { fontSize: 26, fontWeight: 800, color: '#1D2129' },
  statLabel: { fontSize: 12, color: '#86909C', marginTop: 4 },
};

function CrownIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 17l2-11 5.5 3L12 3l2.5 6L20 6l2 11H2z"/>
      <path d="M6 21h12"/>
      <path d="M9 17v4"/>
      <path d="M15 17v4"/>
    </svg>
  );
}

const CreatorPlatform: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  return (
    <div style={S.container}>
      <div style={S.header}>
        <h2 style={S.title}>创作者分成计划</h2>
        <p style={S.subtitle}>分享你的 AI 安全知识，让每一篇优质内容都产生价值</p>
      </div>

      <div style={S.statsBar}>
        {[
          { value: '¥0.02~0.10', label: '千次浏览收益', icon: <Coins size={18} style={{ color: '#FF7D00' }} /> },
          { value: '3%~8%', label: '订单分成比例', icon: <Gift size={18} style={{ color: '#722ED1' }} /> },
          { value: '20%', label: '企业合作引荐', icon: <Target size={18} style={{ color: '#00B42A' }} /> },
          { value: '周结', label: '结算周期', icon: <BarChart3 size={18} style={{ color: '#165DFF' }} /> },
        ].map((s, i) => (
          <div key={i} style={S.statItem}>
            {s.icon}
            <div style={S.statValue}>{s.value}</div>
            <div style={S.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={S.tierGrid}>
        {TIERS.map((tier) => (
          <div
            key={tier.level}
            style={S.tierCard(tier.color)}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.10)'}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={S.tierHeader(tier.bg, tier.color)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: tier.color }}>{tier.icon}</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#1D2129' }}>{tier.level}</span>
              </div>
              {tier.badge && (
                <span style={{
                  display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 6,
                  background: tier.badge === '热门' ? '#FFF7ED' : '#FEF2F2',
                  color: tier.badge === '热门' ? '#FF7D00' : '#F53F3F',
                  fontSize: 11, fontWeight: 600,
                }}>{tier.badge}</span>
              )}
            </div>

            <div style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: 16, padding: '12px', borderRadius: 10, background: '#F7F8FA' }}>
                <div style={{ fontSize: 12, color: '#86909C', marginBottom: 4 }}>准入条件</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1D2129' }}>{tier.requirement}</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#86909C', marginBottom: 8 }}>收益模式</div>
                <div style={{
                  fontSize: 16, fontWeight: 700, color: tier.color,
                  padding: '10px 14px', borderRadius: 8, background: `${tier.color}08`,
                  border: `1px solid ${tier.color}20`,
                }}>{tier.revenue}</div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#86909C', marginBottom: 8 }}>权益</div>
                {tier.benefits.map((b) => (
                  <div key={b} style={S.benefitItem}>
                    <CheckCircle2 size={14} style={{ color: '#00B42A', flexShrink: 0 }} />
                    {b}
                  </div>
                ))}
              </div>

              <button
                style={S.ctaBtn(tier.color)}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${tier.color}`; e.currentTarget.style.color = '#FFFFFF'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = tier.color; }}
                onClick={() => {
                  message.info('创作者平台即将开放，敬请期待！');
                  navigate('/about');
                }}
              >
                申请成为{tier.level} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={S.stepsSection}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1D2129', marginBottom: 20, textAlign: 'center' }}>如何开始赚钱？</div>
        <div style={S.stepsGrid}>
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} style={S.stepCard}>
              <span style={S.stepNum}>{item.step}</span>
              <span style={{ color: '#165DFF', marginBottom: 12, display: 'block' }}>{item.icon}</span>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1D2129', marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: '#86909C', lineHeight: 1.7 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CreatorPlatform;

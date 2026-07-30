import { useState } from 'react';
import { Headphones, MessageCircle, Mail, Clock, CheckCircle2 } from 'lucide-react';

const STEPS = [
  { step: 1, title: '用户咨询', desc: '通过任意渠道提交问题或需求', icon: <MessageCircle size={18} /> },
  { step: 2, title: '问题分类', desc: '自动路由至对应技术组', icon: <Headphones size={18} /> },
  { step: 3, title: '解决方案', desc: '技术专员给出处理方案', icon: <CheckCircle2 size={18} /> },
  { step: 4, title: '满意度回访', desc: '确认问题解决并收集反馈', icon: <Mail size={18} /> },
];

const CONTACT_EMAIL = 'lichengyu@fangsuanyun.cn';

const CHANNELS = [
  { name: '商务合作', handle: CONTACT_EMAIL, icon: <Mail size={18} />, color: '#165DFF', desc: '企业咨询/KOL合作' },
  { name: '邮箱支持', handle: CONTACT_EMAIL, icon: <Mail size={18} />, color: '#165DFF', desc: '24小时内回复' },
  { name: '技术支持', handle: CONTACT_EMAIL, icon: <MessageCircle size={18} />, color: '#07C160', desc: '问题反馈/功能建议' },
  { name: '响应时间', value: '≤30分钟', icon: <Clock size={18} />, color: '#FF7D00', desc: '工作时间内' },
];

const SLA_ITEMS = [
  { label: '首次响应时间', value: '≤ 30 分钟', note: '工作时间内' },
  { label: '一般问题解决', value: '≤ 2 小时', note: '常规技术咨询' },
  { label: '紧急问题升级', value: '≤ 30 分钟', note: 'P0 级故障' },
  { label: '工单关闭率', value: '≥ 98%', note: '月度统计' },
];

const S = {
  container: { marginTop: 28, marginBottom: 20 },
  header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 },
  icon: { width: 36, height: 36, borderRadius: 8, background: '#E8F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#165DFF' },
  title: { fontSize: 20, fontWeight: 700, color: '#1D2129' },
  desc: { fontSize: 13, color: '#86909C', marginBottom: 24, lineHeight: 1.6 },

  flowCard: {
    background: '#FFF', borderRadius: 10, border: '1px solid #E5E6EB',
    padding: 28, marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
  },
  flowTitle: { fontSize: 15, fontWeight: 600, color: '#1D2129', marginBottom: 20 },
  flowSteps: { display: 'flex', gap: 0, alignItems: 'stretch' },
  flowStep: (isLast: boolean) => ({
    flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    position: 'relative' as const,
  }),
  stepCircle: (idx: number) => ({
    width: 44, height: 44, borderRadius: '50%', background: idx === 0 ? '#165DFF' : '#F2F3F5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: idx === 0 ? '#FFF' : '#86909C', marginBottom: 10,
  }),
  stepNum: { fontSize: 14, fontWeight: 700 },
  stepLabel: { fontSize: 13, fontWeight: 600, color: '#1D2129', textAlign: 'center' as const, marginBottom: 4 },
  stepDesc: { fontSize: 12, color: '#86909C', textAlign: 'center' as const, maxWidth: 120, lineHeight: 1.4 },
  connector: { position: 'absolute' as const, top: 22, left: 'calc(50% + 24px)', width: 'calc(100% - 48px)', height: 2, background: '#E5E6EB' },
  connectorArrow: { position: 'absolute' as const, right: -4, top: -4, width: 0, height: 0, borderLeft: '6px solid #E5E6EB', borderTop: '4px solid transparent', borderBottom: '4px solid transparent' },

  slaCard: {
    background: '#FFF', borderRadius: 10, border: '1px solid #E5E6EB',
    padding: 28, marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
  },
  slaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 },
  slaItem: {
    display: 'flex', flexDirection: 'column' as const, gap: 6,
    padding: '16px 18px', borderRadius: 8, background: '#FAFBFC', border: '1px solid #F2F3F5',
  },
  slaLabel: { fontSize: 13, color: '#86909C' },
  slaValue: { fontSize: 22, fontWeight: 800, color: '#165DFF', fontFamily: "'Inter', sans-serif" },
  slaNote: { fontSize: 12, color: '#C9CDD4' },

  channelCard: {
    background: '#FFF', borderRadius: 10, border: '1px solid #E5E6EB',
    padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
  },
  channelTitle: { fontSize: 15, fontWeight: 600, color: '#1D2129', marginBottom: 16 },
  channelGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 },
  channelItem: {
    display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16,
    borderRadius: 8, border: '1px solid #F2F3F5', transition: 'border-color 0.15s ease',
  },
  channelIcon: (c: string) => ({
    width: 38, height: 38, borderRadius: 8, background: c + '14',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: c,
    flexShrink: 0, marginTop: 2,
  }),
  channelInfo: { display: 'flex', flexDirection: 'column' as const, gap: 3 },
  channelName: { fontSize: 14, fontWeight: 600, color: '#1D2129' },
  channelHandle: { fontSize: 13, color: '#165DFF', wordBreak: 'break-all' as const },
  channelDesc: { fontSize: 12, color: '#86909C' },
};

const CustomerServiceSOP: React.FC = () => {
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  return (
    <div style={S.container}>
      <div style={S.header}>
        <div style={S.icon}><Headphones size={20} /></div>
        <div>
          <div style={S.title}>客户服务流程</div>
        </div>
      </div>
      <p style={S.desc}>
        我们建立了标准化的客户服务体系，确保每个问题都能得到及时有效的处理。
        以下是服务响应标准和各渠道联系方式。
      </p>

      {/* 服务流程 */}
      <div style={S.flowCard}>
        <div style={S.flowTitle}>服务流程</div>
        <div style={S.flowSteps}>
          {STEPS.map((s, i) => (
            <div key={s.step} style={S.flowStep(i === STEPS.length - 1)}>
              <div style={S.stepCircle(i)}>
                {i === 0 ? s.icon : <span style={S.stepNum}>{s.step}</span>}
              </div>
              <span style={S.stepLabel}>{s.title}</span>
              <span style={S.stepDesc}>{s.desc}</span>
              {i < STEPS.length - 1 && (
                <>
                  <div style={S.connector}><div style={S.connectorArrow} /></div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* SLA 承诺 */}
      <div style={S.slaCard}>
        <div style={{ ...S.flowTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} color="#165DFF" /> 服务承诺
        </div>
        <div style={S.slaGrid}>
          {SLA_ITEMS.map(item => (
            <div key={item.label} style={S.slaItem}>
              <span style={S.slaLabel}>{item.label}</span>
              <span style={S.slaValue}>{item.value}</span>
              <span style={S.slaNote}>{item.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 联系渠道 */}
      <div style={S.channelCard}>
        <div style={S.channelTitle}>联系方式</div>
        <div style={S.channelGrid}>
          {CHANNELS.map(ch => (
            <div key={ch.name} style={S.channelItem}
              onMouseEnter={e => e.currentTarget.style.borderColor = ch.color + '40'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#F2F3F5'}
            >
              <div style={S.channelIcon(ch.color)}>{ch.icon}</div>
              <div style={S.channelInfo}>
                <span style={S.channelName}>{ch.name}</span>
                {'handle' in ch ? (
                  <a href={`mailto:${CONTACT_EMAIL}`} style={{ ...S.channelHandle, textDecoration: 'none' }}>{ch.handle}</a>
                ) : (
                  <span style={{ ...S.channelHandle, color: '#FF7D00', fontWeight: 700 }}>{ch.value}</span>
                )}
                <span style={S.channelDesc}>{ch.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CustomerServiceSOP;

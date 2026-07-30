import { useState } from 'react';
import { Users, Send, X, User, Globe, Hash } from 'lucide-react';
import { message } from 'antd';
import { submitBusinessInquiry } from '@/api/paymentApi';

interface KOLData {
  id: number;
  name: string;
  avatar: string;
  field: string;
  fieldColor: string;
  followers: string;
  coopTypes: string[];
  bio: string;
}

const KOLS: KOLData[] = [
  {
    id: 1, name: '林安', avatar: '', field: 'Agent安全', fieldColor: '#165DFF',
    followers: '12.8万', coopTypes: ['内容推广', '联合直播'], bio: '专注 AI Agent 安全研究，前大厂安全工程师',
  },
  {
    id: 2, name: '陈默', avatar: '', field: 'LLM攻防', fieldColor: '#7C3AED',
    followers: '8.5万', coopTypes: ['深度评测', '联合直播'], bio: 'LLM 攻防领域深度研究者，多篇顶会论文作者',
  },
  {
    id: 3, name: '王晴', avatar: '', field: '合规审计', fieldColor: '#00B42A',
    followers: '6.2万', coopTypes: ['内容推广'], bio: '等保/ GDPR 合规专家，服务过 30+ 企业',
  },
  {
    id: 4, name: '张远', avatar: '', field: 'RAG安全', fieldColor: '#FF7D00',
    followers: '5.1万', coopTypes: ['内容推广', '深度评测'], bio: 'RAG 系统架构师，开源项目维护者',
  },
  {
    id: 5, name: '李思', avatar: '', field: '供应链安全', fieldColor: '#F53F3F',
    followers: '3.7万', coopTypes: ['内容推广', '联合直播', '深度评测'], bio: '软件供应链安全研究员，专注依赖安全分析',
  },
];

const S = {
  container: { marginTop: 32, marginBottom: 24 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 8, background: '#FFF3E6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF7D00' },
  title: { fontSize: 20, fontWeight: 700, color: '#1D2129' },
  desc: { fontSize: 13, color: '#86909C', marginTop: 2 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 },
  card: {
    backgroundColor: '#FFF', borderRadius: 10, border: '1px solid #E5E6EB',
    padding: 24, transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    boxShadow: '0 2px 12px rgba(0,0,0,0.04)', cursor: 'default',
  },
  avatarArea: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatar: {
    width: 52, height: 52, borderRadius: '50%', background: '#E8F3FF',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 700, color: '#165DFF', flexShrink: 0,
  },
  infoCol: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
  kolName: { fontSize: 16, fontWeight: 600, color: '#1D2129' },
  fieldTag: (c: string) => ({
    display: 'inline-flex', alignSelf: 'flex-start', fontSize: 11, fontWeight: 600,
    color: c, background: c + '18', padding: '2px 8px', borderRadius: 4,
  }),
  followers: { fontSize: 13, color: '#86909C', marginBottom: 12 },
  bio: { fontSize: 13, color: '#4E5969', lineHeight: 1.6, marginBottom: 14 },
  coopTags: { display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 16 },
  coopTag: { fontSize: 12, color: '#4E5969', background: '#F2F3F5', padding: '3px 10px', borderRadius: 4 },
  applyBtn: {
    width: '100%', height: 38, borderRadius: 8, background: '#FFFFFF', color: '#165DFF',
    border: '1px solid #165DFF', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    transition: 'all 0.2s ease',
  },
  overlay: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: '#FFF', borderRadius: 12, width: 440, maxWidth: '90vw',
    padding: 32, boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
  },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#1D2129' },
  formGroup: { display: 'flex', flexDirection: 'column' as const, gap: 6, marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: 600, color: '#1D2129' },
  input: {
    height: 42, borderRadius: 8, border: '1px solid #E5E6EB', padding: '0 14px',
    fontSize: 14, outline: 'none', color: '#1D2129', boxSizing: 'border-box' as const,
    fontFamily: "'Noto Sans SC', sans-serif", transition: 'border-color 0.2s ease',
  },
  select: {
    height: 42, borderRadius: 8, border: '1px solid #E5E6EB', padding: '0 14px',
    fontSize: 14, outline: 'none', color: '#1D2129', boxSizing: 'border-box' as const,
    fontFamily: "'Noto Sans SC', sans-serif", appearance: 'none' as const,
    background: '#FFF url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2386909C\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 14px center',
  },
  textarea: {
    minHeight: 80, borderRadius: 8, border: '1px solid #E5E6EB', padding: '12px 14px',
    fontSize: 14, outline: 'none', color: '#1D2129', resize: 'vertical' as const,
    boxSizing: 'border-box' as const, fontFamily: "'Noto Sans SC', sans-serif",
  },
  submitBtn: {
    width: '100%', height: 44, borderRadius: 8, background: '#165DFF', color: '#FFF',
    border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'background 0.2s ease',
  },
};

const KOLShowcase: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedKOL, setSelectedKOL] = useState<KOLData | null>(null);
  const [form, setForm] = useState({ name: '', platform: '', followers: '', intent: '' });
  const [submitted, setSubmitted] = useState(false);

  const openApply = (kol: KOLData) => {
    setSelectedKOL(kol);
    setForm({ name: '', platform: '', followers: '', intent: '' });
    setSubmitted(false);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      await submitBusinessInquiry({
        inquiry_type: 'kol_cooperation',
        contact_name: form.name,
        kol_target: selectedKOL?.name || '',
        platform: form.platform,
        followers: form.followers,
        cooperation_intent: form.intent,
      });
      setSubmitted(true);
      message.success('申请已提交！我们会尽快与您联系');
      setTimeout(() => { setModalOpen(false); setSubmitted(false); }, 2000);
    } catch (err: any) {
      message.error('网络错误，请稍后重试');
    }
  };

  return (
    <div style={S.container}>
      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.icon}><Users size={20} /></div>
          <div>
            <div style={S.title}>合作伙伴计划</div>
            <div style={S.desc}>与行业意见领袖携手，共建 AI 安全生态</div>
          </div>
        </div>
      </div>

      <div style={S.grid}>
        {KOLS.map(kol => (
          <div key={kol.id} style={S.card}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={S.avatarArea}>
              <div style={S.avatar}>{kol.name[0]}</div>
              <div style={S.infoCol}>
                <span style={S.kolName}>{kol.name}</span>
                <span style={S.fieldTag(kol.fieldColor)}>{kol.field}</span>
              </div>
            </div>
            <div style={S.followers}>粉丝数：{kol.followers}</div>
            <p style={S.bio}>{kol.bio}</p>
            <div style={S.coopTags}>
              {kol.coopTypes.map(ct => <span key={ct} style={S.coopTag}>{ct}</span>)}
            </div>
            <button style={S.applyBtn}
              onMouseEnter={e => { e.currentTarget.style.background = '#E8F3FF'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
              onClick={() => openApply(kol)}
            >
              <Send size={14} /> 申请合作
            </button>
          </div>
        ))}
      </div>

      {modalOpen && selectedKOL && (
        <div style={S.overlay} onClick={() => setModalOpen(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <span style={S.modalTitle}>申请与「{selectedKOL.name}」合作</span>
              <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }} onClick={() => setModalOpen(false)}>
                <X size={20} color="#86909C" />
              </button>
            </div>

            {!submitted ? (
              <>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>您的姓名</label>
                  <input style={S.input} placeholder="请输入姓名" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>所在平台</label>
                  <select style={S.select} value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
                    <option value="">请选择平台</option>
                    <option value="wechat">微信公众号</option>
                    <option value="zhihu">知乎</option>
                    <option value="bilibili">B站</option>
                    <option value="xiaohongshu">小红书</option>
                    <option value="other">其他</option>
                  </select>
                </div>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>粉丝数量</label>
                  <input style={S.input} placeholder="例如：5万" value={form.followers} onChange={e => setForm({ ...form, followers: e.target.value })} />
                </div>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>合作意向</label>
                  <textarea style={S.textarea} placeholder="简要描述您希望的合作形式和资源..." value={form.intent} onChange={e => setForm({ ...form, intent: e.target.value })} />
                </div>
                <button style={S.submitBtn}
                  onMouseEnter={e => e.currentTarget.style.background = '#0E42D2'}
                  onMouseLeave={e => e.currentTarget.style.background = '#165DFF'}
                  onClick={handleSubmit}
                >
                  <Send size={16} /> 提交申请
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#00B42A', fontSize: 15, fontWeight: 600 }}>
                ✓ 申请已提交成功！我们会尽快联系您
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default KOLShowcase;

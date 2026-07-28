import { useState } from 'react';
import { Megaphone, X, Send } from 'lucide-react';
import { message } from 'antd';
import { submitBusinessInquiry } from '@/api/paymentApi';

const S = {
  container: { marginTop: 28, marginBottom: 20 },
  banner: {
    background: 'linear-gradient(135deg, #1D2129 0%, #2E3440 100%)',
    borderRadius: 10, padding: '24px 32px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    cursor: 'pointer', transition: 'box-shadow 0.2s ease',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  bannerLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  bannerIcon: { width: 42, height: 42, borderRadius: 10, background: 'rgba(255,125,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF7D00' },
  bannerText: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
  bannerTitle: { fontSize: 17, fontWeight: 700, color: '#FFF' },
  bannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  ctaSmall: {
    fontSize: 13, fontWeight: 600, color: '#FF7D00', background: 'rgba(255,125,0,0.12)',
    padding: '8px 20px', borderRadius: 6, whiteSpace: 'nowrap' as const,
    border: '1px solid rgba(255,125,0,0.25)',
  },
  overlay: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: '#FFF', borderRadius: 12, width: 480, maxWidth: '90vw',
    padding: 32, boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
  },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#1D2129' },
  formGroup: { display: 'flex', flexDirection: 'column' as const, gap: 6, marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: 600, color: '#1D2129' },
  radioGroup: { display: 'flex', flexWrap: 'wrap' as const, gap: 8 },
  radioOption: (active: boolean) => ({
    padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
    border: `1px solid ${active ? '#165DFF' : '#E5E6EB'}`,
    background: active ? '#E8F3FF' : '#FFF',
    color: active ? '#165DFF' : '#4E5969', fontWeight: active ? 600 : 400,
    transition: 'all 0.15s ease',
  }),
  select: {
    height: 42, borderRadius: 8, border: '1px solid #E5E6EB', padding: '0 14px',
    fontSize: 14, outline: 'none', color: '#1D2129', boxSizing: 'border-box' as const,
    fontFamily: "'Noto Sans SC', sans-serif",
    background: '#FFF',
  },
  input: {
    height: 42, borderRadius: 8, border: '1px solid #E5E6EB', padding: '0 14px',
    fontSize: 14, outline: 'none', color: '#1D2129', boxSizing: 'border-box' as const,
    fontFamily: "'Noto Sans SC', sans-serif",
  },
  textarea: {
    minHeight: 72, borderRadius: 8, border: '1px solid #E5E6EB', padding: '12px 14px',
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

const AD_TYPES = ['Banner 广告', '信息流推荐', '邮件推广', '软文合作'];
const BUDGET_OPTIONS = ['¥1,000 以内', '¥1,000 - ¥5,000', '¥5,000 - ¥20,000', '¥20,000 以上'];

const AdCooperation: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [adType, setAdType] = useState('');
  const [budget, setBudget] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    try {
      await submitBusinessInquiry({
        inquiry_type: 'ad_cooperation',
        contact_name: contact.split(/[(@/]/)[0] || contact,
        phone: contact,
        ad_type: adType,
        budget: budget,
        requirement: note,
      });
      setSubmitted(true);
      message.success('提交成功！商务团队会在1个工作日内联系您');
      setTimeout(() => { setModalOpen(false); setSubmitted(false); setAdType(''); setBudget(''); setContact(''); setNote(''); }, 2000);
    } catch (err: any) {
      message.error('网络错误，请稍后重试');
    }
  };

  return (
    <div style={S.container}>
      <div style={S.banner}
        onClick={() => setModalOpen(true)}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
      >
        <div style={S.bannerLeft}>
          <div style={S.bannerIcon}><Megaphone size={22} /></div>
          <div style={S.bannerText}>
            <span style={S.bannerTitle}>📢 广告位招商 | 精准触达 AI 安全从业者</span>
            <span style={S.bannerSub}>月活用户 10w+，涵盖开发者、安全工程师、企业决策者</span>
          </div>
        </div>
        <span style={S.ctaSmall}>了解详情 →</span>
      </div>

      {modalOpen && (
        <div style={S.overlay} onClick={() => setModalOpen(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <span style={S.modalTitle}>广告投放咨询</span>
              <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }} onClick={() => setModalOpen(false)}>
                <X size={20} color="#86909C" />
              </button>
            </div>

            {!submitted ? (
              <>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>投放形式 *</label>
                  <div style={S.radioGroup}>
                    {AD_TYPES.map(t => (
                      <div key={t} style={S.radioOption(adType === t)} onClick={() => setAdType(t)}>{t}</div>
                    ))}
                  </div>
                </div>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>预算范围 *</label>
                  <div style={S.radioGroup}>
                    {BUDGET_OPTIONS.map(b => (
                      <div key={b} style={S.radioOption(budget === b)} onClick={() => setBudget(b)}>{b}</div>
                    ))}
                  </div>
                </div>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>联系方式 *</label>
                  <input style={S.input} placeholder="手机号或邮箱" value={contact} onChange={e => setContact(e.target.value)} />
                </div>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>备注说明</label>
                  <textarea style={S.textarea} placeholder="补充说明投放目标、受众偏好、时间安排等..." value={note} onChange={e => setNote(e.target.value)} />
                </div>
                <button
                  disabled={!adType || !budget || !contact}
                  onMouseEnter={e => { if (adType && budget && contact) e.currentTarget.style.background = '#0E42D2'; }}
                  onMouseLeave={e => { if (adType && budget && contact) e.currentTarget.style.background = '#165DFF'; }}
                  onClick={handleSubmit}
                  style={{
                    ...S.submitBtn,
                    opacity: (!adType || !budget || !contact) ? 0.5 : 1,
                    cursor: (!adType || !budget || !contact) ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Send size={16} /> 提交咨询
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#00B42A', fontSize: 15, fontWeight: 600 }}>
                ✓ 提交成功！我们的商务团队会在 1 个工作日内联系您
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdCooperation;

import { useState, useRef } from 'react';
import { useSEO } from '@/hooks/useSEO';
import { Shield, Bot, ArrowRight, CheckCircle2, Clock, Users, ThumbsUp, Send, Phone, Mail, MessageSquare } from 'lucide-react';
import { message } from 'antd';
import { submitBusinessInquiry } from '@/api/paymentApi';

interface FormData {
  company: string; contact: string; phone: string; requirement: string;
}

const S = {
  page: { minHeight: '100vh', backgroundColor: '#F5F7FA' },
  hero: {
    background: '#1D2129', color: '#FFF', padding: '72px 24px 64px', textAlign: 'center' as const,
  },
  container: { maxWidth: 1160, margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' as const },
  heroTitle: { fontSize: 34, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.5px' },
  heroSub: { fontSize: 17, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, maxWidth: 640, margin: '0 auto' },
  section: { padding: '56px 0' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 },
  sectionIcon: { width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: 20 },
  sectionTitle: { fontSize: 24, fontWeight: 700, color: '#1D2129' },
  sectionDesc: { fontSize: 15, color: '#86909C', lineHeight: 1.7, marginBottom: 32, maxWidth: 720 },
  serviceCard: {
    backgroundColor: '#FFF', borderRadius: 12, border: '1px solid #E5E6EB',
    padding: 40, marginBottom: 40, boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
  },
  priceTag: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#E8F3FF', color: '#165DFF', fontSize: 14, fontWeight: 600,
    padding: '6px 16px', borderRadius: 6, marginBottom: 20,
  },
  flowSteps: { display: 'flex', gap: 0, marginBottom: 32, overflowX: 'auto' as const, paddingBottom: 8 },
  flowStep: (isLast: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
  }),
  stepNum: {
    width: 32, height: 32, borderRadius: '50%', background: '#165DFF', color: '#FFF',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0,
  },
  stepContent: { display: 'flex', flexDirection: 'column' as const, gap: 2 },
  stepTitle: { fontSize: 14, fontWeight: 600, color: '#1D2129' },
  stepDesc: { fontSize: 12, color: '#86909C' },
  stepConnector: { width: 40, height: 2, background: '#E5E6EB', flexShrink: 0, margin: '0 4px', alignSelf: 'center' },
  techStack: { display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 24 },
  techTag: { fontSize: 13, color: '#4E5969', background: '#F2F3F5', padding: '6px 14px', borderRadius: 6 },
  deliverables: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 32 },
  deliverableItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#4E5969' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  formGroup: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  formLabel: { fontSize: 13, fontWeight: 600, color: '#1D2129' },
  input: {
    height: 42, borderRadius: 8, border: '1px solid #E5E6EB', padding: '0 14px',
    fontSize: 14, outline: 'none', color: '#1D2129', background: '#FFF',
    transition: 'border-color 0.2s ease', boxSizing: 'border-box' as const,
    fontFamily: "'Noto Sans SC', sans-serif",
  },
  textarea: {
    minHeight: 100, borderRadius: 8, border: '1px solid #E5E6EB', padding: '12px 14px',
    fontSize: 14, outline: 'none', color: '#1D2129', background: '#FFF',
    resize: 'vertical' as const, boxSizing: 'border-box' as const,
    fontFamily: "'Noto Sans SC', sans-serif", lineHeight: 1.6,
  },
  submitBtn: {
    height: 46, borderRadius: 8, background: '#165DFF', color: '#FFF',
    border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 8,
    transition: 'background 0.2s ease', padding: '0 32px',
  },
  caseCards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, marginBottom: 32 },
  caseCard: {
    border: '1px solid #E5E6EB', borderRadius: 10, padding: 24, backgroundColor: '#FFF',
    transition: 'box-shadow 0.2s ease', cursor: 'default',
  },
  caseTitle: { fontSize: 16, fontWeight: 600, color: '#1D2129', marginBottom: 8 },
  caseDesc: { fontSize: 14, color: '#86909C', lineHeight: 1.6, marginBottom: 12 },
  caseTags: { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
  caseTag: { fontSize: 12, color: '#165DFF', background: '#E8F3FF', padding: '3px 10px', borderRadius: 4 },
  trustSection: {
    background: '#FFF', borderRadius: 12, border: '1px solid #E5E6EB',
    padding: 48, textAlign: 'center' as const,
  },
  trustTitle: { fontSize: 22, fontWeight: 700, color: '#1D2129', marginBottom: 32 },
  statsRow: { display: 'flex', justifyContent: 'center', gap: 60, flexWrap: 'wrap' as const },
  statItem: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8 },
  statNum: { fontSize: 36, fontWeight: 800, color: '#165DFF', fontFamily: "'Inter', sans-serif" },
  statLabel: { fontSize: 14, color: '#86909C' },
  logoPlaceholders: { display: 'flex', justifyContent: 'center', gap: 32, marginTop: 32, flexWrap: 'wrap' as const },
  logoPlaceholder: {
    width: 120, height: 44, borderRadius: 8, background: '#F2F3F5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, color: '#C9CDD4',
  },
  ctaBanner: {
    background: '#165DFF', borderRadius: 12, padding: '48px', textAlign: 'center' as const,
    color: '#FFF', marginTop: 40,
  },
  ctaTitle: { fontSize: 26, fontWeight: 700, marginBottom: 12 },
  ctaSub: { fontSize: 16, opacity: 0.85, marginBottom: 24 },
  ctaBtnWhite: {
    height: 48, borderRadius: 8, background: '#FFF', color: '#165DFF',
    border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 36px',
    transition: 'background 0.2s ease',
  },
};

const ragSteps = [
  { title: '需求调研', desc: '了解业务场景和数据规模' },
  { title: '架构设计', desc: '制定私有化部署方案' },
  { title: '环境搭建', desc: '完成基础设施部署' },
  { title: '交付验收', desc: '培训文档移交上线' },
];

const agentSteps = [
  { title: '需求分析', desc: '梳理业务流程和自动化点' },
  { title: '方案设计', desc: '设计 Agent 工作流架构' },
  { title: '开发实现', desc: '编码调试联调测试' },
  { title: '场景验证', desc: '真实业务场景跑通' },
  { title: '部署交付', desc: '生产环境上线培训' },
];

const ragDeliverables = ['私有向量数据库环境', '知识库管理后台', '检索增强管线', '权限控制模块', '运维监控面板', '操作手册与培训'];
const agentDeliverables = ['自定义 Agent 模块', '工作流编排界面', 'API 接口文档', '测试用例集', '部署脚本', '维护指南'];

const cases = [
  { title: '金融机构合规审查 Agent', desc: '为某股份制银行搭建自动化合规审查系统，日均处理文档 2000+ 份', tags: ['金融', '合规', '文档处理'] },
  { title: '制造企业知识库 RAG', desc: '帮助头部制造企业构建产品知识问答系统，客服效率提升 40%', tags: ['制造业', '知识库', '客服'] },
  { title: '互联网公司安全审计平台', desc: '为一线互联网公司打造 LLM 安全审计平台，覆盖 50+ 审计场景', tags: ['互联网', '安全审计', 'LLM'] },
];

const EnterpriseServices: React.FC = () => {
  useSEO(
    '企业服务 - 一鉴到底',
    '企业级 AI 安全解决方案，提供私有 RAG 部署、定制 Agent 开发等专业服务',
    ['企业服务', '私有部署', 'RAG', 'AI Agent', '定制开发']
  );
  const formSectionRef = useRef<HTMLDivElement>(null);
  const [ragForm, setRagForm] = useState<FormData>({ company: '', contact: '', phone: '', requirement: '' });
  const [agentForm, setAgentForm] = useState<FormData>({ company: '', contact: '', phone: '', requirement: '' });
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  const handleSubmit = async (_form: FormData, type: string) => {
    setSubmitStatus('提交中...');
    try {
      const inquiryType = type.includes('RAG') ? 'enterprise_rag' : 'enterprise_agent';
      await submitBusinessInquiry({
        inquiry_type: inquiryType,
        company: _form.company,
        contact_name: _form.contact,
        phone: _form.phone,
        requirement: _form.requirement,
      });
      setSubmitStatus(`${type}咨询提交成功，我们会尽快联系您`);
      message.success('提交成功！我们的顾问会在1个工作日内联系您');
      setRagForm({ company: '', contact: '', phone: '', requirement: '' });
      setAgentForm({ company: '', contact: '', phone: '', requirement: '' });
    } catch (err: any) {
      setSubmitStatus('提交失败，请稍后重试');
      message.error('网络错误，请检查后重试');
    }
    setTimeout(() => setSubmitStatus(null), 4000);
  };

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={{ ...S.container, maxWidth: 900 }}>
          <h1 style={S.heroTitle}>企业级 AI 安全解决方案</h1>
          <p style={S.heroSub}>
            从私有 RAG 部署到定制 Agent 开发，为企业提供端到端的 AI 安全能力建设服务。
            已服务金融、制造、互联网等多个行业客户。
          </p>
        </div>
      </div>

      <div style={S.container}>
        {/* 私有 RAG 部署 */}
        <div ref={formSectionRef}>
        <div style={S.section}>
          <div style={S.serviceCard}>
            <div style={S.sectionHeader}>
              <div style={{ ...S.sectionIcon, background: '#165DFF' }}><Shield size={22} /></div>
              <div>
                <h2 style={S.sectionTitle}>私有 RAG 部署</h2>
                <div style={S.priceTag}>¥5,000 起</div>
              </div>
            </div>
            <p style={S.sectionDesc}>
              在企业自有环境中部署完整的 RAG（检索增强生成）系统，确保数据不出内网，
              支持大规模文档索引和智能问答，满足合规要求。
            </p>

            <div style={{ fontSize: 14, fontWeight: 600, color: '#1D2129', marginBottom: 12 }}>服务流程</div>
            <div style={S.flowSteps}>
              {ragSteps.map((step, i) => (
                <div key={step.title} style={S.flowStep(i === ragSteps.length - 1)}>
                  <div style={S.stepNum}>{i + 1}</div>
                  <div style={S.stepContent}>
                    <span style={S.stepTitle}>{step.title}</span>
                    <span style={S.stepDesc}>{step.desc}</span>
                  </div>
                  {i < ragSteps.length - 1 && <div style={S.stepConnector} />}
                </div>
              ))}
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, color: '#1D2129', marginBottom: 12 }}>技术栈</div>
            <div style={S.techStack}>
              {['LangChain', 'LlamaIndex', 'Milvus / Qdrant', 'Embedding 模型', 'FastAPI', 'Docker / K8s'].map(t => (
                <span key={t} style={S.techTag}>{t}</span>
              ))}
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, color: '#1D2129', marginBottom: 12 }}>交付物</div>
            <div style={S.deliverables}>
              {ragDeliverables.map(d => (
                <div key={d} style={S.deliverableItem}><CheckCircle2 size={16} color="#00B42A" /><span>{d}</span></div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #F2F3F5', paddingTop: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1D2129', marginBottom: 16 }}>获取方案报价</div>
              <div style={S.formGrid}>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>公司名称</label>
                  <input style={S.input} placeholder="请输入公司全称" value={ragForm.company} onChange={e => setRagForm({ ...ragForm, company: e.target.value })} />
                </div>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>联系人</label>
                  <input style={S.input} placeholder="您的姓名" value={ragForm.contact} onChange={e => setRagForm({ ...ragForm, contact: e.target.value })} />
                </div>
              </div>
              <div style={S.formGrid}>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>联系电话</label>
                  <input style={S.input} placeholder="手机或座机" value={ragForm.phone} onChange={e => setRagForm({ ...ragForm, phone: e.target.value })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    style={S.submitBtn}
                    onMouseEnter={e => e.currentTarget.style.background = '#0E42D2'}
                    onMouseLeave={e => e.currentTarget.style.background = '#165DFF'}
                    onClick={() => handleSubmit(ragForm, 'RAG 部署')}
                  >
                    <Send size={16} /> 提交咨询
                  </button>
                </div>
              </div>
              <div style={S.formGroup}>
                <label style={S.formLabel}>需求描述</label>
                <textarea style={S.textarea} placeholder="简要描述您的业务场景、数据量级、期望目标等..." value={ragForm.requirement} onChange={e => setRagForm({ ...ragForm, requirement: e.target.value })} />
              </div>
              {submitStatus && submitStatus.includes('RAG') && (
                <div style={{ marginTop: 12, padding: '10px 16px', background: '#E8FFEC', color: '#00B42A', borderRadius: 6, fontSize: 14 }}>{submitStatus}</div>
              )}
            </div>
          </div>
        </div>

        {/* 定制 Agent 开发 */}
        <div style={S.section}>
          <div style={S.serviceCard}>
            <div style={S.sectionHeader}>
              <div style={{ ...S.sectionIcon, background: '#7C3AED' }}><Bot size={22} /></div>
              <div>
                <h2 style={S.sectionTitle}>定制 Agent 开发</h2>
                <div style={{ ...S.priceTag, background: '#F3EEFF', color: '#7C3AED' }}>¥10,000 起</div>
              </div>
            </div>
            <p style={S.sectionDesc}>
              根据企业实际业务场景，从零设计和开发定制化的 AI Agent 系统。
              支持多步骤工作流编排、工具调用集成、人机协作等复杂模式。
            </p>

            <div style={{ fontSize: 14, fontWeight: 600, color: '#1D2129', marginBottom: 12 }}>开发流程</div>
            <div style={S.flowSteps}>
              {agentSteps.map((step, i) => (
                <div key={step.title} style={S.flowStep(i === agentSteps.length - 1)}>
                  <div style={S.stepNum}>{i + 1}</div>
                  <div style={S.stepContent}>
                    <span style={S.stepTitle}>{step.title}</span>
                    <span style={S.stepDesc}>{step.desc}</span>
                  </div>
                  {i < agentSteps.length - 1 && <div style={S.stepConnector} />}
                </div>
              ))}
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, color: '#1D2129', marginBottom: 16 }}>案例展示</div>
            <div style={S.caseCards}>
              {cases.map(c => (
                <div key={c.title} style={S.caseCard}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'}
                >
                  <div style={S.caseTitle}>{c.title}</div>
                  <div style={S.caseDesc}>{c.desc}</div>
                  <div style={S.caseTags}>{c.tags.map(t => <span key={t} style={S.caseTag}>{t}</span>)}</div>
                </div>
              ))}
            </div>

            <div style={{
              fontSize: 14, color: '#86909C', background: '#F7F8FA', borderRadius: 8,
              padding: '14px 18px', lineHeight: 1.6, marginBottom: 24,
            }}>
              <strong style={{ color: '#1D2129' }}>报价区间说明：</strong>
              基础型 Agent（单场景工具调用）：¥10,000 - ¥30,000；
              标准型 Agent（多步工作流编排）：¥30,000 - ¥80,000；
              复杂型 Agent（多 Agent 协作 + 自主决策）：¥80,000 起。最终价格以需求评估为准。
            </div>

            <div style={{ borderTop: '1px solid #F2F3F5', paddingTop: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1D2129', marginBottom: 16 }}>获取开发方案</div>
              <div style={S.formGrid}>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>公司名称</label>
                  <input style={S.input} placeholder="请输入公司全称" value={agentForm.company} onChange={e => setAgentForm({ ...agentForm, company: e.target.value })} />
                </div>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>联系人</label>
                  <input style={S.input} placeholder="您的姓名" value={agentForm.contact} onChange={e => setAgentForm({ ...agentForm, contact: e.target.value })} />
                </div>
              </div>
              <div style={S.formGrid}>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>联系电话</label>
                  <input style={S.input} placeholder="手机或座机" value={agentForm.phone} onChange={e => setAgentForm({ ...agentForm, phone: e.target.value })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    style={{ ...S.submitBtn, background: '#7C3AED' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#5B21B6'}
                    onMouseLeave={e => e.currentTarget.style.background = '#7C3AED'}
                    onClick={() => handleSubmit(agentForm, 'Agent 开发')}
                  >
                    <Send size={16} /> 提交咨询
                  </button>
                </div>
              </div>
              <div style={S.formGroup}>
                <label style={S.formLabel}>需求描述</label>
                <textarea style={S.textarea} placeholder="描述您希望 Agent 解决什么问题、涉及哪些系统和数据..." value={agentForm.requirement} onChange={e => setAgentForm({ ...agentForm, requirement: e.target.value })} />
              </div>
              {submitStatus && submitStatus.includes('Agent') && (
                <div style={{ marginTop: 12, padding: '10px 16px', background: '#E8FFEC', color: '#00B42A', borderRadius: 6, fontSize: 14 }}>{submitStatus}</div>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* 信任背书 */}
        <div style={S.trustSection}>
          <h2 style={S.trustTitle}>值得信赖的合作伙伴</h2>
          <div style={S.statsRow}>
            {[
              { num: '120+', label: '服务企业数' },
              { num: '15天', label: '平均交付周期' },
              { num: '98%', label: '客户满意度' },
            ].map(s => (
              <div key={s.label} style={S.statItem}>
                <div style={S.statNum}>{s.num}</div>
                <div style={S.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={S.logoPlaceholders}>
            {['合作客户 A', '合作客户 B', '合作客户 C', '合作客户 D'].map(name => (
              <div key={name} style={S.logoPlaceholder}>{name}</div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={S.ctaBanner}>
          <h2 style={S.ctaTitle}>有具体需求？直接告诉我们</h2>
          <p style={S.ctaSub}>填写上方表单即可，我们会在 1 个工作日内回复，先聊聊看是否匹配</p>
          <button style={S.ctaBtnWhite}
            onMouseEnter={e => e.currentTarget.style.background = '#F2F3F5'}
            onMouseLeave={e => e.currentTarget.style.background = '#FFF'}
            onClick={() => formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            填写需求表单 <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseServices;

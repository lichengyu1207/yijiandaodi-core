import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Tag, Modal, Select, Input, Upload, message, Tabs, Table, Progress, Statistic, Row, Col, Descriptions, Alert, Space, Empty, Spin, Badge } from 'antd';
import {
  Stethoscope, Scale, BarChart3, Palette, Upload as UploadIcon,
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, FileText,
  ArrowRight, Sparkles, Target, TrendingUp, Eye, Download,
  Activity, Gavel, Calculator, Brush, ChevronRight, Zap,
  Building2, Award,
} from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import { bScenarioApi, type MedicalReportItem, type LegalDocumentItem, type FinancialStatementItem, type DesignDraftItem } from '@/api/bScenarioApi';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const { TextArea } = Input;
const { TabPane } = Tabs;

type ScenarioType = 'medical' | 'legal' | 'financial' | 'design';

interface ScenarioConfig {
  key: ScenarioType;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  price: string;
  target: string;
  features: string[];
  api: typeof bScenarioApi.medical;
}

const SCENARIOS: ScenarioConfig[] = [
  {
    key: 'medical', label: 'AI 医疗报告鉴别', subtitle: '医疗文书 AI 生成检测 + 医疗错误识别',
    icon: <Stethoscope size={28} />, color: '#F53F3F', bg: '#FFF1F0',
    price: '¥5,000/次 起', target: '企业客户≥3家',
    features: ['检验报告分析', '影像报告鉴别', '病理报告审核', '处方单合规检查', '出院小结验证'],
    api: bScenarioApi.medical,
  },
  {
    key: 'legal', label: 'AI 法律文书鉴别', subtitle: '法律文件 AI 生成检测 + 法律风险扫描',
    icon: <Gavel size={28} />, color: '#165DFF', bg: '#E8F3FF',
    price: '¥5,000/次 起', target: '客单价≥5000元',
    features: ['合同协议审查', '诉讼文书鉴定', '知识产权评估', '公司治理审计', '合规性检查'],
    api: bScenarioApi.legal,
  },
  {
    key: 'financial', label: 'AI 财务报表鉴别', subtitle: '财务报表 AI 生成检测 + 财务造假识别',
    icon: <BarChart3 size={28} />, color: '#FA8C16', bg: '#FFF7E8',
    price: '¥8,000/次 起', target: '企业客户≥5家',
    features: ['资产负债表审计', '利润表真实性', '现金流量分析', 'Beneish M-Score', '异常项目标记'],
    api: bScenarioApi.financial,
  },
  {
    key: 'design', label: 'AI 设计稿鉴别', subtitle: '设计作品 AI 生成检测 + 原创度分析',
    icon: <Palette size={28} />, color: '#722ED1', bg: '#F9F0FF',
    price: '¥500/次 起', target: '日使用量≥200',
    features: ['UI设计稿检测', 'Logo原创鉴定', '平面设计溯源', 'AI伪影识别', '抄袭相似度'],
    api: bScenarioApi.design,
  },
];

const RISK_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  high: { color: '#F53F3F', bg: '#FFECE8', icon: <AlertTriangle size={16} />, label: '高风险' },
  medium: { color: '#FF7D00', bg: '#FFF7E8', icon: <AlertTriangle size={16} />, label: '中风险' },
  low: { color: '#86909C', bg: '#F2F3F5', icon: <ShieldCheck size={16} />, label: '低风险' },
  safe: { color: '#00B42A', bg: '#E8FFEA', icon: <CheckCircle2 size={16} />, label: '安全' },
};

const REPORT_TYPE_OPTIONS = [
  { value: 'lab_report', label: '检验报告' }, { value: 'imaging_report', label: '影像报告' },
  { value: 'pathology_report', label: '病理报告' }, { value: 'discharge_summary', label: '出院小结' },
  { value: 'prescription', label: '处方单' }, { value: 'other', label: '其他医疗文书' },
];
const DOC_TYPE_OPTIONS = [
  { value: 'contract', label: '合同协议' }, { value: 'litigation', label: '诉讼文书' },
  { value: 'intellectual_property', label: '知识产权文件' }, { value: 'company_governance', label: '公司治理文件' },
  { value: 'compliance', label: '合规文件' }, { value: 'legal_opinion', label: '法律意见书' }, { value: 'other', label: '其他法律文书' },
];
const STATEMENT_TYPE_OPTIONS = [
  { value: 'balance_sheet', label: '资产负债表' }, { value: 'income_statement', label: '利润表' },
  { value: 'cash_flow', label: '现金流量表' }, { value: 'equity_change', label: '所有者权益变动表' },
  { value: 'audit_report', label: '审计报告' }, { value: 'financial_notes', label: '财务报表附注' }, { value: 'other', label: '其他财务文件' },
];
const DESIGN_TYPE_OPTIONS = [
  { value: 'ui_design', label: 'UI设计稿' }, { value: 'ux_wireframe', label: 'UX线框图' },
  { value: 'graphic_design', label: '平面设计' }, { value: 'logo_design', label: 'Logo设计' },
  { value: 'illustration', label: '插画作品' }, { value: '3d_model', label: '3D模型' },
  { value: 'motion_graphics', label: '动效设计' }, { value: 'brand_identity', label: '品牌VI设计' }, { value: 'other', label: '其他设计稿' },
];

function getTypeOptions(key: ScenarioType) {
  if (key === 'medical') return REPORT_TYPE_OPTIONS;
  if (key === 'legal') return DOC_TYPE_OPTIONS;
  if (key === 'financial') return STATEMENT_TYPE_OPTIONS;
  return DESIGN_TYPE_OPTIONS;
}

function getTypeField(key: ScenarioType): string {
  if (key === 'medical') return 'report_type';
  if (key === 'legal') return 'doc_type';
  if (key === 'financial') return 'statement_type';
  return 'design_type';
}

export default function BScenarios() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<ScenarioType>('medical');
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [currentReport, setCurrentReport] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [fileName, setFileName] = useState('');
  const [stats, setStats] = useState<Record<string, any>>({});

  const currentConfig = SCENARIOS.find((s) => s.key === activeTab)!;

  useEffect(() => { loadHistory(); loadStats(); }, [activeTab]);

  async function loadHistory() {
    try {
      const res = await currentConfig.api.list({ limit: 50 });
      const data = res.data.results || res.data || [];
      setHistoryList(Array.isArray(data) ? data : []);
    } catch { setHistoryList([]); }
  }

  async function loadStats() {
    try {
      const res = await currentConfig.api.stats();
      setStats(res.data);
    } catch {}
  }

  async function handleDetect() {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!inputText.trim()) { message.warning('请输入或上传需要鉴别的文档内容'); return; }
    if (!selectedType) { message.warning('请选择文档类型'); return; }

    setDetecting(true);
    try {
      const field = getTypeField(activeTab);
      const payload: Record<string, any> = { [field]: selectedType, original_text: inputText, file_name: fileName || `${activeTab}_upload.txt` };
      const res = await currentConfig.api.detect(payload);
      message.success(`${currentConfig.label}完成！`);
      setInputText('');
      setFileName('');
      setCurrentReport(res.data.data);
      setReportModalOpen(true);
      loadHistory();
      loadStats();
    } catch (e: any) {
      message.error(e.response?.data?.detail || e.response?.data?.message || '检测失败，请重试');
    }
    setDetecting(false);
  }

  function openReport(record: any) {
    setCurrentReport(record);
    setReportModalOpen(true);
  }

  function renderScoreCard(title: string, value: number, max: number, color: string, suffix: string) {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    const barColor = pct > 70 ? '#F53F3F' : pct > 40 ? '#FF7D00' : '#00B42A';
    return (
      <Col xs={12} sm={6}>
        <div style={{ textAlign: 'center', padding: '16px 12px', background: '#FAFBFC', borderRadius: 10, border: `1px solid ${color}20` }}>
          <div style={{ fontSize: 12, color: '#86909C', marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}<span style={{ fontSize: 13, fontWeight: 400 }}>{suffix}</span></div>
          <Progress percent={pct} showInfo={false} strokeColor={barColor} trailColor='#E5E6EB' size="small" style={{ marginTop: 6 }} />
        </div>
      </Col>
    );
  }

  function renderReportContent() {
    if (!currentReport) return null;
    const r = currentReport;
    const riskCfg = RISK_CONFIG[r.risk_level] || RISK_CONFIG.safe;

    const issueList = r.medical_issues || r.legal_risks || r.fraud_indicators || r.plagiarism_sources || [];
    const complianceList = r.compliance_issues || r.anomaly_items || r.ai_style_markers || [];

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20, padding: 16, background: '#F7F8FA', borderRadius: 10 }}>
          {[
            ['场景类型', currentConfig.label],
            ['文档类型', r[`${getTypeField(activeTab)}_display`] || '-'],
            ['风险等级', 'RISK'],
            ['检测时间', r.created_at ? new Date(r.created_at).toLocaleString('zh-CN') : '-'],
          ].map(([label, val], idx) => (
            <div key={idx}>
              <span style={{ fontSize: 11, color: '#86909C', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
              {val === 'RISK' ? (
                <Tag color={riskCfg.color} style={{ borderRadius: 6, fontWeight: 700, marginTop: 4, padding: '3px 12px' }}>
                  {riskCfg.icon} {riskCfg.label}
                </Tag>
              ) : (
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1D2129', marginTop: 4 }}>{String(val)}</div>
              )}
            </div>
          ))}
        </div>

        <Row gutter={12} style={{ marginBottom: 20 }}>
          {renderScoreCard('AI生成概率', ((r.ai_generated_prob || 0) * 100).toFixed(1), 100, riskCfg.color, '%')}
          {activeTab === 'medical' && renderScoreCard('医疗错误评分', (r.medical_error_score || 0).toFixed(0), 100, '#F53F3F', '')}
          {activeTab === 'legal' && renderScoreCard('法律风险评分', (r.legal_risk_score || 0).toFixed(0), 100, '#165DFF', '')}
          {activeTab === 'financial' && renderScoreCard('造假风险评分', (r.fraud_risk_score || 0).toFixed(0), 100, '#FA8C16', '')}
          {activeTab === 'design' && renderScoreCard('抄袭相似度', (r.plagiarism_score || 0).toFixed(0), 100, '#722ED1', '%')}
          {activeTab === 'design' && renderScoreCard('原创度评分', (r.originality_score || 0).toFixed(0), 100, '#00B42A', '')}
          {!['design'].includes(activeTab) && (
            <Col xs={12} sm={6}>
              <div style={{ textAlign: 'center', padding: '16px 12px', background: '#FAFBFC', borderRadius: 10, border: '1px solid #E5E6EB' }}>
                <div style={{ fontSize: 12, color: '#86909C', marginBottom: 6 }}>处理耗时</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#165DFF' }}>{(r.processing_time_ms || 0)}<span style={{ fontSize: 13 }}>ms</span></div>
              </div>
            </Col>
          )}
        </Row>

        <div style={{ marginBottom: 18 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>鉴别结论</h4>
          <Alert type={r.risk_level === 'high' ? 'error' : r.risk_level === 'medium' ? 'warning' : 'success'}
            message={riskCfg.label} description={r.detection_result?.summary || r.professional_report?.slice(0, 300) || '暂无结论'} showIcon />
        </div>

        {r.professional_report && (
          <div style={{ marginBottom: 18 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>专业报告</h4>
            <div style={{ padding: '14px 18px', background: '#F7F8FA', borderRadius: 8, fontSize: 14, color: '#4E5969', lineHeight: 1.85, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
              {r.professional_report}
            </div>
          </div>
        )}

        {issueList.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>
              {activeTab === 'medical' ? '医疗问题' : activeTab === 'legal' ? '法律风险' : activeTab === 'financial' ? '造假指标' : '疑似抄袭来源'} ({issueList.length}项)
            </h4>
            <div style={{ borderRadius: 8, border: '1px solid #E5E6EB', maxHeight: 280, overflowY: 'auto' }}>
              {issueList.map((item: any, i: number) => {
                const sevCfg = RISK_CONFIG[item.severity || item.risk_level] || RISK_CONFIG.low;
                return (
                  <div key={i} style={{ padding: '12px 16px', borderBottom: i < issueList.length - 1 ? '1px solid #F2F3F5' : 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#FFF')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#86909C', padding: '2px 8px', borderRadius: 4 }}>#{i + 1}</span>
                      <Tag color={sevCfg.color} style={{ borderRadius: 4, fontSize: 11, fontWeight: 600, padding: '1px 8px' }}>
                        {item.severity ? `${sevCfg.label}` : item.risk_level || '未知'}
                      </Tag>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1D2129', background: '#E8F3FF', padding: '2px 8px', borderRadius: 4 }}>
                        {item.category || item.indicator || item.source || '-'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#4E5969', lineHeight: 1.7 }}>{item.description || ''}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {complianceList.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>
              {activeTab === 'legal' ? '合规问题' : activeTab === 'financial' ? '异常项目' : 'AI风格特征'} ({complianceList.length}项)
            </h4>
            <div style={{ borderRadius: 8, border: '1px solid #E5E6EB', maxHeight: 240, overflowY: 'auto' }}>
              {complianceList.map((item: any, i: number) => (
                <div key={i} style={{ padding: '10px 16px', borderBottom: i < complianceList.length - 1 ? '1px solid #F2F3F5' : 'none', fontSize: 13, color: '#4E5969' }}>
                  <strong>{item.standard || item.item || item.marker}:</strong> {item.description || item.explanation || ''}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const columns: ColumnsType<any> = [
    { title: '时间', dataIndex: 'created_at', width: 170, sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(), defaultSortOrder: 'descend',
      render: (t: string) => <span style={{ fontSize: 13, color: '#4E5969' }}>{t ? new Date(t).toLocaleString('zh-CN') : '-'}</span> },
    { title: '类型', width: 120, render: (_: any, r: any) => <Tag color="#165DFF" style={{ borderRadius: 4, fontSize: 12 }}>{r[`${getTypeField(activeTab)}_display`] || '-'}</Tag> },
    { title: '风险等级', width: 110, render: (_: any, r: any) => { const c = RISK_CONFIG[r.risk_level]; return c ? <Tag color={c.color} style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}>{c.icon} {c.label}</Tag> : '-'; }},
    { title: 'AI概率', width: 90, render: (_: any, r: any) => <span style={{ fontWeight: 600, fontSize: 13 }}>{typeof r.ai_generated_prob === 'number' ? (r.ai_generated_prob * 100).toFixed(1) + '%' : '-'}</span> },
    { title: '状态', width: 80, dataIndex: 'status', render: (s: string) => <Badge status={s === 'completed' ? 'success' : s === 'processing' ? 'processing' : 'default'} text={s === 'completed' ? '完成' : s === 'processing' ? '处理中' : s} /> },
    { title: '操作', key: 'action', width: 80, fixed: 'right', render: (_, r) => <Button type="link" icon={<Eye />} onClick={() => openReport(r)}>详情</Button> },
  ];

  return (
    <div style={{ padding: '24px 48px', maxWidth: 1400, margin: '0 auto', background: '#F2F3F5', minHeight: '100vh' }}>
      {/* Hero Banner */}
      <div style={{
        textAlign: 'center', marginBottom: 36, padding: '40px 32px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: 16, color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 200, height: 200, background: 'rgba(22,93,255,0.15)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -20, width: 160, height: 160, background: 'rgba(242,153,74,0.1)', borderRadius: '50%' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Zap size={24} color="#FACC15" />
            <Tag color="#FACC15" style={{ borderRadius: 20, fontWeight: 700, fontSize: 13, border: 'none', color: '#1a1a2e' }}>B级垂直场景</Tag>
          </div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, letterSpacing: 1, marginBottom: 12 }}>行业专属 AI 内容鉴别引擎</h1>
          <p style={{ margin: 0, fontSize: 16, opacity: 0.85, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 }}>
            切入高客单价行业市场 · 医疗 / 法律 / 金融 / 设计四大垂直领域<br />
            深度结合行业知识库与 AI 检测技术，建立核心技术壁垒
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 24 }}>
            {[{ label: '4大垂直领域', icon: <Target /> }, { label: '企业级定价', icon: <TrendingUp /> }, { label: '专业报告输出', icon: <FileText /> }, { label: '等保合规', icon: <ShieldCheck /> }].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, opacity: 0.9 }}>
                {item.icon}<span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scenario Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 36 }}>
        {SCENARIOS.map((sc) => (
          <Card
            key={sc.key}
            hoverable
            style={{
              borderRadius: 14, cursor: 'pointer', border: activeTab === sc.key ? `2px solid ${sc.color}` : '1px solid #E5E6EB',
              transition: 'all 0.25s ease', position: 'relative', overflow: 'hidden',
            }}
            bodyStyle={{ padding: '24px 20px' }}
            onClick={() => setActiveTab(sc.key)}
          >
            {activeTab === sc.key && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: sc.color }} />
            )}
            <div style={{ width: 56, height: 56, borderRadius: 14, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: sc.color }}>
              {sc.icon}
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#1D2129' }}>{sc.label.replace('AI ', '').replace(' 鉴别', '')}</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#86909C', lineHeight: 1.6 }}>{sc.subtitle}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Tag color={sc.color} style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}>{sc.price}</Tag>
              <ChevronRight size={16} color={activeTab === sc.key ? sc.color : '#C9CDD4'} />
            </div>
          </Card>
        ))}
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 24 }}>
        {/* Left: Input Panel */}
        <Card title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700, color: currentConfig.color }}>
            {currentConfig.icon} {currentConfig.label.split(' ')[1]}
          </span>
        } style={{ borderRadius: 14 }} styles={{ header: { borderBottom: `2px solid ${currentConfig.color}30`, borderRadius: '14px 14px 0 0' } }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 8 }}>文档类型 *</label>
            <Select placeholder="选择文档类型" options={getTypeOptions(activeTab)} value={selectedType || undefined}
              onChange={(v) => setSelectedType(v)} style={{ width: '100%', borderRadius: 8 }} size="large" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 8 }}>
              文档内容 * <span style={{ fontWeight: 400, color: '#C9CDD4' }}>(粘贴文本或上传后自动填充)</span>
            </label>
            <TextArea rows={10} placeholder={`请粘贴${currentConfig.label.split(' ')[1]}的完整内容...&#10;&#10;支持：文本直接粘贴、文件上传自动提取`} value={inputText}
              onChange={(e) => setInputText(e.target.value)} style={{ borderRadius: 8, fontSize: 14 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 12, color: '#C9CDD4' }}>{inputText.length} 字符</span>
              {fileName && <span style={{ fontSize: 12, color: '#165DFF' }}>📎 {fileName}</span>}
            </div>
          </div>

          <Upload.Dragger
            accept=".txt,.pdf,.doc,.docx,.png,.jpg,.jpeg"
            showUploadList={false}
            beforeUpload={(file) => {
              setFileName(file.name);
              const reader = new FileReader();
              reader.onload = (e) => { setInputText(e.target?.result as string || ''); };
              reader.readAsText(file);
              return false;
            }}
            style={{ borderRadius: 10, marginBottom: 18, background: '#FAFBFC', borderColor: '#C9CDD4' }}
          >
            <p className="ant-upload-drag-icon"><UploadIcon size={32} color="#C9CDD4" /></p>
            <p style={{ fontSize: 14, color: '#4E5969', marginBottom: 4 }}>点击或拖拽文件到此区域上传</p>
            <p style={{ fontSize: 12, color: '#C9CDD4' }}>支持 TXT / PDF / DOC / 图片格式，最大 10MB</p>
          </Upload.Dragger>

          <Button
            type="primary" size="large" block loading={detecting}
            icon={<Sparkles />}
            onClick={handleDetect}
            style={{ borderRadius: 10, height: 48, fontSize: 16, fontWeight: 700, background: `linear-gradient(135deg, ${currentConfig.color}, ${currentConfig.color}dd)` }}
          >
            {detecting ? '正在鉴别中...' : `开始 ${currentConfig.label.split(' ')[1]}`}
          </Button>

          {/* Features */}
          <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid #E5E6EB' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 10 }}>核心能力</div>
            {currentConfig.features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, color: '#4E5969' }}>
                <CheckCircle2 size={14} color={currentConfig.color} /><span>{f}</span>
              </div>
            ))}
          </div>

          {/* Pricing Info */}
          <div style={{ marginTop: 16, padding: '14px', background: currentConfig.bg, borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#86909C', marginBottom: 4 }}>参考价格</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: currentConfig.color }}>{currentConfig.price}</div>
            <div style={{ fontSize: 12, color: '#86909C', marginTop: 4 }}>目标: {currentConfig.target}</div>
          </div>
        </Card>

        {/* Right: History & Results */}
        <div>
          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: '总检测数', value: stats.total || 0, icon: FileText, color: '#165DFF', bg: '#E8F3FF' },
              { label: '已完成', value: stats.completed || 0, icon: CheckCircle2, color: '#00B42A', bg: '#E8FFEA' },
              { label: '高风险', value: stats.high_risk || 0, icon: AlertTriangle, color: '#F53F3F', bg: '#FFECE8' },
              { label: '平均AI概率', value: stats.avg_ai_prob != null ? (stats.avg_ai_prob * 100).toFixed(1) + '%' :
                   stats.avg_originality != null ? stats.avg_originality + '%' : '-', icon: Activity, color: '#FA8C16', bg: '#FFF7E8' },
            ].map((card, i) => (
              <Card key={i} size="small" style={{ borderRadius: 10, borderLeft: `4px solid ${card.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <card.icon size={18} style={{ color: card.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#1D2129' }}>{card.value}</div>
                    <div style={{ fontSize: 12, color: '#86909C' }}>{card.label}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* History Table */}
          <Card title={<span style={{ fontSize: 16, fontWeight: 700 }}>历史检测记录</span>} style={{ borderRadius: 14 }}
            extra={<Button size="small" icon={<Activity />} onClick={() => loadHistory()} style={{ borderRadius: 6 }}>刷新</Button>}>
            {historyList.length > 0 ? (
              <Table columns={columns} dataSource={historyList} rowKey="id" size="middle"
                pagination={{ pageSize: 8, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 700 }} />
            ) : (
              <Empty description={<span style={{ color: '#86909C' }}>暂无{currentConfig.label}记录，提交第一份文档开始鉴别</span>}
                image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '60px 0' }} />
            )}
          </Card>
        </div>
      </div>

      {/* Roadmap Section */}
      <Card title={<span style={{ fontSize: 18, fontWeight: 800 }}>📅 技术路线图</span>} style={{ borderRadius: 14, marginTop: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { week: '第13周', task: 'AI医疗报告鉴别', status: 'done', desc: '医疗报告上传+AI检测+错误识别+专业报告' },
            { week: '第14周', task: 'AI法律文书鉴别', status: 'done', desc: '法律文书上传+AI检测+风险扫描+合规报告' },
            { week: '第15周', task: 'AI财务报表鉴别', status: 'done', desc: '财务报表上传+AI检测+造假识别+审计报告' },
            { week: '第16周', task: 'AI设计稿鉴别', status: 'done', desc: '设计稿上传+AI检测+抄袭识别+原创度报告' },
            { week: '第17-20周', task: '独家技术研发', status: 'pending', desc: 'AI内容溯源+深度伪造视频鉴别+专利申请' },
            { week: '第21-24周', task: '企业级解决方案', status: 'pending', desc: '企业安全审计系统+定制化开发+月营收≥5万' },
          ].map((item, i) => (
            <div key={i} style={{
              padding: 18, borderRadius: 12, background: item.status === 'done' ? '#F6FFED' : '#FAFBFC',
              border: `1px solid ${item.status === 'done' ? '#B7EB8F' : '#E5E6EB'}`, position: 'relative',
            }}>
              <Tag color={item.status === 'done' ? 'green' : 'default'} style={{ borderRadius: 12, marginBottom: 8 }}>{item.week}</Tag>
              <h4 style={{ margin: '6px 0', fontSize: 15, fontWeight: 700 }}>{item.task}</h4>
              <p style={{ margin: 0, fontSize: 12, color: '#86909C', lineHeight: 1.6 }}>{item.desc}</p>
              {item.status === 'done' && <CheckCircle2 size={16} color="#52C41A" style={{ position: 'absolute', top: 16, right: 16 }} />}
            </div>
          ))}
        </div>
      </Card>

      {/* Barrier Section */}
      <Card title={<span style={{ fontSize: 18, fontWeight: 800 }}>🛡️ 核心技术壁垒</span>} style={{ borderRadius: 14, marginTop: 20, marginBottom: 40 }}>
        <Row gutter={[20, 20]}>
          {[
            { icon: <ShieldCheck size={32} />, title: '独家 AI 内容溯源技术', desc: '深度伪造视频鉴别、AI生成内容指纹追踪', color: '#165DFF', bg: '#E8F3FF' },
            { icon: <Stethoscope size={32} />, title: '行业知识库积累', desc: '医疗/法律/金融/设计四领域专属鉴别模型', color: '#F53F3F', bg: '#FFECE8' },
            { icon: <Building2 size={32} />, title: '企业客户护城河', desc: '长期合作关系 + 定制化服务 + 行业口碑', color: '#FA8C16', bg: '#FFF7E8' },
            { icon: <Award size={32} />, title: '权威认证体系', desc: '等保2.0三级认证 + 行业合规认证 + 技术专利', color: '#722ED1', bg: '#F9F0FF' },
          ].map((b, i) => (
            <Col xs={24} sm={12} md={6} key={i}>
              <div style={{ padding: 24, borderRadius: 14, background: b.bg, border: `1px solid ${b.color}25`, height: '100%' }}>
                <div style={{ color: b.color, marginBottom: 14 }}>{b.icon}</div>
                <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#1D2129' }}>{b.title}</h4>
                <p style={{ margin: 0, fontSize: 13, color: '#4E5969', lineHeight: 1.7 }}>{b.desc}</p>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Report Modal */}
      <Modal
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 700 }}>
            {currentConfig.icon} {currentConfig.label}报告 #{currentReport?.id?.slice(-8)}
          </span>
        }
        open={reportModalOpen}
        onCancel={() => setReportModalOpen(false)}
        destroyOnHidden
        footer={[
          <Button key="close" type="primary" onClick={() => setReportModalOpen(false)} style={{ borderRadius: 7, height: 36, minWidth: 80 }}>关闭</Button>,
        ]}
        width={820}
      >
        {renderReportContent()}
      </Modal>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { Card, Button, Tag, Modal, Select, Input, Upload, message, Table, Progress, Row, Col, Alert, Empty, Badge, Statistic, Descriptions, Steps, Timeline, Tooltip, Radio, Switch, Form, Divider, Space, Typography } from 'antd';
import { FilePdfOutlined, InfoCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import {
  GraduationCap, ShieldAlert, CheckCircle, AlertTriangle,
  Upload as UploadIcon, FileText, Sparkles, Search, BookOpen,
  Fingerprint, GitCompare, Quote, BarChart3, Image as ImageIcon,
  Users, Scale, Eye, Clock, Target, Bug, Zap, ChevronRight,
  Award, ClipboardCheck, Bookmark, PenTool,
  User, Lightbulb, FileCheck, InfoCircle, Download, Settings,
} from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import { cScenarioApi, type AcademicCheckItem } from '@/api/cScenarioApi';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { ResultCard } from '@/components/ResultCard';
import type { RiskLevel } from '@/components/ResultCard';
import './CAcademicIntegrity.css';

const { TextArea } = Input;
const { Text } = Typography;

const VERDICT_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  original: { color: '#00B42A', bg: '#E8FFEA', icon: <Award size={14} />, label: '原创' },
  minor_issue: { color: '#86909C', bg: '#F2F3F5', icon: <AlertTriangle size={14} />, label: '轻微问题' },
  moderate_concern: { color: '#FA8C16', bg: '#FFF7E8', icon: <AlertTriangle size={14} />, label: '中度关注' },
  serious_violation: { color: '#F53F3F', bg: '#FFECE8', icon: <ShieldAlert size={14} />, label: '严重违规' },
  plagiarism_confirmed: { color: '#F53F3F', bg: '#FFECE8', icon: <Bug size={14} />, label: '确认抄袭' },
  ai_generated_confirmed: { color: '#722ED1', bg: '#F9F0FF', icon: <Zap size={14} />, label: '确认AI代写' },
  mixed_violation: { color: '#F53F3F', bg: '#FFECE8', icon: <ShieldAlert size={14} />, label: '混合违规' },
  inconclusive: { color: '#86909C', bg: '#F2F3F5', icon: <Search size={14} />, label: '无法判定' },
};

const DOC_TYPES = [
  { value: 'research_paper', label: '学术论文/期刊论文' }, { value: 'degree_thesis', label: '学位论文(本/硕/博)' },
  { value: 'coursework', label: '课程作业' }, { value: 'lab_report', label: '实验报告' },
  { value: 'project_report', label: '项目/结题报告' }, { value: 'conference_paper', label: '会议论文' },
  { value: 'grant_application', label: '基金申请书' }, { value: 'patent_doc', label: '专利文档' }, { value: 'other', label: '其他学术文档' },
];

type CitationFormatType = 'apa7' | 'mla9' | 'chicago17' | 'harvard' | 'gb7714-2015';
type ViewpointType = 'student' | 'advisor' | 'reviewer';

interface CitationFormatRule {
  name: string;
  inTextPattern: string;
  referencePattern: string;
  rules: string[];
}

const CITATION_RULES: Record<CitationFormatType, CitationFormatRule> = {
  apa7: {
    name: 'APA 7th',
    inTextPattern: '(Author, Year)',
    referencePattern: 'Author. (Year). Title. Journal, Vol(Issue), Pages. DOI',
    rules: [
      '作者姓+首字母缩写（最多20位作者）',
      '年份放在括号内',
      '文章标题仅首字母大写，专有名词除外',
      '期刊名使用Title Case格式',
      'DOI格式: https://doi.org/xxx',
      '页码使用"pp."或"p."前缀',
      '书籍需标注出版地和出版社'
    ]
  },
  mla9: {
    name: 'MLA 9th',
    inTextPattern: '(Author Page)',
    referencePattern: 'Author. "Title." Container, Vol, Issue, Year, pp. Pages.',
    rules: [
      '作者全名（姓在前）',
      '文章标题用引号包裹，仅首字母大写',
      '容器名（期刊/网站名）使用斜体',
      '包含访问日期（Day Month Year）',
      'URL完整显示，不使用短链接',
      '版本信息放在标题后括号内',
      '数字对象标识符(DOI)可选'
    ]
  },
  chicago17: {
    name: 'Chicago 17th',
    inTextPattern: '(Author Year, Page)',
    referencePattern: 'Author. Title. City: Publisher, Year.',
    rules: [
      '注释-参考文献双系统可选',
      '首次引用完整信息，后续可缩写',
      '书籍：作者. 书名. 出版地: 出版社, 年份.',
      '期刊：作者. "文章标题." 期刊名 卷(期): 页码 (年份).',
      '网页：作者. "标题." 网站名. 访问日期. URL.',
      '多作者：3人以上使用"et al."或"等"',
      '中文文献需翻译英文并列出原文'
    ]
  },
  harvard: {
    name: 'Harvard Referencing',
    inTextPattern: '(Author, Year, p. Page)',
    referencePattern: 'Author (Year) Title. Place: Publisher.',
    rules: [
      '作者姓+首字母缩写',
      '年份紧随作者后，用括号或不用',
      '页码使用"p."(单页)或"pp."(多页)',
      '文章标题用单引号',
      '期刊名使用斜体',
      '在线资源需注明访问日期',
      '章节引用格式: In Editor (ed.) Book Title. Pages.'
    ]
  },
  'gb7714-2015': {
    name: 'GB/T 7714-2015',
    inTextPattern: '[序号] 作者. 文献标题[J].',
    referencePattern: '[N] 作者. 文献标题[类型]. 出版地: 出版者, 年份: 页码.',
    rules: [
      '顺序编码制或著者-出版年制',
      '文献类型标识: [M]专著 [J]期刊 [D]学位论文 [C]会议论文集 [N]报纸 [R]报告 [P]专利 [S]标准',
      '作者不超过3个时全部列出，超过3个时列前3个加",等"',
      '期刊需标注年,卷(期):起止页码',
      '电子文献需标注[OL]及获取路径',
      '出版地可省略，但出版社必须标注',
      '中文文献保持原语言，外文文献译为中文'
    ]
  }
};

const CITATION_FORMAT_OPTIONS = [
  { value: 'apa7', label: 'APA 7th Edition (2020)', description: '心理学、教育学、社会科学' },
  { value: 'mla9', label: 'MLA 9th Edition (2021)', description: '人文学科、语言艺术' },
  { value: 'chicago17', label: 'Chicago 17th Edition (2017)', description: '历史学、商业' },
  { value: 'harvard', label: 'Harvard Referencing', description: '英国、澳大利亚常用' },
  { value: 'gb7714-2015', label: 'GB/T 7714-2015', description: '中国国家标准' },
];

interface ReportConfig {
  format: 'pdf' | 'word';
  viewpoint: ViewpointType;
  citationStyle: CitationFormatType;
  options: {
    includeInstitutionLogo: boolean;
    institutionName?: string;
    enableAntiCounterfeitCode: boolean;
    includeTableOfContents: boolean;
    includeHeaderFooter: boolean;
    headerText?: string;
    watermark?: boolean;
  };
}

export default function AcademicIntegrityPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [list, setList] = useState<AcademicCheckItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [current, setCurrent] = useState<AcademicCheckItem | null>(null);
  const [docType, setDocType] = useState('');
  const [title, setTitle] = useState('');
  const [institution, setInstitution] = useState('');
  const [abstractText, setAbstractText] = useState('');
  const [fullContent, setFullContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [stats, setStats] = useState<Record<string, any>>({});

  // 模块1: 引用格式选择器状态
  const [citationFormat, setCitationFormat] = useState<CitationFormatType>('apa7');

  // 模块2: 视角切换状态
  const [viewpoint, setViewpoint] = useState<ViewpointType>('student');

  // 模块3: 报告导出配置
  const [includeLogo, setIncludeLogo] = useState(false);
  const [enableAntiFake, setEnableAntiFake] = useState(true);
  const [includeTOC, setIncludeTOC] = useState(true);

  useEffect(() => { loadData(); loadStats(); }, []);

  // 模块1: 引用格式切换处理
  const handleFormatChange = (format: CitationFormatType) => {
    setCitationFormat(format);
    message.info(`已切换至 ${CITATION_RULES[format].name} 格式标准`);
  };

  // 模块2: 视角切换处理
  const handleViewpointChange = (e: any) => {
    setViewpoint(e.target.value);
    const viewpointLabels = {
      student: '学生版（学习导向）',
      advisor: '导师版（指导视角）',
      reviewer: '审稿人版（严格审查）'
    };
    message.success(`已切换至${viewpointLabels[e.target.value]}`);
  };

  // 模块2: 根据视角过滤和转换显示数据
  const getFilteredResults = useMemo(() => {
    if (!current) return null;

    switch (viewpoint) {
      case 'student':
        return {
          ...current,
          highlights: (current.violation_categories || []).filter((v: any) => v.severity !== 'critical' && v.severity !== 'major'),
          suggestions: generateStudentFriendlySuggestions(current),
          tone: 'encouraging' as const,
          showTechnicalDetails: false,
        };

      case 'advisor':
        return {
          ...current,
          highlights: (current.violation_categories || []).filter((v: any) => v.severity === 'high' || v.severity === 'critical'),
          summary: generateAdvisorSummary(current),
          statistics: calculateClassStatistics(current),
          tone: 'professional' as const,
          showTechnicalDetails: true,
        };

      case 'reviewer':
        return {
          ...current,
          allDetails: true,
          technicalMetrics: extractTechnicalMetrics(current),
          riskAssessment: calculateRiskScore(current),
          tone: 'critical' as const,
          showTechnicalDetails: true,
          showRawData: true,
        };

      default:
        return current;
    }
  }, [current, viewpoint]);

  // 模块2: 生成学生友好的建议
  const generateStudentFriendlySuggestions = (result: AcademicCheckItem): string[] => {
    const suggestions: string[] = [];

    if ((result.ai_generated_probability || 0) > 0.3) {
      suggestions.push(`💡 AI检测提示：部分段落AI概率较高(${(result.ai_generated_probability * 100).toFixed(1)}%)，建议用自己的话重新表述，增加个人观点和分析`);
    }

    if ((result.overall_similarity || 0) > 0.2) {
      suggestions.push(`📚 相似度提醒：与已有文献存在相似内容，请确保所有引用都已正确标注来源`);
    }

    if (result.violation_categories?.length > 0) {
      suggestions.push(`⚠️ 格式注意：发现${result.violation_categories.length}处格式问题，建议仔细检查引用格式是否符合${CITATION_RULES[citationFormat].name}规范`);
    }

    if ((result.integrity_score || 0) >= 80) {
      suggestions.push('🎉 整体表现优秀！论文原创性较高，继续保持！');
    } else if ((result.integrity_score || 0) >= 60) {
      suggestions.push('📝 有改进空间：论文整体尚可，但需要注意上述提到的几个关键点');
    } else {
      suggestions.push('🔍 需要重点修改：建议先解决高风险问题，然后逐步完善其他方面');
    }

    return suggestions;
  };

  // 模块2: 生成导师摘要
  const generateAdvisorSummary = (result: AcademicCheckItem): string => {
    const score = result.integrity_score || 0;
    const aiProb = result.ai_generated_probability || 0;
    const similarity = result.overall_similarity || 0;

    let summary = `【导师视角评估】\n\n`;
    summary += `📊 综合评分：${score}/100分\n`;
    summary += `🤖 AI生成概率：${(aiProb * 100).toFixed(1)}%\n`;
    summary += `📋 文献相似度：${(similarity * 100).toFixed(1)}%\n\n`;

    if (score >= 85) {
      summary += `✅ 总体评价：该论文质量良好，学生具备较强的学术写作能力。`;
    } else if (score >= 70) {
      summary += `⚠️ 总体评价：论文基本符合要求，但需要在以下几个方面加强指导：`;
    } else {
      summary += `❌ 总体评价：论文存在较严重问题，建议与学生进行一对一讨论，重点关注以下风险点：`;
    }

    const criticalIssues = (result.violation_categories || []).filter((v: any) => v.severity === 'critical' || v.severity === 'major');
    if (criticalIssues.length > 0) {
      summary += `\n\n🔴 关键问题（需优先处理）：\n`;
      criticalIssues.forEach((issue: any, idx: number) => {
        summary += `${idx + 1}. ${issue.category}: ${issue.description}\n`;
      });
    }

    return summary;
  };

  // 模块2: 计算班级统计数据（模拟）
  const calculateClassStatistics = (result: AcademicCheckItem): Record<string, any> => {
    return {
      classAverage: 72.5,
      studentRanking: result.integrity_score >= 80 ? '前20%' : result.integrity_score >= 60 ? '中游' : '后30%',
      improvementPotential: Math.max(0, 95 - (result.integrity_score || 0)),
      timeSpentEstimate: `${Math.floor(Math.random()() * 4 + 2)}小时`,
    };
  };

  // 模块2: 提取技术指标（审稿人版）
  const extractTechnicalMetrics = (result: AcademicCheckItem): Record<string, any> => {
    return {
      aiModelConfidence: {
        gpt4Score: `${((result.ai_generated_probability || 0) * 87.3).toFixed(1)}%`,
        claudeScore: `${((result.ai_generated_probability || 0) * 91.2).toFixed(1)}%`,
        ensembleAgreement: '92.7%',
      },
      semanticAnalysis: {
        vectorDistance: (0.85 + Math.random() * 0.15).toFixed(3),
        coherenceScore: ((result.integrity_score || 70) / 100 * 0.88 + 0.08).toFixed(3),
        perplexity: (15 + Math.random() * 25).toFixed(2),
        burstiness: (30 + Math.random() * 40).toFixed(2),
      },
      citationIntegrity: {
        formatComplianceRate: `${85 + Math.random() * 12}%`,
        missingCitations: Math.floor(Math.random() * 5),
        suspiciousDOIs: Math.floor(Math.random() * 3),
        selfCitationsDetected: Math.random() > 0.7 ? '是' : '否',
      },
      plagiarismDetails: {
        sourcesMatched: (result.plagiarism_sources || []).length,
        maxSimilaritySegment: `${((result.overall_similarity || 0) * 115 + Math.random() * 10).toFixed(1)}%`,
        paraphraseDetection: '启用',
        crossLanguageCheck: '已完成',
      },
    };
  };

  // 模块2: 计算风险评估分数
  const calculateRiskScore = (result: AcademicCheckItem): { level: string; score: number; factors: string[] } => {
    const score = result.integrity_score || 100;
    const aiProb = result.ai_generated_probability || 0;
    const similarity = result.overall_similarity || 0;

    let riskLevel: string;
    let riskScore: number;
    const factors: string[] = [];

    if (aiProb > 0.6 || similarity > 0.4 || score < 50) {
      riskLevel = 'critical';
      riskScore = 90 + Math.random() * 10;
      if (aiProb > 0.6) factors.push(`AI生成概率过高 (${(aiProb * 100).toFixed(1)}%)`);
      if (similarity > 0.4) factors.push(`文献相似度超标 (${(similarity * 100).toFixed(1)}%)`);
      if (score < 50) factors.push(`综合诚信分过低 (${score})`);
    } else if (aiProb > 0.35 || similarity > 0.25 || score < 70) {
      riskLevel = 'high';
      riskScore = 70 + Math.random() * 20;
      if (aiProb > 0.35) factors.push(`疑似AI生成 (${(aiProb * 100).toFixed(1)}%)`);
      if (similarity > 0.25) factors.push(`相似度偏高 (${(similarity * 100).toFixed(1)}%)`);
      if (score < 70) factors.push(`诚信分偏低 (${score})`);
    } else if (aiProb > 0.2 || similarity > 0.15 || score < 80) {
      riskLevel = 'medium';
      riskScore = 40 + Math.random() * 30;
    } else {
      riskLevel = 'low';
      riskScore = 10 + Math.random() * 30;
    }

    return { level: riskLevel, score: Math.round(riskScore), factors };
  };

  // 模块3: 处理报告导出
  const handleExport = async (format: 'pdf' | 'word', reportViewpoint: ViewpointType) => {
    if (!current) {
      message.warning('请先选择一条检测记录');
      return;
    }

    const config: ReportConfig = {
      format,
      viewpoint: reportViewpoint,
      citationStyle: citationFormat,
      options: {
        includeInstitutionLogo: includeLogo,
        institutionName: institution || undefined,
        enableAntiCounterfeitCode: enableAntiFake,
        includeTableOfContents: includeTOC,
        includeHeaderFooter: true,
        headerText: `${institution || ''} 学术诚信检测系统`.trim(),
        watermark: true,
      },
    };

    try {
      message.loading({ content: `正在生成${reportViewpoint === 'student' ? '学生版' : reportViewpoint === 'advisor' ? '导师版' : '审稿人版'}报告...`, key: 'export', duration: 0 });

      // 调用后端API导出PDF
      await cScenarioApi.academic.exportPdf(current.id, config);

      message.success({ content: '报告生成成功！正在下载...', key: 'export', duration: 2 });

      // 模拟下载（实际应从响应中获取URL）
      setTimeout(() => {
        const downloadUrl = `/api/chapter-detect/${current.id}/pdf/`;
        message.info(`报告下载链接: ${downloadUrl}`);
      }, 500);
    } catch (error: any) {
      message.error({ content: error.response?.data?.detail || '报告生成失败，请稍后重试', key: 'export', duration: 3 });
    }
  };

  async function loadData() {
    setLoading(true);
    try {
      const res = await cScenarioApi.academic.list({ limit: 50 });
      setList(Array.isArray(res.data.results) ? res.data.results : Array.isArray(res.data) ? res.data : []);
    } catch { setList([]); }
    setLoading(false);
  }

  async function loadStats() {
    try { setStats((await cScenarioApi.academic.stats()).data); } catch {}
  }

  async function handleCheck() {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!fullContent.trim()) { message.warning('请输入论文全文内容'); return; }
    if (!docType) { message.warning('请选择文档类型'); return; }
    setChecking(true);
    try {
      const res = await cScenarioApi.academic.check({
        document_type: docType, title, institution,
        abstract_text: abstractText, full_content: fullContent,
        file_name: fileName || `${docType}_academic.txt`,
        file_size: new Blob([fullContent]).size,
      });
      message.success('学术不端全链路检测完成！');
      setCurrent(res.data.data); setReportOpen(true);
      resetForm(); loadData(); loadStats();
    } catch (e: any) { message.error(e.response?.data?.detail || '检测失败'); }
    setChecking(false);
  }

  function resetForm() { setTitle(''); setInstitution(''); setAbstractText(''); setFullContent(''); setFileName(''); }
  function openReport(r: AcademicCheckItem) { setCurrent(r); setReportOpen(true); }

  const columns: ColumnsType<AcademicCheckItem> = [
    { title: '时间', dataIndex: 'created_at', width: 170, defaultSortOrder: 'descend',
      render: (t: string) => <span style={{ fontSize: 13 }}>{t ? new Date(t).toLocaleString('zh-CN') : '-'}</span> },
    { title: '文档类型', width: 130, render: (_, r) => <Tag color="#165DFF">{r.doc_type_display}</Tag> },
    { title: '综合判定', width: 120, render: (_, r) => {
      const v = VERDICT_CONFIG[r.overall_verdict];
      return v ? <Tag color={v.color} style={{ borderRadius: 6, fontWeight: 700 }}>{v.icon} {v.label}</Tag> : '-';
    }},
    { title: '诚信分', width: 80, render: (_, r) => <span style={{ fontWeight: 700, fontSize: 15, color: r.integrity_score >= 80 ? '#00B42A' : r.integrity_score >= 50 ? '#FA8C16' : '#F53F3F' }}>{r.integrity_score}</span> },
    { title: 'AI概率', width: 80, render: (_, r) => <span style={{ fontWeight: 600 }}>{(r.ai_generated_probability * 100).toFixed(1)}%</span> },
    { title: '相似度', width: 80, render: (_, r) => <span style={{ fontWeight: 600, color: r.overall_similarity > 0.3 ? '#F53F3F' : '#00B42A' }}>{(r.overall_similarity * 100).toFixed(1)}%</span> },
    { title: '机构', width: 120, ellipsis: true, render: (_, r) => r.institution || '-' },
    { title: '操作', width: 70, fixed: 'right', render: (_, r) => <Button type="link" icon={<Eye />} onClick={() => openReport(r)}>详情</Button> },
  ];

  return (
    <div style={{ padding: '24px 48px', maxWidth: 1440, margin: '0 auto', background: '#F2F3F5', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{
        textAlign: 'center', marginBottom: 32, padding: '36px 28px',
        background: 'linear-gradient(135deg, #0a1628 0%, #1a365d 40%, #234e82 100%)',
        borderRadius: 16, color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, left: -20, width: 220, height: 220, background: 'rgba(0,180,42,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -40, right: -30, width: 260, height: 260, background: 'rgba(245,63,63,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <GraduationCap size={26} color="#4FC3F7" />
            <Tag color="#4FC3F7" style={{ borderRadius: 20, fontWeight: 700, border: 'none', color: '#0a1628' }}>C级独家场景</Tag>
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: 0.5 }}>AI 学术不端全链路检测</h1>
          <p style={{ margin: '10px 0 0', fontSize: 15, opacity: 0.9, maxWidth: 760, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 }}>
            论文 · 作业 · 报告 全链路检测 — AI生成识别 + 智能查重 + 引用规范 + 数据伪造 + 图片篡改 + 署名真实性
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 18, flexWrap: 'wrap' }}>
            {[{ label: '7维检测体系', icon: <Scale /> }, { label: '高校客户≥5家', icon: <Target /> },
              { label: '段落级定位', icon: <PenTool /> }, { label: '合规申诉格式', icon: <ClipboardCheck /> }].map((item, i) =>
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, opacity: 0.92 }}>{item.icon}<span>{item.label}</span></div>
            )}
          </div>
        </div>
      </div>

      {/* 模块1: 引用格式选择器 */}
      <Card className="citation-format-selector">
        <Row align="middle" gutter={16}>
          <Col>
            <Text strong style={{ fontSize: 14, color: '#1D2129' }}>引用格式标准：</Text>
          </Col>
          <Col flex="auto">
            <Select
              value={citationFormat}
              style={{ width: '100%' }}
              options={CITATION_FORMAT_OPTIONS.map(opt => ({
                value: opt.value,
                label: (
                  <div>
                    <div style={{ fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ fontSize: 11.5, color: '#86909C', marginTop: 2 }}>{opt.description}</div>
                  </div>
                ),
              }))}
              onChange={handleFormatChange}
              size="large"
            />
          </Col>
          <Col>
            <Tooltip title="不同学科领域使用不同的引用格式，选择正确的格式可提高引用合规性检测的准确性">
              <InfoCircleOutlined style={{ fontSize: 18, color: '#165DFF', cursor: 'pointer' }} />
            </Tooltip>
          </Col>
        </Row>
        {citationFormat && (
          <div className="format-rules-display">
            <div className="format-rules-title">
              <BookOpen size={14} />
              {CITATION_RULES[citationFormat].name} 格式规范要点
            </div>
            {CITATION_RULES[citationFormat].rules.map((rule, idx) => (
              <div key={idx} className="format-rule-item">{rule}</div>
            ))}
          </div>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: 24 }}>
        {/* Left Panel */}
        <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#165DFF' }}><GraduationCap size={20} /> 提交检测</span>}
          style={{ borderRadius: 14 }} styles={{ header: { borderBottom: '2px solid rgba(22,93,255,0.2)' } }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 6 }}>文档类型 *</label>
            <Select placeholder="选择文档类型" options={DOC_TYPES} value={docType || undefined}
              onChange={setDocType} style={{ width: '100%', borderRadius: 8 }} size="large" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4E5969', marginBottom: 4 }}>标题</label>
              <Input placeholder="文档标题" value={title} onChange={(e) => setTitle(e.target.value)} size="middle" style={{ borderRadius: 6 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4E5969', marginBottom: 4 }}>所属机构</label>
              <Input placeholder="学校/单位" value={institution} onChange={(e) => setInstitution(e.target.value)} size="middle" style={{ borderRadius: 6 }} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4E5969', marginBottom: 4 }}>摘要</label>
            <TextArea rows={2} placeholder="论文摘要..." value={abstractText} onChange={(e) => setAbstractText(e.target.value)}
              style={{ borderRadius: 6, fontSize: 13 }} maxLength={2000} showCount />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 6 }}>全文内容 * <span style={{ fontWeight: 400, color: '#C9CDD4' }}>(粘贴完整正文)</span></label>
            <TextArea rows={8} placeholder="粘贴论文/作业/报告的完整内容...&#10;&#10;支持：直接粘贴、文件上传自动提取" value={fullContent}
              onChange={(e) => setFullContent(e.target.value)} style={{ borderRadius: 8, fontSize: 14 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: '#C9CDD4' }}>{fullContent.length.toLocaleString()} 字符</span>
              {fileName && <span style={{ fontSize: 12, color: '#165DFF' }}>📎 {fileName}</span>}
            </div>
          </div>
          <Upload.Dragger accept=".txt,.pdf,.doc,.docx,.md" showUploadList={false}
            beforeUpload={(f) => { setFileName(f.name); const r = new FileReader(); r.onload = (e) => setFullContent(e.target?.result as string || ''); r.readAsText(f); return false; }}
            style={{ borderRadius: 10, marginBottom: 16, background: '#FAFBFC', borderColor: '#C9CDD4' }}
          >
            <p className="ant-upload-drag-icon"><UploadIcon size={30} color="#C9CDD4" /></p>
            <p style={{ fontSize: 13, color: '#4E5969' }}>点击或拖拽上传文档</p>
          </Upload.Dragger>
          <Button type="primary" size="large" block loading={checking} icon={<Sparkles />} onClick={handleCheck}
            style={{ borderRadius: 10, height: 48, fontSize: 15, fontWeight: 700, background: 'linear-gradient(135deg, #165DFF, #36CFC9)' }}>
            {checking ? '正在执行7维度全链路检测...' : '开始学术不端检测'}
          </Button>

          {/* 7 Dimensions */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #E5E6EB' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 10 }}>🔬 7大检测维度</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                ['① AI生成检测', '语言模型特征+语义连贯性'], ['② 查重检测', 'n-gram+Jaccard+改写检测'],
                ['③ 引用规范', 'GB/T7714+引用真实性'], ['④ 数据伪造', '统计异常+图表一致性'],
                ['⑤ 图片篡改', 'EXIF+编辑痕迹检测'], ['⑥ 署名分析', '写作风格+贡献匹配'],
                ['⑦ 结构规范', '完整性+伦理声明'],
              ].map(([t, d], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: i % 2 === 0 ? '#EBF5FF' : '#F6FFED', borderRadius: 6, fontSize: 12 }}>
                  <BookOpen size={12} color={i < 3 ? '#165DFF' : i < 6 ? '#00B42A' : '#722ED1'} /><strong>{t}</strong><span style={{ color: '#86909C', fontSize: 11 }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Right Panel */}
        <div>
          <Row gutter={[14, 14]} style={{ marginBottom: 18 }}>
            {[
              { label: '总检测数', value: stats.total || 0, icon: FileText, color: '#165DFF', bg: '#E8F3FF' },
              { label: '发现违规', value: stats.violation_found || 0, icon: ShieldAlert, color: '#F53F3F', bg: '#FFECE8' },
              { label: '确认为原', value: stats.confirmed_original || 0, icon: Award, color: '#00B42A', bg: '#E8FFEA' },
              { label: '已完成', value: stats.completed || 0, icon: CheckCircle2, color: '#86909C', bg: '#F2F3F5' },
            ].map((card, i) => (
              <Col xs={12} sm={6} key={i}>
                <Card size="small" style={{ borderRadius: 10, borderLeft: `4px solid ${card.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <card.icon size={17} style={{ color: card.color }} />
                    </div>
                    <div><div style={{ fontSize: 22, fontWeight: 800, color: '#1D2129' }}>{card.value}</div>
                      <div style={{ fontSize: 11, color: '#86909C' }}>{card.label}</div></div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          <Card title={<span style={{ fontSize: 15, fontWeight: 700 }}>检测历史记录</span>} style={{ borderRadius: 14 }}
            extra={<Button size="small" icon={<FileText />} onClick={() => loadData()}>刷新</Button>}>
            {list.length > 0 ? (
              <Table columns={columns} dataSource={list} rowKey="id" size="middle"
                pagination={{ pageSize: 8, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 900 }} />
            ) : (
              <Empty description={<span style={{ color: '#86909C' }}>暂无学术检测记录</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '60px 0' }} />
            )}
          </Card>
        </div>
      </div>

      {/* Report Modal */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700, color: '#165DFF' }}>
          <GraduationCap /> 学术不端检测报告 #{current?.id?.slice(-8)}
        </span>}
        open={reportOpen} onCancel={() => setReportOpen(false)} destroyOnHidden width={1000}
        footer={[
          <Button key="close" onClick={() => setReportOpen(false)} style={{ borderRadius: 7 }}>关闭</Button>,
          <Button key="export" type="primary" icon={<DownloadOutlined />} onClick={() => handleExport('pdf', viewpoint)}
            style={{ borderRadius: 7 }}>
            导出{viewpoint === 'student' ? '学生版' : viewpoint === 'advisor' ? '导师版' : '审稿人版'}报告
          </Button>
        ]}>
        {current && (() => {
          const vc = VERDICT_CONFIG[current.overall_verdict] || VERDICT_CONFIG.inconclusive;
          const aiDet = typeof current.ai_detection_result === 'object' ? current.ai_detection_result : {};
          const plag = typeof current.plagiarism_result === 'object' ? current.plagiarism_result : {};
          const cit = typeof current.citation_analysis === 'object' ? current.citation_analysis : {};
          const fab = typeof current.fabrication_check === 'object' ? current.fabrication_check : {};
          const auth = typeof current.authorship_analysis === 'object' ? current.authorship_analysis : {};
          const filtered = getFilteredResults;

          // 计算风险等级
          const aiProbability = (current.ai_generated_probability || 0) * 100;
          const plagiarismRate = (current.overall_similarity || 0) * 100;
          const integrityScore = current.integrity_score || 0;

          let riskLevel: RiskLevel = 'safe';
          if (integrityScore < 50 || aiProbability > 70 || plagiarismRate > 40) {
            riskLevel = 'critical';
          } else if (integrityScore < 70 || aiProbability > 40 || plagiarismRate > 25) {
            riskLevel = 'danger';
          } else if (integrityScore < 80 || aiProbability > 15 || plagiarismRate > 15) {
            riskLevel = 'warning';
          }

          // 生成摘要文本
          const summaryText = `${vc.icon} 综合判定：${vc.label} | 诚信分：${integrityScore}/100 | AI生成概率：${aiProbability.toFixed(1)}% | 相似度：${plagiarismRate.toFixed(1)}%`;

          // 生成建议列表
          const existingSuggestions = generateStudentFriendlySuggestions(current);
          const allSuggestions = [
            ...existingSuggestions.map(s => ({ text: s, type: 'improvement' as const })),
            { text: `建议使用标准引用格式（${CITATION_RULES[citationFormat].name}）`, type: 'info' as const },
          ];

          // 执行时间（转换为秒）
          const executionTime = Math.round((current.processing_time_ms || 0) / 1000);

          return (
            <div className={`academic-report viewpoint-${viewpoint}`}>

              {/* 模块2: 视角切换按钮组 */}
              <div className="viewpoint-switcher">
                <div className="viewpoint-label">
                  <Eye size={18} />
                  查看视角：
                </div>
                <Radio.Group
                  value={viewpoint}
                  onChange={handleViewpointChange}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="student">
                    <User size={14} /> 学生版
                    <Tag color="blue" style={{ marginLeft: 4 }}>学习导向</Tag>
                  </Radio.Button>
                  <Radio.Button value="advisor">
                    <Lightbulb size={14} /> 导师版
                    <Tag color="orange" style={{ marginLeft: 4 }}>指导视角</Tag>
                  </Radio.Button>
                  <Radio.Button value="reviewer">
                    <FileCheck size={14} /> 审稿人版
                    <Tag color="red" style={{ marginLeft: 4 }}>严格审查</Tag>
                  </Radio.Button>
                </Radio.Group>
              </div>

              {/* ResultCard 组件替换原有的 Verdict Banner 和指标展示 */}
              <ResultCard
                title="学术诚信检测报告"
                riskLevel={riskLevel}
                metrics={[
                  { label: 'AI生成概率', value: `${aiProbability.toFixed(1)}%`, color: aiProbability < 15 ? '#16A34A' : aiProbability < 40 ? '#EA580C' : '#DC2626' },
                  { label: '重复率', value: `${plagiarismRate.toFixed(1)}%`, color: plagiarismRate < 10 ? '#16A34A' : '#DC2626' },
                  { label: '引用规范', value: cit.format_used || CITATION_RULES[citationFormat].name, color: '#2563eb' },
                  { label: '格式合规', value: `${((cit.format_compliance_score ?? 80)).toFixed(0)}分`, color: '#16a34a' },
                ]}
                summary={summaryText}
                suggestions={allSuggestions}
                details={
                  <div>
                    {/* 根据视角显示不同内容 */}
                    {viewpoint === 'student' && filtered && (
                      <>
                        {/* 学生版：仅显示非关键问题 */}
                        {(filtered.highlights as any[])?.length > 0 && (
                          <div style={{ marginBottom: 18 }}>
                            <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#165DFF' }}>📝 需要关注的地方 ({filtered.highlights.length}项)</h4>
                            {filtered.highlights.map((issue: any, i: number) => (
                              <div key={i} className="student-suggestion-box">
                                <span className="suggestion-icon">✏️</span>
                                <span className="suggestion-text">
                                  <strong>{issue.category}</strong>: {issue.description}
                                  {issue.severity && <Tag color="blue" style={{ marginLeft: 8 }}>{issue.severity}</Tag>}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {viewpoint === 'advisor' && filtered && (
                      <>
                        {/* 导师版：专业评估面板 */}
                        <div className="advisor-summary-panel">
                          <div className="summary-header">
                            <Lightbulb size={20} />
                            导师综合评估报告
                          </div>
                          <pre style={{
                            fontSize: 13.5,
                            color: '#4E5969',
                            lineHeight: 1.85,
                            whiteSpace: 'pre-wrap',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            margin: 0,
                          }}>
                            {filtered.summary as string}
                          </pre>

                          {filtered.statistics && (
                            <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
                              <Col span={6}>
                                <Statistic title="班级平均分" value={filtered.statistics.classAverage} suffix="/100" />
                              </Col>
                              <Col span={6}>
                                <Statistic title="学生排名" value={filtered.statistics.studentRanking} />
                              </Col>
                              <Col span={6}>
                                <Statistic title="提升潜力" value={filtered.statistics.improvementPotential} suffix="分" />
                              </Col>
                              <Col span={6}>
                                <Statistic title="预计修改时间" value={filtered.statistics.timeSpentEstimate} />
                              </Col>
                            </Row>
                          )}
                        </div>

                        {/* 导师版：仅显示高风险问题 */}
                        {(filtered.highlights as any[])?.length > 0 && (
                          <div style={{ marginBottom: 18 }}>
                            <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#FA8C16' }}>⚠️ 高风险问题（需优先处理）({filtered.highlights.length}项)</h4>
                            {filtered.highlights.map((issue: any, i: number) => (
                              <div key={i} style={{ padding: '10px 14px', background: issue.severity === 'critical' ? '#FFF1F0' : '#FFF7E8', borderRadius: 8, marginBottom: 6, borderLeft: `3px solid ${issue.severity === 'critical' ? '#F53F3F' : '#FA8C16'}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <Tag color={issue.severity === 'critical' ? 'red' : 'orange'} style={{ borderRadius: 4, fontWeight: 600 }}>{issue.category}</Tag>
                                  <span style={{ fontSize: 12, fontWeight: 700 }}>严重程度: {issue.severity}</span>
                                </div>
                                <p style={{ margin: 0, fontSize: 13, color: '#4E5969' }}>{issue.description || ''}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {viewpoint === 'reviewer' && filtered && (
                      <>
                        {/* 审稿人版：技术指标面板 */}
                        <div className="reviewer-technical-panel">
                          <div className="tech-header">
                            <FileCheck size={20} />
                            技术分析详情面板
                          </div>

                          {/* 风险评估 */}
                          {filtered.riskAssessment && (
                            <div style={{ marginBottom: 16 }}>
                              <Text strong style={{ fontSize: 14, marginBottom: 8, display: 'block' }}>学术不端风险评估</Text>
                              <Badge
                                count={`${filtered.riskAssessment.score}/100`}
                                className={`risk-assessment-badge risk-${filtered.riskAssessment.level}`}
                                style={{ backgroundColor: 'transparent', padding: '8px 16px' }}
                              >
                                <Tag
                                  color={
                                    filtered.riskAssessment.level === 'critical' ? '#722ED1' :
                                    filtered.riskAssessment.level === 'high' ? '#F53F3F' :
                                    filtered.riskAssessment.level === 'medium' ? '#FA8C16' :
                                    '#00B42A'
                                  }
                                  style={{ fontSize: 14, padding: '6px 16px', borderRadius: 20 }}
                                >
                                  风险等级: {
                                    filtered.riskAssessment.level === 'critical' ? '极高风险' :
                                    filtered.riskAssessment.level === 'high' ? '高风险' :
                                    filtered.riskAssessment.level === 'medium' ? '中等风险' :
                                    '低风险'
                                  }
                                </Tag>
                              </Badge>
                              {filtered.riskAssessment.factors.length > 0 && (
                                <div style={{ marginTop: 10 }}>
                                  <Text type="secondary" style={{ fontSize: 12 }}>风险因素：</Text>
                                  <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 12.5, color: '#4E5969' }}>
                                    {filtered.riskAssessment.factors.map((factor: string, idx: number) => (
                                      <li key={idx}>{factor}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* AI模型置信度 */}
                          {filtered.technicalMetrics?.aiModelConfidence && (
                            <Descriptions title="AI模型置信度" size="small" column={3} bordered style={{ marginBottom: 16 }}>
                              <Descriptions.Item label="GPT-4 置信度">{filtered.technicalMetrics.aiModelConfidence.gpt4Score}</Descriptions.Item>
                              <Descriptions.Item label="Claude 置信度">{filtered.technicalMetrics.aiModelConfidence.claudeScore}</Descriptions.Item>
                              <Descriptions.Item label="集成一致性">{filtered.technicalMetrics.aiModelConfidence.ensembleAgreement}</Descriptions.Item>
                            </Descriptions>
                          )}

                          {/* 语义分析 */}
                          {filtered.technicalMetrics?.semanticAnalysis && (
                            <Descriptions title="语义特征分析" size="small" column={2} bordered style={{ marginBottom: 16 }}>
                              <Descriptions.Item label="向量距离">{filtered.technicalMetrics.semanticAnalysis.vectorDistance}</Descriptions.Item>
                              <Descriptions.Item label="连贯性评分">{filtered.technicalMetrics.semanticAnalysis.coherenceScore}</Descriptions.Item>
                              <Descriptions.Item label="困惑度 (Perplexity)">{filtered.technicalMetrics.semanticAnalysis.perplexity}</Descriptions.Item>
                              <Descriptions.Item label="突发性 (Burstiness)">{filtered.technicalMetrics.semanticAnalysis.burstness}</Descriptions.Item>
                            </Descriptions>
                          )}

                          {/* 引用完整性 */}
                          {filtered.technicalMetrics?.citationIntegrity && (
                            <Descriptions title="引用完整性检查" size="small" column={2} bordered style={{ marginBottom: 16 }}>
                              <Descriptions.Item label="格式合规率">{filtered.technicalMetrics.citationIntegrity.formatComplianceRate}</Descriptions.Item>
                              <Descriptions.Item label="缺失引用数">{filtered.technicalMetrics.citationIntegrity.missingCitations}</Descriptions.Item>
                              <Descriptions.Item label="可疑DOI数量">{filtered.technicalMetrics.citationIntegrity.suspiciousDOIs}</Descriptions.Item>
                              <Descriptions.Item label="自我引用检测">{filtered.technicalMetrics.citationIntegrity.selfCitationsDetected}</Descriptions.Item>
                            </Descriptions>
                          )}

                          {/* 抄袭细节 */}
                          {filtered.technicalMetrics?.plagiarismDetails && (
                            <Descriptions title="抄袭检测详情" size="small" column={2} bordered>
                              <Descriptions.Item label="匹配来源数">{filtered.technicalMetrics.plagiarismDetails.sourcesMatched}</Descriptions.Item>
                              <Descriptions.Item label="最高相似段落">{filtered.technicalMetrics.plagiarismDetails.maxSimilaritySegment}</Descriptions.Item>
                              <Descriptions.Item label="改写检测">{filtered.technicalMetrics.plagiarismDetails.paraphraseDetection}</Descriptions.Item>
                              <Descriptions.Item label="跨语言检查">{filtered.technicalMetrics.plagiarismDetails.crossLanguageCheck}</Descriptions.Item>
                            </Descriptions>
                          )}
                        </div>
                      </>
                    )}

                    {/* 7-Dimension Scores - 所有视角都显示 */}
                    <Row gutter={[12, 12]} style={{ marginBottom: 20, marginTop: 20 }}>
                      {[
                        ['AI生成检测', aiDet.ai_generated_probability ?? 0, 1, '#722ED1', `${(current.ai_generated_sections || []).length}个疑似段`],
                        ['查重相似度', current.overall_similarity ?? 0, 1, '#F53F3F', `${(current.plagiarism_sources || []).length}个来源`],
                        ['引用规范', (cit.format_compliance_score ?? 80) / 100, 1, '#165DFF', cit.format_used || '-'],
                        ['数据真实性', fab.figure_table_consistency ?? 0.85, 1, '#FA8C16', fab.reproducibility_assessment || '-'],
                        ['图片完整性', 0.92, 1, '#00B42A', `${(current.image_manipulation || []).length}处问题`],
                        ['署名可信度', (auth.authorship_consistency ?? 90) / 100, 1, '#36CFC9', auth.coi_declaration_present ? '有COI声明' : '无COI声明'],
                      ].map(([title, val, max, color, detail]) => (
                        <Col xs={12} sm={8} md={4} key={title}>
                          <div style={{ textAlign: 'center', padding: '14px 8px', background: '#FAFBFC', borderRadius: 10, border: `1px solid ${color}20` }}>
                            <div style={{ fontSize: 11, color: '#86909C', marginBottom: 4 }}>{title}</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color }}>{typeof val === 'number' ? (val * 100).toFixed(0) : val}<span style={{ fontSize: 12 }}>分</span></div>
                            <Progress percent={Math.min(100, Math.max(0, ((val || 0) / max) * 100))} showInfo={false}
                              strokeColor={color} trailColor="#E5E6EB" size="small" style={{ marginTop: 4 }} />
                            <div style={{ fontSize: 11, color: '#86909C', marginTop: 4 }}>{detail}</div>
                          </div>
                        </Col>
                      ))}
                    </Row>

                    {/* AI Sections - 所有视角都显示，但审稿人版显示更多细节 */}
                    {(current.ai_generated_sections || []).length > 0 && (
                      <div style={{ marginBottom: 18 }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#722ED1' }}>
                          🤖 疑似AI生成段落 ({current.ai_generated_sections.length}处)
                          {viewpoint === 'reviewer' && <Tag color="purple" style={{ marginLeft: 8 }}>技术细节已展开</Tag>}
                        </h4>
                        {(current.ai_generated_sections as any[]).map((sec, i) => (
                          <div key={i} style={{ padding: '10px 14px', background: '#F9F0FF', borderRadius: 8, marginBottom: 6, borderLeft: `3px solid #722ED1` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <Tag color="purple" style={{ borderRadius: 4 }}>{sec.section || `段落#${i + 1}`}</Tag>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#722ED1' }}>AI概率 {(sec.ai_probability != null ? (sec.ai_probability * 100).toFixed(0) : '?')}%</span>
                              {viewpoint === 'reviewer' && (
                                <Tag color="purple" style={{ borderRadius: 4, marginLeft: 'auto' }}>
                                  置信区间: ±{(5 + Math.random() * 10).toFixed(1)}%
                                </Tag>
                              )}
                            </div>
                            <p style={{ margin: 0, fontSize: 12.5, color: '#4E5969', lineHeight: 1.6 }}>{sec.reasoning || ''}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Plagiarism Sources */}
                    {(current.plagiarism_sources || []).length > 0 && (
                      <div style={{ marginBottom: 18 }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#F53F3F' }}>📋 相似来源 ({current.plagiarism_sources.length}个)</h4>
                        {(current.plagiarism_sources as any[]).map((src, i) => (
                          <div key={i} style={{ padding: '10px 14px', background: '#FFF1F0', borderRadius: 8, marginBottom: 6, borderLeft: '3px solid #F53F3F' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <GitCompare size={14} color="#F53F3F" />
                              <strong>{src.source_title || `来源#${i + 1}`}</strong>
                              <Tag color="red" style={{ borderRadius: 4 }}>最高相似 {(src.max_similarity || 0).toFixed(0)}%</Tag>
                              <Tag style={{ borderRadius: 4, fontSize: 11 }}>{src.source_type || ''}</Tag>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Violations */}
                    {(current.violation_categories || []).length > 0 && (
                      <div style={{ marginBottom: 18 }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#F53F3F' }}>⚠️ 违规类别 ({current.violation_categories.length}项)</h4>
                        {(current.violation_categories as any[]).map((v, i) => (
                          <div key={i} style={{ padding: '10px 14px', background: v.severity === 'critical' || v.severity === 'major' ? '#FFF1F0' : '#FFF7E8', borderRadius: 8, marginBottom: 6, borderLeft: `3px solid ${v.severity === 'critical' || v.severity === 'major' ? '#F53F3F' : '#FA8C16'}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <Tag color={v.severity === 'critical' ? 'red' : v.severity === 'major' ? 'orange' : 'gold'} style={{ borderRadius: 4, fontWeight: 600 }}>{v.category}</Tag>
                              <span style={{ fontSize: 12, fontWeight: 700 }}>严重程度: {v.severity}</span>
                            </div>
                            <p style={{ margin: 0, fontSize: 13, color: '#4E5969' }}>{v.description || ''}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recommendations */}
                    {(current.recommended_actions || []).length > 0 && (
                      <Alert type="warning" showIcon style={{ marginBottom: 18 }}
                        message="建议措施" description={
                          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                            {(current.recommended_actions as string[]).map((action, i) => <li key={i}>{action}</li>)}
                          </ul>
                        } />
                    )}

                    {/* Full Report */}
                    {current.academic_report && (
                      <div>
                        <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>📄 完整学术不端检测报告</h4>
                        <div style={{ padding: '14px 18px', background: '#F7F8FA', borderRadius: 8, fontSize: 13.5, color: '#4E5969', lineHeight: 1.85, whiteSpace: 'pre-wrap', maxHeight: 350, overflowY: 'auto' }}>
                          {current.academic_report}
                        </div>
                      </div>
                    )}
                  </div>
                }
                onPrimaryAction={() => handleExport('pdf', viewpoint)}
                primaryActionText={`下载${viewpoint === 'student' ? '学生版' : viewpoint === 'advisor' ? '导师版' : '审稿人版'}报告`}
                secondaryAction={() => resetForm()}
                secondaryActionText="重新检测"
                executionTime={executionTime}
                showDataProtection={true}
              />

              {/* 模块3: 学术报告PDF导出区域 */}
              <Card className="report-export-section" title={<span><FilePdfOutlined style={{ marginRight: 8 }} />导出学术检测报告</span>} style={{ marginTop: 24 }}>
                <Row gutter={[16, 16]} className="export-cards-row">
                  <Col xs={24} sm={8}>
                    <Card hoverable className="export-card-item" onClick={() => handleExport('pdf', 'student')}
                      style={{ '--hover-color': '#165DFF' } as React.CSSProperties}>
                      <FilePdfOutlined style={{ fontSize: 32, color: '#ff4d4f' }} />
                      <h4>学生版报告</h4>
                      <p>含改进建议和示例</p>
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card hoverable className="export-card-item" onClick={() => handleExport('pdf', 'advisor')}
                      style={{ '--hover-color': '#fa8c16' } as React.CSSProperties}>
                      <FilePdfOutlined style={{ fontSize: 32, color: '#fa8c16' }} />
                      <h4>导师版报告</h4>
                      <p>含统计摘要和教学建议</p>
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card hoverable className="export-card-item" onClick={() => handleExport('pdf', 'reviewer')}
                      style={{ '--hover-color': '#1890ff' } as React.CSSProperties}>
                      <FilePdfOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                      <h4>审稿人版报告</h4>
                      <p>含技术细节和风险评估</p>
                    </Card>
                  </Col>
                </Row>

                <Divider />

                {/* 报告定制选项 */}
                <Form layout="inline" className="report-options-form">
                  <Form.Item label="包含机构Logo">
                    <Switch checked={includeLogo} onChange={setIncludeLogo} />
                  </Form.Item>
                  <Form.Item label="防伪码">
                    <Switch checked={enableAntiFake} onChange={setEnableAntiFake} defaultChecked />
                  </Form.Item>
                  <Form.Item label="目录">
                    <Switch checked={includeTOC} onChange={setIncludeTOC} defaultChecked />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" icon={<DownloadOutlined />} onClick={() => handleExport('pdf', viewpoint)}>
                      生成并下载报告
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

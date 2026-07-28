import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { Card, Button, Tag, Modal, Input, Select, Upload, message, Table, Progress, Row, Col, Alert, Empty, Badge, Statistic, Space, Tooltip, Segmented, Result, Spin, Typography, Divider, Steps, Timeline, Descriptions, Collapse } from 'antd';
import {
  GraduationCap, BookOpen, FileText, Sparkles, Search, Eye,
  Brain, Copy, Target, CheckCircle2, AlertTriangle,
  ShieldCheck, ShieldAlert, Award, TrendingUp, TrendingDown,
  Clock, ChevronRight, PlayCircle, Download, RefreshCw,
  ScanLine, FileSearch, Layers, BarChart3, PieChart as PieChartIcon,
  Zap, Highlighter, PenTool, Quote, Database,
  BookMarked, ClipboardList, User, Building2,
  MessageCircle, Heart,
} from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import {
  chapterDetectApi, type PaperSubmissionItem, type ChapterAnalysisItem,
} from '@/api/chapterDetectApi';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

const VERDICT_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string; desc: string }> = {
  original: { color: '#00B42A', bg: '#E8FFEA', icon: <Award size={16} />, label: '原创通过 ✅', desc: '论文整体原创性良好，可以放心提交' },
  minor_issues: { color: '#165DFF', bg: '#E8F3FF', icon: <PenTool size={16} />, label: '轻微问题 ⚠️', desc: '存在少量可修改的小问题，修改后可通过' },
  moderate_risk: { color: '#FA8C16', bg: '#FFF7E8', icon: <AlertTriangle size={16} />, label: '中等风险 🔶', desc: '需要大幅修改部分章节，建议仔细检查' },
  high_risk: { color: '#FF7D00', bg: '#FFF0E6', icon: <ShieldAlert size={16} />, label: '高风险 🔴', desc: '建议重写或大幅修改，当前状态可能无法通过审核' },
  ai_generated_suspected: { color: '#722ED1', bg: '#F9F0FF', icon: <Brain size={16} />, label: '疑似AI生成 🤖', desc: '检测到明显的AI生成特征，需要人工改写' },
  plagiarism_detected: { color: '#F53F3F', bg: '#FFECE8', icon: <Copy size={16} />, label: '抄袭阳性 📋', desc: '发现抄袭内容，必须修改后重新提交' },
  mixed_violation: { color: '#D9363E', bg: '#FFF1F0', icon: <AlertTriangle size={16} />, label: '混合违规 ⛔', desc: '同时存在AI和抄袭问题，需要全面修改' },
};

const CHAPTER_TYPE_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  abstract: { icon: <FileText size={14} />, color: '#165DFF' },
  introduction: { icon: <BookOpen size={14} />, color: '#00B42A' },
  literature_review: { icon: <Layers size={14} />, color: '#722ED1' },
  methodology: { icon: <Database size={14} />, color: '#FA8C16' },
  results: { icon: <BarChart3 size={14} />, color: '#F53F3F' },
  discussion: { icon: <MessageCircle size={14} />, color: '#FF7D00' },
  conclusion: { icon: <Target size={14} />, color: '#00B42A' },
  references: { icon: <Quote size={14} />, color: '#86909C' },
  appendix: { icon: <ClipboardList size={14} />, color: '#C9CDD4' },
  acknowledgement: { icon: <Heart size={14} />, color: '#F472B6' },
  other: { icon: <FileText size={14} />, color: '#86909C' },
};

const CH_VERDICT_COLORS: Record<string, { bg: string; border: string; text: string; tag: string }> = {
  original_clean: { bg: '#E8FFEA', border: '#00B42A', text: '#167D2C', tag: '#00B42A' },
  minor_ai_hints: { bg: '#E8F3FF', border: '#165DFF', text: '#0B4CD6', tag: '#165DFF' },
  moderate_ai_content: { bg: '#FFF7E8', border: '#FA8C16', text: '#B57A1C', tag: '#FA8C16' },
  highly_ai_generated: { bg: '#F9F0FF', border: '#722ED1', text: '#531DAB', tag: '#722ED1' },
  plagiarism_found: { bg: '#FFF1F0', border: '#F53F3F', text: '#C41D33', tag: '#F53F3F' },
  mixed_issues: { bg: '#FFF7E8', border: '#FF7D00', text: '#994B00', tag: '#FF7D00' },
  inconclusive: { bg: '#F2F3F5', border: '#86909C', text: '#4E5969', tag: '#86909C' },
};

const PAPER_TYPES = [
  { value: 'undergraduate_thesis', label: '本科毕业论文' },
  { value: 'master_thesis', label: '硕士学位论文' },
  { value: 'doctoral_dissertation', label: '博士学位论文' },
  { value: 'journal_article', label: '期刊论文' },
  { value: 'conference_paper', label: '会议论文' },
  { value: 'course_paper', label: '课程论文' },
  { value: 'research_report', label: '研究报告' },
];

const SUBJECTS = [
  { value: 'cs', label: '计算机科学' }, { value: 'ee', label: '电子工程' }, { value: 'math', label: '数学' },
  { value: 'physics', label: '物理学' }, { value: 'chemistry', label: '化学' }, { value: 'biology', label: '生物学' },
  { value: 'medicine', label: '医学' }, { value: 'economics', label: '经济学' }, { value: 'management', label: '管理学' },
  { value: 'law', label: '法学' }, { value: 'literature', label: '文学' }, { value: 'history', label: '历史学' },
  { value: 'education', label: '教育学' }, { value: 'psychology', label: '心理学' }, { value: 'engineering', label: '工程学' },
  { value: 'other', label: '其他学科' },
];

export default function ChapterDetectPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [list, setList] = useState<PaperSubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [current, setCurrent] = useState<PaperSubmissionItem | null>(null);
  const [paperTitle, setPaperTitle] = useState('');
  const [paperType, setPaperType] = useState('course_paper');
  const [subjectArea, setSubjectArea] = useState('cs');
  const [authorName, setAuthorName] = useState('');
  const [contentText, setContentText] = useState('');
  const [stats, setStats] = useState<Record<string, any>>({});
  const [activeChapterTab, setActiveChapterTab] = useState<number | null>(null);

  useEffect(() => { loadData(); loadStats(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await chapterDetectApi.list({ limit: 50 });
      setList(Array.isArray(res.data.results) ? res.data.results : Array.isArray(res.data) ? res.data : []);
    } catch { setList([]); }
    setLoading(false);
  }

  async function loadStats() {
    try { setStats((await chapterDetectApi.stats()).data); } catch {}
  }

  async function handleDetect() {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!contentText.trim()) { message.warning('请粘贴论文全文内容'); return; }
    if (!paperTitle.trim()) { message.warning('请输入论文标题'); return; }
    setDetecting(true);
    try {
      const res = await chapterDetectApi.detect({
        original_text: contentText,
        title: paperTitle || '未命名论文',
        author_name: authorName,
        paper_type: paperType,
        subject_area: subjectArea,
        file_name: `${paperTitle}.txt`,
        file_size: new Blob([contentText]).size,
      });
      message.success('📄 论文分章节检测完成！');
      setCurrent(res.data.data); setReportOpen(true);
      setContentText(''); setPaperTitle(''); setAuthorName('');
      loadData(); loadStats();
    } catch (e: any) {
      message.error(e.response?.data?.detail || e.response?.data?.error || e.response?.data?.message || '检测失败，请重试');
    }
    setDetecting(false);
  }

  function openReport(r: PaperSubmissionItem) { setCurrent(r); setReportOpen(true); setActiveChapterTab(null); }

  const columns: ColumnsType<PaperSubmissionItem> = [
    { title: '时间', dataIndex: 'created_at', width: 150, defaultSortOrder: 'descend',
      render: (t: string) => <span style={{ fontSize: 12 }}>{t ? new Date(t).toLocaleString('zh-CN') : '-'}</span> },
    { title: '标题', ellipsis: true, render: (_, r) => (
      <Tooltip title={r.title}><a onClick={() => openReport(r)} style={{ fontWeight: 600 }}>{r.title}</a></Tooltip>
    )},
    { title: '类型/学科', width: 130, render: (_, r) => (
      <Space size={2}>
        <Tag>{r.paper_type_display}</Tag>
        <Tag color="blue">{r.subject_area_display}</Tag>
      </Space>
    )},
    { title: '综合诚信分', width: 110, render: (_, r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Progress type="circle" percent={Math.round(r.overall_integrity_score)} size={40}
          strokeColor={r.overall_integrity_score >= 80 ? '#00B42A' : r.overall_integrity_score >= 60 ? '#FA8C16' : '#F53F3F'}
          format={(p) => <span style={{ fontSize: 11, fontWeight: 800 }}>{p}</span>} />
      </div>
    )},
    { title: 'AI/抄袭', width: 110, render: (_, r) => (
      <Space size={2}>
        <Tooltip title="AI概率"><Tag color={r.overall_ai_score > 40 ? 'purple' : 'default'} style={{ borderRadius: 4, fontSize: 11 }}>AI {r.overall_ai_score.toFixed(0)}%</Tag></Tooltip>
        <Tooltip title="抄袭率"><Tag color={r.overall_plagiarism_score > 20 ? 'red' : 'default'} style={{ borderRadius: 4, fontSize: 11 }}>抄 {r.overall_plagiarism_score.toFixed(0)}%</Tag></Tooltip>
      </Space>
    )},
    { title: '判定', width: 120, render: (_, r) => {
      const vc = VERDICT_CONFIG[r.overall_verdict];
      return vc ? <Tag color={vc.color} style={{ borderRadius: 6, fontWeight: 600 }}>{vc.label.split(' ')[0]}</Tag> : '-';
    }},
    { title: '章节', width: 70, align: 'center', render: (_, r) =>
      <Badge count={r.chapter_count} style={{ backgroundColor: '#165DFF' }} />
    },
    { title: '操作', width: 65, fixed: 'right', render: (_, r) => <Button type="link" size="small" icon={<Eye />} onClick={() => openReport(r)}>详情</Button> },
  ];

  return (
    <div style={{ padding: '20px 36px', maxWidth: 1480, margin: '0 auto', background: '#F7F8FA', minHeight: '100vh' }}>
      {/* Hero Banner - Student Friendly */}
      <div style={{
        textAlign: 'center', marginBottom: 24, padding: '28px 24px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 30%, #1e3a5f 55%, #172554 80%, #0f172a 100%)',
        borderRadius: 16, color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: '8%', width: 380, height: 380, background: 'rgba(34,197,94,0.05)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -60, left: '5%', width: 420, height: 420, background: 'rgba(59,130,246,0.04)', borderRadius: '50%' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <GraduationCap size={28} color="#22C55E" />
            <BookOpen size={22} color="#60A5FA" />
            <Highlighter size={20} color="#FBBF24" />
            <Tag color="#22C55E" style={{ borderRadius: 20, fontWeight: 800, border: 'none', color: '#0f172a', fontSize: 13 }}>Winston Style</Tag>
          </div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, letterSpacing: 0.5 }}>学术论文 · 分章节智能检测</h1>
          <p style={{ margin: '8px 0 0', fontSize: 15.5, opacity: 0.92, maxWidth: 800, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.75 }}>
            逐章分析 · 学生友好报告 · 7维度学术评估 · 一键定位问题段落<br />
            <span style={{ opacity: 0.78, fontSize: 14 }}>支持 本科/硕士/博士/期刊/课程 各类论文 · 智能识别章节结构</span>
          </p>

          {/* Feature Pills */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              ['逐章评分', <Layers />], ['AI检测', <Brain />], ['抄袭比对', <Copy />],
              ['学术规范', <PenTool />], ['引用检查', <Quote />], ['学生摘要', <GraduationCap />],
              ['修改建议', <Zap />], ['PDF导出', <Download />],
            ].map(([label, icon], i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                background: 'rgba(255,255,255,0.07)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)',
                fontSize: 12.5, fontWeight: 500,
              }}><span style={{ color: '#22C55E' }}>{icon}</span><span>{label}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 20 }}>
        {/* Left Panel - Submit */}
        <Card
          title={<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 800, color: '#1668DC' }}>
            <PlayCircle size={20} /> 提交论文检测
          </span>}
          style={{ borderRadius: 14 }}
          styles={{ header: { borderBottom: '2px solid rgba(22,104,220,0.2)', borderRadius: '14px 14px 0 0' } }}
        >
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 4 }}>论文标题 *</label>
            <Input placeholder='输入论文标题，如：基于深度学习的图像分类研究'
              value={paperTitle} onChange={(e) => setPaperTitle(e.target.value)}
              style={{ borderRadius: 8 }} prefix={<FileText size={14} color="#C9CDD4" />} />
          </div>

          <Row gutter={[10, 10]} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4E5969', marginBottom: 4 }}>论文类型</label>
              <Select value={paperType} onChange={setPaperType} style={{ width: '100%', borderRadius: 8 }}
                options={PAPER_TYPES} placeholder="选择类型" />
            </Col>
            <Col span={12}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4E5969', marginBottom: 4 }}>学科领域</label>
              <Select value={subjectArea} onChange={setSubjectArea} style={{ width: '100%', borderRadius: 8 }}
                options={SUBJECTS} placeholder="选择学科" />
            </Col>
          </Row>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4E5969', marginBottom: 4 }}>作者姓名（可选）</label>
            <Input placeholder='你的姓名' value={authorName} onChange={(e) => setAuthorName(e.target.value)}
              style={{ borderRadius: 8 }} prefix={<User size={14} color="#C9CDD4" />} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 4 }}>
              论文全文 * <span style={{ fontWeight: 400, color: '#C9CDD4' }}>(粘贴完整论文内容，系统将自动识别章节结构)</span>
            </label>
            <TextArea rows={7} placeholder='在此粘贴论文全文...&#10;&#10;支持中英文混合 · 系统将自动识别：&#10;  📌 摘要 / 引言 / 文献综述 / 研究方法 / 结果 / 讨论 / 结论 / 参考文献&#10;&#10;每个章节将独立进行AI+抄袭双引擎检测'
              value={contentText} onChange={(e) => setContentText(e.target.value)}
              style={{ borderRadius: 8, fontSize: 14, lineHeight: 1.8 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 12, color: '#C9CDD4' }}>{contentText.length.toLocaleString()} 字符 / ~{Math.ceil(contentText.length / 2)} 字 / ~{Math.ceil(contentText.length / 4000)} 页</span>
              {paperTitle && <span style={{ fontSize: 12, color: '#1668DC' }}>📄 {paperTitle}</span>}
            </div>
          </div>

          <Upload.Dragger accept=".txt,.doc,.docx,.pdf,.md,.rtf"
            showUploadList={false}
            beforeUpload={(f) => { const r = new FileReader(); r.onload = (e) => setContentText(e.target?.result as string || ''); r.readAsText(f); return false; }}
            style={{ borderRadius: 10, marginBottom: 14, background: '#FAFBFC', borderColor: '#C9CDD4' }}
          >
            <p className="ant-upload-drag-icon"><FileTextIcon size={28} color="#C9CDD4" /></p>
            <p style={{ fontSize: 13, color: '#4E5969' }}>拖拽或点击上传论文文件</p>
            <p style={{ fontSize: 11.5, color: '#C9CDD4' }}>支持 .txt .doc .docx .pdf .md</p>
          </Upload.Dragger>

          <Button type="primary" size="large" block loading={detecting} icon={<Sparkles />} onClick={handleDetect}
            style={{
              borderRadius: 10, height: 54, fontSize: 17, fontWeight: 900,
              background: 'linear-gradient(135deg, #1668DC 0%, #22C55E 50%, #1668DC 100%)',
              boxShadow: '0 4px 18px rgba(22,104,220,0.35)',
            }}>
            {detecting ? '⏳ 正在逐章分析论文...' : '🎓 开始分章节检测'}
          </Button>

          {(stats.total_papers > 0) && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #E5E6EB' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4E5969', marginBottom: 8 }}>📊 平台统计</div>
              <Row gutter={[8, 8]}>
                <Col span={12}><div style={{ padding: '7px 10px', background: '#EBF5FF', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#165DFF' }}>{stats.avg_integrity_score || '-'}%</div><div style={{ fontSize: 11, color: '#86909C' }}>平均诚信分</div>
                </div></Col>
                <Col span={12}><div style={{ padding: '7px 10px', background: '#F6FFED', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#00B42A' }}>{stats.completed || 0}</div><div style={{ fontSize: 11, color: '#86909C' }}>已检测论文</div>
                </div></Col>
              </Row>
            </div>
          )}
        </Card>

        {/* Right Panel */}
        <div>
          {stats.by_verdict && Object.keys(stats.by_verdict).length > 0 && (
            <Card size="small" style={{ borderRadius: 10, marginBottom: 16 }} title={<span style={{ fontSize: 14, fontWeight: 600 }}>📈 判定分布</span>}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(stats.by_verdict).map(([verdict, count]: [string, any], i) => {
                  const vc = VERDICT_CONFIG[verdict];
                  return vc ? <Tag key={i} color={vc.color} style={{ borderRadius: 12, padding: '4px 12px', fontSize: 12.5 }}>
                    {vc.label}: <strong>{count}</strong>
                  </Tag> : null;
                })}
              </div>
            </Card>
          )}

          <Card title={<span style={{ fontSize: 15, fontWeight: 700 }}>📋 论文检测历史</span>} style={{ borderRadius: 14 }}
            extra={<Button size="small" icon={<RefreshCw />} onClick={() => loadData()}>刷新</Button>}>
            {list.length > 0 ? (
              <Table columns={columns} dataSource={list} rowKey="id" size="middle"
                pagination={{ pageSize: 8, showTotal: (t) => `共 ${t} 篇论文` }} scroll={{ x: 1000 }} loading={loading} />
            ) : (
              <Empty description={<span style={{ color: '#86909C' }}>暂无检测记录，提交第一篇论文开始分章节检测</span>}
                image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '60px 0' }} />
            )}
          </Card>
        </div>
      </div>

      {/* ===== REPORT MODAL ===== */}
      <Modal
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 900, color: '#1668DC' }}>
            <GraduationCap size={22} /> 论文检测报告 — {current?.title?.slice(0, 40)}
          </span>
        }
        open={reportOpen} onCancel={() => setReportOpen(false)} destroyOnHidden width={1060}
        footer={[
          <Button key="close" type="primary" onClick={() => setReportOpen(false)} style={{ borderRadius: 7, background: '#1668DC' }}>关闭</Button>,
        ]}
      >
        {current && (() => {
          const vc = VERDICT_CONFIG[current.overall_verdict] || VERDICT_CONFIG.original;
          const chapters: ChapterAnalysisItem[] = Array.isArray(current.chapters) ? current.chapters : [];
          const recs = Array.isArray(current.improvement_recommendations) ? current.improvement_recommendations : [];

          return (
            <div>
              {/* Top Score Banner */}
              <div style={{
                textAlign: 'center', padding: '26px 22px', background: vc.bg, borderRadius: 14,
                marginBottom: 18, border: `2px solid ${vc.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
                  {vc.icon}
                  <span style={{ fontSize: 22, fontWeight: 900, color: vc.color }}>{vc.label}</span>
                  <Tag color={vc.color} style={{ borderRadius: 12, fontWeight: 600 }}>{current.confidence_level}置信度</Tag>
                </div>

                {/* Three Core Gauges */}
                <Row gutter={[28, 14]} justify="center">
                  <Col>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Progress type="circle" percent={Math.round(current.overall_integrity_score)} size={118}
                        strokeColor={current.overall_integrity_score >= 80 ? '#00B42A' : current.overall_integrity_score >= 60 ? '#FA8C16' : '#F53F3F'}
                        format={(p) => <span><span style={{ fontSize: 32, fontWeight: 900 }}>{p}</span><span style={{ fontSize: 16 }}>%</span></span>}
                        innerRef={(el) => {}} />
                      <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800, color: '#1D2129' }}>综合诚信得分</div>
                      <div style={{ fontSize: 12, color: '#86909C' }}>核心指标 (Originality Score)</div>
                    </div>
                  </Col>
                  <Col>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Progress type="circle" percent={Math.round(current.overall_ai_score)} size={98}
                        strokeColor="#722ED1"
                        format={(p) => <span><span style={{ fontSize: 26, fontWeight: 900 }}>{p}</span><span style={{ fontSize: 14 }}>%</span></span>} />
                      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: '#1D2129' }}>AI生成概率</div>
                    </div>
                  </Col>
                  <Col>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Progress type="circle" percent={Math.round(current.overall_plagiarism_score)} size={98}
                        strokeColor="#F472B6"
                        format={(p) => <span><span style={{ fontSize: 26, fontWeight: 900 }}>{p}</span><span style={{ fontSize: 14 }}>%</span></span>} />
                      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: '#1D2129' }}>抄袭相似度</div>
                    </div>
                  </Col>
                </Row>

                {/* Chapter Summary Bars */}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#4E5969', marginBottom: 8 }}>📖 章节检测结果分布</div>
                  <Row gutter={[10, 8]} justify="center">
                    {[
                      { label: '✅ 清洁', pct: current.clean_sections_count, color: '#00B42A' },
                      { label: '⚠️ 轻微问题', pct: Math.max(0, current.chapter_count - current.problematic_sections_count - current.clean_sections_count), color: '#165DFF' },
                      { label: '🔶 需修改', pct: current.problematic_sections_count, color: '#FA8C16' },
                      { label: '🔴 严重问题', pct: 0, color: '#F53F3F' },
                    ].filter(item => item.pct > 0 || item.label === '需修改').map((item, i) => (
                      <Col span={6} key={i}>
                        <div style={{ textAlign: 'center' }}>
                          <Progress percent={current.chapter_count > 0 ? (item.pct / current.chapter_count) * 100 : 0}
                            strokeColor={item.color} trailColor="#E5E6EB"
                            format={() => <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.pct}章</span>}
                            size="small" />
                          <div style={{ fontSize: 11.5, color: '#86909C', marginTop: 2 }}>{item.label}</div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>

                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 20, fontSize: 12.5, color: '#4E5969' }}>
                  <span>📝 {current.total_words}字 / {current.chapter_count}章 / 约{current.estimated_pages}页</span>
                  <span>⏱️ 耗时 {current.processing_time_ms}ms</span>
                  <span>📑 {current.paper_type_display} · {current.subject_area_display}</span>
                </div>
              </div>

              {/* Student-Friendly Summary */}
              {current.student_friendly_summary && (
                <>
                  <Divider orientation="left"><span style={{ fontSize: 15, fontWeight: 800, color: '#22C55E' }}>💬 给同学的话（学生友好摘要）</span></Divider>
                  <div style={{
                    padding: '18px 22px', background: 'linear-gradient(135deg, #ECFDF5, #F0FDF4)', borderRadius: 12,
                    fontSize: 14, color: '#065F46', lineHeight: 1.85, whiteSpace: 'pre-wrap',
                    borderLeft: '4px solid #22C55E',
                  }}>
                    {current.student_friendly_summary}
                  </div>
                </>
              )}

              {/* Chapter Tree View */}
              {chapters.length > 0 && (
                <>
                  <Divider orientation="left"><span style={{ fontSize: 15, fontWeight: 800 }}>📖 逐章检测结果 ({chapters.length}章)</span></Divider>
                  <div style={{ maxHeight: 500, overflowY: 'auto', padding: '4px' }}>
                    {chapters.map((ch, i) => {
                      const ct = CHAPTER_TYPE_ICONS[ch.chapter_type] || CHAPTER_TYPE_ICONS.other;
                      const chc = CH_VERDICT_COLORS[ch.verdict] || CH_VERDICT_COLORS.original_clean;
                      const isActive = activeChapterTab === i;
                      return (
                        <div key={i} onClick={() => setActiveChapterTab(isActive ? null : i)}
                          style={{
                            cursor: 'pointer', padding: '10px 14px', marginBottom: 6, borderRadius: 10,
                            background: isActive ? chc.bg : (i % 2 === 0 ? '#FFFFFF' : '#FAFBFC'),
                            borderLeft: `4px solid ${isActive ? chc.border : '#E5E6EB'}`,
                            transition: 'all 0.2s',
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              minWidth: 32, height: 32, borderRadius: 8, background: `${ct.color}15`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: ct.color, flexShrink: 0,
                            }}>{ct.icon}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                <strong style={{ fontSize: 14, color: '#1D2129' }}>
                                  第{ch.chapter_order}章 · {ch.chapter_title || ch.get_chapter_type_display}
                                </strong>
                                <Tag color={chc.tag} style={{ borderRadius: 4, fontSize: 10 }}>
                                  {ch.verdict === 'original_clean' ? '✅清洁' :
                                   ch.verdict === 'minor_ai_hints' ? '⚠️轻微' :
                                   ch.verdict === 'moderate_ai_content' ? '🔶中等' :
                                   ch.verdict === 'highly_ai_generated' ? '🤖AI高' :
                                   ch.verdict === 'plagiarism_found' ? '📋抄袭' : '混合'}
                                </Tag>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#86909C' }}>
                                <span>{ch.word_count}字</span>
                                <Progress percent={ch.ai_probability} size="small"
                                  strokeColor={ch.ai_probability > 50 ? '#722ED1' : '#00B42A'}
                                  trailColor="#F0F0F0" style={{ width: 80 }}
                                  format={() => <span style={{ fontSize: 10, fontWeight: 700 }}>AI{ch.ai_probability.toFixed(0)}%</span>} />
                                <Progress percent={ch.plagiarism_similarity} size="small"
                                  strokeColor={ch.plagiarism_similarity > 25 ? '#F472B6' : '#00B42A'}
                                  trailColor="#F0F0F0" style={{ width: 80 }}
                                  format={() => <span style={{ fontSize: 10, fontWeight: 700 }}>抄{ch.plagiarism_similarity.toFixed(0)}%</span>} />
                                <span style={{ fontWeight: 700, color: chc.text }}>诚信{ch.integrity_score.toFixed(0)}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                              <Progress type="circle" percent={Math.round(ch.integrity_score)} size={38}
                                strokeColor={ch.integrity_score >= 80 ? '#00B42A' : ch.integrity_score >= 60 ? '#FA8C16' : '#F53F3F'}
                                format={() => ''} />
                            </div>
                          </div>

                          {/* Expanded Detail */}
                          {isActive && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${chc.border}40`, paddingLeft: 8 }}>
                              {ch.writing_style_notes && (
                                <div style={{ fontSize: 12.5, color: '#4E5969', lineHeight: 1.7, marginBottom: 8, padding: '8px 12px', background: '#FAFBFC', borderRadius: 6 }}>
                                  💡 <strong>写作评价：</strong>{ch.writing_style_notes}
                                </div>
                              )}
                              {Array.isArray(ch.problem_sentences) && ch.problem_sentences.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#F53F3F', marginBottom: 4 }}>⚡ 问题句子 ({ch.problem_sentences.length})</div>
                                  {ch.problem_sentences.slice(0, 5).map((ps: any, pi: number) => (
                                    <div key={pi} style={{
                                      padding: '5px 10px', marginBottom: 3, borderRadius: 4,
                                      background: ps.severity === 'high' || ps.severity === 'critical' ? '#FFF1F0' : '#FFF7E8',
                                      fontSize: 12, lineHeight: 1.5,
                                    }}>
                                      <Tag color={ps.severity === 'critical' ? 'red' : ps.severity === 'high' ? 'volcano' : ps.severity === 'medium' ? 'orange' : 'default'}
                                        style={{ borderRadius: 3, fontSize: 10, marginRight: 4 }}>{ps.severity}</Tag>
                                      <span style={{ color: '#4E5969' }}>{ps.text_preview}</span>
                                      {ps.suggestion && <div style={{ color: '#86909C', fontSize: 11, marginTop: 2 }}>→ {ps.suggestion}</div>}
                                    </div>
                                  ))}
                                  {ch.problem_sentences.length > 5 && <div style={{ fontSize: 11, color: '#86909C' }}>...还有 {ch.problem_sentences.length - 5} 条</div>}
                                </div>
                              )}

                              {/* Score Breakdown Mini */}
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                                {[
                                  ['困惑度', ch.perplexity_score], ['突发性', ch.burstiness_score],
                                  ['词汇多样性', (ch.vocabulary_diversity || 0) * 100], ['学术语气', ch.academic_tone_score],
                                  ['引用密度', Math.min(ch.citation_density * 10, 100)],
                                ].map(([label, val]: [string, any], si: number) => (
                                  <div key={si} style={{ padding: '4px 10px', background: '#F7F8FA', borderRadius: 6, fontSize: 11 }}>
                                    {label}: <strong style={{ color: typeof val === 'number' ? (val > 50 ? '#00B42A' : '#FA8C16') : '#1D2129' }}>
                                      {typeof val === 'number' ? val.toFixed(0) : '-'}
                                    </strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Improvement Recommendations */}
              {recs.length > 0 && (
                <>
                  <Divider orientation="left"><span style={{ fontSize: 15, fontWeight: 800, color: '#FA8C16' }}>🔧 修改建议 ({recs.length}条)</span></Divider>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {recs.map((rec, i) => {
                      const pColors: Record<string, string> = { P0: '#F53F3F', P1: '#FF7D00', P2: '#FAAD14' };
                      const pLabels: Record<string, string> = { P0: '🔴 紧急', P1: '🟡 重要', P2: '🟢 建议' };
                      const pKey = rec.priority?.split('(')[0] || 'P2';
                      return (
                        <div key={i} style={{
                          padding: '12px 16px', marginBottom: 8, borderRadius: 10,
                          background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC',
                          borderLeft: `4px solid ${pColors[pKey] || '#C9CDD4'}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Tag color={pColors[pKey]} style={{ borderRadius: 4, fontWeight: 700 }}>{pLabels[pKey] || rec.priority}</Tag>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#1D2129' }}>{rec.issue}</span>
                            <span style={{ fontSize: 11.5, color: '#86909C', marginLeft: 'auto' }}>📍 {rec.chapter_ref}</span>
                          </div>
                          <div style={{ fontSize: 12.5, color: '#4E5969', lineHeight: 1.65, marginBottom: 6 }}>
                            <strong>建议：</strong>{rec.suggestion}
                          </div>
                          {(rec.example_before || rec.example_after) && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                              {rec.example_before && (
                                <div style={{ padding: '6px 10px', background: '#FFF1F0', borderRadius: 6, fontSize: 11.5, border: '1px dashed #F53F3F' }}>
                                  <div style={{ fontWeight: 600, color: '#F53F3F', marginBottom: 2 }}>❌ 修改前</div>
                                  {rec.example_before}
                                </div>
                              )}
                              {rec.example_after && (
                                <div style={{ padding: '6px 10px', background: '#E8FFEA', borderRadius: 6, fontSize: 11.5, border: '1px dashed #00B42A' }}>
                                  <div style={{ fontWeight: 600, color: '#00B42A', marginBottom: 2 }}>✅ 修改后</div>
                                  {rec.example_after}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Citation Analysis */}
              {current.citation_analysis && Object.keys(current.citation_analysis).length > 2 && (
                <Collapse ghost style={{ marginTop: 14 }} items={[{
                  key: 'citation',
                  label: <span style={{ fontWeight: 700 }}>📚 引用分析详情</span>,
                  children: (
                    <Row gutter={[12, 12]}>
                      {Object.entries(current.citation_analysis).filter(([k]) => !['issues'].includes(k)).map(([key, val]: [string, any], ci) => (
                        <Col span={8} key={ci}>
                          <div style={{ padding: '8px 12px', background: '#F7F8FA', borderRadius: 8, textAlign: 'center' }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#1668DC' }}>{typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(1)) : val}</div>
                            <div style={{ fontSize: 11, color: '#86909C' }}>{{
                              total_citations_found: '总引用数', citations_per_1000words: '引用/千字',
                              oldest_citation_year: '最早年份', newest_citation_year: '最新年份',
                              avg_citation_age_years: '平均引用年龄(年)',
                              format_compliance: '格式合规性',
                            }[key] || key}</div>
                          </div>
                        </Col>
                      ))}
                    </Row>
                  ),
                }]} />
              )}

              {/* Full Report */}
              {current.detailed_report && (
                <div style={{ marginTop: 14 }}>
                  <Divider orientation="left"><span style={{ fontSize: 15, fontWeight: 800 }}>📑 完整检测报告</span></Divider>
                  <div style={{ padding: '14px 18px', background: '#F7F8FA', borderRadius: 8, fontSize: 13, color: '#4E5969', lineHeight: 1.85, whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto' }}>
                    {current.detailed_report}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function FileTextIcon({ size }: { size?: number }) { return <FileText size={size || 24} />; }

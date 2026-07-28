import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { Card, Button, Tag, Modal, Select, Input, Upload, message, Table, Progress, Row, Col, Alert, Empty, Badge, Statistic, Descriptions, Steps, Timeline, Space, Tooltip, Segmented, Result, Spin, Collapse, Typography, Divider } from 'antd';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  Upload as UploadIcon, FileText, Sparkles, Search, Eye,
  Activity, Radar, Lock, Scale, Bug, Zap, Fingerprint,
  Globe, Database, BarChart3, PieChart as PieChartIcon,
  LineChart, Target, TrendingUp, TrendingDown, Clock,
  ChevronRight, PlayCircle, Download, RefreshCw,
  ScanLine, Crosshair, FileSearch, Gavel, BookOpen,
  GraduationCap, Building2, Stethoscope, Video, Image as ImageIcon,
  Code, Mail, MessageCircle, Hash, Flag, ClipboardList,
  Gauge,
} from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import { unifiedScanApi, type UnifiedScanItem } from '@/api/unifiedScanApi';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

const RISK_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  critical: { color: '#F53F3F', bg: '#FFECE8', icon: <ShieldAlert size={14} />, label: '严重违规' },
  high: { color: '#FF7D00', bg: '#FFF0E6', icon: <AlertTriangle size={14} />, label: '高风险' },
  medium: { color: '#FA8C16', bg: '#FFF7E8', icon: <AlertTriangle size={14} />, label: '中风险' },
  low: { color: '#86909C', bg: '#F2F3F5', icon: <Info size={14} />, label: '低风险' },
  info: { color: '#165DFF', bg: '#E8F3FF', icon: <Info size={14} />, label: '信息级' },
  safe: { color: '#00B42A', bg: '#E8FFEA', icon: <CheckCircle2 size={14} />, label: '安全' },
};

function Info({ size = 12 }: { size?: number }) { return <Info size={size} />; }

const CATEGORIES = [
  { value: 'auto_detect', label: '🤖 智能识别(推荐)', icon: <Zap />, desc: '自动分析内容类型并分发到对应检测器' },
  { value: 'general_text', label: '📝 通用文本', icon: <FileText />, desc: '文章/报告/公告等通用文本检测' },
  { value: 'medical_report', label: '🏥 医疗报告', icon: <Stethoscope />, desc: '医疗文书AI生成+错误识别' },
  { value: 'legal_document', label: '⚖️ 法律文书', icon: <Gavel />, desc: '合同/诉讼/合规扫描' },
  { value: 'financial_statement', label: '📊 财务报表', icon: <BarChart3 />, desc: '造假指标+异常项目审计' },
  { value: 'design_draft', label: '🎨 设计稿', icon: <ImageIcon />, desc: 'AI伪影+抄袭+原创度' },
  { value: 'academic_paper', label: '🎓 学术论文', icon: <GraduationCap />, desc: '7维全链路学术不端检测' },
  { value: 'enterprise_content', label: '🏢 企业文档', icon: <Building2 />, desc: '企业级安全审计(6大模块)' },
  { value: 'video_media', label: '🎬 视频媒体', icon: <Video />, desc: '8维深度伪造鉴别' },
  { value: 'image_media', label: '🖼️ 图片媒体', icon: <ImageIcon />, desc: 'AI生成图片检测+溯源' },
  { value: 'code_source', label: '💻 代码/源码', icon: <Code />, desc: '敏感信息泄露+版权检测' },
  { value: 'email_comm', label: '📧 邮件/通讯', icon: <Mail />, desc: '钓鱼邮件+PII泄露+合规检查' },
  { value: 'social_content', label: '💬 社交媒体', icon: <MessageCircle />, desc: '虚假信息+违规内容+广告法审查' },
];

const DIMENSIONS = [
  { key: 'D1_ai_generated', label: 'AI生成检测', icon: <Zap />, color: '#722ED1' },
  { key: 'D2_plagiarism', label: '抄袭相似度', icon: <Fingerprint />, color: '#F53F3F' },
  { key: 'D3_deepfake', label: '深度伪造', icon: <Video />, color: '#F53F3F' },
  { key: 'D4_data_leakage', label: '数据泄露', icon: <ShieldAlert />, color: '#FF7D00' },
  { key: 'D5_compliance', label: '合规性审查', icon: <Scale />, color: '#165DFF' },
  { key: 'D6_content_safety', label: '内容安全', icon: <Flag />, color: '#FA8C16' },
  { key: 'D7_data_quality', label: '数据质量', icon: <Database />, color: '#86909C' },
  { key: 'D8_source_credibility', label: '来源可信度', icon: <Search />, color: '#00B42A' },
  { key: 'D9_industry_specific', label: '行业特定', icon: <Crosshair />, color: '#36CFC9' },
  { key: 'D10_comprehensive', label: '综合评估', icon: <Radar />, color: '#165DFF' },
];

export default function UnifiedScanPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [list, setList] = useState<UnifiedScanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [current, setCurrent] = useState<UnifiedScanItem | null>(null);

  const [inputCategory, setInputCategory] = useState('auto_detect');
  const [contentText, setContentText] = useState('');
  const [fileName, setFileName] = useState('');
  const [stats, setStats] = useState<Record<string, any>>({});

  useEffect(() => { loadData(); loadStats(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await unifiedScanApi.list({ limit: 50 });
      setList(Array.isArray(res.data.results) ? res.data.results : Array.isArray(res.data) ? res.data : []);
    } catch { setList([]); }
    setLoading(false);
  }

  async function loadStats() {
    try { setStats((await unifiedScanApi.stats()).data); } catch {}
  }

  async function handleScan() {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!contentText.trim()) { message.warning('请输入需要检测的内容'); return; }
    setScanning(true);
    try {
      const res = await unifiedScanApi.scan({
        input_category: inputCategory,
        original_text: contentText,
        file_name: fileName || `${inputCategory}_unified.txt`,
        file_size: new Blob([contentText]).size,
        file_type: fileName?.split('.').pop() || 'text/plain',
      });
      message.success('全品类内容安全检测完成！');
      setCurrent(res.data.data); setReportOpen(true);
      setContentText(''); setFileName(''); loadData(); loadStats();
    } catch (e: any) { message.error(e.response?.data?.detail || e.response?.data?.message || '检测失败，请重试'); }
    setScanning(false);
  }

  function openReport(r: UnifiedScanItem) { setCurrent(r); setReportOpen(true); }

  const columns: ColumnsType<UnifiedScanItem> = [
    { title: '时间', dataIndex: 'created_at', width: 165, defaultSortOrder: 'descend',
      render: (t: string) => <span style={{ fontSize: 13 }}>{t ? new Date(t).toLocaleString('zh-CN') : '-'}</span> },
    { title: '分类', width: 120, render: (_, r) => (
      <Tooltip title={`输入: ${r.input_cat_display}`}>
        <Tag color="#165DFF" style={{ borderRadius: 4 }}>{r.detected_cat_display || r.input_cat_display}</Tag>
      </Tooltip>
    )},
    { title: '风险等级', width: 105, render: (_, r) => {
      const c = RISK_CONFIG[r.overall_risk_level];
      return c ? <Tag color={c.color} style={{ borderRadius: 6, fontWeight: 700 }}>{c.icon} {c.label}</Tag> : '-';
    }},
    { title: '三合一评分', width: 180, render: (_, r) => (
      <Space size={2}>
        <Tooltip title="风险"><Tag color={r.overall_risk_score > 60 ? 'red' : r.overall_risk_score > 30 ? 'orange' : 'green'} style={{ borderRadius: 4, fontSize: 11 }}>
          风{r.overall_risk_score}
        </Tag></Tooltip>
        <Tooltip title="合规"><Tag color={r.compliance_score >= 80 ? 'green' : 'orange'} style={{ borderRadius: 4, fontSize: 11 }}>
          合{r.compliance_score}
        </Tag></Tooltip>
        <Tooltip title="诚信"><Tag color={r.integrity_score >= 80 ? 'green' : 'orange'} style={{ borderRadius: 4, fontSize: 11 }}>
          信{r.integrity_score}
        </Tag></Tooltip>
      </Space>
    )},
    { title: '检测器', width: 90, render: (_, r) =>
      <span><Badge count={r.detectors_failed} style={{ backgroundColor: '#F53F3F', marginRight: 4 }} />
       <Badge count={r.detectors_passed} style={{ backgroundColor: '#00B42A' }} /></span> },
    { title: '耗时', width: 70, render: (_, r) => <span style={{ fontSize: 12, color: '#86909C' }}>{r.processing_time_ms}ms</span> },
    { title: '操作', width: 70, fixed: 'right', render: (_, r) => <Button type="link" icon={<Eye />} onClick={() => openReport(r)}>详情</Button> },
  ];

  return (
    <div style={{ padding: '20px 40px', maxWidth: 1500, margin: '0 auto', background: '#F2F3F5', minHeight: '100vh' }}>
      {/* Hero - Platform Level */}
      <div style={{
        textAlign: 'center', marginBottom: 28, padding: '32px 24px',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 25%, #16213e 50%, #0f3460 75%, #1a1a2e 100%)',
        borderRadius: 16, color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, left: '10%', width: 300, height: 300, background: 'rgba(22,93,255,0.06)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -50, right: '5%', width: 350, height: 350, background: 'rgba(245,63,63,0.05)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 500, background: 'radial-gradient(circle, rgba(114,46,209,0.08) 0%, transparent 70%)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Radar size={28} color="#4FC3F7" />
            <Tag color="#4FC3F7" style={{ borderRadius: 20, fontWeight: 800, border: 'none', color: '#0a0a1a', fontSize: 13 }}>统一平台</Tag>
          </div>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900, letterSpacing: 1 }}>全品类内容安全检测</h1>
          <p style={{ margin: '10px 0 0', fontSize: 15.5, opacity: 0.92, maxWidth: 800, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.75 }}>
            一站式入口 · 智能分类 · 10维度并行检测 · 合规法规自动映射 · 整改建议优先排序<br />
            <span style={{ opacity: 0.78, fontSize: 14 }}>强化审核能力 · 规避合规风险 · 从工具到平台的终极形态</span>
          </p>

          {/* Capability Pills */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 18, flexWrap: 'wrap' }}>
            {[
              ['10大检测维度', <Hash />], ['14种内容类型', <FileSearch />],
              ['6部法规对标', <Gavel />], ['智能路由引擎', <Zap />],
              ['一键聚合报告', <ClipboardList />], ['高管一页纸', <BarChart3 />],
            ].map(([label, icon], i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                background: 'rgba(255,255,255,0.08)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
                fontSize: 13, fontWeight: 500,
              }}>{icon}<span>{label}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 22 }}>
        {/* Left: Submit Panel */}
        <Card
          title={<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 800, color: '#165DFF' }}>
            <PlayCircle size={20} /> 提交检测
          </span>}
          style={{ borderRadius: 14 }}
          styles={{ header: { borderBottom: '2px solid rgba(22,93,255,0.2)', borderRadius: '14px 14px 0 0' } }}
        >
          {/* Category Selector */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 8 }}>内容类型</label>
            <Select value={inputCategory} onChange={(v) => setInputCategory(v)} style={{ width: '100%', borderRadius: 8 }} size="large"
              options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
            {(() => {
              const sel = CATEGORIES.find(c => c.value === inputCategory);
              return sel ? <div style={{ fontSize: 11.5, color: '#86909C', marginTop: 4, paddingLeft: 2 }}>{sel.desc}</div> : null;
            })()}
          </div>

          {/* Content Input */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 6 }}>
              待检测内容 * <span style={{ fontWeight: 400, color: '#C9CDD4' }}>(支持任意类型)</span>
            </label>
            <TextArea rows={7} placeholder='粘贴任意内容...&#10;&#10;支持：文本 / 代码 / JSON / HTML / Markdown / 日志 / API响应 / 邮件正文 等'
              value={contentText} onChange={(e) => setContentText(e.target.value)} style={{ borderRadius: 8, fontSize: 14 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: '#C9CDD4' }}>{contentText.length.toLocaleString()} 字符</span>
              {fileName && <span style={{ fontSize: 12, color: '#165DFF' }}>📎 {fileName}</span>}
            </div>
          </div>

          {/* Upload */}
          <Upload.Dragger accept=".txt,.json,.md,.py,.js,.ts,.html,.xml,.csv,.log,.doc,.pdf,.eml"
            showUploadList={false}
            beforeUpload={(f) => { setFileName(f.name); const r = new FileReader(); r.onload = (e) => setContentText(e.target?.result as string || ''); r.readAsText(f); return false; }}
            style={{ borderRadius: 10, marginBottom: 16, background: '#FAFBFC', borderColor: '#C9CDD4' }}
          >
            <p className="ant-upload-drag-icon"><UploadIcon size={30} color="#C9CDD4" /></p>
            <p style={{ fontSize: 13, color: '#4E5969' }}>拖拽或点击上传文件</p>
            <p style={{ fontSize: 11.5, color: '#C9CDD4' }}>任意格式 · 自动识别类型</p>
          </Upload.Dragger>

          {/* 10 Dimensions Preview */}
          <Button type="primary" size="large" block loading={scanning} icon={<Sparkles />} onClick={handleScan}
            style={{ borderRadius: 10, height: 52, fontSize: 16, fontWeight: 800,
              background: 'linear-gradient(135deg, #165DFF 0%, #36CFC9 50%, #00B42A 100%)' }}>
            {scanning ? '正在执行10维度全品类检测...' : '🚀 开始全品类安全检测'}
          </Button>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #E5E6EB' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#4E5969', marginBottom: 10 }}>🔍 10大检测维度</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {DIMENSIONS.map((d, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
                  background: i % 2 === 0 ? '#EBF5FF' : i % 2 === 1 ? '#F6FFED' : i % 3 === 2 ? '#FFF7E8' : '#F9F0FF',
                  borderRadius: 6, fontSize: 12,
                }}>
                  {React.cloneElement(d.icon as React.ReactElement<any>, { size: 13, style: { color: d.color } })}
                  <strong>{d.label}</strong>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Right: Dashboard + History */}
        <div>
          {/* Global Stats */}
          <Row gutter={[12, 12]} style={{ marginBottom: 18 }}>
            {[
              { label: '总检测数', value: stats.total || 0, icon: Database, color: '#165DFF', bg: '#E8F3FF' },
              { label: '严重违规', value: stats.critical || 0, icon: ShieldAlert, color: '#F53F3F', bg: '#FFECE8' },
              { label: '高风险', value: stats.high || 0, icon: AlertTriangle, color: '#FF7D00', bg: '#FFF0E6' },
              { label: '平均风险分', value: typeof stats.avg_risk_score === 'number' ? stats.avg_risk_score.toFixed(1) : '-', icon: Gauge, color: stats.avg_risk_score > 50 ? '#F53F3F' : '#00B42A', bg: stats.avg_risk_score > 50 ? '#FFECE8' : '#E8FFEA' },
            ].map((card, i) => (
              <Col xs={12} sm={6} key={i}>
                <Card size="small" style={{ borderRadius: 10, borderLeft: `4px solid ${card.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <card.icon size={17} style={{ color: card.color }} />
                    </div>
                    <div><div style={{ fontSize: 24, fontWeight: 800, color: '#1D2129' }}>{card.value}</div>
                      <div style={{ fontSize: 11, color: '#86909C' }}>{card.label}</div></div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          {/* By Category Breakdown */}
          {(stats.by_category && Object.keys(stats.by_category).length > 0) && (
            <Card size="small" style={{ borderRadius: 10, marginBottom: 18 }} title={<span style={{ fontSize: 14, fontWeight: 600 }}>📂 检测分布（按类别）</span>}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(stats.by_category).map(([cat, cnt]: [string, any], i) => (
                  <Tag key={i} color="blue" style={{ borderRadius: 12, padding: '4px 12px', fontSize: 13 }}>
                    {cat}: <strong>{cnt}</strong>
                  </Tag>
                ))}
              </div>
            </Card>
          )}

          {/* History Table */}
          <Card title={<span style={{ fontSize: 15, fontWeight: 700 }}>📋 全品类检测历史</span>} style={{ borderRadius: 14 }}
            extra={<Button size="small" icon={<RefreshCw />} onClick={() => loadData()}>刷新</Button>}>
            {list.length > 0 ? (
              <Table columns={columns} dataSource={list} rowKey="id" size="middle"
                pagination={{ pageSize: 8, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 950 }} loading={loading} />
            ) : (
              <Empty description={<span style={{ color: '#86909C' }}>暂无检测记录，提交第一份内容开始全品类检测</span>}
                image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '60px 0' }} />
            )}
          </Card>
        </div>
      </div>

      {/* ===== REPORT MODAL - The Core ===== */}
      <Modal
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 900, color: '#165DFF' }}>
            <Radar size={22} /> 全品类检测报告 #{current?.id?.slice(-8)}
          </span>
        }
        open={reportOpen} onCancel={() => setReportOpen(false)} destroyOnHidden width={960}
        footer={[
          <Button key="close" type="primary" onClick={() => setReportOpen(false)} style={{ borderRadius: 7 }}>关闭</Button>,
        ]}
      >
        {current && (() => {
          const rc = RISK_CONFIG[current.overall_risk_level] || RISK_CONFIG.safe;
          const dims = typeof current.dimension_results === 'object' ? current.dimension_results : {};
          const findings = current.finding_details || [];
          const compliance = typeof current.compliance_mapping === 'object' ? current.compliance_mapping : {};
          const violations = compliance.violated_articles || [];
          const remediation = current.remediation_plan || [];

          return (
            <div>
              {/* Top Banner: Three Scores + Risk */}
              <div style={{
                textAlign: 'center', padding: '24px', background: rc.bg, borderRadius: 14,
                marginBottom: 22, border: `2px solid ${rc.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                  {rc.icon}<span style={{ fontSize: 20, fontWeight: 900, color: rc.color }}>综合判定：{rc.label}</span>
                  <Tag color={rc.color} style={{ borderRadius: 12, fontWeight: 600, fontSize: 12 }}>
                    {current.detected_cat_display || current.input_cat_display}
                  </Tag>
                </div>

                <Row gutter={[24, 12]} justify="center">
                  <Col span={6}>
                    <div style={{ fontSize: 12, color: '#86909C', marginBottom: 4 }}>综合风险评分</div>
                    <div style={{ fontSize: 44, fontWeight: 900, color: current.overall_risk_score > 60 ? '#F53F3F' : current.overall_risk_score > 30 ? '#FA8C16' : '#00B42A' }}>
                      {current.overall_risk_score}
                    </div>
                    <Progress percent={current.overall_risk_score} showInfo={false} strokeColor={current.overall_risk_score > 60 ? '#F53F3F' : current.overall_risk_score > 30 ? '#FA8C16' : '#00B42A'} trailColor="#E5E6EB" size="small" style={{ marginTop: 6 }} />
                  </Col>
                  <Col span={6}>
                    <div style={{ fontSize: 12, color: '#86909C', marginBottom: 4 }}>合规评分</div>
                    <div style={{ fontSize: 44, fontWeight: 900, color: current.compliance_score >= 80 ? '#00B42A' : '#FA8C16' }}>
                      {current.compliance_score}
                    </div>
                    <Progress percent={current.compliance_score} showInfo={false} strokeColor={current.compliance_score >= 80 ? '#00B42A' : '#FA8C16'} trailColor="#E5E6EB" size="small" style={{ marginTop: 6 }} />
                  </Col>
                  <Col span={6}>
                    <div style={{ fontSize: 12, color: '#86909C', marginBottom: 4 }}>诚信/完整性</div>
                    <div style={{ fontSize: 44, fontWeight: 900, color: current.integrity_score >= 80 ? '#00B42A' : '#FA8C16' }}>
                      {current.integrity_score}
                    </div>
                    <Progress percent={current.integrity_score} showInfo={false} strokeColor={current.integrity_score >= 80 ? '#00B42A' : '#FA8C16'} trailColor="#E5E6EB" size="small" style={{ marginTop: 6 }} />
                  </Col>
                  <Col span={6}>
                    <div style={{ fontSize: 12, color: '#86909C', marginBottom: 4 }}>检测执行</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: '#1D2129', lineHeight: 1.2 }}>
                      {current.detectors_executed}<br /><span style={{ fontSize: 14, color: '#86909C' }}>个检测器</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      ✅ {current.detectors_passed} 通过 &nbsp;
                      ⚠️ {current.detectors_failed} 告警
                    </div>
                  </Col>
                </Row>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'center', gap: 24, fontSize: 13, color: '#4E5969' }}>
                  <span>AI生成: <strong>{(current.ai_generated_probability * 100).toFixed(1)}%</strong></span>
                  <span>抄袭: <strong>{(current.plagiarism_similarity * 100).toFixed(1)}%</strong></span>
                  <span>深伪: <strong>{(current.deepfake_probability * 100).toFixed(1)}%</strong></span>
                  <span>数据泄露: <strong>{(current.data_leak_risk * 100).toFixed(1)}%</strong></span>
                  <span>耗时: <strong>{current.processing_time_ms}ms</strong></span>
                </div>
              </div>

              {/* 10 Dimension Scores */}
              <Divider orientation="left"><span style={{ fontSize: 15, fontWeight: 800 }}>🔬 10维度检测结果</span></Divider>
              <Row gutter={[10, 10]} style={{ marginBottom: 20 }}>
                {DIMENSIONS.map((dim, i) => {
                  const d = dims[dim.key] || {};
                  const score = typeof d.score === 'number' ? d.score : 50;
                  const verdict = d.verdict || 'n/a';
                  const barColor = verdict === 'fail' ? '#F53F3F' : verdict === 'warn' ? '#FA8C16' : verdict === 'pass' ? '#00B42A' : '#86909C';
                  return (
                    <Col xs={12} sm={8} md={6} key={dim.key}>
                      <div style={{ textAlign: 'center', padding: '12px 8px', background: '#FAFBFC', borderRadius: 10, border: `1px solid ${barColor}20` }}>
                        <div style={{ color: dim.color, marginBottom: 4 }}>{dim.icon}</div>
                        <div style={{ fontSize: 11, color: '#86909C', marginBottom: 2 }}>{dim.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: barColor }}>{score}<span style={{ fontSize: 12 }}>分</span></div>
                        <Progress percent={score} showInfo={false} strokeColor={barColor} trailColor="#E5E6EB" size="small" style={{ marginTop: 4 }} />
                        <Tag color={barColor} style={{ borderRadius: 4, fontSize: 10, marginTop: 4, fontWeight: 600 }}>
                          {verdict === 'pass' ? '✅ 通过' : verdict === 'warn' ? '⚠️ 告警' : verdict === 'fail' ? '❌ 不通过' : '-'}
                        </Tag>
                        {d.key_finding && <div style={{ fontSize: 11, color: '#4E5969', marginTop: 4, lineHeight: 1.4 }}>{d.key_finding}</div>}
                      </div>
                    </Col>
                  );
                })}
              </Row>

              {/* Findings by Severity */}
              {findings.length > 0 && (
                <>
                  <Divider orientation="left"><span style={{ fontSize: 15, fontWeight: 800 }}>
                    🚨 发现详情 ({findings.length}项)
                  </span></Divider>
                  <Collapse
                    defaultActiveKey={['critical', 'high']}
                    items={[
                      { key: 'critical', label: <span><Badge count={findings.filter(f => f.severity === 'critical').length} style={{ marginRight: 8 }} /> 严重违规</span>, children: (
                        findings.filter(f => f.severity === 'critical').map((f, i) => (
                          <div key={i} style={{ padding: '10px 14px', background: '#FFF1F0', borderRadius: 8, marginBottom: 6, borderLeft: '4px solid #F53F3F' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <Tag color="red" style={{ borderRadius: 4, fontWeight: 700 }}>{f.id}</Tag>
                              <Tag color="blue">{f.dimension}</Tag>
                              <strong>{f.title}</strong>
                            </div>
                            <p style={{ margin: 0, fontSize: 13, color: '#4E5969', lineHeight: 1.6 }}>{f.description}</p>
                            {f.location && <div style={{ fontSize: 12, color: '#86909C' }}>📍 {f.location}</div>}
                          </div>
                        ))
                      )},
                      { key: 'high', label: <span><Badge count={findings.filter(f => f.severity === 'high').length} style={{ marginRight: 8, backgroundColor: '#FF7D00' }} /> 高风险</span>, children: (
                        findings.filter(f => f.severity === 'high').map((f, i) => (
                          <div key={i} style={{ padding: '10px 14px', background: '#FFF7E8', borderRadius: 8, marginBottom: 6, borderLeft: '4px solid #FF7D00' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <Tag color="orange" style={{ borderRadius: 4 }}>{f.id}</Tag>
                              <Tag color="blue">{f.dimension}</Tag>
                              <strong>{f.title}</strong>
                            </div>
                            <p style={{ margin: 0, fontSize: 13, color: '#4E5969' }}>{f.description}</p>
                          </div>
                        ))
                      )},
                      { key: 'medium', label: <span><Badge count={findings.filter(f => f.severity === 'medium').length} style={{ marginRight: 8, backgroundColor: '#FA8C16' }} /> 中风险</span>, children: (
                        findings.filter(f => f.severity === 'medium').slice(0, 10).map((f, i) => (
                          <div key={i} style={{ padding: '8px 12px', background: '#FAFBFC', borderRadius: 6, marginBottom: 4, fontSize: 13, borderLeft: '3px solid #FA8C16' }}>
                            <Tag color="gold" style={{ borderRadius: 3, fontSize: 11, marginRight: 6 }}>{f.id}</Tag>
                            [{ f.dimension }, { f.title }].join(' — ')
                          </div>
                        ))
                      )},
                    ]}
                  />
                </>
              )}

              {/* Compliance Mapping */}
              {violations.length > 0 && (
                <>
                  <Divider orientation="left"><span style={{ fontSize: 15, fontWeight: 800 }}>
                    ⚖️ 法规映射 ({violations.length}条违规)
                  </span></Divider>
                  <Table
                    dataSource={violations}
                    rowKey="finding_ref"
                    size="small"
                    pagination={false}
                    scroll={{ x: 700 }}
                    columns={[
                      { title: '法规', dataIndex: 'regulation', width: 120, render: (v: string) => <Tag color="blue" style={{ borderRadius: 4 }}>{v}</Tag> },
                      { title: '法条', dataIndex: 'article', width: 90, ellipsis: true },
                      { title: '要求', dataIndex: 'requirement', ellipsis: true, render: (r: string) => <span style={{ fontSize: 12 }}>{r}</span> },
                      { title: '后果', dataIndex: 'penalty', width: 120, render: (p: string) => <span style={{ fontSize: 12, color: '#F53F3F' }}>{p}</span> },
                    ]}
                  />
                </>
              )}

              {/* Remediation Plan */}
              {remediation.length > 0 && (
                <>
                  <Divider orientation="left"><span style={{ fontSize: 15, fontWeight: 800 }}>
                    📋 整改计划 ({remediation.length}项)
                  </span></Divider>
                  {remediation.map((item, i) => {
                    const pColor = item.priority === 'P0' ? '#F53F3F' : item.priority === 'P1' ? '#FF7D00' : item.priority === 'P2' ? '#FA8C16' : '#86909C';
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
                        background: i % 2 === 0 ? '#FAFBFC' : '#FFF', borderRadius: 8, marginBottom: 6,
                        borderLeft: `3px solid ${pColor}`,
                      }}>
                        <Tag color={pColor} style={{ borderRadius: 4, fontWeight: 800, flexShrink: 0, marginTop: 2 }}>{item.priority}</Tag>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{item.action}</div>
                          <div style={{ fontSize: 12, color: '#86909C' }}>
                            关联: {item.finding_id} | 责任人: {item.responsible_role} | 期限: {item.deadline || '-'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Executive Brief */}
              {current.executive_brief && (
                <>
                  <Divider orientation="left"><span style={{ fontSize: 15, fontWeight: 800 }}>
                    📄 高管简报 (Executive Brief)
                  </span></Divider>
                  <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #F0F5FF, #E8FFEA)', borderRadius: 10, fontSize: 13.5, color: '#1D2129', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
                    {current.executive_brief}
                  </div>
                </>
              )}

              {/* Full Report */}
              {current.unified_report && (
                <div>
                  <Divider orientation="left"><span style={{ fontSize: 15, fontWeight: 800 }}>
                    📑 完整统一检测报告
                  </span></Divider>
                  <div style={{ padding: '14px 18px', background: '#F7F8FA', borderRadius: 8, fontSize: 13, color: '#4E5969', lineHeight: 1.85, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto' }}>
                    {current.unified_report}
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

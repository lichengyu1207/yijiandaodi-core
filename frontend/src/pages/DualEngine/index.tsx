import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { Card, Button, Tag, Modal, Input, Upload, message, Table, Progress, Row, Col, Alert, Empty, Badge, Statistic, Space, Tooltip, Segmented, Result, Spin, Typography, Divider, Radio } from 'antd';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  Upload as UploadIcon, FileText, Sparkles, Search, Eye,
  Brain, Copy, Fingerprint, Target, Zap, Gauge,
  BarChart3, PieChart as PieChartIcon, TrendingUp,
  Clock, PlayCircle, RefreshCw,
  ScanLine, FileSearch, BookOpen,
  Bot, UserCheck, Shuffle, Link2Off,
  ChevronRight, Download, Info,
} from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import { dualEngineApi, type DualEngineItem, type SentenceAnalysis, type SourceMatch } from '@/api/dualEngineApi';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

const VERDICT_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string; desc: string }> = {
  human_written: { color: '#00B42A', bg: '#E8FFEA', icon: <UserCheck size={16} />, label: '人工撰写', desc: '文本极大概率为人工原创撰写' },
  ai_generated: { color: '#722ED1', bg: '#F9F0FF', icon: <Bot size={16} />, label: 'AI生成', desc: '文本极大概率为AI模型生成' },
  mixed_content: { color: '#FA8C16', bg: '#FFF7E8', icon: <Shuffle size={16} />, label: '混合内容', desc: '包含人工撰写与AI生成混合内容' },
  plagiarized: { color: '#F53F3F', bg: '#FFECE8', icon: <Copy size={16} />, label: '抄袭内容', desc: '检测到疑似抄袭自其他来源的内容' },
  ai_plus_plagiarism: { color: '#D9363E', bg: '#FFF1F0', icon: <AlertTriangle size={16} />, label: 'AI+抄袭', desc: '同时检测到AI生成和抄袭特征' },
  inconclusive: { color: '#86909C', bg: '#F2F3F5', icon: <Info size={16} />, label: '无法判定', desc: '文本过短或特征不明显，无法可靠判定' },
};

const CONFIDENCE_COLORS: Record<string, string> = {
  very_high: '#00B42A', high: '#165DFF', medium: '#FA8C16', low: '#86909C',
};

const MODEL_BADGE_COLORS: Record<string, string> = {
  'GPT-4': '#10A37F', 'GPT-4o': '#10A37F', 'GPT-4-Turbo': '#10A37F',
  'Claude-3.5': '#D97706', 'Claude-3': '#D97706',
  'Gemini-Pro': '#4285F4', 'Gemini-Ultra': '#4285F4',
  'DeepSeek-V3': '#165DFF', 'DeepSeek-R1': '#165DFF',
  'Llama-3': '#6366F1', 'Unknown-Mixed': '#86909C', 'None': '#00B42A',
};

function InfoIcon({ size = 12 }: { size?: number }) { return <Info size={size} />; }

export default function DualEnginePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [list, setList] = useState<DualEngineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [current, setCurrent] = useState<DualEngineItem | null>(null);
  const [contentText, setContentText] = useState('');
  const [fileName, setFileName] = useState('');
  const [stats, setStats] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<'sentences' | 'sources' | 'indicators'>('sentences');

  useEffect(() => { loadData(); loadStats(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await dualEngineApi.list({ limit: 50 });
      setList(Array.isArray(res.data.results) ? res.data.results : Array.isArray(res.data) ? res.data : []);
    } catch { setList([]); }
    setLoading(false);
  }

  async function loadStats() {
    try { setStats((await dualEngineApi.stats()).data); } catch {}
  }

  async function handleScan() {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!contentText.trim()) { message.warning('请输入需要检测的文案内容'); return; }
    setScanning(true);
    try {
      const res = await dualEngineApi.scan({
        original_text: contentText,
        file_name: fileName || `dual-engine-${Date.now()}.txt`,
        file_size: new Blob([contentText]).size,
      });
      
      message.success('双引擎检测完成！');
      setCurrent(res.data.data); setReportOpen(true);
      setContentText(''); setFileName(''); loadData(); loadStats();
    } catch (e: any) {
      message.error(e.response?.data?.detail || e.response?.data?.message || e.response?.data?.error || '检测失败，请重试');
    }
    setScanning(false);
  }

  function openReport(r: DualEngineItem) { setCurrent(r); setReportOpen(true); }

  const columns: ColumnsType<DualEngineItem> = [
    { title: '时间', dataIndex: 'created_at', width: 160, defaultSortOrder: 'descend',
      render: (t: string) => <span style={{ fontSize: 13 }}>{t ? new Date(t).toLocaleString('zh-CN') : '-'}</span> },
    { title: '判定', width: 110, render: (_, r) => {
      const vc = VERDICT_CONFIG[r.overall_verdict];
      return vc ? <Tag color={vc.color} style={{ borderRadius: 6, fontWeight: 600 }}>{vc.icon} {vc.label}</Tag> : '-';
    }},
    { title: '原创性得分', width: 110, render: (_, r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Progress type="circle" percent={r.originality_score} size={40}
          strokeColor={r.originality_score >= 80 ? '#00B42A' : r.originality_score >= 50 ? '#FA8C16' : '#F53F3F'}
          format={(p) => <span style={{ fontSize: 11, fontWeight: 800 }}>{p}</span>} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: r.originality_score >= 80 ? '#00B42A' : r.originality_score >= 50 ? '#FA8C16' : '#F53F3F' }}>{r.originality_score}%</div>
          <div style={{ fontSize: 11, color: '#86909C' }}>原创性</div>
        </div>
      </div>
    )},
    { title: 'AI/抄袭', width: 120, render: (_, r) => (
      <Space size={2}>
        <Tooltip title="AI生成概率"><Tag color={r.ai_score > 60 ? 'purple' : 'default'} style={{ borderRadius: 4, fontSize: 11 }}>
          AI {r.ai_score.toFixed(0)}%
        </Tag></Tooltip>
        <Tooltip title="抄袭风险"><Tag color={r.plagiarism_score > 30 ? 'red' : 'default'} style={{ borderRadius: 4, fontSize: 11 }}>
          抄袭 {r.plagiarism_score.toFixed(0)}%
        </Tag></Tooltip>
      </Space>
    )},
    { title: 'AI模型', width: 100, render: (_, r) =>
      r.ai_model_detected ? <Tag color={MODEL_BADGE_COLORS[r.ai_model_detected] || '#86909C'} style={{ borderRadius: 4, fontSize: 11 }}>{r.ai_model_detected}</Tag> : '-'
    },
    { title: '置信度', width: 80, render: (_, r) =>
      <Tag color={CONFIDENCE_COLORS[r.confidence_level] || '#86909C'} style={{ borderRadius: 10, fontSize: 11 }}>{r.confidence_display}</Tag>
    },
    { title: '字数/句数', width: 90, render: (_, r) => <span style={{ fontSize: 12, color: '#86909C' }}>{r.word_count}字/{r.sentence_count}句</span> },
    { title: '操作', width: 70, fixed: 'right', render: (_, r) => <Button type="link" icon={<Eye />} onClick={() => openReport(r)}>详情</Button> },
  ];

  return (
    <div style={{ padding: '20px 40px', maxWidth: 1500, margin: '0 auto', background: '#F2F3F5', minHeight: '100vh' }}>
      {/* Hero Banner */}
      <div style={{
        textAlign: 'center', marginBottom: 28, padding: '32px 24px',
        background: 'linear-gradient(135deg, #0D0D1A 0%, #1a0533 20%, #16213e 45%, #0c2340 70%, #1a1a2e 100%)',
        borderRadius: 16, color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -60, left: '5%', width: 400, height: 400, background: 'rgba(114,46,209,0.07)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -80, right: '5%', width: 450, height: 450, background: 'rgba(22,93,255,0.06)', borderRadius: '50%' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Brain size={28} color="#A78BFA" />
            <Copy size={22} color="#F472B6" />
            <Tag color="#A78BFA" style={{ borderRadius: 20, fontWeight: 800, border: 'none', color: '#0D0D1A', fontSize: 13 }}>Dual Engine v2.0</Tag>
          </div>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900, letterSpacing: 0.5 }}>AI 内容 + 抄袭 双引擎检测</h1>
          <p style={{ margin: '10px 0 0', fontSize: 15.5, opacity: 0.92, maxWidth: 820, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.75 }}>
            双引擎并行分析 · 逐句级别精准判定 · AI模型指纹识别 · 抄袭来源追踪<br />
            <span style={{ opacity: 0.78, fontSize: 14 }}>核心公式：Originality = Human% × 1.0 + Mixed% × 0.4 − AI% × 0.8 − Plagiarized% × 1.0</span>
          </p>

          {/* Engine Pills */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 18, flexWrap: 'wrap' }}>
            {[
              ['引擎A: AI检测', <Brain />, '#A78BFA'],
              ['引擎B: 抄袭检测', <Copy />, '#F472B6'],
              ['融合算法', <Zap />, '#34D399'],
              ['逐句高亮', <Target />, '#60A5FA'],
              ['模型识别', <Bot />, '#FBBF24'],
              ['来源匹配', <FileSearch />, '#F87171'],
            ].map(([label, icon, color], i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                background: 'rgba(255,255,255,0.08)', borderRadius: 20, border: `1px solid ${color}30`,
                fontSize: 13, fontWeight: 500,
              }}><span style={{ color }}>{icon}</span><span>{label}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 22 }}>
        {/* Left Panel */}
        <Card
          title={<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 800, color: '#722ED1' }}>
            <PlayCircle size={20} /> 提交文案检测
          </span>}
          style={{ borderRadius: 14 }}
          styles={{ header: { borderBottom: '2px solid rgba(114,46,209,0.2)', borderRadius: '14px 14px 0 0' } }}
        >
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 6 }}>
              待检测文案 * <span style={{ fontWeight: 400, color: '#C9CDD4' }}>(粘贴文章/论文/文案/任意文本)</span>
            </label>
            <TextArea rows={8} placeholder='在此粘贴需要检测的文案内容...&#10;&#10;支持中英文混合 · 建议不少于200字以获得更准确结果&#10;&#10;双引擎将同时运行：&#10;  引擎A → AI内容检测（GPT-4/Claude/Gemini等）&#10;  引擎B → 抄袭相似度检测（来源匹配+改写识别）'
              value={contentText} onChange={(e) => setContentText(e.target.value)}
              style={{ borderRadius: 8, fontSize: 14, lineHeight: 1.8 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: '#C9CDD4' }}>{contentText.length.toLocaleString()} 字符 / ~{Math.ceil(contentText.length / 2)} 字</span>
              {fileName && <span style={{ fontSize: 12, color: '#722ED1' }}>📎 {fileName}</span>}
            </div>
          </div>

          <Upload.Dragger accept=".txt,.json,.md,.py,.js,.ts,.html,.xml,.csv,.log,.doc,.docx,.pdf,.eml,.rtf"
            showUploadList={false}
            beforeUpload={(f) => { setFileName(f.name); const r = new FileReader(); r.onload = (e) => setContentText(e.target?.result as string || ''); r.readAsText(f); return false; }}
            style={{ borderRadius: 10, marginBottom: 16, background: '#FAFBFC', borderColor: '#C9CDD4' }}
          >
            <p className="ant-upload-drag-icon"><UploadIcon size={30} color="#C9CDD4" /></p>
            <p style={{ fontSize: 13, color: '#4E5969' }}>拖拽或点击上传文件</p>
            <p style={{ fontSize: 11.5, color: '#C9CDD4' }}>支持 .txt .md .doc .pdf .docx 等格式</p>
          </Upload.Dragger>

          <Button type="primary" size="large" block loading={scanning} icon={<Sparkles />} onClick={handleScan}
            style={{
              borderRadius: 10, height: 54, fontSize: 17, fontWeight: 900,
              background: 'linear-gradient(135deg, #722ED1 0%, #F472B6 50%, #F53F3F 100%)',
              boxShadow: '0 4px 16px rgba(114,46,209,0.35)',
            }}>
            {scanning ? '⚡ 双引擎正在并行分析...' : '🚀 启动双引擎检测'}
          </Button>

          {/* Quick Stats */}
          {(stats.total_scans > 0) && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #E5E6EB' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4E5969', marginBottom: 10 }}>📊 平台统计</div>
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <div style={{ padding: '8px 10px', background: '#EBF5FF', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#165DFF' }}>{stats.avg_originality_score || '-'}%</div>
                    <div style={{ fontSize: 11, color: '#86909C' }}>平均原创性</div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ padding: '8px 10px', background: '#F9F0FF', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#722ED1' }}>{stats.avg_ai_score || '-'}%</div>
                    <div style={{ fontSize: 11, color: '#86909C' }}>平均AI率</div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ padding: '8px 10px', background: '#FFF0E6', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#FF7D00' }}>{stats.avg_plagiarism_score || '-'}%</div>
                    <div style={{ fontSize: 11, color: '#86909C' }}>平均抄袭率</div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ padding: '8px 10px', background: '#E8FFEA', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#00B42A' }}>{stats.completed || 0}</div>
                    <div style={{ fontSize: 11, color: '#86909C' }}>总检测次数</div>
                  </div>
                </Col>
              </Row>
            </div>
          )}
        </Card>

        {/* Right Panel */}
        <div>
          {/* Verdict Distribution */}
          {stats.by_verdict && Object.keys(stats.by_verdict).length > 0 && (
            <Card size="small" style={{ borderRadius: 10, marginBottom: 18 }} title={<span style={{ fontSize: 14, fontWeight: 600 }}>📈 判定分布</span>}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(stats.by_verdict).map(([verdict, count]: [string, any], i) => {
                  const vc = VERDICT_CONFIG[verdict];
                  return vc ? <Tag key={i} color={vc.color} style={{ borderRadius: 12, padding: '4px 12px', fontSize: 13 }}>
                    {vc.label}: <strong>{count}</strong>
                  </Tag> : null;
                })}
              </div>
            </Card>
          )}

          {/* History Table */}
          <Card title={<span style={{ fontSize: 15, fontWeight: 700 }}>📋 双引擎检测历史</span>} style={{ borderRadius: 14 }}
            extra={<Button size="small" icon={<RefreshCw />} onClick={() => loadData()}>刷新</Button>}>
            {list.length > 0 ? (
              <Table columns={columns} dataSource={list} rowKey="id" size="middle"
                pagination={{ pageSize: 8, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 1000 }} loading={loading} />
            ) : (
              <Empty description={<span style={{ color: '#86909C' }}>暂无检测记录，提交第一份文案开始双引擎检测</span>}
                image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '60px 0' }} />
            )}
          </Card>
        </div>
      </div>

      {/* ===== REPORT MODAL ===== */}
      <Modal
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 900, color: '#722ED1' }}>
            <Brain size={22} /> <Copy size={20} /> 双引擎检测报告 #{current?.id?.slice(-8)}
          </span>
        }
        open={reportOpen} onCancel={() => setReportOpen(false)} destroyOnHidden width={1020}
        footer={[
          <Button key="close" type="primary" onClick={() => setReportOpen(false)} style={{ borderRadius: 7, background: '#722ED1' }}>关闭</Button>,
        ]}
      >
        {current && (() => {
          const vc = VERDICT_CONFIG[current.overall_verdict] || VERDICT_CONFIG.inconclusive;
          const sentences: SentenceAnalysis[] = Array.isArray(current.sentence_analyses) ? current.sentence_analyses : [];
          const sources: SourceMatch[] = Array.isArray(current.source_matches) ? current.source_matches : [];
          const aiInd = typeof current.ai_indicators === 'object' ? current.ai_indicators : {};
          const plagInd = typeof current.plagiarism_indicators === 'object' ? current.plagiarism_indicators : {};

          const SENTENCE_COLOR: Record<string, { bg: string; border: string; text: string; tag: string }> = {
            human_written: { bg: '#E8FFEA', border: '#00B42A', text: '#167D2C', tag: '#00B42A' },
            ai_generated: { bg: '#F9F0FF', border: '#722ED1', text: '#531DAB', tag: '#722ED1' },
            mixed: { bg: '#FFF7E8', border: '#FA8C16', text: '#B57A1C', tag: '#FA8C16' },
            plagiarized: { bg: '#FFF1F0', border: '#F53F3F', text: '#C41D33', tag: '#F53F3F' },
          };

          return (
            <div>
              {/* === TOP SCORE BANNER === */}
              <div style={{
                textAlign: 'center', padding: '28px 24px', background: vc.bg, borderRadius: 16,
                marginBottom: 22, border: `2px solid ${vc.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
                  {vc.icon}
                  <span style={{ fontSize: 22, fontWeight: 900, color: vc.color }}>综合判定：{vc.label}</span>
                  <Tag color={CONFIDENCE_COLORS[current.confidence_level] || '#86909C'} style={{ borderRadius: 12, fontWeight: 600 }}>
                    置信度: {current.confidence_display}
                  </Tag>
                  {current.ai_model_detected && <Tag color={MODEL_BADGE_COLORS[current.ai_model_detected] || '#86909C'} style={{ borderRadius: 12, fontWeight: 600 }}>
                    🤖 {current.ai_model_detected}
                  </Tag>}
                </div>

                {/* Three Core Gauges */}
                <Row gutter={[32, 16]} justify="center">
                  <Col>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Progress type="circle" percent={Math.round(current.originality_score)} size={120}
                        strokeColor={current.originality_score >= 80 ? '#00B42A' : current.originality_score >= 50 ? '#FA8C16' : '#F53F3F'}
                        format={(p) => <span><span style={{ fontSize: 32, fontWeight: 900 }}>{p}</span><span style={{ fontSize: 16 }}>%</span></span>}
                        innerRef={(el) => {}} />
                      <div style={{ marginTop: 8, fontSize: 15, fontWeight: 800, color: '#1D2129' }}>原创性得分</div>
                      <div style={{ fontSize: 12, color: '#86909C' }}>Originality Score (核心指标)</div>
                    </div>
                  </Col>
                  <Col>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Progress type="circle" percent={Math.round(current.ai_score)} size={100}
                        strokeColor="#722ED1"
                        format={(p) => <span><span style={{ fontSize: 26, fontWeight: 900 }}>{p}</span><span style={{ fontSize: 14 }}>%</span></span>} />
                      <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: '#1D2129' }}>AI生成概率</div>
                      <div style={{ fontSize: 11.5, color: '#86909C' }}>引擎A 检测结果</div>
                    </div>
                  </Col>
                  <Col>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Progress type="circle" percent={Math.round(current.plagiarism_score)} size={100}
                        strokeColor="#F472B6"
                        format={(p) => <span><span style={{ fontSize: 26, fontWeight: 900 }}>{p}</span><span style={{ fontSize: 14 }}>%</span></span>} />
                      <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: '#1D2129' }}>抄袭风险</div>
                      <div style={{ fontSize: 11.5, color: '#86909C' }}>引擎B 检测结果</div>
                    </div>
                  </Col>
                </Row>

                {/* Distribution Bars */}
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#4E5969', marginBottom: 10 }}>逐句判定分布</div>
                  <Row gutter={[12, 8]} justify="center">
                    {[
                      { label: '✍️ 人工撰写', pct: current.human_written_percent, color: '#00B42A' },
                      { label: '🤖 AI生成', pct: current.ai_generated_percent, color: '#722ED1' },
                      { label: '🔀 混合内容', pct: current.mixed_content_percent, color: '#FA8C16' },
                      { label: '📋 抄袭内容', pct: current.plagiarized_percent, color: '#F53F3F' },
                    ].map((item, i) => (
                      <Col span={6} key={i}>
                        <div style={{ textAlign: 'center' }}>
                          <Progress percent={item.pct} strokeColor={item.color} trailColor="#E5E6EB"
                            format={() => <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.pct.toFixed(1)}%</span>}
                            size="small" />
                          <div style={{ fontSize: 11.5, color: '#86909C', marginTop: 2 }}>{item.label}</div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 24, fontSize: 12.5, color: '#4E5969' }}>
                  <span>📝 {current.word_count}字 / {current.sentence_count}句</span>
                  <span>⏱️ 耗时 {current.processing_time_ms}ms</span>
                  <span>🧠 AI引擎 {current.ai_engine_time_ms}ms</span>
                  <span>🔍 抄袭引擎 {current.plagiarism_engine_time_ms}ms</span>
                </div>
              </div>

              {/* Tab Navigation */}
              <Segmented
                value={activeTab}
                onChange={(v) => setActiveTab(v as any)}
                block
                size="large"
                style={{ marginBottom: 18, borderRadius: 10, padding: 4 }}
                options={[
                  { label: <span><Target size={14} /> 逐句分析 ({sentences.length})</span>, value: 'sentences' },
                  { label: <span><FileSearch size={14} /> 来源匹配 ({sources.length})</span>, value: 'sources' },
                  { label: <span><BarChart3 size={14} /> 引擎指标</span>, value: 'indicators' },
                ]}
              />

              {/* TAB 1: Sentence Analysis */}
              {activeTab === 'sentences' && (
                <div style={{ maxHeight: 480, overflowY: 'auto', padding: '4px' }}>
                  {sentences.length > 0 ? sentences.map((s, i) => {
                    const sc = SENTENCE_COLOR[s.sentence_verdict] || SENTENCE_COLOR.human_written;
                    const verdictLabels: Record<string, string> = {
                      human_written: '✅ 人工', ai_generated: '🤖 AI', mixed: '🔀 混合', plagiarized: '📋 抄袭',
                    };
                    return (
                      <div key={i} style={{
                        padding: '8px 12px', marginBottom: 6, borderRadius: 8,
                        background: sc.bg, borderLeft: `4px solid ${sc.border}`,
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                      }}>
                        <span style={{
                          minWidth: 26, height: 26, borderRadius: 13,
                          background: sc.border, color: '#fff', fontSize: 11,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700,
                        }}>{s.index + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, color: sc.text, lineHeight: 1.65, wordBreak: 'break-word' }}>{s.text}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            <Tag color={sc.tag} style={{ borderRadius: 4, fontSize: 10, lineHeight: '18px', padding: '0 6px' }}>
                              {verdictLabels[s.sentence_verdict] || s.sentence_verdict}
                            </Tag>
                            <span style={{ fontSize: 11, color: '#86909C' }}>AI: {(s.ai_probability * 100).toFixed(0)}% | 抄袭: {(s.plagiarism_similarity * 100).toFixed(0)}%</span>
                            {s.key_reason && <Tooltip title={s.key_reason}><span style={{ fontSize: 11, color: '#86909C', cursor: 'help' }}>💡 原因</span></Tooltip>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0, alignItems: 'flex-end' }}>
                          <Progress type="circle" percent={Math.round(s.ai_probability * 100)} size={36}
                            strokeColor={s.ai_probability > 0.6 ? '#722ED1' : '#00B42A'}
                            format={() => ''} />
                          <span style={{ fontSize: 9, color: '#86909C' }}>AI%</span>
                        </div>
                      </div>
                    );
                  }) : (
                    <Empty description="暂无逐句分析数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
                  )}
                </div>
              )}

              {/* TAB 2: Source Matches */}
              {activeTab === 'sources' && (
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                  {sources.length > 0 ? sources.map((src, i) => {
                    const typeColors: Record<string, string> = {
                      direct_copy: '#F53F3F', paraphrase: '#FF7D00', structural: '#FA8C16',
                      self_plagiarism: '#86909C', translation: '#165DFF', mosaic: '#722ED1',
                    };
                    const sourceTypeColors: Record<string, string> = {
                      academic_paper: '#722ED1', news_article: '#165DFF', web_page: '#00B42A',
                      book: '#FA8C16', social_media: '#F472B6', unknown: '#86909C',
                    };
                    return (
                      <div key={i} style={{
                        padding: '12px 16px', marginBottom: 8, borderRadius: 10,
                        background: i % 2 === 0 ? '#FAFBFC' : '#FFF', border: `1px solid ${(typeColors[src.plagiarism_type] || '#E5E6EB')}40`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <Badge count={i + 1} style={{ backgroundColor: typeColors[src.plagiarism_type] || '#86909C', boxShadow: 'none' }} />
                          <Tag color={typeColors[src.plagiarism_type] || '#86909C'} style={{ borderRadius: 4, fontSize: 11 }}>
                            {src.plagiarism_type.replace('_', ' ')}
                          </Tag>
                          <Tag color={sourceTypeColors[src.source_type] || '#86909C'} style={{ borderRadius: 4, fontSize: 11 }}>
                            {src.source_type.replace('_', '/')}
                          </Tag>
                          <Tag color="red" style={{ borderRadius: 10, fontWeight: 700, marginLeft: 'auto' }}>
                            相似度 {src.similarity_percent.toFixed(0)}%
                          </Tag>
                        </div>
                        <div style={{ fontSize: 13, color: '#4E5969', lineHeight: 1.6, marginBottom: 4, padding: '6px 10px', background: '#FFF1F0', borderRadius: 6, borderLeft: '3px solid #F53F3F' }}>
                          "{src.matched_text_segment}"
                        </div>
                        <div style={{ fontSize: 12, color: '#86909C' }}>
                          📍 {src.location_in_text} &nbsp;|&nbsp; 🔗 {src.source_description} &nbsp;|&nbsp; 置信度: {(src.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    );
                  }) : (
                    <Empty description="未发现疑似抄袭来源 ✅" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '60px 0' }} />
                  )}
                </div>
              )}

              {/* TAB 3: Engine Indicators */}
              {activeTab === 'indicators' && (
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                  <Row gutter={[16, 16]}>
                    {/* Engine A Indicators */}
                    <Col xs={24} md={12}>
                      <Card size="small" title={<span style={{ color: '#722ED1', fontWeight: 800 }}>🧠 引擎A: AI检测结果</span>} style={{ borderRadius: 10 }}>
                        {Object.entries(aiInd).length > 0 ? Object.entries(aiInd).map(([key, val]: [string, any], i) => {
                          if (typeof val !== 'object' || val === null) return null;
                          const score = val.score ?? 50;
                          const verdict = val.verdict || '-';
                          const isAILike = String(verdict).includes('AI-like') || String(verdict).includes('uniform') || String(verdict).includes('overly') || String(verdict).includes('flat') || String(verdict).includes('generic');
                          const labels: Record<string, string> = {
                            perplexity: '困惑度', burstiness: '突发性', semantic_coherence: '语义一致性',
                            vocabulary_distribution: '词汇分布', style_markers: '风格标记', emotional_flatness: '情感平坦度',
                          };
                          return (
                            <div key={i} style={{ marginBottom: 12, padding: '10px', background: isAILike ? '#F9F0FF' : '#F6FFED', borderRadius: 8, borderLeft: `3px solid ${isAILike ? '#722ED1' : '#00B42A'}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <strong style={{ fontSize: 13 }}>{labels[key] || key}</strong>
                                <Tag color={isAILike ? 'purple' : 'green'} style={{ borderRadius: 4, fontSize: 10 }}>{verdict}</Tag>
                              </div>
                              <Progress percent={score} size="small"
                                strokeColor={isAILike ? '#722ED1' : '#00B42A'} trailColor="#E5E6EB"
                                format={() => <span style={{ fontSize: 11, fontWeight: 700 }}>{score}</span>} />
                              {val.detail && <div style={{ fontSize: 11.5, color: '#86909C', marginTop: 3 }}>{val.detail}</div>}
                            </div>
                          );
                        }) : <Empty description="暂无AI指标" style={{ padding: '20px 0' }} image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                      </Card>
                    </Col>
                    {/* Engine B Indicators */}
                    <Col xs={24} md={12}>
                      <Card size="small" title={<span style={{ color: '#F472B6', fontWeight: 800 }}>📋 引擎B: 抄袭检测结果</span>} style={{ borderRadius: 10 }}>
                        {Object.entries(plagInd).length > 0 ? <>
                          <div style={{ marginBottom: 10, padding: '10px', background: '#FFF0F6', borderRadius: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>直接复制片段</span>
                              <strong style={{ color: '#F53F3F', fontSize: 15 }}>{plagInd.direct_copy_segments ?? 0}</strong>
                            </div>
                          </div>
                          <div style={{ marginBottom: 10, padding: '10px', background: '#FFF7E8', borderRadius: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>疑似改写</span>
                              <strong style={{ color: '#FF7D00', fontSize: 15 }}>{plagInd.paraphrase_suspects ?? 0}</strong>
                            </div>
                          </div>
                          <div style={{ marginBottom: 10, padding: '10px', background: '#EBF5FF', borderRadius: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>结构相似度</span>
                              <strong style={{ color: '#165DFF', fontSize: 15 }}>{typeof plagInd.structural_similarity === 'number' ? (plagInd.structural_similarity * 100).toFixed(0) + '%' : '-'}</strong>
                            </div>
                          </div>
                          {Array.isArray(plagInd.common_template_phrases) && plagInd.common_template_phrases.length > 0 && (
                            <div style={{ padding: '10px', background: '#F2F3F5', borderRadius: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>常见模板短语:</div>
                              {plagInd.common_template_phrases.map((phrase: string, pi: number) => (
                                <Tag key={pi} color="orange" style={{ borderRadius: 4, fontSize: 11, marginBottom: 3 }}>{phrase}</Tag>
                              ))}
                            </div>
                          )}
                          {Array.isArray(plagInd.citation_anomalies) && plagInd.citation_anomalies.length > 0 && (
                            <div style={{ padding: '10px', background: '#FFF1F0', borderRadius: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>引用异常:</div>
                              {plagInd.citation_anomalies.map((anomaly: string, ai: number) => (
                                <Tag key={ai} color="red" style={{ borderRadius: 4, fontSize: 11, marginBottom: 3 }}>{anomaly}</Tag>
                              ))}
                            </div>
                          )}
                        </> : <Empty description="暂无抄袭指标" style={{ padding: '20px 0' }} image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                      </Card>
                    </Col>
                  </Row>
                </div>
              )}

              {/* Executive Summary */}
              {current.executive_summary && (
                <>
                  <Divider orientation="left"><span style={{ fontSize: 15, fontWeight: 800 }}>📄 执行摘要</span></Divider>
                  <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #F9F0FF, #FFF0F6)', borderRadius: 10, fontSize: 13.5, color: '#1D2129', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
                    {current.executive_summary}
                  </div>
                </>
              )}

              {/* Full Report */}
              {current.detailed_report && (
                <div>
                  <Divider orientation="left"><span style={{ fontSize: 15, fontWeight: 800 }}>📑 完整检测报告</span></Divider>
                  <div style={{ padding: '14px 18px', background: '#F7F8FA', borderRadius: 8, fontSize: 13, color: '#4E5969', lineHeight: 1.85, whiteSpace: 'pre-wrap', maxHeight: 350, overflowY: 'auto' }}>
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

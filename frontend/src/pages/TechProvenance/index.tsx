import { useState, useEffect } from 'react';
import { Card, Button, Tag, Modal, Select, Input, Upload, message, Table, Progress, Row, Col, Alert, Empty, Badge, Steps, Timeline, Statistic, Tooltip, Descriptions } from 'antd';
import {
  Fingerprint, Search, ShieldCheck, AlertTriangle, CheckCircle2,
  Upload as UploadIcon, Link2, History, Zap, Eye, FileText,
  Sparkles, Lock, Globe, Cpu, ChevronRight, Target, Bug,
  GitBranch, Waves, Key, ScanLine, Database, Network,
} from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import { techApi, type ProvenanceItem } from '@/api/techApi';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const { TextArea } = Input;

const SOURCE_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  human_confirmed: { color: '#00B42A', bg: '#E8FFEA', icon: <CheckCircle2 size={14} />, label: '确认为人工' },
  ai_generated: { color: '#F53F3F', bg: '#FFECE8', icon: <Cpu size={14} />, label: '确认为AI生成' },
  ai_assisted: { color: '#FA8C16', bg: '#FFF7E8', icon: <Zap size={14} />, label: 'AI辅助创作' },
  mixed_source: { color: '#722ED1', bg: '#F9F0FF', icon: <GitBranch size={14} />, label: '混合来源' },
  unknown: { color: '#86909C', bg: '#F2F3F5', icon: <Search size={14} />, label: '无法确定' },
  manipulated: { color: '#F53F3F', bg: '#FFECE8', icon: <Bug size={14} />, label: '已被篡改' },
};

const CONTENT_TYPES = [
  { value: 'text', label: '文本内容' }, { value: 'image', label: '图片内容' },
  { value: 'audio', label: '音频内容' }, { value: 'video', label: '视频内容' },
  { value: 'document', label: '文档内容' }, { value: 'code', label: '代码内容' },
];

export default function ProvenancePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [list, setList] = useState<ProvenanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [current, setCurrent] = useState<ProvenanceItem | null>(null);
  const [inputText, setInputText] = useState('');
  const [contentType, setContentType] = useState('');
  const [fileName, setFileName] = useState('');
  const [stats, setStats] = useState<Record<string, any>>({});

  useEffect(() => { loadData(); loadStats(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await techApi.provenance.list({ limit: 50 });
      setList(Array.isArray(res.data.results) ? res.data.results : Array.isArray(res.data) ? res.data : []);
    } catch { setList([]); }
    setLoading(false);
  }

  async function loadStats() {
    try { setStats((await techApi.provenance.stats()).data); } catch {}
  }

  async function handleAnalyze() {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!inputText.trim()) { message.warning('请输入需要溯源的内容'); return; }
    if (!contentType) { message.warning('请选择内容类型'); return; }
    setAnalyzing(true);
    try {
      const res = await techApi.provenance.analyze({
        content_type: contentType, original_text: inputText,
        file_name: fileName || `${contentType}_provenance.txt`,
        file_size: new Blob([inputText]).size,
      });
      message.success('内容溯源分析完成！');
      setCurrent(res.data.data); setReportOpen(true);
      setInputText(''); setFileName(''); loadData(); loadStats();
    } catch (e: any) { message.error(e.response?.data?.detail || '分析失败'); }
    setAnalyzing(false);
  }

  function openReport(r: ProvenanceItem) { setCurrent(r); setReportOpen(true); }

  const columns: ColumnsType<ProvenanceItem> = [
    { title: '时间', dataIndex: 'created_at', width: 170, defaultSortOrder: 'descend',
      render: (t: string) => <span style={{ fontSize: 13 }}>{t ? new Date(t).toLocaleString('zh-CN') : '-'}</span> },
    { title: '类型', width: 100, render: (_, r) => <Tag color="#165DFF">{r.content_type_display}</Tag> },
    { title: '来源判定', width: 130, render: (_, r) => {
      const c = SOURCE_CONFIG[r.source_confidence];
      return c ? <Tag color={c.color} style={{ borderRadius: 6, fontWeight: 600 }}>{c.icon} {c.label}</Tag> : '-';
    }},
    { title: '置信度', width: 90, render: (_, r) => <span style={{ fontWeight: 600 }}>{(r.confidence_score * 100).toFixed(1)}%</span> },
    { title: '生成工具', width: 130, ellipsis: true, render: (_, r) => r.generation_tool_detected || '-' },
    { title: '水印', width: 70, render: (_, r) => r.watermark_detected ? <Tag color="purple" style={{ borderRadius: 4 }}>有</Tag> : <span>-</span> },
    { title: '操作', width: 70, fixed: 'right', render: (_, r) => <Button type="link" icon={<Eye />} onClick={() => openReport(r)}>详情</Button> },
  ];

  return (
    <div style={{ padding: '24px 48px', maxWidth: 1400, margin: '0 auto', background: '#F2F3F5', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{
        textAlign: 'center', marginBottom: 32, padding: '36px 28px',
        background: 'linear-gradient(135deg, #0c0c1d 0%, #1a1a3e 40%, #2d1b69 100%)',
        borderRadius: 16, color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 250, height: 250, background: 'rgba(114,46,209,0.12)', borderRadius: '50%' }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Fingerprint size={26} color="#B37FEB" />
            <Tag color="#B37FEB" style={{ borderRadius: 20, fontWeight: 700, border: 'none', color: '#0c0c1d' }}>独家专利技术</Tag>
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: 0.5 }}>AI 内容溯源技术</h1>
          <p style={{ margin: '10px 0 0', fontSize: 15, opacity: 0.88, maxWidth: 680, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 }}>
            数字指纹提取 · 隐写水印检测 · 来源归因链重建 · 跨平台内容匹配 · C2PA标准兼容 · 篡改精确定位
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: 20 }}>
            {[{ label: 'CFA v2.0指纹算法', icon: <ScanLine /> }, { label: '多通道水印嗅探', icon: <Waves /> },
              { label: '来源归因链', icon: <GitBranch /> }, { label: 'C2PA兼容', icon: <Lock /> }].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: 0.9 }}>{item.icon}<span>{item.label}</span></div>
            ))}
        </div>
      </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24 }}>
        {/* Left Panel */}
        <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#722ED1' }}><Fingerprint size={20} /> 内容溯源分析</span>}
          style={{ borderRadius: 14 }} styles={{ header: { borderBottom: '2px solid rgba(114,46,209,0.2)', borderRadius: '14px 14px 0 0' } }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 6 }}>内容类型 *</label>
            <Select placeholder="选择内容类型" options={CONTENT_TYPES} value={contentType || undefined}
              onChange={setContentType} style={{ width: '100%', borderRadius: 8 }} size="large" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 6 }}>待分析内容 *</label>
            <TextArea rows={8} placeholder="粘贴文本、代码、描述或元数据..." value={inputText} onChange={(e) => setInputText(e.target.value)}
              style={{ borderRadius: 8, fontSize: 14 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: '#C9CDD4' }}>{inputText.length} 字符</span>
              {fileName && <span style={{ fontSize: 12, color: '#722ED1' }}>📎 {fileName}</span>}
            </div>
          </div>
          <Upload.Dragger accept=".txt,.json,.md,.py,.js,.csv,.xml,.html,.log"
            showUploadList={false} beforeUpload={(f) => { setFileName(f.name); const r = new FileReader(); r.onload = (e) => setInputText(e.target?.result as string || ''); r.readAsText(f); return false; }}
            style={{ borderRadius: 10, marginBottom: 16, background: '#FAFBFC', borderColor: '#C9CDD4' }}
          >
            <p className="ant-upload-drag-icon"><UploadIcon size={30} color="#C9CDD4" /></p>
            <p style={{ fontSize: 13, color: '#4E5969' }}>点击或拖拽文件上传</p>
          </Upload.Dragger>
          <Button type="primary" size="large" block loading={analyzing} icon={<Sparkles />} onClick={handleAnalyze}
            style={{ borderRadius: 10, height: 46, fontSize: 15, fontWeight: 700, background: 'linear-gradient(135deg, #722ED1, #9254DE)' }}>
            {analyzing ? '正在执行深度溯源...' : '开始内容溯源分析'}
          </Button>

          {/* Tech Features */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #E5E6EB' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 10 }}>技术能力矩阵</div>
            {[
              ['数字指纹(CFA v2.0)', '语义哈希+统计特征多维指纹'], ['隐写水印检测', 'DCT/DWT/LSB多通道嗅探'],
              ['来源归因链', '反推生成工具+模型版本+参数'], ['跨平台匹配', '感知哈希全网相似检索'],
              ['篡改定位', '精确到段落/区域的修改检测'], ['C2PA标准', '元数据完整性验证'],
            ].map(([title, desc], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12.5, color: '#4E5969' }}>
                <Key size={13} color="#722ED1" /><strong>{title}</strong><span style={{ color: '#86909C' }}>— {desc}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Right Panel */}
        <div>
          <Row gutter={[14, 14]} style={{ marginBottom: 18 }}>
            {[
              { label: '总分析数', value: stats.total || 0, icon: Database, color: '#722ED1', bg: '#F9F0FF' },
              { label: 'AI生成确认', value: stats.ai_generated || 0, icon: Cpu, color: '#F53F3F', bg: '#FFECE8' },
              { label: '篡改检测', value: stats.manipulated || 0, icon: Bug, color: '#FA8C16', bg: '#FFF7E8' },
              { label: '已完成', value: stats.completed || 0, icon: CheckCircle2, color: '#00B42A', bg: '#E8FFEA' },
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

          <Card title={<span style={{ fontSize: 15, fontWeight: 700 }}>溯源历史记录</span>} style={{ borderRadius: 14 }}
            extra={<Button size="small" icon={<Database />} onClick={() => loadData()}>刷新</Button>}>
            {list.length > 0 ? (
              <Table columns={columns} dataSource={list} rowKey="id" size="middle"
                pagination={{ pageSize: 8, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 750 }} />
            ) : (
              <Empty description={<span style={{ color: '#86909C' }}>暂无溯源记录</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '60px 0' }} />
            )}
          </Card>
        </div>
      </div>

      {/* Report Modal */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700, color: '#722ED1' }}>
          <Fingerprint /> 内容溯源报告 #{current?.id?.slice(-8)}
        </span>}
        open={reportOpen} onCancel={() => setReportOpen(false)} destroyOnHidden width={860}
        footer={[<Button key="close" type="primary" onClick={() => setReportOpen(false)} style={{ borderRadius: 7 }}>关闭</Button>]}>
        {current && (() => {
          const sc = SOURCE_CONFIG[current.source_confidence] || SOURCE_CONFIG.unknown;
          const chain = Array.isArray(current.provenance_chain) ? current.provenance_chain : [];
          const mods = Array.isArray(current.modification_history) ? current.modification_history : [];
          const matches = Array.isArray(current.cross_platform_matches) ? current.cross_platform_matches : [];
          const fp = typeof current.digital_fingerprint === 'object' ? current.digital_fingerprint : {};
          const risk = typeof current.risk_assessment === 'object' ? current.risk_assessment : {};

          return (
            <div>
              {/* Top Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20, padding: 16, background: '#F7F8FA', borderRadius: 10 }}>
                {[
                  ['内容类型', current.content_type_display],
                  ['来源判定', 'TAG'],
                  ['置信度', `${(current.confidence_score * 100).toFixed(1)}%`],
                  ['指纹版本', current.fingerprint_version],
                  ['生成工具', current.generation_tool_detected || '未检测到'],
                  ['水印状态', current.watermark_detected ? '✅ 检测到水印' : '❌ 未检测到'],
                ].map(([label, val], idx) => (
                  <div key={idx}><span style={{ fontSize: 11, color: '#86909C', textTransform: 'uppercase' }}>{label}</span>
                    <div style={{ marginTop: 4 }}>
                      {val === 'TAG' ? <Tag color={sc.color} style={{ borderRadius: 6, fontWeight: 700 }}>{sc.icon} {sc.label}</Tag>
                        : <span style={{ fontSize: 15, fontWeight: 600, color: '#1D2129' }}>{String(val)}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Risk Assessment */}
              {(risk.overall_risk || risk.integrity_score !== undefined) && (
                <Alert type={risk.overall_risk === 'critical' || risk.overall_risk === 'high' ? 'error' : risk.overall_risk === 'medium' ? 'warning' : 'info'}
                  message={`风险评估: ${risk.overall_risk || '安全'}`}
                  description={`完整性评分: ${risk.integrity_score ?? '-'} / 认证性评分: ${risk.authenticity_score ?? '-'}`}
                  showIcon style={{ marginBottom: 18 }} />
              )}

              {/* Provenance Chain */}
              {chain.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>🔗 来源归因链 ({chain.length}个节点)</h4>
                  <Timeline mode="left" items={chain.map((node: any, i: number) => ({
                    color: i === chain.length - 1 ? '#722ED1' : '#165DFF',
                    children: (<div key={i}>
                      <strong>{node.type}</strong>: {node.description}
                      {node.tool_used && <Tag color="blue" style={{ marginLeft: 6, borderRadius: 4, fontSize: 11 }}>{node.tool_used}</Tag>}
                      <div style={{ fontSize: 12, color: '#86909C', marginTop: 2 }}>置信度: {((node.confidence || 0) * 100).toFixed(0)}%</div>
                    </div>),
                  }))} />
                </div>
              )}

              {/* Digital Fingerprint */}
              {Object.keys(fp).length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>🔐 数字指纹 (CFA v{current.fingerprint_version})</h4>
                  <Descriptions bordered size="small" column={2}>
                    {fp.semantic_hash && <Descriptions.Item label="语义哈希"><code style={{ fontSize: 11 }}>{String(fp.semantic_hash).slice(0, 32)}...</code></Descriptions.Item>}
                    {typeof fp.statistical_features === 'object' && Object.entries(fp.statistical_features).map(([k, v]: [string, any]) =>
                      <Descriptions.Item key={k} label={k}>{typeof v === 'number' ? v.toFixed(4) : String(v)}</Descriptions.Item>)}
                  </Descriptions>
                  {Array.isArray(fp.stylistic_markers) && fp.stylistic_markers.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#4E5969' }}>风格特征: </span>
                      {fp.stylistic_markers.map((m: string, i: number) => <Tag key={i} color="purple" style={{ borderRadius: 4, fontSize: 11 }}>{m}</Tag>)}
                    </div>
                  )}
                </div>
              )}

              {/* Generation Params */}
              {Object.keys(current.generation_params || {}).length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>⚙️ 推测的生成参数</h4>
                  <Descriptions bordered size="small" column={2}>
                    {Object.entries(current.generation_params).map(([k, v]: [string, any]) =>
                      <Descriptions.Item key={k} label={k}>{Array.isArray(v) ? v.join(', ') : String(v)}</Descriptions.Item>)}
                  </Descriptions>
                </div>
              )}

              {/* Modification History */}
              {mods.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#FA8C16' }}>⚠️ 检测到的修改 ({mods.length}处)</h4>
                  {mods.map((mod: any, i: number) => (
                    <div key={i} style={{ padding: '10px 14px', background: '#FFF7E8', borderRadius: 6, marginBottom: 6, borderLeft: '3px solid #FA8C16' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Tag color="orange" style={{ borderRadius: 4 }}>{mod.type}</Tag>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{mod.region || `修改点#${i + 1}`}</span>
                        <span style={{ fontSize: 12, color: '#86909C' }}>置信度 {(mod.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#4E5969' }}>{mod.evidence || ''}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Cross Platform Matches */}
              {matches.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>🌐 跨平台匹配 ({matches.length}条)</h4>
                  {matches.map((m: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #F2F3F5' }}>
                      <span><Globe size={12} /> <strong>{m.platform}</strong> — 相似度 <Tag color="blue">{m.similarity}%</Tag></span>
                      <span style={{ fontSize: 12, color: '#86909C' }}>{m.match_date || ''}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Technical Report */}
              {current.technical_report && (
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>📋 完整技术报告</h4>
                  <div style={{ padding: '14px 18px', background: '#F7F8FA', borderRadius: 8, fontSize: 13.5, color: '#4E5969', lineHeight: 1.85, whiteSpace: 'pre-wrap', maxHeight: 350, overflowY: 'auto' }}>
                    {current.technical_report}
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

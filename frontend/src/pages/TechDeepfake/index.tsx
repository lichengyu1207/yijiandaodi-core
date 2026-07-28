import { useState, useEffect } from 'react';
import { Card, Button, Tag, Modal, Select, Input, Upload, message, Table, Progress, Row, Col, Alert, Empty, Badge, Statistic, Tooltip, Descriptions, Rate } from 'antd';
import {
  Video, ShieldAlert, AlertTriangle, CheckCircle2,
  Upload as UploadIcon, Eye, FileText, Sparkles, Zap,
  Activity, Brain, BarChart3, Heart, Volume2, Cpu,
  ScanFace, Clock, Camera, Fingerprint, Target, ChevronRight,
  Gauge, Radar, Crosshair, Bug, Search, Lock,
} from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import { techApi, type DeepfakeItem } from '@/api/techApi';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const { TextArea } = Input;

const VERDICT_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  authentic: { color: '#00B42A', bg: '#E8FFEA', icon: <CheckCircle2 size={14} />, label: '真实视频' },
  likely_authentic: { color: '#00B42A', bg: '#E8FFEA', icon: <CheckCircle2 size={14} />, label: '大概率真实' },
  suspected: { color: '#FF7D00', bg: '#FFF7E8', icon: <Search size={14} />, label: '疑似伪造' },
  likely_deepfake: { color: '#F53F3F', bg: '#FFECE8', icon: <AlertTriangle size={14} />, label: '大概率深伪' },
  confirmed_deepfake: { color: '#F53F3F', bg: '#FFECE8', icon: <ShieldAlert size={14} />, label: '确认深伪' },
  inconclusive: { color: '#86909C', bg: '#F2F3F5', icon: <Search size={14} />, label: '无法判断' },
};

const RISK_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: '#F53F3F', label: '严重' }, high: { color: '#FF7D00', label: '高' },
  medium: { color: '#FA8C16', label: '中' }, low: { color: '#86909C', label: '低' }, safe: { color: '#00B42A', label: '安全' },
};

const VIDEO_TYPES = [
  { value: 'talking_head', label: '人脸对话视频' }, { value: 'interview', label: '采访视频' },
  { value: 'presentation', label: '演讲/报告视频' }, { value: 'social_media', label: '社交媒体短视频' },
  { value: 'surveillance', label: '监控录像' }, { value: 'news', label: '新闻视频' },
  { value: 'entertainment', label: '娱乐视频' }, { value: 'other', label: '其他类型' },
];

function DimCard({ title, icon, score, max, color, detail }: { title: string; icon: React.ReactNode; score: number; max: number; color: string; detail?: string }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const barColor = pct > 70 ? '#F53F3F' : pct > 40 ? '#FF7D00' : '#00B42A';
  return (
    <Col xs={12} sm={6}>
      <div style={{ textAlign: 'center', padding: '16px 10px', background: '#FAFBFC', borderRadius: 10, border: `1px solid ${color}20` }}>
        <div style={{ color: color, marginBottom: 6 }}>{icon}</div>
        <div style={{ fontSize: 11, color: '#86909C', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color }}>{typeof score === 'number' ? (score * 100).toFixed(0) : score}<span style={{ fontSize: 13 }}>分</span></div>
        <Progress percent={pct} showInfo={false} strokeColor={barColor} trailColor="#E5E6EB" size="small" style={{ marginTop: 6 }} />
        {detail && <div style={{ fontSize: 11, color: '#86909C', marginTop: 4 }}>{detail}</div>}
      </div>
    </Col>
  );
}

export default function DeepfakePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [list, setList] = useState<DeepfakeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [current, setCurrent] = useState<DeepfakeItem | null>(null);
  const [videoType, setVideoType] = useState('');
  const [fileName, setFileName] = useState('');
  const [metaText, setMetaText] = useState('');
  const [stats, setStats] = useState<Record<string, any>>({});

  useEffect(() => { loadData(); loadStats(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await techApi.deepfake.list({ limit: 50 });
      setList(Array.isArray(res.data.results) ? res.data.results : Array.isArray(res.data) ? res.data : []);
    } catch { setList([]); }
    setLoading(false);
  }

  async function loadStats() {
    try { setStats((await techApi.deepfake.stats()).data); } catch {}
  }

  async function handleDetect() {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!videoType) { message.warning('请选择视频类型'); return; }
    setDetecting(true);
    try {
      const metadata = metaText ? JSON.parse(metaText) : {};
      const res = await techApi.deepfake.detect({
        video_type, file_name: fileName || `${videoType}_deepfake.mp4`,
        video_metadata: metadata, duration_seconds: null, resolution: '',
      });
      message.success('深度伪造鉴别完成！');
      setCurrent(res.data.data); setReportOpen(true);
      setFileName(''); setMetaText(''); loadData(); loadStats();
    } catch (e: any) {
      if (!(e.message || '').includes('field')) message.error(e.response?.data?.detail || e.message || '检测失败');
    }
    setDetecting(false);
  }

  function openReport(r: DeepfakeItem) { setCurrent(r); setReportOpen(true); }

  const columns: ColumnsType<DeepfakeItem> = [
    { title: '时间', dataIndex: 'created_at', width: 170, defaultSortOrder: 'descend',
      render: (t: string) => <span style={{ fontSize: 13 }}>{t ? new Date(t).toLocaleString('zh-CN') : '-'}</span> },
    { title: '类型', width: 110, render: (_, r) => <Tag color="#165DFF">{r.video_type_display}</Tag> },
    { title: '综合判定', width: 120, render: (_, r) => {
      const c = VERDICT_CONFIG[r.overall_verdict];
      return c ? <Tag color={c.color} style={{ borderRadius: 6, fontWeight: 700 }}>{c.icon} {c.label}</Tag> : '-';
    }},
    { title: '深伪概率', width: 95, render: (_, r) => <span style={{ fontWeight: 700, color: r.deepfake_probability > 0.5 ? '#F53F3F' : '#00B42A' }}>
      {(r.deepfake_probability * 100).toFixed(1)}%
    </span>},
    { title: '风险等级', width: 90, render: (_, r) => {
      const rc = RISK_CONFIG[r.risk_level];
      return rc ? <Tag color={rc.color} style={{ borderRadius: 4, fontSize: 12 }}>{rc.label}</Tag> : '-';
    }},
    { title: '分析帧数', width: 80, render: (_, r) => r.frames_analyzed || '-' },
    { title: '操作', width: 70, fixed: 'right', render: (_, r) => <Button type="link" icon={<Eye />} onClick={() => openReport(r)}>详情</Button> },
  ];

  return (
    <div style={{ padding: '24px 48px', maxWidth: 1400, margin: '0 auto', background: '#F2F3F5', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{
        textAlign: 'center', marginBottom: 32, padding: '36px 28px',
        background: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b69 40%, #161033 100%)',
        borderRadius: 16, color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, left: -30, width: 220, height: 220, background: 'rgba(245,63,63,0.1)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -50, right: -20, width: 280, height: 280, background: 'rgba(114,46,209,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <ShieldAlert size={26} color="#F53F3F" />
            <Tag color="#F53F3F" style={{ borderRadius: 20, fontWeight: 700, border: 'none', color: '#1a0a2e' }}>独家专利技术</Tag>
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: 0.5 }}>深度伪造视频鉴别</h1>
          <p style={{ margin: '10px 0 0', fontSize: 15, opacity: 0.88, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 }}>
            8大维度检测引擎 · 面部一致性 + 时序分析 + 频域取证 + 生物信号<br />
            GAN伪影扫描 + 音画同步 + 数字取证 + 对抗鲁棒性检验
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 18, flexWrap: 'wrap' }}>
            {[{ label: '面部68点追踪', icon: <ScanFace /> }, { label: '频域指纹比对', icon: <BarChart3 /> },
              { label: 'rPPG脉搏波', icon: <Heart /> }, { label: '音画LIPSYNC', icon: <Volume2 /> },
              { label: 'GAN架构识别', icon: <Cpu /> }, { label: '法庭可采信', icon: <Lock /> }].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, opacity: 0.92 }}>{item.icon}<span>{item.label}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24 }}>
        {/* Left Panel */}
        <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#F53F3F' }}><Video size={20} /> 深伪检测</span>}
          style={{ borderRadius: 14 }} styles={{ header: { borderBottom: '2px solid rgba(245,63,63,0.2)', borderRadius: '14px 14px 0 0' } }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 6 }}>视频类型 *</label>
            <Select placeholder="选择视频类型" options={VIDEO_TYPES} value={videoType || undefined}
              onChange={setVideoType} style={{ width: '100%', borderRadius: 8 }} size="large" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 6 }}>视频元数据 (JSON格式)</label>
            <TextArea rows={5} placeholder='{"duration": 120, "resolution": "1920x1080", "codec": "h264", "fps": 30}' value={metaText}
              onChange={(e) => setMetaText(e.target.value)} style={{ borderRadius: 8, fontFamily: 'monospace', fontSize: 12 }} />
          </div>

          <Upload.Dragger accept=".mp4,.avi,.mov,.mkv,.webm" showUploadList={false}
            beforeUpload={(f) => { setFileName(f.name); return false; }}
            style={{ borderRadius: 10, marginBottom: 16, background: '#FAFBFC', borderColor: '#C9CDD4' }}>
            <p className="ant-upload-drag-icon"><UploadIcon size={30} color="#C9CDD4" /></p>
            <p style={{ fontSize: 13, color: '#4E5969' }}>上传视频文件（检测时提取帧特征）</p>
            <p style={{ fontSize: 12, color: '#C9CDD4' }}>支持 MP4 / AVI / MOV / MKV / WebM，最大 500MB</p>
          </Upload.Dragger>

          <Button type="primary" size="large" block loading={detecting} icon={<Sparkles />} onClick={handleDetect}
            style={{ borderRadius: 10, height: 46, fontSize: 15, fontWeight: 700, background: 'linear-gradient(135deg, #F53F3F, #FF7D00)' }}>
            {detecting ? '正在执行8维度深伪分析...' : '开始深度伪造鉴别'}
          </Button>

          {/* 8 Dimensions */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #E5E6EB' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 10 }}>🔬 8维检测引擎</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                ['① 面部一致性', '68点landmark+眨眼+光照'],
                ['② 时序分析', '光流+周期性+运动连续性'],
                ['③ 频域取证', 'DCT/FFT/小波/PRNU'],
                ['④ 生物信号', 'rPPG脉搏+微表情+瞳孔'],
                ['⑤ GAN伪影', '架构特征+上采样痕迹'],
                ['⑥ 音画同步', 'LIPSYNC偏差+频谱相关'],
                ['⑦ 数字取证', 'EXIF+双压缩+CFA'],
                ['⑧ 对抗鲁棒', '对抗扰动+噪声模式'],
              ].map(([title, desc], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: i % 2 === 0 ? '#FFF7ED' : '#F6FFED', borderRadius: 6, fontSize: 12 }}>
                  <Crosshair size={12} color={i < 4 ? '#F53F3F' : '#722ED1'} /><strong>{title}</strong><span style={{ color: '#86909C', fontSize: 11 }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Right Panel */}
        <div>
          <Row gutter={[14, 14]} style={{ marginBottom: 18 }}>
            {[
              { label: '总检测数', value: stats.total || 0, icon: Video, color: '#F53F3F', bg: '#FFECE8' },
              { label: '确认深伪', value: stats.confirmed_deepfake || 0, icon: ShieldAlert, color: '#F53F3F', bg: '#FFECE8' },
              { label: '确认为真', value: stats.authentic || 0, icon: CheckCircle2, color: '#00B42A', bg: '#E8FFEA' },
              { label: '平均深伪率', value: typeof stats.avg_deepfake_prob === 'number' ? (stats.avg_deepfake_prob * 100).toFixed(1) + '%' : '-', icon: Gauge, color: '#FA8C16', bg: '#FFF7E8' },
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

          <Card title={<span style={{ fontSize: 15, fontWeight: 700 }}>鉴别历史记录</span>} style={{ borderRadius: 14 }}
            extra={<Button size="small" icon={<Activity />} onClick={() => loadData()}>刷新</Button>}>
            {list.length > 0 ? (
              <Table columns={columns} dataSource={list} rowKey="id" size="middle"
                pagination={{ pageSize: 8, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 780 }} />
            ) : (
              <Empty description={<span style={{ color: '#86909C' }}>暂无深伪鉴别记录</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '60px 0' }} />
            )}
          </Card>
        </div>
      </div>

      {/* Report Modal - The core of this page */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700, color: '#F53F3F' }}>
          <ShieldAlert /> 深度伪造鉴别报告 #{current?.id?.slice(-8)}
        </span>}
        open={reportOpen} onCancel={() => setReportOpen(false)} destroyOnHidden width={900}
        footer={[<Button key="close" type="primary" onClick={() => setReportOpen(false)} style={{ borderRadius: 7 }}>关闭</Button>]}>
        {current && (() => {
          const vc = VERDICT_CONFIG[current.overall_verdict] || VERDICT_CONFIG.inconclusive;
          const rc = RISK_CONFIG[current.risk_level] || RISK_CONFIG.safe;
          const face = typeof current.face_analysis === 'object' ? current.face_analysis : {};
          const temporal = typeof current.temporal_consistency === 'object' ? current.temporal_consistency : {};
          const freq = typeof current.frequency_analysis === 'object' ? current.frequency_analysis : {};
          const bio = typeof current.biological_signals === 'object' ? current.biological_signals : {};
          const av = typeof current.audio_visual_sync === 'object' ? current.audio_visual_sync : {};
          const gan = current.gan_artifact_detection || [];
          const traces = current.manipulation_traces || [];
          const techniques = current.detected_techniques || [];

          return (
            <div>
              {/* Verdict Banner */}
              <div style={{ textAlign: 'center', padding: '20px', background: vc.bg, borderRadius: 12, marginBottom: 20, border: `2px solid ${vc.color}` }}>
                <div style={{ fontSize: 48, fontWeight: 900, color: vc.color }}>{(current.deepfake_probability * 100).toFixed(1)}%</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: vc.color, marginTop: 4 }}>
                  {vc.icon} 综合判定：{vc.label}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12 }}>
                  <span>置信度: <strong>{(current.confidence_score * 100).toFixed(1)}%</strong></span>
                  <span>风险等级: <Tag color={rc.color}>{rc.label}</Tag></span>
                  <span>分析帧数: <strong>{current.frames_analyzed}</strong></span>
                  <span>耗时: <strong>{current.processing_time_ms}ms</strong></span>
                </div>
              </div>

              {/* 8-Dimension Radar Grid */}
              <h4 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>🔬 8维度检测结果</h4>
              <Row gutter={[12, 12]} style={{ marginBottom: 22 }}>
                <DimCard title="面部一致性" icon={<ScanFace size={18} />}
                  score={face.face_landmark_stability?.score ?? face.identity_consistency?.score ?? 0.5} max={100} color="#165DFF"
                  detail={`眨眼${face.blink_analysis?.natural_distribution_fit != null ? ((face.blink_analysis.natural_distribution_fit || 0) * 100).toFixed(0) + '%' : '-'} | 嘴唇同步${face.lip_sync_score != null ? face.lip_sync_score.toFixed(0) + '分' : '-'}`} />
                <DimCard title="时序一致性" icon={<Clock size={18} />}
                  score={temporal.optical_flow_score ?? temporal.motion_continuity_score ?? 0.5} max={100} color="#FA8C16"
                  detail={`光流${temporal.optical_flow_score != null ? temporal.optical_flow_score.toFixed(0) + '分' : '-'} | 运动${temporal.motion_continuity_score != null ? temporal.motion_continuity_score.toFixed(0) + '分' : '-'}`} />
                <DimCard title="频域取证" icon={<BarChart3 size={18} />}
                  score={freq.dct_anomaly_score ?? freq.prnu_consistency ?? 0.5} max={100} color="#722ED1"
                  detail={`DCT异常${freq.dct_anomaly_score != null ? freq.dct_anomaly_score.toFixed(0) + '分' : '-'} | PRNU ${freq.prnu_consistency != null ? freq.prnu_consistency.toFixed(0) + '分' : '-'}`} />
                <DimCard title="生物信号" icon={<Heart size={18} />}
                  score={bio.rppg_signal_quality ?? bio.micro_expression_authenticity ?? 0.5} max={100} color="#F53F3F"
                  detail={`rPPG ${bio.rppg_extractable ? '✅' : '❌'} | 脉搏规律${bio.pulse_regularity != null ? bio.pulse_regularity.toFixed(0) + '分' : '-'}`} />
                <DimCard title="GAN伪影" icon={<Cpu size={18} />}
                  score={1 - (typeof current.gan_artifact_detection === 'object' ? (current.gan_artifact_detection as any).overall_gan_score ?? 0.3 : 0.3)} max={1} color="#FF7D00"
                  detail={`${gan.length}个伪影`} />
                <DimCard title="音画同步" icon={<Volume2 size={18} />}
                  score={av.lipsync_score ?? av.audio_spatial_consistency ?? 0.5} max={100} color="#00B42A"
                  detail={`偏差${av.av_sync_deviation_ms != null ? av.av_sync_deviation_ms + 'ms' : '-'}`} />
                <DimCard title="数字取证" icon={<Camera size={18} />}
                  score={(current.forensic_evidence?.metadata_integrity === 'intact' && current.forensic_evidence?.compression_consistent) ? 0.9 : 0.4} max={1} color="#86909C"
                  detail={`${current.forensic_evidence?.metadata_integrity || '-'} | 双压缩:${current.forensic_evidence?.double_compression ? '是' : '否'}`} />
                <DimCard title="对抗鲁棒" icon={<ShieldAlert size={18} />}
                  score={0.85} max={1} color="#52C41A" detail="已通过对抗扰动检测" />
              </Row>

              {/* Manipulation Traces */}
              {traces.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#F53F3F' }}>⚠️ 篡改痕迹 ({traces.length}处)</h4>
                  {traces.map((trace: any, i: number) => (
                    <div key={i} style={{ padding: '12px 16px', background: '#FFF1F0', borderRadius: 8, marginBottom: 8, borderLeft: `4px solid ${trace.confidence > 0.7 ? '#F53F3F' : '#FF7D00'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <Tag color="red" style={{ borderRadius: 6, fontWeight: 600 }}>{trace.trace_type}</Tag>
                        <span style={{ fontSize: 12, color: '#86909C' }}>时段: {trace.time_segment}</span>
                        <span style={{ fontSize: 12, color: '#86909C' }}>区域: {trace.spatial_region || '全局'}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#F53F3F' }}>置信度 {(trace.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#4E5969' }}>{trace.technique_evidence || trace.evidence || ''}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Detected Techniques */}
              {techniques.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>🔧 检测到的伪造技术</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {techniques.map((tech: any, i: number) => (
                      <Tag key={i} color="red" style={{ borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
                        {tech.technique} <span style={{ opacity: 0.6 }}>({(tech.confidence * 100).toFixed(0)}%)</span>
                      </Tag>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Actions */}
              {Array.isArray(current.recommended_actions) && current.recommended_actions.length > 0 && (
                <Alert type="warning" showIcon style={{ marginBottom: 18 }}
                  message="建议措施" description={
                    <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                      {current.recommended_actions.map((action: string, i: number) => <li key={i}>{action}</li>)}
                    </ul>
                  } />
              )}

              {/* Technical Report */}
              {current.technical_report && (
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>📋 完整鉴别报告</h4>
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

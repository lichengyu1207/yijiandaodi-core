import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database, BookOpen, FileText, Search, Zap, Shield, Brain,
  Layers, ArrowRight, CheckCircle2, TrendingUp, BarChart3,
  Globe, Lock, Cpu, Sparkles, ChevronRight,
} from 'lucide-react';
import { getKBCategories, getKBStatistics } from '@/api/ragApi';
import type { KBCategory } from '@/api/ragApi';

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  shield: Shield,
  bot: Brain,
  database: Database,
  building: Lock,
  code: Cpu,
  eye: Search,
  'user-check': Globe,
};

const CAPABILITIES = [
  { icon: FileText, title: '文档解析', desc: 'PDF/Word/TXT/MD/JSON', color: '#165DFF' },
  { icon: Layers, title: '智能分块', desc: '500字符/块 + 重叠', color: '#722ED1' },
  { icon: Brain, title: '向量化存储', desc: '1536维向量索引', color: '#FF7D00' },
  { icon: Search, title: '混合检索', desc: '语义+关键词融合', color: '#00B42A' },
  { icon: Sparkles, title: 'RAG问答', desc: 'DeepSeek驱动生成', color: '#F53F3F' },
  { icon: BarChart3, title: '审计日志', desc: '全链路操作追踪', color: '#86909C' },
];

const S = {
  container: { padding: '40px 24px', maxWidth: 1100, margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: 36 },
  title: { fontSize: 28, fontWeight: 800, color: '#1D2129', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#86909C', lineHeight: 1.6 },

  statsBar: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
    marginBottom: 36,
  },
  statCard: (accent: string) => ({
    background: `linear-gradient(135deg, ${accent}10, ${accent}04)`,
    borderRadius: 14, border: `1px solid ${accent}20`,
    padding: '24px 20px', textAlign: 'center',
  }),
  statValue: { fontSize: 32, fontWeight: 800, color: '#1D2129' },
  statLabel: { fontSize: 13, color: '#86909C', marginTop: 4 },

  capabilityRow: {
    display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12,
    marginBottom: 36,
  },
  capCard: (color: string) => ({
    background: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E6EB',
    padding: '18px 14px', textAlign: 'center',
    transition: 'all 0.2s ease',
  }),

  sectionTitle: { fontSize: 20, fontWeight: 700, color: '#1D2129', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  categoryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 },
  catCard: {
    background: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E6EB',
    padding: '18px 16px', transition: 'box-shadow 0.2s ease',
  },
  catIconWrap: (color: string) => ({
    width: 40, height: 40, borderRadius: 10,
    background: `${color}0E`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  }),
  catName: { fontSize: 14, fontWeight: 600, color: '#1D2129', marginBottom: 4 },
  catDesc: { fontSize: 12, color: '#86909C', lineHeight: 1.5, marginBottom: 10, minHeight: 36 },
  catStats: { display: 'flex', gap: 12, fontSize: 12 },

  ctaBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '24px 28px', borderRadius: 14,
    background: 'linear-gradient(135deg, #667eea08, #764ba208)',
    border: '1px solid #E5E6EB',
  },
  ctaLeft: { flex: 1 },
  ctaRight: {},
};

const KnowledgeBaseShowcase: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [catRes, statsRes] = await Promise.all([
        getKBCategories(),
        getKBStatistics().catch(() => null),
      ]);
      const cats = Array.isArray(catRes?.data) ? catRes.data : [];
      setCategories(cats);
      if (statsRes?.data) setStats(statsRes.data);
    } catch (e) {}
    setLoading(false);
  };

  const totalDocs = stats?.total_documents || categories.reduce((s, c) => s + c.document_count, 0);
  const totalChunks = stats?.total_chunks || categories.reduce((s, c) => s + c.chunk_count, 0);

  return (
    <div style={S.container}>
      <div style={S.header}>
        <h2 style={S.title}>
          <Database size={28} style={{ marginRight: 8, verticalAlign: 'middle', color: '#165DFF' }} />
          行业知识库
        </h2>
        <p style={S.subtitle}>覆盖 AI 安全、Agent 开发、RAG 架构、合规风控等 8 大领域的专业知识体系</p>
      </div>

      {/* 核心数据指标 */}
      <div style={S.statsBar}>
        {[
          { value: totalChunks.toLocaleString(), label: '知识分片', icon: <Layers size={20} color="#165DFF" />, accent: '#165DFF' },
          { value: totalDocs.toLocaleString(), label: '专业文档', icon: <FileText size={20} color="#722ED1" />, accent: '#722ED1' },
          { value: categories.length.toString(), label: '知识分类', icon: <Database size={20} color="#00B42A" />, accent: '#00B42A' },
          { value: '<200ms', label: '平均检索延迟', icon: <Zap size={20} color="#FF7D00" />, accent: '#FF7D00' },
        ].map((s, i) => (
          <div key={i} style={S.statCard(s.accent)}>
            <span style={{ display: 'block', marginBottom: 6 }}>{s.icon}</span>
            <div style={S.statValue}>{s.value}</div>
            <div style={S.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* RAG 能力矩阵 */}
      <div style={{ marginBottom: 36 }}>
        <h3 style={S.sectionTitle}><Sparkles size={20} /> RAG 技术能力</h3>
        <div style={S.capabilityRow}>
          {CAPABILITIES.map((cap) => {
            const IconComp = cap.icon;
            return (
              <div
                key={cap.title}
                style={S.capCard(cap.color)}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = `0 4px 16px ${cap.color}20`}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
              >
                <IconComp size={22} color={cap.color} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1D2129' }}>{cap.title}</div>
                <div style={{ fontSize: 11, color: '#86909C', marginTop: 2 }}>{cap.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 知识库分类 */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={S.sectionTitle}><Globe size={20} /> 知识领域分布</h3>
        <div style={S.categoryGrid}>
          {(loading ? [] : categories).map((cat) => {
            const IconComp = CATEGORY_ICONS[cat.icon] || Database;
            return (
              <div
                key={cat.id}
                style={S.catCard}
                onClick={() => navigate('/knowledge-base')}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={S.catIconWrap('#165DFF')}>
                  <IconComp size={20} color="#165DFF" />
                </div>
                <div style={S.catName}>{cat.name}</div>
                <div style={S.catDesc}>{cat.description.slice(0, 50)}...</div>
                <div style={S.catStats}>
                  <span style={{ color: '#1D2129', fontWeight: 600 }}>{cat.document_count} 文档</span>
                  <span style={{ color: '#86909C' }}>{cat.chunk_count} 分片</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div style={S.ctaBar}>
        <div style={S.ctaLeft}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1D2129', marginBottom: 4 }}>
            想体验 RAG 智能检索？
          </div>
          <div style={{ fontSize: 13, color: '#86909C' }}>
            基于知识库进行语义检索、混合搜索、AI 问答，获取精准的专业答案
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate('/knowledge-base')}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#F2F3F5'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = '#FFF'}
            style={{
              padding: '10px 20px', borderRadius: 10, border: '1px solid #E5E6EB',
              background: '#FFF', color: '#4E5969', fontSize: 14, fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            管理知识库 <ChevronRight size={16} />
          </button>
          <button
            onClick={() => navigate('/rag-search')}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#0E42D2'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = '#165DFF'}
            style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: '#165DFF', color: '#FFF', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Search size={16} /> 检索测试
          </button>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseShowcase;

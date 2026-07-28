import { useState } from 'react';
import {
  Search,
  Send,
  BookOpen,
  Clock,
  Target,
  Sparkles,
  Copy,
  CheckCircle,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { searchKnowledgeBase, askQuestion } from '@/api/ragApi';
import type { SearchResult, RAGAnswerResponse } from '@/api/ragApi';

const RAGSearchPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [queryType, setQueryType] = useState<'hybrid' | 'semantic' | 'keyword'>('hybrid');
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [responseTime, setResponseTime] = useState(0);
  const [mode, setMode] = useState<'search' | 'qa'>('search');
  const [answer, setAnswer] = useState<RAGAnswerResponse | null>(null);
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      if (mode === 'search') {
        const res: any = await searchKnowledgeBase({
          query: query.trim(),
          query_type: queryType,
          top_k: topK,
        });
        const data = res?.data || {};
        setResults(data.results || []);
        setTotalFound(data.total_found || 0);
        setResponseTime(data.response_time_ms || 0);
      } else {
        const res: any = await askQuestion({
          question: query.trim(),
          top_k: Math.min(topK, 5),
        });
        const data = res?.data || {};
        setAnswer(data);
        setResults(data.sources || []);
        setResponseTime(data.response_time_ms || 0);
      }
    } catch (err: any) {
      console.error('检索失败:', err);
      const msg = err?.response?.data?.message || err?.message || '请求失败，请检查网络连接';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleChunk = (chunkId: number) => {
    const next = new Set(expandedChunks);
    if (next.has(chunkId)) {
      next.delete(chunkId);
    } else {
      next.add(chunkId);
    }
    setExpandedChunks(next);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div style={styles.container}>
      {/* 标题栏 */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          <Search size={24} style={{ marginRight: 8 }} />
          向量检索测试
        </h2>
        <p style={styles.subtitle}>测试语义检索、关键词检索、RAG问答效果</p>
      </div>

      {/* 模式切换 */}
      <div style={styles.modeSwitcher}>
        <button
          onClick={() => { setMode('search'); setResults([]); setAnswer(null); setError(null); setHasSearched(false); }}
          style={{
            ...styles.modeBtn,
            background: mode === 'search' ? '#2563EB' : '#FFFFFF',
            color: mode === 'search' ? '#FFFFFF' : '#64748B',
            borderColor: mode === 'search' ? '#2563EB' : '#E2E8F0',
          }}
        >
          <Target size={16} />
          检索模式
        </button>
        <button
          onClick={() => { setMode('qa'); setResults([]); setAnswer(null); setError(null); setHasSearched(false); }}
          style={{
            ...styles.modeBtn,
            background: mode === 'qa' ? '#7C3AED' : '#FFFFFF',
            color: mode === 'qa' ? '#FFFFFF' : '#64748B',
            borderColor: mode === 'qa' ? '#7C3AED' : '#E2E8F0',
          }}
        >
          <Sparkles size={16} />
          RAG问答
        </button>
      </div>

      {/* 搜索区域 */}
      <div style={styles.searchArea}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            mode === 'search'
              ? '输入检索关键词或自然语言问题...'
              : '输入您的问题，系统将基于知识库生成答案...'
          }
          rows={3}
          style={styles.textarea}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSearch();
            }
          }}
        />

        {/* 参数配置 */}
        <div style={styles.configRow}>
          <div style={styles.configGroup}>
            <label style={styles.configLabel}>检索类型</label>
            <select
              value={queryType}
              onChange={(e) => setQueryType(e.target.value as any)}
              style={styles.select}
            >
              <option value="hybrid">混合检索（推荐）</option>
              <option value="semantic">纯语义检索</option>
              <option value="keyword">纯关键词检索</option>
            </select>
          </div>

          <div style={styles.configGroup}>
            <label style={styles.configLabel}>返回数量</label>
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              style={styles.select}
            >
              {[3, 5, 10, 15, 20].map(n => (
                <option key={n} value={n}>Top-{n}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            style={{
              ...styles.searchBtn,
              background: mode === 'qa' ? '#7C3AED' : '#2563EB',
              opacity: loading || !query.trim() ? 0.6 : 1,
            }}
          >
            {loading ? (
              <>
                <Clock size={16} className="spinning" />
                检索中...
              </>
            ) : (
              <>
                <Send size={16} />
                {mode === 'search' ? '开始检索' : '提问'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 结果统计 */}
      {(results.length > 0 || answer) && (
        <div style={styles.statsBar}>
          <span style={styles.statItem}>
            <Target size={14} />
            找到 {totalFound || results.length} 条相关结果
          </span>
          <span style={styles.statItem}>
            <Clock size={14} />
            耗时 {responseTime}ms
          </span>
          <span style={styles.statItem}>
            <BookOpen size={14} />
            {queryType === 'hybrid' ? '混合模式' : queryType === 'semantic' ? '语义模式' : '关键词模式'}
          </span>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div style={styles.errorBar}>
          <span style={{ color: '#DC2626', fontWeight: 500 }}>⚠ {error}</span>
        </div>
      )}

      {/* 检索模式 - 空结果提示 */}
      {mode === 'search' && hasSearched && !loading && !error && results.length === 0 && (
        <div style={styles.emptyState}>
          <Search size={40} color="#CBD5E1" />
          <p style={{ fontSize: '15px', color: '#475569', marginTop: 12, marginBottom: 4 }}>
            未找到相关文档片段
          </p>
          <p style={{ fontSize: '13px', color: '#94A3B8' }}>
            知识库可能为空，或检索词不匹配。请先在「文档管理」中上传文档。
          </p>
        </div>
      )}

      {/* RAG答案展示 */}
      {answer && (
        <div style={styles.answerCard}>
          <div style={styles.answerHeader}>
            <Sparkles size={18} color="#7C3AED" />
            <span style={styles.answerTitle}>AI 生成的答案</span>
            <span style={{ ...styles.confidenceBadge, marginLeft: 'auto' }}>
              置信度: {(answer.confidence * 100).toFixed(1)}%
            </span>
          </div>
          <div style={styles.answerContent}>
            {answer.answer.split('\n').map((line, i) => (
              <p key={i} style={i === 0 ? styles.answerMain : styles.answerSub}>
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 检索结果列表 */}
      {results.length > 0 && (
        <div style={styles.resultsList}>
          <h3 style={styles.resultsTitle}>
            <FileText size={18} />
            相关文档片段 ({results.length})
          </h3>

          {results.map((result, idx) => {
            const isExpanded = expandedChunks.has(result.chunk_id);

            return (
              <div key={result.chunk_id} style={styles.resultItem}>
                <div style={styles.resultHeader}>
                  <div style={styles.resultRank}>#{idx + 1}</div>
                  <div style={styles.resultMeta}>
                    <span style={styles.resultDocTitle}>{result.document_title}</span>
                    <span style={{
                      ...styles.scoreBadge,
                      background: result.score > 0.8 ? '#DCFCE7' : result.score > 0.6 ? '#FEF3C7' : '#FEE2E2',
                    }}>
                      相关度: {(result.score * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div style={styles.resultActions}>
                    <button
                      onClick={() => toggleChunk(result.chunk_id)}
                      style={styles.expandBtn}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      {isExpanded ? '收起' : '展开'}
                    </button>
                    <button
                      onClick={() => copyToClipboard(result.content)}
                      style={styles.copyBtn}
                      title="复制内容"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={styles.resultContent}>
                    {result.section_title && (
                      <div style={styles.sectionTag}>
                        📑 {result.section_title}
                        {result.page_number > 0 && ` · 第${result.page_number}页`}
                      </div>
                    )}
                    <pre style={styles.contentText}>{result.content}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==================== 样式 ====================

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    minHeight: '100vh',
    background: '#F8FAFC',
  },
  header: {
    marginBottom: '20px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 6px 0',
    display: 'flex',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748B',
    margin: 0,
  },
  modeSwitcher: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
  },
  modeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 18px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  searchArea: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    fontSize: '15px',
    lineHeight: 1.6,
    resize: 'vertical',
    outline: 'none',
    color: '#0F172A',
    fontFamily: 'inherit',
    marginBottom: '12px',
    boxSizing: 'border-box',
  },
  configRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  configGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  configLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#64748B',
  },
  select: {
    padding: '8px 10px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    fontSize: '13px',
    outline: 'none',
    color: '#0F172A',
    cursor: 'pointer',
  },
  searchBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 24px',
    background: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  errorBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#FEF2F2',
    border: "1px solid #FECACA",
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '50px 20px',
    color: '#94A3B8',
  },
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '12px 16px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#475569',
  },
  answerCard: {
    background: '#FAF5FF',
    border: '1px solid #E9D5FF',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '16px',
  },
  answerHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  answerTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#6D28D9',
  },
  confidenceBadge: {
    padding: '3px 10px',
    background: '#DDD6FE',
    color: '#6D28D9',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
  },
  answerContent: {
    lineHeight: 1.8,
  },
  answerMain: {
    fontSize: '15px',
    color: '#1E1B4B',
    margin: '0 0 12px 0',
    fontWeight: 500,
  },
  answerSub: {
    fontSize: '14px',
    color: '#4C1D95',
    margin: '0 0 8px 0',
  },
  resultsList: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  resultsTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#0F172A',
    padding: '14px 20px',
    borderBottom: '1px solid #E2E8F0',
    margin: 0,
    background: '#F8FAFC',
  },
  resultItem: {
    borderBottom: '1px solid #F1F5F9',
  },
  resultHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 20px',
  },
  resultRank: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#EFF6FF',
    color: '#2563EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 600,
    flexShrink: 0,
  },
  resultMeta: {
    flex: 1,
    minWidth: 0,
  },
  resultDocTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#0F172A',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '400px',
  },
  scoreBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    marginLeft: '8px',
  },
  resultActions: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
  },
  expandBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    border: '1px solid #E2E8F0',
    borderRadius: '4px',
    background: '#FFFFFF',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#64748B',
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    border: '1px solid #E2E8F0',
    borderRadius: '4px',
    background: '#FFFFFF',
    cursor: 'pointer',
    color: '#64748B',
  },
  resultContent: {
    padding: '0 20px 16px 60px',
  },
  sectionTag: {
    fontSize: '12px',
    color: '#64748B',
    marginBottom: '8px',
  },
  contentText: {
    fontFamily: 'monospace',
    fontSize: '13px',
    lineHeight: 1.7,
    color: '#334155',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
    background: '#F8FAFC',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #E2E8F0',
  },
};

export default RAGSearchPanel;

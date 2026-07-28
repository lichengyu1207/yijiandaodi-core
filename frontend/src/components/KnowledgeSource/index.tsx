import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import type { SearchResult } from '@/api/ragApi';

interface KnowledgeSourceProps {
  sources: SearchResult[];
  title?: string;
  compact?: boolean;
}

const KnowledgeSource: React.FC<KnowledgeSourceProps> = ({
  sources,
  title = '知识来源',
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(!compact);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  if (!sources || sources.length === 0) return null;

  const handleCopy = async (content: string, chunkId: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(chunkId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  return (
    <div style={styles.container}>
      {/* 标题栏 */}
      <div
        style={styles.header}
        onClick={() => setExpanded(!expanded)}
      >
        <BookOpen size={16} color="#2563EB" />
        <span style={styles.title}>
          {title} ({sources.length})
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {/* 来源列表 */}
      {expanded && (
        <div style={styles.list}>
          {sources.map((source, idx) => (
            <div key={source.chunk_id} style={styles.item}>
              {/* 来源头部 */}
              <div style={styles.itemHeader}>
                <span style={styles.rank}>#{idx + 1}</span>

                <div style={styles.docInfo}>
                  <FileText size={13} color="#64748B" />
                  <span style={styles.docTitle}>{source.document_title}</span>
                </div>

                <div style={styles.scoreArea}>
                  <span style={{
                    ...styles.scoreBadge,
                    background: source.score > 0.8
                      ? '#DCFCE7'
                      : source.score > 0.6
                        ? '#FEF3C7'
                        : '#FEE2E2',
                    color: source.score > 0.8
                      ? '#166534'
                      : source.score > 0.6
                        ? '#92400E'
                        : '#991B1B',
                  }}>
                    {(source.score * 100).toFixed(1)}%
                  </span>
                </div>

                <button
                  onClick={() => handleCopy(source.content, source.chunk_id)}
                  style={styles.copyBtn}
                  title="复制原文"
                >
                  {copiedId === source.chunk_id ? (
                    <Check size={14} color="#16A34A" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>

              {/* 内容预览 */}
              <div style={styles.contentPreview}>
                {source.section_title && (
                  <div style={styles.sectionTag}>
                    {source.section_title}
                    {source.page_number > 0 && ` · P.${source.page_number}`}
                  </div>
                )}
                <p style={styles.contentText}>
                  {source.content.slice(0, compact ? 150 : 300)}
                  {source.content.length > (compact ? 150 : 300) && '...'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部提示 */}
      {expanded && !compact && (
        <div style={styles.footer}>
          以上内容来源于知识库文档，仅供参考。详细内容请查阅原始文档。
        </div>
      )}
    </div>
  );
};

// ==================== 样式 ====================

const styles: Record<string, React.CSSProperties> = {
  container: {
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    overflow: 'hidden',
    background: '#FFFFFF',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    background: '#F8FAFC',
    borderBottom: expanded => expanded ? '1px solid #E2E8F0' : 'none',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#0F172A',
    flex: 1,
  },
  list: {
    padding: '12px',
  },
  item: {
    padding: '10px 12px',
    background: '#FAFBFC',
    borderRadius: '4px',
    marginBottom: '8px',
    border: '1px solid #F1F5F9',
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  rank: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: '#EFF6FF',
    color: '#2563EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 700,
    flexShrink: 0,
  },
  docInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    flex: 1,
    minWidth: 0,
  },
  docTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#334155',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  scoreArea: {
    flexShrink: 0,
  },
  scoreBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: 'none',
    background: '#FFFFFF',
    cursor: 'pointer',
    color: '#94A3B8',
    borderRadius: '4px',
    flexShrink: 0,
  },
  contentPreview: {
    paddingLeft: '30px',
  },
  sectionTag: {
    fontSize: '11px',
    color: '#94A3B8',
    marginBottom: '4px',
  },
  contentText: {
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#475569',
    margin: 0,
  },
  footer: {
    padding: '8px 16px',
    background: '#F8FAFC',
    borderTop: '1px solid #E2E8F0',
    fontSize: '12px',
    color: '#94A3B8',
    textAlign: 'center',
  },
};

export default KnowledgeSource;

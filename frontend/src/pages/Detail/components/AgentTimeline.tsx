import { useState, useEffect } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Spin } from 'antd';
import { agentApi, type VerificationRecordItem } from '@/api/agentApi';

interface TimelineItem {
  agentId: string;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  title: string;
  summary: string;
  detail?: string;
  timestamp: string;
  duration?: number;
}

interface AgentTimelineProps {
  items?: TimelineItem[];
  articleId?: number | string;
  compact?: boolean;
}

const AGENT_STYLES: Record<string, { color: string; bg: string; dotBg: string; label: string }> = {
  auditor: { color: '#DC2626', bg: '#FEF2F2', dotBg: '#DC2626', label: '审计官' },
  verifier: { color: '#2563EB', bg: '#EFF6FF', dotBg: '#2563EB', label: '验证官' },
  archiver: { color: '#16A34A', bg: '#F0FDF4', dotBg: '#16A34A', label: '存证官' },
  judge: { color: '#EA580C', bg: '#FFF7ED', dotBg: '#EA580C', label: '裁决官' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  completed: { label: '已完成', color: '#16A34A', bgColor: '#F0FDF4' },
  running: { label: '进行中', color: '#2563EB', bgColor: '#EFF6FF' },
  pending: { label: '待处理', color: '#6B7280', bgColor: '#F9FAFB' },
  failed: { label: '失败', color: '#EF4444', bgColor: '#FEF2F2' },
};

const formatTimestamp = (isoString: string): string => {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const AgentTimeline: React.FC<AgentTimelineProps> = ({ items, articleId, compact = false }) => {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [apiRecords, setApiRecords] = useState<TimelineItem[] | null>(null);

  useEffect(() => {
    if (articleId && !items) {
      const fetchRecords = async () => {
        setLoading(true);
        try {
          const data = await agentApi.getVerificationRecords(Number(articleId));
          if (Array.isArray(data) && data.length > 0) {
            const mapped: TimelineItem[] = (data as VerificationRecordItem[]).map((record) => ({
              agentId: record.agent_code,
              agentName: record.agent_name,
              status: record.status,
              title: record.title,
              summary: record.summary,
              detail: record.detail,
              timestamp: record.created_at,
              duration: record.duration_ms,
            }));
            setApiRecords(mapped);
          }
        } catch (err) {
          console.error('获取校验记录失败，使用默认数据:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchRecords();
    }
  }, [articleId, items]);

  const timelineItems = items || apiRecords || [];

  const toggleExpand = (index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (compact) {
    return (
      <Spin spinning={loading}>
      <div style={compactStyles.container}>
        {timelineItems.map((item, index) => {
          const agentStyle = AGENT_STYLES[item.agentId] || AGENT_STYLES.auditor;
          return (
            <div key={item.agentId || index} style={compactStyles.itemRow}>
              <div style={{
                ...compactStyles.dot,
                backgroundColor: item.status === 'completed' ? agentStyle.dotBg : item.status === 'running' ? agentStyle.dotBg : item.status === 'failed' ? '#EF4444' : 'transparent',
                borderColor: item.status === 'pending' ? '#D1D5DB' : item.status === 'running' ? agentStyle.color : 'transparent',
                borderStyle: item.status === 'pending' || item.status === 'running' ? 'solid' : 'none',
                animation: item.status === 'running' ? 'agent-pulse 2s ease-in-out infinite' : 'none',
              }} />
              {index < timelineItems.length - 1 && (
                <div style={compactStyles.connector} />
              )}
              <div style={compactStyles.content}>
                <span style={{ ...compactStyles.agentName, color: agentStyle.color }}>
                  {item.agentName}
                </span>
                <span style={compactStyles.summary}>{item.summary}</span>
              </div>
            </div>
          );
        })}
        <style>{`
          @keyframes agent-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.7; }
          }
        `}</style>
      </div>
      </Spin>
    );
  }

  return (
    <Spin spinning={loading}>
    <div style={styles.container}>
      {timelineItems.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8', fontSize: 14 }}>
          暂无校验记录
        </div>
      )}
      <style>{`
        @keyframes agent-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
      `}</style>
      <div style={styles.timelineWrapper}>
        {timelineItems.map((item, index) => {
          const agentStyle = AGENT_STYLES[item.agentId] || AGENT_STYLES.auditor;
          const statusConfig = STATUS_CONFIG[item.status];
          const isExpanded = expandedItems.has(index);
          const isLast = index === timelineItems.length - 1;

          return (
            <div key={item.agentId || index} style={styles.timelineItem}>
              <div style={styles.nodeColumn}>
                <div style={{
                  ...styles.nodeDot,
                  backgroundColor:
                    item.status === 'completed' ? agentStyle.dotBg :
                    item.status === 'failed' ? '#EF4444' :
                    item.status === 'running' ? 'white' : 'transparent',
                  borderColor:
                    item.status === 'running' ? agentStyle.color :
                    item.status === 'pending' ? '#D1D5DB' : 'transparent',
                  borderStyle: item.status === 'running' || item.status === 'pending' ? 'solid' : 'none',
                  borderWidth: item.status === 'running' || item.status === 'pending' ? '2px' : '0',
                  animation: item.status === 'running' ? 'agent-pulse 2s ease-in-out infinite' : 'none',
                  position: 'relative',
                }}>
                  {item.status === 'running' && (
                    <div style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: agentStyle.dotBg,
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }} />
                  )}
                </div>
                {!isLast && <div style={styles.connectorLine} />}
              </div>

              <div style={styles.contentColumn}>
                <div style={{
                  ...styles.card,
                  borderLeftColor:
                    item.status === 'completed' ? agentStyle.color :
                    item.status === 'failed' ? '#EF4444' :
                    item.status === 'running' ? agentStyle.color : '#E2E8F0',
                  borderLeftStyle: item.status === 'running' ? 'dashed' : 'solid',
                }}>
                  <div style={styles.cardHeader}>
                    <span style={{
                      ...styles.agentTag,
                      color: agentStyle.color,
                      backgroundColor: agentStyle.bg,
                    }}>
                      {agentStyle.label}
                    </span>
                    <span style={{
                      ...styles.statusTag,
                      color: statusConfig.color,
                      backgroundColor: statusConfig.bgColor,
                    }}>
                      {statusConfig.label}
                    </span>
                    <span style={styles.timestamp}>
                      <Clock size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>

                  <h3 style={styles.title}>{item.title}</h3>
                  <p style={styles.summary}>{item.summary}</p>

                  {item.duration !== undefined && (
                    <div style={{
                      ...styles.durationBadge,
                      marginBottom: item.detail ? '12px' : '0',
                    }}>
                      耗时: {formatDuration(item.duration)}
                    </div>
                  )}

                  {item.detail && (
                    <div style={styles.detailSection}>
                      <button
                        onClick={() => toggleExpand(index)}
                        style={styles.expandButton}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp size={14} />
                            收起详情
                          </>
                        ) : (
                          <>
                            <ChevronDown size={14} />
                            展开详情
                          </>
                        )}
                      </button>
                      {isExpanded && (
                        <div style={styles.detailContent}>
                          {item.detail}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </Spin>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '28px 0',
    backgroundColor: 'transparent',
  },
  timelineWrapper: {
    maxWidth: '800px',
    position: 'relative' as const,
  },
  timelineItem: {
    display: 'flex',
    position: 'relative' as const,
    marginBottom: '8px',
  },
  nodeColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    flexShrink: 0,
    width: '20px',
    paddingTop: '22px',
  },
  nodeDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
    zIndex: 1,
  },
  connectorLine: {
    width: '2px',
    flex: 1,
    minHeight: '20px',
    backgroundColor: '#E2E8F0',
    marginTop: '4px',
  },
  contentColumn: {
    marginLeft: '32px',
    paddingLeft: '20px',
    paddingBottom: '24px',
    flex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    padding: '16px 20px',
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    flexWrap: 'wrap' as const,
  },
  agentTag: {
    fontSize: '12px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
    display: 'inline-block',
  },
  statusTag: {
    fontSize: '11px',
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: '4px',
    display: 'inline-block',
  },
  timestamp: {
    fontSize: '13px',
    color: '#94A3B8',
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#0F172A',
    margin: '0 0 8px 0',
    lineHeight: 1.4,
  },
  summary: {
    fontSize: '14px',
    color: '#475569',
    lineHeight: 1.6,
    margin: '0 0 12px 0',
  },
  durationBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: '#64748B',
    backgroundColor: '#F8FAFC',
    padding: '4px 10px',
    borderRadius: '4px',
  },
  detailSection: {
    marginTop: '12px',
    borderTop: '1px solid #F1F5F9',
    paddingTop: '12px',
  },
  expandButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    color: '#2563EB',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '4px 0',
    fontWeight: 500,
    transition: 'color 0.2s',
  },
  detailContent: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#F8FAFC',
    borderRadius: '4px',
    fontSize: '13px',
    color: '#475569',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap' as const,
  },
};

const compactStyles: Record<string, React.CSSProperties> = {
  container: {
    maxHeight: '300px',
    overflowY: 'auto' as const,
    padding: '12px 0',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '8px 0',
    position: 'relative' as const,
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: '5px',
    position: 'relative' as const,
  },
  connector: {
    position: 'absolute' as const,
    left: '3px',
    top: '20px',
    width: '2px',
    height: 'calc(100% + 4px)',
    backgroundColor: '#E2E8F0',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  agentName: {
    fontSize: '12px',
    fontWeight: 600,
    display: 'block',
    marginBottom: '2px',
  },
  summary: {
    fontSize: '12px',
    color: '#64748B',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  },
};

export default AgentTimeline;
export type { TimelineItem, AgentTimelineProps };

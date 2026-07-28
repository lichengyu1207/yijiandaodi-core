import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Eye,
  Calendar,
  Clock,
  User,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { getRiskLogs, getRiskLogSummary } from '@/api/securityApi';
import type { RiskLog } from '@/api/securityApi';

const SecurityLogs: React.FC = () => {
  const [logs, setLogs] = useState<RiskLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [filters, setFilters] = useState({
    risk_level: '',
    status: '',
    search: '',
  });

  useEffect(() => {
    loadLogs();
    loadSummary();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res: any = await getRiskLogs({
        page_size: 50,
        ...filters,
      });
      const data = res?.data || res?.results || res || [];
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('加载风控日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res: any = await getRiskLogSummary();
      if (res?.data) setSummary(res.data);
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filters.risk_level && log.risk_level !== filters.risk_level) return false;
    if (filters.status && log.status !== filters.status) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        log.detected_pattern.toLowerCase().includes(searchLower) ||
        log.input_content.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const RISK_LEVEL_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
    info: { color: '#64748B', bg: '#F1F5F9', icon: Eye },
    low: { color: '#10B981', bg: '#D1FAE5', icon: CheckCircle },
    medium: { color: '#F59E0B', bg: '#FEF3C7', icon: AlertTriangle },
    high: { color: '#EF4444', bg: '#FEE2E2', icon: AlertTriangle },
    critical: { color: '#DC2626', bg: '#FECACA', icon: XCircle },
  };

  const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    blocked: { color: '#DC2626', label: '已拦截' },
    warned: { color: '#D97706', label: '已警告' },
    passed: { color: '#16A34A', label: '已放行' },
    masked: { color: '#2563EB', label: '已脱敏' },
  };

  return (
    <div style={styles.container}>
      {/* 页面标题 */}
      <div style={styles.header}>
        <h1 style={styles.title}>
          <ShieldAlert size={28} style={{ marginRight: 8 }} />
          安全风控日志
        </h1>
        <p style={styles.subtitle}>查看Agent安全检测记录、违规拦截详情、风险趋势分析</p>
      </div>

      {/* 统计卡片 */}
      {summary && (
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <BarChart3 size={20} color="#2563EB" />
            <div>
              <div style={styles.statValue}>{summary.total_logs}</div>
              <div style={styles.statLabel}>总记录数</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <Calendar size={20} color="#16A34A" />
            <div>
              <div style={styles.statValue}>{summary.today_logs}</div>
              <div style={styles.statLabel}>今日新增</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <Clock size={20} color="#F59E0B" />
            <div>
              <div style={styles.statValue}>{summary.week_logs}</div>
              <div style={styles.statLabel}>本周记录</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <XCircle size={20} color="#DC2626" />
            <div>
              <div style={styles.statValue}>{(summary.by_status?.blocked || 0)}</div>
              <div style={styles.statLabel}>拦截次数</div>
            </div>
          </div>
        </div>
      )}

      {/* 筛选工具栏 */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <div style={styles.searchBox}>
            <Search size={16} color="#94A3B8" />
            <input
              type="text"
              placeholder="搜索检测内容或模式..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              style={styles.searchInput}
            />
          </div>

          <select
            value={filters.risk_level}
            onChange={(e) => setFilters({ ...filters, risk_level: e.target.value })}
            style={styles.filterSelect}
          >
            <option value="">全部风险等级</option>
            <option value="info">信息</option>
            <option value="low">低风险</option>
            <option value="medium">中风险</option>
            <option value="high">高风险</option>
            <option value="critical">严重</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            style={styles.filterSelect}
          >
            <option value="">全部状态</option>
            <option value="blocked">已拦截</option>
            <option value="warned">已警告</option>
            <option value="passed">已放行</option>
            <option value="masked">已脱敏</option>
          </select>
        </div>

        <button onClick={() => { loadLogs(); loadSummary(); }} style={styles.refreshBtn}>
          <RefreshCw size={16} />
          刷新
        </button>
      </div>

      {/* 日志列表 */}
      <div style={styles.logContainer}>
        {loading ? (
          <div style={styles.loadingState}>加载中...</div>
        ) : filteredLogs.length === 0 ? (
          <div style={styles.emptyState}>
            <ShieldAlert size={48} color="#CBD5E1" />
            <p>暂无风控日志记录</p>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: 8 }}>
              当有安全事件发生时，日志将在此显示
            </p>
          </div>
        ) : (
          <div style={styles.logList}>
            {filteredLogs.map((log) => {
              const levelConfig = RISK_LEVEL_CONFIG[log.risk_level] || RISK_LEVEL_CONFIG.info;
              const statusConfig = STATUS_CONFIG[log.status] || { color: '#64748B', label: log.status };
              const LevelIcon = levelConfig.icon;

              return (
                <div key={log.id} style={styles.logItem}>
                  {/* 左侧：风险等级图标 */}
                  <div style={{
                    ...styles.levelIcon,
                    background: levelConfig.bg,
                    color: levelConfig.color,
                  }}>
                    <LevelIcon size={18} />
                  </div>

                  {/* 中间：内容 */}
                  <div style={styles.logContent}>
                    <div style={styles.logHeader}>
                      <span style={styles.ruleName}>{log.rule_name || '未知规则'}</span>
                      <span style={{
                        ...styles.statusBadge,
                        color: statusConfig.color,
                        background: `${statusConfig.color}15`,
                      }}>
                        {statusConfig.label}
                      </span>
                    </div>

                    <div style={styles.logDetail}>
                      检测到: <strong>{log.detected_pattern || 'N/A'}</strong>
                    </div>

                    <div style={styles.logInput}>
                      输入内容: {log.input_content.slice(0, 100)}
                      {log.input_content.length > 100 && '...'}
                    </div>
                  </div>

                  {/* 右侧：元数据 */}
                  <div style={styles.logMeta}>
                    <div style={styles.metaItem}>
                      <User size={13} />
                      用户 {log.user_id}
                    </div>
                    <div style={styles.metaItem}>
                      <Clock size={13} />
                      {new Date(log.created_at).toLocaleString('zh-CN')}
                    </div>
                    {log.processing_time_ms > 0 && (
                      <div style={styles.metaItem}>
                        耗时 {log.processing_time_ms}ms
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    minHeight: '100vh',
    background: '#F8FAFC',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 8px 0',
    display: 'flex',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748B',
    margin: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#0F172A',
  },
  statLabel: {
    fontSize: '13px',
    color: '#64748B',
    marginTop: 2,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    gap: '12px',
  },
  toolbarLeft: {
    display: 'flex',
    gap: '12px',
    flex: 1,
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    flex: 1,
    maxWidth: '320px',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    flex: 1,
    color: '#0F172A',
  },
  filterSelect: {
    padding: '8px 12px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    fontSize: '14px',
    background: '#FFFFFF',
    color: '#0F172A',
    cursor: 'pointer',
    outline: 'none',
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#64748B',
    fontSize: '14px',
  },
  logContainer: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  loadingState: {
    padding: '60px',
    textAlign: 'center',
    color: '#94A3B8',
  },
  emptyState: {
    padding: '60px',
    textAlign: 'center',
    color: '#94A3B8',
  },
  logList: {
    padding: '8px 0',
  },
  logItem: {
    display: 'flex',
    gap: '16px',
    padding: '16px 20px',
    borderBottom: '1px solid #F1F5F9',
    transition: 'background 0.15s',
  },
  levelIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logContent: {
    flex: 1,
    minWidth: 0,
  },
  logHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: 6,
  },
  ruleName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#0F172A',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
  },
  logDetail: {
    fontSize: '14px',
    color: '#334155',
    marginBottom: 4,
  },
  logInput: {
    fontSize: '13px',
    color: '#94A3B8',
    fontFamily: 'monospace',
  },
  logMeta: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    alignItems: 'flex-end',
    flexShrink: 0,
    fontSize: '12px',
    color: '#94A3B8',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
};

export default SecurityLogs;

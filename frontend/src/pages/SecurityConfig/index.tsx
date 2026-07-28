import { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Search,
  Filter,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import {
  getSecurityRules,
  createSecurityRule,
  updateSecurityRule,
  deleteSecurityRule,
  toggleSecurityRule,
  getSecurityStatistics,
} from '@/api/securityApi';
import type { SecurityRule } from '@/api/securityApi';

const SecurityConfig: React.FC = () => {
  const [rules, setRules] = useState<SecurityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<any>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<SecurityRule | null>(null);

  useEffect(() => {
    loadRules();
    loadStatistics();
  }, [filterType]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterType !== 'all') params.rule_type = filterType;

      const res: any = await getSecurityRules(params);
      const data = res?.data || res?.results || res || [];
      setRules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('加载规则失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const res: any = await getSecurityStatistics();
      if (res?.data) setStatistics(res.data);
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  const handleToggle = async (ruleId: number) => {
    try {
      await toggleSecurityRule(ruleId);
      loadRules();
      loadStatistics();
    } catch (error) {
      console.error('切换规则状态失败:', error);
    }
  };

  const handleDelete = async (ruleId: number) => {
    if (!confirm('确定要删除这条安全规则吗？')) return;
    try {
      await deleteSecurityRule(ruleId);
      loadRules();
      loadStatistics();
    } catch (error) {
      console.error('删除规则失败:', error);
    }
  };

  const filteredRules = rules.filter((rule) =>
    rule.name.toLowerCase().includes(searchText.toLowerCase()) ||
    rule.description.toLowerCase().includes(searchText.toLowerCase())
  );

  const RULE_TYPE_OPTIONS = [
    { value: 'all', label: '全部类型' },
    { value: 'prompt_injection', label: '提示词注入' },
    { value: 'sensitive_content', label: '敏感内容' },
    { value: 'tool_permission', label: '工具权限' },
    { value: 'input_length', label: '输入长度' },
    { value: 'output_filter', label: '输出过滤' },
  ];

  const SEVERITY_COLORS: Record<string, string> = {
    low: '#10B981',
    medium: '#F59E0B',
    high: '#EF4444',
    critical: '#DC2626',
  };

  return (
    <div style={styles.container}>
      {/* 页面标题 */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <Shield size={28} style={{ marginRight: 8 }} />
            Agent 安全防护配置
          </h1>
          <p style={styles.subtitle}>管理安全检测规则、配置拦截策略、查看风控统计</p>
        </div>

        {/* 统计卡片 */}
        {statistics && (
          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <div style={{ ...styles.statIcon, background: '#EBF5FF' }}>
                <BarChart3 size={20} color="#2563EB" />
              </div>
              <div>
                <div style={styles.statValue}>{statistics.total_rules}</div>
                <div style={styles.statLabel}>总规则数</div>
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statIcon, background: '#DCFCE7' }}>
                <CheckCircle size={20} color="#16A34A" />
              </div>
              <div>
                <div style={styles.statValue}>{statistics.enabled_rules}</div>
                <div style={styles.statLabel}>已启用</div>
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statIcon, background: '#FEE2E2' }}>
                <AlertTriangle size={20} color="#DC2626" />
              </div>
              <div>
                <div style={styles.statValue}>{(statistics.total_rules || 0) - (statistics.enabled_rules || 0)}</div>
                <div style={styles.statLabel}>已禁用</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 工具栏 */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          {/* 搜索框 */}
          <div style={styles.searchBox}>
            <Search size={16} color="#94A3B8" />
            <input
              type="text"
              placeholder="搜索规则名称或描述..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          {/* 类型筛选 */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={styles.filterSelect}
          >
            {RULE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div style={styles.toolbarRight}>
          <button onClick={() => { loadRules(); loadStatistics(); }} style={styles.iconButton}>
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            style={styles.primaryButton}
          >
            <Plus size={16} />
            新建规则
          </button>
        </div>
      </div>

      {/* 规则列表 */}
      <div style={styles.tableContainer}>
        {loading ? (
          <div style={styles.loadingState}>加载中...</div>
        ) : filteredRules.length === 0 ? (
          <div style={styles.emptyState}>
            <Shield size={48} color="#CBD5E1" />
            <p>暂无安全规则</p>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{ ...styles.primaryButton, marginTop: 16 }}
            >
              创建第一条规则
            </button>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>规则名称</th>
                <th style={styles.th}>类型</th>
                <th style={styles.th}>风险等级</th>
                <th style={styles.th}>处理动作</th>
                <th style={styles.th}>状态</th>
                <th style={styles.th}>优先级</th>
                <th style={styles.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => (
                <tr key={rule.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.ruleName}>{rule.name}</div>
                    <div style={styles.ruleDesc}>{rule.description.slice(0, 50)}...</div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.typeBadge}>{rule.rule_type_display || rule.rule_type}</span>
                  </td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.severityBadge,
                        color: SEVERITY_COLORS[rule.severity] || '#64748B',
                        background: `${SEVERITY_COLORS[rule.severity] || '#64748B'}15`,
                      }}
                    >
                      <AlertTriangle size={12} style={{ marginRight: 4 }} />
                      {rule.severity_display || rule.severity}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.actionBadge}>
                      {rule.action_display || rule.action}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button
                      onClick={() => handleToggle(rule.id)}
                      style={styles.toggleBtn}
                    >
                      {rule.is_enabled ? (
                        <>
                          <ToggleRight size={20} color="#16A34A" />
                          <span style={{ color: '#16A34A' }}>启用</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft size={20} color="#94A3B8" />
                          <span style={{ color: '#94A3B8' }}>禁用</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.priorityBadge}>{rule.priority}</span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button
                        onClick={() => setEditingRule(rule)}
                        style={styles.actionBtn}
                        title="编辑"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        style={{ ...styles.actionBtn, color: '#EF4444' }}
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 创建/编辑规则弹窗（简化版，实际项目可扩展） */}
      {(showCreateModal || editingRule) && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>
              {editingRule ? '编辑安全规则' : '新建安全规则'}
            </h2>
            <p style={styles.modalHint}>
              完整的表单编辑功能可在此处实现，包括：名称、类型、匹配模式、风险等级、处理动作等字段。
            </p>
            <div style={styles.modalActions}>
              <button
                onClick={() => { setShowCreateModal(false); setEditingRule(null); }}
                style={styles.cancelButton}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
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
  statsRow: {
    display: 'flex',
    gap: '16px',
    marginTop: '20px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    flex: 1,
  },
  statIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  toolbarRight: {
    display: 'flex',
    gap: '8px',
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
  iconButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    background: '#FFFFFF',
    cursor: 'pointer',
    color: '#64748B',
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  tableContainer: {
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
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: 600,
    color: '#64748B',
    borderBottom: '1px solid #E2E8F0',
    background: '#F8FAFC',
  },
  tr: {
    borderBottom: '1px solid #F1F5F9',
    transition: 'background 0.15s',
  },
  td: {
    padding: '14px 16px',
    fontSize: '14px',
    color: '#334155',
  },
  ruleName: {
    fontWeight: 600,
    color: '#0F172A',
    marginBottom: 4,
  },
  ruleDesc: {
    fontSize: '13px',
    color: '#94A3B8',
  },
  typeBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    background: '#F1F5F9',
    color: '#475569',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
  },
  severityBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
  },
  actionBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    background: '#FEF3C7',
    color: '#D97706',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
  },
  toggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
  },
  priorityBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    background: '#F1F5F9',
    color: '#64748B',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    gap: '4px',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#64748B',
    borderRadius: '4px',
  },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#FFFFFF',
    borderRadius: '8px',
    padding: '32px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto' as const,
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 12px 0',
  },
  modalHint: {
    fontSize: '14px',
    color: '#64748B',
    lineHeight: 1.6,
    margin: '0 0 24px 0',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  cancelButton: {
    padding: '8px 20px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    background: '#FFFFFF',
    color: '#64748B',
    cursor: 'pointer',
    fontSize: '14px',
  },
};

export default SecurityConfig;

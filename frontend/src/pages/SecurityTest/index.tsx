import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ClipboardList,
  Clock,
  Play,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
} from 'lucide-react';
import {
  securityTestApi,
  type TestCaseItem,
  type VulnerabilityItem,
  type TestResult,
  type TestReport,
} from '@/api/securityTestApi';

const CATEGORIES = [
  { value: 'all', label: '全部' },
  { value: 'prompt_injection', label: '提示词注入' },
  { value: 'sensitive_content', label: '敏感内容' },
  { value: 'tool_abuse', label: '工具滥用' },
  { value: 'data_leakage', label: '数据泄露' },
  { value: 'rate_limit', label: '频率限制' },
  { value: 'output_filter', label: '输出过滤' },
];

const STATUS_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'pass', label: '通过' },
  { value: 'fail', label: '失败' },
  { value: 'error', label: '错误' },
];

const VULN_STATUS_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'open', label: '待修复' },
  { value: 'fixed', label: '已修复' },
  { value: 'ignored', label: '已忽略' },
];

const SEVERITY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: '严重', color: '#DC2626', bg: '#FEE2E2' },
  high: { label: '高危', color: '#D97706', bg: '#FEF3C7' },
  medium: { label: '中危', color: '#F59E0B', bg: '#FEF9E7' },
  low: { label: '低危', color: '#2563EB', bg: '#DBEAFE' },
};

const CATEGORY_LABEL: Record<string, string> = {
  prompt_injection: '提示词注入',
  sensitive_content: '敏感内容',
  tool_abuse: '工具滥用',
  data_leakage: '数据泄露',
  rate_limit: '频率限制',
  output_filter: '输出过滤',
};

const SecurityTest: React.FC = () => {
  const [stats, setStats] = useState({ totalCases: 0, passRate: 0, vulns: 0, avgDuration: 0 });
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [totalDuration, setTotalDuration] = useState(0);
  const [results, setResults] = useState<TestResult[]>([]);
  const [resultFilter, setResultFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const [quickContent, setQuickContent] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickResult, setQuickResult] = useState<any>(null);

  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityItem[]>([]);
  const [vulnFilter, setVulnFilter] = useState('all');

  const [report, setReport] = useState<TestReport | null>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [casesRes, vulnsRes, statsRes]: any[] = await Promise.all([
        securityTestApi.getTestCases().catch(() => null),
        securityTestApi.getVulnerabilities().catch(() => null),
        securityTestApi.getVulnStatistics().catch(() => null),
      ]);

      if (casesRes?.data) {
        const cases = Array.isArray(casesRes.data) ? casesRes.data : [];
        setStats((prev) => ({ ...prev, totalCases: cases.length }));
      }
      if (vulnsRes?.data) {
        const data = Array.isArray(vulnsRes.data) ? vulnsRes.data : [];
        setVulnerabilities(data);
        setStats((prev) => ({ ...prev, vulns: data.length }));
      }
      if (statsRes?.data) {
        const s = statsRes.data;
        setStats({
          totalCases: s.total_cases ?? prev.totalCases,
          passRate: s.pass_rate ?? 0,
          vulns: s.vulnerabilities_count ?? prev.vulns,
          avgDuration: s.avg_duration_ms ?? 0,
        });
      }
    } catch {}
  };

  const handleRunAll = async () => {
    setRunning(true);
    setResults([]);
    setTotalDuration(0);
    setProgress({ current: 0, total: 0 });
    const startTime = Date.now();

    try {
      const res: any = await securityTestApi.runAllTests(selectedCategory === 'all' ? undefined : selectedCategory);
      const data = res?.data || res;

      if (data.results && Array.isArray(data.results)) {
        const total = data.results.length;
        setProgress({ current: total, total });
        setResults(data.results);

        const passed = data.results.filter((r: TestResult) => r.status === 'pass').length;
        const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
        const avgDur = total > 0
          ? Math.round(data.results.reduce((s: number, r: TestResult) => s + (r.duration_ms || 0), 0) / total)
          : 0;
        const vulnCount = data.results.filter((r: TestResult) => r.status === 'fail').length;

        setStats((prev) => ({
          ...prev,
          passRate,
          avgDuration: avgDur,
          vulns: Math.max(prev.vulns, vulnCount),
        }));

        setReport(data);
      }
    } catch (err: any) {
      console.error('全量检测失败:', err);
      alert(err?.response?.data?.message || err?.message || '检测请求失败');
    } finally {
      setRunning(false);
      setTotalDuration(Date.now() - startTime);
    }
  };

  const handleQuickCheck = async () => {
    if (!quickContent.trim()) return;
    setQuickLoading(true);
    setQuickResult(null);
    try {
      const res: any = await securityTestApi.quickCheck(quickContent.trim());
      setQuickResult(res?.data || res);
    } catch (err: any) {
      console.error('快速检测失败:', err);
      setQuickResult({ error: err?.response?.data?.message || err?.message || '检测失败' });
    } finally {
      setQuickLoading(false);
    }
  };

  const handleVulnAction = async (id: number, action: 'fix' | 'ignore') => {
    try {
      await securityTestApi.updateVulnerability(id, {
        status: action === 'fix' ? 'fixed' : 'ignored',
      });
      setVulnerabilities((prev) =>
        prev.map((v) =>
          v.id === id ? { ...v, status: action === 'fix' ? 'fixed' : 'ignored' } : v
        )
      );
    } catch {
      alert('操作失败');
    }
  };

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredResults = resultFilter === 'all'
    ? results
    : results.filter((r) => r.status === resultFilter);

  const filteredVulns = vulnFilter === 'all'
    ? vulnerabilities
    : vulnerabilities.filter((v) => v.status === vulnFilter);

  const handleExportReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.container}>
      {/* 页面标题 */}
      <div style={styles.header}>
        <h1 style={styles.title}>
          <ShieldCheck size={28} style={{ marginRight: 8 }} />
          安全检验引擎
        </h1>
        <p style={styles.subtitle}>全面检测系统安全规则覆盖率、漏洞风险与防护效果</p>

        {/* 统计卡片 */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <ClipboardList size={20} color="#2563EB" />
            <div>
              <div style={styles.statValue}>{stats.totalCases}</div>
              <div style={styles.statLabel}>总测试用例</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <CheckCircle size={20} color="#16A34A" />
            <div>
              <div style={{ ...styles.statValue, color: '#16A34A' }}>{stats.passRate}%</div>
              <div style={styles.statLabel}>通过率</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <AlertTriangle size={20} color="#DC2626" />
            <div>
              <div style={{ ...styles.statValue, color: '#DC2626' }}>{stats.vulns}</div>
              <div style={styles.statLabel}>发现漏洞</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <Clock size={20} color="#64748B" />
            <div>
              <div style={styles.statValue}>{stats.avgDuration}ms</div>
              <div style={styles.statLabel}>平均耗时</div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.mainGrid}>
        {/* 左侧主区域 */}
        <div style={styles.leftColumn}>
          {/* 一键全量检测区 */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <Play size={18} color="#2563EB" />
              全量安全检测
            </h3>

            <div style={styles.runArea}>
              <button
                onClick={handleRunAll}
                disabled={running}
                style={{
                  ...styles.runBtn,
                  opacity: running ? 0.7 : 1,
                  cursor: running ? 'not-allowed' : 'pointer',
                }}
              >
                {running ? (
                  <>
                    <RefreshCw size={18} className="spinning" />
                    检测中...
                  </>
                ) : (
                  <>🛡️ 运行全量安全检测</>
                )}
              </button>

              <div style={styles.runOptions}>
                <div style={styles.selectGroup}>
                  <label style={styles.selectLabel}>检测分类</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    disabled={running}
                    style={styles.select}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(running || progress.total > 0) && (
                <div style={styles.progressArea}>
                  <div style={styles.progressHeader}>
                    <span style={styles.progressText}>
                      进度: {progress.current}/{progress.total}
                    </span>
                    {totalDuration > 0 && (
                      <span style={styles.durationText}>
                        总耗时: {(totalDuration / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                  <div style={styles.progressBar}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                        background: running
                          ? 'linear-gradient(90deg, #2563EB, #7C3AED)'
                          : progress.current === progress.total && results.filter(r => r.status === 'pass').length === results.length
                            ? '#16A34A'
                            : '#D97706',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 检测结果展示区 */}
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>
                <CheckCircle size={18} color="#16A34A" />
                检测结果
              </h3>
              <div style={styles.filterGroup}>
                <Filter size={14} color="#94A3B8" />
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setResultFilter(f.value)}
                    style={{
                      ...styles.filterChip,
                      background: resultFilter === f.value ? '#EFF6FF' : '#F8FAFC',
                      color: resultFilter === f.value ? '#2563EB' : '#64748B',
                      borderColor: resultFilter === f.value ? '#2563EB' : '#E2E8F0',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.resultList}>
              {filteredResults.length === 0 ? (
                <div style={styles.emptyState}>
                  <CheckCircle size={40} color="#CBD5E1" />
                  <p>暂无检测结果</p>
                  <p style={{ fontSize: '13px', color: '#94A3B8' }}>点击上方按钮运行安全检测</p>
                </div>
              ) : (
                filteredResults.map((r) => {
                  const isExpanded = expandedRows.has(r.case_id);
                  return (
                    <div key={r.case_id} style={styles.resultRow}>
                      <div style={styles.resultRowInner} onClick={() => toggleRow(r.case_id)}>
                        <div style={styles.resultLeft}>
                          <StatusBadge status={r.status} />
                          <span style={styles.resultName}>{r.name}</span>
                          <CategoryTag category={r.risk_level || ''} />
                        </div>
                        <div style={styles.resultCenter}>
                          <span style={styles.resultCompare}>
                            预期:<strong>{r.expected || '-'}</strong> → 实际:<strong>{r.actual || '-'}</strong>
                          </span>
                        </div>
                        <div style={styles.resultRight}>
                          <RiskBadge level={r.risk_level} />
                          <span style={styles.resultDuration}>{r.duration_ms}ms</span>
                          <button style={styles.expandToggle}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && r.matched_rules && r.matched_rules.length > 0 && (
                        <div style={styles.expandedDetail}>
                          <div style={styles.detailTitle}>匹配规则列表</div>
                          {r.matched_rules.map((rule: any, idx: number) => (
                            <div key={idx} style={styles.ruleItem}>
                              <span style={styles.ruleName}>{rule.rule_name || rule.name || `规则 #${idx + 1}`}</span>
                              <span style={styles.ruleType}>{rule.rule_type || rule.type || '-'}</span>
                              <SeverityMini severity={rule.severity || 'low'} />
                              {rule.detected_pattern && (
                                <code style={styles.rulePattern}>{String(rule.detected_pattern).slice(0, 80)}</code>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* 快速检测面板 */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <Search size={18} color="#7C3AED" />
              快速检测
            </h3>

            <div style={styles.quickPanel}>
              <textarea
                value={quickContent}
                onChange={(e) => setQuickContent(e.target.value)}
                placeholder="输入需要检测的内容..."
                rows={4}
                style={styles.quickTextarea}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleQuickCheck();
                }}
              />
              <div style={styles.quickActions}>
                <button
                  onClick={handleQuickCheck}
                  disabled={quickLoading || !quickContent.trim()}
                  style={{
                    ...styles.quickBtn,
                    opacity: quickLoading || !quickContent.trim() ? 0.5 : 1,
                  }}
                >
                  {quickLoading ? (
                    <><RefreshCw size={14} className="spinning" /> 检测中...</>
                  ) : (
                    <><Play size={14} /> 立即检测</>
                  )}
                </button>
                <span style={styles.quickHint}>Ctrl+Enter 快捷提交</span>
              </div>

              {quickResult && (
                <div style={styles.quickResultBox}>
                  {quickResult.error ? (
                    <div style={{ ...styles.quickResultItem, borderColor: '#FECACA', background: '#FEF2F2' }}>
                      <XCircle size={16} color="#DC2626" />
                      <span style={{ color: '#DC2626' }}>{quickResult.error}</span>
                    </div>
                  ) : (
                    <>
                      <div style={styles.quickResultItem}>
                        <span style={styles.quickResultLabel}>风险等级</span>
                        <RiskBadge level={quickResult.risk_level || quickResult.riskLevel || 'safe'} />
                      </div>
                      <div style={styles.quickResultItem}>
                        <span style={styles.quickResultLabel}>是否安全</span>
                        <StatusBadge status={quickResult.is_safe !== false ? 'pass' : 'fail'} />
                      </div>
                      {quickResult.matched_rules && Array.isArray(quickResult.matched_rules) && quickResult.matched_rules.length > 0 && (
                        <div style={styles.quickResultItem}>
                          <span style={styles.quickResultLabel}>匹配规则</span>
                          <div style={styles.matchedRulesList}>
                            {quickResult.matched_rules.map((rule: any, idx: number) => (
                              <div key={idx} style={styles.matchedRuleItem}>
                                <AlertTriangle size={12} color="#D97706" />
                                <span>{rule.rule_name || rule.name || `规则${idx + 1}`}</span>
                                <SeverityMini severity={rule.severity || 'medium'} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {quickResult.warning_message && (
                        <div style={{ ...styles.quickResultItem, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                          <span style={styles.quickResultLabel}>处理建议</span>
                          <span style={styles.suggestionText}>{quickResult.warning_message}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* 检测报告区 */}
          {report && (
            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>
                  <Download size={18} color="#64748B" />
                  检测报告
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setShowReport(!showReport)}
                    style={styles.toggleBtn}
                  >
                    {showReport ? '收起' : '展开'}
                  </button>
                  <button onClick={handleExportReport} style={styles.exportBtn}>
                    <Download size={14} /> 导出报告
                  </button>
                </div>
              </div>

              {showReport && (
                <div style={styles.reportPanel}>
                  <div style={styles.reportMeta}>
                    <div style={styles.reportMetaItem}>
                      <span style={styles.reportMetaLabel}>生成时间</span>
                      <span>{report.completed_at || new Date().toLocaleString()}</span>
                    </div>
                    <div style={styles.reportMetaItem}>
                      <span style={styles.reportMetaLabel}>总分</span>
                      <span style={{ fontWeight: 700, color: report.score >= 80 ? '#16A34A' : report.score >= 50 ? '#D97706' : '#DC2626' }}>
                        {report.score}/100
                      </span>
                    </div>
                    <div style={styles.reportMetaItem}>
                      <span style={styles.reportMetaLabel}>通过/失败/跳过</span>
                      <span>{report.passed}/{report.failed}/{report.skipped}</span>
                    </div>
                  </div>

                  {report.summary?.by_category && Object.keys(report.summary.by_category).length > 0 && (
                    <div style={styles.categoryScores}>
                      <div style={styles.reportSubTitle}>分类得分</div>
                      {Object.entries(report.summary.by_category).map(([key, val]: [string, any]) => (
                        <div key={key} style={styles.catScoreRow}>
                          <span style={styles.catName}>{CATEGORY_LABEL[key] || key}</span>
                          <div style={styles.catScoreBar}>
                            <div style={{
                              ...styles.catScoreFill,
                              width: `${val.score || val.pass_rate || 0}%`,
                              background: (val.score || val.pass_rate || 0) >= 80 ? '#16A34A' : (val.score || val.pass_rate || 0) >= 50 ? '#D97706' : '#DC2626',
                            }} />
                          </div>
                          <span style={styles.catScoreVal}>{val.score ?? val.pass_rate ?? '-'}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {report.summary?.recommendations && report.summary.recommendations.length > 0 && (
                    <div style={styles.recSection}>
                      <div style={styles.reportSubTitle}>改进建议</div>
                      {report.summary.recommendations.map((rec: string, idx: number) => (
                        <div key={idx} style={styles.recItem}>
                          <span style={styles.recIndex}>{idx + 1}</span>
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* 右侧：漏洞追踪区 */}
        <aside style={styles.rightColumn}>
          <div style={styles.vulnPanel}>
            <div style={styles.vulnHeader}>
              <h3 style={styles.vulnTitle}>
                <AlertTriangle size={18} color="#DC2626" />
                漏洞追踪
              </h3>
              <div style={styles.vulnFilters}>
                {VULN_STATUS_FILTERS.slice(0, 3).map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setVulnFilter(f.value)}
                    style={{
                      ...styles.vulnFilterChip,
                      background: vulnFilter === f.value ? '#FEF2F2' : '#F8FAFC',
                      color: vulnFilter === f.value ? '#DC2626' : '#64748B',
                      borderColor: vulnFilter === f.value ? '#FECACA' : '#E2E8F0',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.vulnList}>
              {filteredVulns.length === 0 ? (
                <div style={{ ...styles.emptyState, padding: '30px 16px' }}>
                  <AlertTriangle size={32} color="#CBD5E1" />
                  <p style={{ fontSize: '13px' }}>暂无漏洞记录</p>
                </div>
              ) : (
                filteredVulns.map((v) => {
                  const sev = SEVERITY_MAP[v.severity] || SEVERITY_MAP.low;
                  return (
                    <div key={v.id} style={styles.vulnCard}>
                      <div style={styles.vulnCardTop}>
                        <span style={{
                          ...styles.sevBadge,
                          color: sev.color,
                          background: sev.bg,
                        }}>
                          {sev.label}
                        </span>
                        <span style={{
                          ...styles.vulnStatusTag,
                          color: v.status === 'open' ? '#DC2626' : v.status === 'fixed' ? '#16A34A' : '#94A3B8',
                          background: v.status === 'open' ? '#FEE2E2' : v.status === 'fixed' ? '#DCFCE7' : '#F1F5F9',
                        }}>
                          {v.status === 'open' ? '待修复' : v.status === 'fixed' ? '已修复' : '已忽略'}
                        </span>
                      </div>
                      <h4 style={styles.vulnCardTitle}>{v.title}</h4>
                      <p style={styles.vulnCardDesc}>{(v.description || '').slice(0, 80)}{v.description && v.description.length > 80 ? '...' : ''}</p>
                      {v.matched_pattern && (
                        <code style={styles.vulnPattern}>{String(v.matched_pattern).slice(0, 60)}</code>
                      )}
                      <div style={styles.vulnCardActions}>
                        {v.status === 'open' && (
                          <>
                            <button
                              onClick={() => handleVulnAction(v.id, 'fix')}
                              style={styles.fixBtn}
                            >
                              <CheckCircle size={12} /> 标记修复
                            </button>
                            <button
                              onClick={() => handleVulnAction(v.id, 'ignore')}
                              style={styles.ignoreBtn}
                            >
                              忽略
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

// ==================== 子组件 ====================

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pass: { label: '通过', color: '#16A34A', bg: '#DCFCE7' },
    fail: { label: '失败', color: '#DC2626', bg: '#FEE2E2' },
    error: { label: '错误', color: '#94A3B8', bg: '#F1F5F9' },
  };
  const s = map[status] || map.error;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 500,
      color: s.color,
      background: s.bg,
    }}>
      {status === 'pass' ? <CheckCircle size={12} /> : status === 'fail' ? <XCircle size={12} /> : <AlertTriangle size={12} />}
      {s.label}
    </span>
  );
}

function CategoryTag({ category }: { category: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      color: '#64748B',
      background: '#F1F5F9',
      border: '1px solid #E2E8F0',
    }}>
      {CATEGORY_LABEL[category] || category}
    </span>
  );
}

function RiskBadge({ level }: { level?: string }) {
  const sev = SEVERITY_MAP[level as keyof typeof SEVERITY_MAP] || SEVERITY_MAP.low;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 600,
      color: sev.color,
      background: sev.bg,
    }}>
      {sev.label}
    </span>
  );
}

function SeverityMini({ severity }: { severity: string }) {
  const sev = SEVERITY_MAP[severity as keyof typeof SEVERITY_MAP] || SEVERITY_MAP.low;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '1px 6px',
      borderRadius: '3px',
      fontSize: '10px',
      fontWeight: 600,
      color: sev.color,
      background: sev.bg,
    }}>
      {sev.label}
    </span>
  );
}

// ==================== 样式定义 ====================

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
    borderRadius: '6px',
    flex: 1,
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

  mainGrid: {
    display: 'flex',
    gap: '20px',
    alignItems: 'flex-start',
  },
  leftColumn: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  rightColumn: {
    width: '340px',
    flexShrink: 0,
  },

  section: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#0F172A',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #E2E8F0',
  },

  runArea: {
    padding: '20px',
  },
  runBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '16px',
    transition: 'opacity 0.2s',
  },
  runOptions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  selectGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  selectLabel: {
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
    background: '#FFFFFF',
    minWidth: '160px',
  },
  progressArea: {
    marginTop: '16px',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  progressText: {
    fontSize: '13px',
    color: '#475569',
    fontWeight: 500,
  },
  durationText: {
    fontSize: '12px',
    color: '#94A3B8',
  },
  progressBar: {
    height: '8px',
    background: '#E2E8F0',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },

  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  filterChip: {
    padding: '4px 12px',
    border: '1px solid',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    background: '#FFFFFF',
    transition: 'all 0.15s',
  },

  resultList: {
    maxHeight: '480px',
    overflowY: 'auto',
  },
  emptyState: {
    padding: '50px 20px',
    textAlign: 'center',
    color: '#94A3B8',
  },
  resultRow: {
    borderBottom: '1px solid #F1F5F9',
  },
  resultRowInner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 20px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  resultLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  resultName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#0F172A',
    maxWidth: '180px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  resultCenter: {
    flex: 1,
    minWidth: 0,
  },
  resultCompare: {
    fontSize: '12px',
    color: '#64748B',
  },
  resultRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  resultDuration: {
    fontSize: '12px',
    color: '#94A3B8',
    fontFamily: 'monospace',
  },
  expandToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#94A3B8',
    borderRadius: '4px',
  },

  expandedDetail: {
    padding: '12px 20px 16px 56px',
    background: '#F8FAFC',
    borderTop: '1px solid #F1F5F9',
  },
  detailTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748B',
    marginBottom: '8px',
  },
  ruleItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '4px',
    marginBottom: '6px',
    flexWrap: 'wrap',
  },
  ruleName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#334155',
  },
  ruleType: {
    fontSize: '11px',
    color: '#64748B',
    background: '#F1F5F9',
    padding: '1px 6px',
    borderRadius: '3px',
  },
  rulePattern: {
    fontSize: '11px',
    color: '#DC2626',
    background: '#FEF2F2',
    padding: '2px 6px',
    borderRadius: '3px',
    fontFamily: 'monospace',
  },

  quickPanel: {
    padding: '20px',
  },
  quickTextarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    fontSize: '14px',
    lineHeight: 1.6,
    resize: 'vertical',
    outline: 'none',
    color: '#0F172A',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    marginBottom: '12px',
  },
  quickActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  quickBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 18px',
    background: '#7C3AED',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  quickHint: {
    fontSize: '12px',
    color: '#94A3B8',
  },
  quickResultBox: {
    marginTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  quickResultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    fontSize: '13px',
  },
  quickResultLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#64748B',
    minWidth: '70px',
  },
  matchedRulesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '100%',
  },
  matchedRuleItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    background: '#FFFBEB',
    border: '1px solid #FDE68A',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#92400E',
  },
  suggestionText: {
    fontSize: '13px',
    color: '#475569',
    lineHeight: 1.6,
  },

  toggleBtn: {
    padding: '5px 12px',
    border: '1px solid #E2E8F0',
    borderRadius: '4px',
    background: '#FFFFFF',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#64748B',
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 12px',
    background: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  reportPanel: {
    padding: '20px',
  },
  reportMeta: {
    display: 'flex',
    gap: '24px',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid #E2E8F0',
  },
  reportMetaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  reportMetaLabel: {
    fontSize: '12px',
    color: '#94A3B8',
  },
  categoryScores: {
    marginBottom: '20px',
  },
  reportSubTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#0F172A',
    marginBottom: '12px',
  },
  catScoreRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  catName: {
    fontSize: '13px',
    color: '#475569',
    width: '90px',
    flexShrink: 0,
  },
  catScoreBar: {
    flex: 1,
    height: '6px',
    background: '#E2E8F0',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  catScoreFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s',
  },
  catScoreVal: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#334155',
    width: '40px',
    textAlign: 'right',
  },
  recSection: {},
  recItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '8px 0',
    fontSize: '13px',
    color: '#475569',
    lineHeight: 1.6,
    borderBottom: '1px solid #F1F5F9',
  },
  recIndex: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#EFF6FF',
    color: '#2563EB',
    fontSize: '11px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  vulnPanel: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    overflow: 'hidden',
    position: 'sticky' as const,
    top: '24px',
  },
  vulnHeader: {
    padding: '16px',
    borderBottom: '1px solid #E2E8F0',
  },
  vulnTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#0F172A',
    margin: '0 0 12px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  vulnFilters: {
    display: 'flex',
    gap: '6px',
  },
  vulnFilterChip: {
    padding: '4px 10px',
    border: '1px solid',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  vulnList: {
    maxHeight: 'calc(100vh - 280px)',
    overflowY: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  vulnCard: {
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    padding: '14px',
    transition: 'border-color 0.15s',
  },
  vulnCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  sevBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
  },
  vulnStatusTag: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
  },
  vulnCardTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#0F172A',
    margin: '0 0 6px 0',
  },
  vulnCardDesc: {
    fontSize: '12px',
    color: '#64748B',
    margin: '0 0 8px 0',
    lineHeight: 1.5,
  },
  vulnPattern: {
    display: 'block',
    fontSize: '11px',
    color: '#DC2626',
    background: '#FEF2F2',
    padding: '4px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    marginBottom: '10px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  vulnCardActions: {
    display: 'flex',
    gap: '8px',
  },
  fixBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 12px',
    background: '#16A34A',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  ignoreBtn: {
    padding: '5px 12px',
    border: '1px solid #E2E8F0',
    borderRadius: '4px',
    background: '#FFFFFF',
    fontSize: '12px',
    cursor: 'pointer',
    color: '#64748B',
  },
};

export default SecurityTest;

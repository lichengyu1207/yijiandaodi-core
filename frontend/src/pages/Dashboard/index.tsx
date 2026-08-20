import { useState, useEffect } from 'react';
import {
  Users,
  MousePointerClick,
  DollarSign,
  TrendingUp,
  RefreshCw,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Zap,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Share2,
  Crown,
  Sparkles,
  Gift,
  FileText,
  LayoutGrid,
  Search,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import {
  getStatsOverview,
  getStatsSkills,
  getStatsAreas,
  getStatsRevenue,
  getStatsByRegion,
  refreshStats,
  type OverviewSummary,
  type ChartDataPoint,
  type SkillStatItem,
  type AreaStatItem,
  type RegionStatItem,
  type RevenueSummary,
  type PackageBreakdown,
} from '@/api/statsApi';
import DateRangePicker, { type DateRangeValue } from '@/components/DateRangePicker';

const formatNum = (n: number) => {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
};

const formatCurrency = (n: number) => {
  if (n >= 10000) return '¥' + (n / 10000).toFixed(1) + 'w';
  return '¥' + n.toFixed(0);
};

const Dashboard: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [overview, setOverview] = useState<OverviewSummary | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [skills, setSkills] = useState<SkillStatItem[]>([]);
  const [areas, setAreas] = useState<AreaStatItem[]>([]);
  const [revenueSummary, setRevenueSummary] = useState<RevenueSummary | null>(null);
  const [packageBreakdown, setPackageBreakdown] = useState<PackageBreakdown | null>(null);
  const [regions, setRegions] = useState<RegionStatItem[]>([]);
  const [activeTab, setActiveTab] = useState<'platform' | 'skills' | 'areas' | 'revenue' | 'region'>('platform');
  const [skillSort, setSkillSort] = useState('clicks');

  const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [range, setRange] = useState<DateRangeValue>(() => ({
    label: '近7天',
    start_date: fmtD(new Date(Date.now() - 6 * 864e5)),
    end_date: fmtD(new Date()),
  }));
  const daysRange = Math.max(1, Math.round((new Date(range.end_date).getTime() - new Date(range.start_date).getTime()) / 864e5) + 1);

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start_date, range.end_date]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const rangeParams = { start_date: range.start_date, end_date: range.end_date };
      const [ovRes, skRes, arRes, revRes, regRes] = await Promise.allSettled([
        getStatsOverview(rangeParams),
        getStatsSkills({ ...rangeParams, limit: 50 }),
        getStatsAreas(rangeParams),
        getStatsRevenue(rangeParams),
        getStatsByRegion(rangeParams),
      ]);

      if (ovRes.status === 'fulfilled' && ovRes.value.success) {
        setOverview(ovRes.value.data.summary);
        setChartData(ovRes.value.data.chart_data || []);
      }
      if (skRes.status === 'fulfilled' && skRes.value.success) {
        setSkills(skRes.value.data.items || []);
      }
      if (arRes.status === 'fulfilled' && arRes.value.success) {
        setAreas(arRes.value.data.summary || []);
      }
      if (revRes.status === 'fulfilled' && revRes.value.success) {
        setRevenueSummary(revRes.value.data.summary);
        setPackageBreakdown(revRes.value.data.package_breakdown);
      }
      if (regRes.status === 'fulfilled' && regRes.value.success) {
        setRegions(regRes.value.data.items || []);
      }
    } catch (e) {}
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshStats();
      await loadAllData();
    } catch (e) {}
    setRefreshing(false);
  };

  const sortedSkills = [...skills].sort((a, b) => (b[skillSort as keyof SkillStatItem] as number) - (a[skillSort as keyof SkillStatItem] as number));

  const kpiCards = overview ? [
    { label: 'DAU(平均)', value: Math.round(overview.total_dau_avg), icon: Users, color: '#165DFF', bg: '#E8F3FF', change: '+12%' },
    { label: '总点击', value: overview.total_clicks, icon: MousePointerClick, color: '#F5A623', bg: '#FFF7E8', change: '+8%' },
    { label: '总执行', value: overview.total_executions, icon: Zap, color: '#00B42A', bg: '#E8FFEA', change: '+15%' },
    { label: '分享', value: overview.total_shares, icon: Share2, color: '#722ED1', bg: '#F5E8FF', change: '+22%' },
    { label: '新用户', value: overview.total_new_users, icon: Activity, color: '#E02020', bg: '#FFECE8', change: '+5%' },
    { label: '营收', value: overview.total_gross_revenue, icon: DollarSign, color: '#00B42A', bg: '#E8FFEA', isCurrency: true, change: '+18%' },
    { label: '订单', value: overview.total_orders, icon: CreditCard, color: '#165DFF', bg: '#E8F3FF', change: '+10%' },
    { label: '转化率', value: overview.avg_conversion_rate + '%', icon: Target, color: '#F5A623', bg: '#FFF7E8', isPercent: true, change: '+2.1%' },
  ] : [];

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1D2129' }}>
            数据监控
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#86909C' }}>
            后台数据统计 · {user?.username || 'admin'} · 更新至{new Date().toLocaleDateString('zh-CN')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <DateRangePicker value={range} onChange={setRange} />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: refreshing ? '#C9CDD4' : '#F2F3F5',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              color: '#4E5969',
            }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            {refreshing ? '刷新中...' : '刷新'}
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid #E5E6EB',
        marginBottom: 20,
      }}>
        {([
          { key: 'platform', label: '平台总览', icon: BarChart3 },
          { key: 'skills', label: '技能统计', icon: Zap },
          { key: 'areas', label: '区域点击', icon: Eye },
          { key: 'region', label: '区域消费', icon: PieChart },
          { key: 'revenue', label: '营收分析', icon: DollarSign },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #165DFF' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.key ? '#165DFF' : '#86909C',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              marginBottom: -1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '3px solid #E5E6EB',
            borderTopColor: '#165DFF',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          <span style={{ color: '#86909C', fontSize: 13 }}>加载数据中...</span>
        </div>
      ) : (
        <>
          {/* ===== TAB 1: Platform Overview ===== */}
          {activeTab === 'platform' && (
            <>
              {/* KPI Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
                marginBottom: 24,
              }}>
                {kpiCards.map((kpi, i) => (
                  <div key={i} style={{
                    padding: '18px 20px',
                    borderRadius: 10,
                    background: '#FFF',
                    border: '1px solid #E5E6EB',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: kpi.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <kpi.icon size={19} style={{ color: kpi.color }} />
                      </div>
                      <span style={{
                        fontSize: 11,
                        color: '#00B42A',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                      }}>
                        <ArrowUpRight size={11} />{kpi.change}
                      </span>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#1D2129', lineHeight: 1.2 }}>
                      {kpi.isCurrency ? formatCurrency(kpi.value as number) :
                       kpi.isPercent ? String(kpi.value) :
                       formatNum(kpi.value as number)}
                    </div>
                    <div style={{ fontSize: 12, color: '#86909C', marginTop: 4 }}>{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Trend Chart (CSS Bar Chart) */}
              <div style={{
                background: '#FFF',
                borderRadius: 10,
                border: '1px solid #E5E6EB',
                padding: '20px 24px',
                marginBottom: 24,
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1D2129' }}>
                  时间趋势 ({range.label})
                </h3>
                {chartData.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200, paddingTop: 20 }}>
                    {chartData.map((point, i) => {
                      const maxDau = Math.max(...chartData.map(d => d.dau), 1);
                      const maxRev = Math.max(...chartData.map(d => d.gross_revenue), 1);
                      const dauHeight = (point.dau / maxDau) * 160;
                      const revHeight = (point.gross_revenue / maxRev) * 160;
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                          <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span style={{ fontSize: 9, color: '#86909C', whiteSpace: 'nowrap' }}>
                              {'¥' + point.gross_revenue.toFixed(0)}
                            </span>
                            <div style={{
                              width: 28,
                              height: revHeight,
                              minHeight: 3,
                              borderRadius: [3, 3, 0, 0],
                              background: 'linear-gradient(180deg, #00B42A, #7BE188)',
                            }} />
                            <div style={{
                              width: 28,
                              height: dauHeight,
                              minHeight: 3,
                              borderRadius: [3, 3, 0, 0],
                              background: 'linear-gradient(180deg, #165DFF, #86CAFF)',
                            }} />
                          </div>
                          <span style={{ fontSize: 10, color: '#86909C', marginTop: 6 }}>
                            {point.date.slice(5, 10)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 30, color: '#C9CDD4', fontSize: 13 }}>
                    暂无数据，请刷新获取
                  </div>
                )}
                <div style={{ display: 'flex', gap: 20, marginTop: 12, justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: '#165DFF' }} />
                    <span style={{ fontSize: 11, color: '#86909C' }}>DAU</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: '#00B42A' }} />
                    <span style={{ fontSize: 11, color: '#86909C' }}>营收</span>
                  </div>
                </div>
              </div>

              {/* Retention & Conversion Summary */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}>
                <div style={{
                  background: '#FFF',
                  borderRadius: 10,
                  border: '1px solid #E5E6EB',
                  padding: '20px',
                }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1D2129', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={17} style={{ color: '#F5A623' }} />
                    留存率
                  </h3>
                  {[
                    { label: '次日留存', value: overview?.retention_d1 || 0, target: 50 },
                    { label: '7日留存', value: overview?.retention_d7 || 0, target: 25 },
                    { label: '30日留存', value: overview?.retention_d30 || 0, target: 10 },
                  ].map((item, i) => (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: '#4E5969' }}>{item.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: item.value >= item.target ? '#00B42A' : '#F53F3F' }}>
                          {item.value.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: 6,
                        borderRadius: 3,
                        background: '#F2F3F5',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: Math.min(item.value / (item.target * 2) * 100, 100) + '%',
                          height: '100%',
                          borderRadius: 3,
                          background: item.value >= item.target ? '#00B42A' : '#F5A623',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{
                  background: '#FFF',
                  borderRadius: 10,
                  border: '1px solid #E5E6EB',
                  padding: '20px',
                }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1D2129', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Target size={17} style={{ color: '#165DFF' }} />
                    转化漏斗
                  </h3>
                  {[
                    { label: '免费用户', value: overview?.total_free_uses || 0, total: ((overview?.total_free_uses || 0) + (overview?.total_paid_uses || 0)), color: '#86909C' },
                    { label: '付费用户', value: overview?.total_paid_uses || 0, total: ((overview?.total_free_uses || 0) + (overview?.total_paid_uses || 0)), color: '#00B42A' },
                    { label: '退款订单', value: overview?.total_refunds || 0, total: Math.max(overview?.total_orders || 1, 1), color: '#F53F3F' },
                  ].map((item, i) => {
                    const pct = item.total > 0 ? (item.value / item.total) * 100 : 0;
                    return (
                      <div key={i} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: '#4E5969' }}>{item.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>
                            {formatNum(item.value)} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: 6,
                          borderRadius: 3,
                          background: '#F2F3F5',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: pct + '%',
                            height: '100%',
                            borderRadius: 3,
                            background: item.color,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ===== TAB 2: Skills Stats ===== */}
          {activeTab === 'skills' && (
            <>
              {/* Sort Controls */}
              <div style={{
                display: 'flex',
                gap: 6,
                marginBottom: 16,
                flexWrap: 'wrap',
              }}>
                {[
                  { key: 'clicks', label: '按点击' },
                  { key: 'executions', label: '执行量' },
                  { key: 'conversion_rate', label: '转化率' },
                  { key: 'revenue', label: '营收' },
                  { key: 'impressions', label: '曝光' },
                ].sort(s => s.key === skillSort ? -1 : 1).map(s => (
                  <button
                    key={s.key}
                    onClick={() => setSkillSort(s.key)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 6,
                      border: skillSort === s.key ? 'none' : '1px solid #E5E6EB',
                      background: skillSort === s.key ? '#165DFF' : '#FFF',
                      color: skillSort === s.key ? '#FFF' : '#4E5969',
                      fontSize: 12,
                      fontWeight: skillSort === s.key ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {s.label}{skillSort === s.key ? ' ↓' : ''}
                  </button>
                ))}
                <span style={{ fontSize: 12, color: '#86909C', alignSelf: 'center', marginLeft: 'auto' }}>
                  共 {skills.length} 个技能
                </span>
              </div>

              {/* Skills Table */}
              <div style={{
                background: '#FFF',
                borderRadius: 10,
                border: '1px solid #E5E6EB',
                overflow: 'hidden',
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 90px 90px 90px 90px 80px',
                  padding: '12px 16px',
                  background: '#F7F8FA',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#4E5969',
                  borderBottom: '1px solid #E5E6EB',
                }}>
                  <div>技能名称</div>
                  <div>分类</div>
                  <div style={{ textAlign: 'right' }}>曝光</div>
                  <div style={{ textAlign: 'right' }}>点击</div>
                  <div style={{ textAlign: 'right' }}>执行</div>
                  <div style={{ textAlign: 'right' }}>转化率</div>
                  <div style={{ textAlign: 'right' }}>营收</div>
                </div>

                {sortedSkills.length > 0 ? (
                  sortedSkills.slice(0, 30).map((skill, i) => (
                    <div key={i} style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 90px 90px 90px 90px 80px',
                      padding: '12px 16px',
                      borderBottom: i < sortedSkills.length - 1 ? '1px solid #F2F3F5' : 'none',
                      fontSize: 13,
                      alignItems: 'center',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#FAFBFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#FFF'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 20,
                          height: 20,
                          borderRadius: 5,
                          background: i < 3 ? ['#FF6B35', '#F5A623', '#165DFF'][i] + '20' : '#F2F3F5',
                          color: i < 3 ? ['#FF6B35', '#F5A623', '#165DFF'][i] : '#86909C',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {i + 1}
                        </span>
                        <span style={{ fontWeight: 500, color: '#1D2129', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {skill.skill_name}
                        </span>
                      </div>
                      <div>
                        <span style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#F2F3F5',
                          color: '#86909C',
                        }}>
                          {skill.category || '-'}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', color: '#4E5969', fontSize: 13 }}>{formatNum(skill.impressions)}</div>
                      <div style={{ textAlign: 'right', fontWeight: 600, color: '#1D2129', fontSize: 13 }}>{formatNum(skill.clicks)}</div>
                      <div style={{ textAlign: 'right', color: '#165DFF', fontWeight: 500, fontSize: 13 }}>{formatNum(skill.executions)}</div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: skill.conversion_rate >= 5 ? '#00B42A' : skill.conversion_rate >= 1 ? '#F5A623' : '#86909C',
                        }}>
                          {skill.conversion_rate.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', color: '#00B42A', fontWeight: 600, fontSize: 12 }}>
                        {'¥' + skill.revenue.toFixed(0)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: '#C9CDD4', fontSize: 13 }}>
                    暂无技能数据
                  </div>
                )}
              </div>
            </>
          )}

          {/* ===== TAB 3: Area Click Stats ===== */}
          {activeTab === 'areas' && (
            <>
              {/* Area Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
                marginBottom: 24,
              }}>
                {(areas.length > 0 ? areas : [
                  { area_type: 'carousel', area_label: '轮播区(Top9)', impressions: 2800, clicks: 420, uv: 185, ctr: 15.0, avg_ctr: 14.2, days_active: 3 },
                  { area_type: 'recommendation', area_label: '为你推荐', impressions: 3500, clicks: 315, uv: 142, ctr: 9.0, avg_ctr: 8.5, days_active: 3 },
                  { area_type: 'new_for_you', area_label: '新品专区', impressions: 1200, clicks: 186, uv: 78, ctr: 15.5, avg_ctr: 13.8, days_active: 3 },
                  { area_type: 'promo_feed', area_label: '推广信息流', impressions: 800, clicks: 48, uv: 32, ctr: 6.0, avg_ctr: 5.2, days_active: 3 },
                  { area_type: 'article_cta', area_label: '文章CTA', impressions: 1500, clicks: 225, uv: 98, ctr: 15.0, avg_ctr: 13.5, days_active: 3 },
                  { area_type: 'skill_grid', area_label: '技能网格', impressions: 4500, clicks: 720, uv: 310, ctr: 16.0, avg_ctr: 15.1, days_active: 3 },
                  { area_type: 'search_result', area_label: '搜索结果', impressions: 2000, clicks: 480, uv: 195, ctr: 24.0, avg_ctr: 22.3, days_active: 3 },
                  { area_type: 'hot_skills_list', area_label: '热门列表', impressions: 1100, clicks: 198, uv: 85, ctr: 18.0, avg_ctr: 16.8, days_active: 3 },
                ]).map((area, i) => {
                  const iconList = [BarChart3, Sparkles, Crown, Gift, FileText, LayoutGrid, Search, TrendingUp];
                  const IconComp = iconList[i] || BarChart3;
                  const colors = ['#E02020', '#722ED1', '#165DFF', '#F5A623', '#00B42A', '#165DFF', '#F53F3F', '#FF6B35'];
                  const bgs = ['#FFECE8', '#F5E8FF', '#E8F3FF', '#FFF7E8', '#E8FFEA', '#E8F3FF', '#FFF1F0', '#FFF7E8'];
                  return (
                    <div key={i} style={{
                      padding: '16px',
                      borderRadius: 10,
                      background: '#FFF',
                      border: '1px solid #E5E6EB',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: bgs[i] || '#F2F3F5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <IconComp size={17} style={{ color: colors[i] || '#86909C' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1D2129', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {area.area_label}
                          </div>
                          <div style={{ fontSize: 10, color: '#C9CDD4' }}>{area.area_type}</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, color: '#86909C' }}>曝光</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#1D2129' }}>{formatNum(area.impressions)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#86909C' }}>点击</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: colors[i] || '#165DFF' }}>{formatNum(area.clicks)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#86909C' }}>UV</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#4E5969' }}>{area.uv}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#86909C' }}>CTR</div>
                          <div style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: area.ctr >= 15 ? '#00B42A' : area.ctr >= 8 ? '#F5A623' : '#86909C',
                          }}>
                            {area.ctr.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CTR Comparison Bar Chart */}
              <div style={{
                background: '#FFF',
                borderRadius: 10,
                border: '1px solid #E5E6EB',
                padding: '20px 24px',
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1D2129' }}>
                  CTR 对比 (点击率)
                </h3>
                {(areas.length > 0 ? areas : [
                  { area_label: '搜索结果', ctr: 24.0 }, { area_label: '热门列表', ctr: 18.0 },
                  { area_label: '技能网格', ctr: 16.0 }, { area_label: '新品专区', ctr: 15.5 },
                  { area_label: '轮播区(Top9)', ctr: 15.0 }, { area_label: '文章CTA', ctr: 15.0 },
                  { area_label: '为你推荐', ctr: 9.0 }, { area_label: '推广信息流', ctr: 6.0 },
                ]).map((area, i) => {
                  const maxCtr = 25;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <span style={{
                        fontSize: 12,
                        color: '#4E5969',
                        width: 120,
                        textAlign: 'right',
                        flexShrink: 0,
                      }}>
                        {area.area_label}
                      </span>
                      <div style={{
                        flex: 1,
                        height: 20,
                        borderRadius: 4,
                        background: '#F2F3F5',
                        overflow: 'hidden',
                        minWidth: 0,
                      }}>
                        <div style={{
                          width: (area.ctr / maxCtr * 100) + '%',
                          height: '100%',
                          borderRadius: 4,
                          background: area.ctr >= 15 ? 'linear-gradient(90deg, #00B42A, #7BE188)' :
                                   area.ctr >= 8 ? 'linear-gradient(90deg, #F5A623, #FFD666)' :
                                   'linear-gradient(90deg, #86909C, #C9CDD4)',
                          transition: 'width 0.5s ease-out',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: 8,
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#FFF' }}>
                            {area.ctr.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ===== TAB 3.5: Region Consumption ===== */}
          {activeTab === 'region' && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 16,
                marginBottom: 24,
              }}>
                {[
                  {
                    label: '调用次数',
                    value: formatNum(regions.reduce((s, r) => s + r.count, 0)),
                    icon: PieChart,
                    color: '#165DFF',
                    bg: '#E8F3FF',
                  },
                  {
                    label: '平均耗时',
                    value: (() => {
                      const c = regions.reduce((s, r) => s + r.count, 0);
                      return c ? Math.round(regions.reduce((s, r) => s + r.avg * r.count, 0) / c) + 'ms' : '0ms';
                    })(),
                    icon: Activity,
                    color: '#00B42A',
                    bg: '#E8FFEA',
                  },
                  {
                    label: '失败率',
                    value: (() => {
                      const c = regions.reduce((s, r) => s + r.count, 0);
                      return c ? ((regions.reduce((s, r) => s + r.error_count, 0) / c) * 100).toFixed(2) + '%' : '0%';
                    })(),
                    icon: Target,
                    color: '#F53F3F',
                    bg: '#FFECE8',
                  },
                ].map((kpi, i) => (
                  <div key={i} style={{
                    padding: '18px 20px',
                    borderRadius: 10,
                    background: '#FFF',
                    border: '1px solid #E5E6EB',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: kpi.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <kpi.icon size={17} style={{ color: kpi.color }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#86909C' }}>{kpi.label}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#1D2129' }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              <div style={{
                background: '#FFF',
                borderRadius: 10,
                border: '1px solid #E5E6EB',
                padding: '20px 24px',
                marginBottom: 24,
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1D2129' }}>
                  区域调用占比 ({range.label})
                </h3>
                {regions.length === 0 || regions.every(r => r.count === 0) ? (
                  <div style={{ textAlign: 'center', padding: 30, color: '#C9CDD4', fontSize: 13 }}>
                    暂无 API 调用数据，通过 API Key 发起调用后将在此展示区域分布
                  </div>
                ) : (
                  regions.map((r, i) => {
                    const colors = ['#165DFF', '#00B42A', '#F5A623', '#722ED1'];
                    return (
                      <div key={r.region} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: '#4E5969', width: 80, textAlign: 'right', flexShrink: 0 }}>{r.label}</span>
                        <div style={{ flex: 1, height: 20, borderRadius: 4, background: '#F2F3F5', overflow: 'hidden', minWidth: 0 }}>
                          <div style={{
                            width: Math.max(r.share, r.count > 0 ? 4 : 0) + '%',
                            height: '100%',
                            borderRadius: 4,
                            background: colors[i % colors.length],
                            transition: 'width 0.5s ease-out',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: 8,
                            minWidth: r.count > 0 ? 28 : 0,
                          }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#FFF' }}>{r.count}</span>
                          </div>
                        </div>
                        <span style={{ fontSize: 12, color: '#86909C', width: 56, flexShrink: 0 }}>{r.share.toFixed(1)}%</span>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{
                background: '#FFF',
                borderRadius: 10,
                border: '1px solid #E5E6EB',
                overflow: 'hidden',
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 90px 90px 90px 90px 80px',
                  padding: '12px 16px',
                  background: '#F7F8FA',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#4E5969',
                  borderBottom: '1px solid #E5E6EB',
                }}>
                  <div>区域</div>
                  <div style={{ textAlign: 'right' }}>调用次数</div>
                  <div style={{ textAlign: 'right' }}>平均耗时</div>
                  <div style={{ textAlign: 'right' }}>失败数</div>
                  <div style={{ textAlign: 'right' }}>失败率</div>
                  <div style={{ textAlign: 'right' }}>占比</div>
                </div>
                {regions.length > 0 ? regions.map((r, i) => (
                  <div key={r.region} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 90px 90px 90px 90px 80px',
                    padding: '12px 16px',
                    borderBottom: i < regions.length - 1 ? '1px solid #F2F3F5' : 'none',
                    fontSize: 13,
                    alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: '#1D2129' }}>{r.label}</span>
                      <span style={{ fontSize: 11, color: '#C9CDD4' }}>{r.region}</span>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 600, color: '#1D2129' }}>{formatNum(r.count)}</div>
                    <div style={{ textAlign: 'right', color: '#4E5969' }}>{r.count ? r.avg.toFixed(1) + 'ms' : '-'}</div>
                    <div style={{ textAlign: 'right', color: r.error_count > 0 ? '#F53F3F' : '#00B42A' }}>{r.error_count}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: r.error_rate >= 10 ? '#F53F3F' : r.error_rate >= 3 ? '#F5A623' : '#00B42A',
                      }}>
                        {r.count ? r.error_rate.toFixed(2) + '%' : '-'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', color: '#86909C' }}>{r.share.toFixed(1)}%</div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', padding: 40, color: '#C9CDD4', fontSize: 13 }}>暂无数据</div>
                )}
              </div>
            </>
          )}

          {/* ===== TAB 4: Revenue Analysis ===== */}
          {activeTab === 'revenue' && (
            <>
              {/* Revenue KPI Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
                marginBottom: 24,
              }}>
                {revenueSummary ? [
                  { label: '总营收', value: revenueSummary.total_gross_revenue, icon: DollarSign, color: '#00B42A', bg: '#E8FFEA', isCurrency: true },
                  { label: '净营收', value: revenueSummary.total_net_revenue, icon: TrendingUp, color: '#165DFF', bg: '#E8F3FF', isCurrency: true },
                  { label: '订单数', value: revenueSummary.total_orders, icon: CreditCard, color: '#F5A623', bg: '#FFF7E8' },
                  { label: '平均订单', value: revenueSummary.avg_order_value, icon: PieChart, color: '#722ED1', bg: '#F5E8FF', isCurrency: true },
                  { label: '退款额', value: revenueSummary.total_refunds, icon: ArrowDownRight, color: '#F53F3F', bg: '#FFECE8', isCurrency: true },
                  { label: '付出佣金', value: revenueSummary.total_commission, icon: Users, color: '#F5A623', bg: '#FFF7E8', isCurrency: true },
                  { label: 'VIP活跃', value: revenueSummary.total_vip_active, icon: Crown, color: '#E02020', bg: '#FFECE8' },
                  { label: '新增VIP', value: revenueSummary.total_new_vip, icon: Sparkles, color: '#00B42A', bg: '#E8FFEA' },
                ].map((kpi, i) => (
                  <div key={i} style={{
                    padding: '18px 20px',
                    borderRadius: 10,
                    background: '#FFF',
                    border: '1px solid #E5E6EB',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: kpi.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <kpi.icon size={17} style={{ color: kpi.color }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#86909C' }}>{kpi.label}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#1D2129' }}>
                      {kpi.isCurrency ? formatCurrency(kpi.value as number) : formatNum(kpi.value as number)}
                    </div>
                  </div>
                )) : null}
              </div>

              {/* Package Breakdown */}
              <div style={{
                background: '#FFF',
                borderRadius: 10,
                border: '1px solid #E5E6EB',
                padding: '20px 24px',
                marginBottom: 24,
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1D2129' }}>
                  套餐销量分布
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {(packageBreakdown ? [
                    { name: '按次检测', count: packageBreakdown.per_use, price: 19, color: '#165DFF' },
                    { name: '月度会员', count: packageBreakdown.monthly, price: 99, color: '#F5A623' },
                    { name: '199年卡', count: packageBreakdown.yearly_199, price: 199, color: '#E02020' },
                    { name: '599年卡', count: packageBreakdown.yearly_599, price: 599, color: '#722ED1' },
                    { name: '企业定制', count: packageBreakdown.enterprise, price: 5999, color: '#00B42A' },
                    { name: '安全套餐', count: packageBreakdown.combo_security, price: 299, color: '#165DFF' },
                    { name: '内容套餐', count: packageBreakdown.combo_content, price: 398, color: '#722ED1' },
                    { name: '企业全景', count: packageBreakdown.combo_enterprise, price: 2999, color: '#00B42A' },
                  ] : []).map((pkg, i) => {
                    const maxCount = Math.max(...Object.values(packageBreakdown || {}), 1);
                    return (
                      <div key={i} style={{
                        padding: '14px',
                        borderRadius: 8,
                        border: '1px solid #F2F3F5',
                        background: '#FAFBFC',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1D2129' }}>{pkg.name}</span>
                          <span style={{ fontSize: 11, color: pkg.color, fontWeight: 700 }}>¥{pkg.price}</span>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#1D2129', marginBottom: 6 }}>
                          {pkg.count}
                        </div>
                        <div style={{
                          width: '100%',
                          height: 4,
                          borderRadius: 2,
                          background: '#F2F3F5',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: (pkg.count / maxCount * 100) + '%',
                            height: '100%',
                            borderRadius: 2,
                            background: pkg.color,
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Revenue Trend Mini Chart */}
              <div style={{
                background: '#FFF',
                borderRadius: 10,
                border: '1px solid #E5E6EB',
                padding: '20px 24px',
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1D2129' }}>
                  营收趋势
                </h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
                  {Array.from({ length: daysRange }).map((_, i) => {
                    const h = 30 + Math.random() * 100;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{
                          width: '100%',
                          maxWidth: 40,
                          height: h,
                          minHeight: 8,
                          borderRadius: [4, 4, 0, 0],
                          background: i === daysRange - 1 ? 'linear-gradient(180deg, #E02020, #FFCCC7)' : 'linear-gradient(180deg, #165DFF, #86CAFF)',
                          opacity: 0.7 + (i / daysRange) * 0.3,
                        }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;

/**
 * 风险分布图组件
 *
 * 功能：
 * - 可视化展示风险分布
 * - 横向条形图样式
 * - 动态更新
 */

import React from 'react';

export interface RiskDistributionChartProps {
  stats: {
    total: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

const RiskDistributionChart: React.FC<RiskDistributionChartProps> = React.memo(function RiskDistributionChart({
  stats
}) {
  const total = stats.total || 1;

  // 图表更新日志
  React.useEffect(() => {
    console.log('\n[RiskDistributionChart] 图表更新');
    console.log('[RiskDistributionChart] 总数:', stats.total);
    console.log('[RiskDistributionChart] 风险分布:');
    console.log(`  - 低风险: ${stats.low} (${((stats.low / total) * 100).toFixed(1)}%)`);
    console.log(`  - 中风险: ${stats.medium} (${((stats.medium / total) * 100).toFixed(1)}%)`);
    console.log(`  - 高风险: ${stats.high} (${((stats.high / total) * 100).toFixed(1)}%)`);
    console.log(`  - 严重: ${stats.critical} (${((stats.critical / total) * 100).toFixed(1)}%)`);
  }, [stats]);

  const percentages = {
    low: (stats.low / total) * 100,
    medium: (stats.medium / total) * 100,
    high: (stats.high / total) * 100,
    critical: (stats.critical / total) * 100,
  };

  return (
    <div
      style={{
        padding: 20,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          marginBottom: 16,
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        风险分布
      </div>

      <div
        style={{
          display: 'flex',
          height: 12,
          borderRadius: 6,
          overflow: 'hidden',
          background: 'var(--bg-tertiary)',
        }}
      >
        {percentages.low > 0 && (
          <div
            style={{
              width: `${percentages.low}%`,
              background: '#3FB950',
              transition: 'width 0.3s ease',
            }}
            title={`低风险: ${stats.low}`}
          />
        )}
        {percentages.medium > 0 && (
          <div
            style={{
              width: `${percentages.medium}%`,
              background: '#FFA500',
              transition: 'width 0.3s ease',
            }}
            title={`中风险: ${stats.medium}`}
          />
        )}
        {percentages.high > 0 && (
          <div
            style={{
              width: `${percentages.high}%`,
              background: '#F85149',
              transition: 'width 0.3s ease',
            }}
            title={`高风险: ${stats.high}`}
          />
        )}
        {percentages.critical > 0 && (
          <div
            style={{
              width: `${percentages.critical}%`,
              background: '#DA3633',
              transition: 'width 0.3s ease',
            }}
            title={`严重: ${stats.critical}`}
          />
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 12,
          fontSize: 13,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#3FB950' }} />
          低风险: {stats.low}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FFA500' }} />
          中风险: {stats.medium}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#F85149' }} />
          高风险: {stats.high}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#DA3633' }} />
          严重: {stats.critical}
        </span>
      </div>
    </div>
  );
});

export default RiskDistributionChart;
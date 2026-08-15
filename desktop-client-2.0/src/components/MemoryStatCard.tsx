/**
 * 短期记忆统计卡片组件
 *
 * 功能：
 * - 显示短期记忆数量
 * - 显示各风险等级数量
 * - 实时同步状态指示器
 */

import React from 'react';

export interface MemoryStatCardProps {
  value: number;
  label: string;
  color?: 'low' | 'medium' | 'high' | 'critical' | 'default';
  syncStatus?: {
    isSyncing: boolean;
    lastSyncTime?: Date;
  };
  onClick?: () => void;
}

const COLOR_MAP = {
  low: '#3FB950',
  medium: '#FFA500',
  high: '#F85149',
  critical: '#DA3633',
  default: '#667eea'
};

const MemoryStatCard: React.FC<MemoryStatCardProps> = React.memo(function MemoryStatCard({
  value,
  label,
  color = 'default',
  syncStatus,
  onClick
}) {
  // 渲染日志
  React.useEffect(() => {
    console.log(`[MemoryStatCard] 渲染: ${label} = ${value} (${color})`);

    if (syncStatus) {
      const syncAge = syncStatus.lastSyncTime
        ? Math.floor((Date.now() - syncStatus.lastSyncTime.getTime()) / 1000)
        : 0;
      console.log(`[MemoryStatCard]   - 同步状态: ${syncStatus.isSyncing ? '同步中' : '已同步'}`);
      console.log(`[MemoryStatCard]   - 上次同步: ${syncAge}秒前`);
    }
  }, [value, label, color, syncStatus]);

  return (
    <div
      className="memory-stat-card"
      onClick={onClick}
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 8,
        padding: 20,
        textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        style={{
          fontSize: 32,
          fontWeight: 600,
          marginBottom: 8,
          color: COLOR_MAP[color],
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </div>

      {/* 同步状态指示器 */}
      {syncStatus && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 12,
            fontSize: 12,
            color: 'var(--text-tertiary)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: syncStatus.isSyncing ? '#667eea' : '#3FB950',
              animation: syncStatus.isSyncing ? 'pulse 1s infinite' : 'none',
            }}
          />
          <span>
            {syncStatus.isSyncing
              ? '同步中...'
              : syncStatus.lastSyncTime
                ? `${Math.floor((Date.now() - syncStatus.lastSyncTime.getTime()) / 1000)}秒前同步`
                : '已同步'}
          </span>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .memory-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
});

export default MemoryStatCard;
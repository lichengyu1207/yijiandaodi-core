import React from 'react';
import { TrendingUp, TrendingDown, Minus, DollarSign, Users, BarChart3, Target } from 'lucide-react';

interface RevenueCardData {
  label: string;
  value: string;
  change: string;
  changeType: 'up' | 'down' | 'neutral';
  icon: string;
  iconBg: string;
  target: string;
  progress: number;
}

interface RevenueOverviewCardsProps {
  data?: RevenueCardData[];
}

const DEFAULT_DATA: RevenueCardData[] = [
  {
    label: '本月营收',
    value: '¥5,678.90',
    change: '+12.5%',
    changeType: 'up',
    icon: 'DollarSign',
    iconBg: '#FFF7E8',
    target: '目标: ¥10,000',
    progress: 56.79,
  },
  {
    label: '付费用户',
    value: '15人',
    change: '+25.0%',
    changeType: 'up',
    icon: 'Users',
    iconBg: '#E8F5FF',
    target: '目标: 50人',
    progress: 30,
  },
  {
    label: '平均客单价',
    value: '¥378.50',
    change: '+5.2%',
    changeType: 'up',
    icon: 'BarChart3',
    iconBg: '#F0FDF4',
    target: '',
    progress: 0,
  },
  {
    label: '转化率',
    value: '12.5%',
    change: '',
    changeType: 'neutral',
    icon: 'Target',
    iconBg: '#FFF1F0',
    target: '行业均值: 3.5%',
    progress: 0,
  },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  DollarSign: <DollarSign size={24} />,
  Users: <Users size={24} />,
  BarChart3: <BarChart3 size={24} />,
  Target: <Target size={24} />,
};

const ICON_COLOR_MAP: Record<string, string> = {
  DollarSign: '#FF7D00',
  Users: '#165DFF',
  BarChart3: '#16A34A',
  Target: '#F53F3F',
};

const STYLES = {
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
    transition: 'all 0.25s ease',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
  },
  valueText: {
    fontSize: 28,
    fontWeight: 800,
    color: '#1D2129',
    marginBottom: 8,
  },
  labelText: {
    fontSize: 14,
    color: '#86909C',
    marginBottom: 12,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressBarOuter: {
    width: '100%',
    height: 6,
    backgroundColor: '#F2F3F5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.6s ease',
  },
  targetText: {
    fontSize: 12,
    color: '#86909C',
  },
};

const RevenueOverviewCards: React.FC<RevenueOverviewCardsProps> = ({
  data = DEFAULT_DATA,
}) => {
  return (
    <div style={STYLES.container}>
      {data.map((card, index) => (
        <div
          key={card.label}
          style={{
            ...STYLES.card,
            transform: 'translateY(0)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)';
          }}
        >
          <div style={STYLES.cardHeader}>
            <div
              style={{
                ...STYLES.iconWrapper,
                backgroundColor: card.iconBg,
              }}
            >
              {React.cloneElement(
                ICON_MAP[card.icon] as React.ReactElement,
                { color: ICON_COLOR_MAP[card.icon] }
              )}
            </div>
            {card.change && (
              <div
                style={{
                  ...STYLES.changeBadge,
                  backgroundColor:
                    card.changeType === 'up'
                      ? '#F0FDF4'
                      : card.changeType === 'down'
                      ? '#FFF1F0'
                      : '#F7F8FA',
                  color:
                    card.changeType === 'up'
                      ? '#16A34A'
                      : card.changeType === 'down'
                      ? '#F53F3F'
                      : '#86909C',
                }}
              >
                {card.changeType === 'up' && <TrendingUp size={14} />}
                {card.changeType === 'down' && <TrendingDown size={14} />}
                {card.changeType === 'neutral' && <Minus size={14} />}
                {card.change}
              </div>
            )}
          </div>

          <div style={STYLES.valueText}>{card.value}</div>
          <div style={STYLES.labelText}>{card.label}</div>

          {card.progress > 0 && (
            <div style={STYLES.progressContainer}>
              <div style={STYLES.progressLabel}>
                <span style={{ fontSize: 12, color: '#86909C' }}>进度</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#4E5969' }}>
                  {card.progress.toFixed(1)}%
                </span>
              </div>
              <div style={STYLES.progressBarOuter}>
                <div
                  style={{
                    ...STYLES.progressBarInner,
                    width: `${Math.min(card.progress, 100)}%`,
                    background: `linear-gradient(90deg, #165DFF 0%, #0E42D2 100%)`,
                  }}
                />
              </div>
            </div>
          )}

          {card.target && (
            <div style={{ ...STYLES.targetText, marginTop: card.progress > 0 ? 8 : 0 }}>
              {card.target}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default RevenueOverviewCards;

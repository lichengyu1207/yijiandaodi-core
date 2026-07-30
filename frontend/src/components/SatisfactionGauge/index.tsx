import React from 'react';

interface SatisfactionGaugeProps {
  score: number;
  totalFeedbacks: number;
  ratingDistribution?: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

const STYLES = {
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
  },
  scoreSection: {
    textAlign: 'center' as const,
    marginBottom: 28,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 800,
    color: '#1D2129',
    marginBottom: 8,
  },
  scoreSubtitle: {
    fontSize: 14,
    color: '#86909C',
  },
  gaugeContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 32,
  },
  distributionSection: {
    marginTop: 24,
  },
  distributionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1D2129',
    marginBottom: 16,
  },
  distributionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  starLabel: {
    width: 24,
    fontSize: 13,
    color: '#4E5969',
    fontWeight: 500,
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#F2F3F5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.6s ease',
  },
  countLabel: {
    width: 40,
    fontSize: 12,
    color: '#86909C',
    textAlign: 'right' as const,
  },
};

const getScoreColor = (score: number): string => {
  if (score >= 4.5) return '#16A34A';
  if (score >= 3.5) return '#FFB900';
  if (score >= 2.5) return '#FF7D00';
  return '#EF4444';
};

const getBarColor = (rating: number): string => {
  if (rating === 5) return '#16A34A';
  if (rating === 4) return '#65A30D';
  if (rating === 3) return '#FFB900';
  if (rating === 2) return '#FF7D00';
  return '#EF4444';
};

const SemiCircleGauge: React.FC<{ score: number; size?: number }> = ({ score, size = 160 }) => {
  const radius = (size - 20) / 2;
  const circumference = Math.PI * radius;
  const percentage = ((score - 1) / 4) * 100;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColorForOffset = (offset: number): string => {
    const ratio = offset / circumference;
    if (ratio < 0.25) return '#EF4444';
    if (ratio < 0.5) return '#FFB900';
    return '#16A34A';
  };

  return (
    <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
      <defs>
        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#EF4444" />
          <stop offset="50%" stopColor="#FFB900" />
          <stop offset="100%" stopColor="#16A34A" />
        </linearGradient>
      </defs>
      <path
        d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
        fill="none"
        stroke="#F2F3F5"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
        fill="none"
        stroke="url(#gaugeGradient)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  );
};

const SatisfactionGauge: React.FC<SatisfactionGaugeProps> = ({
  score,
  totalFeedbacks,
  ratingDistribution = { 5: 68, 4: 35, 3: 15, 2: 7, 1: 3 },
}) => {
  const total = Object.values(ratingDistribution).reduce((a, b) => a + b, 0) || totalFeedbacks;

  return (
    <div style={STYLES.container}>
      <div style={STYLES.scoreSection}>
        <div style={{ ...STYLES.scoreValue, color: getScoreColor(score) }}>
          {score.toFixed(1)}
        </div>
        <div style={STYLES.scoreSubtitle}>
          基于 {totalFeedbacks} 条用户反馈
        </div>
      </div>

      <div style={STYLES.gaugeContainer}>
        <SemiCircleGauge score={score} />
      </div>

      <div style={STYLES.distributionSection}>
        <div style={STYLES.distributionTitle}>评分分布</div>
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = ratingDistribution[rating as keyof typeof ratingDistribution] || 0;
          const percentage = total > 0 ? (count / total) * 100 : 0;

          return (
            <div key={rating} style={STYLES.distributionRow}>
              <span style={STYLES.starLabel}>{rating} 星</span>
              <div style={STYLES.barContainer}>
                <div
                  style={{
                    ...STYLES.bar,
                    width: `${percentage}%`,
                    backgroundColor: getBarColor(rating),
                  }}
                />
              </div>
              <span style={STYLES.countLabel}>{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SatisfactionGauge;

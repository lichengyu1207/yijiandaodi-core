import React from 'react';
import { TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';

interface RankingItem {
  rank: number;
  name: string;
  price: number;
  sales: number;
  revenue: number;
  trend: 'up' | 'down' | 'same';
}

interface TopProductsRankingProps {
  data?: RankingItem[];
}

const DEFAULT_DATA: RankingItem[] = [
  { rank: 1, name: 'LLM Agent 攻防实战课程', price: 199, sales: 234, revenue: 46566, trend: 'up' },
  { rank: 2, name: 'Agent 安全审计提示词包', price: 9.9, sales: 128, revenue: 1267.2, trend: 'up' },
  { rank: 3, name: 'RAG 向量数据库安全检测工具', price: 49.9, sales: 86, revenue: 4291.4, trend: 'same' },
  { rank: 4, name: '企业合规检查清单模板包', price: 29.9, sales: 67, revenue: 2003.3, trend: 'down' },
  { rank: 5, name: 'Prompt 注入防护实战指南', price: 39.9, sales: 52, revenue: 2074.8, trend: 'up' },
];

const STYLES = {
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 20,
    fontWeight: 700,
    color: '#1D2129',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '60px 2fr 1fr 1fr 1fr 80px',
    gap: 12,
    padding: '12px 16px',
    backgroundColor: '#F7F8FA',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    color: '#86909C',
    marginBottom: 8,
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '60px 2fr 1fr 1fr 1fr 80px',
    gap: 12,
    padding: '16px',
    borderRadius: 8,
    alignItems: 'center',
    transition: 'all 0.25s ease',
    borderBottom: '1px solid #F2F3F5',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
  },
  productName: {
    fontSize: 14,
    fontWeight: 500,
    color: '#1D2129',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  valueText: {
    fontSize: 14,
    color: '#4E5969',
  },
  revenueText: {
    fontSize: 15,
    fontWeight: 600,
    color: '#FF7D00',
  },
  trendIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

const getRankStyle = (rank: number): React.CSSProperties => {
  if (rank === 1) return { ...STYLES.rankBadge, background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#FFF' };
  if (rank === 2) return { ...STYLES.rankBadge, backgroundColor: '#E5E6EB', color: '#4E5969' };
  if (rank === 3) return { ...STYLES.rankBadge, backgroundColor: '#C9A961', color: '#FFF' };
  return { ...STYLES.rankBadge, backgroundColor: '#F7F8FA', color: '#86909C' };
};

const formatCurrency = (value: number): string => {
  if (value >= 10000) return `¥${(value / 10000).toFixed(1)}万`;
  return `¥${value.toFixed(2)}`;
};

const TopProductsRanking: React.FC<TopProductsRankingProps> = ({
  data = DEFAULT_DATA,
}) => {
  return (
    <div style={STYLES.container}>
      <div style={STYLES.header}>
        <div style={STYLES.title}>
          <Trophy size={22} color="#FFB900" />
          热销商品排行
        </div>
      </div>

      <div style={STYLES.tableHeader}>
        <span>排名</span>
        <span>商品名称</span>
        <span>单价</span>
        <span>销量</span>
        <span>营收</span>
        <span>趋势</span>
      </div>

      {data.map((item) => (
        <div
          key={item.rank}
          style={STYLES.tableRow}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F7F8FA';
            e.currentTarget.style.transform = 'translateX(4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.transform = 'translateX(0)';
          }}
        >
          <div style={getRankStyle(item.rank)}>{item.rank}</div>
          <div style={STYLES.productName} title={item.name}>{item.name}</div>
          <div style={STYLES.valueText}>¥{item.price}</div>
          <div style={STYLES.valueText}>{item.sales}</div>
          <div style={STYLES.revenueText}>{formatCurrency(item.revenue)}</div>
          <div style={STYLES.trendIcon}>
            {item.trend === 'up' && <TrendingUp size={18} color="#16A34A" />}
            {item.trend === 'down' && <TrendingDown size={18} color="#F53F3F" />}
            {item.trend === 'same' && <Minus size={18} color="#86909C" />}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TopProductsRanking;

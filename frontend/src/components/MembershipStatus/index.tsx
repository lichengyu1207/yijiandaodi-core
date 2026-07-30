import React from 'react';
import { Badge, Tooltip } from 'antd';
import { Crown, Coins, Clock } from 'lucide-react';

interface MembershipStatusProps {
  points?: number;
  level?: 'free' | 'basic' | 'premium' | 'enterprise';
  expireDate?: string;
  compact?: boolean;
}

const LEVEL_CONFIG = {
  free: { name: '免费版', color: '#94a3b8', icon: null },
  basic: { name: '基础版', color: '#2563eb', icon: null },
  premium: { name: '专业版', color: '#f59e0b', icon: Crown },
  enterprise: { name: '企业版', color: '#dc2626', icon: Crown },
};

export const MembershipStatus: React.FC<MembershipStatusProps> = ({ 
  points = 0, level = 'free', expireDate, compact = false 
}) => {
  const config = LEVEL_CONFIG[level];
  const LevelIcon = config.icon;

  if (compact) {
    return (
      <Tooltip title={`${config.name} · ${points}积分`}>
        <Badge count={points > 999 ? '999+' : String(points)} size="small" offset={[-4, 4]}>
          {LevelIcon ? <LevelIcon size={18} color={config.color} /> : <Coins size={18} color="#94a3b8" />}
        </Badge>
      </Tooltip>
    );
  }

  return (
    <div className="membership-status">
      <div className="membership-level">
        {LevelIcon ? <LevelIcon size={18} color={config.color} /> : <Coins size={18} color="#94a3b8" />}
        <span style={{ color: config.color }}>{config.name}</span>
      </div>
      <div className="membership-points">
        <Coins size={14} />
        <span>{points} 积分</span>
      </div>
      {expireDate && level !== 'free' && (
        <div className="membership-expire">
          <Clock size={12} />
          <span>到期: {expireDate}</span>
        </div>
      )}
    </div>
  );
};

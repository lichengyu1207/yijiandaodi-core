import React from 'react';
import { Badge, Tooltip } from 'antd';
import { ShieldCheck, EyeOff, Lock } from 'lucide-react';
import type { MaskResult } from '@/utils/dataMask';

interface DataProtectionBadgeProps {
  maskResult: MaskResult | null;
  verified?: boolean;
  compact?: boolean;
}

export const DataProtectionBadge: React.FC<DataProtectionBadgeProps> = ({ maskResult, verified, compact = false }) => {
  if (!maskResult) return null;

  const count = maskResult.maskCount;

  if (compact) {
    return (
      <Tooltip title={`已自动保护 ${count} 条敏感信息`}>
        <Badge count={count} size="small" offset={[0, 0]}>
          <ShieldCheck size={16} color="#16A34A" />
        </Badge>
      </Tooltip>
    );
  }

  return (
    <div className="data-protection-badge">
      <div className="badge-header">
        <ShieldCheck size={16} color="#16A34A" />
        <span>数据安全保障</span>
        {verified !== false && <Lock size={12} color="#94a3b8" />}
      </div>
      <div className="badge-body">
        <EyeOff size={14} />
        <span>已自动保护 <strong>{count}</strong> 条敏感信息</span>
      </div>
      {maskResult.details.length > 0 && (
        <div className="badge-details">
          {Object.entries(
            maskResult.details.reduce((acc, d) => {
              acc[d.type] = (acc[d.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          ).map(([type, num]) => (
            <span key={type} className="badge-detail-item">
              {type}: {num}条
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

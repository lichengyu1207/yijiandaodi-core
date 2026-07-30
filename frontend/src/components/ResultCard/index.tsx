import React, { useState } from 'react';
import { Button, Collapse } from 'antd';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  Download,
  RefreshCw,
  ShieldCheck,
  Clock,
  BarChart3,
} from 'lucide-react';
import type { MaskResult } from '@/utils/dataMask';
import './ResultCard.css';

export type RiskLevel = 'safe' | 'warning' | 'danger' | 'critical';

interface MetricItem {
  label: string;
  value: string | number;
  color?: string;
  trend?: 'up' | 'down' | 'stable';
}

interface SuggestionItem {
  text: string;
  type: 'improvement' | 'warning' | 'info';
}

interface ResultCardProps {
  title?: string;
  riskLevel: RiskLevel;
  metrics: MetricItem[];
  summary?: string;
  suggestions?: SuggestionItem[];
  details?: React.ReactNode;
  onPrimaryAction?: () => void;
  primaryActionText?: string;
  secondaryAction?: () => void;
  secondaryActionText?: string;
  loading?: boolean;
  executionTime?: number;
  showDataProtection?: boolean;
  maskResult?: MaskResult;
  children?: React.ReactNode;
}

const RISK_CONFIG: Record<RiskLevel, { icon: React.ElementType; color: string; bg: string; text: string }> = {
  safe: { icon: CheckCircle2, color: '#16A34A', bg: '#f0fdf4', text: '安全通过' },
  warning: { icon: AlertTriangle, color: '#EA580C', bg: '#fffbeb', text: '存在风险' },
  danger: { icon: XCircle, color: '#DC2626', bg: '#fef2f2', text: '高风险警告' },
  critical: { icon: XCircle, color: '#991B1B', bg: '#450a0a', text: '严重风险' },
};

export const ResultCard: React.FC<ResultCardProps> = ({
  title,
  riskLevel = 'safe',
  metrics,
  summary,
  suggestions,
  details,
  onPrimaryAction,
  primaryActionText = '下载检测报告',
  secondaryAction,
  secondaryActionText = '重新检测',
  loading,
  executionTime,
  showDataProtection,
  maskResult,
  children,
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const config = RISK_CONFIG[riskLevel];
  const Icon = config.icon;

  if (loading) {
    return (
      <div className="result-card result-card-loading">
        <div className="result-loading-spinner" />
        <p>正在分析中...</p>
      </div>
    );
  }

  return (
    <div className={`result-card result-card-${riskLevel}`}>
      <div className="result-banner" style={{ background: config.bg }}>
        <div className="result-banner-icon" style={{ color: config.color }}>
          <Icon size={28} />
        </div>
        <div className="result-banner-text">
          <h2 className="result-banner-title">
            {title || (riskLevel === 'safe' ? '✅ 检测任务已完成' : `${config.text}`)}
          </h2>
          {summary && <p className="result-banner-summary">{summary}</p>}
        </div>
        {executionTime && (
          <div className="result-banner-meta">
            <Clock size={14} />
            <span>耗时 {executionTime}s</span>
          </div>
        )}
      </div>

      {(showDataProtection && maskResult) && (
        <div className="result-protection-bar">
          <ShieldCheck size={14} color="#16A34A" />
          <span>已自动保护 {maskResult.maskCount || 0} 条敏感信息</span>
        </div>
      )}

      {children && <div className="result-custom-area">{children}</div>}

      {metrics.length > 0 && (
        <div className="result-metrics">
          <div className="result-metrics-header">
            <BarChart3 size={16} />
            <span>核心指标</span>
          </div>
          <div className="result-metrics-grid">
            {metrics.map((m, i) => (
              <div key={i} className="metric-item">
                <span className="metric-label">{m.label}</span>
                <span className="metric-value" style={{ color: m.color || '#1e293b' }}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="result-suggestions">
          <div className="result-suggestions-header">改进建议</div>
          {suggestions.map((s, i) => (
            <div key={i} className={`suggestion-item suggestion-${s.type}`}>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="result-actions">
        {onPrimaryAction && (
          <Button type="primary" size="large" icon={<Download />} onClick={onPrimaryAction} block>
            {primaryActionText}
          </Button>
        )}
        {secondaryAction && (
          <Button size="large" icon={<RefreshCw />} onClick={secondaryAction} block style={{ marginTop: 8 }}>
            {secondaryActionText}
          </Button>
        )}
      </div>

      {details && (
        <div className="result-details-wrapper">
          <Collapse
            ghost
            activeKey={detailsOpen ? ['1'] : []}
            onChange={(keys) => setDetailsOpen(keys.includes('1'))}
            items={[{
              key: '1',
              label: (
                <span className="details-toggle">
                  <ChevronDown size={16} style={{
                    transform: detailsOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s'
                  }} />
                  详细分析
                </span>
              ),
              children: <div className="result-details-content">{details}</div>,
            }]}
          />
        </div>
      )}
    </div>
  );
};

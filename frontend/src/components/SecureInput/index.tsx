import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Info,
} from 'lucide-react';
import { checkContentSecurity } from '@/api/securityApi';
import type { SecurityCheckResult } from '@/api/securityApi';

interface SecureInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  disabled?: boolean;
  showWarningInline?: boolean; // 是否在输入框内联显示警告
  sessionId?: string;
  agentRole?: string;
  userId?: number;
  onSecurityCheck?: (result: SecurityCheckResult) => void;
}

const SecureInput: React.FC<SecureInputProps> = ({
  value,
  onChange,
  placeholder = '请输入内容...',
  maxLength = 10000,
  rows = 4,
  disabled = false,
  showWarningInline = true,
  sessionId = '',
  agentRole = '',
  userId = 0,
  onSecurityCheck,
}) => {
  const [checking, setChecking] = useState(false);
  const [lastResult, setLastResult] = useState<SecurityCheckResult | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // 防抖检测（用户停止输入500ms后触发）
  const performSecurityCheck = useCallback(async (content: string) => {
    if (!content || content.trim().length < 10) {
      setLastResult(null);
      return;
    }

    setChecking(true);
    try {
      const res: any = await checkContentSecurity({
        content,
        session_id: sessionId,
        agent_role: agentRole,
        user_id: userId,
      });

      const result = res?.data || res;
      setLastResult(result);

      if (onSecurityCheck) {
        onSecurityCheck(result);
      }
    } catch (error) {
      console.error('安全检测失败:', error);
    } finally {
      setChecking(false);
    }
  }, [sessionId, agentRole, userId, onSecurityCheck]);

  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (value && value.length > 0) {
      const timer = setTimeout(() => {
        performSecurityCheck(value);
      }, 500);
      setDebounceTimer(timer);
    }

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [value, performSecurityCheck]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;

    // 长度限制检查
    if (maxLength && newValue.length > maxLength) {
      return;
    }

    onChange(newValue);
  };

  const getRiskConfig = (level: string) => {
    switch (level) {
      case 'critical':
        return { color: '#DC2626', bg: '#FECACA', icon: XCircle, label: '严重风险' };
      case 'high':
        return { color: '#EF4444', bg: '#FEE2E2', icon: AlertTriangle, label: '高风险' };
      case 'medium':
        return { color: '#F59E0B', bg: '#FEF3C7', icon: AlertTriangle, label: '中风险' };
      case 'low':
        return { color: '#10B981', bg: '#D1FAE5', icon: CheckCircle, label: '低风险' };
      default:
        return { color: '#64748B', bg: '#F1F5F9', icon: Info, label: '信息' };
    }
  };

  const renderSecurityStatus = () => {
    if (checking) {
      return (
        <div style={styles.statusBar}>
          <Loader2 size={14} style={styles.spinning} />
          <span style={{ ...styles.statusText, color: '#2563EB' }}>
            正在进行安全检测...
          </span>
        </div>
      );
    }

    if (!lastResult) {
      return null;
    }

    const riskConfig = getRiskConfig(lastResult.risk_level);
    const RiskIcon = riskConfig.icon;

    if (lastResult.is_safe) {
      return (
        <div style={{
          ...styles.statusBar,
          background: `${riskConfig.color}08`,
          borderLeftColor: riskConfig.color,
        }}>
          <RiskIcon size={14} color={riskConfig.color} />
          <span style={{ ...styles.statusText, color: riskConfig.color }}>
            {lastResult.matched_rules.length > 0
              ? `检测到 ${lastResult.matched_rules.length} 个规则匹配（已放行）`
              : '内容安全，未检测到风险'
            }
          </span>
        </div>
      );
    }

    // 不安全 - 显示警告
    return (
      <div style={{
        ...styles.statusBar,
        background: `${riskConfig.color}10`,
        borderLeftColor: riskConfig.color,
      }}>
        <RiskIcon size={14} color={riskConfig.color} />
        <span style={{ ...styles.statusText, color: riskConfig.color, fontWeight: 600 }}>
          {riskConfig.label}: {lastResult.warning_message || '内容可能存在安全风险'}
        </span>
      </div>
    );
  };

  const charCount = value.length;
  const isOverLimit = charCount > maxLength * 0.9;

  return (
    <div style={styles.container}>
      {/* 输入区域 */}
      <div style={{
        ...styles.inputWrapper,
        borderColor: lastResult?.is_safe === false ? '#EF4444' : '#E2E8F0',
      }}>
        <textarea
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          maxLength={maxLength}
          style={styles.textarea}
        />

        {/* 字数统计 */}
        <div style={{
          ...styles.charCount,
          color: isOverLimit ? '#EF4444' : '#94A3B8',
        }}>
          {charCount} / {maxLength}
        </div>

        {/* 安全图标 */}
        <div style={styles.securityIcon}>
          {checking ? (
            <Loader2 size={16} style={styles.spinning} color="#2563EB" />
          ) : lastResult?.is_safe === false ? (
            <XCircle size={16} color="#EF4444" />
          ) : lastResult?.is_safe === true ? (
            <Shield size={16} color="#16A34A" />
          ) : (
            <Shield size={16} color="#CBD5E1" />
          )}
        </div>
      </div>

      {/* 安全状态栏 */}
      {showWarningInline && renderSecurityStatus()}

      {/* 匹配的规则详情（展开显示） */}
      {!lastResult?.is_safe && lastResult?.matched_rules?.length > 0 && (
        <div style={styles.rulesDetail}>
          <div style={styles.rulesTitle}>
            <AlertTriangle size={14} color="#EF4444" />
            触发的安全规则 ({lastResult.matched_rules.length})
          </div>
          {lastResult.matched_rules.map((rule, idx) => (
            <div key={idx} style={styles.ruleItem}>
              <span style={styles.ruleName}>{rule.rule_name}</span>
              <span style={styles.rulePattern}>匹配: "{rule.detected_pattern}"</span>
              <span style={{
                ...styles.ruleAction,
                color: rule.action === 'block' ? '#DC2626' : '#D97706',
              }}>
                {rule.action === 'block' ? '拦截' : rule.action === 'warn' ? '警告' : '脱敏'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
  },
  inputWrapper: {
    position: 'relative' as const,
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    overflow: 'hidden',
    transition: 'border-color 0.2s',
  },
  textarea: {
    width: '100%',
    padding: '12px 40px 30px 12px',
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    lineHeight: 1.6,
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    color: '#0F172A',
    background: 'transparent',
  },
  charCount: {
    position: 'absolute' as const,
    bottom: 8,
    right: 12,
    fontSize: '12px',
  },
  securityIcon: {
    position: 'absolute' as const,
    top: '12px',
    right: 12,
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    marginTop: '8px',
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderRadius: '4px',
    fontSize: '13px',
  },
  statusText: {
    flex: 1,
  },
  spinning: {
    animation: 'spin 1s linear infinite',
  },
  rulesDetail: {
    marginTop: '12px',
    padding: '12px 16px',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '6px',
  },
  rulesTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#DC2626',
    marginBottom: '10px',
  },
  ruleItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '6px 0',
    borderBottom: '1px solid #FEE2E2',
    fontSize: '13px',
  },
  ruleName: {
    fontWeight: 600,
    color: '#0F172A',
    flex: 1,
  },
  rulePattern: {
    color: '#64748B',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  ruleAction: {
    fontWeight: 600,
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '4px',
    background: '#FFFFFF',
  },
};

export default SecureInput;

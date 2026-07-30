import React from 'react';
import { Alert, Modal } from 'antd';
import { AlertTriangle, XCircle } from 'lucide-react';
import type { InputGuardResult } from '@/middleware/inputGuard';

interface InputGuardAlertProps {
  result: InputGuardResult | null;
  visible: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export const InputGuardAlert: React.FC<InputGuardAlertProps> = ({ result, visible, onConfirm, onCancel }) => {
  if (!result) return null;

  if (result.blocked) {
    return (
      <Modal title={null} open={visible} footer={null} closable={false} centered width={480}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            <XCircle size={48} color="#DC2626" />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>操作已拦截</h3>
          <p style={{ color: '#64748b', lineHeight: 1.6 }}>
            检测到高风险内容，为保障系统安全已自动拦截。
          </p>
          <div style={{ background: '#fef2f2', borderRadius: 8, padding: 12, marginTop: 16, textAlign: 'left' }}>
            {result.warnings.map((w, i) => (
              <div key={i} style={{ color: '#dc2626', fontSize: 13, marginBottom: 4 }}>• {w}</div>
            ))}
          </div>
          <div style={{ marginTop: 20, fontSize: 13, color: '#94a3b8' }}>
            平台安全保障，经检测的任务均受安全策略覆盖
          </div>
        </div>
      </Modal>
    );
  }

  if (result.level === 'high') {
    return (
      <Modal title={null} open={visible} onOk={onConfirm} onCancel={onCancel} okText="继续执行" cancelText="返回修改" centered width={480}>
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <AlertTriangle size={36} color="#EA580C" />
          <h3 style={{ marginTop: 8 }}>安全风险提醒</h3>
          <p style={{ color: '#64748b', fontSize: 14 }}>检测到以下风险项，建议修改后重新提交：</p>
          <div style={{ background: '#fffbeb', borderRadius: 8, padding: 12, marginTop: 12, textAlign: 'left' }}>
            {result.warnings.map((w, i) => (
              <div key={i} style={{ color: '#b45309', fontSize: 13, marginBottom: 4 }}>• {w}</div>
            ))}
          </div>
        </div>
      </Modal>
    );
  }

  if (result.level === 'medium') {
    return (
      <Alert
        type="warning"
        showIcon
        icon={<AlertTriangle size={16} />}
        message="内容已通过安全校验"
        description={
          <span>{result.warnings.join('；')}。系统将自动处理风险内容。</span>
        }
        closable
        style={{ maxWidth: 600, margin: '0 auto 16px' }}
      />
    );
  }

  return null;
};

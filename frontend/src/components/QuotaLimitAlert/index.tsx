import React from 'react';
import { Modal, Button } from 'antd';
import { Crown, Zap, Lock, ArrowRight } from 'lucide-react';

interface QuotaLimitAlertProps {
  visible: boolean;
  onUpgrade?: () => void;
  onCancel?: () => void;
}

export const QuotaLimitAlert: React.FC<QuotaLimitAlertProps> = ({ visible, onUpgrade, onCancel }) => (
  <Modal
    title={null}
    open={visible}
    footer={null}
    closable={true}
    onCancel={onCancel}
    centered
    width={480}
  >
    <div className="quota-limit-content">
      <div className="quota-limit-icon">
        <Lock size={40} color="#ea580c" />
      </div>
      <h3>今日免费额度已用完</h3>
      <p className="quota-limit-desc">免费版每天提供 10 次检测额度，已全部使用</p>
      
      <div className="quota-benefits">
        <div className="benefit-item"><Crown size={16} /> 无限次任务执行</div>
        <div className="benefit-item"><Zap size={16} /> P2P分布式算力</div>
        <div className="benefit-item"><Zap size={16} /> 全链路安全扫描</div>
        <div className="benefit-item"><Crown size={16} /> 完整审计报告</div>
      </div>

      <Button type="primary" size="large" block icon={<ArrowRight />}
        onClick={onUpgrade} style={{ marginBottom: 8 }}
      >
        开通会员 · 399元/年
      </Button>
      <Button block onClick={onCancel}>明天再试</Button>
      
      <p className="quota-note">开通后立即恢复使用，支持随时取消</p>
    </div>
  </Modal>
);

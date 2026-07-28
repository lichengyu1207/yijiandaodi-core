import React from 'react';

interface AffiliateCenterProps {
  visible: boolean;
  onClose: () => void;
}

const AffiliateCenter: React.FC<AffiliateCenterProps> = ({ visible, onClose }) => {
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 40, maxWidth: 600 }}
        onClick={(e) => e.stopPropagation()}>
        <h2>分销中心</h2>
        <p>功能开发中...</p>
        <button onClick={onClose}>关闭</button>
      </div>
    </div>
  );
};

export default AffiliateCenter;

import React from 'react';

const FunctionCardsSection: React.FC = () => (
  <div style={{ padding: '24px 0' }}>
    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1D2129', marginBottom: 16 }}>安全功能中心</h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
      {['Agent行为检测', '多Agent协同', '数据分类', '合规审计'].map((name) => (
        <div key={name} style={{
          background: '#fff', borderRadius: 12, padding: 20,
          border: '1px solid #F0F2F5', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{name.includes('检测') ? '🔍' : name.includes('Agent') ? '🤖' : name.includes('数据') ? '📊' : '🛡️'}</div>
          <div style={{ fontWeight: 600, color: '#1D2129' }}>{name}</div>
        </div>
      ))}
    </div>
  </div>
);

export default FunctionCardsSection;

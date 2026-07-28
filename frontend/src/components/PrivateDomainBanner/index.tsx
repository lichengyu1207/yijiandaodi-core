import React from 'react';
import { Handshake, Users } from 'lucide-react';

interface PrivateDomainBannerProps {
  showQR?: boolean;
  wechatId?: string;
  groupName?: string;
  memberCount?: number;
  style?: React.CSSProperties;
}

const STYLES = {
  container: {
    backgroundColor: '#F0FDF4',
    borderLeft: '4px solid #16A34A',
    borderRadius: 8,
    padding: '24px 28px',
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    marginTop: 32,
    marginBottom: 24,
  },
  content: {
    flex: 1,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#16A34A',
  },
  description: {
    fontSize: 14,
    color: '#4E5969',
    lineHeight: 1.7,
    marginBottom: 8,
  },
  wechatHint: {
    fontSize: 13,
    color: '#86909C',
    marginBottom: 0,
  },
  qrPlaceholder: {
    width: 120,
    height: 120,
    border: '2px dashed #86909C',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    flexShrink: 0,
  },
  qrText: {
    fontSize: 12,
    color: '#86909C',
    textAlign: 'center',
    marginTop: 6,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTop: '1px solid rgba(22,163,74,0.15)',
  },
  memberInfo: {
    fontSize: 12,
    color: '#86909C',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
};

const PrivateDomainBanner: React.FC<PrivateDomainBannerProps> = ({
  showQR = true,
  wechatId = 'yijiandaodi_cn',
  groupName = 'Agent安全交流群',
  memberCount = 128,
  style,
}) => {
  return (
    <div style={{ ...STYLES.container, ...style }}>
      <div style={STYLES.content}>
        <div style={STYLES.header}>
          <Handshake size={22} color="#16A34A" />
          <h3 style={STYLES.title}>加入「一鉴到底」{groupName}</h3>
        </div>

        <p style={STYLES.description}>
          获取更多 Agent 安全资源 + 第一手行业动态
        </p>

        <p style={STYLES.wechatHint}>
          扫码添加微信，备注「Agent」拉你进群
        </p>
      </div>

      {showQR && (
        <div style={STYLES.qrPlaceholder}>
          <span style={{ fontSize: 32 }}>📱</span>
          <span style={STYLES.qrText}>扫码区域</span>
          <span style={{ fontSize: 11, color: '#C9CDD4', marginTop: 2 }}>
            {wechatId}
          </span>
        </div>
      )}

      <div style={STYLES.footer}>
        <div style={STYLES.memberInfo}>
          <Users size={14} />
          已有 {memberCount} 位从业者加入 | 每日分享 Agent 安全干货
        </div>
      </div>
    </div>
  );
};

export default PrivateDomainBanner;

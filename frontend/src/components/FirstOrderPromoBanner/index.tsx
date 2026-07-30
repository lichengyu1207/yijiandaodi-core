import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Check } from 'lucide-react';
import { message } from 'antd';
import {
  getFirstOrderPromo,
  claimFirstOrderCoupon,
  type FirstOrderPromoInfo,
} from '@/api/paymentApi';
import { useAuthStore } from '@/store/useAuthStore';

interface FirstOrderPromoBannerProps {
  compact?: boolean;
  onClaimed?: (couponCode: string) => void;
}

const DEFAULT_PROMO: FirstOrderPromoInfo = {
  id: 'default',
  title: '新人专享优惠',
  coupon_code: 'NEWUSER2024',
  discount_amount: 50,
  min_order_amount: 99,
  valid_until: '2026-12-31T23:59:59Z',
  user_has_claimed: false,
  user_can_claim: true,
  user_coupon_code: '',
  extra_config: {
    banner_text: '新人专享 首单立减¥50',
    subtext: '全场套餐可用 上不封顶',
    badge_text: '限时',
    bg_color: '#FFFBEA',
    border_color: '#FF7D00',
    accent_color: '#FF7D00',
  },
};

const FirstOrderPromoBanner: React.FC<FirstOrderPromoBannerProps> = ({
  compact = false,
  onClaimed,
}) => {
  /* 移动端自动启用紧凑模式 */
  const [isMobile, setIsMobile] = React.useState(false);
  const [promo, setPromo] = useState<FirstOrderPromoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    loadPromo();
  }, []);

  /* 移动端检测 */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /* 移动端或手动指定时启用紧凑模式 */
  const effectiveCompact = compact || isMobile;

  const loadPromo = async () => {
    try {
      const res = await getFirstOrderPromo();
      if (res.success && res.data) {
        setPromo(res.data);
      }
    } catch (e) {
      // 后端不可用时使用默认数据
    } finally {
      if (!promo) {
        setPromo(DEFAULT_PROMO);
      }
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (claiming) return;
    if (!isAuthenticated()) {
      message.info('请先登录后再领取优惠券');
      navigate('/login');
      return;
    }
    setClaiming(true);
    try {
      const res = await claimFirstOrderCoupon();
      if (res.success) {
        message.success('优惠券领取成功！');
        loadPromo();
        if (res.data?.coupon_code && onClaimed) {
          onClaimed(res.data.coupon_code);
        }
      } else {
        message.error(res.message || '领取失败');
      }
    } catch (e) {
      message.error('网络错误，请重试');
    } finally {
      setClaiming(false);
    }
  };

  if (loading || !promo) return null;

  const config = promo.extra_config || {};
  const bgColor = config.bg_color || '#FFFBEA';
  const borderColor = config.border_color || '#FF7D00';
  const accentColor = config.accent_color || '#FF7D00';

  const isClaimed = promo.user_has_claimed;
  const canClaim = promo.user_can_claim;

  let statusContent: React.ReactNode;
  if (!isClaimed && canClaim) {
    statusContent = (
      <button
        onClick={handleClaim}
        disabled={claiming}
        style={{
          padding: effectiveCompact ? '6px 16px' : '8px 20px',
          borderRadius: 6,
          border: `1.5px solid ${accentColor}`,
          background: '#FFFFFF',
          color: accentColor,
          fontSize: effectiveCompact ? 12 : 13,
          fontWeight: 600,
          cursor: claiming ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
        onMouseEnter={(e) => {
          if (!claiming) {
            e.currentTarget.style.background = accentColor;
            e.currentTarget.style.color = '#FFFFFF';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#FFFFFF';
          e.currentTarget.style.color = accentColor;
        }}
      >
        <Gift size={effectiveCompact ? 14 : 16} />
        {claiming ? '领取中...' : '立即领取'}
      </button>
    );
  } else if (isClaimed) {
    statusContent = (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: effectiveCompact ? '6px 14px' : '8px 16px',
        borderRadius: 6,
        background: accentColor + '15',
        border: `1px solid ${accentColor}30`,
      }}>
        <Check size={14} style={{ color: accentColor }} />
        <span style={{ fontSize: effectiveCompact ? 11 : 12, fontWeight: 600, color: accentColor }}>已领取</span>
        {promo.user_coupon_code && (
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#86909C', background: '#F2F3F5', padding: '2px 6px', borderRadius: 4 }}>
            {promo.user_coupon_code}
          </span>
        )}
      </div>
    );
  } else {
    return null;
  }

  return (
    <div style={{
      position: 'relative',
      borderRadius: effectiveCompact ? 8 : 12,
      background: bgColor,
      borderLeft: `4px solid ${borderColor}`,
      padding: effectiveCompact ? '10px 14px' : '16px 20px',
      boxShadow: '0 2px 12px rgba(255,125,0,0.08)',
      display: 'flex', alignItems: 'center', gap: effectiveCompact ? 12 : 16,
      overflow: 'hidden',
    }}>
      {!effectiveCompact && (
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `linear-gradient(135deg, ${accentColor}, ${borderColor}CC)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Gift size={20} style={{ color: '#FFFFFF' }} />
        </div>
      )}
      {effectiveCompact && (
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `linear-gradient(135deg, ${accentColor}, ${borderColor}CC)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Gift size={16} style={{ color: '#FFFFFF' }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: effectiveCompact ? 2 : 4 }}>
          <span style={{ fontSize: effectiveCompact ? 13 : 15, fontWeight: 700, color: borderColor }}>
            {config.banner_text || '新人专享 首单5折'}
          </span>
          {config.badge_text && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#FFF', background: accentColor, padding: '1px 6px', borderRadius: 3, lineHeight: 1.4 }}>
              {config.badge_text}
            </span>
          )}
        </div>
        <div style={{ fontSize: effectiveCompact ? 11 : 12, color: '#92400E' }}>
          {config.subtext || '最高减100元 全场套餐可用'}
        </div>
      </div>
      {statusContent}
    </div>
  );
};

export default FirstOrderPromoBanner;

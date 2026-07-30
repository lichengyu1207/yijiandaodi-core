import React, { useState, useEffect } from 'react';
import {
  Crown,
  Gift,
  Zap,
  Heart,
  Building2,
  X,
} from 'lucide-react';
import { getFeedPromoCards, trackPromoClick, type PromoCardItem } from '@/api/promoCardApi';
import TippingButton from '@/components/TippingButton';

interface PromoCardFeedProps {
  position?: string;
  maxCards?: number;
  style?: React.CSSProperties;
}

const CARD_TYPE_ICONS: Record<string, React.ReactNode> = {
  vip_basic: <Crown size={20} />,
  vip_premium: <Building2 size={20} />,
  vip_enterprise: <Building2 size={20} />,
  pay_per_use: <Zap size={20} />,
  feature_launch: <Zap size={20} />,
  limited_offer: <Gift size={20} />,
  referral: <Heart size={20} />,
};

const PromoCardFeed: React.FC<PromoCardFeedProps> = ({
  position = 'feed_middle',
  maxCards = 2,
  style,
}) => {
  const [cards, setCards] = useState<PromoCardItem[]>([]);
  const [visible, setVisible] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getFeedPromoCards(position, maxCards).then((res) => {
      if (res.success && res.data) {
        setCards(res.data.cards || []);
      }
    }).catch(() => {}).finally(() => setLoaded(true));
  }, [position, maxCards]);

  // 没有数据时使用默认推荐卡片
  if (cards.length === 0 && loaded) {
    setCards([
      {
        id: 'rec-1',
        title: 'AI 文本安全检测 — 论文/简历/AI文案',
        subtitle: '防限流、防延毕、防被筛，一键检测',
        description: '基于 DeepSeek 大模型的多维度文本安全检测，覆盖学术、职场、内容创作三大场景，准确率高达 98.6%',
        card_type: 'pay_per_use',
        card_type_display: '按次付费',
        bg_color: '#FFF7E8',
        border_color: '#FFD666',
        accent_color: '#F5A623',
        price_text: '¥0.5/次起',
        button_text: '立即体验',
      },
      {
        id: 'rec-2',
        title: '企业版 — 多人协作 + 无限检测额度',
        subtitle: '团队专属方案，性价比之选',
        description: '支持多人协作、API 接入、自定义规则配置，适合内容平台、教育机构、企业内部审计等场景',
        card_type: 'vip_enterprise',
        card_type_display: '企业版',
        bg_color: '#F0F5FF',
        border_color: '#ADC6FF',
        accent_color: '#165DFF',
        price_text: '¥999/月起',
        button_text: '了解详情',
      },
    ]);
  }

  if (cards.length === 0 || !visible) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      <style>{`
        @media (max-width: 768px) {
          .promo-card-feed-item {
            padding: 14px 16px !important;
          }
          .promo-card-feed-icon {
            width: 38px !important;
            height: 38px !important;
          }
          .promo-card-feed-title {
            font-size: 13px !important;
          }
          .promo-card-feed-desc {
            font-size: 11px !important;
          }
          .promo-card-feed-btn {
            font-size: 12px !important;
            min-height: 36px !important;
          }
        }
      `}</style>
      {cards.map((card) => (
        <div
          key={card.id}
          onClick={() => trackPromoClick(card.id)}
          className="promo-card-feed-item"
          style={{
            position: 'relative',
            borderRadius: 8,
            background: card.bg_color || '#FFF7E8',
            border: '1.5px solid ' + (card.border_color || '#FFD666'),
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(245,166,35,0.15)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setVisible(false); }}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0,0,0,0.06)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#86909C',
              fontSize: 10,
            }}
          >
            <X size={12} />
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: (card.accent_color || '#F5A623') + '18',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: card.accent_color || '#F5A623',
          }} className="promo-card-feed-icon">
              {CARD_TYPE_ICONS[card.card_type] || <Crown size={20} />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}>
                <span style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#1D2129',
                  lineHeight: '1.3',
                }} className="promo-card-feed-title">
                  {card.title}
                </span>
                {card.price_text && (
                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: card.accent_color || '#F5A623',
                    whiteSpace: 'nowrap',
                    background: (card.accent_color || '#F5A623') + '14',
                    padding: '2px 8px',
                    borderRadius: 6,
                  }}>
                    {card.price_text}
                  </span>
                )}
              </div>

              {card.subtitle && (
                <span style={{
                  fontSize: 11,
                  color: card.accent_color || '#F5A623',
                  fontWeight: 600,
                  marginBottom: 4,
                  display: 'block',
                }}>
                  {card.subtitle}
                </span>
              )}

              <p style={{
                margin: 0,
                fontSize: 12,
                color: '#4E5969',
                lineHeight: '1.5',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
              }} className="promo-card-feed-desc">
                {card.description}
              </p>
            </div>
          </div>

          <div style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px dashed ' + (card.border_color || '#FFD666'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: 10,
              color: '#C9CDD4',
            }}>
              {card.card_type_display || ''}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TippingButton
                creatorId={card.id}
                creatorName={card.title}
                sourcePage="info_feed"
                sourceId={card.id}
                size="small"
              />
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: card.accent_color || '#F5A623',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }} className="promo-card-feed-btn">
                {card.button_text || '立即开通'}
                <span style={{ fontSize: 14 }}>→</span>
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PromoCardFeed;

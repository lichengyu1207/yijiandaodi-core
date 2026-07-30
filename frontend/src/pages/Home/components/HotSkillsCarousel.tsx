import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  TrendingUp,
  Zap,
  Clock,
  Star,
  ArrowRight,
} from 'lucide-react';
import {
  getTopHotSkills,
  type HotSkillItem,
} from '@/api/paymentApi';

interface HotSkillsCarouselProps {
  onSkillClick?: (skill: HotSkillItem) => void;
}

type IconName = 'Zap' | 'Flame' | 'TrendingUp' | 'Clock' | 'Star' | 'ArrowRight';

const TIER_ICON_MAP: Record<string, IconName> = {
  core: 'Zap',
  security: 'Zap',
  product: 'Zap',
  vertical: 'ArrowRight',
  monetization: 'Star',
  multilingual: 'TrendingUp',
  professional: 'TrendingUp',
  special: 'Flame',
  compliance: 'Clock',
  'ai-detect': 'Flame',
  'content-security': 'Zap',
  'ai-governance': 'Clock',
  'vertical-peer': 'ArrowRight',
  'infoflow-detect': 'Flame',
  'traffic-optimize': 'TrendingUp',
  'infoflow-compliance': 'Clock',
  'multimodal-infoflow': 'Flame',
  'context-understanding': 'ArrowRight',
  'long-conversation': 'Clock',
  'context-risk-control': 'Zap',
  'vertical-context': 'Clock',
  'retrieval-system': 'ArrowRight',
  'cluster-management': 'Zap',
  'file-operation': 'ArrowRight',
  'voice-input': 'Flame',
  'general-agent': 'Zap',
  'enterprise-agent': 'Clock',
  'vertical-agent': 'TrendingUp',
  'multi-agent-collab': 'Zap',
};

const ICON_COMPONENTS: Record<IconName, React.ComponentType<{ size?: number }>> = {
  Zap,
  Flame,
  TrendingUp,
  Clock,
  Star,
  ArrowRight,
};

const AUTO_INTERVAL = 3000;
const SLIDES_PER_PAGE = 3;

const HotSkillsCarousel: React.FC<HotSkillsCarouselProps> = ({ onSkillClick }) => {
  const [skills, setSkills] = useState<HotSkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalSlides = Math.max(1, Math.ceil(skills.length / SLIDES_PER_PAGE));

  useEffect(() => {
    getTopHotSkills(9).then((res) => {
      if (res.success && res.data) {
        setSkills(res.data.items || []);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const goNext = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  useEffect(() => {
    if (paused || skills.length === 0 || totalSlides <= 1) return;
    const timer = setInterval(goNext, AUTO_INTERVAL);
    return () => clearInterval(timer);
  }, [paused, skills.length, totalSlides, goNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  const getVisibleSkills = () => {
    const start = currentSlide * SLIDES_PER_PAGE;
    return skills.slice(start, start + SLIDES_PER_PAGE);
  };

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: 220,
        borderRadius: 8,
        background: '#F7F8FA',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          border: '2px solid #165DFF',
          borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: 13, color: '#86909C' }}>正在加载能力推荐...</span>
      </div>
    );
  }

  if (skills.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div style={{
        padding: '14px 20px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} style={{ color: '#FF7D00' }} />
          <span style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: 0.5,
          }}>
            智能能力推荐
          </span>
          <span style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.5)',
            background: 'rgba(255,255,255,0.08)',
            padding: '2px 8px',
            borderRadius: 10,
          }}>
            精选{Math.min(skills.length, 9)}项
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.5)',
          }}>
            {currentSlide + 1}/{totalSlides}
          </span>
        </div>
      </div>

      {/* Skill Cards */}
      <div style={{
        padding: '4px 16px 16px',
        display: 'grid',
        gridTemplateColumns: `repeat(${SLIDES_PER_PAGE}, 1fr)`,
        gap: 10,
      }}>
        {getVisibleSkills().map((skill, idx) => {
          const globalIdx = currentSlide * SLIDES_PER_PAGE + idx;
          const iconColor = skill.icon_color || '#FF6B35';

          return (
            <div
              key={skill.id}
              onClick={() => onSkillClick?.(skill)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '14px 12px',
                cursor: 'pointer',
                transition: 'all 0.25s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.borderColor = iconColor;
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Rank Badge */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 28,
                height: 28,
                borderBottomRightRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: '#FFF',
                background: globalIdx === 0
                  ? '#165DFF'
                  : globalIdx === 1
                    ? '#722ED1'
                    : globalIdx === 2
                      ? '#00B42A'
                      : 'rgba(100,116,139,0.4)',
              }}>
                {globalIdx + 1}
              </div>

              {/* Icon */}
              <div style={{
                marginTop: 18,
                marginBottom: 8,
                width: 36,
                height: 36,
                borderRadius: 8,
                background: iconColor + '22',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: iconColor,
              }}>
                {(() => {
                  const iconName = TIER_ICON_MAP[skill.tier] || 'Zap';
                  const IconComp = ICON_COMPONENTS[iconName];
                  return IconComp ? <IconComp size={16} /> : <Zap size={16} />;
                })()}
              </div>

              {/* Name */}
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#FFFFFF',
                marginBottom: 4,
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {skill.name}
              </div>

              {/* Category */}
              <div style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.45)',
                marginBottom: 8,
              }}>
                {skill.category}
              </div>

              {/* Stats Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.4)',
                }}>
                  <span>{skill.category || skill.tier}</span>
                  <ArrowRight size={10} style={{ opacity: 0.5 }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      {totalSlides > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFF',
              zIndex: 5,
            }}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFF',
              zIndex: 5,
            }}
          >
            <ChevronRight size={14} />
          </button>
        </>
      )}

      {/* Indicators */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 6,
        zIndex: 5,
      }}>
        {Array.from({ length: totalSlides }).map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setCurrentSlide(i); }}
            style={{
              width: i === currentSlide ? 20 : 6,
              height: 6,
              borderRadius: 3,
              border: 'none',
              background: i === currentSlide ? '#FF6B35' : 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default HotSkillsCarousel;

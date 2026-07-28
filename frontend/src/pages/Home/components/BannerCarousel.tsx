import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import type { Article } from '@/types/article';
import { getPublicBanners, type BannerItem } from '@/api/bannerApi';

interface BannerCarouselProps {
  articles?: Article[];
}

interface XinfaBanner {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  bg_color: string;
  category_tag: string;
}

const XINFA_BANNERS: XinfaBanner[] = [
  {
    id: 'xinfa-1',
    title: '上周上线了个Agent，第二天客户打电话说数据被别人看到了',
    subtitle: '复盘一下整个过程，问题出在哪儿',
    cta: '看看怎么防 →',
    bg_color: '#2563EB',
    category_tag: 'Agent 避坑',
  },
  {
    id: 'xinfa-2',
    title: '做ToB Agent产品的，你们做过安全审计吗？我们去年漏检了三个地方',
    subtitle: '后来补上的，分享出来供参考',
    cta: '查看清单 →',
    bg_color: '#7C3AED',
    category_tag: '开发保命',
  },
  {
    id: 'xinfa-3',
    title: '帮一家政企单位做等保测评，Agent模块扣了不少分',
    subtitle: '主要就这几个问题，提前知道能少跑两趟',
    cta: '等保自查 →',
    bg_color: '#059669',
    category_tag: '企业合规',
  },
  {
    id: 'xinfa-4',
    title: '同事把API Key写死在代码里提交了，第二天仓库被人扫到了',
    subtitle: '这种事怎么从流程上杜绝',
    cta: '密钥管理方案 →',
    bg_color: '#DC2626',
    category_tag: 'Agent 避坑',
  },
  {
    id: 'xinfa-5',
    title: '用户在我们的Agent里输入了一段话，系统直接执行了不该执行的命令',
    subtitle: '这是Prompt Injection的真实案例，不是PPT里的那种',
    cta: '案例详情 →',
    bg_color: '#EA580C',
    category_tag: '踩坑实录',
  },
  {
    id: 'xinfa-6',
    title: 'LangChain的Tool调用没做参数校验，测试时发现了这个问题',
    subtitle: '记录一下修复过程和后续的防护措施',
    cta: '看原文 →',
    bg_color: '#0891B2',
    category_tag: 'Agent 避坑',
  },
  {
    id: 'xinfa-7',
    title: 'RAG接上去之后效果不错，但后来发现知识库被污染了',
    subtitle: '排查了两天才找到原因',
    cta: '排查过程 →',
    bg_color: '#4F46E5',
    category_tag: '踩坑实录',
  },
  {
    id: 'xinfa-8',
    title: 'Docker里跑Agent容器，默认配置其实不够安全',
    subtitle: '我们踩过的几个坑和现在的加固方案',
    cta: '加固指南 →',
    bg_color: '#BE185D',
    category_tag: '开发保命',
  },
  {
    id: 'xinfa-9',
    title: '整理了一份Agent上线前的检查表，每次发版前过一遍',
    subtitle: '已经用了一段时间，持续更新中',
    cta: '获取检查表 →',
    bg_color: '#166534',
    category_tag: '企业合规',
  },
];

const STYLES = {
  wrapper: {
    position: 'relative' as const,
    width: '100%',
    height: 280,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#F7F8FA',
  },
  slide: (bgColor: string) => ({
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: bgColor,
    cursor: 'pointer',
    position: 'absolute' as const,
    top: 0,
    left: 0,
    opacity: 0,
    transition: 'opacity 0.5s ease',
    padding: '40px 48px',
    boxSizing: 'border-box' as const,
  }),
  slideActive: {
    opacity: 1,
    zIndex: 1 as const,
  },
  slideContent: {
    maxWidth: 640,
    color: '#FFFFFF',
  },
  slideCat: {
    display: 'inline-block',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 14px',
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 16,
    letterSpacing: 1,
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: 800,
    margin: '0 0 16px',
    lineHeight: 1.35,
    textShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  slideSubtitle: {
    fontSize: 15,
    margin: '0 0 12px',
    lineHeight: 1.7,
    opacity: 0.9,
  },
  slideCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 16,
    fontWeight: 700,
    color: '#FFFFFF',
    cursor: 'pointer',
    textDecoration: 'none',
    position: 'relative' as const,
    transition: 'all 0.25s ease',
  },
  btnNav: {
    position: 'absolute' as const,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 36,
    height: 36,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 10,
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  btnLeft: { left: 16 },
  btnRight: { right: 16 },
  indicators: {
    position: 'absolute' as const,
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 8,
    zIndex: 10,
  },
  dot: (active: boolean) => ({
    width: active ? 24 : 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  }),
} as const;

const CAROUSEL_COLORS = ['#2563EB', '#7C3AED', '#059669', '#DC2626', '#EA580C'];

function getSlideBg(color: string): string {
  const redColors = ['#DC2626', '#EF4444', '#EA580C', '#BE185D', '#991B1B', '#166534'];
  if (redColors.includes(color)) {
    return `linear-gradient(135deg, ${color}22, ${color}aa)`;
  }
  return color;
}

function formatReadCount(count: number): string {
  if (!count) return '0';
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function isXinfaBanner(item: any): item is XinfaBanner {
  return item && 'cta' in item && typeof item.cta === 'string';
}

const BannerCarousel: React.FC<BannerCarouselProps> = ({ articles = [] }) => {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [apiBanners, setApiBanners] = useState<BannerItem[]>([]);

  useEffect(() => {
    getPublicBanners()
      .then((res: any) => {
        const data = res?.data || res;
        if (Array.isArray(data) && data.length > 0) setApiBanners(data);
      })
      .catch(() => {});
  }, []);

  const items = apiBanners.length > 0
    ? apiBanners
    : XINFA_BANNERS.length > 0
      ? XINFA_BANNERS
      : articles.slice(0, 5);

  const go = useCallback((idx: number) => {
    setCurrent((idx + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const timer = setInterval(() => go(current + 1), 3000);
    return () => clearInterval(timer);
  }, [current, paused, items.length, go]);

  const handleClick = (item: any) => {
    if (isXinfaBanner(item)) {
      navigate('/', { state: { openAgentChat: true, agentScenario: item.cta || 'text', xinfaTag: item.category_tag } });
      return;
    }
    if ('link_url' in item && item.link_url) {
      window.open(item.link_url, '_blank');
    } else if ('id' in item) {
      navigate(`/cases/${item.id}`);
    }
  };

  const renderSlideContent = (item: any, index: number) => {
    const isXinfa = isXinfaBanner(item);
    const isApiBanner = !isXinfa && 'bg_color' in item;
    const bgColor = (isXinfa || isApiBanner)
      ? item.bg_color
      : CAROUSEL_COLORS[index % CAROUSEL_COLORS.length];
    const processedBg = getSlideBg(bgColor);
    const catLabel = isXinfa
      ? item.category_tag
      : isApiBanner
        ? (item.category_tag || '轮播')
        : item.categoryName;
    const title = item.title;

    return (
      <div key={item.id} style={{
        ...STYLES.slide(processedBg),
        ...(index === current ? STYLES.slideActive : {}),
      }} onClick={() => handleClick(item)}>
        <div style={STYLES.slideContent}>
          <span style={STYLES.slideCat}>{catLabel}</span>
          <h2 style={STYLES.slideTitle}>{title}</h2>

          {isXinfa && (
            <>
              <p style={STYLES.slideSubtitle}>{item.subtitle}</p>
              <span className="xinfa-cta" style={STYLES.slideCta}>
                {item.cta}
                <ArrowRight size={18} strokeWidth={2.5} />
                <style>{`
                  .xinfa-cta {
                    position: relative;
                  }
                  .xinfa-cta::after {
                    content: '';
                    position: absolute;
                    bottom: -2px;
                    left: 0;
                    width: 0%;
                    height: 2px;
                    background-color: #FFF;
                    transition: width 0.3s ease;
                    border-radius: 1px;
                  }
                  .xinfa-cta:hover::after {
                    width: 100%;
                  }
                  .xinfa-cta:hover {
                    letter-spacing: 0.5px;
                    transform: translateX(2px);
                  }
                  .xinfa-cta svg {
                    transition: transform 0.25s ease;
                  }
                  .xinfa-cta:hover svg {
                    transform: translateX(4px);
                  }
                `}</style>
              </span>
            </>)}

          {!isXinfa && (
            <p style={{
              fontSize: 14,
              margin: 0,
              lineHeight: 1.7,
              opacity: 0.9,
              display: '-webkit-box' as const,
              WebkitLineClamp: 3 as number,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }}>
              {isApiBanner ? (item.subtitle || item.description || '') : item.summary}
            </p>
          )}
        </div>
      </div>
    );
  };

  if (items.length === 0) {
    return (
      <div style={{ ...STYLES.wrapper, backgroundColor: '#165DFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#FFFFFF' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 12px', letterSpacing: 2 }}>一鉴到底</h2>
          <p style={{ fontSize: 16, margin: 0, opacity: 0.9, letterSpacing: 1 }}>安全信息聚合平台</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={STYLES.wrapper}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {items.map((item, i) => renderSlideContent(item, i))}

      {items.length > 1 && (
        <>
          <button
            style={{ ...STYLES.btnNav, ...STYLES.btnLeft }}
            onClick={(e) => { e.stopPropagation(); go(current - 1); }}
            aria-label="上一张"
          >
            <ChevronLeft size={18} color="#334155" />
          </button>
          <button
            style={{ ...STYLES.btnNav, ...STYLES.btnRight }}
            onClick={(e) => { e.stopPropagation(); go(current + 1); }}
            aria-label="下一张"
          >
            <ChevronRight size={18} color="#334155" />
          </button>

          <div style={STYLES.indicators}>
            {items.map((_, i) => (
              <button
                key={i}
                style={STYLES.dot(i === current)}
                onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                aria-label={`第${i + 1}张`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BannerCarousel;

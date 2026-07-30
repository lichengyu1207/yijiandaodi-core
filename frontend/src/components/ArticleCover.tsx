import { useMemo } from 'react';

interface ArticleCoverProps {
  /** 真实上传的封面图 URL（后台上传，优先显示） */
  imageUrl?: string;
  /** 多图模式下的图片 URL 列表（最多3张） */
  galleryImages?: string[];
  title: string;
  xinfaTag?: string;
  categoryName?: string;
  index?: number;
  width?: string;
  height?: string;
  /** 布局模式: 'single' 单图 | 'triple' 三图 | 'text-only' 纯文字(无封面区) */
  layoutMode?: 'single' | 'triple' | 'text-only';
}

const COVER_PALETTES = [
  { bg: '#1E3A5F', accent: '#3B82F6' },
  { bg: '#1A365D', accent: '#8B5CF6' },
  { bg: '#134E4A', accent: '#14B8A6' },
  { bg: '#713F12', accent: '#F59E0B' },
  { bg: '#4C1D95', accent: '#A78BFA' },
  { bg: '#831843', accent: '#EC4899' },
  { bg: '#065F46', accent: '#10B981' },
  { bg: '#1E40AF', accent: '#60A5FA' },
];

const CATEGORY_ICONS: Record<string, string> = {
  '安全审计': 'shield',
  'Agent安全': 'bot',
  '数据泄露': 'lock',
  '权限绕过': 'shield-check',
  'Prompt注入': 'sparkles',
  'RAG知识库': 'book-open',
  '工具调用': 'settings',
  'LLM安全': 'brain',
};

/**
 * 文章封面组件
 *
 * 展示逻辑（按优先级）：
 * 1. 有真实 imageUrl → 直接展示上传的图片
 * 2. 有 galleryImages（多图）→ 三图网格布局
 * 3. 无图片 → 返回 null（由父组件决定纯文字布局）
 *
 * 不再使用 AI text_to_image 生成封面
 */
const ArticleCover: React.FC<ArticleCoverProps> = ({
  imageUrl,
  galleryImages = [],
  title,
  xinfaTag,
  categoryName,
  index = 0,
  width = '100%',
  height = '100%',
  layoutMode = 'single',
}) => {
  const palette = useMemo(() => {
    if (xinfaTag) return { bg: '#2D1B69', accent: '#7C3AED' };
    return COVER_PALETTES[index % COVER_PALETTES.length];
  }, [index, xinfaTag]);

  // 模式1：有真实单张封面图 → 直接渲染
  if (imageUrl) {
    if (layoutMode === 'triple' && galleryImages.length > 0) {
      // 三图模式：主图 + 缩略图网格
      const displayImages = galleryImages.slice(0, 3);
      return (
        <div style={{
          width, display: 'flex', gap: 4, overflow: 'hidden',
        }}>
          {/* 主图 */}
          <div style={{
            flex: 2, paddingTop: '56%', position: 'relative', overflow: 'hidden',
            borderRadius: '8px 0 0 8px',
          }}>
            <img
              src={imageUrl}
              alt={title}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                objectFit: 'cover',
              }}
              loading="lazy"
            />
          </div>
          {/* 右侧小图列表 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {displayImages.slice(1).map((imgUrl, i) => (
              <div key={i} style={{
                flex: 1, position: 'relative', overflow: 'hidden',
                borderRadius: i === displayImages.length - 2 ? '0 8px 8px 0' : undefined,
                minHeight: 0,
              }}>
                <img
                  src={imgUrl}
                  alt={`${title}-${i}`}
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    objectFit: 'cover',
                  }}
                  loading="lazy"
                />
              </div>
            ))}
            {/* 如果只有2张图，补一个占位 */}
            {displayImages.length === 2 && (
              <div style={{
                flex: 1, backgroundColor: '#F1F5F9', borderRadius: '0 8px 8px 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: '#94A3B8',
              }}>
                +{galleryImages.length - 1}
              </div>
            )}
          </div>
        </div>
      );
    }

    // 单图模式
    return (
      <div style={{
        width, height, position: 'relative', overflow: 'hidden',
        borderRadius: 8, backgroundColor: palette.bg,
      }}>
        <img
          src={imageUrl}
          alt={title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
          onError={(e) => {
            // 图片加载失败时隐藏，让 fallback 显示
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {xinfaTag && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(135deg, rgba(124,58,237,0.12), transparent)',
            pointerEvents: 'none',
          }} />
        )}
      </div>
    );
  }

  // 模式2：无单图但有多图 → 三图等分网格
  if (galleryImages.length > 0) {
    const displayImages = galleryImages.slice(0, 3);
    return (
      <div style={{ width, display: 'flex', gap: 4, overflow: 'hidden' }}>
        {displayImages.map((imgUrl, i) => (
          <div key={i} style={{
            flex: 1,
            paddingTop: layoutMode === 'triple' ? '56%' : '100%',
            position: 'relative', overflow: 'hidden',
            borderRadius: i === 0 ? '8px 0 0 8px' : i === displayImages.length - 1 ? '0 8px 8px 0' : undefined,
          }}>
            <img
              src={imgUrl}
              alt={`${title}-${i}`}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                objectFit: 'cover',
              }}
              loading="lazy"
            />
          </div>
        ))}
      </div>
    );
  }

  // 模式3：没有任何图片 → 返回 null，父组件走纯文字布局
  if (layoutMode === 'text-only') {
    return null;
  }

  // 最终 fallback：纯色背景 + 图标 + 标题文字（不调用任何AI生成接口）
  const iconKey = CATEGORY_ICONS[categoryName || ''] || 'file-text';
  return (
    <div style={{
      width, height, position: 'relative', overflow: 'hidden',
      borderRadius: 8, backgroundColor: palette.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center',
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {iconKey === 'shield' && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>}
          {iconKey === 'bot' && <><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 3v8"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></>}
          {iconKey === 'lock' && <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>}
          {iconKey === 'book-open' && <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>}
          {(iconKey !== 'shield' && iconKey !== 'bot' && iconKey !== 'lock' && iconKey !== 'book-open') &&
            <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>}
        </svg>
        <span style={{
          color: '#fff', fontSize: 15, fontWeight: 700,
          maxWidth: '80%', lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {title || '一鉴到底'}
        </span>
      </div>
      {xinfaTag && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(135deg, rgba(124,58,237,0.15), transparent)',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
};

export default ArticleCover;

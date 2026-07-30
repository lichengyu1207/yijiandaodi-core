import React from 'react';

interface ArticleCoverProps {
  title: string;
  xinfaTag?: string;
  categoryName?: string;
  index?: number;
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
}

const IMAGE_SOURCES: { keywords: string[]; urls: string[] }[] = [
  {
    keywords: ['注入', 'Prompt', '攻击', '漏洞', '渗透', '安全', '审计'],
    urls: [
      'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1550745215-dcfc0c971470?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1563013548-8239299a6c55?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-161406464193984-2e5262d88f82?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=680&h=384&fit=crop&q=80',
    ],
  },
  {
    keywords: ['泄露', '密钥', '数据', '隐私', '加密', 'Key', 'Token'],
    urls: [
      'https://images.unsplash.com/photo-1563013548-8239299a6c55?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1580894894513-541e068a3e2b?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1563986768609-322da13575f2?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=680&h=384&fit=crop&q=80',
    ],
  },
  {
    keywords: ['Docker', '容器', 'K8s', 'Kubernetes', '部署', '运维'],
    urls: [
      'https://images.unsplash.com/photo-1667372393119-3d2089d12bf1?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1667372380044-a0c4d3e63f90?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1667372393119-3d2089d12bf1?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1718911997894-16419db5bc5d?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=680&h=384&fit=crop&q=80',
    ],
  },
  {
    keywords: ['RAG', '向量', '数据库', 'LangChain', 'LLM', 'AI', 'Agent', '模型'],
    urls: [
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1655720828018-edd2daec9349?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1684489171756-33bdb70f4df3?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1686192127102-6f10ea2c1e72?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1697599996845-e97891a4dab8?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1684489171756-33bdb70f4df3?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1676299081847-824916de6c66?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1706280019271-af4c0c30f2e6?w=680&h=384&fit=crop&q=80',
    ],
  },
  {
    keywords: ['合规', '等保', 'GDPR', '审计', '企业', '风控', '政策'],
    urls: [
      'https://images.unsplash.com/photo-1450101499163-c8848a669202?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1497366216548-37526070297c?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1560179707-f14e90c36c64?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1573164713714-d95b4246eb16?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=680&h=384&fit=crop&q=80',
    ],
  },
  {
    keywords: ['投毒', '供应链', 'npm', '依赖', '开源'],
    urls: [
      'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=680&h=384&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=680&h=384&fit=crop&q=80',
    ],
  },
];

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1550745215-dcfc0c971470?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1563013548-8239299a6c55?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-161406464193984-2e5262d88f82?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1667372393119-3d2089d12bf1?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1655720828018-edd2daec9349?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1684489171756-33bdb70f4df3?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1450101499163-c8848a669202?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580894894513-541e068a3e2b?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1563986768609-322da13575f2?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560179707-f14e90c36c64?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573164713714-d95b4246eb16?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1686192127102-6f10ea2c1e72?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1697599996845-e97891a4dab8?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=680&h=384&fit=crop&q=80',
  'https://images.unsplash.com/photo-1706280019271-af4c0c30f2e6?w=680&h=384&fit=crop&q=80',
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function matchImageUrl(title: string): string {
  const h = hashStr(title);

  for (const group of IMAGE_SOURCES) {
    for (const kw of group.keywords) {
      if (title.includes(kw)) {
        const idx = h % group.urls.length;
        return group.urls[idx];
      }
    }
  }

  return FALLBACK_IMAGES[h % FALLBACK_IMAGES.length];
}

interface ImageState {
  src: string;
  status: 'loading' | 'ok' | 'error';
}

const ArticleCover: React.FC<ArticleCoverProps> = ({
  title,
  xinfaTag,
  categoryName,
  index = 0,
  width = '100%',
  height = '100%',
  style,
}) => {
  const url = matchImageUrl(title || '');

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#F0F0F0',
        ...style,
      }}
    >
      <img
        src={url}
        alt={title || ''}
        loading="lazy"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover' as const,
          transition: 'transform 0.3s ease',
        }}
        onError={(e) => {
          const fallbackIdx = hashStr(title + '_fallback') % FALLBACK_IMAGES.length;
          (e.target as HTMLImageElement).src = FALLBACK_IMAGES[fallbackIdx];
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0) 100%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '10px 16px 12px',
          display: 'flex',
          flexDirection: 'column' as const,
          gap: '4px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#FFF',
            lineHeight: '1.35',
            letterSpacing: '-0.1px',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            fontFamily: "'Noto Sans SC', -apple-system, sans-serif",
            textShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        >
          {title || ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.8)',
              backgroundColor: 'rgba(255,255,255,0.15)',
              padding: '1px 7px',
              borderRadius: '3px',
              letterSpacing: '0.2px',
              backdropFilter: 'blur(4px)',
            }}
          >
            {categoryName || ''}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ArticleCover;

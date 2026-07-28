import { useEffect } from 'react';

export function useSEO(title: string, description: string, keywords?: string[]) {
  useEffect(() => {
    document.title = title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);
    else {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = description;
      document.head.appendChild(m);
    }
    const metaKW = document.querySelector('meta[name="keywords"]');
    if (metaKW) metaKW.setAttribute('content', keywords?.join(',') || '');
    else if (keywords && keywords.length > 0) {
      const kw = document.createElement('meta');
      kw.name = 'keywords';
      kw.content = keywords.join(',');
      document.head.appendChild(kw);
    }
  }, [title, description, keywords]);
}

import { useState, useEffect } from 'react';
import { List } from 'lucide-react';

interface TableOfContentsProps {
  content: string;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ content }) => {
  const [activeId, setActiveId] = useState<string>('');

  const headings = extractHeadings(content);

  useEffect(() => {
    const observerOptions = {
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id);
        }
      });
    }, observerOptions);

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (headings.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <List size={18} style={styles.icon} />
        <span style={styles.title}>目录</span>
      </div>
      <nav style={styles.nav}>
        {headings.map((heading) => (
          <button
            key={heading.id}
            onClick={() => scrollToHeading(heading.id)}
            style={{
              ...styles.item,
              paddingLeft: heading.level === 3 ? '32px' : '16px',
              color: activeId === heading.id ? '#2563EB' : '#64748B',
              fontWeight: activeId === heading.id ? 600 : 400,
              backgroundColor: activeId === heading.id ? '#EFF6FF' : 'transparent',
            }}
          >
            <span style={styles.itemText}>{heading.text}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

function extractHeadings(content: string): TocItem[] {
  const lines = content.split('\n');
  const headings: TocItem[] = [];
  let h2Count = 0;
  let h3Count = 0;

  for (const line of lines) {
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      h2Count++;
      h3Count = 0;
      headings.push({
        id: `heading-${h2Count}`,
        text: line.slice(3).trim(),
        level: 2,
      });
    } else if (line.startsWith('### ')) {
      h3Count++;
      headings.push({
        id: `heading-${h2Count}-${h3Count}`,
        text: line.slice(4).trim(),
        level: 3,
      });
    }
  }

  return headings;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'sticky' as const,
    top: '100px',
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #E2E8F0',
  },
  icon: {
    color: '#2563EB',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#0F172A',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  item: {
    display: 'block',
    width: '100%',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    textAlign: 'left' as const,
    transition: 'all 0.2s ease',
  },
  itemText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    display: 'block',
  },
};

export default TableOfContents;

import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ArticleContentProps {
  content: string;
  article?: any;
}

const ArticleContent: React.FC<ArticleContentProps> = ({ content, article }) => {
  const navigate = useNavigate();

  const solutionSteps: string[] = article?.solutionSteps || [];
  const actionCommand: string = article?.actionCommand || '';
  const ctaButton: { text: string; link: string } | null = article?.ctaButton || null;

  const handleCtaClick = () => {
    if (ctaButton?.link) {
      if (ctaButton.link.startsWith('/')) {
        navigate(ctaButton.link);
      } else {
        window.open(ctaButton.link, '_blank');
      }
    } else {
      navigate('/chat');
    }
  };

  const extractKeywords = (): string => {
    if (!content) return 'Agent安全';
    const keywords = ['Prompt注入', '数据泄露', '权限绕过', 'Agent', 'RAG', '工具调用', 'LLM'];
    for (const kw of keywords) {
      if (content.includes(kw)) return kw;
    }
    return 'Agent安全';
  };

  const renderMarkdown = (markdown: string): React.ReactNode[] => {
    const lines = markdown.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeLanguage = '';
    let elementKey = 0;
    const totalLines = lines.filter(l => l.trim() && !l.startsWith('```')).length;
    let renderedContentLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={elementKey++} style={styles.codeBlock}>
              <code style={styles.code}>{codeBlockContent.join('\n')}</code>
            </pre>
          );
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeLanguage = line.slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      const isContentLine = line.trim() !== '' && !line.startsWith('## ') && !line.startsWith('### ') && !line.startsWith('- ');
      if (isContentLine) renderedContentLines++;

      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={elementKey++} style={styles.h2}>
            {renderInline(line.slice(3))}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={elementKey++} style={styles.h3}>
            {renderInline(line.slice(4))}
          </h3>
        );
      } else if (line.startsWith('- ')) {
        const listItems: React.ReactNode[] = [renderInline(line.slice(2))];
        while (i + 1 < lines.length && lines[i + 1].startsWith('- ')) {
          i++;
          listItems.push(renderInline(lines[i].slice(2)));
        }
        elements.push(
          <ul key={elementKey++} style={styles.list}>
            {listItems.map((item, idx) => (
              <li key={idx} style={styles.listItem}>{item}</li>
            ))}
          </ul>
        );
      } else if (line.trim() === '') {
        continue;
      } else {
        elements.push(
          <p key={elementKey++} style={styles.paragraph}>
            {renderInline(line)}
          </p>
        );

        if (totalLines > 4 && renderedContentLines >= Math.floor(totalLines / 2)) {
          const ctaInserted = elements.find((el: any) => el?.key === '__cta__');
          if (!ctaInserted) {
            elements.push(
              <div key="__cta__" style={styles.ctaCard}>
                <div style={styles.ctaTitle}>💡 别光看，动手测一下你的 Agent</div>
                <div style={styles.ctaDesc}>你刚才看到的 {extractKeywords()} 风险，可能正在你的 Agent 上发生...</div>
                <button onClick={handleCtaClick} style={styles.ctaButton}>
                  点击检测你的 Agent →
                </button>
              </div>
            );
          }
        }
      }
    }

    return elements;
  };

  const renderInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const italicMatch = remaining.match(/\*(.+?)\*/);
      const codeMatch = remaining.match(/`(.+?)`/);
      const imageMatch = remaining.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

      const matches = [
        { match: boldMatch, type: 'bold' },
        { match: italicMatch, type: 'italic' },
        { match: codeMatch, type: 'code' },
        { match: imageMatch, type: 'image' },
        { match: linkMatch, type: 'link' },
      ].filter(m => m.match);

      if (matches.length === 0) {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }

      const earliest = matches.reduce((a, b) =>
        a.match!.index! < b.match!.index! ? a : b
      );

      if (earliest.match!.index! > 0) {
        parts.push(
          <span key={key++}>{remaining.slice(0, earliest.match!.index)}</span>
        );
      }

      switch (earliest.type) {
        case 'bold':
          parts.push(
            <strong key={key++} style={{ fontWeight: 700 }}>
              {earliest.match![1]}
            </strong>
          );
          break;
        case 'italic':
          parts.push(
            <em key={key++} style={{ fontStyle: 'italic' }}>
              {earliest.match![1]}
            </em>
          );
          break;
        case 'code':
          parts.push(
            <code key={key++} style={styles.inlineCode}>
              {earliest.match![1]}
            </code>
          );
          break;
        case 'image':
          parts.push(
            <img
              key={key++}
              src={earliest.match![2]}
              alt={earliest.match![1]}
              style={styles.image}
            />
          );
          break;
        case 'link':
          parts.push(
            <a
              key={key++}
              href={earliest.match![2]}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              {earliest.match![1]}
            </a>
          );
          break;
      }

      remaining = remaining.slice((earliest.match?.index || 0) + earliest.match![0].length);
    }

    return parts;
  };

  const hasXinfaData = solutionSteps.length > 0 || actionCommand || ctaButton;

  return (
    <div style={styles.container}>
      {/* 心法结构化内容区块 */}
      {article?.realCaseTitle && (
        <div style={styles.sectionBlock}>
          <div style={styles.sectionLabel}>📌 真实踩坑案例</div>
          <h2 style={styles.sectionHeading}>{article.realCaseTitle}</h2>
          {article.realCaseContent && (
            <div style={styles.sectionBody}>{article.realCaseContent}</div>
          )}
        </div>
      )}

      {/* 正文内容 */}
      {renderMarkdown(content)}

      {/* 解决方案步骤 */}
      {solutionSteps.length > 0 && (
        <div style={styles.solutionBlock}>
          <div style={styles.solutionLabel}>🛠️ 解决方案</div>
          <ol style={styles.solutionList}>
            {solutionSteps.map((step, idx) => (
              <li key={idx} style={styles.solutionItem}>
                <span style={styles.stepNumber}>{idx + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 行动指令区 */}
      {(actionCommand || ctaButton) && (
        <div style={styles.actionCommandBox}>
          <div style={styles.actionIcon}>⚡</div>
          <div style={styles.actionContent}>
            <div style={styles.actionLabel}>下一步行动</div>
            <div style={styles.actionText}>{actionCommand || '现在就动手检查你的 Agent，别等踩了坑才后悔！'}</div>
            <button onClick={handleCtaClick} style={styles.actionBtn}>
              {ctaButton?.text || '立即检测 →'}
            </button>
          </div>
        </div>
      )}

      {/* 用户筛选区 */}
      <div style={styles.userFilterBox}>
        <div style={styles.filterText}>
          👆 以上内容适合正在做 <strong>Agent 安全审计 / AI 应用开发</strong> 的兄弟，
          如果你只是随便看看，可以关掉了——这篇文章帮不到你。
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '800px',
    fontSize: '16px',
    lineHeight: 1.8,
    color: '#334155',
  },
  h2: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#0F172A',
    marginTop: '40px',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '2px solid #E2E8F0',
  },
  h3: {
    fontSize: '22px',
    fontWeight: 600,
    color: '#0F172A',
    marginTop: '32px',
    marginBottom: '16px',
  },
  paragraph: {
    margin: '0 0 1.5em 0',
  },
  list: {
    margin: '0 0 1.5em 0',
    paddingLeft: '24px',
  },
  listItem: {
    marginBottom: '8px',
  },
  codeBlock: {
    backgroundColor: '#F1F5F9',
    borderRadius: '8px',
    padding: '20px',
    overflowX: 'auto',
    margin: '24px 0',
  },
  code: {
    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
    fontSize: '14px',
    lineHeight: 1.6,
    display: 'block',
  },
  inlineCode: {
    backgroundColor: '#F1F5F9',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
    fontSize: '14px',
    color: '#E11D48',
  },
  image: {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '8px',
    margin: '16px 0',
    display: 'block',
  },
  link: {
    color: '#2563EB',
    textDecoration: 'none',
    transition: 'color 0.2s',
  },

  sectionBlock: {
    margin: '32px 0',
    padding: '24px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
    border: '1px solid #F59E0B',
  },
  sectionLabel: {
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: 700,
    color: '#B45309',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '12px',
  },
  sectionHeading: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#92400E',
    margin: '0 0 16px 0',
  },
  sectionBody: {
    fontSize: '15px',
    lineHeight: 1.8,
    color: '#78350F',
  },

  ctaCard: {
    margin: '32px 0',
    padding: '24px',
    borderRadius: 8,
    border: '1px dashed #7C3AED',
    background: 'linear-gradient(135deg, rgba(124,58,237,0.04), rgba(236,72,153,0.04))',
    textAlign: 'center' as const,
  },
  ctaTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#7C3AED',
    marginBottom: 8,
  },
  ctaDesc: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  ctaButton: {
    padding: '10px 28px',
    borderRadius: 6,
    background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
    color: '#fff',
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
  },

  solutionBlock: {
    margin: '32px 0',
    padding: '24px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
    border: '1px solid #10B981',
  },
  solutionLabel: {
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: 700,
    color: '#047857',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '16px',
  },
  solutionList: {
    paddingLeft: '0',
    margin: 0,
    listStyle: 'none',
  },
  solutionItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '10px 0',
    fontSize: '15px',
    lineHeight: 1.7,
    color: '#065F46',
    borderBottom: '1px solid rgba(16,185,129,0.15)',
  },
  stepNumber: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '26px',
    minWidth: '26px',
    borderRadius: '50%',
    background: '#10B981',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 700,
    flexShrink: 0,
    marginTop: '2px',
  },

  actionCommandBox: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
    margin: '40px 0 24px 0',
    padding: '28px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
    color: '#FFFFFF',
  },
  actionIcon: {
    fontSize: '42px',
    flexShrink: 0,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '1.5px',
    opacity: 0.85,
    marginBottom: '8px',
  },
  actionText: {
    fontSize: '18px',
    fontWeight: 600,
    lineHeight: 1.55,
    marginBottom: '16px',
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '12px 28px',
    borderRadius: '8px',
    background: '#FFFFFF',
    color: '#7C3AED',
    border: 'none',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },

  userFilterBox: {
    margin: '24px 0',
    padding: '18px 22px',
    borderRadius: '8px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
  },
  filterText: {
    fontSize: '14px',
    lineHeight: 1.65,
    color: '#64748B',
  },
};

export default ArticleContent;

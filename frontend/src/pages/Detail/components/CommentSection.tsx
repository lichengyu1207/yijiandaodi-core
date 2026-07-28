import { useState } from 'react';
import { Send } from 'lucide-react';

interface Comment {
  id: number;
  avatar: string;
  username: string;
  content: string;
  created_at: string;
  like_count?: number;
}

interface CommentSectionProps {
  comments?: Comment[];
  onAddComment?: (content: string, parentId?: number | null) => Promise<boolean>;
}

const STYLES = {
  container: {
    marginTop: 40,
    paddingTop: 30,
    borderTop: '1px solid #E2E8F0',
  } as React.CSSProperties,
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 24px',
  } as React.CSSProperties,
  inputWrapper: {
    marginBottom: 24,
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    minHeight: 100,
    padding: '14px 16px',
    borderRadius: 6,
    border: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 14,
    lineHeight: 1.6,
    resize: 'vertical' as const,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  } as React.CSSProperties,
  submitRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 10,
  } as React.CSSProperties,
  submitBtn: {
    padding: '8px 20px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'background-color 0.2s ease',
  } as React.CSSProperties,
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
    cursor: 'not-allowed',
  } as React.CSSProperties,
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  } as React.CSSProperties,
  item: {
    display: 'flex',
    gap: 14,
    padding: '16px 0',
    borderBottom: '1px solid #F1F5F9',
  } as React.CSSProperties,
  avatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    objectFit: 'cover' as const,
    flexShrink: 0,
  } as React.CSSProperties,
  content: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  } as React.CSSProperties,
  username: {
    fontSize: 14,
    fontWeight: 600,
    color: '#0F172A',
  } as React.CSSProperties,
  time: {
    fontSize: 12,
    color: '#94A3B8',
  } as React.CSSProperties,
  text: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 1.6,
    margin: 0,
  } as React.CSSProperties,
  empty: {
    textAlign: 'center' as const,
    padding: '40px 0',
    color: '#94A3B8',
    fontSize: 14,
  } as React.CSSProperties,
};

const CommentSection: React.FC<CommentSectionProps> = ({ comments = [], onAddComment }) => {
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localComments, setLocalComments] = useState<Comment[]>(comments);

  const formatTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return '刚刚';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`;
      if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}天前`;
      return date.toLocaleDateString('zh-CN');
    } catch {
      return dateString;
    }
  };

  const handleSubmit = async () => {
    if (!inputValue.trim() || submitting) return;

    setSubmitting(true);
    let success = false;

    if (onAddComment) {
      success = await onAddComment(inputValue);
    }

    if (success) {
      setInputValue('');
      // 乐观更新：立即显示新评论
      const newComment: Comment = {
        id: Date.now(),
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=visitor',
        username: '访客用户',
        content: inputValue.trim(),
        created_at: new Date().toISOString(),
        like_count: 0,
      };
      setLocalComments([newComment, ...localComments]);
    }

    setSubmitting(false);
  };

  const displayComments = localComments.length > 0 ? localComments : comments;

  return (
    <div style={STYLES.container}>
      <h3 style={STYLES.title}>评论 ({displayComments.length})</h3>

      <div style={STYLES.inputWrapper}>
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="写下你的想法..."
          style={STYLES.textarea}
          onFocus={(e) => {
            e.target.style.borderColor = '#2563EB';
            e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#E2E8F0';
            e.target.style.boxShadow = 'none';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <div style={STYLES.submitRow}>
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim() || submitting}
            style={{
              ...STYLES.submitBtn,
              ...((!inputValue.trim() || submitting) ? STYLES.submitBtnDisabled : {}),
            }}
          >
            <Send size={16} />
            {submitting ? '发送中...' : '发表评论'}
          </button>
        </div>
      </div>

      {displayComments.length > 0 ? (
        <ul style={STYLES.list}>
          {displayComments.map((comment) => (
            <li key={comment.id} style={STYLES.item}>
              <img
                src={comment.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.username}`}
                alt={comment.username}
                style={STYLES.avatar}
              />
              <div style={STYLES.content}>
                <div style={STYLES.header}>
                  <span style={STYLES.username}>{comment.username}</span>
                  <span style={STYLES.time}>{formatTime(comment.created_at)}</span>
                </div>
                <p style={STYLES.text}>{comment.content}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p style={STYLES.empty}>暂无评论，快来发表第一条吧~</p>
      )}
    </div>
  );
};

export default CommentSection;

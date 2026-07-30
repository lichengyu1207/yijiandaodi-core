import { useState } from 'react';
import { Modal, message } from 'antd';
import { Star, Send, Heart, X } from 'lucide-react';
import { submitFeedback } from '@/api/paymentApi';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  sessionId?: string;
}

const FEEDBACK_TYPES = [
  { value: 'agent_quality', label: 'Agent 质量' },
  { value: 'response_speed', label: '响应速度' },
  { value: 'product_suggestion', label: '产品建议' },
  { value: 'bug_report', label: 'Bug 报告' },
];

const STYLES = {
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 18,
    fontWeight: 600,
    color: '#1D2129',
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: '#4E5969',
    marginBottom: 10,
    display: 'block',
  },
  starsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  star: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  select: {
    width: '100%',
    height: 40,
    padding: '8px 12px',
    border: '1px solid #E5E6EB',
    borderRadius: 6,
    fontSize: 14,
    outline: 'none',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    minHeight: 100,
    padding: 12,
    border: '1px solid #E5E6EB',
    borderRadius: 8,
    fontSize: 14,
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    outline: 'none',
    lineHeight: 1.6,
  },
  sessionIdDisplay: {
    fontSize: 12,
    color: '#86909C',
    marginTop: 6,
    fontFamily: 'monospace',
  },
  footer: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 28,
  },
  skipButton: {
    flex: 1,
    height: 44,
    background: '#F2F3F5',
    border: 'none',
    borderRadius: 8,
    color: '#4E5969',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.25s ease',
  },
  submitButton: {
    flex: 1,
    height: 44,
    background: 'linear-gradient(135deg, #165DFF 0%, #0E42D2 100%)',
    border: 'none',
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.25s ease',
  },
};

const FeedbackModal: React.FC<FeedbackModalProps> = ({
  visible,
  onClose,
  sessionId,
}) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackType, setFeedbackType] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      message.warning('请选择评分');
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback({
        rating,
        feedback_type: feedbackType || undefined,
        content: content || undefined,
        session_id: sessionId,
      });
      message.success('反馈提交成功，感谢您的意见！');
      handleReset();
      onClose();
    } catch (err) {
      console.error('提交反馈失败:', err);
      message.error('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setRating(0);
    setFeedbackType('');
    setContent('');
  };

  return (
    <Modal
      open={visible}
      onCancel={() => {
        handleReset();
        onClose();
      }}
      footer={null}
      width={480}
      styles={{ body: { padding: 24 } }}
    >
      <div style={STYLES.title}>
        <Heart size={22} color="#F53F3F" />
        您的反馈对我们很重要
        <Heart size={18} color="#F53F3F" />
      </div>

      <div style={STYLES.section}>
        <label style={STYLES.label}>⭐ 星级评分（必填）</label>
        <div style={STYLES.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={26}
              style={{
                ...STYLES.star,
                color: (hoverRating || rating) >= star ? '#FFB900' : '#E5E6EB',
                transform: hoverRating >= star ? 'scale(1.15)' : 'scale(1)',
              }}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              fill={(hoverRating || rating) >= star ? '#FFB900' : 'none'}
            />
          ))}
          <span style={{ marginLeft: 8, fontSize: 13, color: '#86909C' }}>
            {rating > 0 ? `${rating} 分` : '点击评分'}
          </span>
        </div>
      </div>

      <div style={STYLES.section}>
        <label style={STYLES.label}>📝 反馈类型</label>
        <select
          value={feedbackType}
          onChange={(e) => setFeedbackType(e.target.value)}
          style={STYLES.select}
        >
          <option value="">请选择反馈类型（选填）</option>
          {FEEDBACK_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      <div style={STYLES.section}>
        <label style={STYLES.label}>💬 详细描述（选填）</label>
        <textarea
          placeholder="请详细描述您的问题或建议..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={STYLES.textarea}
          onFocus={(e) => e.currentTarget.style.borderColor = '#165DFF'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#E5E6EB'}
        />
        {sessionId && (
          <div style={STYLES.sessionIdDisplay}>
            会话 ID: {sessionId}
          </div>
        )}
      </div>

      <div style={STYLES.footer}>
        <button
          style={STYLES.skipButton}
          onClick={() => {
            handleReset();
            onClose();
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E5E6EB'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F2F3F5'}
        >
          跳过
        </button>
        <button
          style={{
            ...STYLES.submitButton,
            opacity: submitting ? 0.7 : 1,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
          onClick={handleSubmit}
          disabled={submitting}
          onMouseEnter={(e) => {
            if (!submitting) e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <Send size={16} />
          {submitting ? '提交中...' : '提交反馈'}
        </button>
      </div>
    </Modal>
  );
};

export default FeedbackModal;

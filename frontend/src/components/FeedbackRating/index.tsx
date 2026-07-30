import { useState } from 'react';
import { Star, Smile, Meh, Lightbulb, Bug, Send, CheckCircle } from 'lucide-react';

interface FeedbackRatingProps {
  onSubmit?: (rating: number, feedbackType: string, content?: string) => void;
  showTypes?: boolean;
  size?: 'small' | 'medium' | 'large';
  defaultValue?: number;
}

const SIZES = {
  small: { star: 18, gap: 4 },
  medium: { star: 24, gap: 6 },
  large: { star: 32, gap: 8 },
};

const FEEDBACK_TYPES = [
  { icon: <Smile size={16} />, label: 'Agent回答很准确', value: 'accurate', emoji: '😊' },
  { icon: <Meh size={16} />, label: '响应速度需要提升', value: 'speed', emoji: '😐' },
  { icon: <Lightbulb size={16} />, label: '有个建议', value: 'suggestion', emoji: '💡' },
  { icon: <Bug size={16} />, label: '遇到了Bug', value: 'bug', emoji: '🐛' },
];

const STYLES = {
  container: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxWidth: 480,
  },
  starsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  star: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  ratingText: {
    fontSize: 14,
    color: '#86909C',
    marginLeft: 8,
  },
  typesContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 16,
  },
  typeButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 20,
    border: '1px solid #E5E6EB',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    fontSize: 13,
    color: '#4E5969',
    transition: 'all 0.2s ease',
  },
  textArea: {
    width: '100%',
    minHeight: 80,
    padding: 12,
    border: '1px solid #E5E6EB',
    borderRadius: 8,
    fontSize: 14,
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    marginTop: 12,
  },
  submitButton: {
    width: '100%',
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
    marginTop: 16,
    transition: 'all 0.25s ease',
  },
  successMessage: {
    textAlign: 'center' as const,
    padding: 24,
  },
  successIcon: {
    color: '#00B42A',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1D2129',
    marginBottom: 6,
  },
  successDesc: {
    fontSize: 14,
    color: '#86909C',
  },
};

const FeedbackRating: React.FC<FeedbackRatingProps> = ({
  onSubmit,
  showTypes = true,
  size = 'medium',
  defaultValue = 0,
}) => {
  const [rating, setRating] = useState(defaultValue);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const currentSize = SIZES[size];

  const getRatingLabel = (value: number) => {
    if (value === 0) return '点击评分';
    if (value <= 2) return '需要改进';
    if (value === 3) return '一般';
    if (value === 4) return '满意';
    return '非常满意';
  };

  const handleSubmit = () => {
    if (rating === 0) return;
    onSubmit?.(rating, selectedType || '', content || undefined);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ ...STYLES.container, ...STYLES.successMessage }}>
        <CheckCircle size={48} style={STYLES.successIcon} />
        <div style={STYLES.successTitle}>感谢您的反馈！</div>
        <div style={STYLES.successDesc}>我们会持续改进，为您提供更好的服务</div>
      </div>
    );
  }

  return (
    <div style={STYLES.container}>
      <div style={STYLES.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={currentSize.star}
            style={{
              ...STYLES.star,
              color: (hoverRating || rating) >= star ? '#FFB900' : '#E5E6EB',
              transform: hoverRating >= star ? 'scale(1.1)' : 'scale(1)',
            }}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(star)}
            fill={(hoverRating || rating) >= star ? '#FFB900' : 'none'}
          />
        ))}
        <span style={STYLES.ratingText}>{getRatingLabel(hoverRating || rating)}</span>
      </div>

      {showTypes && rating > 0 && (
        <div style={STYLES.typesContainer}>
          {FEEDBACK_TYPES.map((type) => (
            <button
              key={type.value}
              style={{
                ...STYLES.typeButton,
                borderColor: selectedType === type.value ? '#165DFF' : '#E5E6EB',
                backgroundColor: selectedType === type.value ? '#F0F5FF' : '#FFFFFF',
                color: selectedType === type.value ? '#165DFF' : '#4E5969',
              }}
              onClick={() => setSelectedType(type.value === selectedType ? null : type.value)}
            >
              <span>{type.emoji}</span>
              <span>{type.label}</span>
            </button>
          ))}
        </div>
      )}

      {(selectedType || content) && (
        <textarea
          placeholder="请详细描述您的反馈（选填）"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{
            ...STYLES.textArea,
            borderColor: document.activeElement === e.currentTarget ? '#165DFF' : '#E5E6EB',
          }}
        />
      )}

      {(selectedType || content) && (
        <button
          style={STYLES.submitButton}
          onClick={handleSubmit}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Send size={16} />
          提交反馈
        </button>
      )}
    </div>
  );
};

export default FeedbackRating;

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coffee,
  X,
  Send,
  Heart,
  MessageSquare,
  UserCheck,
  Gift,
  CheckCircle2,
  Share2,
  ArrowRight,
  Download,
  Copy,
  Twitter,
} from 'lucide-react';
import { toPng } from 'html-to-image';

interface TipModalProps {
  open: boolean;
  onClose: () => void;
  receiverId: number;
  receiverName?: string;
  receiverAvatar?: string;
  contentType?: 'article' | 'user' | 'page';
  contentId?: number;
  onSuccess?: (tipId: number) => void;
  onError?: (error: string) => void;
}

const TIP_OPTIONS = [
  { key: 'coffee', emoji: '☕', label: '咖啡', amount: 3 },
  { key: 'tea', emoji: '🧋', label: '奶茶', amount: 5 },
  { key: 'lunch', emoji: '🍱', label: '午餐', amount: 15 },
  { key: 'dinner', emoji: '🍽️', label: '晚餐', amount: 30 },
  { key: 'movie', emoji: '🎬', label: '电影', amount: 50 },
];

const QUICK_MESSAGES = [
  '太棒了！感谢你的帮助！☕',
  '这个内容非常有用！',
  '支持一下，继续加油！💪',
  '希望能帮助更多人！🌟',
];

const ConfettiParticles = ({ count = 50 }) => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

  return (
    <div className="confetti-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="confetti-particle"
          initial={{
            x: 0,
            y: 0,
            opacity: 1,
            rotate: 0,
          }}
          animate={{
            x: (Math.random() - 0.5) * window.innerWidth,
            y: Math.random() * window.innerHeight * 0.8 + 200,
            opacity: [1, 1, 0],
            rotate: Math.random() * 720 - 360,
          }}
          transition={{
            duration: Math.random() * 2 + 2,
            delay: Math.random() * 0.3,
            ease: "easeOut",
          }}
          style={{
            backgroundColor: colors[i % colors.length],
            width: `${Math.random() * 10 + 5}px`,
            height: `${Math.random() * 10 + 5}px`,
            position: 'absolute',
            top: '50%',
            left: '50%',
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }}
        />
      ))}
    </div>
  );
};

const CoffeeCupAnimation = () => (
  <motion.div
    className="coffee-cup-container"
    initial={{ y: 100, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay: 0.5, type: "spring" }}
    style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}
  >
    <motion.div
      animate={{ rotate: [-2, 2, -1, 1, 0] }}
      transition={{
        duration: 2,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut",
      }}
      style={{ transformOrigin: 'bottom center' }}
    >
      <svg viewBox="0 0 100 120" style={{ width: 120, height: 144 }}>
        <path d="M20,30 L80,30 L75,100 L25,100 Z" fill="#8B4513" stroke="#5D2906" strokeWidth="2"/>
        <path d="M80,40 Q95,40 95,60 Q95,80 80,80" fill="none" stroke="#5D2906" strokeWidth="4"/>
        <motion.path
          d="M25,35 L75,35 L72,55 L28,55 Z"
          fill="#3E2723"
          initial={{ d: "M25,45 L75,45 L72,45 L28,45 Z" }}
          animate={{ d: "M25,35 L75,35 L72,55 L28,55 Z" }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
        {[0, 1, 2].map((i) => (
          <motion.path
            key={i}
            d={`M${35 + i*15},25 Q${37 + i*15},15 ${35 + i*15},5`}
            stroke="#FFFFFF"
            strokeWidth="2"
            fill="none"
            opacity={0.6}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: 1,
              opacity: [0, 0.6, 0],
              y: [-5, -15]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.4,
            }}
          />
        ))}
      </svg>
    </motion.div>
  </motion.div>
);

const AvatarFlyIn = ({ avatarUrl }: { avatarUrl?: string }) => (
  <motion.div
    className="avatar-fly-in"
    initial={{ x: -500, y: -300, scale: 0, opacity: 0 }}
    animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
    transition={{
      type: "spring",
      stiffness: 100,
      damping: 12,
      delay: 1.2,
    }}
    style={{
      width: 64,
      height: 64,
      borderRadius: '50%',
      background: avatarUrl
        ? `url(${avatarUrl}) center/cover`
        : 'linear-gradient(135deg, #FFB800, #FF8C00)',
      border: '3px solid #FFF',
      boxShadow: '0 4px 16px rgba(255, 140, 0, 0.3)',
      margin: '0 auto 16px',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {!avatarUrl && <Coffee size={32} color="#FFF" />}
    <motion.div
      className="avatar-glow"
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
      }}
      style={{
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,184,0,0.3) 0%, transparent 70%)',
      }}
    />
  </motion.div>
);

const TypewriterText = ({ text, speed = 50 }: { text: string; speed?: number }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <motion.p
      className="typewriter-text"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2 }}
      style={{
        fontSize: 18,
        fontWeight: 600,
        color: '#333',
        margin: '0 auto 24px',
        textAlign: 'center',
        minHeight: 27,
      }}
    >
      {displayedText}
      <motion.span
        className="cursor"
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        style={{ color: '#FF8C00' }}
      >
        |
      </motion.span>
    </motion.p>
  );
};

const SuccessAnimation = ({
  visible,
  amount,
  supporterName,
  creatorName,
  supporterAvatar,
}: {
  visible: boolean;
  amount: number;
  supporterName: string;
  creatorName: string;
  supporterAvatar?: string;
}) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="success-animation-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
          }}
        >
          <ConfettiParticles count={50} />
          <CoffeeCupAnimation />
          <AvatarFlyIn avatarUrl={supporterAvatar} />
          <TypewriterText
            text={`感谢 ${supporterName} 请 ${creatorName} 喝咖啡！☕`}
            speed={50}
          />
          <motion.div
            className="amount-display"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: '#FFF',
              marginBottom: 32,
              textShadow: '0 4px 20px rgba(255, 140, 0, 0.5)',
            }}
          >
            <span style={{ fontSize: 36 }}>¥</span>
            <span>{amount.toFixed(2)}</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ShareCardContent = ({ data, preview = false }: { data: any; preview?: boolean }) => (
  <div
    className={`share-card ${preview ? 'preview-mode' : ''}`}
    style={{
      width: 800,
      height: 400,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: 20,
      padding: 40,
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#FFF',
      boxShadow: preview ? '0 8px 32px rgba(102, 126, 234, 0.4)' : 'none',
    }}
  >
    <div style={{
      position: 'absolute',
      top: -50,
      right: -50,
      width: 200,
      height: 200,
      borderRadius: '50%',
      background: 'rgba(255, 255, 255, 0.1)',
    }} />
    <div style={{
      position: 'absolute',
      bottom: -30,
      left: -30,
      width: 150,
      height: 150,
      borderRadius: '50%',
      background: 'rgba(255, 255, 255, 0.08)',
    }} />

    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 40,
    }}>
      <div style={{
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: '1px',
      }}>
        一鉴到底
      </div>
      <div style={{
        background: 'rgba(255, 255, 255, 0.2)',
        padding: '6px 16px',
        borderRadius: 20,
        fontSize: 14,
        fontWeight: 600,
      }}>
        ☕ Coffee Support
      </div>
    </div>

    <div style={{
      textAlign: 'center',
      marginBottom: 32,
    }}>
      <div style={{
        fontSize: 56,
        fontWeight: 800,
        textShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
      }}>
        <span style={{ fontSize: 40 }}>¥</span>
        {data.amount?.toFixed(2)}
      </div>
      {data.message && (
        <blockquote style={{
          fontStyle: 'italic',
          fontSize: 18,
          marginTop: 16,
          opacity: 0.95,
          maxWidth: 500,
          margin: '16px auto 0',
          lineHeight: 1.6,
        }}>
          "{data.message}"
        </blockquote>
      )}
    </div>

    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginTop: 'auto',
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: data.creatorAvatar
          ? `url(${data.creatorAvatar}) center/cover`
          : 'rgba(255, 255, 255, 0.3)',
        flexShrink: 0,
        border: '2px solid rgba(255, 255, 255, 0.5)',
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, opacity: 0.9 }}>支持了</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{data.creatorName || '创作者'}</div>
      </div>
    </div>
  </div>
);

const ShareCardGenerator = ({ tipData, receiverName, receiverAvatar }: { tipData: any; receiverName: string; receiverAvatar?: string }) => {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);

  const generateShareCard = async () => {
    if (!cardRef.current) return;

    setGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        width: 800,
        height: 400,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `coffee-tip-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Generate card error:', error);
    } finally {
      setGenerating(false);
    }
  };

  const shareToPlatform = (platform: string) => {
    const text = `我刚刚支持了 ${receiverName} 一杯咖啡☕ ¥${tipData.amount}\n\n"${tipData.message || '默默支持'}"\n\n来给他也买一杯吧！`;
    const url = window.location.href;

    switch (platform) {
      case 'weibo':
        window.open(`https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`);
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
        break;
      case 'copy':
        navigator.clipboard.writeText(`${text}\n${url}`);
        break;
      case 'wechat':
        setShowQRCodeModal(true);
        break;
    }
  };

  return (
    <>
      <div ref={cardRef}>
        <ShareCardContent data={{ ...tipData, creatorName: receiverName, creatorAvatar: receiverAvatar }} />
      </div>

      <div style={{ marginTop: 24 }}>
        <button
          onClick={generateShareCard}
          disabled={generating}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#FFF',
            fontSize: 15,
            fontWeight: 700,
            cursor: generating ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.3s',
            boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)',
            opacity: generating ? 0.7 : 1,
          }}
        >
          <Download size={18} />
          {generating ? '生成中...' : '下载分享卡片图片'}
        </button>

        <div style={{
          marginTop: 16,
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: 13,
            color: '#888',
            margin: '0 0 12px',
          }}>
            快速分享到：
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
          }}>
            <button
              onClick={() => shareToPlatform('weibo')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #E8E8E8',
                background: '#FFF',
                cursor: 'pointer',
                fontSize: 13,
                color: '#333',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              微博
            </button>
            <button
              onClick={() => shareToPlatform('wechat')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #E8E8E8',
                background: '#FFF',
                cursor: 'pointer',
                fontSize: 13,
                color: '#333',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              微信
            </button>
            <button
              onClick={() => shareToPlatform('twitter')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #E8E8E8',
                background: '#FFF',
                cursor: 'pointer',
                fontSize: 13,
                color: '#333',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Twitter
            </button>
            <button
              onClick={() => shareToPlatform('copy')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #E8E8E8',
                background: '#FFF',
                cursor: 'pointer',
                fontSize: 13,
                color: '#333',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Copy size={14} />
              复制文案
            </button>
          </div>
        </div>
      </div>

      {showQRCodeModal && (
        <div
          onClick={() => setShowQRCodeModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFF',
              borderRadius: 20,
              padding: 32,
              textAlign: 'center',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18, color: '#333' }}>
              微信扫码分享
            </h3>
            <div style={{
              width: 200,
              height: 200,
              background: '#F5F5F5',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#999',
            }}>
              二维码区域
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
              使用微信扫一扫分享给好友
            </p>
          </div>
        </div>
      )}
    </>
  );
};

const TipModal: React.FC<TipModalProps> = ({
  open,
  onClose,
  receiverId,
  receiverName = '创作者',
  receiverAvatar,
  contentType,
  contentId,
  onSuccess,
  onError,
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tipId, setTipId] = useState<number | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [finalAmount, setFinalAmount] = useState(0);
  const [supporterName, setSupporterName] = useState('');

  useEffect(() => {
    if (open) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setSupporterName(user.username || '匿名用户');
    }
  }, [open]);

  if (!open) return null;

  const calculateFinalAmount = () => {
    return selectedOption
      ? TIP_OPTIONS.find(o => o.key === selectedOption)?.amount || 0
      : customAmount
        ? parseFloat(customAmount)
        : 0;
  };

  const handleCreateTip = async () => {
    const amount = calculateFinalAmount();
    if (!amount || amount < 1) {
      onError?.('请选择或输入打赏金额');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/tips/create/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          to_user_id: receiverId,
          amount: amount,
          tip_option: selectedOption || 'custom',
          message,
          content_type: contentType || '',
          content_id: contentId || null,
          is_public: isPublic,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setFinalAmount(amount);
        setTipId(data.data.tip_id);
        setSuccess(true);
        setShowSuccessAnimation(true);
        setTimeout(() => {
          setShowSuccessAnimation(false);
        }, 4000);
        setTimeout(() => {
          onSuccess?.(data.data.tip_id);
        }, 2000);
      } else {
        onError?.(data.message || '创建失败');
      }
    } catch (error) {
      onError?.('网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedOption(null);
    setCustomAmount('');
    setMessage('');
    setIsPublic(true);
    setSuccess(false);
    setTipId(null);
    setShowSuccessAnimation(false);
    onClose();
  };

  const currentAmount = calculateFinalAmount();

  return (
    <>
      <SuccessAnimation
        visible={showSuccessAnimation}
        amount={finalAmount}
        supporterName={supporterName}
        creatorName={receiverName}
        supporterAvatar={JSON.parse(localStorage.getItem('user') || '{}').avatar}
      />

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          animation: 'fadeIn 0.25s ease-out',
        }}
        onClick={handleClose}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes successPulse {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>

        <div
          style={{
            width: '100%',
            maxWidth: 480,
            maxHeight: '90vh',
            background: '#FFFFFF',
            borderRadius: 20,
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            animation: 'slideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {!success ? (
            <>
              {/* Header */}
              <div
                style={{
                  padding: '24px 28px 20px',
                  borderBottom: '1px solid #F0F0F0',
                  position: 'relative',
                }}
              >
                <button
                  onClick={handleClose}
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: 'none',
                    background: '#F5F5F5',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666',
                    transition: 'all 0.2s',
                  }}
                >
                  <X size={18} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: receiverAvatar
                        ? `url(${receiverAvatar}) center/cover`
                        : 'linear-gradient(135deg, #FFB800, #FF8C00)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      flexShrink: 0,
                      border: '3px solid #FFF',
                      boxShadow: '0 4px 12px rgba(255, 140, 0, 0.25)',
                    }}
                  >
                    {!receiverAvatar && <Coffee size={28} color="#FFF" />}
                  </div>
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 20,
                        fontWeight: 700,
                        color: '#1a1a1a',
                        marginBottom: 4,
                      }}
                    >
                      支持 {receiverName}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: '#888',
                        lineHeight: 1.4,
                      }}
                    >
                      你的支持是创作者最大的动力 ☕
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: '24px 28px', overflowY: 'auto' }}>
                {/* Preset Amounts */}
                <div style={{ marginBottom: 22 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#333',
                      marginBottom: 12,
                    }}
                  >
                    选择金额
                  </label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    {TIP_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        onClick={() => {
                          setSelectedOption(option.key);
                          setCustomAmount('');
                        }}
                        style={{
                          padding: '14px 8px',
                          borderRadius: 14,
                          border:
                            selectedOption === option.key
                              ? '2.5px solid #FF8C00'
                              : '2px solid #E8E8E8',
                          background:
                            selectedOption === option.key
                              ? '#FFF8F0'
                              : '#FAFAFA',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 26 }}>{option.emoji}</span>
                        <span
                          style={{
                            fontSize: 11,
                            color: '#666',
                            fontWeight: 500,
                          }}
                        >
                          {option.label}
                        </span>
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color:
                              selectedOption === option.key
                                ? '#FF8C00'
                                : '#333',
                          }}
                        >
                          ¥{option.amount}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Custom Amount Input */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      placeholder="自定义金额"
                      value={customAmount}
                      onChange={(e) => {
                        setCustomAmount(e.target.value.replace(/[^\d.]/g, ''));
                        setSelectedOption(null);
                      }}
                      min={1}
                      max={10000}
                      style={{
                        width: '100%',
                        padding: '12px 16px 12px 40px',
                        borderRadius: 12,
                        border: customAmount
                          ? '2px solid #FF8C00'
                          : '2px solid #E8E8E8',
                        background: customAmount ? '#FFF8F0' : '#FAFAFA',
                        fontSize: 15,
                        outline: 'none',
                        transition: 'all 0.2s',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        left: 16,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#999',
                        fontSize: 16,
                        fontWeight: 600,
                      }}
                    >
                      ¥
                    </span>
                  </div>
                </div>

                {/* Message */}
                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#333',
                      marginBottom: 10,
                    }}
                  >
                    留言（可选）
                  </label>
                  <textarea
                    placeholder="写几句鼓励的话吧..."
                    value={message}
                    onChange={(e) =>
                      setMessage(e.target.value.slice(0, 200))
                    }
                    maxLength={200}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: '2px solid #E8E8E8',
                      background: '#FAFAFA',
                      fontSize: 14,
                      resize: 'none',
                      outline: 'none',
                      fontFamily: 'inherit',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) =>
                      (e.target.style.borderColor = '#FFB800')
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = '#E8E8E8')
                    }
                  />
                  <div
                    style={{
                      textAlign: 'right',
                      fontSize: 12,
                      color: '#AAA',
                      marginTop: 4,
                    }}
                  >
                    {message.length}/200
                  </div>

                  {/* Quick Messages */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    {QUICK_MESSAGES.map((msg) => (
                      <button
                        key={msg}
                        onClick={() => setMessage(msg)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 16,
                          border: '1px solid #E8E8E8',
                          background: '#FFF',
                          cursor: 'pointer',
                          fontSize: 12,
                          color: '#666',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            '#FFF8F0';
                          e.currentTarget.style.borderColor =
                            '#FFB800';
                          e.currentTarget.style.color = '#FF8C00';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#FFF';
                          e.currentTarget.style.borderColor = '#E8E8E8';
                          e.currentTarget.style.color = '#666';
                        }}
                      >
                        {msg}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Public/Anonymous Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: '#F9F9F9',
                    marginBottom: 24,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isPublic ? (
                      <UserCheck size={18} color="#52C41A" />
                    ) : (
                      <Gift size={18} color="#888" />
                    )}
                    <span style={{ fontSize: 14, color: '#333' }}>
                      {isPublic ? '公开显示' : '匿名打赏'}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsPublic(!isPublic)}
                    style={{
                      width: 48,
                      height: 26,
                      borderRadius: 13,
                      border: 'none',
                      background: isPublic ? '#52C41A' : '#CCC',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.3s',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: isPublic ? 26 : 2,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: '#FFF',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    />
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleCreateTip}
                  disabled={!currentAmount || currentAmount < 1 || submitting}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: 14,
                    border: 'none',
                    background:
                      !currentAmount || currentAmount < 1 || submitting
                        ? '#D9D9D9'
                        : 'linear-gradient(135deg, #FFB800 0%, #FF8C00 100%)',
                    color: '#FFF',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor:
                      !currentAmount || currentAmount < 1 || submitting
                        ? 'not-allowed'
                        : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.3s',
                    boxShadow:
                      !currentAmount || currentAmount < 1 || submitting
                        ? 'none'
                        : '0 6px 20px rgba(255, 140, 0, 0.4)',
                  }}
                >
                  {submitting ? (
                    <>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: '2px solid #FFF',
                          borderTopColor: 'transparent',
                          animation: 'spin 0.6s linear infinite',
                        }}
                      />
                      处理中...
                    </>
                  ) : (
                    <>
                      <Coffee size={20} />
                      请TA喝杯咖啡 ¥
                      {currentAmount.toFixed(2)}
                    </>
                  )}
                </button>

                <p
                  style={{
                    textAlign: 'center',
                    fontSize: 11,
                    color: '#BBB',
                    marginTop: 12,
                    marginBlockEnd: 0,
                  }}
                >
                  💡 支持微信/支付宝 · 安全加密 · 即时到账
                </p>
              </div>
            </>
          ) : (
            /* Success Page with Enhanced Features */
            <div
              style={{
                padding: '40px 28px',
                textAlign: 'center',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                style={{
                  width: 80,
                  height: 80,
                  margin: '0 auto 24px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #52C41A, #73D13D)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={42} color="#FFF" />
              </motion.div>

              <motion.h3
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#1a1a1a',
                  margin: '0 0 8px',
                }}
              >
                感谢您的支持！ 🎉
              </motion.h3>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                style={{
                  fontSize: 15,
                  color: '#666',
                  margin: '0 0 32px',
                  lineHeight: 1.6,
                }}
              >
                您已成功为 <strong>{receiverName}</strong> 赠送了{' '}
                <strong style={{ color: '#FF8C00' }}>¥{finalAmount.toFixed(2)}</strong>
              </motion.p>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                style={{
                  marginBottom: 24,
                }}
              >
                <ShareCardGenerator
                  tipData={{
                    amount: finalAmount,
                    message,
                  }}
                  receiverName={receiverName}
                  receiverAvatar={receiverAvatar}
                />
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  maxWidth: 280,
                  margin: '0 auto',
                }}
              >
                <button
                  onClick={() => {
                    window.location.href = '/support/' + receiverId;
                  }}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #FFB800, #FF8C00)',
                    color: '#FFF',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  查看我的打赏记录
                  <ArrowRight size={16} />
                </button>

                <button
                  onClick={handleClose}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 12,
                    border: '2px solid #E8E8E8',
                    background: '#FFF',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#666',
                    transition: 'all 0.2s',
                  }}
                >
                  关闭
                </button>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TipModal;

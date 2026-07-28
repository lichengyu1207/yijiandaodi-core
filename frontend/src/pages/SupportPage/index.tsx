import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Coffee,
  Users,
  TrendingUp,
  Calendar,
  Heart,
  ArrowLeft,
  Crown,
} from 'lucide-react';
import CoffeeButton from '@/components/CoffeeButton';

interface TipData {
  id: number;
  amount: number;
  message: string;
  from_user: {
    id: number;
    username: string;
    avatar: string;
  };
  created_at: string;
  tip_option: string;
}

interface SupporterData {
  user: {
    id: number;
    username: string;
    avatar: string;
  };
  total_amount: number;
  tip_count: number;
}

const SupportPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [totalTips, setTotalTips] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [recentTips, setRecentTips] = useState<TipData[]>([]);
  const [topSupporters, setTopSupporters] = useState<SupporterData[]>([]);

  useEffect(() => {
    if (userId) {
      loadTipWall();
    }
  }, [userId]);

  const loadTipWall = async () => {
    try {
      const response = await fetch(`/api/auth/tips/public/${userId}/`);
      const data = await response.json();

      if (data.success) {
        setUserInfo(data.data.user_info);
        setTotalTips(data.data.total_tips);
        setTotalAmount(data.data.total_amount);
        setRecentTips(data.data.recent_tips || []);
        setTopSupporters(data.data.top_supporters || []);
      }
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
        }}
      >
        加载中...
      </div>
    );
  }

  return (
    <div className="support-page" style={{ minHeight: '100vh', background: '#FAFAFA' }}>
      {/* Hero Section */}
      <div
        className="support-hero"
        style={{
          background: 'linear-gradient(135deg, #FFB800 0%, #FF8C00 100%)',
          padding: '60px 24px 80px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -30,
            left: -30,
            width: 150,
            height: 150,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
          }}
        />

        <a
          href="/"
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            color: '#FFF',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={18} />
          返回首页
        </a>

        <div
          style={{
            width: 120,
            height: 120,
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: userInfo?.avatar
              ? `url(${userInfo.avatar}) center/cover`
              : 'rgba(255, 255, 255, 0.2)',
            border: '4px solid rgba(255, 255, 255, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
          }}
        >
          {!userInfo?.avatar && <Coffee size={56} color="#FFF" />}
        </div>

        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: '#FFF',
            margin: '0 0 8px',
          }}
        >
          {userInfo?.username || '创作者'}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: 'rgba(255, 255, 255, 0.9)',
            margin: '0 0 28px',
          }}
        >
          感谢每一位支持者 ❤️
        </p>

        {userId && (
          <CoffeeButton
            receiverId={parseInt(userId)}
            receiverName={userInfo?.username}
            receiverAvatar={userInfo?.avatar}
            size="large"
            variant="primary"
          />
        )}
      </div>

      {/* Stats Cards */}
      <div
        style={{
          maxWidth: 900,
          margin: '-40px auto 32px',
          padding: '0 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 16,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            background: '#FFF',
            borderRadius: 16,
            padding: '24px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #FFB800, #FF8C00)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <TrendingUp size={24} color="#FFF" />
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: '#FF8C00',
              marginBottom: 4,
            }}
          >
            ¥{totalAmount.toFixed(2)}
          </div>
          <div style={{ fontSize: 13, color: '#888' }}>总收入</div>
        </div>

        <div
          style={{
            background: '#FFF',
            borderRadius: 16,
            padding: '24px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #52C41A, #73D13D)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <Users size={24} color="#FFF" />
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: '#52C41A',
              marginBottom: 4,
            }}
          >
            {totalTips}
          </div>
          <div style={{ fontSize: 13, color: '#888' }}>支持次数</div>
        </div>

        <div
          style={{
            background: '#FFF',
            borderRadius: 16,
            padding: '24px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #1677FF, #4096FF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <Calendar size={24} color="#FFF" />
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: '#1677FF',
              marginBottom: 4,
            }}
          >
            {new Set(recentTips.map((t) =>
              new Date(t.created_at).getMonth() +
              '-' +
              new Date(t.created_at).getDate()
            )).size || 0}
          </div>
          <div style={{ fontSize: 13, color: '#888' }}>本月支持</div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 900,
          margin: '0 auto 40px',
          padding: '0 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 24,
        }}
      >
        {/* Recent Tips Timeline */}
        <div
          style={{
            background: '#FFF',
            borderRadius: 16,
            padding: 28,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#333',
              margin: '0 0 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Heart size={20} color="#FF4D4F" />
            最新打赏
          </h2>

          {recentTips.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {recentTips.map((tip) => (
                <div
                  key={tip.id}
                  style={{
                    padding: '16px',
                    borderRadius: 12,
                    background: '#FAFAFA',
                    borderLeft: '3px solid #FFB800',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: tip.from_user.avatar
                          ? `url(${tip.from_user.avatar}) center/cover`
                          : '#E8E8E8',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#333',
                        }}
                      >
                        {tip.from_user.username}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#999',
                          marginTop: 2,
                        }}
                      >
                        {new Date(tip.created_at).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#FF8C00',
                      }}
                    >
                      ¥{tip.amount}
                    </div>
                  </div>
                  {tip.message && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: '#666',
                        lineHeight: 1.5,
                        paddingLeft: 46,
                      }}
                    >
                      {tip.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#BBB',
                fontSize: 14,
              }}
            >
              暂无打赏记录，成为第一个支持者吧！ ☕
            </div>
          )}
        </div>

        {/* Top Supporters */}
        <div
          style={{
            background: '#FFF',
            borderRadius: 16,
            padding: 28,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#333',
              margin: '0 0 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Crown size={20} color="#FFD700" />
            热心支持者 TOP 10
          </h2>

          {topSupporters.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topSupporters.map((supporter, index) => (
                <div
                  key={supporter.user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px',
                    borderRadius: 12,
                    background:
                      index === 0
                        ? '#FFFBEA'
                        : index === 1
                          ? '#F0F5FF'
                          : index === 2
                            ? '#F0FFF4'
                            : '#FAFAFA',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background:
                        index === 0
                          ? '#FFD700'
                          : index === 1
                            ? '#C0C0C0'
                            : index === 2
                              ? '#CD7F32'
                              : '#E8E8E8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      color: index < 3 ? '#FFF' : '#666',
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: supporter.user.avatar
                        ? `url(${supporter.user.avatar}) center/cover`
                        : '#E8E8E8',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#333',
                      }}
                    >
                      {supporter.user.username}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#999',
                        marginTop: 2,
                      }}
                    >
                      支持 {supporter.tip_count} 次
                    </div>
                  </div>
                  <div
                    style={{
                      textAlign: 'right',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#FF8C00',
                      }}
                    >
                      ¥{supporter.total_amount.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#BBB',
                fontSize: 14,
              }}
            >
              暂无支持者数据
            </div>
          )}
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .support-hero {
            padding: 40px 16px 60px !important;
          }
          .support-hero > div[style*="width: 120"] {
            width: 80px !important;
            height: 80px !important;
          }
        }
        @media (max-width: 480px) {
          .support-hero {
            padding: 32px 12px 48px !important;
          }
          .support-page {
            padding: 8px !important;
          }
          .support-hero > div[style*="width: 120"] {
            width: 64px !important;
            height: 64px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SupportPage;

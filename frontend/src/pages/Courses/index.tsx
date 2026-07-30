import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import { getCourses, createOrder, mockPay } from '@/api/paymentApi';
import { useAuthStore } from '@/store/useAuthStore';
import {
  BookOpen,
  Clock,
  Users,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Star,
} from 'lucide-react';
import { message, Spin } from 'antd';

interface CourseMeta {
  level: string;
  duration: string;
  lessons_count: number;
  outline: Array<{ title: string; desc: string }>;
  features: string[];
}

interface CourseItem {
  id: number;
  title: string;
  description: string;
  price: number;
  original_price?: number | null;
  cover_image: string;
  tags: string[];
  course_meta: CourseMeta | null;
  is_hot: boolean;
  is_recommend: boolean;
  sales_count: number;
}

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'battle', label: '实战课' },
  { key: 'intro', label: '入门课' },
];

const S = {
  container: { maxWidth: 1200, margin: '0 auto', padding: '40px 24px' },
  header: { marginBottom: 40 },
  title: { fontSize: 32, fontWeight: 800, color: '#1D2129', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#86909C', lineHeight: 1.6 },
  tabs: { display: 'flex', gap: 0, borderBottom: '2px solid #E5E6EB', marginBottom: 32 },
  tab: (active: boolean) => ({
    padding: '10px 20px', fontSize: 15, fontWeight: active ? 600 : 400,
    color: active ? '#165DFF' : '#4E5969',
    borderBottom: active ? '2px solid #165DFF' : 'none',
    cursor: 'pointer', transition: 'all 0.2s',
    marginBottom: -2,
  }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: 24 },
  card: {
    background: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E6EB',
    overflow: 'hidden', transition: 'box-shadow 0.25s ease',
  },
  coverWrap: { position: 'relative', height: 200, background: '#F2F3F5', overflow: 'hidden' },
  coverImg: { width: '100%', height: '100%', objectFit: 'cover' },
  badge: (color: string) => ({
    position: 'absolute', top: 12, left: 12, padding: '4px 10px', borderRadius: 4,
    background: color, color: '#FFF', fontSize: 12, fontWeight: 600,
  }),
  body: { padding: 20 },
  courseTitle: { fontSize: 18, fontWeight: 700, color: '#1D2129', marginBottom: 6 },
  desc: { fontSize: 14, color: '#4E5969', lineHeight: 1.7, marginBottom: 14, minHeight: 48 },
  metaRow: { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 },
  metaItem: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#86909C' },
  featureList: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 },
  featureItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4E5969' },
  outlineSection: { borderTop: '1px solid #F2F3F5', paddingTop: 14, marginTop: 4 },
  outlineHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 10 },
  outlineTitle: { fontSize: 14, fontWeight: 600, color: '#1D2129' },
  outlineItem: { padding: '8px 0', borderBottom: '1px solid #F7F8FA' },
  outlineItemTitle: { fontSize: 13, fontWeight: 500, color: '#1D2129', marginBottom: 2 },
  outlineItemDesc: { fontSize: 12, color: '#86909C' },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid #F2F3F5' },
  priceArea: { display: 'flex', alignItems: 'baseline', gap: 8 },
  price: { fontSize: 26, fontWeight: 800, color: '#FF7D00' },
  originalPrice: { fontSize: 14, color: '#C9CDD4', textDecoration: 'line-through' },
  ctaBtn: {
    background: '#165DFF', color: '#FFF', border: 'none', borderRadius: 8,
    padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    transition: 'background 0.2s ease',
  },
  emptyState: { textAlign: 'center', padding: '80px 20px', color: '#86909C' },
};

const Courses: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useSEO(
    '课程培训 - 一鉴到底',
    'AI Agent 安全开发实战、RAG 搭建入门等精品课程，从理论到实战全面覆盖',
    ['课程培训', 'AI Agent', 'RAG', '安全开发']
  );

  const [activeTab, setActiveTab] = useState('all');
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOutline, setExpandedOutline] = useState<number | null>(null);
  const [buyingCourseId, setBuyingCourseId] = useState<number | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const res = await getCourses();
      const list = res.data?.data || [];
      setCourses(list.map((p: any) => ({
        id: p.id,
        title: p.title || '',
        description: p.description || '',
        price: Number(p.price) || 0,
        originalPrice: p.original_price ? Number(p.original_price) : undefined,
        coverImage: p.cover_image || '',
        tags: p.tags || [],
        courseMeta: p.course_meta || null,
        isHot: p.is_hot || false,
        isRecommend: p.is_recommend || false,
        salesCount: Number(p.sales_count) || 0,
      })));
    } catch (err) {
      console.error('[Courses] Load failed:', err);
      message.error('课程数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter((c) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'battle') return c.price >= 199;
    return c.price < 199;
  });

  const handleBuy = async (course: CourseItem) => {
    if (!isAuthenticated()) {
      message.info('请先登录后再购买课程');
      navigate('/login');
      return;
    }
    setBuyingCourseId(course.id);
    try {
      const orderRes = await createOrder({
        product_id: course.id,
        order_type: `course_${course.id <= 11 ? 'agent_dev' : 'rag_intro'}`,
        amount: String(course.price),
        payment_method: 'mock',
      });
      const orderId = orderRes.data?.data?.order_id || orderRes.data?.order_id;
      if (!orderId) throw new Error('订单创建失败');
      await mockPay({ order_id: orderId });
      message.success(`购买成功！《${course.title}》已加入您的课程列表`, 4);
      setTimeout(() => navigate('/order-center'), 1500);
    } catch (err: any) {
      message.error(err.response?.data?.message || '购买失败，请重试');
    } finally {
      setBuyingCourseId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ ...S.container, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={S.container}>
      <div style={S.header}>
        <h1 style={S.title}>课程培训</h1>
        <p style={S.subtitle}>从 AI Agent 安全开发到 RAG 系统搭建，系统学习实战技能</p>
      </div>

      <div style={S.tabs}>
        {TABS.map((tab) => (
          <span key={tab.key}
            style={S.tab(activeTab === tab.key)}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </span>
        ))}
      </div>

      <div className="courses-grid" style={S.grid}>
        {filteredCourses.length === 0 ? (
          <div style={{ ...S.emptyState, gridColumn: '1 / -1' }}>
            <BookOpen size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p style={{ fontSize: 16 }}>暂无课程</p>
          </div>
        ) : (
          filteredCourses.map((course) => (
            <div key={course.id} style={S.card}>
              <div style={S.coverWrap}>
                {course.coverImage ? (
                  <img src={course.coverImage} alt={course.title} style={S.coverImg} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' }}>
                    <BookOpen size={64} color="#FFFFFF" opacity={0.6} />
                  </div>
                )}
                {course.isHot && <span style={S.badge('#FF7D00')}>热门</span>}
                {course.isRecommend && !course.isHot && <span style={S.badge('#165DFF')}>推荐</span>}
              </div>

              <div style={S.body}>
                <h3 style={S.courseTitle}>{course.title}</h3>
                <p style={S.desc}>{course.description}</p>

                <div style={S.metaRow}>
                  {course.courseMeta?.duration && (
                    <span style={S.metaItem}><Clock size={14} /> {course.courseMeta.duration}</span>
                  )}
                  {course.courseMeta?.level && (
                    <span style={S.metaItem}><Star size={14} /> {course.courseMeta.level}</span>
                  )}
                  <span style={S.metaItem}><Users size={14} /> {course.salesCount}人已学</span>
                </div>

                {course.courseMeta?.features && course.courseMeta.features.length > 0 && (
                  <div style={S.featureList}>
                    {course.courseMeta.features.slice(0, 4).map((f) => (
                      <span key={f} style={S.featureItem}>
                        <CheckCircle2 size={14} color="#00B42A" /> {f}
                      </span>
                    ))}
                    {course.salesCount > 0 && (
                      <span style={S.featureItem}>
                        <CheckCircle2 size={14} color="#00B42A" /> +{course.salesCount}项权益
                      </span>
                    )}
                  </div>
                )}

                {course.courseMeta?.outline && course.courseMeta.outline.length > 0 && (
                  <div style={S.outlineSection}>
                    <div style={S.outlineHeader} onClick={() => setExpandedOutline(expandedOutline === course.id ? null : course.id)}>
                      <span style={S.outlineTitle}>课程大纲（{course.courseMeta.outline.length} 章）</span>
                      {expandedOutline === course.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    {expandedOutline === course.id && (
                      <div>
                        {course.courseMeta.outline.map((item, idx) => (
                          <div key={idx} style={S.outlineItem}>
                            <div style={S.outlineItemTitle}>{item.title}</div>
                            <div style={S.outlineItemDesc}>{item.desc}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={S.footer}>
                  <div style={S.priceArea}>
                    <span style={S.price}>¥{course.price}</span>
                    {course.originalPrice && (
                      <span style={S.originalPrice}>¥{course.originalPrice}</span>
                    )}
                  </div>
                  <button
                    style={{
                      ...S.ctaBtn,
                      opacity: buyingCourseId === course.id ? 0.7 : 1,
                      pointerEvents: buyingCourseId === course.id ? 'none' : 'auto',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#0E42D2'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#165DFF'}
                    onClick={() => handleBuy(course)}
                    disabled={buyingCourseId === course.id}
                  >
                    {buyingCourseId === course.id ? (
                      <>处理中...</>
                    ) : (
                      <>
                        <ShoppingCart size={16} /> 立即购买
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Courses;

import { FileIcon, Shield, BookOpen, Scale, Bot, Users, BarChart3, Plug } from 'lucide-react';

const FEATURES = [
  { icon: 'FileText', title: '案例库', desc: '1000+精选技术案例' },
  { icon: 'Shield', title: '安全审计', desc: '四角色AI安全验证' },
  { icon: 'BookOpen', title: '知识库', desc: 'RAG智能检索系统' },
  { icon: 'Scale', title: '合规检测', desc: '正则规则风控引擎' },
  { icon: 'Bot', title: 'AI助手', desc: '智能Agent对话服务' },
  { icon: 'Users', title: '权限管理', desc: 'RBAC精细化控制' },
  { icon: 'BarChart3', title: '数据分析', desc: '全链路数据洞察' },
  { icon: 'Plug', title: '生态对接', desc: '开放平台合作接入' },
];

const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string }>> = {
  FileIcon,
  Shield,
  BookOpen,
  Scale,
  Bot,
  Users,
  BarChart3,
  Plug,
};

const STYLES = {
  section: {
    width: '100%',
    padding: '48px 0',
    backgroundColor: '#F8FAFC',
  },
  container: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '0 24px',
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: '#0F172A',
    marginBottom: 24,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    border: '1px solid #E5E6EB',
    padding: '24px 20px',
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    backgroundColor: 'rgba(22,93,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#0F172A',
    marginTop: 12,
  },
  cardDesc: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 1.5,
  },
} as const;

const FeatureCards: React.FC = () => {
  return (
    <section style={STYLES.section}>
      <div style={STYLES.container}>
        <h2 style={STYLES.title}>核心功能</h2>
        <div style={STYLES.grid} className="feature-cards-grid">
          {FEATURES.map((feature) => {
            const IconComponent = ICON_MAP[feature.icon];
            return (
              <div
                key={feature.title}
                className="feature-card"
                style={STYLES.card}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={STYLES.iconWrapper}>
                  {IconComponent && <IconComponent size={20} color="#165DFF" />}
                </div>
                <div style={STYLES.cardTitle}>{feature.title}</div>
                <div style={STYLES.cardDesc}>{feature.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        @media (max-width: 1024px) {
          .feature-cards-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .feature-cards-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
};

export default FeatureCards;

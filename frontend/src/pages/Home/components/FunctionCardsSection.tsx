import { useState, useEffect } from 'react';
import {
  Shield, Image, Link, FileSearch, ScanLine,
  Lock, Eye, Code, Database, Globe,
  AlertTriangle, CheckCircle, Zap, Cpu,
  Fingerprint, Key, Wifi, Mail, Users, Settings,
} from 'lucide-react';
import { Col, Typography, Spin, Empty } from 'antd';
import FunctionCard from './FunctionCard';
import UnifiedIdentifyModal from './UnifiedIdentifyModal';
import { functionCardApi } from '@/api/logCenterApi';

const { Title } = Typography;

const ICON_MAP: Record<string, React.ReactNode> = {
  Shield: <Shield size={18} />,
  Image: <Image size={18} />,
  Link: <Link size={18} />,
  FileSearch: <FileSearch size={18} />,
  ScanLine: <ScanLine size={18} />,
  Lock: <Lock size={18} />,
  Eye: <Eye size={18} />,
  Code: <Code size={18} />,
  Database: <Database size={18} />,
  Globe: <Globe size={18} />,
  AlertTriangle: <AlertTriangle size={18} />,
  CheckCircle: <CheckCircle size={18} />,
  Zap: <Zap size={18} />,
  Cpu: <Cpu size={18} />,
  Fingerprint: <Fingerprint size={18} />,
  Key: <Key size={18} />,
  Wifi: <Wifi size={18} />,
  Mail: <Mail size={18} />,
  Users: <Users size={18} />,
  Settings: <Settings size={18} />,
};

const DEFAULT_CARDS = [
  {
    id: 'default-1',
    name: '文本安全检测',
    icon: 'Shield',
    icon_color: '#165DFF',
    description: 'AI 文案 / 论文 / 简历检测，防限流、防延毕、防被筛',
    sort_order: 1,
    tag: '高频',
    tagColor: '#165DFF',
  },
  {
    id: 'default-2',
    name: '图片内容鉴别',
    icon: 'Image',
    icon_color: '#00B42A',
    description: 'AI 图 / 设计稿合规检测，防违规、防侵权、防下架',
    sort_order: 2,
    tag: '推荐',
    tagColor: '#00B42A',
  },
  {
    id: 'default-3',
    name: 'URL 安全扫描',
    icon: 'Link',
    icon_color: '#FF7D00',
    description: '网站 / 链接风险检测，防挂马、防拦截、防被罚',
    sort_order: 3,
    tag: '',
    tagColor: '',
  },
  {
    id: 'default-4',
    name: '文件风险分析',
    icon: 'FileSearch',
    icon_color: '#722ED1',
    description: '代码 / 文档漏洞扫描，防泄密、防攻击、防风险',
    sort_order: 4,
    tag: '',
    tagColor: '',
  },
  {
    id: 'default-agent',
    name: 'Agent 安全校验',
    icon: 'Cpu',
    icon_color: '#7C3AED',
    description: '全链路检测注入、泄露、越权、投毒风险，Agent 上线前必查，保命用。',
    sort_order: 0,
    tag: '核心',
    tagColor: '#7C3AED',
    isFeatured: true,
  },
];

function getIconBg(color: string): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',0.08)';
}

const STYLES = {
  section: {
    marginBottom: 24,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  } as React.CSSProperties,
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'rgba(22, 93, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#165DFF',
    flexShrink: 0,
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 16,
  } as React.CSSProperties,
};

const FunctionCardsSection: React.FC = () => {
  const [cards, setCards] = useState(DEFAULT_CARDS);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detectMode, setDetectMode] = useState('text');
  const [modalTitle, setModalTitle] = useState('安全鉴别中心');

  useEffect(() => {
    functionCardApi.getPublicCards()
      .then((res: any) => {
        const raw = res?.data || res;
        const list = Array.isArray(raw) ? raw : (raw?.results || []);
        if (list.length > 0) {
          setCards(list);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCardAction = (card: any) => {
    setDetectMode(card.name.includes('文本') ? 'text' : card.name.includes('图片') ? 'image' : card.name.includes('URL') || card.name.includes('链接') ? 'url' : 'file');
    setModalTitle(card.name);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div style={{ ...STYLES.section, textAlign: 'center', padding: 40 }}>
        <Spin />
      </div>
    );
  }

  return (
    <>
      <div style={STYLES.section}>
        <div style={STYLES.header}>
          <div style={STYLES.headerIcon}>
            <ScanLine size={16} />
          </div>
          <Title level={5} style={{ margin: 0, color: '#1D2129', fontSize: 16 }}>
            安全功能中心
          </Title>
        </div>
        {cards.length === 0 ? (
          <Empty description="暂无可用功能" style={{ padding: 40 }} />
        ) : (
          <div className="function-cards-grid" style={STYLES.grid}>
            {cards.map((card: any) => (
              <Col key={card.id}>
                <FunctionCard
                  icon={ICON_MAP[card.icon] || <Shield size={24} />}
                  iconBg={getIconBg(card.icon_color || '#165DFF')}
                  iconColor={card.icon_color || '#165DFF'}
                  title={card.name}
                  description={card.description}
                  buttonText={card.name.includes('Agent') ? '立即校验' : '立即使用'}
                  onAction={() => handleCardAction(card)}
                  tag={card.tag || undefined}
                  tagColor={card.tagColor || undefined}
                  isFeatured={card.isFeatured || false}
                />
              </Col>
            ))}
          </div>
        )}
      </div>

      <UnifiedIdentifyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={detectMode}
        title={modalTitle}
      />

      <style>{`
        @media (max-width: 991px) {
          .function-cards-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .function-cards-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          /* 图标在移动端 40x40px */
          .function-cards-grid .function-card-icon-wrapper {
            width: 40px !important;
            height: 40px !important;
          }
          /* "立即使用"按钮高度 40px */
          .function-cards-grid button[style*="height: 36"],
          .function-cards-grid button[style*="height: 32"] {
            min-height: 40px !important;
          }
        }
        @media (max-width: 576px) {
          .function-cards-grid {
            grid-template-columns: 1fr !important;
            justify-items: center;
          }
        }
      `}</style>
    </>
  );
};

export default FunctionCardsSection;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Input,
  Tag,
  Badge,
  Tooltip,
  Empty,
  Spin,
} from 'antd';
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Layers,
  Star,
  Clock,
  CreditCard,
  ChevronRight,
  X,
  Check,
  Zap,
  Crown,
  Building2,
  Globe,
  Briefcase,
  Sparkles,
  BrainCircuit,
  ShieldAlert,
  Building,
  FileSearch,
  Rss,
  TrendingUp,
  Gavel,
  Image as ImageIcon,
  MessageSquare,
  Search as SearchIcon,
  Server,
  FileText,
  Mic,
  Bot,
  Factory,
  Users,
} from 'lucide-react';
import {
  getPublicSkillList,
  searchSkills as apiSearchSkills,
  getSkillCategories,
  type SkillConfigItem,
  type CategoriesResponse,
} from '@/api/skillConfigApi';
import {
  getRecommendations,
  trackSkillClick,
  type RecommendationItem,
} from '@/api/recommendationApi';

interface SkillSelectorPanelProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (skill: SkillConfigItem) => void;
  selectedIds?: number[];
}

const TIER_ICONS: Record<string, React.ReactNode> = {
  core: <ShieldAlert size={14} />,
  security: <Layers size={14} />,
  product: <Grid3X3 size={14} />,
  vertical: <ChevronRight size={14} />,
  monetization: <CreditCard size={14} />,
  multilingual: <Globe size={14} />,
  professional: <Briefcase size={14} />,
  special: <Sparkles size={14} />,
  compliance: <Gavel size={14} />,
  'ai-detect': <BrainCircuit size={14} />,
  'content-security': <ShieldAlert size={14} />,
  'ai-governance': <Building2 size={14} />,
  'vertical-peer': <FileSearch size={14} />,
  'infoflow-detect': <Rss size={14} />,
  'traffic-optimize': <TrendingUp size={14} />,
  'infoflow-compliance': <Gavel size={14} />,
  'multimodal-infoflow': <ImageIcon size={14} />,
  'context-understanding': <MessageSquare size={14} />,
  'long-conversation': <Clock size={14} />,
  'context-risk-control': <ShieldAlert size={14} />,
  'vertical-context': <Building2 size={14} />,
  'retrieval-system': <SearchIcon size={14} />,
  'cluster-management': <Server size={14} />,
  'file-operation': <FileText size={14} />,
  'voice-input': <Mic size={14} />,
  'general-agent': <Bot size={14} />,
  'enterprise-agent': <Building size={14} />,
  'vertical-agent': <Factory size={14} />,
  'multi-agent-collab': <Users size={14} />,
};

const PAGE_SIZE = 48;

const BUILTIN_TIERS = ['general-agent', 'enterprise-agent', 'vertical-agent', 'multi-agent-collab', 'context-understanding', 'long-conversation', 'context-risk-control', 'retrieval-system', 'cluster-management'];

const BUILTIN_SKILLS: { tier: string; name: string; desc: string; icon: React.ReactNode }[] = [
  { tier: 'general-agent', name: '通用Agent引擎', desc: '基础对话与推理能力', icon: <Bot size={14} /> },
  { tier: 'context-understanding', name: '上下文理解', desc: '多轮对话上下文管理', icon: <MessageSquare size={14} /> },
  { tier: 'long-conversation', name: '长对话记忆', desc: '超长对话场景支持', icon: <Clock size={14} /> },
  { tier: 'retrieval-system', name: '智能检索增强', desc: 'RAG知识库检索', icon: <SearchIcon size={14} /> },
];

const SkillSelectorPanel: React.FC<SkillSelectorPanelProps> = ({
  visible,
  onClose,
  onSelect,
  selectedIds = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const activeCategoryRef = useRef('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [monetizationFilter, setMonetizationFilter] = useState<string>('all');

  const [skillList, setSkillList] = useState<SkillConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const [categoriesData, setCategoriesData] = useState<CategoriesResponse | null>(null);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const [recSkills, setRecSkills] = useState<RecommendationItem[]>([]);
  const [userIsActive, setUserIsActive] = useState(false);
  const [recLoaded, setRecLoaded] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const loadCategories = useCallback(async () => {
    try {
      const res = await getSkillCategories();
      if (res.success && res.data) {
        setCategoriesData(res.data);
        setTotalCount(res.data.total_skills || 0);
      }
    } catch (e) {
      console.error('[SkillPanel] Failed to load categories:', e);
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    try {
      const res = await getRecommendations(30, 'auto');
      if (res.success && res.data) {
        setRecSkills(res.data.recommendations || []);
        setUserIsActive(res.data.user_is_active || false);
        setRecLoaded(true);
      }
    } catch (e) {
      console.error('[SkillPanel] Failed to load recommendations:', e);
    }
  }, []);

  const loadData = useCallback(async (page: number, isLoadMore: boolean = false, forceCategory?: string) => {
    if (isLoadMore) {
      if (loadingMore || !hasNext) return;
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      let res;
      const params: Record<string, string | number | undefined> = {
        page,
        page_size: PAGE_SIZE,
      };

      const effectiveCategory = forceCategory || activeCategoryRef.current;

      if (searchQuery.trim()) {
        params.q = searchQuery.trim();
      }
      if (effectiveCategory !== 'all') {
        params.tier = effectiveCategory;
      }
      if (monetizationFilter !== 'all') {
        params.monetization = monetizationFilter;
      }

      if (searchQuery.trim() || effectiveCategory !== 'all' || monetizationFilter !== 'all') {
        res = await apiSearchSkills(params as any);
      } else {
        res = await getPublicSkillList({ page, page_size: PAGE_SIZE });
      }

      const rawData = res as any;
      const data = rawData?.data || rawData;
      const results = data?.results || [];
      const apiHasNext = data?.has_next || false;
      const totalCount = data?.count || 0;

      if (results.length > 0) {
        if (isLoadMore) {
          setSkillList(prev => [...prev, ...results]);
        } else {
          setSkillList(results);
        }
        setHasNext(apiHasNext);
        setTotalCount(totalCount);
        setCurrentPage(page);
      } else if (!isLoadMore) {
        setSkillList([]);
        setHasNext(false);
      }
    } catch (e) {
      console.error('[SkillPanel] Failed to load skills:', e);
      if (!isLoadMore && skillList.length === 0) {
        setSkillList([]);
        setHasNext(false);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, monetizationFilter, loadingMore, hasNext]);

  useEffect(() => {
    if (visible) {
      loadCategories();
      loadData(1, false);
      loadRecommendations();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    const timer = setTimeout(() => {
      loadData(1, false);
    }, 400);

    setSearchTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchQuery, monetizationFilter]);

  const loadMoreRef = useRef<() => void>(() => {});
  loadMoreRef.current = () => {
    if (hasNext && !loadingMore && !loading) {
      loadData(currentPage + 1, true);
    }
  };

  useEffect(() => {
    if (!visible || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const handleScroll = () => {
      if (!container) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 100) {
        loadMoreRef.current();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [visible]);

  const tabItems: { key: string; label: React.ReactNode }[] = [
    {
      key: 'all',
      label: (
        <span>
          全部技能
          <Badge count={totalCount} style={{ marginLeft: 6 }} size="small" />
        </span>
      ),
    },
  ];

  if (categoriesData?.tiers) {
    categoriesData.tiers.forEach((t) => {
      tabItems.push({
        key: t.key,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {TIER_ICONS[t.key] || <Zap size={14} />}
            {t.label}
            <Badge count={t.count} style={{ backgroundColor: '#86909C' }} size="small" />
          </span>
        ),
      });
    });
  }

  const getMonetizationTag = (type: string) => {
    const colorMap: Record<string, string> = {
      'free+pay': '#165DFF',
      'member+pay': '#FF7D00',
      'pay+enterprise': '#722ED1',
      'enterprise': '#F53F3F',
      'free': '#00B42A',
    };
    const labelMap: Record<string, string> = {
      'free+pay': '免费+付费',
      'member+pay': '会员+付费',
      'pay+enterprise': '付费+企业',
      'enterprise': '企业定制',
      'free': '免费',
    };
    const color = colorMap[type];
    if (!color) return null;
    return (
      <Tag
        color={color === '#00B42A' ? 'success' : color === '#F53F3F' ? 'error' : color === '#165DFF' ? 'processing' : color === '#722ED1' ? 'purple' : 'warning'}
        style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', borderRadius: 10 }}
      >
        {labelMap[type] || type}
      </Tag>
    );
  };

  const renderSkillCard = (skill: SkillConfigItem | RecommendationItem, isRec: boolean = false, recIndex: number = -1) => {
    const isSelected = selectedIds.includes(skill.id);
    const iconColor = skill.icon_color || '#165DFF';
    const recReason = isRec ? (skill as RecommendationItem).rec_reason : '';
    const recScore = isRec ? (skill as RecommendationItem).rec_score : 0;
    const strategy = isRec ? (skill as any).strategy || 'balanced' : '';

    const handleCardClick = () => {
      if (!isRec) {
        trackSkillClick(skill.id, skill);
      }
      onSelect(skill as any);
    };

    const recReasonColors: Record<string, { bg: string; color: string; border: string }> = {
      '热门推荐': { bg: '#FFECE8', color: '#E02020', border: '#FFCCC7' },
      '同类偏好': { bg: '#E8F3FF', color: '#165DFF', border: '#86CAFF' },
      '分类偏好': { bg: '#E8FFEA', color: '#00B42A', border: '#7BE188' },
      '新功能上线': { bg: '#F5E8FF', color: '#722ED1', border: '#D3ADFF' },
      '官方推荐': { bg: '#FFF7E8', color: '#F5A623', border: '#FFE7BA' },
      '近期浏览': { bg: '#FFF1F0', color: '#F53F3F', border: '#FECACA' },
      '相似用户喜欢': { bg: '#F0F5FF', color: '#165DFF', border: '#86CAFF' },
      '高转化率': { bg: '#E8FFEA', color: '#00B42A', border: '#7BE188' },
      '场景匹配': { bg: '#FFF7E8', color: '#F5A623', border: '#FFE7BA' },
    };
    const reasonStyle = recReasonColors[recReason] || { bg: '#F7F8FA', color: '#86909C', border: '#E5E6EB' };

    return (
      <div
        key={skill.id}
        onClick={handleCardClick}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: viewMode === 'grid' ? '14px' : '12px 16px',
          borderRadius: 8,
          background: isSelected ? iconColor + '12' : (isRec ? 'linear-gradient(135deg, #FFFFFF 0%, ' + (reasonStyle.bg || '#FAFBFC') + '40 100%)' : '#FFFFFF'),
          border: '1.5px solid ' + (isSelected ? iconColor : (isRec ? (reasonStyle.border || '#F5A623') : '#E5E6EB')),
          cursor: 'pointer',
          transition: 'all 0.15s',
          ...(viewMode === 'list' ? { flexDirection: 'row', alignItems: 'center', gap: 12 } : {}),
          ...(isRec && !isSelected ? { boxShadow: '0 2px 12px rgba(245,166,35,0.08)' } : {}),
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.borderColor = isRec ? (reasonStyle.color || '#F5A623') : iconColor;
            e.currentTarget.style.boxShadow = isRec ? '0 4px 16px rgba(245,166,35,0.15)' : '0 2px 8px rgba(0,0,0,0.06)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.borderColor = isRec ? (reasonStyle.border || '#F5A623') : '#E5E6EB';
            e.currentTarget.style.boxShadow = isRec ? '0 2px 12px rgba(245,166,35,0.08)' : 'none';
            e.currentTarget.style.transform = 'none';
          }
        }}
      >
        {isRec && recIndex >= 0 && recIndex < 3 && (
          <div style={{
            position: 'absolute',
            top: -1,
            left: -1,
            width: 22,
            height: 22,
            borderRadius: '6px 0 8px 0',
            background: ['#E02020', '#F5A623', '#165DFF'][recIndex],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 800,
            color: '#FFF',
            zIndex: 2,
          }}>
            {recIndex + 1}
          </div>
        )}

        {isSelected && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Check size={12} style={{ color: '#FFF' }} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: iconColor + '14',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: iconColor,
            ...(isRec ? { boxShadow: '0 2px 8px ' + iconColor + '30' } : {}),
          }}>
            {TIER_ICONS[skill.tier] || <Zap size={16} />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#1D2129',
              marginBottom: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              #{skill.id} {skill.name}
            </div>

            <div style={{
              fontSize: 11,
              color: '#86909C',
              marginBottom: 4,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 3,
            }}>
              {(skill.keywords || []).slice(0, 3).map((kw, idx) => (
                <span key={idx} style={{
                  background: '#F7F8FA',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  color: '#4E5969',
                }}>
                  {kw}
                </span>
              ))}
              {(skill.keywords || []).length > 3 && (
                <span style={{ color: '#C9CDD4', fontSize: 10 }}>+{(skill.keywords || []).length - 3}</span>
              )}
            </div>

            {recReason && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                marginTop: 3,
                flexWrap: 'wrap',
              }}>
                <span style={{
                  fontSize: 9,
                  color: reasonStyle.color,
                  background: reasonStyle.bg,
                  padding: '1px 7px',
                  borderRadius: 4,
                  fontWeight: 700,
                  border: '0.5px solid ' + reasonStyle.border,
                  letterSpacing: 0.3,
                }}>
                  {recReason}
                </span>
                {recScore > 3 && (
                  <span style={{
                    fontSize: 9,
                    color: '#00B42A',
                    fontWeight: 600,
                    background: '#E8FFEA',
                    padding: '1px 6px',
                    borderRadius: 4,
                  }}>
                    匹配 {Math.round(recScore * 20)}%
                  </span>
                )}
                {strategy && strategy !== 'balanced' && (
                  <span style={{
                    fontSize: 8,
                    color: '#722ED1',
                    background: '#F5E8FF',
                    padding: '1px 5px',
                    borderRadius: 3,
                    fontWeight: 600,
                  }}>
                    {strategy}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {getMonetizationTag(skill.monetization_type)}
          {isRec && (
            <Tooltip title='点击率较高，推荐优先展示'>
              <span style={{
                fontSize: 10,
                color: '#00B42A',
                background: '#E8FFEA',
                padding: '1px 6px',
                borderRadius: 4,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}>
                <TrendingUp size={9} /> 推荐
              </span>
            </Tooltip>
          )}
          <Tooltip title={'开发周期: ' + skill.dev_days + '天'}>
            <span style={{ fontSize: 11, color: '#C9CDD4', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Clock size={10} />
              {skill.dev_days}天
            </span>
          </Tooltip>
          <Tooltip title={'推荐权重: ' + skill.weight + '/10'}>
            <span style={{ fontSize: 11, color: '#C9CDD4', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Star size={10} />
              {skill.weight}
            </span>
          </Tooltip>
        </div>
      </div>
    );
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.45)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div
        style={{
          width: '100%',
          maxWidth: 1400,
          maxHeight: '88vh',
          background: '#FFFFFF',
          borderRadius: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E5E6EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #165DFF, #722ED1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Grid3X3 size={20} style={{ color: '#FFF' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1D2129' }}>
                全量功能矩阵 · {skillList.length}/{totalCount > 0 ? totalCount : '--'} 个技能
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#86909C' }}>
                AI推荐算法 · 行为追踪 · 热门置顶 · 新功能优先
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: 'none',
              background: '#F2F3F5',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#86909C',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search & Filters */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #F0F0F0', display: 'flex', gap: 12, alignItems: 'center' }}>
          <Input
            prefix={<Search size={16} style={{ color: '#C9CDD4' }} />}
            placeholder="搜索功能名称、关键词、场景..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            style={{ flex: 1, height: 38, borderRadius: 6 }}
          />

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#86909C', whiteSpace: 'nowrap' }}>变现:</span>
            <select
              value={monetizationFilter}
              onChange={(e) => setMonetizationFilter(e.target.value)}
              style={{
                height: 32,
                borderRadius: 6,
                border: '1px solid #E5E6EB',
                padding: '0 8px',
                fontSize: 12,
                color: '#4E5969',
                cursor: 'pointer',
                background: '#FFF',
              }}
            >
              <option value="all">全部</option>
              <option value="free">完全免费</option>
              <option value="free+pay">免费+付费</option>
              <option value="member+pay">会员+付费</option>
              <option value="pay+enterprise">付费+企业</option>
              <option value="enterprise">企业定制</option>
            </select>
          </div>

          <div style={{ display: 'flex', border: '1px solid #E5E6EB', borderRadius: 6, overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                height: 32,
                padding: '0 12px',
                border: 'none',
                background: viewMode === 'grid' ? '#F0F5FF' : '#FFF',
                color: viewMode === 'grid' ? '#165DFF' : '#86909C',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
              }}
            >
              <Grid3X3 size={14} />
              网格
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                height: 32,
                padding: '0 12px',
                border: 'none',
                borderLeft: '1px solid #E5E6EB',
                background: viewMode === 'list' ? '#F0F5FF' : '#FFF',
                color: viewMode === 'list' ? '#165DFF' : '#86909C',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
              }}
            >
              <List size={14} />
              列表
            </button>
          </div>
        </div>

        {/* Category Tabs - 自定义pill切换器，替代antd Tabs */}
        <div style={{ padding: '10px 24px', borderBottom: '1px solid #F0F0F0' }}>
          <div style={{
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            {tabItems.map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  const newCat = tab.key;
                  setActiveCategory(newCat);
                  activeCategoryRef.current = newCat;
                  setCurrentPage(1);
                  setHasNext(true);
                  setSkillList([]);
                  loadData(1, false, newCat);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 12px',
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: activeCategory === tab.key ? 600 : 400,
                  cursor: 'pointer',
                  border: 'none',
                  background: activeCategory === tab.key ? '#165DFF' : '#F2F3F5',
                  color: activeCategory === tab.key ? '#FFFFFF' : '#4E5969',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Skills Grid/List with Infinite Scroll */}
        <div
          ref={scrollContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 24px',
          }}
        >
          {/* ===== 内置技能区（自动启用，无需选择）===== */}
          <div style={{
            marginBottom: 14,
            padding: '12px 14px',
            background: 'linear-gradient(135deg, #F0F5FF 0%, #EEF2FF 50%, #F9F0FF 100%)',
            borderRadius: 8,
            border: '1px solid #C9D4FF',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Crown size={14} style={{ color: '#722ED1' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1D2129' }}>内置引擎能力</span>
              <span style={{ fontSize: 10, color: '#86909C', background: '#FFFFFF', padding: '1px 6px', borderRadius: 8 }}>自动启用</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {BUILTIN_SKILLS.map(bs => (
                <div key={bs.tier} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 6,
                  background: '#FFFFFF',
                  border: '1px solid #E0E6F5',
                  boxShadow: '0 1px 3px rgba(114,46,209,0.06)',
                }}>
                  <span style={{ color: '#722ED1' }}>{bs.icon}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#1D2129' }}>{bs.name}</span>
                  <span style={{ fontSize: 10, color: '#86909C' }}>{bs.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {loading && skillList.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 16 }}>
              <Spin size="large" />
              <span style={{ fontSize: 13, color: '#86909C' }}>正在加载技能...</span>
            </div>
          ) : skillList.length > 0 || recSkills.length > 0 ? (
            <>
              {recLoaded && recSkills.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: '2px solid #FFF7E8',
                    background: 'linear-gradient(90deg, #FFF7E8 0%, #FFFFFF 100%)',
                    margin: '-14px -14px 10px -14px',
                    padding: '10px 14px',
                    borderRadius: '8px 8px 0 0',
                  }}>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: '#E02020',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}>
                      <Sparkles size={16} />
                      为你推荐
                    </span>
                    <span style={{
                      fontSize: 10,
                      color: '#F5A623',
                      background: '#FFF7E8',
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontWeight: 700,
                      border: '1px solid #FFE7BA',
                    }}>
                      AI v2.0 智能算法
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 10, color: '#86909C' }}>
                      {recSkills.length}个精选
                    </span>
                  </div>
                  <div style={{
                    display: viewMode === 'grid'
                      ? 'grid'
                      : 'flex',
                    gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(280px, 1fr))' : undefined,
                    flexDirection: viewMode === 'list' ? 'column' : undefined,
                    gap: 10,
                  }}>
                    {recSkills.slice(0, 8).map((s, idx) => renderSkillCard(s, true, idx))}
                  </div>
                </div>
              )}

              {skillList.length > 0 && (
                <>
                  {recLoaded && recSkills.length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      margin: '16px 0 10px',
                      paddingBottom: 8,
                      borderBottom: '1px solid #F0F0F0',
                    }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#86909C',
                      }}>
                        全部技能
                      </span>
                      <span style={{
                        fontSize: 10,
                        color: '#C9CDD4',
                      }}>
                        {totalCount} 个可用
                      </span>
                    </div>
                  )}
                  <div style={{
                    display: viewMode === 'grid'
                      ? 'grid'
                      : 'flex',
                    gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(280px, 1fr))' : undefined,
                    flexDirection: viewMode === 'list' ? 'column' : undefined,
                    gap: 10,
                  }}>
                    {skillList.map((s) => <React.Fragment key={s.id}>{renderSkillCard(s, false)}</React.Fragment>)}
                  </div>
                </>
              )}

              {loadingMore && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0', gap: 8 }}>
                  <Spin size="small" />
                  <span style={{ fontSize: 12, color: '#86909C' }}>加载更多技能...</span>
                </div>
              )}

              {!hasNext && skillList.length >= PAGE_SIZE && (
                <div style={{
                  textAlign: 'center',
                  padding: '20px 0',
                  fontSize: 12,
                  color: '#C9CDD4',
                }}>
                  — 已加载全部 {skillList.length}/{totalCount} 个技能 —
                </div>
              )}
            </>
          ) : (
            <Empty
              description="未找到匹配的技能"
              style={{ marginTop: 60 }}
            />
          )}
        </div>

        {/* Footer Stats */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid #E5E6EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FAFBFC',
        }}>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#86909C' }}>
            <span><strong style={{ color: '#1D2129' }}>{totalCount}</strong> 个总技能</span>
            <span><strong style={{ color: '#1D2129' }}>{categoriesData?.tiers?.length || 29}</strong> 个分类</span>
            <span><strong style={{ color: '#1D2129' }}>{selectedIds.length}</strong> 个已选</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#86909C' }}>每页{PAGE_SIZE}条 · 共{totalCount || '-'}项 · 滚动加载更多</span>
            {hasNext && skillList.length > 0 && (
              <span style={{
                fontSize: 10,
                color: '#165DFF',
                background: '#F0F5FF',
                padding: '2px 8px',
                borderRadius: 10,
              }}>
                ↓ 下拉加载更多
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillSelectorPanel;

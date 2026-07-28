import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import type { Category } from '@/types/article';
import { getCategories } from '@/api/frontApi';

interface FilterBarProps {
  selectedCategory: string | number | null;
  onSelectCategory: (categoryId: string | number | null) => void;
  sortValue: string;
  onSortChange: (value: string) => void;
  onSearch: (keyword: string) => void;
  activeXinfaTag?: string | null;
  onXinfaTagChange?: (tagId: string) => void;
}

const SORT_OPTIONS = [
  { value: '-publish_time', label: '最新发布' },
  { value: '-read_count', label: '最多阅读' },
  { value: '-like_count', label: '最多点赞' },
];

const PROFESSIONAL_CATS = [
  { id: null, name: '全部' },
  { id: 1, name: '行业认知洞察' },
  { id: 2, name: 'AI安全避坑' },
  { id: 3, name: '算力成本拆解' },
  { id: 4, name: '项目创业复盘' },
  { id: 5, name: '赛道问答解惑' },
  { id: 6, name: '新手入门指南' },
  { id: 7, name: '架构干货内幕' },
];

const XINFA_TAGS = [
  { id: 'industry_insight', name: '行业洞察', emoji: '\u{1F52}', color: '#0EA5E9' },
  { id: 'ai_security_pitfall', name: '安全避坑', emoji: '\u{1F6E1}', color: '#EF4444' },
  { id: 'compute_cost', name: '算力成本', emoji: '\u{26A1}', color: '#F59E0B' },
  { id: 'startup_review', name: '创业复盘', emoji: '\u{1F4DD}', color: '#8B5CF6' },
  { id: 'qa_qa', name: '赛道问答', emoji: '\u{2753}', color: '#06B6D4' },
  { id: 'beginner_guide', name: '入门指南', emoji: '\u{1F9ED}', color: '#10B981' },
  { id: 'architecture_inside', name: '架构内幕', emoji: '\u{1F3D7}', color: '#6366F1' },
];

const STYLES = {
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: '16px 20px',
    marginBottom: 20,
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap' as const,
  },
  categoryGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap' as const,
    overflowX: 'auto' as const,
    flex: 1,
  },
  categoryBtn: (active: boolean) => ({
    padding: '6px 14px',
    borderRadius: 12,
    border: 'none',
    backgroundColor: active ? '#165DFF' : '#F2F3F5',
    color: active ? '#FFFFFF' : '#86909C',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 200ms ease',
    whiteSpace: 'nowrap' as const,
  }),
  rightGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  sortSelect: {
    padding: '7px 32px 7px 12px',
    borderRadius: 6,
    border: '1px solid #E2E8F0',
    backgroundColor: '#F8FAFC',
    color: '#475569',
    fontSize: 13,
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
  },
  searchWrapper: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },
  searchInput: {
    width: 200,
    padding: '7px 12px 7px 36px',
    borderRadius: 6,
    border: '1px solid #E2E8F0',
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: 13,
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxSizing: 'border-box' as const,
  },
  searchIcon: {
    position: 'absolute' as const,
    left: 10,
    color: '#94A3B8',
    pointerEvents: 'none' as const,
  },
  xinfaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTop: '1px solid rgba(0,0,0,0.05)',
    flexWrap: 'nowrap' as const,
    overflowX: 'auto' as const,
  },
  xinfaLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  xinfaTagGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap' as const,
    overflowX: 'auto' as const,
  },
  xinfaTag: (active: boolean, color: string) => ({
    padding: '5px 14px',
    borderRadius: 12,
    border: 'none',
    backgroundColor: active ? color : '#F2F3F5',
    color: active ? '#FFFFFF' : '#86909C',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 200ms ease',
    whiteSpace: 'nowrap' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  }),
} as const;

const FilterBar: React.FC<FilterBarProps> = ({
  selectedCategory,
  onSelectCategory,
  sortValue,
  onSortChange,
  onSearch,
  activeXinfaTag,
  onXinfaTagChange,
}) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getCategories().then((res: any) => {
      const raw = res?.data || res;
      const cats = Array.isArray(raw) ? raw : (raw?.results || raw?.data || []);
      setCategories(cats);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSearchInput = (value: string) => {
    setSearchKeyword(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearch(value.trim());
    }, 300);
  };

  const isXinfaSelected = (tagId: string) => activeXinfaTag === tagId;

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .filter-bar-top-row { flex-direction: column !important; align-items: stretch !important; }
          .filter-bar-category-group { justify-content: flex-start; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .filter-bar-right-group { justify-content: space-between; }
          .filter-bar-search-input { width: 100% !important; min-width: unset !important; }
          .filter-bar-xinfa-row { justify-content: flex-start !important; overflow-x: auto; }
        }
        .filter-bar-category-group::-webkit-scrollbar,
        .filter-bar-xinfa-row::-webkit-scrollbar,
        .xinfa-tag-group::-webkit-scrollbar {
          display: none;
        }
        .filter-bar-category-group {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .xinfa-tag-group {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .filter-bar-xinfa-row {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .filter-bar-category-btn:hover:not([style*="#165DFF"]) {
          background: rgba(0,0,0,0.04) !important;
          transform: scale(1.02);
        }
        .xinfa-tag-btn:hover:not(.active) {
          background: rgba(0,0,0,0.04) !important;
          transform: scale(1.02);
        }
        .xinfa-tag-btn.active {
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
      `}</style>
      <div style={STYLES.container}>
        <div className="filter-bar-top-row" style={STYLES.topRow}>
          <div className="filter-bar-category-group" style={STYLES.categoryGroup}>
            {PROFESSIONAL_CATS.map((cat) => (
              <button
                key={String(cat.id ?? 'all')}
                className="filter-bar-category-btn"
                style={STYLES.categoryBtn(selectedCategory === cat.id)}
                onClick={() => onSelectCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="filter-bar-right-group" style={STYLES.rightGroup}>
            <select
              value={sortValue}
              onChange={(e) => onSortChange(e.target.value)}
              style={STYLES.sortSelect}
              onFocus={(e) => (e.target.style.borderColor = '#2563EB')}
              onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div style={STYLES.searchWrapper}>
              <Search size={15} style={STYLES.searchIcon} />
              <input
                type="text"
                placeholder="搜索文章..."
                value={searchKeyword}
                onChange={(e) => handleSearchInput(e.target.value)}
                className="filter-bar-search-input"
                style={STYLES.searchInput}
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563EB';
                  e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E2E8F0';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>
        </div>

        <div className="filter-bar-xinfa-row" style={STYLES.xinfaRow}>
          <span style={STYLES.xinfaLabel}>心法</span>
          <div style={STYLES.xinfaTagGroup}>
            {XINFA_TAGS.map((tag) => {
              const active = isXinfaSelected(tag.id);
              return (
                <button
                  key={tag.id}
                  className={`xinfa-tag-btn${active ? ' active' : ''}`}
                  style={STYLES.xinfaTag(active, tag.color)}
                  onClick={() => onXinfaTagChange?.(tag.id)}
                >
                  <span>{tag.emoji}</span>
                  <span>{tag.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default FilterBar;

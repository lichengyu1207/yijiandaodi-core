import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

const STYLES = {
  container: {
    width: '100%',
    height: 200,
    backgroundColor: '#F8FAFC',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid #E2E8F0',
  },
  inner: {
    maxWidth: 1400,
    width: '100%',
    padding: '0 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box' as const,
  },
  searchWrapper: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute' as const,
    left: 14,
    color: '#94A3B8',
    pointerEvents: 'none' as const,
  },
  searchInput: {
    width: 480,
    padding: '12px 20px 12px 46px',
    borderRadius: 6,
    border: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 15,
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxSizing: 'border-box' as const,
  },
} as const;

const HeroBanner: React.FC = () => {
  const navigate = useNavigate();

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = (e.target as HTMLInputElement).value.trim();
      if (value) {
        navigate(`/search?q=${encodeURIComponent(value)}`);
      }
    }
  };

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .hero-banner-container { height: 120px !important; }
          .hero-banner-search-input { width: 100% !important; max-width: 400px; }
        }
      `}</style>
      <section
        className="hero-banner-container"
        style={STYLES.container}
      >
        <div className="hero-banner-inner" style={STYLES.inner}>
          <div style={STYLES.searchWrapper}>
            <Search size={18} style={STYLES.searchIcon} />
            <input
              type="text"
              placeholder="搜索案例、技术文章..."
              className="hero-banner-search-input"
              style={STYLES.searchInput}
              onKeyDown={handleSearch}
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
      </section>
    </>
  );
};

export default HeroBanner;

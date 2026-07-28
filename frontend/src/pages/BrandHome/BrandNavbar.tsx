import { useState } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const navItems = [
  { label: '产品', href: '/products' },
  { label: '内容', href: '/execution-center' },
  { label: '虾聊', href: '/xialia' },
  { label: '关于我们', href: '/about' },
];

export default function BrandNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest >= 50);
  });

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    if (href.startsWith('#')) {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.href = href;
    }
  };

  return (
    <motion.nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        height: 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 48px',
        background: scrolled ? 'rgba(15,118,110,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : undefined,
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : undefined,
        transition: 'background 0.3s ease, backdrop-filter 0.3s ease',
      }}
      initial={{ y: -72 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Logo */}
      <div
        style={{
          fontSize: '1.35rem',
          fontWeight: 800,
          color: '#fff',
          letterSpacing: '0.05em',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
        onClick={() => (window.location.href = '/')}
      >
        一鉴到底
      </div>

      {/* Desktop Nav Links */}
      <div
        style={{
          display: 'flex',
          gap: 36,
          alignItems: 'center',
        }}
        className="desktop-nav"
      >
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            onClick={(e) => {
              e.preventDefault();
              handleNavClick(item.href);
            }}
            style={{
              color: '#E0F2FE',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: 500,
              transition: 'color 0.25s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = '#E0F2FE';
            }}
          >
            {item.label}
          </a>
        ))}
      </div>

      {/* CTA Button (Desktop) */}
      <motion.a
        href="/execution-center"
        style={{
          padding: '10px 24px',
          borderRadius: 8,
          background: 'linear-gradient(135deg, #14B8A6, #0F766E)',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '0.9rem',
          whiteSpace: 'nowrap',
        }}
        whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(20,184,166,0.4)' }}
        whileTap={{ scale: 0.97 }}
        className="desktop-nav"
      >
        免费体验
      </motion.a>

      {/* Mobile Hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          display: 'none',
          background: 'none',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          padding: 8,
        }}
        className="mobile-menu-btn"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Dropdown Menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{
            position: 'absolute',
            top: 72,
            left: 0,
            right: 0,
            background: 'rgba(15,118,110,0.98)',
            backdropFilter: 'blur(12px)',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
          className="mobile-dropdown"
        >
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick(item.href);
              }}
              style={{
                color: '#E0F2FE',
                textDecoration: 'none',
                fontSize: '1rem',
                fontWeight: 500,
                padding: '10px 0',
                borderBottom: '1px solid rgba(224,242,254,0.1)',
              }}
            >
              {item.label}
            </a>
          ))}
          <a
            href="/execution-center"
            style={{
              marginTop: 8,
              padding: '12px 20px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #14B8A6, #0F766E)',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            免费体验
          </a>
        </motion.div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </motion.nav>
  );
}

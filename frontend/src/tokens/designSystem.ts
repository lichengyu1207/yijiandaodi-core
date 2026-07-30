export const DESIGN = {
  font: {
    cn: "'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, sans-serif",
    en: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    size: { display: 28, h1: 20, h2: 16, body: 14, caption: 12 },
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { display: 28, h1: 28, h2: 24, body: 22, caption: 18 },
  },
  radius: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, full: 9999 },
  shadow: {
    card: '0 2px 12px rgba(0,0,0,0.04)',
    cardHover: '0 8px 24px rgba(0,0,0,0.08)',
    modal: '0 4px 24px rgba(0,0,0,0.08)',
    dropdown: '0 4px 12px rgba(0,0,0,0.08)',
    button: '0 1px 2px rgba(0,0,0,0.06)',
  },
  space: { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, '2xl': 32, '3xl': 40, '4xl': 48 },
  colors: {
    primary: '#165DFF',
    primaryHover: '#0E42D2',
    success: '#00B42A',
    warning: '#FF7D00',
    error: '#F53F3F',
    text: '#1D2129',
    textSecondary: '#86909C',
    bg: '#F5F7FA',
    bgWarm: '#F7F8FA',
    border: '#E5E6EB',
    borderLight: '#F2F3F5',
  },
  xinfa: {
    purple: '#7C3AED',
    pink: '#EC4899',
    green: '#059669',
    orange: '#F59E0B',
    red: '#DC2626',
    cyan: '#0891B2',
  },
  animation: { fast: '150ms ease', normal: '200ms ease', slow: '300ms ease' },
} as const;

export type DesignToken = typeof DESIGN;

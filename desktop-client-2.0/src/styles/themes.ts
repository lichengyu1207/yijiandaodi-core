/**
 * 主题系统（P1 界面定制）
 * 三套预设主题（light / dark / deep）+ 自定义背景（图片/纯色/渐变/纹理）
 * 与 index.css 的 CSS 变量一一对应，运行时经 themeService 注入。
 */

export type ThemeName = 'light' | 'dark' | 'deep'

export interface ThemeVars {
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  bgCard: string
  bgHover: string
  borderPrimary: string
  borderSecondary: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  statusSuccess: string
  statusWarning: string
  statusError: string
  statusInfo: string
  brandPrimary: string
  brandSecondary: string
}

export const THEMES: Record<ThemeName, ThemeVars> = {
  // 白色主题：浅灰应用背景 + 白色卡片/侧栏
  light: {
    bgPrimary: '#F5F7FA',
    bgSecondary: '#FFFFFF',
    bgTertiary: '#F0F2F5',
    bgCard: '#FFFFFF',
    bgHover: '#E9EDF2',
    borderPrimary: '#E2E8F0',
    borderSecondary: '#EDF1F5',
    textPrimary: '#1D2129',
    textSecondary: '#4E5969',
    textTertiary: '#86909C',
    statusSuccess: '#2EA043',
    statusWarning: '#D97706',
    statusError: '#D93026',
    statusInfo: '#2563EB',
    brandPrimary: '#165DFF',
    brandSecondary: '#409EFF',
  },
  // 黑色主题：较深的统一暗色（比 deep 略亮）
  dark: {
    bgPrimary: '#161B22',
    bgSecondary: '#1E242D',
    bgTertiary: '#2D3540',
    bgCard: '#1C2128',
    bgHover: '#2E3742',
    borderPrimary: '#3D4A57',
    borderSecondary: '#2A323D',
    textPrimary: '#E6E8EB',
    textSecondary: '#A0A8B4',
    textTertiary: '#7A8494',
    statusSuccess: '#3FB950',
    statusWarning: '#D29922',
    statusError: '#F85149',
    statusInfo: '#58A6FF',
    brandPrimary: '#2E7BFF',
    brandSecondary: '#409EFF',
  },
  // 深色主题（默认）：与原有控制台深色一致
  deep: {
    bgPrimary: '#0d1117',
    bgSecondary: '#161b22',
    bgTertiary: '#21262d',
    bgCard: '#1c2128',
    bgHover: '#30363d',
    borderPrimary: '#30363d',
    borderSecondary: '#21262d',
    textPrimary: '#f0f6fc',
    textSecondary: '#8b949e',
    textTertiary: '#6e7681',
    statusSuccess: '#3fb950',
    statusWarning: '#d29922',
    statusError: '#f85149',
    statusInfo: '#58a6ff',
    brandPrimary: '#165dff',
    brandSecondary: '#409eff',
  },
}

export const THEME_LABELS: Record<ThemeName, string> = {
  light: '白色',
  dark: '黑色',
  deep: '深色',
}

export const THEME_NAMES: ThemeName[] = ['light', 'dark', 'deep']

/** 自定义背景类型 */
export type CustomBgType = 'none' | 'image' | 'color' | 'gradient' | 'texture'

export interface CustomBg {
  type: CustomBgType
  /** color: 十六进制色值；gradient: CSS 渐变字符串；texture: 纹理 key；image: dataURL */
  value: string
}

/** 纯色预设 */
export const COLOR_PRESETS: string[] = [
  '#1E293B', '#0F172A', '#334155', '#3B82F6', '#8B5CF6',
  '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6',
]

/** 渐变预设（CSS linear-gradient 字符串） */
export const GRADIENT_PRESETS: { name: string; css: string }[] = [
  { name: '蓝紫', css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: '深空', css: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
  { name: '极光', css: 'linear-gradient(135deg, #00b4d8 0%, #90e0ef 100%)' },
  { name: '日落', css: 'linear-gradient(135deg, #f83600 0%, #f9d423 100%)' },
  { name: '森林', css: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)' },
  { name: '烈焰', css: 'linear-gradient(135deg, #ff512f 0%, #dd2476 100%)' },
]

/** 纹理预设：使用 var(--bg-hover) 自适应主题明暗 */
export const TEXTURE_PRESETS: { key: string; name: string; css: string }[] = [
  { key: 'grid', name: '网格', css: 'repeating-linear-gradient(0deg, var(--bg-hover) 0 1px, transparent 1px 26px), repeating-linear-gradient(90deg, var(--bg-hover) 0 1px, transparent 1px 26px)' },
  { key: 'dots', name: '点阵', css: 'radial-gradient(var(--bg-hover) 1.5px, transparent 1.5px) 0 0/26px 26px' },
  { key: 'waves', name: '波浪', css: 'repeating-radial-gradient(circle at 0 0, var(--bg-hover) 0 14px, transparent 14px 28px)' },
  { key: 'diagonal', name: '对角线', css: 'repeating-linear-gradient(45deg, var(--bg-hover) 0 1px, transparent 1px 14px)' },
  { key: 'carbon', name: '碳纤维', css: 'repeating-linear-gradient(45deg, var(--bg-hover) 0 1px, transparent 1px 6px), repeating-linear-gradient(-45deg, var(--bg-hover) 0 1px, transparent 1px 6px)' },
  { key: 'noise', name: '噪点', css: 'noise' },
]

/** 噪点使用内联 SVG（feTurbulence），中性灰色以便明暗主题都可见 */
export const NOISE_SVG =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.25\'/%3E%3C/svg%3E")'

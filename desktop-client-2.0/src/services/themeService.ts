/**
 * 主题服务（P1 界面定制）
 * - 三套预设主题（light / dark / deep）localStorage 持久化
 * - 自定义背景（图片/纯色/渐变/纹理）持久化与应用
 * - 通过 documentElement 注入 CSS 变量，实现全局即时切换
 */

import { THEMES, NOISE_SVG, TEXTURE_PRESETS, type ThemeName, type CustomBg } from '../styles/themes'

const THEME_KEY = 'yjd.theme'
const CUSTOM_BG_KEY = 'yjd.customBg'

export type ThemeChangeListener = (theme: ThemeName) => void

class ThemeService {
  private currentTheme: ThemeName
  private currentBg: CustomBg
  private listeners: ThemeChangeListener[] = []

  constructor() {
    this.currentTheme = this.loadTheme()
    this.currentBg = this.loadCustomBg()
  }

  // ---------- 读取 ----------

  getTheme(): ThemeName {
    return this.currentTheme
  }

  getCustomBg(): CustomBg {
    return this.currentBg
  }

  // ---------- 切换 ----------

  setTheme(theme: ThemeName): void {
    this.currentTheme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // localStorage 不可用（隐私模式等）时忽略，仅内存生效
    }
    this.applyThemeVars(theme)
    this.applyCustomBg(this.currentBg)
    this.emit(theme)
  }

  setCustomBg(bg: CustomBg): void {
    this.currentBg = bg
    try {
      localStorage.setItem(CUSTOM_BG_KEY, JSON.stringify(bg))
    } catch {
      // 同上，忽略
    }
    this.applyCustomBg(bg)
  }

  // ---------- 初始化 ----------

  init(): void {
    this.applyThemeVars(this.currentTheme)
    this.applyCustomBg(this.currentBg)
  }

  // ---------- 监听 ----------

  subscribe(listener: ThemeChangeListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private emit(theme: ThemeName): void {
    this.listeners.forEach((l) => {
      try {
        l(theme)
      } catch {
        // 单个监听器异常不影响其他监听器
      }
    })
  }

  // ---------- 应用 ----------

  private applyThemeVars(theme: ThemeName): void {
    const vars = THEMES[theme]
    const root = document.documentElement
    root.dataset.theme = theme
    const map: Record<string, string> = {
      '--bg-primary': vars.bgPrimary,
      '--bg-secondary': vars.bgSecondary,
      '--bg-tertiary': vars.bgTertiary,
      '--bg-card': vars.bgCard,
      '--bg-hover': vars.bgHover,
      '--border-primary': vars.borderPrimary,
      '--border-secondary': vars.borderSecondary,
      '--text-primary': vars.textPrimary,
      '--text-secondary': vars.textSecondary,
      '--text-tertiary': vars.textTertiary,
      '--status-success': vars.statusSuccess,
      '--status-warning': vars.statusWarning,
      '--status-error': vars.statusError,
      '--status-info': vars.statusInfo,
      '--brand-primary': vars.brandPrimary,
      '--brand-secondary': vars.brandSecondary,
    }
    for (const [key, value] of Object.entries(map)) {
      root.style.setProperty(key, value)
    }
  }

  /**
   * 应用自定义背景层。
   * none：移除背景层；color：背景色作为最底层；
   * gradient / texture / image：覆盖在主题底色之上。
   */
  private applyCustomBg(bg: CustomBg): void {
    const root = document.documentElement
    if (bg.type === 'none' || bg.type === 'color') {
      root.style.setProperty('--custom-bg-overlay', 'none')
      root.style.setProperty('--custom-bg-color', bg.type === 'color' ? bg.value : 'transparent')
      root.style.setProperty('--custom-bg-size', 'auto')
      return
    }
    root.style.setProperty('--custom-bg-color', 'transparent')
    root.style.setProperty('--custom-bg-size', bg.type === 'image' ? 'cover' : 'auto')
    let overlay = bg.value
    if (bg.type === 'texture') {
      if (bg.value === 'noise') {
        overlay = NOISE_SVG
      } else {
        const preset = TEXTURE_PRESETS.find((t) => t.key === bg.value)
        overlay = preset ? preset.css : 'none'
      }
    }
    root.style.setProperty('--custom-bg-overlay', overlay)
  }

  // ---------- 持久化读取 ----------

  private loadTheme(): ThemeName {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'light' || saved === 'dark' || saved === 'deep') {
        return saved
      }
    } catch {
      // 忽略
    }
    return 'deep'
  }

  private loadCustomBg(): CustomBg {
    try {
      const saved = localStorage.getItem(CUSTOM_BG_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as CustomBg
        if (parsed && typeof parsed.type === 'string' && typeof parsed.value === 'string') {
          return parsed
        }
      }
    } catch {
      // 忽略
    }
    return { type: 'none', value: '' }
  }
}

export const themeService = new ThemeService()

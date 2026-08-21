/**
 * 托盘服务模块
 */

import { Tray, Menu, nativeImage, app } from 'electron'
import path from 'path'
import { PetState } from '../windows/petWindow'

export class TrayService {
  private tray: Tray | null = null

  create(): Tray {
    // 应用图标：dev 用 public/logo.png；打包后从 resources/ 读取（extraResources 已复制）
    const appIconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'logo.png')
      : path.join(__dirname, '../public/logo.png')
    const icon = nativeImage.createFromPath(appIconPath)
    this.tray = new Tray(icon.resize({ width: 16, height: 16 }))

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '打开主界面',
        click: () => {
          // 触发主窗口显示回调
          if (this.onShowMainWindow) {
            this.onShowMainWindow()
          }
        }
      },
      {
        label: '后台运行中',
        enabled: false,
        icon: nativeImage.createFromPath(path.join(__dirname, '../../public/logo.png')).resize({ width: 12, height: 12 })
      },
      { type: 'separator' },
      {
        label: '开机自启动',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (menuItem) => {
          app.setLoginItemSettings({
            openAtLogin: menuItem.checked,
            openAsHidden: true
          })
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          if (this.onQuit) {
            this.onQuit()
          }
        }
      }
    ])

    this.tray.setToolTip('一鉴到底 - 后台运行中')
    this.tray.setContextMenu(contextMenu)

    // 单击托盘图标显示窗口
    this.tray.on('click', () => {
      if (this.onShowMainWindow) {
        this.onShowMainWindow()
      }
    })

    // 双击托盘图标
    this.tray.on('double-click', () => {
      if (this.onShowMainWindow) {
        this.onShowMainWindow()
      }
    })

    return this.tray
  }

  private onShowMainWindow?: () => void
  private onQuit?: () => void

  setShowMainWindowCallback(callback: () => void) {
    this.onShowMainWindow = callback
  }

  setQuitCallback(callback: () => void) {
    this.onQuit = callback
  }

  updateIcon(state: PetState) {
    if (!this.tray) return

    const tinted = this.getTintedIcon(state)
    if (tinted) {
      this.tray.setImage(tinted.resize({ width: 16, height: 16 }))
    }
  }

  /** 状态 → 目标 RGB（与桌宠窗口情绪色一致） */
  private stateColor(state: PetState): [number, number, number] {
    const COLORS: Record<PetState, [number, number, number]> = {
      green: [88, 214, 141],      // #58D68D 安全
      yellow: [247, 220, 111],    // #F7DC6F 关注/中等
      red: [231, 76, 60],         // #E74C3C 高风险
      thinking: [93, 173, 226],   // #5DADE2 工作中
    }
    return COLORS[state] || COLORS.green
  }

  /** 加载基础 logo（dev 从 public/，打包后从 resources/） */
  private loadBaseIcon(): Electron.NativeImage | null {
    const basePath = app.isPackaged
      ? path.join(process.resourcesPath, 'logo.png')
      : path.join(__dirname, '../public/logo.png')
    const img = nativeImage.createFromPath(basePath)
    return img.isEmpty() ? null : img
  }

  private iconCache = new Map<PetState, Electron.NativeImage>()

  /** 运行时按状态给基础 logo 染色（不依赖彩色 PNG 资源；保留形状/透明度） */
  private getTintedIcon(state: PetState): Electron.NativeImage | null {
    const cached = this.iconCache.get(state)
    if (cached) return cached

    const base = this.loadBaseIcon()
    if (!base) return null

    const size = base.getSize()
    const bmp = base.toBitmap() // BGRA
    const [r, g, b] = this.stateColor(state)
    for (let i = 0; i < bmp.length; i += 4) {
      const alpha = bmp[i + 3]
      if (alpha > 0) {
        // 30% 原色 + 70% 目标色，保留明暗层次
        bmp[i] = Math.round(bmp[i] * 0.3 + b * 0.7)       // B
        bmp[i + 1] = Math.round(bmp[i + 1] * 0.3 + g * 0.7) // G
        bmp[i + 2] = Math.round(bmp[i + 2] * 0.3 + r * 0.7) // R
      }
    }

    const tinted = nativeImage.createFromBitmap(bmp, { width: size.width, height: size.height })
    if (!tinted.isEmpty()) this.iconCache.set(state, tinted)
    return tinted
  }

  getTray(): Tray | null {
    return this.tray
  }
}
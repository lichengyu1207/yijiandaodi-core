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

    const iconMap = {
      green: 'logo-green.png',
      yellow: 'logo-yellow.png',
      red: 'logo-red.png',
      thinking: 'logo-green.png'
    }

    const iconPath = path.join(__dirname, `../../public/${iconMap[state]}`)
    const fs = require('fs')
    if (fs.existsSync(iconPath)) {
      const icon = nativeImage.createFromPath(iconPath)
      this.tray.setImage(icon.resize({ width: 16, height: 16 }))
    }
  }

  getTray(): Tray | null {
    return this.tray
  }
}
/**
 * 主窗口管理模块
 */

import { BrowserWindow, Notification, app, Menu, shell } from 'electron'
import path from 'path'

/** 替代 Electron 自带英文默认菜单栏（File/Edit/View…）为中文应用菜单 */
function setupAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '一鉴到底',
      submenu: [
        { role: 'about', label: '关于 一鉴到底' },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '官方网站',
          click: () => { shell.openExternal('https://yijiandaodi.com') },
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

export class MainWindow {
  private mainWindow: BrowserWindow | null = null
  private isQuitting: boolean = false
  /** 关闭窗口时是否隐藏到托盘常驻（受"托盘"权限门控；false=关闭即退出） */
  private closeToTray: boolean = true
  /** 系统通知开关（受"系统通知"权限门控） */
  private notificationsEnabled: boolean = true

  create(): BrowserWindow {
    // 应用图标：dev 用 public/logo.png；打包后从 resources/ 读取（extraResources 已复制）
    const appIcon = app.isPackaged
      ? path.join(process.resourcesPath, 'logo.png')
      : path.join(__dirname, '../public/logo.png')

    setupAppMenu()

    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
      autoHideMenuBar: true,
      icon: appIcon,
      show: false,
      backgroundColor: '#F5F7FA',
    })

    // 窗口准备好后显示，避免白屏
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show()
    })

    // 开发环境加载 localhost，生产环境加载打包文件
    const isDev = !app.isPackaged
    if (isDev) {
      this.mainWindow.loadURL('http://localhost:5173')
      this.mainWindow.webContents.openDevTools()
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }

    // 关闭窗口时隐藏到托盘，不退出应用
    this.mainWindow.on('close', (e) => {
      if (!this.isQuitting && this.closeToTray) {
        e.preventDefault()
        this.mainWindow?.hide()

        // 显示通知：应用仍在后台运行（受"系统通知"权限门控）
        if (this.notificationsEnabled && Notification.isSupported()) {
          const notification = new Notification({
            title: '一鉴到底',
            body: '应用已在后台运行，点击托盘图标可重新打开',
            silent: true
          })
          notification.show()
        }
      }
    })

    return this.mainWindow
  }

  getWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  show() {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore()
      }
      this.mainWindow.show()
      this.mainWindow.focus()
    }
  }

  setQuitting(value: boolean) {
    this.isQuitting = value
  }

  /** 设置关闭时是否隐藏到托盘（门控：false=关闭即退出） */
  setCloseToTray(enabled: boolean) {
    this.closeToTray = enabled
  }

  /** 设置系统通知是否启用（门控：false=不弹"后台运行"提示） */
  setNotificationsEnabled(enabled: boolean) {
    this.notificationsEnabled = enabled
  }

  send(channel: string, data: any) {
    this.mainWindow?.webContents.send(channel, data)
  }
}
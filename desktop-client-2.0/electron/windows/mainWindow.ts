/**
 * 主窗口管理模块
 */

import { BrowserWindow, Notification, app } from 'electron'
import path from 'path'

export class MainWindow {
  private mainWindow: BrowserWindow | null = null
  private isQuitting: boolean = false

  create(): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        preload: path.join(__dirname, '../preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
      icon: path.join(__dirname, '../../public/logo.png'),
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
      this.mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
    }

    // 关闭窗口时隐藏到托盘，不退出应用
    this.mainWindow.on('close', (e) => {
      if (!this.isQuitting) {
        e.preventDefault()
        this.mainWindow?.hide()

        // 显示通知：应用仍在后台运行
        if (Notification.isSupported()) {
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

  send(channel: string, data: any) {
    this.mainWindow?.webContents.send(channel, data)
  }
}
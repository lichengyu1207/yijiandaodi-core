import { Tray, Menu, nativeImage, BrowserWindow } from 'electron'

export interface TrayStats {
  status: 'online' | 'offline' | 'busy' | 'connecting' | 'error'
  computeHours: number
  points: number
}

const statusLabels = {
  online: '在线',
  offline: '离线',
  busy: '忙碌',
  connecting: '连接中',
  error: '异常'
}

export function createTray(mainWindow: BrowserWindow): Tray {
  const icon = nativeImage.createFromPath('')
  
  const tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)

  updateTrayMenu(tray, {
    status: 'connecting',
    computeHours: 0,
    points: 0
  })

  tray.setToolTip('一鉴到底 · P2P 算力节点')

  tray.on('double-click', () => {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.show()
    mainWindow.focus()
  })

  return tray
}

export function updateTrayMenu(tray: Tray, stats: TrayStats): void {
  const statusLabel = statusLabels[stats.status] || '未知'

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `节点状态：${statusLabel}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: `今日贡献算力：${stats.computeHours.toFixed(1)} 核·小时`,
      enabled: false
    },
    {
      label: `当前积分：${stats.points.toLocaleString()}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: '打开仪表盘',
      click: () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          if (win.isMinimized()) {
            win.restore()
          }
          win.show()
          win.focus()
          win.webContents.send('navigate-to', 'dashboard')
        }
      }
    },
    {
      label: '任务列表',
      click: () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          if (win.isMinimized()) {
            win.restore()
          }
          win.show()
          win.focus()
          win.webContents.send('navigate-to', 'tasks')
        }
      }
    },
    {
      label: '设置',
      click: () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          if (win.isMinimized()) {
            win.restore()
          }
          win.show()
          win.focus()
          win.webContents.send('navigate-to', 'settings')
        }
      }
    },
    { type: 'separator' },
    {
      label: stats.status === 'online' || stats.status === 'busy' 
        ? '暂停贡献算力' 
        : '开始贡献算力',
      click: () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          win.webContents.send('toggle-compute')
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        const app = require('electron').app
        ;(app as any).isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  
  const tooltip = `一鉴到底 · P2P 算力节点\n状态：${statusLabel}\n今日算力：${stats.computeHours.toFixed(1)} 核·小时\n积分：${stats.points.toLocaleString()}`
  tray.setToolTip(tooltip)
}

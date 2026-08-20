/**
 * 自动更新服务（updaterService.ts）
 *
 * 基于 electron-updater 的 autoUpdater：
 *  - 仅生产环境生效（app.isPackaged），开发环境跳过；
 *  - 应用启动后静默检查更新，发现新版本自动下载（后台）；
 *  - 下载完成后提示用户重启安装；用户选择「立即重启」则退出并安装；
 *  - 发布源由 electron-builder.yml 的 publish 配置决定（GitHub Releases → latest.yml）。
 *
 * 注意：autoUpdater 的下载/安装必须走主进程（本文件），渲染进程经 IPC 订阅更新事件。
 */

import { app, dialog, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { logger } from './loggerService'

/** 更新状态事件名（经 IPC 透传给渲染进程） */
export const UPDATER_EVENTS = {
  CHECKING: 'updater:checking',
  AVAILABLE: 'updater:available',
  NOT_AVAILABLE: 'updater:not-available',
  DOWNLOADED: 'updater:downloaded',
  ERROR: 'updater:error',
} as const

/** 是否展示「有新版本」提示（避免每次启动都打扰；有更新且非静默时展示） */
let promptOnAvailable = true

export class UpdaterService {
  private initialized = false
  private downloaded = false

  /**
   * 初始化自动更新：
   *  - 生产环境接入 electron-updater 并订阅事件；
   *  - 开发环境仅打日志，不接入（无发布源）。
   */
  init(opts: { getMainWindow: () => BrowserWindow | null; promptOnAvailable?: boolean } = {
    getMainWindow: () => BrowserWindow.getAllWindows()[0] ?? null,
  }) {
    if (!app.isPackaged) {
      logger.info('[自动更新] 开发环境跳过自动更新', { module: 'UpdaterService' })
      return
    }
    if (this.initialized) return
    this.initialized = true

    promptOnAvailable = opts.promptOnAvailable ?? true
    const getWin = opts.getMainWindow

    // 关闭自动下载前的版本提示，改为静默下载，下载完成后才询问
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => {
      logger.info('[自动更新] 正在检查更新', { module: 'UpdaterService' })
      getWin()?.webContents.send(UPDATER_EVENTS.CHECKING)
    })

    autoUpdater.on('update-available', (info) => {
      logger.info('[自动更新] 发现新版本', { module: 'UpdaterService' }, {
        version: info.version,
        releaseName: info.releaseName,
      })
      getWin()?.webContents.send(UPDATER_EVENTS.AVAILABLE, { version: info.version })
    })

    autoUpdater.on('update-not-available', () => {
      logger.info('[自动更新] 已是最新版本', { module: 'UpdaterService' })
      getWin()?.webContents.send(UPDATER_EVENTS.NOT_AVAILABLE)
    })

    autoUpdater.on('download-progress', (progress) => {
      // 进度事件高频，仅透传渲染进程（用于设置页进度条），不打日志
      getWin()?.webContents.send('updater:progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      })
    })

    autoUpdater.on('update-downloaded', async (info) => {
      this.downloaded = true
      logger.info('[自动更新] 新版本已下载', { module: 'UpdaterService' }, { version: info.version })

      const win = getWin()
      win?.webContents.send(UPDATER_EVENTS.DOWNLOADED, { version: info.version })

      // 弹窗询问是否立即重启安装
      if (win) {
        const { response } = await dialog.showMessageBox(win, {
          type: 'info',
          title: '更新已就绪',
          message: `新版本 ${info.version} 已下载完成`,
          detail: '是否立即重启应用以完成更新？',
          buttons: ['稍后', '立即重启'],
          defaultId: 1,
          cancelId: 0,
        })
        if (response === 1) {
          setImmediate(() => autoUpdater.quitAndInstall())
        }
      }
    })

    autoUpdater.on('error', (err) => {
      logger.warn('[自动更新] 检查/下载失败（不影响使用）', { module: 'UpdaterService', error: err.message })
      getWin()?.webContents.send(UPDATER_EVENTS.ERROR, { message: err.message })
    })
  }

  /** 手动触发检查更新（设置页按钮） */
  checkForUpdates(): void {
    if (!app.isPackaged || !this.initialized) return
    logger.info('[自动更新] 手动检查更新', { module: 'UpdaterService' })
    autoUpdater.checkForUpdates().catch((err) => {
      logger.warn('[自动更新] 手动检查失败', { module: 'UpdaterService', error: err.message })
    })
  }

  /** 是否已下载新版本 */
  isUpdateDownloaded(): boolean {
    return this.downloaded
  }

  /** 重启并安装（设置页「立即重启」按钮） */
  quitAndInstall(): void {
    if (!this.downloaded) return
    autoUpdater.quitAndInstall()
  }
}

/** 全局单例 */
export const updaterService = new UpdaterService()

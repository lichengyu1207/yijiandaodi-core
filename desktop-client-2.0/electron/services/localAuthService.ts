/**
 * 本地账号密码服务
 * 用于首次启动引导：设置进入本地数据库的账号密码（管理员凭据）。
 * 密码仅保存加盐哈希，不保存明文；状态持久化到 userData/data/localAuth.json。
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { logger } from './loggerService'

interface LocalAuthRecord {
  /** 用户名 */
  username: string
  /** 密码哈希（sha256(salt + password)） */
  passwordHash: string
  /** 加盐 */
  salt: string
  /** 首次设置时间 */
  createdAt: string
  /** 是否已完成首次设置引导 */
  setupCompleted: boolean
}

interface LocalAuthFile {
  record?: LocalAuthRecord
}

const AUTH_FILE_NAME = 'localAuth.json'

function getAuthFilePath(): string {
  return path.join(app.getPath('userData'), 'data', AUTH_FILE_NAME)
}

function hashPassword(password: string, salt: string): string {
  return crypto.createHash('sha256').update(salt + password).digest('hex')
}

export class LocalAuthService {
  private record: LocalAuthRecord | null = null

  constructor() {
    this.load()
  }

  private load() {
    try {
      const file = getAuthFilePath()
      if (!fs.existsSync(file)) return
      const data: LocalAuthFile = JSON.parse(fs.readFileSync(file, 'utf-8'))
      if (data.record) this.record = data.record
    } catch (error) {
      logger.error('[LocalAuth] 读取本地账号配置失败', { module: 'LocalAuthService' }, { error })
    }
  }

  private save() {
    try {
      const file = getAuthFilePath()
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const data: LocalAuthFile = { record: this.record ?? undefined }
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
      logger.error('[LocalAuth] 保存本地账号配置失败', { module: 'LocalAuthService' }, { error })
    }
  }

  /** 是否已完成首次设置（账号密码已创建） */
  isSetupCompleted(): boolean {
    return !!this.record?.setupCompleted
  }

  /** 注册本地账号（首次设置）：设置用户名 + 密码 */
  register(username: string, password: string): { success: boolean; error?: string } {
    const name = (username || '').trim()
    if (name.length < 3) {
      return { success: false, error: '用户名至少 3 个字符' }
    }
    if (!password || password.length < 6) {
      return { success: false, error: '密码至少 6 位' }
    }
    if (this.record?.setupCompleted) {
      return { success: false, error: '本地账号已设置，不可重复注册' }
    }

    const salt = crypto.randomBytes(16).toString('hex')
    this.record = {
      username: name,
      passwordHash: hashPassword(password, salt),
      salt,
      createdAt: new Date().toISOString(),
      setupCompleted: false,
    }
    this.save()
    logger.info('[LocalAuth] 本地账号已创建', { module: 'LocalAuthService' }, { username: name })
    return { success: true }
  }

  /** 登录本地数据库（校验账号密码） */
  login(username: string, password: string): { success: boolean; error?: string } {
    if (!this.record || !this.record.setupCompleted) {
      return { success: false, error: '本地账号尚未设置' }
    }
    if (this.record.username !== (username || '').trim()) {
      return { success: false, error: '用户名或密码错误' }
    }
    const hash = hashPassword(password || '', this.record.salt)
    if (hash !== this.record.passwordHash) {
      return { success: false, error: '用户名或密码错误' }
    }
    return { success: true }
  }

  /** 标记完成首次设置引导 */
  completeSetup(): { success: boolean; error?: string } {
    if (!this.record) {
      return { success: false, error: '请先设置账号密码' }
    }
    this.record.setupCompleted = true
    this.save()
    logger.info('[LocalAuth] 首次设置引导完成', { module: 'LocalAuthService' }, { username: this.record.username })
    return { success: true }
  }

  /** 获取当前账号（脱敏：不含密码哈希与盐） */
  getAccount(): { username?: string; setupCompleted: boolean } | null {
    if (!this.record) return null
    return { username: this.record.username, setupCompleted: this.record.setupCompleted }
  }
}

// 导出单例
export const localAuthService = new LocalAuthService()

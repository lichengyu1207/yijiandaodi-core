/**
 * 操作权限配置模块
 *
 * 面向"他人下载桌面端"的首次授权体系：首次启动引导用户逐项授权，
 * 授权结果持久化到 userData/data/permissionConfig.json，可在设置页随时修改。
 * 主进程据此门控各监控/Agent 写操作/系统集成能力（fail-closed）。
 *
 * 纯逻辑模块（不依赖 electron），便于单测；userData 路径由调用方传入。
 */

import * as fs from 'fs'
import * as path from 'path'

/** 可授权的操作键 */
export const PERMISSION_KEYS = [
  // 系统监控类
  'fileMonitor',
  'clipboardMonitor',
  'networkMonitor',
  'apiCallMonitor',
  // 进程与资源监控
  'processMonitor',
  'resourceMonitor',
  // 治理 Agent 写操作
  'agentWrite',
  // 系统集成类
  'autoStart',
  'tray',
  'notifications',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export interface PermissionConfig {
  /** 是否已完成首次授权引导 */
  onboarded: boolean
  granted: Record<PermissionKey, boolean>
}

export const DEFAULT_PERMISSION_CONFIG: PermissionConfig = {
  onboarded: false,
  granted: {
    // 高敏感监控：默认不授予，需用户显式同意
    fileMonitor: false,
    clipboardMonitor: false,
    networkMonitor: false,
    apiCallMonitor: false,
    processMonitor: false,
    resourceMonitor: false,
    // Agent 写操作：默认不授予（fail-closed）
    agentWrite: false,
    // 低风险且为核心体验所需，默认开启，可在设置页关闭
    autoStart: false,
    tray: true,
    notifications: true,
  },
}

export function getPermissionConfigPath(userData: string): string {
  return path.join(userData, 'data', 'permissionConfig.json')
}

/** 归一化：丢弃未知键、仅接受布尔值，保证结构完整不回退 */
export function normalizePermissionConfig(raw: unknown): PermissionConfig {
  const base: PermissionConfig = {
    ...DEFAULT_PERMISSION_CONFIG,
    granted: { ...DEFAULT_PERMISSION_CONFIG.granted },
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (typeof obj.onboarded === 'boolean') base.onboarded = obj.onboarded
    if (obj.granted && typeof obj.granted === 'object') {
      const g = obj.granted as Record<string, unknown>
      for (const k of PERMISSION_KEYS) {
        if (typeof g[k] === 'boolean') base.granted[k] = g[k]
      }
    }
  }
  return base
}

export function loadPermissionConfig(userData: string): PermissionConfig {
  try {
    const p = getPermissionConfigPath(userData)
    if (!fs.existsSync(p)) {
      return { ...DEFAULT_PERMISSION_CONFIG, granted: { ...DEFAULT_PERMISSION_CONFIG.granted } }
    }
    return normalizePermissionConfig(JSON.parse(fs.readFileSync(p, 'utf-8')))
  } catch {
    // 读取失败回退默认，不中断启动
    return { ...DEFAULT_PERMISSION_CONFIG, granted: { ...DEFAULT_PERMISSION_CONFIG.granted } }
  }
}

export function savePermissionConfig(userData: string, cfg: PermissionConfig): void {
  const p = getPermissionConfigPath(userData)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8')
}

/** 按权限生成"应启用的监控"启动计划（供主进程门控 + 单测） */
export interface MonitorStartPlan {
  fileMonitor: boolean
  clipboardMonitor: boolean
  networkMonitor: boolean
  apiCallMonitor: boolean
  processMonitor: boolean
  resourceMonitor: boolean
}

export function buildMonitorStartPlan(granted: Record<PermissionKey, boolean>): MonitorStartPlan {
  return {
    fileMonitor: granted.fileMonitor,
    clipboardMonitor: granted.clipboardMonitor,
    networkMonitor: granted.networkMonitor,
    apiCallMonitor: granted.apiCallMonitor,
    processMonitor: granted.processMonitor,
    resourceMonitor: granted.resourceMonitor,
  }
}

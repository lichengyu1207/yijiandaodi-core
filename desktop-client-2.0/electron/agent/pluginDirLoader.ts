/**
 * agent/pluginDirLoader.ts — 插件目录加载器（M3 插件源打通）
 *
 * 从插件目录扫描 openclaw.plugin.json 清单，映射为 GovPlugin 元数据；
 * 并提供插件市场安装（目录复制） / 卸载（目录删除）。
 *
 * 说明：外部插件清单为静态 JSON，无法携带 JS 钩子（subscribe/registerTools/hooks），
 * 因此映射为"元数据型" GovPlugin——可被识别、启用/停用、卸载，作为治理生态成员展示。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { GovPlugin } from './pluginRegistry'

/** openclaw.plugin.json 清单（M3 外部插件源：仅提取元数据字段） */
export interface PluginManifest {
  id?: string
  name?: string
  version?: string
  description?: string
  author?: string
  [key: string]: unknown
}

/** 插件目录中发现的外部插件包 */
export interface PluginPackageInfo {
  /** 插件 id（清单 id 或目录名兜底） */
  id: string
  name: string
  version?: string
  description?: string
  author?: string
  /** 插件包绝对路径（含 openclaw.plugin.json 的目录） */
  dir: string
  /** 原始清单 */
  manifest: PluginManifest
}

/** 把 openclaw.plugin.json 清单映射为元数据型 GovPlugin */
export function manifestToGovPlugin(pkg: PluginPackageInfo): GovPlugin {
  return {
    id: pkg.id,
    version: pkg.version,
    description: pkg.description,
  }
}

/**
 * 扫描目录下每个子目录的 openclaw.plugin.json，返回插件包信息。
 * 无清单 / 清单解析失败的目录跳过（不阻断整体扫描）。
 */
export function scanPluginDir(dir: string): PluginPackageInfo[] {
  let names: string[] = []
  try {
    names = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    return []
  }

  const result: PluginPackageInfo[] = []
  for (const name of names) {
    const pkgDir = path.join(dir, name)
    const manifestPath = path.join(pkgDir, 'openclaw.plugin.json')
    let raw: string
    try {
      raw = fs.readFileSync(manifestPath, 'utf-8')
    } catch {
      continue
    }
    let manifest: PluginManifest
    try {
      manifest = JSON.parse(raw) as PluginManifest
    } catch {
      continue
    }
    const id = (manifest.id && String(manifest.id).trim()) || name
    result.push({
      id,
      name: manifest.name || name,
      version: manifest.version,
      description: manifest.description || '',
      author: manifest.author,
      dir: pkgDir,
      manifest,
    })
  }
  return result
}

/**
 * 从市场目录安装插件包到插件目录（复制整个包目录）。
 * 目标目录已存在时先移除（重装语义）；返回安装后的插件包信息。
 */
export function installPluginFromMarket(marketDir: string, pkgId: string, pluginsDir: string): PluginPackageInfo {
  const src = path.join(marketDir, pkgId)
  if (!fs.existsSync(path.join(src, 'openclaw.plugin.json'))) {
    throw new Error(`市场插件包不存在: ${pkgId}`)
  }
  fs.mkdirSync(pluginsDir, { recursive: true })
  const dest = path.join(pluginsDir, pkgId)
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true })
  }
  fs.cpSync(src, dest, { recursive: true })
  const found = scanPluginDir(pluginsDir).find((p) => p.id === pkgId)
  if (!found) {
    throw new Error(`安装后无法识别插件: ${pkgId}`)
  }
  return found
}

/** 从插件目录移除插件包（卸载）；返回是否实际移除 */
export function uninstallPluginFromDir(pluginsDir: string, pkgId: string): boolean {
  const dest = path.join(pluginsDir, pkgId)
  if (!fs.existsSync(dest)) return false
  fs.rmSync(dest, { recursive: true, force: true })
  return true
}

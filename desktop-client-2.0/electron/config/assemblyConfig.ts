/**
 * config/assemblyConfig.ts — 配置驱动装配的默认配置与持久化（方案 A1 · T1.2）
 *
 * 两层模型的配置层：
 *  - DEFAULT_ASSEMBLY_CONFIG：与 main.ts 现状硬编码装配 1:1 对齐的默认清单
 *  - normalize/load/save：仿 permissionConfig 模式（纯逻辑、不依赖 electron，便于单测），
 *    用户级覆盖持久化到 userData/data/assemblyConfig.json
 *
 * 语义：services / monitors / plugins 三张清单为「完整清单」——用户配置中若提供某张清单，
 * 则以该清单为准（可增补「第 7 种监控」，无需改 main.ts）；缺失则回退默认清单。
 */

import * as fs from 'fs'
import * as path from 'path'
import {
  ASSEMBLY_SCHEMA_VERSION,
  AssemblyConfig,
  AssemblyParams,
  ServiceDeclaration,
  MonitorDeclaration,
  PluginDeclaration,
} from './assemblySchema'

/** 装配配置持久化路径（与权限配置同级目录） */
export function getAssemblyConfigPath(userData: string): string {
  return path.join(userData, 'data', 'assemblyConfig.json')
}

/** 默认装配配置：与 main.ts 现状装配 1:1 对齐（可枚举的服务 / 监控 / 插件） */
export const DEFAULT_ASSEMBLY_CONFIG: AssemblyConfig = {
  version: ASSEMBLY_SCHEMA_VERSION,
  services: [
    // —— 系统服务（工厂在 assembly/factories.ts 注册，依赖经 ctx.resolve() 解析）——
    { id: 'securityKB', enabled: true, params: {} },
    { id: 'fileMonitor', enabled: true, params: {} },
    { id: 'clipboardMonitor', enabled: true, params: {} },
    { id: 'storageService', enabled: true, params: {} },
    { id: 'trayService', enabled: true, params: {} },
    { id: 'apiService', enabled: true, params: {} },
    { id: 'backendService', enabled: true, params: {} },
    // 资源监控带参数透传（阈值配置随工厂约定，不进死代码）
    { id: 'memoryMonitor', enabled: true, params: { interval: 10000, warningThreshold: 70, criticalThreshold: 85 } },
    { id: 'cpuMonitor', enabled: true, params: { interval: 5000, historyRetentionTime: 60000 } },
    // 健康监控依赖 memoryMonitor/cpuMonitor（工厂内 resolve，声明顺序保证依赖先装配）
    { id: 'healthMonitor', enabled: true, params: {} },
    { id: 'behaviorRiskScorer', enabled: true, params: {} },
    { id: 'processMonitor', enabled: true, params: {} },
    { id: 'networkMonitor', enabled: true, params: {} },
    { id: 'apiCallMonitor', enabled: true, params: {} },
    { id: 'toolRegistry', enabled: true, params: {} },
    // MCP Server（方案 C）：治理能力对外暴露；惰性解析 toolRegistry/toolBridge，端口可配置
    { id: 'mcpServer', enabled: true, params: { host: '127.0.0.1', port: 39876 } },
    // 注：monitorEventAdapter 依赖跨服务消费回调闭包（petWindow/notify/behaviorRiskScorer），
    // 属特殊接线，由 assembly/bootstrap.ts 集中管理，不进配置清单。
  ],
  monitors: [
    // —— 监控 runner（装配器据此生成 MONITOR_RUNNERS，key 对应权限门控短 key）——
    { key: 'file', enabled: true, params: {} },
    { key: 'clipboard', enabled: true, params: {} },
    { key: 'process', enabled: true, params: {} },
    { key: 'network', enabled: true, params: {} },
    { key: 'apiCall', enabled: true, params: {} },
    { key: 'resource', enabled: true, params: {} },
  ],
  plugins: [
    // —— 插件（装配器据此依次 install 到 PluginRegistry）——
    { id: 'risk-summary', enabled: true, params: {} },
    { id: 'governance-pet', enabled: true, params: {} },
  ],
}

/** 深拷贝装配配置（返回独立副本，避免修改模块级默认值） */
export function cloneAssemblyConfig(cfg: AssemblyConfig): AssemblyConfig {
  return {
    version: cfg.version,
    services: cfg.services.map((s) => ({ ...s, params: { ...s.params } })),
    monitors: cfg.monitors.map((m) => ({ ...m, params: { ...m.params } })),
    plugins: cfg.plugins.map((p) => ({ ...p, params: { ...p.params } })),
  }
}

/** 规范化单个声明（id / key 均可作为唯一标识；丢弃非法项） */
function normalizeDecl(
  raw: unknown,
  fallback: { enabled: boolean; params: AssemblyParams },
): { id: string; enabled: boolean; params: AssemblyParams } | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const id =
    typeof obj.id === 'string' && obj.id.length > 0
      ? obj.id
      : typeof obj.key === 'string' && obj.key.length > 0
        ? obj.key
        : ''
  if (!id) return null
  const enabled = typeof obj.enabled === 'boolean' ? obj.enabled : fallback.enabled
  const params =
    obj.params && typeof obj.params === 'object' ? { ...(obj.params as Record<string, unknown>) } : { ...fallback.params }
  return { id, enabled, params }
}

/**
 * 归一化：丢弃未知键、过滤非法项、去重（保留首个），保证结构完整不回退。
 * services / monitors / plugins 为完整清单语义：用户提供则以其为准，缺失则回退默认。
 */
export function normalizeAssemblyConfig(raw: unknown): AssemblyConfig {
  const base = cloneAssemblyConfig(DEFAULT_ASSEMBLY_CONFIG)
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>

  if (Array.isArray(obj.services)) {
    const seen = new Set<string>()
    const services: ServiceDeclaration[] = []
    for (const item of obj.services) {
      const d = normalizeDecl(item, { enabled: true, params: {} })
      if (!d || seen.has(d.id)) continue
      seen.add(d.id)
      services.push({ id: d.id, enabled: d.enabled, params: d.params })
    }
    base.services = services
  }

  if (Array.isArray(obj.monitors)) {
    const seen = new Set<string>()
    const monitors: MonitorDeclaration[] = []
    for (const item of obj.monitors) {
      const d = normalizeDecl(item, { enabled: true, params: {} })
      if (!d || seen.has(d.id)) continue
      seen.add(d.id)
      monitors.push({ key: d.id, enabled: d.enabled, params: d.params })
    }
    base.monitors = monitors
  }

  if (Array.isArray(obj.plugins)) {
    const seen = new Set<string>()
    const plugins: PluginDeclaration[] = []
    for (const item of obj.plugins) {
      const d = normalizeDecl(item, { enabled: true, params: {} })
      if (!d || seen.has(d.id)) continue
      seen.add(d.id)
      plugins.push({ id: d.id, enabled: d.enabled, params: d.params })
    }
    base.plugins = plugins
  }

  return base
}

/** 加载装配配置：文件不存在 / 解析失败时回退默认（不中断启动） */
export function loadAssemblyConfig(userData: string): AssemblyConfig {
  try {
    const p = getAssemblyConfigPath(userData)
    if (!fs.existsSync(p)) return cloneAssemblyConfig(DEFAULT_ASSEMBLY_CONFIG)
    return normalizeAssemblyConfig(JSON.parse(fs.readFileSync(p, 'utf-8')))
  } catch {
    return cloneAssemblyConfig(DEFAULT_ASSEMBLY_CONFIG)
  }
}

/** 保存装配配置到 userData（目录不存在时自动创建） */
export function saveAssemblyConfig(userData: string, cfg: AssemblyConfig): void {
  const p = getAssemblyConfigPath(userData)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8')
}

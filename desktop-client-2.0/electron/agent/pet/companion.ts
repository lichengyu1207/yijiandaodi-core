/**
 * agent/pet/companion.ts — 治理桌宠角色系统（P2：程序化角色 + 属性绑定真实治理数据）
 *
 * 借鉴 Claude Code `src/buddy/companion.ts` 的确定性 roll 机制（Mulberry32 种子 PRNG）：
 *  - 基于稳定 seed（用户/机器指纹）确定性生成角色：稀有度、物种、名字、基础属性；
 *  - 属性 stats 不造假：数值来自真实治理运行数据（GovernanceProfile），
 *    治理表现越好 → 属性越高 → 稀有度越高 → 角色「成长」；
 *  - 与 Claude 一样：bones 每次读取时重算（不持久化），保证确定性且无法作弊。
 *
 * 设计约束：
 *  - 纯逻辑模块：不依赖 electron / 插件 / 引擎，便于单测；
 *  - 所有随机数走 seed PRNG，同一 seed 永远产出同一角色；
 *  - GovernanceProfile 缺省（未运行）时属性取基础下限，不抛错。
 */

// ============================================================================
// 类型
// ============================================================================

/** 稀有度（对齐 Claude RARITIES） */
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const
export type Rarity = (typeof RARITIES)[number]

/** 物种（桌宠形态，映射到渲染层动画皮肤） */
export const SPECIES = ['guardian', 'fox', 'owl', 'dragon', 'cat'] as const
export type Species = (typeof SPECIES)[number]

/** 属性名（对齐 Claude STAT_NAMES 风格；语义绑定治理能力） */
export const STAT_NAMES = [
  'VIGILANCE', // 警觉：感知/告警处理能力
  'WISDOM', // 智慧：验证/四官流程成功率
  'PATIENCE', // 耐心：重试/降级/异常处理
  'EXECUTION', // 执行：工具执行成功率
  'CHAOS', // 混沌：失败/告警密度（越低越好，反向）
] as const
export type StatName = (typeof STAT_NAMES)[number]

/** 真实治理运行数据（属性绑定来源） */
export interface GovernanceProfile {
  /** 治理引擎 run 总次数 */
  runs: number
  /** 成功动作数 */
  succeeded: number
  /** 失败动作数 */
  failed: number
  /** 告警数（warning/critical） */
  alerts: number
  /** 工具调用总次数 */
  tools: number
  /** 权限拒绝数 */
  denied: number
  /** verify.flow 四官全流程次数 */
  verifyFlows: number
}

/** 角色骨骼（每次读取由 seed 确定性重算） */
export interface CompanionBones {
  rarity: Rarity
  species: Species
  name: string
  shiny: boolean
  stats: Record<StatName, number>
}

/** 角色完整定义（骨骼 + 治理画像快照） */
export interface Companion extends CompanionBones {
  profile: GovernanceProfile
  hatchedAt: number
}

// ============================================================================
// 常量
// ============================================================================

/** 稀有度权重（对齐 Claude RARITY_WEIGHTS） */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
}

/** 稀有度下限（每档基础属性下限） */
export const RARITY_FLOOR: Record<Rarity, number> = {
  common: 15,
  uncommon: 30,
  rare: 45,
  epic: 60,
  legendary: 75,
}

/** 名字池（中文名，贴合「小鉴」品牌调性） */
const NAME_POOL = [
  '小鉴',
  '鉴宝',
  '阿澄',
  '澄鉴',
  '小盾',
  '鉴鉴',
  '阿察',
  '小睿',
  '鉴衡',
  '明鉴',
  '小凛',
  '澄心',
] as const

/** 稀有度徽记（渲染层展示） */
export const RARITY_STARS: Record<Rarity, string> = {
  common: '★',
  uncommon: '★★',
  rare: '★★★',
  epic: '★★★★',
  legendary: '★★★★★',
}

// ============================================================================
// 确定性 PRNG（Mulberry32，对齐 Claude companion.ts）
// ============================================================================

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a 哈希（无 Bun 依赖的确定性哈希） */
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!
}

function rollRarity(rng: () => number): Rarity {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0)
  let roll = rng() * total
  for (const rarity of RARITIES) {
    roll -= RARITY_WEIGHTS[rarity]
    if (roll < 0) return rarity
  }
  return 'common'
}

// ============================================================================
// 核心逻辑
// ============================================================================

/**
 * 由治理画像计算属性（0-100）。
 * 每个属性映射一段真实治理指标；CHAOS 反向（失败/告警越少越高）。
 * 调用前 profile 已归一化（除零保护见下方）。
 */
export function computeStats(profile: GovernanceProfile): Record<StatName, number> {
  const totalActions = profile.succeeded + profile.failed

  // 成功率（0-1；无动作时按 0.9 视为良好）
  const execRate = totalActions > 0 ? profile.succeeded / totalActions : 0.9
  // verify.flow 覆盖率（近 100 次内跑的验证流程次数，封顶 30）
  const verifyScore = Math.min(30, profile.verifyFlows) / 30
  // 告警密度（每 run 的告警数；越低越好）
  const alertDensity = profile.runs > 0 ? profile.alerts / Math.max(1, profile.runs) : 0
  // 权限拒绝率（越低越好）
  const deniedRate = profile.tools > 0 ? profile.denied / Math.max(1, profile.tools) : 0

  return {
    VIGILANCE: clamp(Math.round(20 + verifyScore * 60 + alertDensity * 10)),
    WISDOM: clamp(Math.round(25 + verifyScore * 70 + execRate * 20)),
    PATIENCE: clamp(Math.round(30 + (1 - alertDensity) * 40 + (1 - deniedRate) * 30)),
    EXECUTION: clamp(Math.round(20 + execRate * 75)),
    CHAOS: clamp(Math.round(100 - deniedRate * 80 - alertDensity * 40)),
  }
}

/** 归一到 0-100 */
function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

/** 由治理画像基础属性 + 稀有度下限 + 确定性抖动合成最终属性（全部收敛到 0-100） */
function rollStats(rng: () => number, rarity: Rarity, base: Record<StatName, number>): Record<StatName, number> {
  const floor = RARITY_FLOOR[rarity]
  const stats = {} as Record<StatName, number>
  for (const name of STAT_NAMES) {
    // 基础（治理数据）+ 确定性抖动，再抬升到稀有度下限
    const jitter = Math.floor(rng() * 15)
    stats[name] = clamp(Math.max(floor, base[name] + jitter))
  }
  return stats
}

/**
 * 确定性 roll：给定 seed + 治理画像，生成角色骨骼。
 * 同一 seed + 同一 profile → 永远同一结果（profile 增长时属性平滑上涨）。
 */
export function roll(seed: string, profile: GovernanceProfile): CompanionBones {
  const rng = mulberry32(hashString(seed + '::' + SALT))
  const rarity = rollRarity(rng)
  const base = computeStats(profile)
  const stats = rollStats(rng, rarity, base)

  return {
    rarity,
    species: pick(rng, SPECIES),
    name: pick(rng, NAME_POOL),
    shiny: rng() < 0.01,
    stats,
  }
}

/** 组合：骨骼 + 画像快照（供桌宠渲染层一次性取用） */
export function getCompanion(seed: string, profile: GovernanceProfile): Companion {
  return {
    ...roll(seed, profile),
    profile: { ...profile },
    hatchedAt: Date.now(),
  }
}

/** 默认画像（未运行治理时的初始值） */
export function emptyProfile(): GovernanceProfile {
  return { runs: 0, succeeded: 0, failed: 0, alerts: 0, tools: 0, denied: 0, verifyFlows: 0 }
}

const SALT = 'yijiandaodi-pet-2026'

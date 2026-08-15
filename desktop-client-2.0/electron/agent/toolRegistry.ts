/**
 * agent/toolRegistry.ts — M1 工具注册表
 *
 * 来源：Grok `FinalizedToolset` 注册表（register_tool / unregister_tool_by_name /
 * unregister_tools_by_prefix / tool_definitions）+ Claude `TOOL_DEFAULTS` 兜底语义。
 *
 * 职责：登记工具、按名查找、动态增删、生成 schema 清单（暴露给规划层/模型）。
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §0.2 / M1
 */

import { GovTool, ToolError } from './types'

/** 工具默认值兜底（对齐 Claude TOOL_DEFAULTS：只读默认 false、并发默认 false） */
export const TOOL_DEFAULTS = {
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isDestructive: () => false,
  maxResultSizeChars: 40_000, // 对齐 Grok DEFAULT_TOOL_OUTPUT_BYTES
} as const

/**
 * 归一化工具定义：合并默认值与工具自身实现。
 * 返回带完整字段的规范化工具（无 undefined 兜底字段，便于下游统一消费）。
 */
export function normalizeTool<Input, Output>(tool: GovTool<Input, Output>): GovTool<Input, Output> {
  return {
    ...tool,
    isConcurrencySafe: tool.isConcurrencySafe ?? TOOL_DEFAULTS.isConcurrencySafe,
    isReadOnly: tool.isReadOnly ?? TOOL_DEFAULTS.isReadOnly,
    isDestructive: tool.isDestructive ?? TOOL_DEFAULTS.isDestructive,
    maxResultSizeChars: tool.maxResultSizeChars ?? TOOL_DEFAULTS.maxResultSizeChars,
  }
}

/**
 * 工具注册表：登记 / 查找 / 动态增删 / 生成 schema 清单。
 * 对应 Grok registry：register_tool / unregister_tool_by_name /
 * unregister_tools_by_prefix / tool_definitions。
 */
export class ToolRegistry {
  private tools = new Map<string, GovTool>()

  /** 登记工具；同名重复登记时覆盖（后注册者生效，对齐 Grok register_tool 语义） */
  register(tool: GovTool): void {
    if (!tool || typeof tool.name !== 'string' || tool.name.length === 0) {
      throw new ToolError('invalid_params', `工具缺少合法 name: ${JSON.stringify(tool?.name)}`)
    }
    if (typeof tool.run !== 'function') {
      throw new ToolError('invalid_params', `工具 ${tool.name} 缺少 run 实现`)
    }
    this.tools.set(tool.name, normalizeTool(tool))
  }

  /** 按名注销，返回是否注销成功（对齐 unregister_tool_by_name） */
  unregisterByName(name: string): boolean {
    return this.tools.delete(name)
  }

  /** 按前缀批量注销，返回注销数量（对齐 unregister_tools_by_prefix） */
  unregisterByPrefix(prefix: string): number {
    let removed = 0
    for (const name of [...this.tools.keys()]) {
      if (name.startsWith(prefix)) {
        this.tools.delete(name)
        removed++
      }
    }
    return removed
  }

  /** 按名查找（返回规范化后的工具） */
  get(name: string): GovTool | undefined {
    return this.tools.get(name)
  }

  /** 是否已登记 */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /** 已登记工具数量 */
  get size(): number {
    return this.tools.size
  }

  /** 全部工具名（排序稳定，便于测试/生成清单） */
  names(): string[] {
    return [...this.tools.keys()].sort()
  }

  /** 生成 schema 清单（对齐 Grok tool_definitions() → Vec<ToolDefinition>） */
  toolDefinitions(): { name: string; description: string; inputSchema?: unknown }[] {
    return [...this.tools.values()]
      .map((t) => ({
        name: t.name,
        description: t.description,
        ...(t.inputSchema !== undefined ? { inputSchema: t.inputSchema } : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
}

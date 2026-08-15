/**
 * agent/tools/file.ts — 内置治理工具：file.read / file.write / file.search
 *
 * 来源：Grok Build 系统级文件操作（读取/编辑/搜索）的 TS 化实现。
 *
 * 设计约束（继承项目既有硬约束）：
 *  - 大文件（>5MB）异步 I/O + 有界读取，不整读进主线程；
 *  - 哈希一律流式（createReadStream）计算；
 *  - file.write 为写类工具：非只读 / 非并发安全 / 破坏性，执行前必经 ToolBridge 的
 *    canUseTool 权限钩子（四官裁决 + 二次确认），本模块不做绕过。
 *
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §0.2 / M4
 */

import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { GovTool, ToolContext, ToolError } from '../types'

/** 有界读取上限（字节）：超出只读前缀预览，避免大文件整读进内存 */
const DEFAULT_READ_CAP = 256 * 1024 // 256KB

/** 内容搜索的文件大小上限（字节）：超过则跳过内容 grep，仅按文件名匹配 */
const CONTENT_SEARCH_MAX = 1024 * 1024 // 1MB

/** 默认排除的目录名 */
const DEFAULT_EXCLUDES = ['.git', '.svn', '.hg', 'node_modules', '.DS_Store', '__pycache__', 'dist', 'dist-electron']

/** 目录递归遍历上限，防符号链接环导致死循环/栈溢出 */
const MAX_WALK_DEPTH = 32

// ============================================================================
// 内部工具函数
// ============================================================================

/** 流式计算文件 SHA-256（项目硬约束：哈希一律流式，适用所有文件大小） */
function streamSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 })
    stream.on('data', (d: Buffer) => hash.update(d))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/** 有界异步读取：最多读 maxBytes 字节（异步 I/O，不阻塞主线程），返回文本 + 是否截断 */
async function readFileBounded(
  filePath: string,
  maxBytes: number,
  encoding: BufferEncoding = 'utf-8',
): Promise<{ text: string; truncated: boolean; bytesRead: number; size: number }> {
  const handle = await fs.promises.open(filePath, 'r')
  try {
    const stat = await handle.stat()
    const toRead = Math.min(stat.size, maxBytes)
    const buffer = Buffer.alloc(toRead)
    const { bytesRead } = await handle.read(buffer, 0, toRead, 0)
    return {
      text: buffer.subarray(0, bytesRead).toString(encoding),
      truncated: bytesRead < stat.size,
      bytesRead,
      size: stat.size,
    }
  } finally {
    await handle.close()
  }
}

/** glob → RegExp（支持 ** / * / ?，路径分隔符兼容 / 和 \\） */
function globToRegExp(glob: string): RegExp {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*'
        i++
      } else {
        re += '[^/\\\\]*'
      }
    } else if (c === '?') {
      re += '[^/\\\\]'
    } else if (c === '/' || c === '\\') {
      re += '[\\\\/]'
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`^${re}$`)
}

/** 递归遍历目录（异步，带深度/排除控制），对每个文件回调 */
async function walk(
  root: string,
  rel: string,
  depth: number,
  exclude: RegExp,
  onFile: (abs: string, rel: string, depth: number) => Promise<void>,
): Promise<void> {
  if (depth > MAX_WALK_DEPTH) return
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(path.join(root, rel), { withFileTypes: true })
  } catch {
    return // 目录可能被删除/无权限，跳过
  }
  for (const entry of entries) {
    const entryRel = rel ? `${rel}/${entry.name}` : entry.name
    if (exclude.test(entry.name) || exclude.test(entryRel)) continue
    const abs = path.join(root, entryRel)
    if (entry.isDirectory()) {
      await walk(root, entryRel, depth + 1, exclude, onFile)
    } else if (entry.isFile()) {
      await onFile(abs, entryRel, depth)
    }
  }
}

// ============================================================================
// 工具定义
// ============================================================================

/** 构建 file 系列三个内置治理工具 */
export function createFileTools(): GovTool[] {
  return [
    // ---------------------------------------------------------------- file.read
    {
      name: 'file.read',
      description: '读取文件内容（有界预览 + 流式 SHA-256）。大文件只读前缀，不阻塞主进程。',
      inputSchema: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string', description: '文件绝对路径' },
          encoding: { type: 'string', description: '编码，默认 utf-8' },
          maxBytes: { type: 'integer', description: '读取上限（字节），默认 262144（256KB）' },
        },
      },
      isReadOnly: () => true,
      isConcurrencySafe: () => true,
      async run(input: { path: string; encoding?: string; maxBytes?: number }, ctx: ToolContext) {
        const abs = path.resolve(input.path)
        const maxBytes = input.maxBytes && input.maxBytes > 0 ? input.maxBytes : DEFAULT_READ_CAP

        ctx.onProgress?.({ tool: 'file.read', detail: `读取 ${abs}` })

        let stat: fs.Stats
        try {
          stat = await fs.promises.stat(abs)
        } catch {
          throw new ToolError('execution_error', `文件不存在或无法访问: ${abs}`, { path: abs })
        }
        if (!stat.isFile()) {
          throw new ToolError('execution_error', `路径不是普通文件: ${abs}`, { path: abs })
        }

        // 有界异步读取 + 流式哈希（两条 I/O 路径都异步）
        const [preview, sha256] = await Promise.all([
          readFileBounded(abs, maxBytes, (input.encoding ?? 'utf-8') as BufferEncoding).catch((e) => {
            throw new ToolError('execution_error', `读取失败: ${errorMessage(e)}`, { path: abs })
          }),
          streamSha256(abs).catch((e) => {
            throw new ToolError('execution_error', `哈希计算失败: ${errorMessage(e)}`, { path: abs })
          }),
        ])

        ctx.onProgress?.({ tool: 'file.read', detail: `完成 ${abs}（${preview.size} 字节）` })

        return {
          output: {
            path: abs,
            size: preview.size,
            sha256,
            encoding: input.encoding ?? 'utf-8',
            truncated: preview.truncated,
            previewBytes: preview.bytesRead,
            mtimeMs: stat.mtimeMs,
          },
          content: preview.truncated
            ? `${preview.text}\n…[预览截断，文件共 ${preview.size} 字节]`
            : preview.text,
        }
      },
    },

    // --------------------------------------------------------------- file.write
    {
      name: 'file.write',
      description: '写入/追加文件内容（写类治理动作，执行前必须通过 canUseTool 权限钩子）。',
      inputSchema: {
        type: 'object',
        required: ['path', 'content'],
        properties: {
          path: { type: 'string', description: '文件绝对路径' },
          content: { type: 'string', description: '要写入的内容' },
          encoding: { type: 'string', description: '编码，默认 utf-8' },
          append: { type: 'boolean', description: '是否追加模式，默认覆盖' },
          createDirs: { type: 'boolean', description: '父目录不存在时是否创建，默认 false' },
        },
      },
      isReadOnly: () => false,
      isConcurrencySafe: () => false,
      isDestructive: () => true,
      async run(
        input: { path: string; content: string; encoding?: string; append?: boolean; createDirs?: boolean },
        ctx: ToolContext,
      ) {
        const abs = path.resolve(input.path)
        ctx.onProgress?.({ tool: 'file.write', detail: `写入 ${abs}` })

        if (input.createDirs) {
          try {
            await fs.promises.mkdir(path.dirname(abs), { recursive: true })
          } catch (e) {
            throw new ToolError('execution_error', `创建父目录失败: ${errorMessage(e)}`, { path: abs })
          }
        }

        const encoding = (input.encoding ?? 'utf-8') as BufferEncoding
        try {
          if (input.append) {
            await fs.promises.appendFile(abs, input.content, encoding)
          } else {
            await fs.promises.writeFile(abs, input.content, encoding)
          }
        } catch (e) {
          throw new ToolError('execution_error', `写入失败: ${errorMessage(e)}`, { path: abs })
        }

        // 写后回读流式哈希，验证落盘内容（项目硬约束：哈希一律流式）
        let sha256 = ''
        try {
          sha256 = await streamSha256(abs)
        } catch {
          sha256 = ''
        }

        ctx.onProgress?.({ tool: 'file.write', detail: `完成 ${abs}` })

        return {
          output: {
            path: abs,
            bytesWritten: Buffer.byteLength(input.content, encoding),
            sha256,
            append: !!input.append,
          },
          content: `已${input.append ? '追加' : '写入'} ${abs}（${Buffer.byteLength(input.content, encoding)} 字节，SHA-256: ${sha256 || '计算失败'}）`,
        }
      },
    },

    // -------------------------------------------------------------- file.search
    {
      name: 'file.search',
      description: '在目录下递归搜索文件（按文件名 glob 和/或内容关键词），只读操作。',
      inputSchema: {
        type: 'object',
        required: ['root'],
        properties: {
          root: { type: 'string', description: '搜索根目录' },
          name: { type: 'string', description: '文件名 glob，如 **/*.ts、report.md' },
          content: { type: 'string', description: '内容关键词（仅搜索 ≤1MB 的文本文件）' },
          exclude: {
            type: 'array',
            items: { type: 'string' },
            description: '额外排除的目录/文件名片段',
          },
          maxResults: { type: 'integer', description: '最大返回条数，默认 100' },
        },
      },
      isReadOnly: () => true,
      isConcurrencySafe: () => true,
      async run(
        input: { root: string; name?: string; content?: string; exclude?: string[]; maxResults?: number },
        ctx: ToolContext,
      ) {
        const absRoot = path.resolve(input.root)
        const maxResults = input.maxResults && input.maxResults > 0 ? input.maxResults : 100
        const excludeList = [...DEFAULT_EXCLUDES, ...(input.exclude ?? [])]
        const excludeRe = new RegExp(excludeList.map(escapeRegExp).join('|'), 'i')
        const nameRe = input.name ? globToRegExp(input.name) : null

        ctx.onProgress?.({ tool: 'file.search', detail: `搜索 ${absRoot}` })

        let stat: fs.Stats
        try {
          stat = await fs.promises.stat(absRoot)
        } catch {
          throw new ToolError('execution_error', `根目录不存在或无法访问: ${absRoot}`, { root: absRoot })
        }
        if (!stat.isDirectory()) {
          throw new ToolError('execution_error', `根路径不是目录: ${absRoot}`, { root: absRoot })
        }

        const matches: Array<{ path: string; name: string; size: number; mtimeMs: number; lines?: string[] }> = []
        let truncated = false

        await walk(absRoot, '', 0, excludeRe, async (abs, rel) => {
          if (matches.length >= maxResults) return

          // 文件名 glob 过滤
          if (nameRe && !nameRe.test(rel)) return

          const fstat = await fs.promises.stat(abs)
          const item: (typeof matches)[number] = {
            path: abs,
            name: path.basename(abs),
            size: fstat.size,
            mtimeMs: fstat.mtimeMs,
          }

          // 内容关键词过滤（仅小文件，避免大文件整读）
          if (input.content) {
            if (fstat.size > CONTENT_SEARCH_MAX) return
            let lines: string[]
            try {
              lines = (await fs.promises.readFile(abs, 'utf-8')).split(/\r?\n/)
            } catch {
              return // 二进制/无法读取，跳过
            }
            const hitLines: string[] = []
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(input.content)) {
                hitLines.push(`L${i + 1}: ${lines[i].slice(0, 120)}`)
                if (hitLines.length >= 3) break
              }
            }
            if (hitLines.length === 0) return
            item.lines = hitLines
          }

          matches.push(item)
        })

        if (matches.length >= maxResults) truncated = true
        ctx.onProgress?.({ tool: 'file.search', detail: `完成，命中 ${matches.length} 个文件` })

        return {
          output: {
            root: absRoot,
            name: input.name ?? null,
            content: input.content ?? null,
            matches,
            matchedCount: matches.length,
            truncated,
            limit: maxResults,
          },
          content:
            matches.length === 0
              ? `未在 ${absRoot} 下命中任何文件`
              : `命中 ${matches.length} 个文件${truncated ? '（已达上限，结果被截断）' : ''}：\n` +
                matches
                  .slice(0, 20)
                  .map((m) => `- ${m.path}${m.lines ? `\n    ${m.lines.join('\n    ')}` : ''}`)
                  .join('\n') +
                (matches.length > 20 ? `\n…（其余 ${matches.length - 20} 条见 output.matches）` : ''),
        }
      },
    },
  ]
}

// ============================================================================

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

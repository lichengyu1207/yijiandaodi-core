/**
 * events/eventStore.ts — A3 事件总线持久化层（可选落盘 / 重放）
 *
 * 设计：AgentEventBus 默认是内存流（不持有完整消息数组）。A3 在总线外侧加一层
 * 可选 EventStore，把发布的事件信封追加落盘，之后可通过 replay() 流式重放。
 * 存储实现可替换（FileEventStore 为默认文件实现），总线仅依赖 EventStore 接口。
 *
 * 关键约束（对齐项目硬约束）：
 *  - 落盘用异步 I/O（fs/promises），不阻塞主线程
 *  - 读取用流式（createReadStream + readline），大文件不一次性载入内存
 *  - 追加写入经队列串行化，避免并发交错破坏行完整性（每行一个完整 JSON）
 *
 * 回归基准：持久化是**可选**能力，未配置 store 时总线行为与 A3 前完全一致。
 */

import fs from 'node:fs'
import { createReadStream } from 'node:fs'
import readline from 'node:readline'
import type { AgentEventEnvelope } from './agentEventBus'
import { governanceLogger, GovernanceLoggerLike } from './governanceLogger'

/**
 * 事件存储接口：追加 / 流式读取 / 清空 / 计数。
 * 与 electron 解耦，仅依赖文件系统与事件信封类型。
 */
export interface EventStore {
  /** 存储标识（如文件路径），用于日志 / 排查 */
  readonly name: string
  /** 追加一条事件（异步落盘；失败由调用方决定如何处理） */
  append(envelope: AgentEventEnvelope): Promise<void>
  /** 流式读取全部已落盘事件（大文件友好，逐行解析） */
  readAll(): AsyncIterable<AgentEventEnvelope>
  /** 清空存储（删除已落盘数据） */
  clear(): Promise<void>
  /** 已落盘事件条数 */
  count(): Promise<number>
  /** 等待所有已提交的写入落定（优雅关闭 / 落盘边界验证前调用） */
  flush(): Promise<void>
}

/** 重放过滤条件：可按流 / 按 run 过滤，缺省则全量 */
export interface EventReplayOptions {
  stream?: string
  runId?: string
}

/**
 * 文件事件存储：append-only JSON Lines 落盘。
 *  - 每行一个 JSON 序列化的事件信封（\n 结尾），追加写
 *  - 读取用流式 readline，跳过空行 / 损坏行（不因单行坏数据中断重放）
 *  - 写入经 promise 队列串行化，保证多事件并发 append 不交错
 *  - 关键节点打日志（[事件存储] 前缀）：初始化 / 落盘提交 / 落盘完成 / 落盘失败 / 读取起止 / 损坏行跳过 / 清空
 */
export class FileEventStore implements EventStore {
  readonly name: string
  private filePath: string
  /** 写入串行队列：前一条写完后才写下一条，保证行完整性 */
  private writeQueue: Promise<void> = Promise.resolve()
  private log: GovernanceLoggerLike
  /** 累计落盘提交条数（排查用） */
  private appendCount = 0

  constructor(filePath: string, opts?: { logger?: GovernanceLoggerLike }) {
    this.filePath = filePath
    this.name = filePath
    this.log = opts?.logger ?? governanceLogger
    this.log.info('[事件存储] 初始化', { module: 'FileEventStore', function: 'constructor' }, { filePath })
  }

  async append(envelope: AgentEventEnvelope): Promise<void> {
    const line = `${JSON.stringify(envelope)}\n`
    this.appendCount++
    // ---- 埋点：落盘提交 ----
    this.log.debug(
      `[事件存储] 落盘提交 ${envelope.stream}#${envelope.seq}`,
      { module: 'FileEventStore', function: 'append' },
      {
        filePath: this.filePath,
        runId: envelope.runId,
        stream: envelope.stream,
        seq: envelope.seq,
        ts: envelope.ts,
        appendCount: this.appendCount,
      },
    )
    const run = this.writeQueue.then(async () => {
      try {
        await fs.promises.appendFile(this.filePath, line, 'utf8')
        // ---- 埋点：落盘完成 ----
        this.log.debug(
          `[事件存储] 落盘完成 ${envelope.stream}#${envelope.seq}`,
          { module: 'FileEventStore', function: 'append' },
          { filePath: this.filePath, runId: envelope.runId, stream: envelope.stream, seq: envelope.seq },
        )
      } catch (error) {
        // ---- 埋点：落盘失败（保留原因，供排查磁盘/权限问题） ----
        this.log.error(
          `[事件存储] 落盘失败 ${envelope.stream}#${envelope.seq}`,
          { module: 'FileEventStore', function: 'append' },
          {
            filePath: this.filePath,
            runId: envelope.runId,
            stream: envelope.stream,
            seq: envelope.seq,
            error: error instanceof Error ? error.message : error,
          },
        )
        throw error
      }
    })
    // 单条写失败不毒化队列（后续写入仍可继续）
    this.writeQueue = run.catch(() => {})
    return run
  }

  async *readAll(): AsyncIterable<AgentEventEnvelope> {
    if (!fs.existsSync(this.filePath)) {
      // ---- 埋点：文件不存在（未落盘过，重放为空） ----
      this.log.info('[事件存储] 读取跳过：文件不存在', { module: 'FileEventStore', function: 'readAll' }, {
        filePath: this.filePath,
      })
      return
    }
    // ---- 埋点：读取开始 ----
    this.log.info('[事件存储] 读取开始', { module: 'FileEventStore', function: 'readAll' }, { filePath: this.filePath })
    let count = 0
    let skipped = 0
    const rl = readline.createInterface({
      input: createReadStream(this.filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    })
    for await (const line of rl) {
      const trimmed = line.trim()
      if (!trimmed) {
        skipped++
        continue
      }
      try {
        const envelope = JSON.parse(trimmed) as AgentEventEnvelope
        count++
        // ---- 埋点：逐条读取（debug，高频） ----
        this.log.debug(
          `[事件存储] 读取 ${envelope.stream}#${envelope.seq}`,
          { module: 'FileEventStore', function: 'readAll' },
          { filePath: this.filePath, runId: envelope.runId, stream: envelope.stream, seq: envelope.seq },
        )
        yield envelope
      } catch {
        skipped++
        // ---- 埋点：损坏行跳过（不中断整体重放） ----
        this.log.warn(
          '[事件存储] 跳过损坏行',
          { module: 'FileEventStore', function: 'readAll' },
          { filePath: this.filePath, linePreview: trimmed.slice(0, 80) },
        )
      }
    }
    // ---- 埋点：读取完成 ----
    this.log.info('[事件存储] 读取完成', { module: 'FileEventStore', function: 'readAll' }, {
      filePath: this.filePath,
      count,
      skipped,
    })
  }

  async clear(): Promise<void> {
    // 排队清空，避免与正在进行的 append 竞争（先等队列落定）
    await this.writeQueue
    await fs.promises.rm(this.filePath, { force: true })
    // ---- 埋点：清空完成 ----
    this.log.info('[事件存储] 清空完成', { module: 'FileEventStore', function: 'clear' }, { filePath: this.filePath })
  }

  async count(): Promise<number> {
    let n = 0
    for await (const _ of this.readAll()) n++
    return n
  }

  async flush(): Promise<void> {
    await this.writeQueue
    // ---- 埋点：flush 落定（优雅关闭 / 落盘边界校验前调用） ----
    this.log.debug('[事件存储] flush 落定', { module: 'FileEventStore', function: 'flush' }, { filePath: this.filePath })
  }
}

/** 无持久化的空存储（默认）：append/clear/count/flush 均幂等空操作 */
export const NULL_STORE: EventStore = {
  name: 'null',
  async append() {},
  async *readAll() {},
  async clear() {},
  async count() {
    return 0
  },
  async flush() {},
}

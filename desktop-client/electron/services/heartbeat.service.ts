import * as os from 'node:os';
import { net } from 'electron';
import CryptoService from './crypto.service';
import IdleDetectorService, { type IdleState } from './idle-detector.service';

const HEARTBEAT_INTERVAL_MS = 10000;

interface HeartbeatPayload {
  timestamp: string;
  metrics: {
    cpu_usage: number;
    memory_usage: number;
    gpu_usage: number | null;
    disk_io_usage: number;
    network_bandwidth_usage: number;
  };
  idle_state: IdleState;
  active_tasks: string[];
  signature?: string;
}

interface HeartbeatAck {
  status: string;
  server_time: string;
  pending_tasks: string[];
  next_heartbeat_in_seconds: number;
}

type PendingTasksCallback = (tasks: string[]) => void;

class HeartbeatService {
  private intervalId: NodeJS.Timer | null = null;
  private nodeId: string = '';
  private serverUrl: string = '';
  private idleDetector = IdleDetectorService;
  private pendingTasksCallback: PendingTasksCallback | null = null;
  private activeTaskIds: Set<string> = new Set();
  private privateKey: string = '';

  async start(nodeId: string, serverUrl: string): Promise<void> {
    this.nodeId = nodeId;
    this.serverUrl = serverUrl;

    await this.sendHeartbeat();

    this.intervalId = setInterval(async () => {
      try {
        await this.sendHeartbeat();
      } catch (error) {
        console.error('心跳发送失败:', error instanceof Error ? error.message : String(error));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  setActiveTasks(taskIds: string[]): void {
    this.activeTaskIds = new Set(taskIds);
  }

  addActiveTask(taskId: string): void {
    this.activeTaskIds.add(taskId);
  }

  removeActiveTask(taskId: string): void {
    this.activeTaskIds.delete(taskId);
  }

  setPrivateKey(key: string): void {
    this.privateKey = key;
  }

  onPendingTasks(callback: PendingTasksCallback): void {
    this.pendingTasksCallback = callback;
  }

  private collectMetrics(): HeartbeatPayload['metrics'] {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as Record<string, number>)[type];
      }
      totalIdle += cpu.times.idle;
    }

    const cpuUsage = totalTick > 0 ? ((1 - totalIdle / totalTick) * 100) : 0;

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = totalMemory > 0 ? (((totalMemory - freeMemory) / totalMemory) * 100) : 0;

    return {
      cpu_usage: Math.round(cpuUsage * 100) / 100,
      memory_usage: Math.round(memoryUsage * 100) / 100,
      gpu_usage: null,
      disk_io_usage: 0.5,
      network_bandwidth_usage: 0.1,
    };
  }

  async sendHeartbeat(): Promise<HeartbeatAck | null> {
    const metrics = this.collectMetrics();

    const idleState = this.idleDetector.evaluate({
      cpu: metrics.cpu_usage / 100,
      memory: metrics.memory_usage / 100,
    });

    const payload: HeartbeatPayload = {
      timestamp: new Date().toISOString(),
      metrics,
      idle_state: idleState,
      active_tasks: Array.from(this.activeTaskIds),
    };

    if (this.privateKey) {
      try {
        payload.signature = await CryptoService.sign(JSON.stringify(payload), this.privateKey);
      } catch (error) {
        console.warn('心跳签名生成失败，继续发送未签名心跳:', error instanceof Error ? error.message : String(error));
      }
    }

    try {
      const response = await fetch(`${this.serverUrl}/api/p2p/v1/nodes/${this.nodeId}/heartbeat`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`心跳请求失败: HTTP ${response.status}`);
      }

      const result = await response.json() as { success: boolean; data: HeartbeatAck };

      if (!result.success || !result.data) {
        throw new Error('心跳响应格式异常');
      }

      if (result.data.pending_tasks && result.data.pending_tasks.length > 0 && this.pendingTasksCallback) {
        this.pendingTasksCallback(result.data.pending_tasks);
      }

      return result.data;
    } catch (error) {
      throw new Error(`心跳发送异常: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.activeTaskIds.clear();
    this.pendingTasksCallback = null;
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }
}

export default new HeartbeatService();

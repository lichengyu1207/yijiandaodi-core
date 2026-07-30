import * as os from 'node:os';

export type IdleState = 'IDLE' | 'PARTIAL_BUSY' | 'BUSY';

interface SystemMetrics {
  cpu: number;
  memory: number;
  diskIo?: number;
  network?: number;
}

const THRESHOLDS = {
  cpuUsage: 0.30,
  memoryUsage: 0.40,
  diskIoUsage: 0.20,
  networkBandwidth: 0.30,
};

const EMERGENCY_THRESHOLD = 0.80;

class IdleDetectorService {
  private intervalId: NodeJS.Timer | null = null;
  private previousState: IdleState | null = null;

  evaluate(metrics: SystemMetrics): IdleState {
    const cpuBusy = metrics.cpu >= EMERGENCY_THRESHOLD;
    const memoryBusy = metrics.memory >= EMERGENCY_THRESHOLD;
    const diskIoBusy = metrics.diskIo !== undefined && metrics.diskIo >= EMERGENCY_THRESHOLD;
    const networkBusy = metrics.network !== undefined && metrics.network >= EMERGENCY_THRESHOLD;

    if (cpuBusy || memoryBusy || diskIoBusy || networkBusy) {
      return 'BUSY';
    }

    const cpuIdle = metrics.cpu < THRESHOLDS.cpuUsage;
    const memoryIdle = metrics.memory < THRESHOLDS.memoryUsage;
    const diskIoIdle = metrics.diskIo === undefined || metrics.diskIo < THRESHOLDS.diskIoUsage;
    const networkIdle = metrics.network === undefined || metrics.network < THRESHOLDS.networkBandwidth;

    if (cpuIdle && memoryIdle && diskIoIdle && networkIdle) {
      return 'IDLE';
    }

    return 'PARTIAL_BUSY';
  }

  private collectMetrics(): SystemMetrics {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as Record<string, number>)[type];
      }
      totalIdle += cpu.times.idle;
    }

    const cpuUsage = totalTick > 0 ? 1 - (totalIdle / totalTick) : 0;
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = totalMemory > 0 ? (totalMemory - freeMemory) / totalMemory : 0;

    return {
      cpu: Math.round(cpuUsage * 100) / 100,
      memory: Math.round(memoryUsage * 100) / 100,
      diskIo: undefined,
      network: undefined,
    };
  }

  startMonitoring(callback: (state: IdleState, metrics: SystemMetrics) => void, intervalMs: number = 1000): void {
    if (this.intervalId !== null) {
      this.stop();
    }

    this.previousState = null;

    this.intervalId = setInterval(() => {
      try {
        const metrics = this.collectMetrics();
        const currentState = this.evaluate(metrics);

        if (this.previousState !== currentState || this.previousState === null) {
          callback(currentState, metrics);
          this.previousState = currentState;
        }
      } catch (error) {
        console.error('闲时检测器采集指标异常:', error instanceof Error ? error.message : String(error));
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.previousState = null;
  }

  getPreviousState(): IdleState | null {
    return this.previousState;
  }

  isMonitoring(): boolean {
    return this.intervalId !== null;
  }
}

export default new IdleDetectorService();

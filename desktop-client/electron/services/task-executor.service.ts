import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import CryptoService from './crypto.service';

interface Shard {
  shard_id: string;
  task_id: string;
  sequence: number;
  payload: string;
  payload_hash: string;
  required_capabilities: string[];
  estimated_resources: { cpu_cores: number; memory_mb: number; gpu_required: boolean };
  security_level: string;
  ass_signature: string;
  timeout_ms: number;
}

interface TaskResult {
  shard_id: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
  resource_usage: { cpu_ms: number; memory_peak_mb: number };
  result_signature: string;
}

interface ExecuteOptions {
  pythonPath?: string;
  venvPath?: string;
  workDir?: string;
  timeoutMs?: number;
}

export default class TaskExecutorService {
  private activeTasks: Map<string, ChildProcess> = new Map();
  private options: ExecuteOptions;
  private pythonVenvPath: string;

  constructor(options?: ExecuteOptions) {
    this.options = options || {};
    this.pythonVenvPath = options?.venvPath || path.join(process.cwd(), 'python-runtime');
  }

  async executeTask(shard: Shard): Promise<TaskResult> {
    const startTime = Date.now();

    if (!CryptoService.verify(shard.payload, shard.ass_signature)) {
      throw new Error('ASS signature verification failed');
    }

    const workDir = this.options.workDir || process.cwd();
    const taskWorkDir = path.join(workDir, `task_${shard.shard_id}`);

    await fs.mkdir(taskWorkDir, { recursive: true });

    const inputData = JSON.parse(Buffer.from(shard.payload, 'base64').toString());
    await fs.writeFile(
      path.join(taskWorkDir, 'input.json'),
      JSON.stringify(inputData, null, 2),
      'utf-8'
    );

    const childProcess = spawn(
      this.options.pythonPath || 'python',
      [path.join(this.pythonVenvPath, 'executor.py')],
      {
        cwd: taskWorkDir,
        env: {
          ...process.env,
          TASK_SHARD_ID: shard.shard_id,
          TASK_TIMEOUT: String(shard.timeout_ms || 30000),
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    this.activeTasks.set(shard.shard_id, childProcess);

    let stdout = '';
    let stderr = '';
    let timeoutTimer: NodeJS.Timeout | null = null;
    const timeoutMs = shard.timeout_ms || this.options.timeoutMs || 30000;

    try {
      childProcess.stdin.write(JSON.stringify({ payload: inputData }));
      childProcess.stdin.end();

      const resultPromise = new Promise<void>((resolve, reject) => {
        childProcess.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        childProcess.on('close', (code) => {
          resolve();
        });

        childProcess.on('error', (err) => {
          reject(err);
        });
      });

      timeoutTimer = setTimeout(() => {
        childProcess.kill('SIGTERM');
      }, timeoutMs);

      await resultPromise;

      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
    } finally {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      this.activeTasks.delete(shard.shard_id);
    }

    const executionTimeMs = Date.now() - startTime;
    const result: Omit<TaskResult, 'result_signature'> = {
      shard_id: shard.shard_id,
      exit_code: childProcess.exitCode || 0,
      stdout,
      stderr,
      execution_time_ms: executionTimeMs,
      resource_usage: {
        cpu_ms: executionTimeMs,
        memory_peak_mb: 0,
      },
    };

    const resultString = JSON.stringify(result);
    const resultSignature = CryptoService.sign(resultString, 'placeholder-private-key');

    try {
      await fs.rm(taskWorkDir, { recursive: true, force: true });
    } catch {
      console.warn(`Failed to cleanup task directory: ${taskWorkDir}`);
    }

    return {
      ...result,
      result_signature: resultSignature,
    };
  }

  async handleForceMigrate(taskIds: string[]): Promise<void> {
    const migrateStartTime = Date.now();

    for (const taskId of taskIds) {
      const childProcess = this.activeTasks.get(taskId);
      if (!childProcess) continue;

      try {
        childProcess.kill('SIGTERM');

        const checkpointData = {
          task_id: taskId,
          status: 'force_migrated',
          timestamp: new Date().toISOString(),
          reason: 'resource_contention',
        };

        const workDir = this.options.workDir || process.cwd();
        const checkpointPath = path.join(workDir, `checkpoint_${taskId}.json`);
        await fs.writeFile(checkpointPath, JSON.stringify(checkpointData, null, 2), 'utf-8');

        console.log(`Force migrated task ${taskId}, elapsed: ${Date.now() - migrateStartTime}ms`);
      } catch (error) {
        console.error(`Failed to migrate task ${taskId}:`, error);
      } finally {
        this.activeTasks.delete(taskId);
      }

      if (Date.now() - migrateStartTime >= 100) {
        console.warn('Force migration took longer than 100ms threshold');
      }
    }
  }

  getActiveTasks(): string[] {
    return Array.from(this.activeTasks.keys());
  }
}

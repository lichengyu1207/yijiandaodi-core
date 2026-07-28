import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { app, net } from 'electron';
import CryptoService from './crypto.service';
import HeartbeatService from './heartbeat.service';

interface NodeInfo {
  node_type: 'desktop_windows' | 'desktop_mac';
  capabilities: string[];
  resources: Record<string, string | number>;
  location: string;
  client_version?: string;
  public_key_fingerprint?: string;
}

interface RegisterResponse {
  node_id: string;
  node_type: string;
  status: string;
  created_at: string;
  platform_certificate: string;
}

interface NodeStatus {
  nodeId: string;
  isConnected: boolean;
  uptime: number;
}

class P2PNodeService {
  private nodeId: string = '';
  private serverUrl: string = '';
  private platformCertificate: string = '';
  private privateKey: string = '';
  private publicKey: string = '';
  private startTime: number = 0;
  private isConnected: boolean = false;

  async register(serverUrl: string): Promise<RegisterResponse> {
    try {
      this.serverUrl = serverUrl.replace(/\/+$/, '');

      const keyPair = await CryptoService.generateKeyPair();
      this.publicKey = keyPair.publicKey;
      this.privateKey = keyPair.privateKey;

      const nodeInfo = await this.collectNodeInfo();
      nodeInfo.public_key_fingerprint = await this.generatePublicKeyFingerprint(keyPair.publicKey);

      const response = await fetch(`${this.serverUrl}/api/p2p/v1/nodes/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nodeInfo),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `节点注册失败 (HTTP ${response.status}): ${errorData.message || errorData.error_code || '未知错误'}`
        );
      }

      const result = await response.json() as RegisterResponse;

      this.nodeId = result.node_id;
      this.platformCertificate = result.platform_certificate;
      this.startTime = Date.now();
      this.isConnected = true;

      HeartbeatService.setPrivateKey(this.privateKey);
      await this.startHeartbeat();

      this.saveCredentials();

      return result;
    } catch (error) {
      this.isConnected = false;
      throw new Error(`注册异常: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async startHeartbeat(): Promise<void> {
    if (!this.nodeId || !this.serverUrl) {
      throw new Error('节点未注册，无法启动心跳');
    }

    await HeartbeatService.start(this.nodeId, this.serverUrl);
    console.log(`心跳服务已启动，节点ID: ${this.nodeId}`);
  }

  async shutdown(): Promise<void> {
    try {
      if (this.nodeId && this.serverUrl) {
        await fetch(`${this.serverUrl}/api/p2p/v1/nodes/${this.nodeId}/offline`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: '用户主动下线' }),
        }).catch((err) => {
          console.warn('发送下线通知失败:', err instanceof Error ? err.message : String(err));
        });
      }
    } catch (error) {
      console.warn('关闭节点时发生异常:', error instanceof Error ? error.message : String(error));
    } finally {
      HeartbeatService.stop();
      this.clearCredentials();
      this.isConnected = false;
      this.nodeId = '';
      this.platformCertificate = '';
      this.privateKey = '';
      this.publicKey = '';
      this.startTime = 0;
    }
  }

  getStatus(): NodeStatus {
    return {
      nodeId: this.nodeId,
      isConnected: this.isConnected,
      uptime: this.startTime > 0 ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
    };
  }

  getNodeId(): string {
    return this.nodeId;
  }

  getServerUrl(): string {
    return this.serverUrl;
  }

  getPlatformCertificate(): string {
    return this.platformCertificate;
  }

  private async collectNodeInfo(): Promise<NodeInfo> {
    const cpus = os.cpus();
    const totalMemoryGb = Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100;
    const cpuModel = cpus[0]?.model || 'Unknown';

    let gpuAvailable = false;
    let gpuModel: string | undefined;
    let gpuVramGb: number | undefined;

    try {
      gpuAvailable = await this.detectGPU();
      if (gpuAvailable) {
        const gpuInfo = await this.getGPUInfo();
        gpuModel = gpuInfo.model;
        gpuVramGb = gpuInfo.vramGb;
      }
    } catch (error) {
      console.warn('GPU检测失败:', error instanceof Error ? error.message : String(error));
    }

    let location = 'unknown';
    try {
      location = await this.fetchPublicIpLocation();
    } catch (error) {
      console.warn('获取地理位置失败:', error instanceof Error ? error.message : String(error));
    }

    const capabilities: string[] = ['python_runtime', 'sandbox_execution'];
    if (gpuAvailable) {
      capabilities.push('gpu_compute');
    }

    return {
      node_type: process.platform === 'darwin' ? 'desktop_mac' : 'desktop_windows',
      capabilities,
      resources: {
        cpu_cores: cpus.length,
        memory_gb: totalMemoryGb,
        gpu_available: gpuAvailable,
        ...(gpuModel && { gpu_model: gpuModel }),
        ...(gpuVramGb !== undefined && { gpu_vram_gb: gpuVramGb }),
        disk_free_gb: Math.round(this.getFreeDiskSpaceGb() * 100) / 100,
      },
      location,
      client_version: app.getVersion(),
    };
  }

  private async detectGPU(): Promise<boolean> {
    if (process.platform === 'win32') {
      try {
        const { execSync } = require('node:child_process');
        const output = execSync('wmic path win32_VideoController get Name', {
          encoding: 'utf-8',
          timeout: 5000,
        });
        return output.toLowerCase().includes('nvidia') ||
               output.toLowerCase().includes('amd') ||
               output.toLowerCase().includes('intel');
      } catch {
        return false;
      }
    }

    if (process.platform === 'darwin') {
      try {
        const { execSync } = require('node:child_process');
        execSync('system_profiler SPDisplaysDataType', { encoding: 'utf-8', timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  private async getGPUInfo(): Promise<{ model: string; vramGb: number }> {
    if (process.platform === 'win32') {
      try {
        const { execSync } = require('node:child_process');
        const nameOutput = execSync(
          'wmic path win32_VideoController get Name /value',
          { encoding: 'utf-8', timeout: 5000 }
        );
        const adapterRamOutput = execSync(
          'wmic path win32_VideoController get AdapterRAM /value',
          { encoding: 'utf-8', timeout: 5000 }
        );

        const nameMatch = nameOutput.match(/Name=(.+)/);
        const ramMatch = adapterRamOutput.match(/AdapterRAM=(\d+)/);

        return {
          model: nameMatch?.[1]?.trim() || 'Unknown GPU',
          vramGb: ramMatch?.[1] ? Math.round(parseInt(ramMatch[1], 10) / (1024 * 1024 * 1024) * 100) / 100 : 0,
        };
      } catch {
        return { model: 'Unknown GPU', vramGb: 0 };
      }
    }

    return { model: 'Unknown GPU', vramGb: 0 };
  }

  private async fetchPublicIpLocation(): Promise<string> {
    try {
      const response = await fetch('https://ipinfo.io/json', {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json() as { city?: string; region?: string; country?: string };
        const parts = [data.city, data.region, data.country].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : 'unknown';
      }
    } catch {
      // fallback
    }

    try {
      const response = await fetch('https://api.ipify.org?format=json', {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        return 'detected';
      }
    } catch {
      // fallback
    }

    return 'unknown';
  }

  private getFreeDiskSpaceGb(): number {
    try {
      const homedir = os.homedir();
      if (fs.existsSync(homedir)) {
        const stats = fs.statSync(homedir);
        // 简化实现：返回估算值
        return 50;
      }
    } catch {
      // ignore
    }
    return 0;
  }

  private async generatePublicKeyFingerprint(publicKeyPem: string): Promise<string> {
    const crypto = await import('node:crypto');
    const hash = crypto.createHash('sha256').update(publicKeyPem).digest('hex');
    return hash.substring(0, 16).toUpperCase();
  }

  private saveCredentials(): void {
    try {
      const userDataPath = app.getPath('userData');
      const credDir = path.join(userDataPath, 'p2p_credentials');

      if (!fs.existsSync(credDir)) {
        fs.mkdirSync(credDir, { recursive: true });
      }

      const credentials = {
        node_id: this.nodeId,
        platform_certificate: this.platformCertificate,
        server_url: this.serverUrl,
        saved_at: new Date().toISOString(),
      };

      fs.writeFileSync(
        path.join(credDir, 'credentials.json'),
        JSON.stringify(credentials, null, 2),
        'utf-8'
      );

      fs.writeFileSync(
        path.join(credDir, 'private_key.pem'),
        this.privateKey,
        'utf-8'
      );

      fs.writeFileSync(
        path.join(credDir, 'public_key.pem'),
        this.publicKey,
        'utf-8'
      );

      console.log('凭证已保存到本地存储');
    } catch (error) {
      console.error('保存凭证失败:', error instanceof Error ? error.message : String(error));
    }
  }

  private clearCredentials(): void {
    try {
      const userDataPath = app.getPath('userData');
      const credDir = path.join(userDataPath, 'p2p_credentials');

      if (fs.existsSync(credDir)) {
        const files = ['credentials.json', 'private_key.pem', 'public_key.pem'];
        for (const file of files) {
          const filePath = path.join(credDir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }

        fs.rmdirSync(credDir);
        console.log('本地凭证已清除');
      }
    } catch (error) {
      console.error('清除凭证失败:', error instanceof Error ? error.message : String(error));
    }
  }
}

export default new P2PNodeService();

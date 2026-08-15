/**
 * WebSocket告警客户端
 *
 * 实时接收后端推送的告警消息
 */

import WebSocket from 'ws';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// WebSocket配置
const WS_BASE = import.meta.env.DEV
  ? 'ws://localhost:9092'
  : 'wss://yijiandaodi.com';

// 心跳间隔（30秒）
const HEARTBEAT_INTERVAL = 30000;
// 心跳超时（5秒后未收到pong响应，认为连接假死）
const HEARTBEAT_TIMEOUT = 5000;

/**
 * 告警消息类型
 */
interface AlertMessage {
  type: 'alert';
  data: {
    alert_id: string;
    timestamp: string;
    session_id: string;
    client_id: string;
    agent_type: string;
    action: string;
    risk_level: 'danger' | 'critical';
    overall_score: number;
    risk_score: number;
    target: string;
    recommendations: string[];
    activity_id: string;
  };
}

/**
 * 告警回调函数类型
 */
type AlertCallback = (alert: AlertMessage['data']) => void;

/**
 * WebSocket告警客户端
 */
export class AlertWebSocketClient {
  private ws: WebSocket | null = null;
  private clientId: string;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private isManualClose = false; // 标记是否主动关闭
  private alertCallbacks: AlertCallback[] = [];

  constructor() {
    // 获取client_id（与LogBatchCollector共享）
    const userDataPath = app.getPath('userData');
    const clientIdPath = path.join(userDataPath, 'client-id.txt');

    if (fs.existsSync(clientIdPath)) {
      this.clientId = fs.readFileSync(clientIdPath, 'utf-8').trim();
    } else {
      // 如果没有client_id，说明LogBatchCollector还没初始化
      this.clientId = `desktop_${Date.now()}`;
    }

    this.connect();
  }

  /**
   * 连接到WebSocket服务器
   */
  private connect(): void {
    const wsUrl = `${WS_BASE}/ws/agent-alerts/${this.clientId}/`;

    console.log(`[WebSocket] 连接到: ${wsUrl}`);

    // 重置手动关闭标志
    this.isManualClose = false;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('[WebSocket] 连接成功');
        this.isConnected = true;
        this.startHeartbeat();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        // 处理Buffer或String类型
        const message = typeof data === 'string' ? data : data.toString();
        this.handleMessage(message);
      });

      this.ws.on('close', () => {
        console.log('[WebSocket] 连接关闭');
        this.handleDisconnect();
      });

      this.ws.on('error', (error) => {
        console.error('[WebSocket] 连接错误:', error.message);
        // 不在这里设置isConnected，让close事件统一处理
      });

    } catch (error) {
      console.error('[WebSocket] 创建连接失败:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'connection_established':
          console.log('[WebSocket] 服务器确认连接:', message.message);
          break;

        case 'alert':
          console.log('[WebSocket] 收到告警:', message.data.risk_level, message.data.overall_score);
          this.notifyAlertCallbacks(message.data);
          break;

        case 'pong':
          // 心跳响应，清除超时定时器
          this.clearHeartbeatTimeout();
          break;

        default:
          console.log('[WebSocket] 未知消息类型:', message.type);
      }

    } catch (error) {
      console.error('[WebSocket] 解析消息失败:', error);
    }
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // 先清理旧的定时器

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.ws) {
        try {
          this.ws.send(JSON.stringify({
            type: 'ping',
            timestamp: Date.now()
          }));

          // 启动超时检测
          this.startHeartbeatTimeout();
        } catch (error) {
          console.error('[WebSocket] 发送心跳失败:', error);
          this.handleDisconnect();
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearHeartbeatTimeout();
  }

  /**
   * 启动心跳超时检测
   */
  private startHeartbeatTimeout(): void {
    this.clearHeartbeatTimeout();

    this.heartbeatTimeoutTimer = setTimeout(() => {
      console.warn('[WebSocket] 心跳响应超时，断开连接');
      this.handleDisconnect();

      // 主动断开连接
      if (this.ws) {
        this.ws.terminate();
      }
    }, HEARTBEAT_TIMEOUT);
  }

  /**
   * 清除心跳超时定时器
   */
  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /**
   * 处理断开连接（统一入口）
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    this.stopHeartbeat();

    // 只有非手动关闭时才触发重连
    if (!this.isManualClose) {
      this.scheduleReconnect();
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    // 如果正在重连，跳过
    if (this.reconnectTimer) {
      return;
    }

    // 如果是手动关闭，不重连
    if (this.isManualClose) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      console.log('[WebSocket] 尝试重连...');
      this.reconnectTimer = null;
      this.connect();
    }, 5000); // 5秒后重连
  }

  /**
   * 注册告警回调
   */
  public onAlert(callback: AlertCallback): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * 通知所有回调
   */
  private notifyAlertCallbacks(alert: AlertMessage['data']): void {
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('[WebSocket] 回调执行失败:', error);
      }
    });
  }

  /**
   * 获取统计信息
   */
  public getStats(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.ws) {
        reject(new Error('WebSocket未连接'));
        return;
      }

      const timeout = setTimeout(() => {
        // 超时时移除监听器
        this.ws?.off('message', handler);
        reject(new Error('获取统计超时'));
      }, 5000);

      const handler = (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'stats') {
            clearTimeout(timeout);
            this.ws?.off('message', handler);
            resolve(message.data);
          }
        } catch (error) {
          // 忽略解析错误
        }
      };

      this.ws.on('message', handler);

      try {
        this.ws.send(JSON.stringify({ type: 'get_stats' }));
      } catch (error) {
        clearTimeout(timeout);
        this.ws?.off('message', handler);
        reject(new Error('发送请求失败'));
      }
    });
  }

  /**
   * 销毁实例
   */
  public destroy(): void {
    // 标记为手动关闭，阻止重连
    this.isManualClose = true;

    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.alertCallbacks = [];
  }
}

// 导出单例
export const alertWebSocketClient = new AlertWebSocketClient();
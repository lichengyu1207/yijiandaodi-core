import { app, BrowserWindow, ipcMain } from 'electron'
import * as os from 'node:os';
import { createTray } from './tray'
import P2PNodeService from './services/p2p-node.service';

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: '一鉴到底 · P2P 算力节点',
    webPreferences: {
      preload: __dirname + '/preload.js',
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(__dirname + '/../dist/index.html')
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
}

async function getSystemInfo(): Promise<Record<string, unknown>> {
  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  let cpuIdle = 0;
  let cpuTotal = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      cpuTotal += (cpu.times as Record<string, number>)[type];
    }
    cpuIdle += cpu.times.idle;
  }
  const cpuUsagePercent = cpuTotal > 0 ? Math.round((1 - cpuIdle / cpuTotal) * 10000) / 100 : 0;

  let gpuInfo: Record<string, unknown> | null = null;

  try {
    if (process.platform === 'win32') {
      const { execSync } = require('node:child_process');
      const nameOutput = execSync('wmic path win32_VideoController get Name /value', {
        encoding: 'utf-8',
        timeout: 5000,
      });
      const ramOutput = execSync('wmic path win32_VideoController get AdapterRAM /value', {
        encoding: 'utf-8',
        timeout: 5000,
      });

      const nameMatch = nameOutput.match(/Name=(.+)/);
      const ramMatch = ramOutput.match(/AdapterRAM=(\d+)/);

      gpuInfo = {
        model: nameMatch?.[1]?.trim() || 'Unknown',
        vram_gb: ramMatch?.[1] ? Math.round(parseInt(ramMatch[1], 10) / (1024 ** 3) * 100) / 100 : 0,
        available: true,
      };
    } else if (process.platform === 'darwin') {
      gpuInfo = {
        model: 'Apple GPU',
        vram_gb: 'unified',
        available: true,
      };
    }
  } catch {
    gpuInfo = { available: false };
  }

  const interfaces = os.networkInterfaces();
  const networkInterfaces: string[] = [];
  if (interfaces) {
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (addrs) {
        for (const addr of addrs) {
          if (!addr.internal && addr.family === 'IPv4') {
            networkInterfaces.push(`${name}: ${addr.address}`);
          }
        }
      }
    }
  }

  return {
    hostname: os.hostname(),
    platform: process.platform,
    arch: os.arch(),
    os_type: os.type(),
    os_release: os.release(),
    os_version: os.version(),
    cpu_model: cpus[0]?.model || 'Unknown',
    cpu_cores: cpus.length,
    cpu_usage_percent: cpuUsagePercent,
    memory_total_mb: Math.round(totalMemory / (1024 * 1024)),
    memory_used_mb: Math.round(usedMemory / (1024 * 1024)),
    memory_free_mb: Math.round(freeMemory / (1024 * 1024)),
    gpu: gpuInfo,
    network_interfaces: networkInterfaces,
    home_dir: os.homedir(),
    tmp_dir: os.tmpdir(),
    uptime_seconds: os.uptime(),
    node_version: process.version,
    electron_version: process.versions.electron,
    chrome_version: process.versions.chrome,
    app_version: app.getVersion(),
  };
}

function registerIpcHandlers(): void {
  ipcMain.handle('p2p:register', async (_event, serverUrl: string) => {
    try {
      if (!serverUrl || typeof serverUrl !== 'string') {
        return { success: false, error: 'serverUrl 参数无效' };
      }

      const result = await P2PNodeService.register(serverUrl);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('p2p:get-status', async () => {
    try {
      const status = P2PNodeService.getStatus();
      return { success: true, data: status };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('p2p:shutdown', async () => {
    try {
      await P2PNodeService.shutdown();
      return { success: true, message: '节点已下线' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('task:get-active', async () => {
    return { tasks: [] };
  });

  ipcMain.handle('task:submit-result', async (_event, result: unknown) => {
    return { success: true, message: `结果提交占位` };
  });

  ipcMain.handle('system:get-info', async () => {
    try {
      const info = await getSystemInfo();
      return { success: true, data: info };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

app.whenReady().then(() => {
  createWindow()
  createTray(mainWindow!)
  registerIpcHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  ;(global as any).isQuitting = true
  try {
    await P2PNodeService.shutdown();
  } catch {
    // ignore shutdown errors during quit
  }
})

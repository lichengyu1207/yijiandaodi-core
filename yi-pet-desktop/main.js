/**
 * 一鉴到底桌宠 - Electron主进程
 */

const { app, BrowserWindow, ipcMain, Tray, nativeImage, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');

// 配置
const CONFIG = {
  PET_SIZE: { width: 120, height: 150 },
  API_URL: 'http://localhost:8000',
  ESP32_IP: '192.168.1.100',
  PYTHON_PATH: 'python',
  DETECTOR_SCRIPT: path.join(__dirname, '../realtime_interceptor.py')
};

// 全局变量
let mainWindow = null;
let tray = null;
let detectorProcess = null;
let currentState = 'green'; // green/yellow/red

/**
 * 创建桌宠窗口
 */
function createPetWindow() {
  const { width, height } = CONFIG.PET_SIZE;
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    x: screenWidth - width - 50,
    y: screenHeight - height - 50,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  // 窗口事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 拖拽移动
  mainWindow.on('will-move', (event, bounds) => {
    // 限制在屏幕范围内
    const display = screen.getPrimaryDisplay();
    const { width, height } = bounds;
    if (bounds.x < 0) bounds.x = 0;
    if (bounds.y < 0) bounds.y = 0;
    if (bounds.x + width > display.workAreaSize.width) {
      bounds.x = display.workAreaSize.width - width;
    }
    if (bounds.y + height > display.workAreaSize.height) {
      bounds.y = display.workAreaSize.height - height;
    }
  });
}

/**
 * 创建系统托盘
 */
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath);

  tray = new Tray(trayIcon);
  tray.setToolTip('一鉴到底桌宠');

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });

  tray.on('right-click', () => {
    // 显示右键菜单
    const { Menu } = require('electron');
    const contextMenu = Menu.buildFromTemplate([
      { label: '显示桌宠', click: () => mainWindow?.show() },
      { label: '隐藏桌宠', click: () => mainWindow?.hide() },
      { type: 'separator' },
      { label: '开始检测', click: () => startDetection() },
      { label: '停止检测', click: () => stopDetection() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]);
    tray.popUpContextMenu(contextMenu);
  });
}

/**
 * 启动检测进程
 */
function startDetection() {
  if (detectorProcess) {
    console.log('检测进程已在运行');
    return;
  }

  updateState('yellow');

  detectorProcess = spawn(CONFIG.PYTHON_PATH, [CONFIG.DETECTOR_SCRIPT], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  detectorProcess.stdout.on('data', (data) => {
    console.log(`检测输出: ${data}`);
    parseDetectorOutput(data.toString());
  });

  detectorProcess.stderr.on('data', (data) => {
    console.error(`检测错误: ${data}`);
  });

  detectorProcess.on('close', (code) => {
    console.log(`检测进程退出，代码: ${code}`);
    detectorProcess = null;
    updateState('green');
  });
}

/**
 * 停止检测进程
 */
function stopDetection() {
  if (detectorProcess) {
    detectorProcess.kill();
    detectorProcess = null;
  }
  updateState('green');
}

/**
 * 解析检测输出
 */
function parseDetectorOutput(output) {
  try {
    const data = JSON.parse(output);

    if (data.risk_level === 'critical' || data.risk_level === 'high') {
      updateState('red');
      showRiskAlert(data);
    } else if (data.risk_level === 'medium') {
      updateState('yellow');
    } else {
      updateState('green');
    }
  } catch (error) {
    console.error('解析检测输出失败:', error);
  }
}

/**
 * 更新状态
 */
function updateState(newState) {
  if (currentState === newState) return;

  currentState = newState;

  // 通知渲染进程
  if (mainWindow) {
    mainWindow.webContents.send('state-change', newState);
  }

  // 同步到ESP32
  syncToESP32(newState);

  // 更新托盘图标
  updateTrayIcon(newState);

  console.log(`状态更新: ${newState}`);
}

/**
 * 同步状态到ESP32
 */
async function syncToESP32(state) {
  try {
    await axios.get(`http://${CONFIG.ESP32_IP}/status`, {
      params: { state }
    });
    console.log(`ESP32状态同步: ${state}`);
  } catch (error) {
    console.error('ESP32同步失败:', error.message);
  }
}

/**
 * 显示风险警报
 */
function showRiskAlert(riskData) {
  const { dialog } = require('electron');

  dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: '风险警告',
    message: `发现${riskData.risk_level}风险！`,
    detail: riskData.description,
    buttons: ['允许', '拒绝', '查看详情'],
    defaultId: 1,
    cancelId: 1
  }).then((result) => {
    const { response } = result;

    if (response === 0) {
      // 允许
      console.log('用户允许操作');
      updateState('green');
    } else if (response === 1) {
      // 拒绝
      console.log('用户拒绝操作');
      updateState('green');
    } else if (response === 2) {
      // 查看详情
      console.log('查看风险详情:', riskData);
      updateState('green');
    }
  });
}

/**
 * 更新托盘图标
 */
function updateTrayIcon(state) {
  const iconMap = {
    green: 'icon-green.png',
    yellow: 'icon-yellow.png',
    red: 'icon-red.png'
  };

  const iconPath = path.join(__dirname, 'assets', iconMap[state]);
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray.setImage(trayIcon);
}

/**
 * 应用启动
 */
app.whenReady().then(() => {
  createPetWindow();
  createTray();

  // 自动启动检测
  // startDetection();
});

/**
 * 应用退出
 */
app.on('window-all-closed', () => {
  stopDetection();
  app.quit();
});

app.on('before-quit', () => {
  stopDetection();
});

/**
 * IPC通信
 */
ipcMain.on('get-state', (event) => {
  event.reply('state-change', currentState);
});

ipcMain.on('start-detection', () => {
  startDetection();
});

ipcMain.on('stop-detection', () => {
  stopDetection();
});

ipcMain.on('user-confirm', (event, action) => {
  console.log(`用户确认: ${action}`);
  updateState('green');
});
/**
 * 一鉴到底桌宠 - 预加载脚本
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('yiPetAPI', {
  // 获取当前状态
  getState: () => ipcRenderer.invoke('get-state'),

  // 开始检测
  startDetection: () => ipcRenderer.send('start-detection'),

  // 停止检测
  stopDetection: () => ipcRenderer.send('stop-detection'),

  // 用户确认
  userConfirm: (action) => ipcRenderer.send('user-confirm', action),

  // 监听状态变化
  onStateChange: (callback) => {
    ipcRenderer.on('state-change', (event, state) => {
      callback(state);
    });
  },

  // 移除监听器
  removeStateChangeListener: () => {
    ipcRenderer.removeAllListeners('state-change');
  }
});
/**
 * 主进程集成示例
 * 展示如何在 Electron 主进程中使用 @lichengyu1207/yijiandaodi-security-core
 */

import { app, ipcMain } from 'electron';
import * as path from 'path';
import { YijianDaoDiCore } from '@lichengyu1207/yijiandaodi-security-core';
import type { AuditRecord, Risk } from '@lichengyu1207/yijiandaodi-security-core';

// 创建全局核心实例
let core: YijianDaoDiCore;

/**
 * 初始化核心库
 */
export function initializeCore() {
  console.log('[Core] 初始化安全核心库...');

  core = new YijianDaoDiCore({
    storage: {
      path: path.join(app.getPath('userData'), 'data'),
      maxRecords: 1000
    },
    callbacks: {
      onRiskDetected: (risks: Risk[], context: any) => {
        console.log('[Core] 检测到风险:', risks.length, '个');
        console.log('[Core] 来源:', context.source);
        
        // 发送到主窗口
        ipcMain.emit('risk-detected', null, { risks, context });
      },
      onSaveRecord: (record: AuditRecord) => {
        console.log('[Core] 记录已保存:', record.id);
        
        // 发送到主窗口
        ipcMain.emit('record-saved', null, record);
      },
      onError: (error: Error) => {
        console.error('[Core] 错误:', error.message);
      }
    }
  });

  console.log('[Core] ✅ 核心库初始化完成');
}

/**
 * 获取核心实例
 */
export function getCore(): YijianDaoDiCore {
  if (!core) {
    throw new Error('核心库未初始化，请先调用 initializeCore()');
  }
  return core;
}

/**
 * 检测内容
 */
export function detectContent(content: string, source: string): AuditRecord | null {
  const core = getCore();
  const risks = core.detect(content);

  if (risks.length > 0) {
    return core.detectWithReport(content, source);
  }

  return null;
}

/**
 * 批量检测文件
 */
export async function detectFiles(filePaths: string[]): Promise<AuditRecord[]> {
  const fs = require('fs').promises;
  const reports: AuditRecord[] = [];

  for (const filePath of filePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const report = detectContent(content, filePath);

      if (report) {
        reports.push(report);
      }
    } catch (error) {
      console.error(`[Core] 读取文件失败: ${filePath}`, error);
    }
  }

  return reports;
}

/**
 * 获取所有审计记录
 */
export function getAuditRecords(): AuditRecord[] {
  const core = getCore();
  return core.getRecords();
}

/**
 * 导出审计记录
 */
export function exportAuditRecords(format: 'json' | 'csv' = 'json'): string {
  const core = getCore();
  return core.exportRecords(format);
}

/**
 * 清除审计记录
 */
export function clearAuditRecords(): void {
  const core = getCore();
  core.clearRecords();
}

// IPC 处理器
export function registerCoreIpcHandlers() {
  // 检测内容
  ipcMain.handle('core:detect', async (event, content: string, source: string) => {
    return detectContent(content, source);
  });

  // 批量检测文件
  ipcMain.handle('core:detect-files', async (event, filePaths: string[]) => {
    return await detectFiles(filePaths);
  });

  // 获取审计记录
  ipcMain.handle('core:get-records', async () => {
    return getAuditRecords();
  });

  // 导出审计记录
  ipcMain.handle('core:export-records', async (event, format: 'json' | 'csv') => {
    return exportAuditRecords(format);
  });

  // 清除审计记录
  ipcMain.handle('core:clear-records', async () => {
    clearAuditRecords();
    return true;
  });

  console.log('[Core] ✅ IPC 处理器注册完成');
}

// 使用示例
/*
// 在 main.ts 中
import { initializeCore, registerCoreIpcHandlers } from './core-integration';

app.whenReady().then(() => {
  // 初始化核心库
  initializeCore();
  
  // 注册 IPC 处理器
  registerCoreIpcHandlers();
  
  // 创建窗口等...
});
*/
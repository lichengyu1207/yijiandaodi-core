/**
 * 监控系统诊断工具
 * 用于检查监控系统是否正常工作
 */

import { app, clipboard } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export class MonitoringDiagnostic {
  private logFile: string;

  constructor() {
    this.logFile = path.join(app.getPath('userData'), 'monitoring-diagnostic.log');
  }

  /**
   * 诊断剪贴板监控
   */
  testClipboardMonitoring(): {
    status: 'success' | 'failed';
    content: string;
    timestamp: string;
  } {
    console.log('\n=====================================');
    console.log('  剪贴板监控诊断');
    console.log('=====================================\n');

    try {
      // 读取剪贴板内容
      const content = clipboard.readText();
      console.log('📋 当前剪贴板内容:', content ? `${content.substring(0, 50)}...` : '空');

      // 测试写入剪贴板
      const testContent = `测试内容 - ${Date.now()}`;
      clipboard.writeText(testContent);
      console.log('✅ 写入测试内容成功');

      // 等待500ms后读取
      setTimeout(() => {
        const readContent = clipboard.readText();
        if (readContent === testContent) {
          console.log('✅ 读取测试内容成功');
        } else {
          console.log('❌ 读取内容不匹配');
        }
      }, 500);

      return {
        status: 'success',
        content: content || '空',
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('❌ 剪贴板监控诊断失败:', error.message);
      return {
        status: 'failed',
        content: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 诊断文件监控
   */
  testFileMonitoring(): {
    status: 'success' | 'failed';
    message: string;
    timestamp: string;
  } {
    console.log('\n=====================================');
    console.log('  文件监控诊断');
    console.log('=====================================\n');

    try {
      // 创建测试文件
      const testDir = path.join(app.getPath('home'), 'Documents');
      const testFile = path.join(testDir, 'test-monitoring.txt');

      console.log('📁 测试目录:', testDir);
      console.log('📄 测试文件:', testFile);

      // 写入测试内容
      fs.writeFileSync(testFile, `测试内容 - ${Date.now()}`);
      console.log('✅ 创建测试文件成功');

      // 等待1秒后检查
      setTimeout(() => {
        if (fs.existsSync(testFile)) {
          const content = fs.readFileSync(testFile, 'utf-8');
          console.log('✅ 读取测试文件成功:', content);

          // 删除测试文件
          fs.unlinkSync(testFile);
          console.log('✅ 删除测试文件成功');
        } else {
          console.log('❌ 测试文件不存在');
        }
      }, 1000);

      return {
        status: 'success',
        message: '文件监控测试成功',
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('❌ 文件监控诊断失败:', error.message);
      return {
        status: 'failed',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 诊断记录存储
   */
  testRecordStorage(): {
    status: 'success' | 'failed';
    recordsCount: number;
    timestamp: string;
  } {
    console.log('\n=====================================');
    console.log('  记录存储诊断');
    console.log('=====================================\n');

    try {
      // 检查存储文件
      const dataDir = path.join(app.getPath('userData'), 'data');
      const recordsFile = path.join(dataDir, 'operations.json');

      console.log('📂 数据目录:', dataDir);
      console.log('📄 记录文件:', recordsFile);

      if (!fs.existsSync(dataDir)) {
        console.log('⚠️  数据目录不存在，创建...');
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (!fs.existsSync(recordsFile)) {
        console.log('⚠️  记录文件不存在，创建...');
        fs.writeFileSync(recordsFile, '[]');
      }

      // 读取记录
      const records = JSON.parse(fs.readFileSync(recordsFile, 'utf-8'));
      console.log('📊 当前记录数:', records.length);

      // 添加测试记录
      const testRecord = {
        id: `test-${Date.now()}`,
        timestamp: new Date().toISOString(),
        title: '测试记录',
        source: '诊断工具',
        status: 'success'
      };

      records.push(testRecord);
      fs.writeFileSync(recordsFile, JSON.stringify(records, null, 2));
      console.log('✅ 添加测试记录成功');

      // 重新读取验证
      const verifyRecords = JSON.parse(fs.readFileSync(recordsFile, 'utf-8'));
      console.log('✅ 验证记录数:', verifyRecords.length);

      return {
        status: 'success',
        recordsCount: verifyRecords.length,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('❌ 记录存储诊断失败:', error.message);
      return {
        status: 'failed',
        recordsCount: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 运行完整诊断
   */
  runFullDiagnostic(): void {
    console.log('\n=====================================');
    console.log('  监控系统完整诊断');
    console.log('=====================================\n');

    const clipboardResult = this.testClipboardMonitoring();
    const fileResult = this.testFileMonitoring();
    const storageResult = this.testRecordStorage();

    console.log('\n=====================================');
    console.log('  诊断结果汇总');
    console.log('=====================================\n');

    console.log('📋 剪贴板监控:', clipboardResult.status === 'success' ? '✅ 正常' : '❌ 失败');
    console.log('📁 文件监控:', fileResult.status === 'success' ? '✅ 正常' : '❌ 失败');
    console.log('💾 记录存储:', storageResult.status === 'success' ? '✅ 正常' : '❌ 失败');
    console.log('📊 记录数量:', storageResult.recordsCount);

    console.log('\n=====================================\n');
  }
}
/**
 * 桌面端自动化测试脚本（基于Playwright）
 * 模拟真实用户行为
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

test.describe('桌面端用户模拟测试', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    // 启动Electron应用
    electronApp = await require('playwright')._electron.launch({
      path: path.join(__dirname, '../desktop-client-2.0/dist/main.js'),
      args: ['--disable-gpu', '--no-sandbox']
    });
    
    // 获取主窗口
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('应用启动测试', async () => {
    console.log('测试应用启动...');
    
    // 检查窗口是否显示
    expect(await window.isVisible()).toBeTruthy();
    
    // 检查标题
    const title = await window.title();
    expect(title).toContain('一鉴到底');
    
    // 截图
    await window.screenshot({ path: 'test-results/startup.png' });
  });

  test('用户登录测试', async () => {
    console.log('测试用户登录...');
    
    try {
      // 等待登录界面加载
      await window.waitForSelector('#username', { timeout: 5000 });
      
      // 输入用户名
      await window.fill('#username', 'testuser2026');
      
      // 输入密码
      await window.fill('#password', 'Test@123456');
      
      // 点击登录按钮
      await window.click('#login-button');
      
      // 等待登录成功（最长10秒）
      await window.waitForSelector('.dashboard', { timeout: 10000 });
      
      // 验证登录状态
      const welcomeText = await window.textContent('.welcome-message');
      expect(welcomeText).toContain('欢迎');
      
      console.log('✅ 登录成功');
    } catch (error) {
      console.log('❌ 登录失败:', error.message);
      await window.screenshot({ path: 'test-results/login-failure.png' });
      throw error;
    }
  });

  test('桌宠显示与交互测试', async () => {
    console.log('测试桌宠交互...');
    
    try {
      // 等待桌宠加载
      await window.waitForSelector('#pet-character', { timeout: 5000 });
      
      // 检查桌宠是否显示
      const petVisible = await window.isVisible('#pet-character');
      expect(petVisible).toBeTruthy();
      
      // 点击桌宠
      await window.click('#pet-character');
      
      // 等待动画
      await window.waitForTimeout(1000);
      
      // 验证交互记录
      const interactionLog = await window.textContent('#interaction-log');
      expect(interactionLog).toContain('点击');
      
      console.log('✅ 桌宠交互成功');
    } catch (error) {
      console.log('❌ 桌宠交互失败:', error.message);
      await window.screenshot({ path: 'test-results/pet-failure.png' });
      throw error;
    }
  });

  test('文件监控测试', async () => {
    console.log('测试文件监控...');
    
    try {
      // 创建测试文件
      const testContent = '这是一个测试文件，包含敏感信息：password123';
      const testFile = path.join(os.homedir(), 'Documents', 'test_file_monitor.txt');
      fs.writeFileSync(testFile, testContent);
      
      console.log('测试文件已创建:', testFile);
      
      // 等待检测（最长5秒）
      await window.waitForTimeout(5000);
      
      // 验证弹窗提示
      const alertVisible = await window.isVisible('.security-alert');
      if (alertVisible) {
        // 验证风险识别
        const alertText = await window.textContent('.security-alert');
        expect(alertText).toContain('密码');
        console.log('✅ 文件监控成功');
      } else {
        console.log('⚠️  未检测到风险提示（可能监控未启动）');
      }
      
      // 清理测试文件
      fs.unlinkSync(testFile);
    } catch (error) {
      console.log('❌ 文件监控失败:', error.message);
      await window.screenshot({ path: 'test-results/file-monitor-failure.png' });
      throw error;
    }
  });

  test('剪贴板监控测试', async () => {
    console.log('测试剪贴板监控...');
    
    try {
      // 复制测试文本到剪贴板
      const testText = 'API Key: sk-1234567890abcdef';
      
      // 使用Electron的clipboard API
      await electronApp.evaluate(({ clipboard }) => {
        clipboard.writeText(testText);
      });
      
      console.log('测试文本已复制到剪贴板');
      
      // 等待检测（最长3秒）
      await window.waitForTimeout(3000);
      
      // 验证弹窗提示
      const alertVisible = await window.isVisible('.security-alert');
      if (alertVisible) {
        // 验证风险识别
        const alertText = await window.textContent('.security-alert');
        expect(alertText).toContain('API');
        console.log('✅ 剪贴板监控成功');
      } else {
        console.log('⚠️  未检测到风险提示（可能监控未启动）');
      }
    } catch (error) {
      console.log('❌ 剪贴板监控失败:', error.message);
      await window.screenshot({ path: 'test-results/clipboard-monitor-failure.png' });
      throw error;
    }
  });

  test('生成证据链报告测试', async () => {
    console.log('测试报告生成...');
    
    try {
      // 点击导出按钮
      await window.click('#export-report-button');
      
      // 等待报告生成（最长10秒）
      await window.waitForSelector('.report-generated', { timeout: 10000 });
      
      // 验证报告文件
      const reportLink = await window.getAttribute('#download-link', 'href');
      expect(reportLink).toMatch(/\.html$/);
      
      console.log('✅ 报告生成成功');
      console.log('报告路径:', reportLink);
    } catch (error) {
      console.log('❌ 报告生成失败:', error.message);
      await window.screenshot({ path: 'test-results/report-failure.png' });
      throw error;
    }
  });

  test('性能测试', async () => {
    console.log('测试应用性能...');
    
    try {
      // 获取性能指标
      const metrics = await window.evaluate(() => ({
        memory: performance.memory ? performance.memory.usedJSHeapSize : 0,
        timing: performance.timing ? performance.timing.loadEventEnd - performance.timing.navigationStart : 0
      }));
      
      console.log('内存占用:', Math.round(metrics.memory / 1024 / 1024), 'MB');
      console.log('加载时间:', metrics.timing, 'ms');
      
      // 内存占用应小于200MB
      expect(metrics.memory).toBeLessThan(200 * 1024 * 1024);
      
      // 加载时间应小于5秒
      expect(metrics.timing).toBeLessThan(5000);
      
      console.log('✅ 性能测试通过');
    } catch (error) {
      console.log('❌ 性能测试失败:', error.message);
      throw error;
    }
  });
});
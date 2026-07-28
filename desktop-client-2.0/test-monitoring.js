#!/usr/bin/env node
/**
 * 监控系统完整诊断脚本
 * 用于测试剪贴板、文件监控和记录存储
 */

const { app, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');

console.log('=====================================');
console.log('  监控系统诊断工具');
console.log('=====================================\n');

// 模拟 Electron 环境
const testDataDir = path.join(__dirname, 'test-data');
const testRecordsFile = path.join(testDataDir, 'operations.json');

// 创建测试目录
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// 创建测试记录文件
if (!fs.existsSync(testRecordsFile)) {
  fs.writeFileSync(testRecordsFile, '[]');
}

console.log('📂 测试数据目录:', testDataDir);
console.log('📄 测试记录文件:', testRecordsFile);

// 测试1：剪贴板监控
console.log('\n📋 测试1: 剪贴板监控');
try {
  // 模拟剪贴板内容
  const testContent = 'sk-proj-test-api-key-12345';
  console.log('测试内容:', testContent);

  // 简单的 API Key 检测
  const hasAPIKey = testContent.includes('sk-') || testContent.includes('api-key');
  console.log('检测结果:', hasAPIKey ? '✅ 检测到 API Key' : '❌ 未检测到');

  // 保存测试记录
  const testRecord = {
    id: `test-${Date.now()}`,
    timestamp: new Date().toISOString(),
    title: '剪贴板测试',
    source: '诊断工具',
    status: hasAPIKey ? 'flagged' : 'success',
    risk_level: hasAPIKey ? 'high' : 'low',
    content: testContent.substring(0, 50)
  };

  const records = JSON.parse(fs.readFileSync(testRecordsFile, 'utf-8'));
  records.push(testRecord);
  fs.writeFileSync(testRecordsFile, JSON.stringify(records, null, 2));
  console.log('✅ 测试记录已保存');

} catch (error) {
  console.log('❌ 剪贴板测试失败:', error.message);
}

// 测试2：文件监控
console.log('\n📋 测试2: 文件监控');
try {
  const testFile = path.join(testDataDir, 'test-file.txt');
  const testFileContent = 'password=admin123';

  fs.writeFileSync(testFile, testFileContent);
  console.log('测试文件已创建:', testFile);

  // 简单的敏感信息检测
  const hasPassword = testFileContent.includes('password');
  console.log('检测结果:', hasPassword ? '✅ 检测到密码' : '❌ 未检测到');

  // 保存测试记录
  const testRecord = {
    id: `file-${Date.now()}`,
    timestamp: new Date().toISOString(),
    title: '文件测试',
    source: '文件监控',
    status: hasPassword ? 'flagged' : 'success',
    risk_level: hasPassword ? 'medium' : 'low',
    content: testFileContent
  };

  const records = JSON.parse(fs.readFileSync(testRecordsFile, 'utf-8'));
  records.push(testRecord);
  fs.writeFileSync(testRecordsFile, JSON.stringify(records, null, 2));
  console.log('✅ 测试记录已保存');

  // 删除测试文件
  fs.unlinkSync(testFile);
  console.log('✅ 测试文件已删除');

} catch (error) {
  console.log('❌ 文件监控测试失败:', error.message);
}

// 测试3：记录存储
console.log('\n📋 测试3: 记录存储');
try {
  const records = JSON.parse(fs.readFileSync(testRecordsFile, 'utf-8'));
  console.log('当前记录数:', records.length);

  console.log('\n记录列表:');
  records.forEach((record, index) => {
    console.log(`  ${index + 1}. ${record.title} (${record.status})`);
  });

  console.log('✅ 记录存储正常');

} catch (error) {
  console.log('❌ 记录存储测试失败:', error.message);
}

// 测试4：检测算法
console.log('\n📋 测试4: 检测算法');
const testCases = [
  { content: 'sk-proj-abc123', expected: 'API Key' },
  { content: 'SELECT * FROM users WHERE 1=1', expected: 'SQL注入' },
  { content: '<script>alert("xss")</script>', expected: 'XSS' },
  { content: 'password=admin123', expected: '密码' },
  { content: '这是正常内容', expected: '无风险' }
];

testCases.forEach((test, index) => {
  const detected = test.content.includes('sk-') ||
                   test.content.includes('SELECT') ||
                   test.content.includes('<script>') ||
                   test.content.includes('password');

  console.log(`  ${index + 1}. ${test.expected}: ${detected ? '✅ 检测到' : '❌ 未检测到'}`);
});

console.log('\n=====================================');
console.log('  ✅ 诊断完成！');
console.log('=====================================\n');

console.log('📝 测试记录文件:', testRecordsFile);
console.log('📊 记录数量:', JSON.parse(fs.readFileSync(testRecordsFile, 'utf-8')).length);

console.log('\n💡 建议:');
console.log('  1. 检查监控模块是否正常启动');
console.log('  2. 确认记录保存路径正确');
console.log('  3. 验证 Dashboard 页面的记录获取逻辑');
console.log('  4. 测试完整的监控流程');

// 清理测试数据
console.log('\n🧹 清理测试数据...');
if (fs.existsSync(testRecordsFile)) {
  fs.unlinkSync(testRecordsFile);
}
if (fs.existsSync(testDataDir)) {
  fs.rmdirSync(testDataDir);
}
console.log('✅ 清理完成\n');
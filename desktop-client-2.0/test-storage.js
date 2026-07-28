/**
 * 测试存储服务是否正常工作
 */

const fs = require('fs');
const path = require('path');

// 模拟 Electron 的 app.getPath
const userDataPath = path.join(process.env.APPDATA || process.env.HOME, '一鉴到底');
const dataPath = path.join(userDataPath, 'data');
const operationsFile = path.join(dataPath, 'operations.json');

console.log('=== 存储服务测试 ===');
console.log('数据路径:', dataPath);
console.log('记录文件:', operationsFile);

// 检查目录是否存在
if (!fs.existsSync(dataPath)) {
  console.log('❌ 数据目录不存在，创建中...');
  fs.mkdirSync(dataPath, { recursive: true });
  console.log('✅ 数据目录已创建');
} else {
  console.log('✅ 数据目录已存在');
}

// 检查记录文件是否存在
if (!fs.existsSync(operationsFile)) {
  console.log('❌ 记录文件不存在，创建空文件...');
  fs.writeFileSync(operationsFile, '[]');
  console.log('✅ 记录文件已创建');
} else {
  console.log('✅ 记录文件已存在');
  
  // 读取现有记录
  try {
    const data = fs.readFileSync(operationsFile, 'utf-8');
    const operations = JSON.parse(data);
    console.log(`📊 当前记录数: ${operations.length}`);
    
    if (operations.length > 0) {
      console.log('\n最新的5条记录:');
      operations.slice(-5).forEach((op, i) => {
        console.log(`\n${i + 1}. ${op.title || op.content}`);
        console.log(`   时间: ${op.timestamp}`);
        console.log(`   风险: ${op.risk_level} (${op.risk_score}分)`);
        console.log(`   来源: ${op.source}`);
      });
    }
  } catch (error) {
    console.error('❌ 读取记录失败:', error.message);
  }
}

// 测试写入一条记录
console.log('\n=== 测试写入记录 ===');
const testRecord = {
  id: `test-${Date.now()}`,
  type: 'test_op',
  title: '测试记录',
  content: '这是一条测试记录',
  source: '测试脚本',
  status: 'verified',
  risk_level: 'low',
  risk_score: 10,
  should_block: false,
  context: '测试上下文',
  explanation: '这是一条测试记录',
  timestamp: new Date().toISOString(),
  audit_hash: `test-${Date.now()}`
};

try {
  let operations = [];
  if (fs.existsSync(operationsFile)) {
    const data = fs.readFileSync(operationsFile, 'utf-8');
    operations = JSON.parse(data);
  }
  
  operations.push(testRecord);
  fs.writeFileSync(operationsFile, JSON.stringify(operations, null, 2));
  console.log('✅ 测试记录写入成功');
  console.log(`📊 总记录数: ${operations.length}`);
} catch (error) {
  console.error('❌ 写入记录失败:', error.message);
}

console.log('\n=== 测试完成 ===');
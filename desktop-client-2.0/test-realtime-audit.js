/**
 * 实时审计和哈希存证测试
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 记录文件路径
const userDataPath = path.join(process.env.APPDATA || process.env.HOME, '一鉴到底');
const operationsFile = path.join(userDataPath, 'data', 'operations.json');

console.log('=====================================');
console.log('  实时审计和哈希存证测试');
console.log('=====================================\n');

console.log('📁 记录文件路径:', operationsFile);

// 清空现有记录
try {
  fs.writeFileSync(operationsFile, '[]');
  console.log('✅ 已清空现有记录\n');
} catch (error) {
  console.log('⚠️  记录文件不存在，将创建新文件\n');
}

// 测试用例
const testCases = [
  {
    name: 'API Key 检测',
    content: 'sk-proj-abc123def456ghj789klm012nop345qrs678tuv901wxy234zab567cde890',
    expectedRisk: 'high',
    expectedType: 'apikey'
  },
  {
    name: 'SQL 注入检测',
    content: "SELECT * FROM users WHERE id = 1 OR 1=1; --",
    expectedRisk: 'high',
    expectedType: 'sqli'
  },
  {
    name: '敏感信息检测',
    content: 'password=admin123&secret=mysecretkey',
    expectedRisk: 'medium',
    expectedType: 'sensitive'
  }
];

// 等待用户复制内容
console.log('📋 测试步骤:');
console.log('1. 按顺序复制以下内容到剪贴板:');
console.log('');

testCases.forEach((testCase, i) => {
  console.log(`   测试 ${i + 1}: ${testCase.name}`);
  console.log(`   内容: ${testCase.content.substring(0, 50)}...`);
  console.log('');
});

console.log('2. 观察桌宠状态变化:');
console.log('   - 绿灯 -> 黄灯（检测中）');
console.log('   - 黄灯 -> 红灯（发现风险）');
console.log('   - 弹出风险警告窗口');
console.log('');
console.log('3. 检查审计记录和哈希存证');
console.log('');

// 监控记录文件变化
let testIndex = 0;
let lastCount = 0;
let checkInterval = setInterval(() => {
  try {
    if (fs.existsSync(operationsFile)) {
      const data = fs.readFileSync(operationsFile, 'utf-8');
      const operations = JSON.parse(data);

      if (operations.length !== lastCount) {
        console.log(`\n📊 记录数变化: ${lastCount} -> ${operations.length}`);

        if (operations.length > lastCount) {
          const newRecords = operations.slice(lastCount);

          console.log('\n✅ 新记录已保存:');
          newRecords.forEach((record, i) => {
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`记录 ${i + 1}:`);
            console.log(`  标题: ${record.title}`);
            console.log(`  ID: ${record.id}`);
            console.log(`  时间: ${record.timestamp}`);
            console.log(`  风险等级: ${record.risk_level}`);
            console.log(`  风险分数: ${record.risk_score}`);
            console.log(`  来源: ${record.source}`);
            console.log(`  状态: ${record.status}`);
            console.log(`  上下文: ${record.context.substring(0, 100)}...`);
            console.log(`  解释: ${record.explanation}`);
            console.log(`\n🔒 审计哈希: ${record.audit_hash}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

            // 验证哈希格式
            if (record.audit_hash && record.audit_hash.startsWith('hash-')) {
              console.log(`✅ 哈希存证验证通过`);
            } else {
              console.log(`❌ 哈希存证验证失败`);
            }

            testIndex++;
          });
        }

        lastCount = operations.length;

        // 如果所有测试完成
        if (testIndex >= testCases.length) {
          console.log('\n\n✅ 所有测试完成！');
          console.log(`📊 总记录数: ${operations.length}`);

          // 显示所有记录
          console.log('\n📋 所有审计记录:');
          operations.forEach((record, i) => {
            console.log(`${i + 1}. ${record.title} - ${record.risk_level} - ${record.audit_hash}`);
          });

          clearInterval(checkInterval);
          process.exit(0);
        }
      }
    }
  } catch (error) {
    // 文件可能正在写入，忽略错误
  }
}, 500);

// 30秒后自动结束
setTimeout(() => {
  clearInterval(checkInterval);
  console.log('\n\n⏰ 测试超时，已自动结束');
  process.exit(0);
}, 60000);
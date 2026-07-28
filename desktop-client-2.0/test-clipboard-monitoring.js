/**
 * 测试剪贴板监控和记录保存
 */

const fs = require('fs');
const path = require('path');

// 记录文件路径
const userDataPath = path.join(process.env.APPDATA || process.env.HOME, '一鉴到底');
const operationsFile = path.join(userDataPath, 'data', 'operations.json');

console.log('=== 剪贴板监控测试 ===');
console.log('记录文件:', operationsFile);

// 监控记录文件变化
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
          console.log('\n新记录:');
          newRecords.forEach((record, i) => {
            console.log(`\n${i + 1}. ${record.title}`);
            console.log(`   ID: ${record.id}`);
            console.log(`   时间: ${record.timestamp}`);
            console.log(`   风险: ${record.risk_level} (${record.risk_score}分)`);
            console.log(`   来源: ${record.source}`);
            console.log(`   审计哈希: ${record.audit_hash}`);
          });
        }
        
        lastCount = operations.length;
      }
    }
  } catch (error) {
    // 文件可能正在写入，忽略错误
  }
}, 500);

console.log('\n📝 测试说明:');
console.log('1. 复制以下内容到剪贴板:');
console.log('   sk-proj-abc123def456');
console.log('\n2. 观察控制台输出，应该看到:');
console.log('   - 桌宠变红');
console.log('   - 风险警告弹窗');
console.log('   - 记录数增加');
console.log('   - 审计哈希生成');
console.log('\n按 Ctrl+C 结束测试');

// 10秒后自动结束
setTimeout(() => {
  clearInterval(checkInterval);
  console.log('\n=== 测试结束 ===');
  process.exit(0);
}, 30000);
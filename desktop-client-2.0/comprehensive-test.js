/**
 * 完整测试：后台监控 + 记录保存 + Dashboard显示
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=====================================');
console.log('  后台监控功能全面测试');
console.log('=====================================\n');

// 1. 检查记录文件
const userDataPath = path.join(process.env.APPDATA || process.env.HOME, '一鉴到底');
const operationsFile = path.join(userDataPath, 'data', 'operations.json');

console.log('📁 步骤1: 检查记录文件');
console.log('路径:', operationsFile);

if (fs.existsSync(operationsFile)) {
  const data = fs.readFileSync(operationsFile, 'utf-8');
  const operations = JSON.parse(data);
  console.log(`✅ 文件存在，当前记录数: ${operations.length}`);

  if (operations.length > 0) {
    console.log('\n最近记录:');
    operations.slice(-3).forEach((op, i) => {
      console.log(`${i + 1}. ${op.title} - ${op.risk_level} - ${op.audit_hash}`);
    });
  }
} else {
  console.log('❌ 记录文件不存在');
  fs.mkdirSync(path.dirname(operationsFile), { recursive: true });
  fs.writeFileSync(operationsFile, '[]');
  console.log('✅ 已创建空记录文件');
}

// 2. 检查后台服务
console.log('\n📁 步骤2: 检查后台服务');
try {
  const result = execSync('netstat -ano | findstr :9092', { encoding: 'utf-8' });
  if (result.includes('LISTENING')) {
    console.log('✅ 后台服务正在运行 (端口9092)');
  } else {
    console.log('❌ 后台服务未运行');
  }
} catch (error) {
  console.log('❌ 后台服务未运行');
}

// 3. 测试剪贴板监控
console.log('\n📁 步骤3: 测试剪贴板监控');
console.log('请复制以下内容测试:');
console.log('  内容: sk-proj-test123');
console.log('  预期: 检测到API Key风险');
console.log('');
console.log('观察要点:');
console.log('  1. 桌宠状态变化: 绿灯 → 黄灯 → 红灯');
console.log('  2. 控制台输出: [剪贴板监控] 发现安全风险');
console.log('  3. 风险弹窗: 显示API Key警告');
console.log('  4. 记录保存: operations.json 文件更新');
console.log('');

// 监控记录文件变化
let checkCount = 0;
let lastCount = 0;
const maxChecks = 60; // 30秒

const checkInterval = setInterval(() => {
  checkCount++;

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
            console.log(`  风险: ${record.risk_level} (${record.risk_score}分)`);
            console.log(`  来源: ${record.source}`);
            console.log(`  哈希: ${record.audit_hash}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          });
        }

        lastCount = operations.length;
      }
    }

    // 每5秒显示一次状态
    if (checkCount % 10 === 0) {
      console.log(`[${checkCount}/${maxChecks}] 监控中... (${operations.length} 条记录)`);
    }
  } catch (error) {
    // 文件可能正在写入，忽略错误
  }

  // 超时结束
  if (checkCount >= maxChecks) {
    clearInterval(checkInterval);
    console.log('\n\n⏰ 测试结束');

    // 最终报告
    try {
      const data = fs.readFileSync(operationsFile, 'utf-8');
      const operations = JSON.parse(data);
      console.log(`📊 最终记录数: ${operations.length}`);

      if (operations.length > 0) {
        console.log('\n📋 所有记录:');
        operations.forEach((op, i) => {
          console.log(`${i + 1}. [${op.source}] ${op.title} - ${op.risk_level} - ${op.audit_hash}`);
        });
      }
    } catch (error) {
      console.error('读取记录失败:', error);
    }

    process.exit(0);
  }
}, 500);
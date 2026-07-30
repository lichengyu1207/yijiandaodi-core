/**
 * 测试本地安装
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('=====================================');
console.log('  本地安装测试');
console.log('=====================================\n');

// 1. 创建测试目录
const testDir = path.join(__dirname, 'test-local-install');
const fs = require('fs');

if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

console.log('测试目录:', testDir);
console.log('');

// 2. 创建测试 package.json
const packageJson = {
  name: 'test-yijiandaodi-core',
  version: '1.0.0',
  main: 'test.js'
};

fs.writeFileSync(
  path.join(testDir, 'package.json'),
  JSON.stringify(packageJson, null, 2)
);

// 3. 创建测试文件
const testJs = `
const { YijianDaoDiCore } = require('@lichengyu1207/yijiandaodi-core');

const core = new YijianDaoDiCore();

// 测试检测功能
console.log('测试1: API Key 检测');
const risks1 = core.detect('sk-proj-abc123');
console.log('结果:', risks1);

console.log('\\n测试2: SQL 注入检测');
const risks2 = core.detect('SELECT * FROM users WHERE 1=1');
console.log('结果:', risks2);

console.log('\\n测试3: 生成报告');
const report = core.detectWithReport('password=admin', '测试');
console.log('报告:', report);

console.log('\\n✅ 测试完成！');
`;

fs.writeFileSync(path.join(testDir, 'test.js'), testJs);

console.log('已创建测试文件');
console.log('');

// 4. 安装本地包
console.log('安装本地包...');
try {
  execSync('npm install ..', {
    cwd: testDir,
    stdio: 'inherit'
  });
  console.log('✅ 安装成功\n');
} catch (error) {
  console.log('❌ 安装失败:', error.message);
}

console.log('=====================================');
console.log('  测试说明');
console.log('=====================================');
console.log('');
console.log('1. 进入测试目录:');
console.log(`   cd ${testDir}`);
console.log('');
console.log('2. 运行测试:');
console.log('   node test.js');
console.log('');
console.log('3. 检查输出是否正确');
console.log('');

process.exit(0);
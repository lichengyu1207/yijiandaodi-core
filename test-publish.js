/**
 * NPM 发布测试脚本
 * 用于验证包是否正确发布和可用
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('=====================================');
console.log('  NPM 包发布验证');
console.log('=====================================\n');

// 1. 检查是否已登录
console.log('📋 步骤1: 检查 NPM 登录状态');
try {
  const whoami = execSync('npm whoami', { encoding: 'utf-8' }).trim();
  console.log(`✅ 已登录: ${whoami}`);
} catch (error) {
  console.log('❌ 未登录，请先运行: npm login');
  console.log('   用户名: lichengyu1207');
  console.log('   密码: 147258@Zxcvbnm');
  process.exit(1);
}

// 2. 检查包名是否可用
console.log('\n📋 步骤2: 检查包名是否可用');
try {
  const info = execSync('npm info yijiandaodi-core', { encoding: 'utf-8' });
  console.log('⚠️  包已存在，如需更新请修改版本号');
  console.log(info);
} catch (error) {
  console.log('✅ 包名可用，可以发布');
}

// 3. 检查构建文件
console.log('\n📋 步骤3: 检查构建文件');
const fs = require('fs');
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  const files = fs.readdirSync(distPath, { recursive: true });
  console.log(`✅ dist 目录存在，包含 ${files.length} 个文件`);
} else {
  console.log('❌ dist 目录不存在，请先运行: npm run build');
  process.exit(1);
}

// 4. 发布确认
console.log('\n📋 步骤4: 发布准备');
console.log('包名: yijiandaodi-core');
console.log('版本: 1.0.0');
console.log('访问级别: public');
console.log('');
console.log('准备发布到 NPM...');
console.log('请运行以下命令完成发布:');
console.log('');
console.log('  npm publish --access public');
console.log('');
console.log('或运行 publish.bat 脚本');
console.log('');

// 5. 发布后验证指令
console.log('📋 步骤5: 发布后验证');
console.log('发布成功后，运行以下命令验证:');
console.log('');
console.log('  npm info yijiandaodi-core');
console.log('  npm install yijiandaodi-core');
console.log('');
console.log('或在新目录中测试:');
console.log('');
console.log('  mkdir test-package');
console.log('  cd test-package');
console.log('  npm init -y');
console.log('  npm install yijiandaodi-core');
console.log('');
console.log('然后创建 test.js:');
console.log('');
console.log('  const { YijianDaoDiCore } = require("yijiandaodi-core");');
console.log('  const core = new YijianDaoDiCore();');
console.log('  console.log(core.detect("sk-proj-test"));');
console.log('');
console.log('运行测试:');
console.log('');
console.log('  node test.js');
console.log('');

process.exit(0);
/**
 * NPM 发布问题诊断脚本
 */

const { execSync } = require('child_process');

console.log('=====================================');
console.log('  NPM 发布问题诊断');
console.log('=====================================\n');

// 1. 检查 NPM 版本
console.log('📋 检查 NPM 版本...');
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ NPM 版本: ${npmVersion}`);
} catch (error) {
  console.log('❌ 无法获取 NPM 版本');
}

// 2. 检查登录状态
console.log('\n📋 检查登录状态...');
try {
  const whoami = execSync('npm whoami', { encoding: 'utf-8' }).trim();
  console.log(`✅ 已登录用户: ${whoami}`);
  
  // 检查用户信息
  try {
    const userInfo = execSync(`npm profile get`, { encoding: 'utf-8' });
    console.log('\n用户信息:');
    console.log(userInfo);
  } catch (error) {
    console.log('⚠️  无法获取用户详细信息');
  }
} catch (error) {
  console.log('❌ 未登录 NPM');
}

// 3. 检查网络连接
console.log('\n📋 检查网络连接...');
try {
  execSync('npm ping', { encoding: 'utf-8' });
  console.log('✅ NPM registry 连接正常');
} catch (error) {
  console.log('❌ 无法连接到 NPM registry');
}

// 4. 检查包名是否已存在
console.log('\n📋 检查包名...');
const packageJson = require('./package.json');
console.log(`包名: ${packageJson.name}`);

try {
  const info = execSync(`npm info ${packageJson.name}`, { encoding: 'utf-8' });
  console.log('⚠️  包已存在！');
  console.log(info.substring(0, 200) + '...');
} catch (error) {
  console.log('✅ 包名可用');
}

// 5. 检查 NPM 配置
console.log('\n📋 检查 NPM 配置...');
try {
  const config = execSync('npm config list', { encoding: 'utf-8' });
  console.log(config);
} catch (error) {
  console.log('❌ 无法获取 NPM 配置');
}

// 6. 检查代理设置
console.log('\n📋 检查代理设置...');
try {
  const proxy = execSync('npm config get proxy', { encoding: 'utf-8' }).trim();
  const httpsProxy = execSync('npm config get https-proxy', { encoding: 'utf-8' }).trim();
  
  if (proxy === 'null' && httpsProxy === 'null') {
    console.log('✅ 未配置代理');
  } else {
    console.log(`代理: ${proxy}`);
    console.log(`HTTPS代理: ${httpsProxy}`);
  }
} catch (error) {
  console.log('❌ 无法检查代理设置');
}

// 7. 尝试获取日志文件
console.log('\n📋 查找最近的错误日志...');
const path = require('path');
const fs = require('fs');
const logsDir = 'C:\\Users\\Administrator\\AppData\\Local\\npm-cache\\_logs';

if (fs.existsSync(logsDir)) {
  const logs = fs.readdirSync(logsDir)
    .filter(f => f.endsWith('-debug-0.log'))
    .sort()
    .reverse()
    .slice(0, 1);
  
  if (logs.length > 0) {
    const latestLog = path.join(logsDir, logs[0]);
    console.log(`最新日志: ${latestLog}`);
    
    try {
      const logContent = fs.readFileSync(latestLog, 'utf-8');
      const lines = logContent.split('\n').slice(-20);
      console.log('\n最后20行:');
      lines.forEach(line => console.log(line));
    } catch (error) {
      console.log('❌ 无法读取日志文件');
    }
  }
}

console.log('\n=====================================');
console.log('  可能的问题和解决方案');
console.log('=====================================\n');

console.log('1. ✅ 已登录（lichengyu1207）');
console.log('');
console.log('2. ⚠️  可能的问题:');
console.log('   - NPM 账号可能有发布限制');
console.log('   - 可能需要双因素认证（2FA）');
console.log('   - 可能需要验证邮箱');
console.log('   - 可能是网络防火墙阻止');
console.log('   - 可能是 NPM 的安全策略');
console.log('');
console.log('3. 🔧 建议尝试:');
console.log('');
console.log('   方案A: 检查账号设置');
console.log('   访问: https://www.npmjs.com/settings/lichengyu1207');
console.log('   - 确认邮箱已验证');
console.log('   - 检查是否启用了 2FA');
console.log('   - 查看账号是否有其他限制');
console.log('');
console.log('   方案B: 使用 GitHub Packages');
console.log('   - 推送代码到 GitHub');
console.log('   - 使用 GitHub Package Registry');
console.log('   - 安装: npm install github:yijiandaodi/core');
console.log('');
console.log('   方案C: 使用本地路径');
console.log('   - npm install ../npm-package');
console.log('   - 或在 package.json 中使用 "file:" 协议');
console.log('');
console.log('   方案D: 联系 NPM 支持');
console.log('   - https://www.npmjs.com/support');
console.log('   - 提供错误信息和日志');
console.log('');

process.exit(0);
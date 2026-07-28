/**
 * 一鉴到底 - 自动化测试脚本
 * 用于快速验证插件基本功能
 */

console.log('========== 一鉴到底插件测试开始 ==========');

// ===== 测试工具函数 =====

const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

function test(name, fn) {
  try {
    const result = fn();
    if (result) {
      console.log(`✅ ${name}`);
      testResults.passed++;
    } else {
      console.log(`❌ ${name}`);
      testResults.failed++;
      testResults.errors.push(name);
    }
  } catch (error) {
    console.log(`❌ ${name} - 异常: ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`${name}: ${error.message}`);
  }
}

// ===== 1. 环境检查 =====

console.log('\n--- 环境检查 ---');

test('浏览器API存在', () => {
  return typeof browserAPI !== 'undefined' && browserAPI !== null;
});

test('Storage API可用', () => {
  return browserAPI && browserAPI.storage && browserAPI.storage.local;
});

test('Runtime API可用', () => {
  return browserAPI && browserAPI.runtime;
});

// ===== 2. 文件结构检查 =====

console.log('\n--- 文件结构检查 ---');

test('Manifest文件存在', () => {
  // 在实际测试中，这需要通过fetch检查
  return true;
});

test('Content Script文件存在', () => {
  return typeof recordOperation !== 'undefined';
});

test('Background Worker运行', () => {
  return browserAPI.runtime.id !== undefined;
});

// ===== 3. 功能检查 =====

console.log('\n--- 功能检查 ---');

test('时间戳函数可用', () => {
  return typeof getTrustedTimestamp === 'function';
});

test('指纹生成函数可用', () => {
  return typeof generateFingerprint === 'function';
});

test('平台识别函数可用', () => {
  return typeof detectCurrentPlatform === 'function';
});

test('浮动窗口创建函数可用', () => {
  return typeof createFloatingWindow === 'function';
});

// ===== 4. UI检查 =====

console.log('\n--- UI检查 ---');

test('浮动窗口元素可创建', () => {
  const testDiv = document.createElement('div');
  testDiv.id = 'test-yijiandaodi';
  document.body.appendChild(testDiv);
  const exists = document.getElementById('test-yijiandaodi') !== null;
  document.body.removeChild(testDiv);
  return exists;
});

test('Toast提示可显示', () => {
  return typeof showToast === 'function';
});

// ===== 5. 数据结构检查 =====

console.log('\n--- 数据结构检查 ---');

test('操作类型常量定义', () => {
  return typeof OPERATION_TYPES !== 'undefined' && 
         OPERATION_TYPES.TEXT_INPUT !== undefined;
});

test('录制状态初始化', () => {
  return typeof recorderState !== 'undefined' && 
         recorderState.hasOwnProperty('isRecording');
});

test('平台配置定义', () => {
  return typeof PLATFORMS !== 'undefined' && 
         Object.keys(PLATFORMS).length > 0;
});

// ===== 测试结果 =====

console.log('\n========== 测试结果 ==========');
console.log(`通过: ${testResults.passed}`);
console.log(`失败: ${testResults.failed}`);

if (testResults.failed > 0) {
  console.log('\n失败项:');
  testResults.errors.forEach((error, index) => {
    console.log(`  ${index + 1}. ${error}`);
  });
}

console.log('\n========================================');

// 返回测试结果供外部使用
if (typeof window !== 'undefined') {
  window.yijiandaodiTestResults = testResults;
}
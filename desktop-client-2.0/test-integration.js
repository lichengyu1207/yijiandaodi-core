/**
 * 本地包集成测试
 * 用于验证 yijiandaodi-security-core 是否正确集成
 */

// 测试导入
import { YijianDaoDiCore } from 'yijiandaodi-security-core';

console.log('=====================================');
console.log('  本地包集成测试');
console.log('=====================================\n');

// 创建实例
const core = new YijianDaoDiCore();

console.log('✅ YijianDaoDiCore 实例创建成功\n');

// 测试1：API Key 检测
console.log('📋 测试1: API Key 检测');
const apiKey = 'sk-proj-abc123def456ghj789klm012nop345qrs678tuv901wxy234zab567cde890';
const risks1 = core.detect(apiKey);

if (risks1.length > 0) {
  console.log('✅ 检测到风险:', risks1.length, '个');
  risks1.forEach((risk, index) => {
    console.log(`   风险 ${index + 1}: ${risk.type} (${risk.risk})`);
  });
} else {
  console.log('❌ 未检测到风险');
}

// 测试2：SQL 注入检测
console.log('\n📋 测试2: SQL 注入检测');
const sqlContent = "SELECT * FROM users WHERE id = 1 OR 1=1; --";
const risks2 = core.detect(sqlContent);

if (risks2.length > 0) {
  console.log('✅ 检测到风险:', risks2.length, '个');
  risks2.forEach((risk, index) => {
    console.log(`   风险 ${index + 1}: ${risk.type} (${risk.risk})`);
  });
} else {
  console.log('❌ 未检测到风险');
}

// 测试3：敏感信息检测
console.log('\n📋 测试3: 敏感信息检测');
const sensitiveContent = 'password=admin123&secret=mysecretkey&api_key=abc123';
const risks3 = core.detect(sensitiveContent);

if (risks3.length > 0) {
  console.log('✅ 检测到风险:', risks3.length, '个');
  risks3.forEach((risk, index) => {
    console.log(`   风险 ${index + 1}: ${risk.type} (${risk.risk})`);
  });
} else {
  console.log('❌ 未检测到风险');
}

// 测试4：生成审计报告
console.log('\n📋 测试4: 生成审计报告');
const reportContent = 'API Key: sk-proj-test123';
const report = core.detectWithReport(reportContent, '测试文件');

if (report) {
  console.log('✅ 审计报告生成成功');
  console.log('   ID:', report.id);
  console.log('   时间:', report.timestamp);
  console.log('   来源:', report.source);
  console.log('   风险等级:', report.risk_level);
  console.log('   风险分数:', report.risk_score);
  console.log('   审计哈希:', report.audit_hash);
} else {
  console.log('❌ 审计报告生成失败');
}

// 测试5：安全内容
console.log('\n📋 测试5: 安全内容检测');
const safeContent = '这是一个正常的内容，不包含敏感信息';
const risks5 = core.detect(safeContent);

if (risks5.length === 0) {
  console.log('✅ 内容安全，未检测到风险');
} else {
  console.log('⚠️  检测到误报:', risks5.length, '个');
}

console.log('\n=====================================');
console.log('  ✅ 所有测试完成！');
console.log('=====================================\n');

console.log('🎉 本地包集成成功！可以开始使用了。\n');

// 使用示例
console.log('📝 使用示例:');
console.log('');
console.log('// 在主进程中使用:');
console.log('import { YijianDaoDiCore } from "yijiandaodi-security-core";');
console.log('');
console.log('const core = new YijianDaoDiCore();');
console.log('const risks = core.detect("sk-proj-abc123");');
console.log('const report = core.detectWithReport("password=admin", "配置文件");');
console.log('');
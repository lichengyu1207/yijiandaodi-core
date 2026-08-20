/**
 * Evidence页面缓存逻辑测试脚本（浏览器控制台）
 *
 * 使用方法：
 * 1. 打开桌面端应用
 * 2. 打开浏览器开发者工具（F12）
 * 3. 切换到Console标签页
 * 4. 复制并粘贴此脚本
 * 5. 按回车执行
 */

(async function testCacheLogic() {
  console.log('============================================================');
  console.log('Evidence页面缓存逻辑测试');
  console.log('============================================================\n');

  // 导入LongTermMemoryApi（假设已在全局作用域）
  // 如果未导入，手动导入
  const { LongTermMemoryApi } = await import('./src/services/memoryApi.ts');
  const api = LongTermMemoryApi.getInstance();

  // 测试结果收集
  const results = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  /**
   * 辅助函数：添加测试结果
   */
  function addTest(name, passed, duration, details = null) {
    results.totalTests++;
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
    results.tests.push({
      name,
      passed,
      duration,
      details
    });

    const status = passed ? '✓' : '✗';
    console.log(`${status} ${name}: ${duration.toFixed(2)}ms`);
    if (details) {
      console.log(`  详情: ${JSON.stringify(details)}`);
    }
  }

  /**
   * 测试1: 第一次查询（无缓存）
   */
  console.log('测试1: 第一次查询（无缓存）');
  console.log('------------------------------------------------------------');

  const start1 = performance.now();
  const data1 = await api.getMemories({ limit: 10 });
  const duration1 = performance.now() - start1;

  addTest(
    '第一次查询',
    data1 && data1.length > 0,
    duration1,
    { count: data1?.length }
  );

  /**
   * 测试2: 第二次查询（有缓存）
   */
  console.log('\n测试2: 第二次查询（有缓存）');
  console.log('------------------------------------------------------------');

  const start2 = performance.now();
  const data2 = await api.getMemories({ limit: 10 });
  const duration2 = performance.now() - start2;

  const cacheHit = duration2 < duration1 / 2; // 缓存命中应该快很多
  addTest(
    '第二次查询（缓存）',
    cacheHit && data2 && data2.length > 0,
    duration2,
    {
      count: data2?.length,
      cacheHit,
      improvement: `${((1 - duration2 / duration1) * 100).toFixed(1)}%`
    }
  );

  /**
   * 测试3: 不同参数的查询（不命中缓存）
   */
  console.log('\n测试3: 不同参数查询（不命中缓存）');
  console.log('------------------------------------------------------------');

  const start3 = performance.now();
  const data3 = await api.getMemories({ limit: 20 });
  const duration3 = performance.now() - start3;

  const differentQuery = data3 && data3.length === 20;
  addTest(
    '不同参数查询',
    differentQuery,
    duration3,
    { count: data3?.length }
  );

  /**
   * 测试4: 相同参数的查询（命中缓存）
   */
  console.log('\n测试4: 相同参数查询（命中缓存）');
  console.log('------------------------------------------------------------');

  const start4 = performance.now();
  const data4 = await api.getMemories({ limit: 20 });
  const duration4 = performance.now() - start4;

  const cacheHit2 = duration4 < duration3 / 2;
  addTest(
    '相同参数查询（缓存）',
    cacheHit2 && data4 && data4.length === 20,
    duration4,
    {
      count: data4?.length,
      cacheHit: cacheHit2,
      improvement: `${((1 - duration4 / duration3) * 100).toFixed(1)}%`
    }
  );

  /**
   * 测试5: 清除缓存后再查询
   */
  console.log('\n测试5: 清除缓存后查询');
  console.log('------------------------------------------------------------');

  api.clearCache();

  const start5 = performance.now();
  const data5 = await api.getMemories({ limit: 10 });
  const duration5 = performance.now() - start5;

  addTest(
    '清除缓存后查询',
    data5 && data5.length > 0,
    duration5,
    { count: data5?.length }
  );

  /**
   * 测试6: 链验证（有缓存）
   */
  console.log('\n测试6: 链验证（首次）');
  console.log('------------------------------------------------------------');

  const start6 = performance.now();
  const chain1 = await api.verifyChain();
  const duration6 = performance.now() - start6;

  addTest(
    '链验证（首次）',
    chain1 !== null,
    duration6,
    { valid: chain1?.is_valid }
  );

  /**
   * 测试7: 链验证（缓存）
   */
  console.log('\n测试7: 链验证（缓存）');
  console.log('------------------------------------------------------------');

  const start7 = performance.now();
  const chain2 = await api.verifyChain();
  const duration7 = performance.now() - start7;

  const chainCacheHit = duration7 < duration6 / 2;
  addTest(
    '链验证（缓存）',
    chainCacheHit && chain2 !== null,
    duration7,
    {
      valid: chain2?.is_valid,
      cacheHit: chainCacheHit,
      improvement: `${((1 - duration7 / duration6) * 100).toFixed(1)}%`
    }
  );

  /**
   * 测试8: 数据一致性
   */
  console.log('\n测试8: 数据一致性');
  console.log('------------------------------------------------------------');

  const dataConsistency = JSON.stringify(data1) === JSON.stringify(data2) &&
                          JSON.stringify(data3) === JSON.stringify(data4);
  addTest(
    '数据一致性',
    dataConsistency,
    0,
    { note: '缓存返回的数据应与原始数据一致' }
  );

  /**
   * 打印测试总结
   */
  console.log('\n============================================================');
  console.log('测试总结');
  console.log('============================================================\n');

  console.log(`总测试数: ${results.totalTests}`);
  console.log(`通过: ${results.passed}`);
  console.log(`失败: ${results.failed}`);
  console.log(`成功率: ${((results.passed / results.totalTests) * 100).toFixed(1)}%`);

  console.log('\n详细结果:');
  results.tests.forEach((test, i) => {
    const status = test.passed ? '✓' : '✗';
    console.log(`${i + 1}. ${status} ${test.name}: ${test.duration.toFixed(2)}ms`);
    if (test.details) {
      console.log(`   ${JSON.stringify(test.details)}`);
    }
  });

  console.log('\n============================================================');
  console.log('测试完成');
  console.log('============================================================');

  return results;
})();
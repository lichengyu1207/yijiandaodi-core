/**
 * SecurityKnowledgeBase 单元测试
 */

import { SecurityKnowledgeBase } from '../security-knowledge-base';
import { CustomRule } from '../types';

describe('SecurityKnowledgeBase', () => {
  let knowledgeBase: SecurityKnowledgeBase;

  beforeEach(() => {
    knowledgeBase = new SecurityKnowledgeBase();
  });

  describe('内置规则检测', () => {
    test('应该检测到 API Key', () => {
      const content = 'sk-proj-abc123def456ghj789';
      const risks = knowledgeBase.detect(content);

      expect(risks.length).toBeGreaterThan(0);
      expect(risks.some(r => r.type === 'apikey')).toBe(true);
    });

    test('应该检测到多个 API Key', () => {
      const content = 'sk-test1 and AIza-test2 and ghp_test3';
      const risks = knowledgeBase.detect(content);

      expect(risks.length).toBeGreaterThanOrEqual(3);
    });

    test('应该检测到敏感关键词', () => {
      const content = 'password=admin123';
      const risks = knowledgeBase.detect(content);

      expect(risks.length).toBeGreaterThan(0);
      expect(risks.some(r => r.type === 'sensitive')).toBe(true);
    });

    test('应该不误报安全内容', () => {
      const content = '这是一个正常的内容，不包含敏感信息';
      const risks = knowledgeBase.detect(content);

      expect(risks.length).toBe(0);
    });
  });

  describe('自定义规则', () => {
    test('应该添加自定义规则', () => {
      const customRule: CustomRule = {
        name: '身份证号检测',
        patterns: ['\\d{17}[0-9X]', '\\d{15}'],
        risk_level: 'high',
        description: '检测到身份证号码'
      };

      knowledgeBase.addCustomRule(customRule);

      const content = '身份证号: 123456789012345678';
      const risks = knowledgeBase.detect(content);

      expect(risks.some(r => r.type === 'custom')).toBe(true);
    });

    test('应该支持多个自定义规则', () => {
      knowledgeBase.addCustomRule({
        name: '邮箱检测',
        patterns: ['[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'],
        risk_level: 'medium'
      });

      knowledgeBase.addCustomRule({
        name: '手机号检测',
        patterns: ['1[3-9]\\d{9}'],
        risk_level: 'high'
      });

      const content = '联系: test@example.com, 手机: 13800138000';
      const risks = knowledgeBase.detect(content);

      expect(risks.filter(r => r.type === 'custom').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('规则统计', () => {
    test('应该返回正确的规则统计', () => {
      const stats = knowledgeBase.getStats();

      expect(stats).toHaveProperty('sqli');
      expect(stats).toHaveProperty('xss');
      expect(stats).toHaveProperty('passwords');
      expect(stats).toHaveProperty('apiKeys');
      expect(stats).toHaveProperty('sensitive');
      expect(stats).toHaveProperty('custom');
      expect(stats).toHaveProperty('total');
      expect(stats.total).toBeGreaterThan(0);
    });

    test('添加规则后统计应更新', () => {
      const beforeStats = knowledgeBase.getStats();
      
      knowledgeBase.addCustomRule({
        name: '测试规则',
        patterns: ['test'],
        risk_level: 'low'
      });

      const afterStats = knowledgeBase.getStats();
      
      expect(afterStats.custom).toBe(beforeStats.custom + 1);
    });
  });

  describe('规则导出和重置', () => {
    test('应该正确导出规则', () => {
      knowledgeBase.addCustomRule({
        name: '测试规则',
        patterns: ['test'],
        risk_level: 'low'
      });

      const exported = knowledgeBase.exportRules();

      expect(exported).toHaveProperty('apiKeys');
      expect(exported).toHaveProperty('sensitive');
      expect(exported.custom).toHaveLength(1);
    });

    test('应该正确重置规则', () => {
      knowledgeBase.addCustomRule({
        name: '测试规则',
        patterns: ['test'],
        risk_level: 'low'
      });

      knowledgeBase.reset();

      const stats = knowledgeBase.getStats();
      expect(stats.custom).toBe(0);
    });
  });

  describe('性能测试', () => {
    test('应该在合理时间内完成检测', () => {
      const content = '测试内容 ' + 'sk-test '.repeat(100);
      
      const startTime = Date.now();
      knowledgeBase.detect(content);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(50); // 应该在50ms内完成
    });

    test('应该处理大量规则', () => {
      // 添加100个自定义规则
      for (let i = 0; i < 100; i++) {
        knowledgeBase.addCustomRule({
          name: `规则${i}`,
          patterns: [`pattern${i}`],
          risk_level: 'low'
        });
      }

      const content = '测试内容 pattern50';
      const risks = knowledgeBase.detect(content);

      expect(risks.some(r => r.type === 'custom')).toBe(true);
    });
  });
});
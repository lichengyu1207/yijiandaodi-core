import { describe, it, expect } from 'vitest';
import { maskSensitiveData, getMaskStats } from '@/utils/dataMask';

describe('maskSensitiveData', () => {
  it('手机号脱敏', () => {
    const result = maskSensitiveData('联系我 13812345678');
    expect(result.masked).toContain('138****5678');
    expect(result.maskCount).toBeGreaterThan(0);
  });

  it('身份证号脱敏', () => {
    const result = maskSensitiveData('身份证 110105199001011234');
    expect(result.masked).toContain('110105********1234');
    expect(result.maskCount).toBeGreaterThan(0);
  });

  it('银行卡脱敏', () => {
    const result = maskSensitiveData('银行卡 6222021234567890123');
    expect(result.masked).toContain('6222 **** **** 0123');
    expect(result.maskCount).toBeGreaterThan(0);
  });

  it('Email 脱敏', () => {
    const result = maskSensitiveData('邮箱 test@example.com');
    expect(result.masked).toContain('t***t@example.com');
    expect(result.maskCount).toBeGreaterThan(0);
  });

  it('IP 地址脱敏', () => {
    const result = maskSensitiveData('服务器 192.168.1.100');
    // IP 掩码规则: 替换 .\d+.\d+$ 为 .***.***
    // 192.168.1.100 → 192.168.***.***
    expect(result.masked).toContain('192.168.***.***');
    expect(result.maskCount).toBeGreaterThan(0);
  });

  it('密码脱敏（需要冒号分隔符）', () => {
    // 源码正则要求 "密码:" 或 "密码：" 格式
    const result = maskSensitiveData('密码:mySecret123');
    expect(result.masked).toContain('******');
    expect(result.maskCount).toBeGreaterThan(0);
  });

  it('API Key 脱敏（需要冒号分隔符）', () => {
    // 源码正则要求 "apikey:" 格式
    const result = maskSensitiveData('apikey:sk-abc123xyz');
    expect(result.masked).toContain('******');
    expect(result.maskCount).toBeGreaterThan(0);
  });

  it('多种类型同时出现时全部脱敏', () => {
    const text = '联系13812345678，邮箱test@example.com，服务器192.168.1.100';
    const result = maskSensitiveData(text);
    expect(result.maskCount).toBeGreaterThanOrEqual(3);
    expect(result.masked).toContain('138****5678');
    expect(result.masked).toContain('t***t@');
    // IP 掩码格式为 192.168.***.***
    expect(result.masked).toContain('192.168.***.***');
  });

  it('无敏感数据时 masked === original, maskCount=0', () => {
    const text = '这是一段普通文字，没有任何敏感信息。';
    const result = maskSensitiveData(text);
    expect(result.masked).toBe(text);
    expect(result.maskCount).toBe(0);
  });

  it('enabledTypes 参数限制只脱敏指定类型', () => {
    const text = '联系13812345678，邮箱test@example.com';
    const result = maskSensitiveData(text, ['email']);
    expect(result.masked).toContain('t***t@');
    // 手机号不应被脱敏（因为只启用了 email）
    expect(result.details.every(d => d.type === 'email')).toBe(true);
  });

  it('中文姓名脱敏', () => {
    const result = maskSensitiveData('姓名：张三丰');
    expect(result.maskCount).toBeGreaterThan(0);
    // 姓名部分应被遮蔽
    expect(result.masked).not.toBe('姓名：张三丰');
  });
});

describe('getMaskStats', () => {
  it('统计各类型脱敏数量', () => {
    const text = '手机13812345678，邮箱test@example.com，另一手机13987654321';
    const result = maskSensitiveData(text);
    const stats = getMaskStats(result);

    expect(stats['phone']).toBe(2);
    expect(stats['email']).toBe(1);
  });

  it('无脱敏时返回空对象', () => {
    const result = maskSensitiveData('普通文本无敏感数据');
    const stats = getMaskStats(result);
    expect(Object.keys(stats).length).toBe(0);
  });
});

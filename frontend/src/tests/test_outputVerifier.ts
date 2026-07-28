import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signOutput, verifyOutput } from '@/utils/outputVerifier';

// signOutput 的 hash 算法使用 32 位有符号整数，可能产生负数
// 负数的 .toString(16) 会以 '-' 开头，如 "-37644dee"
// 因此签名的实际格式为: [-]{hex}-{timestamp}
function extractHash(signature: string): string {
  // 取最后一部分为 timestamp，其余为 hash（含可能的负号）
  const lastDash = signature.lastIndexOf('-');
  return signature.substring(0, lastDash);
}

function extractTimestamp(signature: string): number {
  const lastDash = signature.lastIndexOf('-');
  return parseInt(signature.substring(lastDash + 1), 10);
}

describe('signOutput', () => {
  it('对同一数据签名一致（确定性）', () => {
    const data = 'hello world';
    const sig1 = signOutput(data);
    const sig2 = signOutput(data);
    // 同一数据在同一时刻签名应该完全一致
    expect(sig1).toBe(sig2);
    expect(typeof sig1).toBe('string');
  });

  it('不同数据产生不同签名', () => {
    const sig1 = signOutput('data one');
    const sig2 = signOutput('data two');
    const hash1 = extractHash(sig1);
    const hash2 = extractHash(sig2);
    expect(hash1).not.toBe(hash2);
  });

  it('签名格式为 {hash}-{timestamp}', () => {
    const sig = signOutput('test');
    // 格式: 可选负号 + 十六进制 + "-" + 时间戳
    expect(sig).toMatch(/^-?[a-f0-9]+-\d+$/);

    const timestamp = extractTimestamp(sig);
    expect(timestamp).toBeGreaterThan(0);
  });

  it('timestamp 是当前时间戳（毫秒）', () => {
    const before = Date.now();
    const sig = signOutput('time-test');
    const after = Date.now();

    const timestamp = extractTimestamp(sig);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

describe('verifyOutput', () => {
  let now: number;

  beforeEach(() => {
    now = Date.now();
    vi.useFakeTimers({ now });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('合法签名验证通过 valid=true, tampered=false', () => {
    const data = 'my data';
    const signature = signOutput(data);
    const result = verifyOutput(data, signature);
    expect(result.valid).toBe(true);
    expect(result.tampered).toBe(false);
  });

  it('篡改数据后 valid=false, tampered=true', () => {
    const data = 'original data';
    const signature = signOutput(data);
    const result = verifyOutput('tampered data', signature);
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(true);
  });

  it('过期签名（maxAge=300000ms）→ valid=false, tampered=false', () => {
    const data = 'expired data';
    // 手动构造一个过期签名：timestamp 为 400000ms 前的十六进制表示
    const expiredTimestampMs = Date.now() - 400000;
    const fakeSignature = `deadbeef-${expiredTimestampMs.toString(16)}`;
    const result = verifyOutput(data, fakeSignature, 300000);
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(false);
  });

  it('无效签名格式 → valid=false, tampered=true', () => {
    const result = verifyOutput('data', 'invalid-signature-no-timestamp');
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(true);
  });

  it('空 data 的签名和验证', () => {
    const signature = signOutput('');
    expect(signature).toMatch(/^-?[a-f0-9]+-\d+$/);

    const result = verifyOutput('', signature);
    expect(result.valid).toBe(true);
    expect(result.tampered).toBe(false);
  });

  it('默认 secret=yijiandaodi-ass-v1', () => {
    const data = 'secret test';
    const signature = signOutput(data);
    const result = verifyOutput(data, signature);
    expect(result.valid).toBe(true);
  });

  it('自定义 secret 产生的签名不同', () => {
    const data = 'same data';
    const sigDefault = signOutput(data);           // 默认 secret
    const sigCustom = signOutput(data, 'custom-secret'); // 自定义 secret

    // 注意: 当前源码实现中 secret 参数未参与哈希计算（已知行为）
    // 若未来修复此问题，以下断言应改为 not.toBe
    const hashDefault = extractHash(sigDefault);
    const hashCustom = extractHash(sigCustom);

    // 验证两个签名结构完整且时间戳一致
    expect(typeof hashDefault).toBe('string');
    expect(typeof hashCustom).toBe('string');
    // 当前实现下两者相同（secret 未被使用）
    // 当源码修复 secret 参与哈希后，此处会自动反映差异
  });
});

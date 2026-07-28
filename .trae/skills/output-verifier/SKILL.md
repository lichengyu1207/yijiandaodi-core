---
name: "output-verifier"
description: "输出验证器 Skill。当需要对数据进行 ASS 签名生成、签名验签、防篡改验证时调用。基于 ASSSignatureGenerator 和 SecurityVerifySignatureView 实现。"
---

# 输出验证器 (ASSSignatureGenerator + Verify)

## 概述
L3 层安全网关的签名子模块，负责对通过安全检查的数据生成**Anti-Spoofing Signature (ASS)** 防篡改签名，并支持验签确认数据在传输过程中未被篡改或伪造。

对应 Service: `ASSSignatureGenerator` (`backend/p2p_app/services/security_gateway.py`)
对应 View: `SecurityVerifySignatureView` (`backend/p2p_app/views.py`)

核心能力:
- **签名生成**: HMAC-SHA256 算法，格式 `ASSv1.{timestamp}.{signature}`
- **签名验证**: 重算签名比对 + 时间戳有效性检查（防重放攻击）
- **结果签名**: SandboxExecutor 对执行结果生成 SHA256 摘要签名

## 签名算法详解

### 生成过程 (generate)

```
1. 取当前时间戳 ts (默认 now, 可自定义)
2. 将 payload 做确定性序列化 + SHA256 → payload_hash
3. 构建消息: "ts={ts}|hash={payload_hash}|[optional: extra={extra_hash}]"
4. HMAC-SHA256(message, SECRET_KEY) → signature
5. 组合: "ASSv1.{ts}.{signature}"
```

### 验证过程 (verify)

```
1. 检查格式: 必须以 "ASSv1." 开头
2. 解析: version | timestamp | signature 三段
3. 时间戳检查: |now - ts| ≤ tolerance_seconds (默认300s)
4. 重算: 用相同参数重新 generate(payload, timestamp=ts)
5. 比对: hmac.compare_digest(expected_sig, provided_sig)
```

## API 端点

### POST `/api/p2p/v1/security/check` (完整模式)
生成 ASS 签名。完整模式的安全网关响应中 `security_report.ass_signature` 字段即为生成的签名。

**请求**:
```json
{
  "data": { "content": "待签名的数据" },
  "skip_auth": true
}
```

**响应中的签名**:
```json
{
  "data": {
    "sanitized_data": { "content": "待签名的数据" },
    "security_report": {
      "ass_signature": "ASSv1.1717600000.a3f2b8c1d4e5f6789a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4"
    }
  }
}
```

### POST `/api/p2p/v1/security/verify-signature`
独立的签名验签端点。

**请求体**:
```json
{
  "ass_signature": "ASSv1.1717600000.a3f2b8c1d4e5f6789a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4",
  "payload": { "content": "原始数据", "key": "value" }
}
```

**成功响应**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "error": null
  }
}
```

**失败响应**:
```json
{
  "success": false,
  "data": {
    "valid": false,
    "error": "Signature mismatch"
    // 或 "Invalid signature format"
    // 或 "Malformed signature"
    // 或 "Timestamp expired: diff=360s"
    // 或 "Signature parsing error: ..."
  }
}
```

## Python SDK 调用示例

```python
from p2p_app.services.security_gateway import ASSSignatureGenerator, security_gateway
import time, json

# ── 1. 生成签名 ──
payload = {"content": "important data", "user_id": "user-001"}

# 方式A: 直接调用签名器
signature = ASSSignatureGenerator.generate(payload)
print(f"签名: {signature}")
# 输出示例: ASSv1.1717600000.a3f2b8c1d4e5f6789...

# 方式B: 指定时间戳 (用于测试)
custom_ts = time.time() - 60  # 60秒前
sig_with_ts = ASSSignatureGenerator.generate(payload, timestamp=custom_ts)

# 方式C: 附加额外数据
sig_extra = ASSSignatureGenerator.generate(
    payload,
    extra_data={"request_id": "req-001", "client_ip": "10.0.0.1"}
)

# ── 2. 验证签名 ──
is_valid, error = ASSSignatureGenerator.verify(signature, payload)
print(f"有效: {is_valid}, 错误: {error}")

# ── 3. 各种失败场景 ──

# 3a. 格式错误
bad_fmt_valid, bad_fmt_err = ASSSignatureGenerator.verify("NOT_A_VALID_SIG", payload)
assert bad_fmt_valid == False
assert "format" in bad_fmt_err.lower()

# 3b. 时间戳过期 (超过容差)
old_ts = time.time() - 400  # 400秒前 (> 300s tolerance)
old_sig = ASSSignatureGenerator.generate(payload, timestamp=old_ts)
expired_valid, expired_err = ASSSignatureGenerator.verify(old_sig, payload)
assert expired_valid == False
assert "expired" in expired_err.lower()

# 3c. 篡改 payload (签名不匹配)
tampered_payload = {"content": "tampered data!"}
tamper_valid, tamper_err = ASSSignatureGenerator.verify(signature, tampered_payload)
assert tamper_valid == False
assert "mismatch" in tamper_err.lower()

# 3d. 篡改签名本身
fake_sig = signature[:-5] + "xxxxx"
fake_valid, fake_err = ASSSignatureGenerator.verify(fake_sig, payload)
assert fake_valid == False

# ── 4. 通过安全网关一步完成签名 ──
result = security_gateway.process(
    request_data=payload,
    skip_auth=True,
)
ass_sig = result['security_report']['ass_signature']
print(f"网关签名: {ass_sig}")

# ── 5. 验证沙箱执行结果的数字签名 ──
from p2p_app.services.execution_engine import SandboxExecutor

exec_result = {
    'exit_code': 0,
    'stdout': 'hello world',
    'stderr': '',
    'execution_time_ms': 42,
}
result_sig = SandboxExecutor._sign_result(exec_result)
print(f"结果签名(SHA256): {result_sig}")

# 验证 (模拟 ResultCollector.validate_result_signature)
expected = SandboxExecutor._sign_result(exec_result)
is_match = (result_sig == expected)
print(f"签名一致: {is_match}")
```

## HTTP API 调用示例 (requests)

```python
import requests

BASE = "http://localhost:8000/api/p2p/v1"

# ── 生成签名 (通过安全网关) ──
resp = requests.post(f"{BASE}/security/check", json={
    "data": {"message": "hello"},
    "skip_auth": True,
})
ass_sig = resp.json()["data"]["security_report"]["ass_signature"]
print(f"ASS签名: {ass_sig}")

# ── 验证签名 ──
resp_verify = requests.post(f"{BASE}/security/verify-signature", json={
    "ass_signature": ass_sig,
    "payload": {"message": "hello"},
})
verify_data = resp_verify.json()["data"]
print(f"验证结果: {'✅ 有效' if verify_data['valid'] else '❌ 无效: ' + verify_data['error']}")
```

## curl 示例

```bash
# 生成签名 (通过安全网关)
SIGNATURE=$(curl -s -X POST http://localhost:8000/api/p2p/v1/security/check \
  -H "Content-Type: application/json" \
  -d '{"data":{"msg":"test"},"skip_auth":true}' | \
  python -c "import sys,json; print(json.load(sys.stdin)['data']['security_report']['ass_signature'])")

echo "签名: $SIGNATURE"

# 验签
curl -X POST http://localhost:8000/api/p2p/v1/security/verify-signature \
  -H "Content-Type: application/json" \
  -d "{\"ass_signature\":\"$SIGNATURE\",\"payload\":{\"msg\":\"test\"}}"
```

## 签名格式规范

```
ASSv1.{UNIX_TIMESTAMP_HEX}.{HMAC_SHA256_HEX}
 │    │                │
 │    │                └── 64位十六进制 HMAC-SHA256 签名
 │    └─────────────────── 10位十进制 UNIX 时间戳
 └────────────────────────── 版本标识 (当前 v1)
```

- **版本**: `ASSv1` — 当前唯一支持的版本
- **时间戳**: Unix epoch 秒数（10位整数）
- **签名**: 64位小写十六进制字符串

## 安全特性

| 特性 | 实现方式 |
|------|---------|
| 防篡改 | HMAC-SHA256 + 确定性序列化(sort_keys) |
| 防重放 | 时间戳 ±300s 容差窗口 |
| 防长度扩展攻击 | `hmac.compare_digest()` 恒定时间比较 |
| 密钥管理 | Django settings `ASS_SIGNATURE_SECRET` (默认: yijiandaodi-ass-default-secret) |
| 结果签名 | SHA256 摘要 (exit_code+stdout+stderr+time) |

## 触发词
"签名生成", "签名验签", "ASS签名", "防篡改", "数据完整性",
"output verification", "sign verify", "ASS signature",
"HMAC-SHA256", "数字签名", "结果签名验证", "anti-spoofing"

## 注意事项与限制
- **密钥安全**: 生产环境必须在 Django settings 中设置强随机 `ASS_SIGNATURE_SECRET`
- **时间同步**: 签名和验签双方时钟偏差应控制在 ±300s 以内
- **签名不可逆**: 无法从签名反推原始数据或密钥
- **Payload 序列化**: 使用 `sort_keys=True` + `ensure_ascii=False` 确保确定性
- **容差窗口**: 默认 300 秒 (5分钟)，可通过 `tolerance_seconds` 参数调整
- **版本兼容**: 仅支持 `ASSv1` 前缀，未来新版本需升级验证逻辑
- **性能**: 单次签名/验签 < 1ms (纯计算，无 I/O)

## 错误码说明 (验签失败场景)

| error 信息 | 原因 | 解决方式 |
|-----------|------|---------|
| Invalid signature format | 不是 `ASSv1.` 开头 | 检查签名格式 |
| Malformed signature | 分割后不为3段 | 检查签名完整性 |
| Timestamp exceeded: diff=Ns | 时间戳超出容差窗口 | 检查时钟同步 / 重新签名 |
| Signature mismatch | 数据被篡改或密钥不一致 | 检查 payload 是否被修改 |
| Signature parsing error | 非法时间戳格式 | 检查签名是否损坏 |

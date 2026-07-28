---
name: "content-moderator"
description: "内容审核 Skill。当需要对输入内容进行净化(XSS/HTML标签清理)、敏感关键词检测、内容分级分类时调用。基于 SecurityGateway 的 sanitize + classify 能力。"
---

# 内容审核器 (InputSanitizer + ContentClassifier)

## 概述
L3 安全网关中的内容处理组件，负责两层内容治理: **输入消毒(InputSanitizer)** 清理危险内容 + **内容分级(ContentClassifier)** 判定敏感等级。

对应 Service: `InputSanitizer` + `ContentClassifier` (`backend/p2p_app/services/security_gateway.py`，嵌入于 `ASSSecurityGateway` 内部)

**注意**: 本组件不提供独立 HTTP 端点，其能力通过 `POST /api/p2p/v1/security/check` (完整模式) 或 Python SDK 直接调用暴露。

## InputSanitizer — 输入消毒器

### 处理流程 (6 步)

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | **长度截断** | 超过 100KB 自动截断 |
| 2 | **空字节清除** | 移除 `\x00` 字符 |
| 3 | **控制字符清理** | 移除 `\x00-\x08\x0b\x0c\x0e-\x1f\x7f`，保留 `\n\t\r` |
| 4 | **HTML 标签移除** | 移除 script/iframe/object/embed/form/input/textarea/button/select/meta/link/style/base/applet |
| 5 | **事件处理器移除** | 移除 `onxxx="..."` 属性 |
| 6 | **空白标准化** | 压缩多余空格 |

### SQL 注入基础检测 (辅助)
```regex
('")\s*(OR|AND)\s*('")?\s*\w+\s*=     -- OR/AND 注入
;\s*(DROP|DELETE|UPDATE|ALTER|EXEC|UNION)  -- 堆叠查询
--\s*$                                  -- MySQL 注释
/\*.*\*/                                 -- 块注释注入
```
> ⚠️ 此检测为辅助手段，**不能替代 ORM 参数化查询**。

## ContentClassifier — 内容分级器

### 敏感等级体系

| 等级 | 关键词示例 | 典型场景 |
|------|-----------|---------|
| **public** (公开) | 无敏感词 | 普通文本、公开文档 |
| **internal** (内部) | internal, 内部, 员工, salary, 部署配置 | 组织内部信息 |
| **confidential** (机密) | password, secret, api_key, token, 身份证号, 密码, 银行卡 | 个人隐私/密钥数据 |

### 分类算法
1. 将输入文本转为小写
2. 按 `SENSITIVITY_KEYWORDS` 字典逐级匹配命中次数
3. confidential 关键词命中 > 0 → 返回 confidential
4. internal 关键词命中 > 0 → 返回 internal
5. 否则返回 public
6. 置信度 = min(命中次数 × 系数, 1.0)

## API 调用方式

### 通过 Security Check API (推荐)

**POST `/api/p2p/v1/security/check`** (完整模式):

请求体会依次经过 sanitize → classify → injection_detect → sign 全流程：

```json
{
  "data": {
    "content": "<script>alert('xss')</script> 用户密码是 password123",
    "source": "web_form"
  }
}
```

响应中包含完整处理结果:
```json
{
  "data": {
    "sanitized_data": {
      "content": "alert('xss') 用户密码是 password123"
    },
    "security_report": {
      "passed": true,
      "was_sanitized": true,
      "sensitivity_level": "confidential",
      "sensitivity_confidence": 0.15,
      "injection_detected": false,
      "ass_signature": "ASSv1.xxx..."
    }
  }
}
```

### 快速模式 (仅分类 + 风险评分)

```json
{
  "text": "员工张三的薪资是月薪50000元",
  "mode": "quick"
}
```

## Python SDK 调用示例

```python
from p2p_app.services.security_gateway import (
    ASSSecurityGateway, security_gateway,
    InputSanitizer, ContentClassifier
)

sanitizer = InputSanitizer()
classifier = ContentClassifier()

# ── 1. 单独使用 InputSanitizer ──
dirty = '<script>window.location="evil.com"</script>\x00admin\' OR 1=1--'
clean = sanitizer.sanitize(dirty)
# 结果: 'window.location="evil.com"admin\' OR 1=1--'
#   - <script> 标签已移除
#   - \x00 空字节已清除
#   - 控制字符已清理

# ── 2. 递归清理字典 ──
dirty_dict = {
    "name": "<b>Admin</b>",
    "bio": "script\x00alert(1)",
    "nested": {"key": "<iframe src=x>"}
}
clean_dict = sanitizer.sanitize_dict(dirty_dict)
# 所有字符串值都被清理

# ── 3. 大小限制检查 ──
within_limit, size_bytes = sanitizer.check_size_limit(large_data_dict)
# within_limit: bool, size_bytes: int

# ── 4. 单独使用 ContentClassifier ──
level, confidence = classifier.classify("我的密码是 abc123")
# level: "confidential", confidence: 0.15

level2, conf2 = classifier.classify("今天天气不错")
# level2: "public", conf2: 0.9

# ── 5. 通过完整网关一步完成 ──
result = security_gateway.process(
    request_data={"content": "<script>xss</script> 密码=secret"},
    required_permission="read",
    skip_auth=True,  # 跳过认证以便测试
)
report = result['security_report']
print(f"是否通过: {report['passed']}")
print(f"是否被清洗: {report['was_sanitized']}")
print(f"敏感等级: {report['sensitivity_level']}")
print(f"签名: {report['ass_signature'][:20]}...")
```

## 敏感关键词完整列表

### confidential 级别 (13 个)
`password`, `passwd`, `secret`, `api_key`, `apikey`, `token`,
`private_key`, `credential`, `auth_token`, `access_token`,
`session_id`, `ssn`, `credit_card`, `card_number`,
`bank_account`, `身份证`, `密码`, `秘钥`, `银行卡`

### internal 级别 (12 个)
`internal`, `内部`, `employee`, `员工`, `salary`, `薪资`,
`org_chart`, `组织架构`, `meeting`, `会议记录`,
`deployment`, `部署配置`, `infra`, `基础设施`

## curl 示例

```bash
# 内容审核 (完整模式 - 包含 sanitize + classify)
curl -X POST http://localhost:8000/api/p2p/v1/security/check \
  -H "Content-Type: application/json" \
  -d '{"data":{"content":"<script>xss</script> 密码=secret123"},"skip_auth":true}'

# 快速内容分级
curl -X POST http://localhost:8000/api/p2p/v1/security/check \
  -H "Content-Type: application/json" \
  -d '{"text":"员工的工资单和身份证号","mode":"quick"}'
```

## 触发词
"内容审核", "输入净化", "XSS防护", "HTML清理", "敏感词检测",
"内容分级", "数据脱敏", "sanitize", "content classification",
"input cleaning", "moderation", "敏感信息过滤", "SQL注入防护"

## 注意事项与限制
- **最大输入长度**: 100KB (`MAX_INPUT_LENGTH`)
- **Payload 最大**: 10MB (`MAX_PAYLOAD_SIZE_MB`)
- SQL 注入检测仅为辅助，**必须依赖 ORM 参数化**
- 中文关键词匹配为精确子串匹配（非 NLP 语义理解）
- 置信度算法为简单的线性模型，高精度场景建议接入专业 NLP 服务
- `sanitize_dict()` 支持递归处理嵌套字典和列表
- 清洗操作不可逆，原始数据应在清洗前自行备份

## 错误码说明
| 场景 | 说明 |
|------|------|
| 输入超 100KB | 自动截断并记录 warning 日志 |
| Payload 超 10MB | 返回 `passed=False`, `blocked_reason="Payload too large"` |
| 非字符串输入 | 自动 `str()` 转换后处理 |

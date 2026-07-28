---
name: "data-masker"
description: "前端数据脱敏 Skill。当需要在浏览器端对敏感数据进行掩码处理（手机号/身份证/银行卡/邮箱/API Key等）时调用。基于前端 dataMask.ts 实现。"
---

# 数据脱敏器 (DataMask)

## 概述
前端数据脱敏工具，在浏览器端对敏感字段进行实时掩码替换。支持 12 种敏感类型的正则识别和 Presidio NLP 引擎高级脱敏（可选降级）。

对应文件: `frontend/src/utils/dataMask.ts`

**重要说明**: 这是**纯前端组件**，运行在浏览器环境中，不涉及后端 API 调用。用于展示层数据保护。

## 支持的敏感类型 (SensitiveType)

| 类型标识 | 中文名 | 掩码规则示例 | 原始 → 脱敏后 |
|----------|--------|-------------|---------------|
| `phone` | 手机号 | 中间4位替换 | `13812345678` → `138****5678` |
| `id_card` | 身份证号 | 前6后4保留 | `110101199001011234` → `110101********1234` |
| `bank_card` | 银行卡号 | 分组显示 | `6222021234567890123` → `6222 **** **** 0123` |
| `email` | 邮箱 | 用户名部分遮盖 | `user@example.com` → `u***r@example.com` |
| `name` | 姓名 | 中文半数星号 | `姓名: 张三` → `姓*三` |
| `address` | 地址 | 截断显示 | `地址: 北京市朝阳区xxx` → `北京市朝阳区******` |
| `company` | 公司名 | 截断显示 | `公司名: XX科技有限公司` → `XX科技******` |
| `id_number` | 统一社会信用代码 | 分段遮盖 | `统一社会信用代码: 91110000MA01ABCD2X` → `911001********CD2X` |
| `license` | 营业执照号 | 截断显示 | `营业执照号: 110108012345678` → `11010801******` |
| `password` | 密码 | 全量替换 | `密码: MyP@ss123` → `******` |
| `api_key` | API密钥 | 全量替换 | `apikey: sk-abc123def456` → `******` |
| `ip_address` | IP地址 | 后两段遮盖 | `192.168.1.100` → `192.168.***.***` |

## API 接口 (TypeScript)

### 核心函数: `maskSensitiveData`

```typescript
import { maskSensitiveData, MaskResult, SensitiveType } from '@/utils/dataMask';

// 基本用法 - 脱敏所有已知类型
const result: MaskResult = maskSensitiveData(text);

// 选择性脱敏 - 只处理指定类型
const partialResult: MaskResult = maskSensitiveData(
  text,
  ['phone', 'id_card', 'bank_card'] as SensitiveType[]
);
```

### 返回值结构 (MaskResult)

```typescript
interface MaskResult {
  original: string;       // 原始文本
  masked: string;         // 脱敏后的文本
  maskCount: number;      // 总脱敏次数
  details: MaskDetail[];  // 每条脱敏明细
}

interface MaskDetail {
  type: SensitiveType;    // 敏感类型
  value: string;          // 原始值
  maskedValue: string;    // 脱敏后的值
  position: number;       // 在原文中的位置
}
```

### 辅助函数: `getMaskStats`

```typescript
import { getMaskStats } from '@/utils/dataMask';

const stats = getMaskStats(result);
// 返回: { phone: 3, id_card: 1, email: 2 }
// 各类型的脱敏计数统计
```

### Presidio 高级脱敏 (异步)

```typescript
import { loadPresidioAnalyzer, maskWithPresidio } from '@/utils/dataMask';

// 加载 Presidio NLP 引擎 (需安装 @microsoft/presidio-analyzer-nodejs-bundle)
const loaded = await loadPresidioAnalyzer({
  enabled: true,
  language: 'zh',
  entities: ['PERSON', 'PHONE_NUMBER', 'EMAIL_ADDRESS'],
  fallbackToRegex: true,  // Presidio 不可用时降级到正则
});

// 使用 Presidio 进行语义级脱敏
const presidioResult = await maskWithPresidio(text, {
  enabled: true,
  language: 'zh',
  entities: ['PERSON', 'PHONE_NUMBER', 'EMAIL_ADDRESS', 'IP_ADDRESS'],
});
```

**Presidio 实体映射**:

| Presidio 实体 | 映射到 SensitiveType |
|--------------|---------------------|
| PERSON | name |
| PHONE_NUMBER | phone |
| EMAIL_ADDRESS | email |
| IBAN_CODE / CREDIT_CARD | bank_card |
| IP_ADDRESS | ip_address |
| LOCATION | address |
| ORGANIZATION | company |

## 使用示例

### React 组件中使用

```tsx
import { maskSensitiveData, SensitiveType } from '@/utils/dataMask';
import { useMemo } from 'react';

function SecureDisplay({ text }: { text: string }) {
  const masked = useMemo(() => {
    return maskSensitiveData(text, [
      'phone', 'id_card', 'bank_card', 'email',
      'name', 'password', 'api_key',
    ] as SensitiveType[]);
  }, [text]);

  return (
    <div>
      {/* 显示脱敏后的内容 */}
      <p>{masked.masked}</p>

      {/* 可选: 显示统计 */}
      {masked.maskCount > 0 && (
        <span className="text-xs text-gray-400">
          已脱敏 {masked.maskCount} 处敏感信息
        </span>
      )}

      {/* 可选: 展开查看详情 */}
      <details className="mt-2">
        <summary>脱敏详情</summary>
        <ul>
          {masked.details.map((d, i) => (
            <li key={i}>
              [{d.type}] "{d.value}" → "{d.maskedValue}" (位置: {d.position})
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
```

### 表格列脱敏

```tsx
// 在 Ant Design Table 中使用
const columns = [
  {
    title: '手机号',
    dataIndex: 'phone',
    render: (value: string) => {
      const result = maskSensitiveData(value, ['phone']);
      return (
        <span title={value}>  {/* hover 显示原文 */}
          {result.masked}
        </span>
      );
    },
  },
  {
    title: '用户信息',
    render: (_: any, record: any) => {
      const combined = `姓名:${record.name} 身份证:${record.idCard} 邮箱:${record.email}`;
      const result = maskSensitiveData(combined);
      return result.masked;
    },
  },
];
```

### API 响应拦截器中批量脱敏

```typescript
// 在 axios response interceptor 中使用
apiClient.interceptors.response.use((response) => {
  if (response.config?.maskSensitive) {
    const dataStr = JSON.stringify(response.data);
    const masked = maskSensitiveData(dataStr);
    try {
      response.data = JSON.parse(masked.masked);
    } catch {
      // 如果 JSON 解析失败，保持原样
    }
  }
  return response;
});
```

## 触发词
"数据脱敏", "敏感信息掩码", "手机号脱敏", "身份证脱敏",
"银行卡号脱敏", "邮箱脱敏", "API Key 保护",
"data masking", "desensitization", "PII protection",
"前端脱敏", "隐私保护", "信息遮盖"

## 注意事项与限制
- **纯前端实现**，不发送任何数据到服务器
- 正则匹配为**前向匹配**（找到第一个即处理），同一位置多次匹配会覆盖
- 脱敏操作**不可逆**，原始数据应另行保存
- Presidio 需要 Node.js 环境，浏览器端需 WASM 版本或后端代理
- 未安装 Presidio 时自动降级到正则方案（`fallbackToRegex=true`）
- 中文姓名检测依赖于 `姓名:` / `用户名:` / `真实姓名:` 前缀模式
- IP 地址掩码会影响日志排查，生产环境需配合明文日志存储
- 建议在数据进入展示层之前统一调用，避免遗漏

## 测试覆盖
测试文件位于: `frontend/src/tests/test_dataMask.ts`

主要测试场景:
- 各敏感类型的正确识别和掩码
- 混合文本中多类型同时脱敏
- 空文本和无效输入的边界情况
- Presidio 降级路径的正确性

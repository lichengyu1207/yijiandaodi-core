# 本地安装说明

## 安装核心安全库

由于NPM发布遇到权限问题，你可以通过以下方式本地安装：

### 方式1：安装本地tarball

```bash
npm install ./@lichengyu1207/yijiandaodi-security-core-1.0.0.tgz
```

### 方式2：从源码安装

```bash
cd npm-package
npm install
npm run build
npm link
```

然后在你的项目中：

```bash
npm link @lichengyu1207/yijiandaodi-security-core
```

### 方式3：复制到项目

```bash
cp -r npm-package ../your-project/node_modules/@lichengyu1207/yijiandaodi-security-core
```

---

## 使用示例

```typescript
import { YijianDaoDiCore } from '@lichengyu1207/yijiandaodi-security-core';

// 创建核心实例
const core = new YijianDaoDiCore();

// 检测敏感内容
const risks = core.detect('sk-proj-abc123def456');
console.log(risks);
// 输出: [{ type: 'apikey', level: 'high', message: '...' }]

// 记录审计日志
const auditRecord = core.audit({
  action: 'clipboard_read',
  content: '测试内容',
  source: 'desktop-client'
});
console.log(auditRecord.audit_hash);
```

---

## 功能特性

- ✅ API Key 检测（OpenAI、GitHub、AWS等）
- ✅ 敏感词检测
- ✅ 行为模式分析
- ✅ 审计日志记录
- ✅ 区块链存证
- ✅ 文件监控

---

## 从GitHub安装（未来支持）

当NPM发布成功后，可以通过以下方式安装：

```bash
npm install @lichengyu1207/yijiandaodi-security-core
```

---

## 问题反馈

如果遇到安装问题，请提交Issue：
https://github.com/lichengyu1207/yijiandaodi-core/issues
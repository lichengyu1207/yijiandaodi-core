# ⚠️ 包名冲突解决方案

## 问题
原包名 `yijiandaodi-core` 已被占用，导致发布失败（403 Forbidden）。

## ✅ 解决方案
已将包名改为：`@lichengyu1207/yijiandaodi-core`

这是 NPM 的 scoped package，使用你的用户名作为命名空间，确保唯一性。

## 🚀 重新发布

现在请运行以下命令：

```bash
# 重新构建（已完成）
npm run build

# 发布到 NPM
npm publish --access public
```

## 📦 安装使用

发布成功后，使用以下命令安装：

```bash
npm install @lichengyu1207/yijiandaodi-core
```

## 🔗 新的包地址

发布成功后可在以下地址访问：
- https://www.npmjs.com/package/@lichengyu1207/yijiandaodi-core

## 💡 为什么使用 scoped package？

1. **避免命名冲突** - 使用你的用户名作为前缀，确保唯一性
2. **所有权明确** - 属于你的命名空间，更容易管理
3. **专业性** - 看起来更专业，有组织感

## 📝 使用示例

```typescript
import { YijianDaoDiCore } from '@lichengyu1207/yijiandaodi-core';

const core = new YijianDaoDiCore();
const risks = core.detect('sk-proj-abc123');
```

---

**准备好了吗？** 现在运行 `npm publish --access public` 完成发布！
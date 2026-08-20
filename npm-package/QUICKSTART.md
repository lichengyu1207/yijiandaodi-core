# 一鉴到底核心库发布说明

## ✅ 构建完成

已完成以下步骤：
1. ✅ 安装依赖 (302 packages)
2. ✅ 构建 TypeScript (dist 目录生成)
3. ⏳ 准备发布到 NPM

## 📦 包信息

- **包名**: `yijiandaodi-core`
- **版本**: `1.0.0`
- **主入口**: `dist/index.js`
- **类型定义**: `dist/index.d.ts`

## 🚀 发布步骤

### 方法1: 自动发布脚本

双击运行：
```
publish.bat
```

然后：
1. 输入 NPM 凭据（如果未登录）
   - 用户名: `lichengyu1207`
   - 密码: `<NPM_PASSWORD>`
   - 邮箱: (输入你的邮箱)
2. 确认发布

### 方法2: 手动发布

在 `npm-package` 目录打开终端：

```bash
# 1. 登录 NPM
npm login
# 用户名: lichengyu1207
# 密码: <NPM_PASSWORD>
# 邮箱: (输入你的邮箱)

# 2. 发布到 NPM
npm publish --access public
```

## 📋 发布后

### 验证发布

```bash
# 查看包信息
npm info yijiandaodi-core

# 安装测试
npm install yijiandaodi-core
```

### 使用方法

```typescript
import { YijianDaoDiCore } from 'yijiandaodi-core';

// 创建实例
const core = new YijianDaoDiCore();

// 检测风险
const risks = core.detect('sk-proj-abc123');

// 生成报告
const report = core.detectWithReport('敏感内容', '测试');
```

## 🔗 相关链接

- NPM 地址: https://www.npmjs.com/package/yijiandaodi-core
- 官网: https://yijiandaodi.com
- GitHub: https://github.com/yijiandaodi/core

## ⚠️ 注意事项

1. 确保已登录正确的 NPM 账号
2. 包名必须唯一（检查是否已存在）
3. 版本号不能重复（如需更新，修改 package.json 中的 version）
4. 首次发布可能需要邮箱验证

## 🐛 常见问题

### 1. 登录失败
- 检查用户名和密码是否正确
- 检查网络连接
- 尝试使用 `npm logout` 后重新登录

### 2. 包名已存在
- 修改 package.json 中的 name 字段
- 或使用 scope: `@your-name/yijiandaodi-core`

### 3. 版本冲突
- 修改 package.json 中的 version 字段
- 遵循语义化版本控制（Semantic Versioning）

## 📊 发布检查清单

- [x] package.json 配置正确
- [x] README.md 已创建
- [x] LICENSE 已创建
- [x] .npmignore 已配置
- [x] TypeScript 构建成功
- [ ] NPM 登录成功
- [ ] 发布成功
- [ ] 安装测试通过

---

**准备好了吗？** 运行 `publish.bat` 或手动执行 `npm publish --access public` 开始发布！
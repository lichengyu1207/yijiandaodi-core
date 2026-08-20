# 🚀 NPM 发布完整指南

## 📋 发布信息

- **包名**: yijiandaodi-core
- **版本**: 1.0.0
- **作者**: lichengyu1207
- **邮箱**: 155861995@qq.com
- **密码**: <NPM_PASSWORD>

## ✅ 已完成的准备工作

1. ✅ 安装依赖 (302 packages)
2. ✅ 构建 TypeScript (dist/ 目录)
3. ✅ 创建 README.md
4. ✅ 创建 LICENSE
5. ✅ 配置 .npmignore
6. ✅ 创建发布脚本

## 🔑 方法1：命令行登录发布（推荐）

### 步骤1：打开命令行

在 `c:\MsSafeData\Desktop\yijiandaodi\npm-package` 目录打开终端

### 步骤2：登录 NPM

```bash
npm login
```

按提示输入：
- **用户名**: `lichengyu1207`
- **密码**: `<NPM_PASSWORD>`
- **邮箱**: `155861995@qq.com`

### 步骤3：发布到 NPM

```bash
npm publish --access public
```

### 步骤4：验证发布

```bash
npm info yijiandaodi-core
```

## 🌐 方法2：浏览器登录 + Token 发布

### 步骤1：浏览器登录

访问：https://www.npmjs.com/login

输入：
- **用户名**: `lichengyu1207`
- **密码**: `<NPM_PASSWORD>`
- **邮箱**: `155861995@qq.com`

### 步骤2：生成 Access Token

1. 登录成功后，点击右上角头像
2. 选择 "Access Tokens"
3. 点击 "Generate New Token"
4. 选择 "Automation" 类型
5. 复制生成的 token（格式类似：`npm_xxxxxxxxxxxxxxxx`）

### 步骤3：配置 Token

在命令行运行：

```bash
npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN_HERE
```

替换 `YOUR_TOKEN_HERE` 为你刚才复制的 token

### 步骤4：发布

```bash
npm publish --access public
```

## 🎯 方法3：使用自动化脚本

直接双击运行：

```
c:\MsSafeData\Desktop\yijiandaodi\npm-package\auto-publish.bat
```

然后按照提示手动登录和发布。

## ⚠️ 常见问题

### 1. 包名已存在

如果提示包名已存在，需要修改 `package.json` 中的 `name` 字段：

```json
{
  "name": "lichengyu1207-yijiandaodi-core",
  "version": "1.0.0"
}
```

### 2. 版本冲突

如果版本号已存在，需要更新版本号：

```bash
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.1 -> 1.1.0
npm version major  # 1.1.0 -> 2.0.0
```

### 3. 登录失败

- 检查网络连接
- 确认用户名和密码正确
- 尝试使用 `npm logout` 后重新登录

## 📊 发布成功后

### 验证包已发布

```bash
# 查看包信息
npm info yijiandaodi-core

# 安装测试
npm install yijiandaodi-core
```

### 使用包

创建测试文件 `test.js`:

```javascript
const { YijianDaoDiCore } = require('yijiandaodi-core');

const core = new YijianDaoDiCore();
const risks = core.detect('sk-proj-abc123');
console.log(risks);
```

运行测试：

```bash
node test.js
```

### 在其他项目中使用

```bash
npm install yijiandaodi-core
```

```typescript
import { YijianDaoDiCore } from 'yijiandaodi-core';

const core = new YijianDaoDiCore();
const report = core.detectWithReport('敏感内容', '测试');
console.log(report);
```

## 🔗 相关链接

- **NPM 包地址**: https://www.npmjs.com/package/yijiandaodi-core
- **GitHub**: https://github.com/yijiandaodi/core
- **官网**: https://yijiandaodi.com

## ✅ 发布检查清单

- [x] 安装依赖
- [x] 构建项目
- [x] 创建 README.md
- [x] 创建 LICENSE
- [x] 配置 .npmignore
- [ ] 登录 NPM
- [ ] 发布成功
- [ ] 验证包可安装

---

**准备好了吗？** 选择一种方法开始发布吧！

推荐使用**方法1（命令行登录）**，这是最安全和标准的方式。
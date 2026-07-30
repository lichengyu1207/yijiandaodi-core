# ❌ NPM 发布失败 - 权限问题

## 🔍 问题分析

遇到了两次 403 Forbidden 错误，这表明：

1. **可能原因1**: NPM 账号未验证邮箱
2. **可能原因2**: 没有 scoped package 发布权限
3. **可能原因3**: 需要 OTP (一次性密码) 验证

## ✅ 解决方案

### 方案1：验证邮箱（最可能）

1. 登录邮箱：`155861995@qq.com`
2. 查找来自 NPM 的验证邮件
3. 点击邮件中的验证链接
4. 重新尝试发布

### 方案2：检查账号状态

访问：https://www.npmjs.com/settings/lichengyu1207

检查：
- Email 是否已验证
- Account 是否激活
- 是否有 2FA (双因素认证)

### 方案3：使用 GitHub Package Registry

如果 NPM 发布一直失败，可以改用 GitHub Packages：

1. 创建 GitHub 仓库
2. 使用 GitHub Actions 自动发布
3. 通过 GitHub Package Registry 分发

### 方案4：联系 NPM 支持

如果以上都不行，联系 NPM 支持：
- https://www.npmjs.com/support

## 🔧 临时解决方案

### 本地安装测试

虽然不能发布到 NPM，但可以本地使用：

```bash
# 在项目根目录
npm install ./npm-package
```

### GitHub 安装

推送到 GitHub 后，可以这样安装：

```bash
npm install https://github.com/yijiandaodi/core.git
```

## 📧 验证邮箱步骤

1. **登录邮箱**：155861995@qq.com
2. **搜索邮件**：来自 `npm@npmjs.com` 或 `support@npmjs.com`
3. **验证邮箱**：点击邮件中的 "Verify Email" 链接
4. **等待几分钟**
5. **重新发布**：`npm publish --access public`

## 🚨 如果找不到验证邮件

重新发送验证邮件：

```bash
npm profile set email 155861995@qq.com
```

或访问：
https://www.npmjs.com/settings/lichengyu1207/email-resend

## 💡 建议

1. **首先验证邮箱** - 这是最常见的 403 错误原因
2. **检查账号状态** - 确保账号没有其他限制
3. **等待验证** - 邮箱验证后可能需要几分钟生效

---

**下一步**：检查邮箱 155861995@qq.com，查找 NPM 的验证邮件并完成验证！
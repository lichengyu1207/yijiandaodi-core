# 🔒 AI Agent 安全推送快速指南

## 🚀 推送前必须执行

### 一键安全检查

```bash
# 运行完整的安全检查脚本
bash scripts/pre-push-security-check.sh

# 或使用 npm
npm run test:security
```

---

## ✅ 安全检查清单

### 1. API Key 检查

```bash
# 检查是否硬编码 API Key
grep -rE "(sk-|AIza|ghp_|AKIA|eyJ)" --include="*.ts" --include="*.js" .
```

**如果发现**：
- ❌ 立即停止推送
- 🔧 使用环境变量替换
- 🗑️ 从代码中删除

---

### 2. 敏感文件检查

```bash
# 检查敏感文件
ls -la | grep -E "\.(env|key|pem)$"
```

**必须排除**：
- `.env` - 环境变量
- `*.key` - 私钥文件
- `*.pem` - 证书文件
- `config/secrets.json` - 敏感配置

---

### 3. Git 历史检查

```bash
# 检查历史中的敏感文件
git log --all --full-history -- "*.env" "*.key" "*.pem"
```

**如果发现**：
```bash
# 使用 BFG 清理
bfg --replace-text passwords.txt my-repo.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

---

## 🛡️ 防护措施

### Git 钩子设置

```bash
# 复制钩子脚本
cp scripts/pre-push-security-check.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

### .gitignore 配置

确保包含：

```gitignore
# 敏感文件
.env
*.key
*.pem
config/secrets.json
credentials.json

# 日志和临时文件
*.log
logs/
tmp/
```

---

## 🚨 泄露应急响应

### 立即行动（15分钟内）

1. **撤销 API Key**
   ```bash
   # OpenAI
   访问: https://platform.openai.com/api-keys
   点击: Revoke

   # Anthropic
   访问: https://console.anthropic.com/
   撤销: 泄露的 Key
   ```

2. **停止推送**
   ```bash
   # 取消正在进行的推送
   git push --abort
   ```

3. **清理历史**
   ```bash
   # 使用 BFG 清理
   bfg --replace-text passwords.txt
   ```

---

## 📋 推送流程

### 推荐流程

```bash
# 1. 运行安全检查
npm run test:security

# 2. 检查 git status
git status

# 3. 检查 git diff
git diff

# 4. 确认 .gitignore
cat .gitignore

# 5. 推送（如果所有检查通过）
git push origin main
```

---

## 🎯 关键要点

### ✅ 正确做法

- ✅ 使用环境变量
- ✅ 敏感文件在 .gitignore 中
- ✅ 推送前运行安全检查
- ✅ 定期审查 Git 历史

### ❌ 错误做法

- ❌ 硬编码 API Key
- ❌ 提交 .env 文件
- ❌ 直接推送不检查
- ❌ 忽略警告信息

---

## 📞 紧急联系

如果发现泄露：

1. **立即撤销** API Key
2. **停止推送**
3. **清理历史**
4. **通知团队**

---

**记住：安全第一，推送第二！** 🔒
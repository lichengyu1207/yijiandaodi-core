# AI 配置管理

## 🔐 API Key 配置

**重要**：请勿在代码中硬编码 API Key！

### 方式1：环境变量（推荐）

创建 `.env` 文件（已在 .gitignore 中）：

```bash
# .env
OPENAI_API_KEY=sk-proj-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
GOOGLE_API_KEY=AIza-your-key-here
```

在代码中使用：

```typescript
import dotenv from 'dotenv';
dotenv.config();

const openaiKey = process.env.OPENAI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
```

### 方式2：配置文件

创建 `config/ai-config.json`（已在 .gitignore 中）：

```json
{
  "openai": {
    "apiKey": "your-key",
    "model": "gpt-4"
  },
  "anthropic": {
    "apiKey": "your-key",
    "model": "claude-3-5-sonnet-20241022"
  }
}
```

在代码中使用：

```typescript
import fs from 'fs';

const config = JSON.parse(
  fs.readFileSync('config/ai-config.json', 'utf-8')
);
```

### 方式3：运行时参数

```typescript
class AIAnalyzer {
  constructor(private apiKey: string) {}

  analyze(content: string) {
    // 使用传入的 API Key
  }
}

// 使用时传入
const analyzer = new AIAnalyzer(process.env.OPENAI_API_KEY!);
```

---

## 📝 配置模板

### 创建配置模板文件

`config/ai-config.example.json`：

```json
{
  "openai": {
    "apiKey": "YOUR_OPENAI_API_KEY",
    "model": "gpt-4",
    "maxTokens": 2000
  },
  "anthropic": {
    "apiKey": "YOUR_ANTHROPIC_API_KEY",
    "model": "claude-3-5-sonnet-20241022"
  },
  "google": {
    "apiKey": "YOUR_GOOGLE_API_KEY",
    "model": "gemini-pro"
  }
}
```

---

## 🔒 安全最佳实践

### 1. Git 忽略配置

确保 `.gitignore` 包含：

```gitignore
# 环境变量
.env
.env.local
.env.*.local

# 配置文件
config/ai-config.json
secrets.json
*.key
*.pem
```

### 2. 提交前检查

在提交代码前运行：

```bash
# 检查是否包含敏感信息
git diff --staged | grep -E "(sk-|AIza|ghp_|password|secret)"

# 如果发现，立即移除
git restore --staged .
# 手动移除敏感信息后重新提交
```

### 3. 使用 .env.example

创建 `.env.example`（可以提交）：

```bash
# .env.example
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

---

## 🚀 部署时配置

### GitHub Actions

使用 GitHub Secrets：

1. 仓库设置 → Secrets and variables → Actions
2. 添加 Secret：`OPENAI_API_KEY`
3. 在 workflow 中使用：

```yaml
- name: Run Tests
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npm test
```

### Docker

使用环境变量：

```bash
docker run -e OPENAI_API_KEY=your-key your-image
```

或使用 `.env` 文件：

```bash
docker run --env-file .env your-image
```

---

## 📋 检查清单

提交代码前检查：

- [ ] 没有硬编码 API Key
- [ ] `.env` 文件在 `.gitignore` 中
- [ ] 配置文件在 `.gitignore` 中
- [ ] 使用了 `.env.example` 模板
- [ ] 没有在日志中输出 API Key
- [ ] GitHub Secrets 已配置（如果使用 CI/CD）

---

## 🛡️ 泄漏应对

如果不小心提交了 API Key：

### 1. 立即撤销

```bash
# OpenAI
访问: https://platform.openai.com/api-keys
撤销泄漏的 Key

# Anthropic
访问: https://console.anthropic.com/
撤销泄漏的 Key
```

### 2. 清理 Git 历史

```bash
# 使用 BFG Repo-Cleaner
bfg --replace-text passwords.txt my-repo.git

# 或使用 git filter-branch
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all
```

### 3. 强制推送

```bash
git push origin --force --all
```

---

**重要**：永远不要在代码中硬编码敏感信息！
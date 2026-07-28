# 🔒 AI Agent 项目安全推送方案

## 📋 问题分析

### 风险点
1. **API Key 泄露** - OpenAI、Anthropic、Google 等密钥
2. **配置文件泄露** - 数据库连接、端点地址
3. **敏感代码泄露** - 业务逻辑、加密算法
4. **凭证泄露** - SSH密钥、证书、OAuth凭证
5. **依赖项泄露** - 内部私有包、特定版本信息

### 典型泄露场景
```
❌ 硬编码API Key → 提交到GitHub → 被扫描发现 → 滥用
❌ .env文件提交 → 公开可见 → 被搜索引擎索引
❌ 配置文件包含密码 → 历史记录保留 → 即使删除也能恢复
```

---

## 🛠️ 完整防护方案

### 1. 推送前安全检查清单

#### ✅ 自动化检查脚本

创建 `scripts/pre-push-security-check.sh`:

```bash
#!/bin/bash

echo "🔒 执行推送前安全检查..."

# 1. 检查硬编码的API Key
echo "📋 检查硬编码的API Key..."
if grep -rE "(sk-|AIza|ghp_|AKIA|eyJ)[a-zA-Z0-9_-]{20,}" --include="*.ts" --include="*.js" --include="*.json" .; then
    echo "❌ 发现硬编码的API Key！请使用环境变量！"
    exit 1
fi

# 2. 检查敏感文件
echo "📋 检查敏感文件..."
if [ -f ".env" ]; then
    echo "❌ 发现 .env 文件！请确保它在 .gitignore 中！"
    exit 1
fi

if [ -f "config/secrets.json" ]; then
    echo "❌ 发现 secrets.json 文件！"
    exit 1
fi

# 3. 检查是否有未排除的配置文件
echo "📋 检查配置文件..."
if git ls-files | grep -E "\.(env|key|pem|crt)$"; then
    echo "❌ 发现已追踪的敏感文件！"
    exit 1
fi

# 4. 检查Git历史中的敏感信息
echo "📋 检查Git历史..."
if git log --all --full-history -- "*.env" "*.key" "*.pem" | grep -q .; then
    echo "⚠️  Git历史中存在敏感文件，建议清理！"
fi

echo "✅ 安全检查通过！"
exit 0
```

**使用方法**：
```bash
# 添加到 Git 钩子
chmod +x scripts/pre-push-security-check.sh
./scripts/pre-push-security-check.sh
```

---

### 2. Git 钩子配置

#### Pre-commit 钩子

创建 `.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "🔒 Pre-commit 安全检查..."

# 检查暂存区的文件
FILES=$(git diff --cached --name-only)

# 1. 检查敏感文件扩展名
if echo "$FILES" | grep -E "\.(env|key|pem|crt|p12)$"; then
    echo "❌ 不能提交敏感文件！"
    exit 1
fi

# 2. 检查文件内容中的敏感信息
for FILE in $FILES; do
    if [ -f "$FILE" ]; then
        # 检查API Key模式
        if grep -qE "(sk-|AIza|ghp_|AKIA|eyJ)[a-zA-Z0-9_-]{20,}" "$FILE"; then
            echo "❌ 文件 $FILE 包含硬编码的API Key！"
            exit 1
        fi
        
        # 检查密码模式
        if grep -qE "(password|passwd|pwd)\s*=\s*['\"]" "$FILE"; then
            echo "⚠️  文件 $FILE 可能包含硬编码的密码！"
            # 不阻止，但警告
        fi
    fi
done

echo "✅ Pre-commit 检查通过！"
exit 0
```

#### Pre-push 钩子

创建 `.git/hooks/pre-push`:

```bash
#!/bin/bash

echo "🔒 Pre-push 最终安全检查..."

# 执行完整的检查脚本
./scripts/pre-push-security-check.sh

if [ $? -ne 0 ]; then
    echo "❌ 推送被阻止！请修复安全问题！"
    exit 1
fi

echo "✅ 准备推送..."
exit 0
```

**启用钩子**：
```bash
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/pre-push
```

---

### 3. 敏感文件管理策略

#### .gitignore 完整配置

```gitignore
# ============================================
# AI Agent 项目专用安全配置
# ============================================

# 🔑 API Keys 和凭证
.env
.env.*
*.env
config/secrets.json
config/credentials.json
secrets/
credentials/

# 🔐 密钥和证书
*.key
*.pem
*.crt
*.p12
*.pfx
id_rsa*
id_ed25519*
*.pub

# 📝 配置文件（包含敏感信息）
config/database.yml
config/api-keys.json
config/endpoints.json
*.local.json

# 🤖 AI Agent 特定文件
models/private-*.bin
data/sensitive/
logs/audit/
exports/private/

# 💾 数据库和缓存
*.db
*.sqlite
*.sqlite3
cache/
data/cache/

# 🔧 开发工具配置
.vscode/settings.json
.idea/workspace.xml
*.code-workspace

# 📊 日志和临时文件
logs/
*.log
tmp/
temp/
*.tmp

# 🌐 网络和安全
proxy-config.json
firewall-rules.json
network-secrets.json

# 📦 依赖和构建
node_modules/
dist/
build/
*.tgz

# 🧪 测试覆盖率
coverage/
.nyc_output/
test-results/

# 📱 桌面端特定
desktop-client/electron-builder.env
desktop-client/.env.local

# 🎭 桌宠特定
pet-config/secrets.json
pet-data/private/

# 🛡️ Skill 系统特定
skills/secrets/
skills/*/config.json
```

---

### 4. 环境变量管理方案

#### 开发环境

**`.env.example`（可提交）**:
```bash
# AI Agent 配置模板
# 复制为 .env 并填入真实值

# ===== AI 提供商 =====
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_AI_API_KEY=your_google_ai_key_here

# ===== 桌面端配置 =====
DESKTOP_API_ENDPOINT=https://api.example.com
DESKTOP_SECRET_KEY=your_desktop_secret_here

# ===== 数据库 =====
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
DATABASE_PASSWORD=your_db_password_here

# ===== 桌宠系统 =====
PET_CONFIG_PATH=/path/to/pet/config
PET_DATA_DIR=/path/to/pet/data

# ===== Skill 系统 =====
SKILL_REGISTRY_URL=https://skills.example.com
SKILL_API_KEY=your_skill_api_key_here

# ===== 安全配置 =====
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# ===== 网络配置 =====
PROXY_URL=http://proxy.example.com:8080
ALLOWED_ORIGINS=https://example.com
```

**`.env`（不能提交）**:
```bash
# 真实配置（从 .env.example 复制并填入真实值）
OPENAI_API_KEY=sk-proj-abc123...
ANTHROPIC_API_KEY=sk-ant-def456...
# ... 其他真实配置
```

#### 生产环境

**使用密钥管理服务**：
```typescript
// 使用 AWS Secrets Manager
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManager({ region: 'us-east-1' });
const secret = await client.getSecretValue({ SecretId: 'my-app/api-keys' });
const config = JSON.parse(secret.SecretString);

// 使用 Azure Key Vault
import { DefaultAzureCredential, SecretClient } from '@azure/identity';
import { SecretClient as KVSecretClient } from '@azure/keyvault-secrets';

const credential = new DefaultAzureCredential();
const kvClient = new KVSecretClient('https://my-vault.vault.azure.net/', credential);
const secret = await kvClient.getSecret('api-key');

// 使用 HashiCorp Vault
import vault from 'node-vault';

const vaultClient = vault({
    apiVersion: 'v1',
    endpoint: 'http://127.0.0.1:8200',
    token: 'my-token'
});

const result = await vaultClient.read('secret/data/api-keys');
```

---

### 5. 代码混淆和加密

#### 敏感算法混淆

```typescript
// 使用 JavaScript Obfuscator
import JavaScriptObfuscator from 'javascript-obfuscator';

const code = `
function sensitiveAlgorithm(data) {
    // 敏感算法实现
    return processed;
}
`;

const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    numbersToExpressions: true,
    simplify: true,
    shuffleStringArray: true,
    splitStrings: true,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
}).getObfuscatedCode();
```

#### 配置文件加密

```bash
# 加密配置文件
openssl enc -aes-256-cbc -salt -in config.json -out config.json.enc -pass pass:your_password

# 解密配置文件（运行时）
openssl enc -aes-256-cbc -d -in config.json.enc -out config.json -pass pass:your_password
```

---

### 6. Git 历史清理

#### 如果已经泄露，如何清理

```bash
# 方法1：使用 BFG Repo-Cleaner（推荐）
# 1. 创建 passwords.txt 文件，列出要删除的敏感信息
echo "sk-proj-abc123" >> passwords.txt
echo "password=admin" >> passwords.txt

# 2. 运行 BFG
bfg --replace-text passwords.txt my-repo.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 方法2：使用 git filter-branch
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env config/secrets.json' \
  --prune-empty --tag-name-filter cat -- --all

# 强制推送（谨慎！）
git push origin --force --all
```

#### 检查历史记录

```bash
# 查找历史中的敏感文件
git log --all --full-history -- "*.env" "*.key" "*.pem"

# 查找历史中的敏感内容
git log -p | grep -E "(sk-|password|secret)"

# 查看某个文件的历史
git log --follow -- config/secrets.json
```

---

### 7. CI/CD 安全配置

#### GitHub Actions 安全

```yaml
name: Security Check

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check for hardcoded secrets
        run: |
          # 检查硬编码的API Key
          if grep -rE "(sk-|AIza|ghp_)" --include="*.ts" --include="*.js" .; then
            echo "❌ 发现硬编码的API Key！"
            exit 1
          fi
          
          # 检查敏感文件
          if find . -name ".env" -o -name "*.key" -o -name "*.pem" | grep -q .; then
            echo "❌ 发现敏感文件！"
            exit 1
          fi
          
          echo "✅ 安全检查通过"
      
      - name: Run tests
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: npm test
```

#### GitLab CI 安全

```yaml
security_check:
  stage: test
  script:
    - echo "Running security checks..."
    - |
      if grep -rE "(sk-|AIza|ghp_)" --include="*.ts" --include="*.js" .; then
        echo "Found hardcoded API keys!"
        exit 1
      fi
    - |
      if find . -name ".env" -o -name "*.key" | grep -q .; then
        echo "Found sensitive files!"
        exit 1
      fi
  only:
    - merge_requests
    - main
```

---

### 8. 监控和响应

#### 泄露检测

```bash
# 使用 GitGuardian
ggshield scan --mode=pre-push

# 使用 TruffleHog
trufflehog git file://. --since-commit HEAD~10

# 使用 Gitleaks
gitleaks detect --source . --verbose
```

#### 泄露响应流程

```markdown
## 🚨 泄露响应流程

### 1. 立即行动（15分钟内）
- [ ] 撤销泄露的 API Key
- [ ] 更改所有相关密码
- [ ] 从 Git 历史中删除敏感文件

### 2. 短期行动（1小时内）
- [ ] 评估泄露范围
- [ ] 检查是否有滥用记录
- [ ] 通知相关团队

### 3. 中期行动（24小时内）
- [ ] 实施新的安全措施
- [ ] 更新所有凭证
- [ ] 进行安全审计

### 4. 长期行动（1周内）
- [ ] 完善安全流程
- [ ] 培训团队成员
- [ ] 建立监控机制
```

---

## 📋 完整推送流程

### 推送前检查清单

```markdown
## 🔒 推送前安全检查清单

### 自动检查（Git钩子）
- [ ] 无硬编码 API Key
- [ ] 无硬编码密码
- [ ] 无敏感文件
- [ ] .env 文件未追踪

### 手动检查
- [ ] 检查 git status
- [ ] 检查 git diff
- [ ] 检查 .gitignore 是否完整
- [ ] 确认环境变量配置

### 团队检查
- [ ] Code Review 完成
- [ ] 安全审计通过
- [ ] 测试通过
- [ ] 文档更新

### 推送执行
- [ ] 执行安全检查脚本
- [ ] 推送到开发分支
- [ ] 创建 Pull Request
- [ ] CI/CD 检查通过
- [ ] 合并到主分支
```

---

## 🎯 AI Agent 项目特定安全建议

### 桌面端安全
```typescript
// electron/main.ts
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// 安全配置加载
function loadSecureConfig() {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    
    // 不从源码读取，从外部文件读取
    if (!fs.existsSync(configPath)) {
        throw new Error('配置文件不存在！');
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // 验证必要字段
    if (!config.apiKey) {
        throw new Error('缺少 API Key！');
    }
    
    return config;
}
```

### API 层安全
```typescript
// api/middleware/security.ts
export function validateRequest(req, res, next) {
    // 1. 验证来源
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (!allowedOrigins.includes(req.headers.origin)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    // 2. 验证 API Key（从环境变量读取）
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error('API Key not configured');
    }
    
    // 3. 验证签名
    const signature = req.headers['x-signature'];
    if (!verifySignature(req.body, signature)) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    next();
}
```

### Skill 系统安全
```typescript
// skills/security.ts
export class SkillSecurity {
    // 敏感操作需要验证
    static async verifyPermission(skillId: string, operation: string): Promise<boolean> {
        // 从安全存储读取权限配置
        const permissions = await this.loadSecurePermissions();
        
        return permissions[skillId]?.includes(operation) || false;
    }
    
    // 私有方法：从安全存储加载
    private static async loadSecurePermissions(): Promise<any> {
        // 从加密存储读取，不硬编码
        const encryptedData = await fs.readFile('/secure/permissions.enc');
        return this.decrypt(encryptedData);
    }
}
```

### 桌宠系统安全
```typescript
// pet/security.ts
export class PetSecurity {
    // 配置不打包在源码中
    static loadPetConfig(): PetConfig {
        const configPath = process.env.PET_CONFIG_PATH;
        
        if (!configPath || !fs.existsSync(configPath)) {
            throw new Error('Pet config not found');
        }
        
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
}
```

---

## 🎊 总结

### 关键要点

1. **永远不要硬编码** - 所有敏感信息使用环境变量
2. **Git钩子自动检查** - 推送前自动拦截
3. **完善.gitignore** - 排除所有敏感文件
4. **定期审计** - 检查历史记录和代码
5. **快速响应** - 泄露后立即行动

### 工具推荐

- **GitGuardian** - 自动检测泄露
- **TruffleHog** - 扫描 Git 历史
- **BFG Repo-Cleaner** - 清理历史记录
- **Gitleaks** - 本地扫描工具

---

**记住：安全是一个持续的过程，不是一次性的任务！** 🔒
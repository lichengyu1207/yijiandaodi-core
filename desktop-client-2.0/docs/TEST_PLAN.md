# 实际测试方案

**测试日期**: 2026-08-01
**测试目的**: 验证真实环境中的检测效果
**测试环境**: Windows 10/11, Node.js 18+, Python 3.8+

---

## 📋 测试清单

### Phase 1: 基础功能测试

#### 1.1 应用启动测试
```powershell
# 进入项目目录
cd c:\MsSafeData\Desktop\yijiandaodi\desktop-client-2.0

# 安装依赖
npm install

# 启动开发模式
npm run electron:dev
```

**预期结果**：
- ✅ 应用正常启动
- ✅ 主窗口显示
- ✅ 桌宠显示在右下角
- ✅ 系统托盘图标出现

---

#### 1.2 监控服务测试

**测试步骤**：
1. 打开应用
2. 查看控制台输出
3. 确认监控服务启动

**预期输出**：
```
[文件监控] 启动...
[剪贴板监控] 启动...
[进程监控] 启动...
[网络监控] 启动...
[一鉴到底] 所有监控服务已启动
```

---

### Phase 2: SQL注入检测测试

#### 测试用例 1: 基本SQL注入

**测试步骤**：
1. 创建测试文件 `test-sqli.txt`
2. 写入以下内容：
```sql
SELECT * FROM users WHERE id='1' OR '1'='1'
'; DROP TABLE users; --
UNION SELECT username, password FROM users--
```
3. 保存到桌面或文档目录
4. 观察应用反应

**预期结果**：
- ✅ 桌宠变为 🟡 黄色或 🔴 红色
- ✅ 审计记录中出现检测记录
- ✅ 控制台输出：`[文件] 发现安全风险`

---

#### 测试用例 2: 复杂SQL注入

**测试内容**：
```sql
1'; EXEC xp_cmdshell('dir') --
admin'--
' OR '1'='1' /* 
```

**预期结果**：
- ✅ 检测到 SQL注入Payload
- ✅ 检测到系统命令执行

---

### Phase 3: API Key 检测测试

#### 测试用例 3: OpenAI API Key

**测试步骤**：
1. 创建测试文件 `test-apikey.txt`
2. 写入以下内容：
```
OpenAI API Key: sk-proj-abcdefghijklmnopqrstuvwxyz123456
GitHub Token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS Key: AKIAIOSFODNN7EXAMPLE
```
3. 保存文件
4. 观察应用反应

**预期结果**：
- ✅ 检测到 `sk-proj-` (OpenAI Key)
- ✅ 检测到 `ghp_` (GitHub Token)
- ✅ 检测到 `AKIA` (AWS Key)
- ✅ 桌宠变为 🟡 黄色

---

#### 测试用例 4: 敏感信息检测

**测试内容**：
```
数据库配置：
password=MySecretPassword123
api_key=sk-test-1234567890
secret_key=sk_live_abcdefghijklmnop
```

**预期结果**：
- ✅ 检测到 `password` 字段
- ✅ 检测到 `api_key` 字段
- ✅ 敏感等级：confidential

---

### Phase 4: 剪贴板监控测试

#### 测试用例 5: 剪贴板SQL注入

**测试步骤**：
1. 复制以下内容：
```sql
SELECT * FROM users WHERE id='1' OR '1'='1'
```
2. 等待 500ms
3. 观察应用反应

**预期结果**：
- ✅ 检测到剪贴板变化
- ✅ 检测到 SQL注入
- ✅ 桌宠状态变化
- ✅ 控制台输出：`[剪贴板监控] 开始自动检测`

---

#### 测试用例 6: 剪贴板API Key

**测试步骤**：
1. 复制以下内容：
```
sk-proj-abcdefghijklmnopqrstuvwxyz1234567890
```
2. 观察应用反应

**预期结果**：
- ✅ 检测到 API Key
- ✅ 桌宠气泡提示："检测到 API Key"

---

### Phase 5: 进程监控测试

#### 测试用例 7: Cursor 进程检测

**测试步骤**：
1. 打开 Cursor 应用
2. 等待 5 秒
3. 观察应用反应

**预期结果**：
- ✅ 检测到 Cursor 进程
- ✅ 控制台输出：`[进程监控] 检测到 AI Agent: Cursor`

---

#### 测试用例 8: Chrome 浏览器检测

**测试步骤**：
1. 打开 Chrome 浏览器
2. 访问 ChatGPT 网站
3. 等待 5 秒
4. 观察应用反应

**预期结果**：
- ✅ 检测到 Chrome 进程
- ✅ 检测到 OpenAI API 连接（如果有）

---

### Phase 6: 智能提示测试

#### 测试用例 9: 提示频率控制

**测试步骤**：
1. 连续创建 10 个包含 SQL注入 的文件
2. 观察提示频率

**预期结果**：
- ✅ 前几次会提示
- ✅ 后续不再重复提示（5分钟内）
- ✅ 每小时最多提示 5 次

---

#### 测试用例 10: 风险等级提示

**测试步骤**：
1. 创建 `low_risk.txt`（包含普通文本）
2. 创建 `medium_risk.txt`（包含 password 字段）
3. 创建 `high_risk.txt`（包含 SQL注入）
4. 创建 `critical_risk.txt`（包含多个高危模式）

**预期结果**：
```
low_risk.txt: 🟢 绿色，不提示
medium_risk.txt: 🟡 黄色，桌宠变化
high_risk.txt: 🔴 红色，系统通知
critical_risk.txt: 🔴 红色闪烁，系统通知
```

---

### Phase 7: 审计记录测试

#### 测试用例 11: 审计记录查看

**测试步骤**：
1. 执行多个测试用例
2. 打开主窗口
3. 查看"实时审计"页面

**预期结果**：
- ✅ 显示所有检测记录
- ✅ 包含时间戳、风险等级、操作内容
- ✅ 可以筛选：全部/正常/风险/已阻断
- ✅ 点击记录可查看详情

---

#### 测试用例 12: 审计记录导出

**测试步骤**：
1. 点击"导出报告"按钮
2. 选择 JSON 格式
3. 查看导出文件

**预期结果**：
- ✅ 成功导出 JSON 文件
- ✅ 包含完整审计信息
- ✅ 包含审计哈希

---

## 🛠️ 测试脚本

### 自动化测试脚本

创建文件 `test-detection.js`：

```javascript
// test-detection.js
const fs = require('fs');
const path = require('path');

const testCases = {
  sqli: [
    "SELECT * FROM users WHERE id='1' OR '1'='1'",
    "'; DROP TABLE users; --",
    "UNION SELECT username, password FROM users--",
    "1'; EXEC xp_cmdshell('dir') --"
  ],
  
  xss: [
    "<script>alert('xss')</script>",
    "<img src=x onerror=alert('xss')>",
    "javascript:alert('xss')"
  ],
  
  apikey: [
    "sk-proj-abcdefghijklmnopqrstuvwxyz123456",
    "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "AKIAIOSFODNN7EXAMPLE",
    "AIzaSyDaGmKOJSJhashdHash1234567890"
  ],
  
  sensitive: [
    "password=MySecretPassword123",
    "api_key=sk-test-1234567890",
    "secret_key=sk_live_abcdefghijklmnop"
  ]
};

// 创建测试目录
const testDir = path.join(__dirname, 'test-files');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir);
}

// 生成测试文件
Object.entries(testCases).forEach(([type, cases]) => {
  const filePath = path.join(testDir, `test-${type}.txt`);
  fs.writeFileSync(filePath, cases.join('\n\n'));
  console.log(`✅ 创建测试文件: ${filePath}`);
});

console.log('\n📝 测试文件已生成，请查看应用是否检测到风险');
```

**运行测试脚本**：
```powershell
node test-detection.js
```

---

## 📊 测试记录表

### 测试结果记录

| 测试项 | 测试用例 | 预期结果 | 实际结果 | 通过 |
|--------|---------|---------|---------|------|
| SQL注入检测 | 基本注入 | ✅ 检测到 | | ⬜ |
| SQL注入检测 | 复杂注入 | ✅ 检测到 | | ⬜ |
| API Key检测 | OpenAI Key | ✅ 检测到 | | ⬜ |
| API Key检测 | GitHub Token | ✅ 检测到 | | ⬜ |
| 敏感信息检测 | 密码字段 | ✅ 检测到 | | ⬜ |
| 剪贴板监控 | SQL注入 | ✅ 检测到 | | ⬜ |
| 剪贴板监控 | API Key | ✅ 检测到 | | ⬜ |
| 进程监控 | Cursor | ✅ 检测到 | | ⬜ |
| 进程监控 | Chrome | ✅ 检测到 | | ⬜ |
| 智能提示 | 频率控制 | ✅ 不重复 | | ⬜ |
| 审计记录 | 记录查看 | ✅ 显示完整 | | ⬜ |
| 审计记录 | 导出功能 | ✅ 成功导出 | | ⬜ |

---

## 🔍 测试注意事项

### 1. 测试前准备
```powershell
# 确认 Node.js 版本
node --version  # 应该 >= 18

# 确认 Python 版本
python --version  # 应该 >= 3.8

# 安装项目依赖
npm install
```

### 2. 测试中观察
- 控制台输出日志
- 桌宠状态变化
- 系统通知
- 审计记录

### 3. 测试后验证
- 检查审计记录完整性
- 验证导出文件格式
- 确认没有内存泄漏

---

## 🐛 已知问题

### 问题 1: 网络监控局限性
```
现象：无法看到 API 调用的具体内容
原因：netstat 只能查看连接，无法解析 HTTPS 内容
影响：无法拦截具体的数据泄露
```

### 问题 2: 进程检测延迟
```
现象：进程启动后 5 秒才检测到
原因：监控间隔设置为 5 秒
影响：启动瞬间的行为可能遗漏
```

### 问题 3: 剪贴板检测频率
```
现象：复制后最多 500ms 才检测到
原因：监控间隔设置为 500ms
影响：极快操作可能遗漏
```

---

## ✅ 测试通过标准

### 必须通过的测试
- ✅ SQL 注入检测 (准确率 >= 90%)
- ✅ API Key 检测 (准确率 >= 95%)
- ✅ 剪贴板监控 (准确率 >= 90%)
- ✅ 文件监控 (准确率 >= 85%)
- ✅ 智能提示 (不烦人)
- ✅ 审计记录 (完整准确)

### 可接受的局限
- ⚠️ 网络监控仅能看到连接
- ⚠️ 进程监控有 5 秒延迟
- ⚠️ 剪贴板监控有 500ms 延迟

---

## 📝 测试报告模板

测试完成后，请填写：

```markdown
# 测试报告

**测试日期**: 2026-08-01
**测试人员**: [你的名字]
**测试环境**: Windows 11, Node.js 18.x

## 测试结果

### 通过的测试
- [ ] SQL注入检测
- [ ] API Key检测
- [ ] 剪贴板监控
- [ ] 进程监控

### 发现的问题
1. [问题描述]
2. [问题描述]

### 建议
1. [改进建议]
2. [改进建议]

## 总体评价
- 准确率: X%
- 性能: ⭐⭐⭐⭐
- 体验: ⭐⭐⭐⭐
```

---

**下一步**：开始执行测试，记录结果！
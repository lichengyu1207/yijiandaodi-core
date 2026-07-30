# 一鉴到底 - VS Code / Cursor 插件

像 360 一样实时拦截 AI Agent 的风险操作。

## 功能

- ✓ 实时检测 AI 生成的代码
- ✓ 硬编码密钥检测（20+ 平台）
- ✓ 敏感文件监控
- ✓ 危险函数检测
- ✓ 自动拦截严重风险
- ✓ 用户确认机制
- ✓ 审计日志记录

## 安装

### 方式 1: 从 VS Code 商店安装（推荐）

1. 打开 VS Code / Cursor
2. 按 `Ctrl+Shift+X` 打开扩展面板
3. 搜索 "一鉴到底"
4. 点击安装

### 方式 2: 本地安装

```bash
# 进入插件目录
cd vscode-extension

# 安装依赖
npm install

# 编译
npm run compile

# 打包为 .vsix 文件
npx vsce package

# 在 VS Code 中安装
# 方法 1: 命令行
code --install-extension yijiandaodi-interceptor-1.0.0.vsix

# 方法 2: 手动安装
# VS Code → 扩展 → 更多 → 从 VSIX 安装...
```

### 方式 3: 开发模式

```bash
cd vscode-extension
npm install
npm run watch
```

然后在 VS Code 中按 `F5` 启动调试。

## 配置

在 VS Code 设置中搜索 "一鉴到底"：

```json
{
  "yijiandaodi.apiEndpoint": "http://localhost:9092",
  "yijiandaodi.autoBlock": true,
  "yijiandaodi.showNotification": true,
  "yijiandaodi.agents": ["cursor", "copilot", "trae", "claude", "chatgpt"]
}
```

## 使用

### 命令

- `Ctrl+Shift+P` → 输入 "一鉴到底"
  - **开启/关闭拦截器** - 切换监控状态
  - **检测当前文件** - 手动检测文件风险
  - **显示状态** - 打开状态面板

### 状态栏

- 右下角显示 `$(shield) 一鉴到底` 图标
- 点击查看状态

### 拦截流程

```
AI 生成代码
    ↓
一鉴到底检测
    ↓
发现风险?
    ├─ 是 (严重) → 自动拦截 + 弹窗
    ├─ 是 (高)   → 询问用户
    └─ 否        → 放行
```

## 支持的 AI Agent

- Cursor
- VS Code Copilot
- Trae CN (字节跳动)
- Claude
- ChatGPT
- Windsurf
- Aider
- 其他 AI 编程助手

## 风险检测规则

### 硬编码密钥

检测 20+ 平台的 API Key：

- OpenAI: `sk-*`, `sk-proj-*`
- Anthropic: `sk-ant-*`
- Trae CN: `trae_*`
- 阿里云: `LTAI*`, `sk-[32位]`
- 腾讯: `AKID*`
- AWS: `AKIA*`
- GitHub: `ghp_*`
- ...

### 敏感文件

- `.env`
- `config.py`
- `settings.py`
- `.pem`
- `.key`
- `id_rsa`

### 危险函数

- `eval()`
- `exec()`
- `os.system()`
- `subprocess.call()`

## 开发

### 项目结构

```
vscode-extension/
├── src/
│   └── extension.ts      # 主入口
├── package.json          # 插件配置
├── tsconfig.json         # TypeScript 配置
└── README.md             # 说明文档
```

### 编译

```bash
npm run compile
```

### 打包

```bash
npx vsce package
```

## 发布

```bash
# 登录
npx vsce login yijiandaodi

# 发布
npx vsce publish
```

## 许可证

MIT
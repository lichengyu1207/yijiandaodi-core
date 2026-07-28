# 一鉴到底 - 产品化与分发方案

## 一、核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                    用户下载安装包                            │
│                         ↓                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           桌面端（Electron 应用）                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │ 系统托盘    │  │ 管理控制台  │  │ 实时监控    │  │   │
│  │  │ (后台运行)  │  │ (用户界面)  │  │ (常驻进程)  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                         ↓                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           本地服务（Python 后台）                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │ 沙箱 API    │  │ Skill API   │  │ 本地数据库  │  │   │
│  │  │ (端口 9092) │  │ (14个技能)  │  │ (SQLite)    │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 二、分发方案

### 方案 A：完整安装包（推荐）

**用户视角：**
1. 下载 `yijiandaodi-setup.exe`（约 200MB）
2. 双击安装，像普通软件一样
3. 安装完成后自动启动，后台持续运行
4. 系统托盘显示图标，点击打开管理界面

**技术实现：**
```
安装包内容：
├── desktop-client.exe      # Electron 桌面端
├── python-runtime/         # Python 运行时
│   ├── python.exe
│   └── Lib/
├── backend/                # Python 后台服务
│   ├── sandbox_api.py
│   ├── local_data_store.py
│   ├── skill_api.py
│   └── grok/
└── data/                   # 本地数据目录
    └── yijiandaodi_local.db
```

**优点：**
- 用户无需安装 Python
- 一键安装，开箱即用
- 后台服务自动启动

### 方案 B：API 优先（企业用户）

**用户视角：**
1. 访问官网下载 API 服务
2. 启动服务：`python sandbox_api.py`
3. 获取 API Key
4. 集成到自己的系统

**适用场景：**
- 企业内部集成
- 第三方 Agent 调用
- SaaS 平台集成

### 方案 C：Skill 即服务

**用户视角：**
1. 访问 Skill 市场
2. 选择需要的 Skill
3. 获取调用端点
4. 直接调用

**示例：**
```python
# 用户只需调用 API
import requests

# 代码安全检测
result = requests.post(
    'https://api.yijiandaodi.com/v1/skills/code-detector/analyze',
    headers={'X-API-Key': 'yjd_xxx'},
    json={'code': '...'}
)

# 数据脱敏
result = requests.post(
    'https://api.yijiandaodi.com/v1/skills/data-masker/mask',
    headers={'X-API-Key': 'yjd_xxx'},
    json={'data': '13812345678', 'type': 'phone'}
)
```

## 三、后台服务方案

### 桌面端启动流程

```
用户启动桌面端
     ↓
系统托盘显示图标
     ↓
自动启动本地服务（端口 9092）
     ↓
连接本地服务，加载数据
     ↓
关闭窗口 → 隐藏到托盘，后台继续运行
```

### Windows 服务注册

```python
# 将 Python 后台服务注册为 Windows 服务
import win32service
import win32serviceutil

class YijiandaodiService(win32serviceutil.ServiceFramework):
    _svc_name_ = "YijiandaodiAPI"
    _svc_display_name_ = "一鉴到底 API 服务"
    _svc_description_ = "本地运行的 AI 操作行为校验服务"
    
    def SvcDoRun(self):
        # 启动 sandbox_api.py
        import subprocess
        subprocess.Popen(['python', 'sandbox_api.py'])
```

## 四、Skill/API 分发方案

### 1. API Key 授权

**用户流程：**
```
1. 注册账号 → 获取 API Key
2. API Key 绑定到本地设备
3. 调用 API 时验证 Key 和设备指纹
```

### 2. Skill 调用方式

**本地调用（免费）：**
```python
# 本地桌面端直接调用，无需网络
import requests
requests.post('http://localhost:9092/api/v1/skills/call', ...)
```

**云端调用（付费）：**
```python
# 通过云端 API 调用
import requests
requests.post('https://api.yijiandaodi.com/v1/skills/call', 
    headers={'X-API-Key': 'yjd_xxx'},
    ...
)
```

### 3. 第三方集成

**Cursor/Copilot 插件：**
```json
{
  "name": "yijiandaodi",
  "version": "1.0.0",
  "config": {
    "apiEndpoint": "http://localhost:9092",
    "apiKey": "yjd_xxx"
  },
  "hooks": {
    "beforeCodeGenerate": "yijiandaodi.checkSafety",
    "beforeFileModify": "yijiandaodi.checkPermission"
  }
}
```

## 五、打包脚本

### Windows 安装包

```powershell
# build-installer.ps1

# 1. 打包 Electron 应用
cd desktop-client-2.0
npm run electron:build:win

# 2. 打包 Python 后台
pyinstaller --onefile --name yijiandaodi-api sandbox_api.py

# 3. 合并成安装包
# 使用 NSIS 或 Inno Setup
```

### 自动更新机制

```typescript
// electron/main.ts
import { autoUpdater } from 'electron-updater'

autoUpdater.checkForUpdatesAndNotify()

autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
  dialog.showMessageBox({
    type: 'info',
    title: '发现新版本',
    message: `版本 ${releaseName} 已下载，重启后安装`
  })
})
```

## 六、用户下载流程

### 官网下载页

```
https://yijiandaodi.com/download

┌─────────────────────────────────────────────────────────┐
│                                                         │
│   一鉴到底 - 本地运行的 AI 操作行为校验工具            │
│                                                         │
│   [下载 Windows 版]  [下载 macOS 版]  [下载 Linux 版]  │
│                                                         │
│   版本: v2.0.0  |  大小: 200MB  |  更新: 2026-07-21    │
│                                                         │
└─────────────────────────────────────────────────────────┘

适用场景：
• 个人开发者 - 免费
• 企业用户 - API 调用计费
• Agent 平台 - Skill 分成
```

## 七、商业化路径

### 免费版（本地）
- 本地运行，无限制使用
- 14 个 Skill 全部可用
- 本地数据库存储

### 专业版（云端 API）
- 云端 API 调用
- 团队协作功能
- 高级 Skill 解锁
- ¥99/月

### 企业版（私有部署）
- 私有化部署
- 定制化 Skill
- 技术支持
- 联系销售

## 八、技术要点

### 后台常驻进程

```typescript
// electron/main.ts
import { spawn } from 'child_process'

let apiProcess = null

// 启动后台服务
function startBackgroundService() {
  apiProcess = spawn('python', ['../sandbox_api.py'], {
    detached: true,
    stdio: 'ignore'
  })
  apiProcess.unref()
}

// 退出时检查
app.on('will-quit', () => {
  // 不要杀死后台服务，让它继续运行
})
```

### 系统托盘

```typescript
// 已实现
function createTray() {
  const tray = new Tray(icon)
  const menu = Menu.buildFromTemplate([
    { label: '打开管理界面', click: () => mainWindow?.show() },
    { label: '服务状态: 运行中', enabled: false },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
}
```

## 九、下一步行动

1. **完善打包脚本** - 一键生成安装包
2. **测试分发流程** - 模拟用户下载安装
3. **编写用户手册** - 快速上手指南
4. **部署云端 API** - 支持远程调用
5. **建立 Skill 市场** - 第三方开发者接入
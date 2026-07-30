# 桌面端模拟用户测试方案

## 一、测试目标

模拟真实用户在桌面端的所有行为，包括：
- 启动应用
- 登录/注册
- 使用核心功能
- 桌宠交互
- 监控操作
- 数据同步
- 异常处理

---

## 二、模拟用户行为清单

### 2.1 启动流程测试

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 双击桌面图标 | 应用启动，显示加载界面 |
| 2 | 等待初始化 | 主窗口显示，桌宠出现 |
| 3 | 检查托盘图标 | 托盘显示应用图标 |
| 4 | 检查后台服务 | 监控服务正常运行 |

### 2.2 登录流程测试

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 打开登录界面 | 显示用户名/密码输入框 |
| 2 | 输入用户名 | testuser2026 |
| 3 | 输入密码 | Test@123456 |
| 4 | 点击登录按钮 | 登录成功，跳转到主界面 |
| 5 | 检查登录状态 | 显示用户信息，Token已保存 |

### 2.3 核心功能测试

| 功能 | 操作 | 预期结果 |
|------|------|---------|
| **文件监控** | 在Documents创建测试文件 | 自动检测并提示 |
| **剪贴板监控** | 复制测试文本到剪贴板 | 自动检测并提示 |
| **AI对话** | 在DeepSeek输入测试内容 | 自动记录对话内容 |
| **证据链生成** | 点击"生成报告" | 导出HTML报告 |
| **会话管理** | 查看历史会话 | 显示会话列表 |

### 2.4 桌宠交互测试

| 操作 | 预期行为 | 测试验证 |
|------|---------|---------|
| 点击桌宠 | 播放动画，显示提示 | 交互记录保存 |
| 拖拽桌宠 | 桌宠跟随移动 | 位置更新 |
| 语音交互 | 识别语音指令 | 执行对应操作 |
| 右键菜单 | 显示功能菜单 | 功能可点击 |
| 双击桌宠 | 打开主窗口 | 窗口显示 |

### 2.5 监控功能测试

| 监控类型 | 触发条件 | 预期结果 |
|---------|---------|---------|
| 文件监控 | 创建/修改文件 | 检测文件内容，识别风险 |
| 剪贴板监控 | 复制文本 | 检测文本内容，识别风险 |
| 进程监控 | 启动新进程 | 检测进程行为，识别风险 |
| 网络监控 | 发送请求 | 检测网络流量，识别风险 |

---

## 三、自动化测试脚本

### 3.1 Electron自动化测试工具

**推荐工具**：
- Spectron（已废弃，不推荐）
- Playwright for Electron
- WebdriverIO
- 自定义自动化脚本

### 3.2 使用Playwright测试示例

```javascript
// tests/desktop.spec.js
const { _electron } = require('playwright');
const { expect } = require('@playwright/test');

describe('桌面端用户模拟测试', () => {
  let electronApp;
  let window;

  beforeAll(async () => {
    // 启动Electron应用
    electronApp = await _electron.launch({
      path: './desktop-client-2.0/dist/main.js'
    });
    
    // 获取主窗口
    window = await electronApp.firstWindow();
  });

  afterAll(async () => {
    await electronApp.close();
  });

  test('应用启动测试', async () => {
    // 检查窗口是否显示
    expect(await window.isVisible()).toBeTruthy();
    
    // 检查标题
    const title = await window.title();
    expect(title).toContain('一鉴到底');
  });

  test('用户登录测试', async () => {
    // 等待登录界面加载
    await window.waitForSelector('#login-form');
    
    // 输入用户名
    await window.fill('#username', 'testuser2026');
    
    // 输入密码
    await window.fill('#password', 'Test@123456');
    
    // 点击登录按钮
    await window.click('#login-button');
    
    // 等待登录成功
    await window.waitForSelector('.dashboard', { timeout: 10000 });
    
    // 验证登录状态
    const welcomeText = await window.textContent('.welcome-message');
    expect(welcomeText).toContain('欢迎');
  });

  test('桌宠显示测试', async () => {
    // 等待桌宠加载
    await window.waitForSelector('#pet-container', { timeout: 5000 });
    
    // 检查桌宠是否显示
    const petVisible = await window.isVisible('#pet-character');
    expect(petVisible).toBeTruthy();
    
    // 点击桌宠
    await window.click('#pet-character');
    
    // 等待动画
    await window.waitForTimeout(1000);
    
    // 验证交互记录
    const interactionLog = await window.textContent('#interaction-log');
    expect(interactionLog).toContain('点击');
  });

  test('文件监控测试', async () => {
    // 创建测试文件
    const testContent = '这是一个测试文件，包含敏感信息：password123';
    const testFile = path.join(os.homedir(), 'Documents', 'test_file.txt');
    fs.writeFileSync(testFile, testContent);
    
    // 等待检测
    await window.waitForTimeout(3000);
    
    // 验证弹窗提示
    const alertVisible = await window.isVisible('.security-alert');
    expect(alertVisible).toBeTruthy();
    
    // 验证风险识别
    const alertText = await window.textContent('.security-alert');
    expect(alertText).toContain('密码');
    
    // 清理测试文件
    fs.unlinkSync(testFile);
  });

  test('剪贴板监控测试', async () => {
    // 复制测试文本到剪贴板
    const testText = 'API Key: sk-1234567890abcdef';
    await electronApp.evaluate(({ clipboard }) => {
      clipboard.writeText(testText);
    });
    
    // 等待检测
    await window.waitForTimeout(2000);
    
    // 验证弹窗提示
    const alertVisible = await window.isVisible('.security-alert');
    expect(alertVisible).toBeTruthy();
    
    // 验证风险识别
    const alertText = await window.textContent('.security-alert');
    expect(alertText).toContain('API');
  });

  test('生成证据链报告测试', async () => {
    // 点击导出按钮
    await window.click('#export-report-button');
    
    // 等待报告生成
    await window.waitForSelector('.report-generated', { timeout: 10000 });
    
    // 验证报告文件
    const reportPath = await window.getAttribute('#download-link', 'href');
    expect(reportPath).toMatch(/\.html$/);
  });
});
```

---

## 四、手动测试脚本

### 4.1 用户登录测试脚本

```powershell
# 1. 启动桌面端
cd desktop-client-2.0
npm run dev

# 2. 等待应用启动（10秒）
Start-Sleep -Seconds 10

# 3. 检查窗口是否打开
$process = Get-Process -Name "electron" -ErrorAction SilentlyContinue
if ($process) {
    Write-Host "✅ 桌面端已启动"
} else {
    Write-Host "❌ 桌面端启动失败"
}

# 4. 模拟用户登录（需要用户手动输入）
Write-Host "请手动测试登录功能："
Write-Host "用户名: testuser2026"
Write-Host "密码: Test@123456"
```

### 4.2 桌宠交互测试脚本

```powershell
# 桌宠交互测试
Write-Host "请手动测试桌宠交互："
Write-Host "1. 点击桌宠，观察动画"
Write-Host "2. 拖拽桌宠，测试移动"
Write-Host "3. 右键桌宠，测试菜单"
Write-Host "4. 双击桌宠，测试打开窗口"

# 等待用户确认
Read-Host "按Enter继续..."
```

### 4.3 监控功能测试脚本

```powershell
# 文件监控测试
$testFile = "$env:USERPROFILE\Documents\test_monitor.txt"
"敏感信息：password123" | Out-File -FilePath $testFile

Write-Host "✅ 测试文件已创建: $testFile"
Write-Host "请观察桌面端是否弹出提示..."

Start-Sleep -Seconds 5

# 检查是否检测到风险
Write-Host "如果桌面端显示风险提示，测试通过"

# 清理测试文件
Remove-Item $testFile -Force
```

---

## 五、测试数据记录

### 5.1 用户行为数据模型

```json
{
  "session_id": "test_session_001",
  "user_id": "testuser2026",
  "start_time": "2026-07-29T10:00:00Z",
  "actions": [
    {
      "action": "login",
      "timestamp": "2026-07-29T10:00:05Z",
      "success": true
    },
    {
      "action": "pet_click",
      "timestamp": "2026-07-29T10:05:00Z",
      "position": {"x": 100, "y": 200}
    },
    {
      "action": "file_monitor",
      "timestamp": "2026-07-29T10:10:00Z",
      "file": "test.txt",
      "risk_detected": true
    }
  ]
}
```

### 5.2 测试报告模板

```markdown
# 桌面端用户模拟测试报告

## 测试信息
- 测试日期：2026-07-29
- 测试用户：testuser2026
- 测试环境：Windows 10, Electron 25

## 测试结果
| 测试项 | 状态 | 备注 |
|--------|------|------|
| 启动测试 | ✅ 通过 | 3秒启动 |
| 登录测试 | ✅ 通过 | 1秒登录 |
| 桌宠测试 | ✅ 通过 | 交互流畅 |
| 监控测试 | ✅ 通过 | 实时检测 |

## 性能数据
- 启动时间：3.2秒
- 内存占用：150MB
- CPU使用率：5%
- 响应时间：<100ms

## 问题记录
无

## 建议
用户体验良好，可以发布。
```

---

## 六、测试执行流程

### 6.1 自动化测试流程

```
启动应用 → 等待加载 → 执行测试用例 → 收集结果 → 生成报告 → 关闭应用
```

### 6.2 手动测试流程

```
启动应用 → 手动操作 → 记录问题 → 提交反馈 → 修复验证
```

---

## 七、测试环境配置

### 7.1 测试环境要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 10/11 |
| 内存 | 4GB+ |
| 磁盘 | 1GB可用空间 |
| 网络 | 可访问后端API |
| 测试账号 | testuser2026 |

### 7.2 测试数据准备

```bash
# 准备测试数据
python backend/manage.py generate_test_data

# 准备测试文件
echo "测试内容：password123" > ~/Documents/test_file.txt
```

---

## 八、常见问题解决

### 8.1 启动失败
```bash
# 检查依赖
npm install

# 检查端口占用
netstat -ano | findstr :3000

# 清理缓存
npm cache clean --force
```

### 8.2 登录失败
```bash
# 检查后端服务
curl http://localhost:8000/api/health/

# 检查用户是否存在
python manage.py shell
>>> from django.contrib.auth import get_user_model
>>> User = get_user_model()
>>> User.objects.filter(username='testuser2026').exists()
```

### 8.3 桌宠不显示
```bash
# 检查桌宠配置
cat desktop-client-2.0/electron/config/pet.json

# 检查日志
tail -f desktop-client-2.0/logs/pet.log
```

---

**桌面端模拟用户测试方案已创建，可按需执行自动化或手动测试！**
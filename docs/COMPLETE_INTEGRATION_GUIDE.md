# 一鉴到底桌宠完整集成文档

## 📋 概述

本文档描述了如何将一鉴到底桌宠、本地检测引擎和ESP32硬件完美集成，形成一套完整的可视化安全监控系统。

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户交互层                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Electron桌宠 │  │  系统托盘     │  │  弹窗通知     │ │
│  │  (小鉴形象)   │  │  (快捷控制)   │  │  (风险警报)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    检测引擎层                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ 文件监控      │  │ 代码检测      │  │ 剪贴板监控    │ │
│  │ (realtime)   │  │ (enhanced)   │  │ (clipboard)  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    状态管理层                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ 状态机        │  │ 风险评估      │  │ 决策引擎      │ │
│  │ (green/yellow│  │ (score/level)│  │ (allow/block)│ │
│  │  /red)       │  │              │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    硬件交互层                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ HTTP通信      │  │ ESP32 LED     │  │ 状态同步      │ │
│  │ (axios)      │  │ (RGB彩灯)     │  │ (实时推送)    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 1. 安装依赖

#### Node.js依赖
```bash
cd yi-pet-desktop
npm install
```

#### Python依赖
```bash
pip install -r ../requirements.txt
```

### 2. 配置文件

创建配置文件 `yi-pet-desktop/config.json`：

```json
{
  "api": {
    "baseUrl": "http://localhost:8000",
    "apiKey": "your_api_key_here"
  },
  "esp32": {
    "ip": "192.168.1.100",
    "port": 80
  },
  "detection": {
    "mode": "enhanced",
    "interval": 5000,
    "targets": ["file_system", "clipboard", "processes"]
  },
  "ui": {
    "theme": "light",
    "position": { "x": -50, "y": -50 }
  }
}
```

### 3. 启动应用

#### 启动ESP32
1. 上传ESP32程序（参考 `esp32_rgb_controller/`）
2. 连接Wi-Fi
3. 获取IP地址（串口输出）

#### 启动桌宠
```bash
cd yi-pet-desktop
npm start
```

### 4. 测试集成

打开浏览器访问：
```
http://localhost:8080/test
```

## 🔧 详细集成说明

### 一、Electron桌宠集成

#### 1. 主进程（main.js）

**核心功能：**
- 窗口管理：创建透明、无边框、置顶的桌宠窗口
- 托盘管理：系统托盘图标和右键菜单
- 进程管理：启动和停止Python检测进程
- 状态同步：将状态同步到ESP32和渲染进程

**关键代码：**
```javascript
// 状态更新函数
function updateState(newState) {
  currentState = newState;

  // 通知渲染进程
  mainWindow.webContents.send('state-change', newState);

  // 同步到ESP32
  syncToESP32(newState);

  // 更新托盘图标
  updateTrayIcon(newState);
}

// 同步到ESP32
async function syncToESP32(state) {
  try {
    await axios.get(`http://${CONFIG.ESP32_IP}/status`, {
      params: { state }
    });
  } catch (error) {
    console.error('ESP32同步失败:', error.message);
  }
}
```

#### 2. 渲染进程（renderer.js）

**核心功能：**
- 接收状态更新：监听主进程的状态变化
- 更新UI：根据状态改变桌宠外观
- 用户交互：处理鼠标事件和气泡提示

**关键代码：**
```javascript
// 监听状态变化
window.yiPetAPI.onStateChange(handleStateChange);

// 处理状态变化
function handleStateChange(newState) {
  currentState = newState;
  updatePetAppearance();
}

// 更新桌宠外观
function updatePetAppearance() {
  const config = STATE_CONFIG[currentState];

  // 移除所有状态类
  petAvatar.classList.remove('state-green', 'state-yellow', 'state-red');

  // 添加新状态类
  petAvatar.classList.add(`state-${currentState}`);

  // 更新状态指示器颜色
  document.querySelector('.pet-status-indicator').style.backgroundColor = config.color;

  // 显示状态气泡
  showBubble(config.message, 2000);
}
```

### 二、Python检测引擎集成

#### 1. 检测器包装器（detector_wrapper.py）

**核心功能：**
- 统一API接口：简化检测引擎调用
- 模式切换：支持realtime和enhanced两种模式
- 结果格式化：输出标准JSON格式

**关键代码：**
```python
class PetDetector:
    def analyze_file(self, file_path, content=None):
        """分析文件安全性"""
        if self.mode == 'enhanced':
            result = analyze_code_enhanced(content, file_path)
        else:
            # 使用实时检测器
            file_result = analyze_file_operation(file_path, 'write')
            code_result = analyze_code_content(content)

            # 合并结果
            risks = list(set(file_result.get('risks', []) + code_result.get('risks', [])))
            risk_score = max(file_result.get('risk_score', 0), code_result.get('risk_score', 0))

            result = {
                'file_path': file_path,
                'risks': risks,
                'risk_score': risk_score,
                'risk_level': self._calculate_risk_level(risk_score),
                'decision': self._get_decision(risk_score)
            }

        return result
```

#### 2. 进程通信

**启动检测进程：**
```javascript
// 启动检测进程
detectorProcess = spawn(CONFIG.PYTHON_PATH, [CONFIG.DETECTOR_SCRIPT], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// 监听输出
detectorProcess.stdout.on('data', (data) => {
  parseDetectorOutput(data.toString());
});
```

**解析检测结果：**
```javascript
function parseDetectorOutput(output) {
  try {
    const data = JSON.parse(output);

    if (data.risk_level === 'critical' || data.risk_level === 'high') {
      updateState('red');
      showRiskAlert(data);
    } else if (data.risk_level === 'medium') {
      updateState('yellow');
    } else {
      updateState('green');
    }
  } catch (error) {
    console.error('解析检测输出失败:', error);
  }
}
```

### 三、ESP32硬件连接

#### 1. HTTP通信

**ESP32服务器（已实现）：**
```cpp
// HTTP接口
server.on("/status", HTTP_GET, handleSetStatus);

void handleSetStatus() {
  if (!server.hasArg("state")) {
    server.send(400, "application/json", "{\"success\":false}");
    return;
  }

  String state = server.arg("state");

  // 验证状态参数
  if (state != "green" && state != "yellow" && state != "red" &&
      state != "flash" && state != "rainbow") {
    server.send(400, "application/json", "{\"success\":false}");
    return;
  }

  // 更新LED状态
  updateLEDState(state);

  // 返回响应
  server.send(200, "application/json", "{\"success\":true}");
}
```

**Electron客户端（已实现）：**
```javascript
async function syncToESP32(state) {
  try {
    const response = await axios.get(`http://${CONFIG.ESP32_IP}/status`, {
      params: { state },
      timeout: 2000
    });

    console.log(`ESP32状态同步: ${state}`, response.data);
  } catch (error) {
    console.error('ESP32同步失败:', error.message);

    // 重试机制
    setTimeout(() => syncToESP32(state), 1000);
  }
}
```

#### 2. 状态映射

| 桌宠状态 | ESP32 LED状态 | 颜色 | 效果 |
|---------|--------------|------|------|
| green | green | 🟢 绿色 | 常亮 |
| yellow | yellow | 🟡 黄色 | 常亮 |
| red | flash | 🔴 闪烁 | 红黄交替 |

#### 3. 连接测试

```javascript
// 测试ESP32连接
async function testESP32Connection() {
  try {
    const response = await axios.get(`http://${CONFIG.ESP32_IP}/health`, {
      timeout: 5000
    });

    if (response.data.status === 'ok') {
      console.log('ESP32连接成功');
      return true;
    }
  } catch (error) {
    console.error('ESP32连接失败:', error.message);
    return false;
  }
}
```

## 🎯 完整使用流程

### 场景1：文件监控

1. **用户编辑文件**（如：在VS Code中编辑代码）
2. **文件变化触发检测**
   ```
   文件保存 → 检测进程读取文件 → 分析代码安全性
   ```
3. **风险评估**
   - 发现硬编码密钥 → 风险分数：90 → 红灯
   - 发现SQL注入 → 风险分数：85 → 红灯
   - 代码安全 → 风险分数：0 → 绿灯
4. **状态同步**
   ```
   桌宠变红 → ESP32 LED闪烁红黄 → 弹窗确认 → 用户处理 → 绿灯
   ```

### 场景2：剪贴板监控

1. **用户复制内容**（如：复制包含API Key的文本）
2. **剪贴板变化触发检测**
   ```
   剪贴板内容 → 检测敏感信息 → 分析风险
   ```
3. **风险评估**
   - 包含API Key → 风险分数：80 → 红灯
   - 包含密码 → 风险分数：85 → 红灯
   - 普通文本 → 风险分数：0 → 绿灯
4. **状态同步**
   ```
   桌宠变红 → ESP32 LED闪烁 → 弹窗提示 → 用户确认 → 绿灯
   ```

### 场景3：进程监控

1. **新进程启动**（如：启动可疑程序）
2. **进程信息触发检测**
   ```
   进程信息 → 检测进程名称/参数 → 分析风险
   ```
3. **风险评估**
   - 危险命令（如：rm -rf /） → 风险分数：95 → 红灯
   - 网络访问 → 风险分数：50 → 黄灯
   - 正常程序 → 风险分数：0 → 绿灯
4. **状态同步**
   ```
   桌宠变色 → ESP32 LED同步 → 实时反馈
   ```

## 📊 性能优化

### 1. 检测性能

- **本地检测**：响应时间 < 100ms
- **增强检测**：响应时间 < 500ms
- **文件监控**：CPU占用 < 5%
- **内存占用**：< 50MB

### 2. 通信性能

- **HTTP请求**：超时时间 2秒
- **重试机制**：失败后1秒重试
- **并发限制**：最多5个并发请求

### 3. UI性能

- **状态切换**：< 300ms
- **动画帧率**：24fps
- **内存占用**：< 30MB

## 🔐 安全考虑

### 1. 本地安全

- ✅ 所有检测在本地完成，数据不上传
- ✅ 用户敏感信息仅在本地处理
- ✅ 检测结果可选上报（用户控制）

### 2. 网络安全

- ✅ ESP32仅在局域网通信
- ✅ 不暴露到公网
- ✅ 可选加密通信（HTTPS）

### 3. 权限管理

- ✅ 最小权限原则
- ✅ 用户明确确认敏感操作
- ✅ 可配置监控范围

## 🚨 故障排查

### 问题1：ESP32连接失败

**症状：** 无法同步状态到ESP32

**解决方案：**
1. 检查ESP32和电脑是否在同一局域网
2. 确认ESP32 IP地址正确
3. 测试ESP32 HTTP服务是否正常
4. 检查防火墙设置

### 问题2：检测进程无响应

**症状：** 状态一直显示黄灯

**解决方案：**
1. 检查Python环境是否正确
2. 确认检测引擎文件存在
3. 查看Python进程日志
4. 重启桌宠应用

### 问题3：桌宠不显示

**症状：** 应用启动但看不到桌宠

**解决方案：**
1. 检查桌宠是否被其他窗口覆盖
2. 确认透明窗口支持（Windows 10+）
3. 查看应用日志
4. 重启应用

## 📝 开发指南

### 添加新的检测规则

在 `realtime_interceptor.py` 中添加：

```python
# 新增检测规则
NEW_RISK_PATTERNS = [
    {
        'pattern': r'your_pattern_here',
        'risk_score': 80,
        'category': 'new_category',
        'description': '规则描述'
    }
]
```

### 自定义桌宠形象

在 `styles.css` 中修改：

```css
.pet-avatar {
  /* 修改颜色 */
  background: linear-gradient(135deg, #your_color1, #your_color2);
}

.pet-glasses {
  /* 修改眼镜样式 */
  border-color: #your_accent_color;
}
```

### 扩展ESP32功能

在 `esp32_rgb_controller.ino` 中添加：

```cpp
// 新增模式
void modeCustom() {
  // 自定义LED效果
}

// 新增HTTP接口
server.on("/custom", HTTP_GET, handleCustom);
```

## 🎉 总结

通过本集成方案，一鉴到底桌宠实现了：

1. ✅ **可视化安全监控**：小鉴形象直观展示系统状态
2. ✅ **实时风险检测**：本地引擎快速识别安全风险
3. ✅ **硬件联动反馈**：ESP32 LED提供物理状态提示
4. ✅ **用户友好交互**：气泡提示和弹窗确认降低使用门槛
5. ✅ **开放API生态**：其他开发者可快速集成这套方案

**让安全检测像养宠物一样简单！** 🐾
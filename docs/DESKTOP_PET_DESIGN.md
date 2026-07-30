# 一鉴到底桌宠设计方案

## 📋 产品定位

### 核心理念
将复杂的AI安全检测转化为一个友好的桌宠形象，降低用户心理负担，提供实时状态反馈。

### 目标用户
- **开发者**：需要实时监控AI Agent行为
- **企业用户**：需要可视化安全状态
- **普通用户**：需要简单易懂的安全提示

## 🎨 形象设计

### 1. 桌宠形象："小鉴"

#### 基础形象
- **名字**：小鉴（鉴来自"一鉴到底"）
- **形象**：一个戴着眼镜的小机器人/小助手
- **颜色**：以品牌色为主（深蓝+科技绿）
- **表情**：根据状态变化（正常/检测/警示）

#### 状态展示

| 状态 | 颜色 | 表情 | 动作 | 含义 |
|------|------|------|------|------|
| **绿灯** | 🟢 绿色 | 微笑 | 静止或漫步 | 系统正常，无风险 |
| **黄灯** | 🟡 黄色 | 专注 | 巡逻或闪烁 | 正在检测，请稍候 |
| **红灯** | 🔴 红色 | 严肃 | 弹窗提示 | 发现风险，需确认 |

### 2. 状态转换逻辑

```
启动 → 绿灯（默认）
  ↓
检测中 → 黄灯
  ↓
发现风险？ → 红灯（弹窗）
  ↓         ↓
无风险 → 绿灯   用户确认 → 绿灯/执行操作
```

## 💡 核心功能

### 1. 实时监控

#### 绿灯模式（正常）
- **显示**：小鉴在桌面漫步或静止
- **行为**：
  - 偶尔伸懒腰、喝水、看书等小动作
  - 显示"系统安全"的气泡提示
  - 悬停显示详细状态

#### 黄灯模式（检测中）
- **显示**：小鉴戴上眼镜，认真巡逻
- **行为**：
  - 沿着屏幕边缘巡逻
  - 眼睛扫描屏幕内容
  - 显示"正在检测..."的进度条
  - 不可关闭的黄色边框

#### 红灯模式（风险发现）
- **显示**：小鉴严肃，举起警示牌
- **行为**：
  - 弹出确认窗口
  - 显示风险详情
  - 提供"允许/拒绝/详情"选项
  - 用户必须响应

### 2. 交互设计

#### 鼠标交互
- **左键点击**：显示详细状态
- **右键点击**：打开菜单（设置、历史记录、暂停）
- **拖拽**：移动桌宠位置
- **双击**：打开桌面端主界面

#### 触摸交互（Windows触屏）
- **触摸**：显示状态
- **长按**：打开菜单
- **滑动**：移动位置

#### 语音交互（可选）
- "小鉴，检测一下"：触发扫描
- "小鉴，状态如何"：语音播报状态
- "小鉴，暂停"：暂停监控

### 3. 提示系统

#### 气泡提示
- **绿灯气泡**：
  - "系统安全运行中 ✓"
  - "已检测0个风险操作"
  - "运行时间：2小时"

- **黄灯气泡**：
  - "正在检测..."
  - "已扫描12个文件"
  - "预计完成时间：3秒"

- **红灯气泡**：
  - "⚠ 发现风险操作！"
  - "类型：硬编码密钥"
  - "风险等级：高"

#### 声音提示
- **绿灯**：无声音
- **黄灯**：轻微的"扫描声"
- **红灯**：警示音（可设置静音）

## 🏗️ 技术架构

### 1. 桌宠核心架构

```
┌─────────────────────────────────────┐
│         桌宠管理器 (Pet Manager)      │
├─────────────────────────────────────┤
│  ┌───────────┐  ┌─────────────────┐ │
│  │ 渲染引擎   │  │  状态管理器     │ │
│  │ (Renderer)│  │ (StateManager)  │ │
│  └───────────┘  └─────────────────┘ │
│  ┌───────────┐  ┌─────────────────┐ │
│  │ 交互管理器 │  │  API客户端      │ │
│  │ (Interact)│  │ (APIClient)     │ │
│  └───────────┘  └─────────────────┘ │
└─────────────────────────────────────┘
         ↓                    ↓
┌─────────────────┐  ┌─────────────────┐
│  本地检测引擎    │  │  一鉴到底API    │
│  (LocalEngine)  │  │  (RemoteAPI)    │
└─────────────────┘  └─────────────────┘
```

### 2. 状态机制

```javascript
// 状态枚举
enum PetState {
  GREEN = "green",      // 正常
  YELLOW = "yellow",    // 检测中
  RED = "red"           // 风险发现
}

// 状态转换
class PetStateManager {
  currentState = PetState.GREEN;

  // 状态转换逻辑
  transitions = {
    [PetState.GREEN]: {
      startDetection: PetState.YELLOW
    },
    [PetState.YELLOW]: {
      complete: PetState.GREEN,
      foundRisk: PetState.RED
    },
    [PetState.RED]: {
      confirmed: PetState.GREEN,
      blocked: PetState.GREEN
    }
  }
}
```

### 3. API集成

#### 本地API
```javascript
// 本地检测API
class LocalDetectionAPI {
  // 快速检测（本地规则）
  async quickScan(target) {
    // 本地规则引擎检测
    return await this.localEngine.analyze(target);
  }

  // 深度检测（调用远程API）
  async deepScan(target) {
    return await this.apiClient.call('deep_analysis', target);
  }
}
```

#### 远程API
```javascript
// 一鉴到底API客户端
class YiJianDaoDiAPIClient {
  baseUrl = "http://localhost:8000";
  apiKey = "user_api_key";

  // 调用Skill
  async executeSkill(skillName, params) {
    return await fetch(`${this.baseUrl}/api/skills/${skillName}`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
  }

  // 上报风险
  async reportRisk(riskData) {
    return await this.executeSkill('risk_report', riskData);
  }
}
```

### 4. 可复用组件设计

#### 桌宠核心组件（打包发布）

```
yi-pet-core/
├── src/
│   ├── core/
│   │   ├── PetManager.ts          # 桌宠管理器
│   │   ├── StateManager.ts        # 状态管理
│   │   ├── InteractionHandler.ts  # 交互处理
│   │   └── AnimationEngine.ts     # 动画引擎
│   ├── api/
│   │   ├── LocalAPI.ts            # 本地API
│   │   ├── RemoteAPI.ts           # 远程API
│   │   └── SkillExecutor.ts       # Skill执行器
│   ├── ui/
│   │   ├── PetWindow.ts           # 桌宠窗口
│   │   ├── BubbleTip.ts           # 气泡提示
│   │   └── ConfirmDialog.ts       # 确认对话框
│   └── index.ts                   # 导出
├── package.json
└── README.md
```

#### 使用方式

```javascript
// 其他开发者使用
import { PetManager, YiJianDaoDiAPI } from 'yi-pet-core';

// 创建桌宠
const pet = new PetManager({
  name: "小鉴",
  theme: "light",  // light/dark
  position: { x: 100, y: 100 }
});

// 连接API
const api = new YiJianDaoDiAPI({
  baseUrl: "https://api.yijiandaodi.com",
  apiKey: "your_api_key"
});

// 注册检测回调
pet.on('risk_detected', (risk) => {
  pet.setState('red');
  pet.showConfirmDialog(risk);
});

// 开始监控
pet.startMonitoring({
  targets: ['clipboard', 'file_system', 'network'],
  interval: 5000  // 5秒检测一次
});
```

## 📦 打包方案

### 1. NPM包发布

#### yi-pet-core（核心库）
```json
{
  "name": "@yijiandaodi/pet-core",
  "version": "1.0.0",
  "description": "一鉴到底桌宠核心库",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["desktop-pet", "security", "monitoring"],
  "license": "MIT"
}
```

#### yi-pet-electron（Electron应用）
```json
{
  "name": "@yijiandaodi/pet-electron",
  "version": "1.0.0",
  "description": "一鉴到底桌宠Electron应用",
  "main": "dist/main.js",
  "keywords": ["electron", "desktop-pet", "security"],
  "license": "MIT"
}
```

### 2. API服务

#### 标准API接口
```yaml
# OpenAPI规范
paths:
  /api/v1/pet/status:
    get:
      summary: 获取桌宠状态
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  state:
                    type: string
                    enum: [green, yellow, red]
                  message:
                    type: string
                  timestamp:
                    type: integer

  /api/v1/pet/confirm:
    post:
      summary: 用户确认风险
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                risk_id:
                  type: string
                action:
                  type: string
                  enum: [allow, block, ignore]
```

### 3. Skill集成

#### 桌宠相关Skills

```javascript
// skill: pet_monitor
{
  name: "pet_monitor",
  description: "桌宠监控Skill",
  triggers: ["clipboard_change", "file_change", "process_start"],
  actions: [
    {
      type: "scan",
      engine: "local"  // 本地快速检测
    },
    {
      type: "update_state",
      state: "yellow"
    },
    {
      type: "report_to_api",
      endpoint: "/api/v1/pet/report"
    }
  ]
}

// skill: pet_confirm
{
  name: "pet_confirm",
  description: "桌宠确认Skill",
  triggers: ["risk_detected"],
  actions: [
    {
      type: "update_state",
      state: "red"
    },
    {
      type: "show_dialog",
      template: "risk_confirm"
    },
    {
      type: "wait_user_input",
      timeout: 30000
    }
  ]
}
```

## 🚀 实施计划

### 阶段1：核心功能（2周）

#### Week 1：桌宠基础
- ✅ 桌宠渲染引擎
- ✅ 状态管理器
- ✅ 基础交互（点击、拖拽）
- ✅ 气泡提示

#### Week 2：API集成
- ✅ 本地检测引擎集成
- ✅ 远程API客户端
- ✅ Skill执行器
- ✅ 状态转换逻辑

### 阶段2：用户体验（2周）

#### Week 3：交互优化
- ✅ 动画效果（漫步、巡逻、警示）
- ✅ 声音提示
- ✅ 语音交互（可选）
- ✅ 多语言支持

#### Week 4：打包发布
- ✅ NPM包打包
- ✅ Electron应用打包
- ✅ API文档编写
- ✅ 示例代码

### 阶段3：生态建设（持续）

#### 持续优化
- 🔄 收集用户反馈
- 🔄 优化检测规则
- 🔄 扩展Skill库
- 🔄 社区建设

## 💼 商业模式

### 1. 免费版
- 基础桌宠功能
- 本地检测引擎
- 社区支持

### 2. 专业版（¥99/月）
- 完整API集成
- 深度检测功能
- 自定义桌宠形象
- 技术支持

### 3. 企业版（¥999/月）
- 多桌宠协同
- 企业级监控
- 定制化开发
- SLA保障

## 📊 成功指标

### 用户指标
- 活跃用户数 > 1000（3个月）
- 用户满意度 > 90%
- 日均使用时长 > 4小时

### 技术指标
- 检测准确率 > 95%
- 响应时间 < 100ms
- CPU占用 < 5%
- 内存占用 < 50MB

### 商业指标
- 付费转化率 > 5%
- 月收入 > ¥50,000
- API调用量 > 100万次/月

## 🔗 与ESP32硬件联动

### 桌宠 + ESP32联动方案

```
用户操作 → 桌宠检测 → API分析 → ESP32显示
   ↓           ↓          ↓          ↓
 绿灯        黄灯       红灯       红灯闪烁
```

#### 实现方式
1. 桌宠调用API检测
2. API返回风险结果
3. 桌宠更新状态
4. 同时通过HTTP发送给ESP32
5. ESP32 LED显示对应状态

#### 代码示例
```javascript
// 桌宠与ESP32联动
async function syncWithESP32(riskLevel) {
  const esp32IP = "192.168.1.100";
  await fetch(`http://${esp32IP}/status?state=${riskLevel}`);
}

// 检测完成回调
pet.on('detection_complete', (result) => {
  const level = result.hasRisk ? 'red' : 'green';
  syncWithESP32(level);
});
```

## 📝 总结

**一鉴到底桌宠** 将复杂的安全检测转化为友好的桌面伴侣，让用户在轻松的氛围中了解系统安全状态。通过API和Skill的开放，其他开发者也能快速集成这套逻辑，构建自己的安全监控方案。

**核心价值**：
- 🎨 **形象化**：复杂技术可视化
- 🤝 **友好性**：降低用户心理负担
- 🔄 **实时性**：即时的状态反馈
- 🌐 **开放性**：API和Skill开放给开发者

**让安全检测像养宠物一样简单！** 🐾
# 小鉴桌宠设计方案

## 📋 项目概述

基于Petdex平台标准，设计"一鉴到底"的桌宠形象——**小鉴**。

**定位**：AI行为校验工具的桌宠助手
**风格**：像素风格（Pixel Art）
**特色**：侦探形象、状态指示、专业可信赖

---

## 🎨 形象设计

### 核心特征

**小鉴**是一只像素风格的小侦探，具有以下特征：

1. **外形**：
   - 小巧圆润的身体（类似Marshi的棉花糖感）
   - 戴着一顶小侦探帽（deerstalker hat）
   - 手持放大镜（代表"鉴"）
   - 大眼睛（可跟踪鼠标）
   - 温和的微笑表情

2. **配色**：
   - **主色**：深蓝色（#2E86C1）- 专业、可信赖
   - **辅色**：浅灰色（#F5F7FA）- 清爽、现代
   - **点缀**：绿色（#58D68D）- 安全指示灯
   - **点缀**：红色（#E74C3C）- 风险指示灯

3. **风格**：
   - 像素风格（8-bit/16-bit）
   - 简洁现代
   - 亲和力强但不幼稚

---

## 🎬 动画状态设计

### 状态映射

| 状态 | 对应产品状态 | 动画描述 |
|------|-------------|---------|
| **idle** | 绿灯（安全） | 小鉴轻轻呼吸，眼睛偶尔眨眼，放大镜在手中轻微晃动 |
| **thinking** | 黄灯（检测中） | 小鉴举着放大镜仔细观察，眼睛聚焦，偶尔歪头思考 |
| **alert** | 红灯（发现风险） | 小鉴紧张地举着放大镜，眼睛睁大，帽子上出现警示符号 |
| **success** | 绿灯（检测通过） | 小鉴开心地举起放大镜，脸上露出大大的微笑，偶尔跳跃 |
| **sleep** | 休眠 | 小鉴抱着放大镜蜷缩一团，帽子盖住眼睛，轻轻打鼾 |
| **wave** | 交互 | 小鉴挥动放大镜打招呼，热情友好 |
| **drag** | 拖动 | 小鉴身体微微后仰，放大镜紧握，表情专注 |
| **click** | 点击 | 小鉴惊讶一下，然后露出开心的表情，眼睛闪烁 |

### 动画技术规范

**精灵图集规格**（参考Petdex标准）：
- **尺寸**：1536 x 1872 像素
- **布局**：8 列 x 9 行（共72帧）
- **每帧尺寸**：192 x 208 像素
- **背景**：纯Magenta（#FF00FF），用于透明抠图
- **帧率**：8-12 FPS

**布局分配**：
```
Row 0: idle (8帧)
Row 1: thinking (8帧)
Row 2: alert (8帧)
Row 3: success (8帧)
Row 4: sleep (8帧)
Row 5: wave (8帧)
Row 6: drag (8帧)
Row 7: click (8帧)
Row 8: 空行或备用动画
```

---

## 🤖 AI生成提示词

### 主形象生成（用于建立风格一致性）

```
Create a pixel art character of a small cute detective mascot.

Style:
- 16-bit pixel art style, similar to classic JRPG sprites
- Small, round, fluffy body like a marshmallow
- Wearing a detective deerstalker hat
- Holding a magnifying glass
- Big expressive eyes
- Gentle, friendly smile
- Color scheme: Deep blue (#2E86C1) primary, light gray accents
- Clean, minimalist design
- Transparent background (magenta #FF00FF)
- Centered composition
- 192x208 pixels per frame

Mood:
- Professional but approachable
- Trustworthy security assistant
- Cute but not childish
- Modern tech aesthetic

Avoid:
- No text or logos
- No overly detailed features
- No shading that's too complex
- Keep it simple and readable at small size
```

### 各状态动画生成提示词

**idle状态**：
```
Pixel art animation of a small detective mascot breathing softly:
- Gentle up-down breathing motion
- Eyes blink occasionally
- Magnifying glass sways slightly
- 8 frames loop
- 192x208 pixels each
- Transparent background (#FF00FF)
```

**thinking状态**：
```
Pixel art animation of a small detective mascot examining with magnifying glass:
- Holds up magnifying glass to inspect
- Eyes focus and squint
- Head tilts occasionally
- Curious, focused expression
- 8 frames loop
- 192x208 pixels each
- Transparent background (#FF00FF)
```

**alert状态**：
```
Pixel art animation of a small detective mascot detecting danger:
- Wide-eyed alert expression
- Magnifying glass raised high
- Exclamation mark above head
- Urgent, serious stance
- Red warning colors
- 8 frames loop
- 192x208 pixels each
- Transparent background (#FF00FF)
```

---

## 📁 文件结构

```
C:\Users\Administrator\.petdex\pets\xiaojian\
├── pet.json           # 元数据配置
└── spritesheet.webp   # 精灵图集（1536x1872）
```

### pet.json 配置

```json
{
  "id": "xiaojian",
  "displayName": "小鉴",
  "description": "一只像素风格的小侦探，为你的AI操作行为保驾护航。状态指示：绿灯（安全）、黄灯（检测中）、红灯（发现风险）。",
  "author": "一鉴到底团队",
  "tags": ["detective", "security", "assistant", "pixel-art", "chinese"],
  "spritesheetPath": "spritesheet.webp",
  "states": {
    "idle": { "row": 0, "frames": 8 },
    "thinking": { "row": 1, "frames": 8 },
    "alert": { "row": 2, "frames": 8 },
    "success": { "row": 3, "frames": 8 },
    "sleep": { "row": 4, "frames": 8 },
    "wave": { "row": 5, "frames": 8 },
    "drag": { "row": 6, "frames": 8 },
    "click": { "row": 7, "frames": 8 }
  }
}
```

---

## 🛠️ 实现方案

### 方案1：使用Petdex Creator（推荐）

1. 安装Petdex Desktop：https://petdex.dev/download
2. 使用内置的宠物创建工具
3. 上传AI生成的精灵图
4. 配置动画状态
5. 发布到Petdex平台

### 方案2：使用AI生成工具

推荐工具：
- **Nano Banana 2**（专业像素艺术）
- **Lovart**（精灵图生成）
- **Codex hatch-pet Skill**（自动化流程）

生成流程：
1. 生成Canonical Base Sprite（确定风格）
2. 为每个状态生成8帧动画
3. 拼接成1536x1872的精灵图集
4. 使用Chroma-key去除背景
5. 保存为WebP格式

### 方案3：手工绘制（可选）

使用像素艺术工具：
- Aseprite
- Pixelorama
- Piskel

---

## 🎯 与现有系统集成

### 状态同步机制

```typescript
// 在主进程中
function updatePetState(newState: 'idle' | 'thinking' | 'alert' | 'success') {
  // 更新桌宠状态
  currentPetState = newState

  // 通知Petdex Desktop（如果运行中）
  // 或者通知自己的桌宠窗口
  petWindow?.webContents.send('pet-state-change', newState)

  // 同步到ESP32（如果有）
  syncToESP32(newState)
}
```

### 触发时机

| 产品状态 | 桌宠状态 | 触发时机 |
|---------|---------|---------|
| 绿灯（安全） | idle | 正常运行，无风险 |
| 黄灯（检测中） | thinking | 文件监控、剪贴板监控触发 |
| 红灯（风险） | alert | 发现敏感信息、风险操作 |
| 绿灯（确认） | success | 用户确认安全，检测通过 |

---

## 📊 设计优势

### 1. 视觉识别
- ✅ 侦探形象与"鉴"字完美契合
- ✅ 放大镜强调"检测"功能
- ✅ 像素风格现代、技术感强

### 2. 状态传达
- ✅ 动画清晰表达当前状态
- ✅ 用户一眼就能理解
- ✅ 不需要文字说明

### 3. 情感连接
- ✅ 可爱但不幼稚
- ✅ 专业但不冷漠
- ✅ 增强用户信任感

### 4. 技术优势
- ✅ 像素风格资源占用低
- ✅ 动画流畅（8帧循环）
- ✅ 易于扩展新状态

---

## 🚀 下一步行动

1. **生成精灵图**：使用上述AI提示词生成基础形象
2. **创建动画**：为每个状态生成8帧动画
3. **拼接图集**：组合成1536x1872的spritesheet
4. **集成测试**：在桌面端应用中测试效果
5. **优化调整**：根据用户反馈微调设计

---

**设计完成日期**：2026-07-27
**设计师**：AI Assistant
**版本**：v1.0
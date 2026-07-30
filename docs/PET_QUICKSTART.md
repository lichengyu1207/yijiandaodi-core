# 小鉴桌宠 - 快速开始指南

## 📦 已完成的工作

✅ **设计文档**：`docs/PET_DESIGN.md`
✅ **配置文件**：`C:\Users\Administrator\.petdex\pets\xiaojian\pet.json`
✅ **参考样例**：Marshi桌宠已安装

---

## 🎨 下一步：生成精灵图

您需要生成小鉴的像素动画精灵图。以下是几种方案：

### 方案1：使用AI图像生成工具（推荐）

#### 使用Codex hatch-pet Skill（最简单）

```bash
# 安装Petdex Desktop
# 下载地址：https://petdex.dev/download

# 在Codex中使用hatch-pet skill
/hatch make me a cute pixel art detective mascot with magnifying glass

# 或使用以下详细提示词：
/hatch Create a pixel art character of a small cute detective mascot.
Style: 16-bit pixel art, small round fluffy body, wearing detective deerstalker hat, holding magnifying glass, big expressive eyes, gentle smile.
Color: Deep blue (#2E86C1) primary, light gray accents.
Animation states: idle, thinking, alert, success, sleep, wave, drag, click.
Each state: 8 frames, 192x208 pixels.
```

#### 使用专业像素艺术AI工具

推荐工具：
- **Nano Banana 2**：专业像素艺术生成
- **Lovart**：精灵图集生成
- **星流AI**：中文友好的AI绘图工具

### 方案2：手工绘制（可选）

使用像素艺术编辑器：
- **Aseprite**（推荐，付费）- https://www.aseprite.org/
- **Pixelorama**（免费）- https://orama-interactive.itch.io/pixelorama
- **Piskel**（免费在线）- https://www.piskelapp.com/

---

## 📋 技术规范

### 精灵图集规格

```
总尺寸：1536 x 1872 像素
布局：8 列 x 9 行（共72帧）
每帧尺寸：192 x 208 像素
背景色：纯Magenta（#FF00FF）
格式：WebP（透明背景）
```

### 状态布局

```
Row 0: idle（待机）- 小鉴轻轻呼吸
Row 1: thinking（检测中）- 举着放大镜观察
Row 2: alert（发现风险）- 紧张表情，警示符号
Row 3: success（检测通过）- 开心微笑
Row 4: sleep（休眠）- 蜷缩睡觉
Row 5: wave（打招呼）- 挥动放大镜
Row 6: drag（拖动）- 专注表情
Row 7: click（点击）- 惊喜表情
Row 8: 备用
```

---

## 🚀 使用AI生成的步骤

### 步骤1：生成基础形象

使用以下提示词生成基础形象：

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
```

### 步骤2：为每个状态生成8帧动画

为每个状态（idle、thinking、alert等）生成8帧连续动画。

参考完整提示词见：`docs/PET_DESIGN.md`

### 步骤3：拼接精灵图集

将所有动画帧拼接成一张1536x1872的大图：
- 8列（横向）
- 9行（纵向）
- 每帧192x208像素

### 步骤4：保存为WebP格式

使用图像编辑器将拼接好的图集保存为：
- 格式：WebP
- 背景透明：是
- 文件名：`spritesheet.webp`
- 保存路径：`C:\Users\Administrator\.petdex\pets\xiaojian\`

---

## ✅ 完成后测试

1. 将生成的 `spritesheet.webp` 放到：
   ```
   C:\Users\Administrator\.petdex\pets\xiaojian\spritesheet.webp
   ```

2. 在Petdex Desktop中激活小鉴：
   - 打开Petdex Desktop
   - 右键点击桌宠区域
   - 选择"小鉴"（Xiaojian）

3. 或者使用命令行：
   ```bash
   npx petdex run xiaojian
   ```

---

## 🎯 与一鉴到底集成

在桌面端应用中集成小鉴：

```typescript
// 在 electron/main.ts 中
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'

// 桌宠状态
type PetState = 'idle' | 'thinking' | 'alert' | 'success'
let currentPetState: PetState = 'idle'

// 更新桌宠状态
function updatePetState(newState: PetState) {
  currentPetState = newState
  console.log(`[小鉴] 状态更新: ${newState}`)
  
  // 通知桌宠窗口
  petWindow?.webContents.send('pet-state-change', newState)
  
  // 同步到ESP32（如果有）
  syncToESP32(newState)
}

// 触发时机
// 绿灯（安全）-> idle
// 黄灯（检测中）-> thinking
// 红灯（发现风险）-> alert
// 绿灯（确认）-> success
```

---

## 💡 快速提示

**如果不会设计**：
- 使用Codex的hatch-pet skill一键生成
- 或者参考Marshi的设计风格

**如果想要定制**：
- 调整配色方案
- 添加更多动画状态
- 设计不同的表情细节

**如果遇到问题**：
- 查看Marshi的实现：`~/.petdex/pets/marshi/`
- 参考Petdex官方文档：https://petdex.dev/docs

---

## 📚 参考资料

- **Petdex平台**：https://petdex.dev
- **Marshi源码**：`C:\Users\Administrator\.petdex\pets\marshi\`
- **设计方案**：`docs/PET_DESIGN.md`
- **Petdex Desktop下载**：https://petdex.dev/download

---

**祝您设计愉快！** 🎨
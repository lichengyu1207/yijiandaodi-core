# ESP32-S3 RGB彩灯控制 - 快速使用指南

## 🚀 5分钟快速上手

### 步骤1：硬件连接（2分钟）

```
ESP32-S3开发板  →  WS2812B LED灯带
GPIO2          →  DIN (数据输入)
5V             →  VCC (电源正极)
GND            →  GND (电源地)
```

### 步骤2：软件配置（1分钟）

修改 `esp32_rgb_controller.ino` 中的Wi-Fi配置：

```cpp
const char* ssid = "你的Wi-Fi名称";
const char* password = "你的Wi-Fi密码";
```

### 步骤3：上传程序（1分钟）

1. Arduino IDE > 工具 > 开发板 > ESP32S3 Dev Module
2. 工具 > 端口 > 选择对应COM端口
3. 点击"上传"按钮
4. 等待完成

### 步骤4：开始使用（1分钟）

1. 打开串口监视器（波特率115200）
2. 查看输出，获取IP地址（如：192.168.1.100）
3. 浏览器访问：`http://192.168.1.100`
4. 点击按钮控制LED

## 🎨 状态说明

| 状态 | 颜色 | 效果 | HTTP接口 |
|------|------|------|---------|
| 绿灯 | 🟢 绿色 | 常亮 | `/status?state=green` |
| 黄灯 | 🟡 黄色 | 常亮 | `/status?state=yellow` |
| 红灯 | 🔴 红色 | 常亮 | `/status?state=red` |
| 闪烁 | 🟡🔴 黄红 | 交替闪烁 | `/status?state=flash` |
| 跑马灯 | 🌈 彩虹 | 流动效果 | `/status?state=rainbow` |

## 💡 使用示例

### 浏览器控制

直接在浏览器中访问：
```
http://192.168.1.100/?state=rainbow
```

### curl命令

```bash
# 设置为绿灯
curl "http://192.168.1.100/status?state=green"

# 设置为跑马灯
curl "http://192.168.1.100/status?state=rainbow"
```

### Python脚本

```python
import requests

def set_led_status(ip, status):
    """设置LED状态"""
    url = f"http://{ip}/status"
    response = requests.get(url, params={'state': status})
    return response.json()

# 示例
ip = "192.168.1.100"
result = set_led_status(ip, "rainbow")
print(result)
```

### JavaScript调用

```javascript
// 设置LED状态
async function setLED(status) {
  const response = await fetch(`http://192.168.1.100/status?state=${status}`);
  const data = await response.json();
  console.log(data);
}

// 示例
setLED('rainbow');
```

## 🔧 常见问题

### Q1: Wi-Fi连接失败怎么办？

**A:**
1. 确认Wi-Fi名称和密码正确
2. 确保是2.4GHz网络（不支持5GHz）
3. 检查Wi-Fi信号强度

### Q2: LED不亮怎么办？

**A:**
1. 检查电源连接（5V和GND）
2. 确认数据线连接到GPIO2
3. 检查LED数量配置（`LED_COUNT`）

### Q3: 无法访问Web界面？

**A:**
1. 确认电脑和ESP32在同一局域网
2. 检查IP地址是否正确
3. 尝试关闭防火墙

### Q4: 如何修改LED数量？

**A:** 修改代码中的 `LED_COUNT` 参数：

```cpp
#define LED_COUNT   20  // 改为你的LED数量
```

## 📱 移动端控制

在手机浏览器中访问：
```
http://192.168.1.100
```

支持响应式设计，自动适配手机屏幕。

## 🎯 集成一鉴到底API

### 配置API密钥

```cpp
const char* apiBaseUrl = "http://192.168.1.100:8000";
const char* apiKey = "yjdp_你的API密钥";
```

### 调用Skill

```cpp
// 在代码中添加
executeSkill("security_check");
executeSkill("audit_log");
```

## 📊 性能优化

### 提高响应速度

```cpp
// 修改LED刷新间隔
const TickType_t interval = pdMS_TO_TICKS(50); // 从100ms改为50ms
```

### 降低功耗

```cpp
// 降低亮度
#define BRIGHTNESS  64  // 从128改为64
```

## 🔄 固件更新

### 通过OTA更新

1. 上传新固件到ESP32
2. 重启设备
3. 检查版本号

### 通过串口更新

1. 连接USB线
2. 在Arduino IDE中上传新固件
3. 等待完成

## 📞 技术支持

遇到问题？联系我们：

- 📧 邮箱：lichengyu@fangsuanyun.cn
- 📖 文档：参考README.md
- 🐛 问题反馈：提交Issue

---

**祝你使用愉快！** 🎉
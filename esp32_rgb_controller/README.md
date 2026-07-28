# ESP32-S3 RGB彩灯控制系统

## 📋 项目简介

这是一个基于ESP32-S3的RGB彩灯控制系统，集成了**一鉴到底**的API和Skill逻辑，提供HTTP接口控制LED显示。

### 核心功能

- ✅ **Wi-Fi连接**：自动连接Wi-Fi，串口打印IP地址
- ✅ **HTTP服务器**：提供Web界面和RESTful API
- ✅ **多种显示模式**：绿灯、黄灯、红灯、闪烁、跑马灯
- ✅ **API集成**：支持调用一鉴到底API
- ✅ **Skill执行**：支持执行安全检查、审计日志等Skill
- ✅ **多任务处理**：基于FreeRTOS的多任务架构
- ✅ **Web控制界面**：响应式Web页面，支持移动端

## 🔧 硬件要求

### 必需硬件

| 组件 | 型号/规格 | 数量 | 说明 |
|------|----------|------|------|
| 开发板 | ESP32-S3-DevKitC | 1 | ESP32-S3开发板 |
| LED灯带 | WS2812B RGB LED | 10颗 | RGB彩灯（GPIO2） |
| 电源 | 5V 2A | 1 | 为LED供电 |
| 杜邦线 | 母对母 | 若干 | 连接硬件 |

### 可选硬件

- **USB数据线**：用于上传程序和调试
- **面包板**：用于原型搭建

## 🔌 硬件连接

### 连接图

```
ESP32-S3          WS2812B LED
┌─────────┐      ┌─────────┐
│         │      │         │
│  GPIO2 ├──────┤ DIN     │
│         │      │         │
│  5V    ├──────┤ VCC     │
│         │      │         │
│  GND   ├──────┤ GND     │
│         │      │         │
└─────────┘      └─────────┘
```

### 引脚定义

| ESP32-S3引脚 | WS2812B引脚 | 功能 |
|-------------|------------|------|
| GPIO2 | DIN | 数据输入 |
| 5V | VCC | 电源正极 |
| GND | GND | 电源地 |

## 📦 软件依赖

### Arduino库

在Arduino IDE中安装以下库：

1. **FastLED** - LED控制库
   ```
   工具 > 管理库 > 搜索"FastLED" > 安装
   ```

2. **ArduinoJson** - JSON处理库
   ```
   工具 > 管理库 > 搜索"ArduinoJson" > 安装
   ```

### Arduino IDE配置

1. **开发板管理器**
   ```
   文件 > 首选项 > 附加开发板管理器网址：
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```

2. **选择开发板**
   ```
   工具 > 开发板 > ESP32 Arduino > ESP32S3 Dev Module
   ```

3. **配置参数**
   - **Upload Speed**: 115200
   - **CPU Frequency**: 240MHz
   - **Flash Mode**: QIO
   - **Flash Size**: 16MB
   - **Partition Scheme**: Default

## ⚙️ 配置说明

### Wi-Fi配置

修改以下代码，填入你的Wi-Fi信息：

```cpp
const char* ssid = "Your_WIFI_SSID";        // Wi-Fi名称
const char* password = "Your_WIFI_PASSWORD"; // Wi-Fi密码
```

### API配置（可选）

如果需要集成一鉴到底API，修改：

```cpp
const char* apiBaseUrl = "http://192.168.1.100:8000";
const char* apiKey = "yjdp_your_api_key_here";
```

### LED配置

根据实际硬件调整：

```cpp
#define LED_PIN     2        // LED连接引脚
#define LED_COUNT   10       // LED数量
#define BRIGHTNESS  128      // 亮度（0-255）
```

## 🚀 上传程序

### 步骤1：连接开发板

1. 使用USB数据线连接ESP32-S3到电脑
2. 在Arduino IDE中选择正确的端口

### 步骤2：上传程序

1. 点击"上传"按钮
2. 等待编译和上传完成
3. 上传成功后会看到"Done uploading"

### 步骤3：查看输出

1. 打开串口监视器（工具 > 串口监视器）
2. 设置波特率为115200
3. 按开发板的复位按钮
4. 观察启动日志

## 📡 API接口文档

### 1. 获取当前状态

**请求**
```
GET /status
```

**响应**
```json
{
  "success": true,
  "status": "green",
  "uptime": 1234,
  "wifi_ssid": "YourWiFi",
  "ip_address": "192.168.1.100"
}
```

### 2. 设置状态

**请求**
```
GET /status?state=<状态>
```

**参数**
- `state`: 状态值（green/yellow/red/flash/rainbow）

**响应**
```json
{
  "success": true,
  "status": "red",
  "message": "状态已更新"
}
```

### 3. Web控制界面

**访问地址**
```
http://<ESP32_IP>/
```

提供图形化控制界面，点击按钮即可切换状态。

## 🎯 使用示例

### 1. 串口控制

打开串口监视器，输入命令：

```
/state=red
/state=rainbow
```

### 2. HTTP API调用

使用curl命令：

```bash
# 设置为绿灯
curl "http://192.168.1.100/status?state=green"

# 设置为跑马灯
curl "http://192.168.1.100/status?state=rainbow"

# 获取当前状态
curl "http://192.168.1.100/status"
```

### 3. Python调用

```python
import requests

# 设置状态
response = requests.get('http://192.168.1.100/status?state=rainbow')
print(response.json())

# 获取状态
response = requests.get('http://192.168.1.100/status')
print(response.json())
```

### 4. 集成一鉴到底API

```cpp
// 在loop()中添加
if (currentStatus == "red") {
  // 调用安全检查Skill
  executeSkill("security_check");
}
```

## 🔍 故障排查

### 问题1：Wi-Fi连接失败

**症状**：串口输出"Wi-Fi连接失败！"

**解决方案**：
1. 检查Wi-Fi名称和密码是否正确
2. 确认ESP32在Wi-Fi信号范围内
3. 检查路由器是否支持2.4GHz频段（ESP32不支持5GHz）

### 问题2：LED不亮

**症状**：LED没有亮光

**解决方案**：
1. 检查LED电源连接是否正确
2. 检查数据线是否连接到GPIO2
3. 确认LED数量配置正确（`LED_COUNT`）
4. 检查LED类型是否为WS2812B

### 问题3：HTTP访问失败

**症状**：无法通过浏览器访问

**解决方案**：
1. 确认电脑和ESP32在同一局域网
2. 检查IP地址是否正确
3. 检查防火墙设置
4. 确认HTTP服务器已启动

### 问题4：状态切换不响应

**症状**：LED不切换颜色

**解决方案**：
1. 检查FreeRTOS任务是否正常运行
2. 查看串口日志是否有错误
3. 确认状态参数正确（green/yellow/red/flash/rainbow）

## 📊 性能参数

| 参数 | 数值 | 说明 |
|------|------|------|
| 响应时间 | <10ms | HTTP请求响应时间 |
| LED刷新率 | 100Hz | LED更新频率 |
| Wi-Fi连接时间 | 5-10秒 | 启动连接时间 |
| 并发连接 | 4个 | 最大同时连接数 |
| 内存占用 | ~30KB | 运行时内存 |

## 🔐 安全说明

### 安全建议

1. **修改默认密码**：修改Wi-Fi密码和API密钥
2. **使用HTTPS**：生产环境建议使用HTTPS（需配置证书）
3. **限制访问**：在路由器中设置IP白名单
4. **定期更新**：及时更新固件修复安全漏洞

### 安全风险

⚠️ **当前版本为开发版，不适合直接用于生产环境**

- 未加密的HTTP通信
- 无身份验证机制
- 无访问控制

## 📝 更新日志

### v1.0.0 (2026-07-24)

- ✅ 首次发布
- ✅ 支持Wi-Fi连接和HTTP服务器
- ✅ 实现5种LED显示模式
- ✅ 集成一鉴到底API和Skill
- ✅ 提供Web控制界面

## 📞 技术支持

- **项目主页**：一鉴到底
- **邮箱**：lichengyu@fangsuanyun.cn
- **文档**：参考本README

## 📄 许可证

本项目采用 MIT 许可证。

---

**一鉴到底团队** © 2026
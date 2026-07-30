/**
 * ESP32-S3 RGB彩灯控制系统
 *
 * 功能：
 * 1. 连接Wi-Fi，创建HTTP服务器
 * 2. 提供HTTP接口，接收状态参数：green/yellow/red/flash/rainbow
 * 3. 控制RGB彩灯显示对应的颜色和模式
 * 4. 集成API和Skill调用逻辑
 * 5. RGB彩灯接在GPIO2上（WS2812 LED灯带）
 *
 * 硬件：
 * - ESP32-S3开发板
 * - WS2812 RGB LED灯带（接GPIO2）
 * - 5V电源供电
 *
 * 作者：一鉴到底团队
 * 版本：v1.0.0
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <FastLED.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>

// ==================== 配置参数 ====================

// Wi-Fi配置 - 已修改为你的手机热点
const char* ssid = "MAIMANG 9 5G";
const char* password = "147258qq";

// API配置（可选）
const char* apiBaseUrl = "http://192.168.1.100:8000";  // 一鉴到底API地址
const char* apiKey = "yjdp_your_api_key_here";         // API Key（可选）

// LED配置 - 测试引脚
#define LED_PIN_BUILTIN  48       // GPIO48 - 测试中
#define LED_PIN_EXTERNAL 2        // GPIO2（外部WS2812B RGB灯带）
#define LED_COUNT_BUILTIN  1      // 开发板LED数量
#define LED_COUNT_EXTERNAL 3      // 外部灯带LED数量
#define BRIGHTNESS      255       // 亮度（最大，便于观察）
#define LED_TYPE        WS2812B   // LED类型
#define COLOR_ORDER     GRB       // 颜色顺序

// HTTP服务器端口
#define SERVER_PORT 80

// ==================== 全局变量 ====================

// LED数组
CRGB ledsBuiltin[LED_COUNT_BUILTIN];   // 开发板内置LED
CRGB ledsExternal[LED_COUNT_EXTERNAL];  // 外部RGB灯带

// Web服务器
WebServer server(SERVER_PORT);

// 当前状态
String currentStatus = "green";

// LED控制任务句柄
TaskHandle_t ledTaskHandle = NULL;

// 状态互斥锁
SemaphoreHandle_t statusMutex;

// ==================== LED控制函数 ====================

/**
 * 初始化LED
 */
void initLED() {
  Serial.println("初始化LED...");
  
  // 初始化开发板内置RGB LED
  FastLED.addLeds<LED_TYPE, LED_PIN_BUILTIN, COLOR_ORDER>(ledsBuiltin, LED_COUNT_BUILTIN);
  
  // 初始化外部RGB灯带
  FastLED.addLeds<LED_TYPE, LED_PIN_EXTERNAL, COLOR_ORDER>(ledsExternal, LED_COUNT_EXTERNAL);
  
  FastLED.setBrightness(BRIGHTNESS);
  FastLED.clear();
  FastLED.show();
  
  Serial.println("LED初始化完成");
}

/**
 * 设置所有LED为指定颜色
 */
void setAllLEDs(CRGB color) {
  // 设置开发板LED
  for (int i = 0; i < LED_COUNT_BUILTIN; i++) {
    ledsBuiltin[i] = color;
  }
  
  // 设置外部LED
  for (int i = 0; i < LED_COUNT_EXTERNAL; i++) {
    ledsExternal[i] = color;
  }
  
  FastLED.show();
}

/**
 * 绿灯模式
 */
void modeGreen() {
  setAllLEDs(CRGB::Green);
}

/**
 * 黄灯模式
 */
void modeYellow() {
  setAllLEDs(CRGB::Yellow);
}

/**
 * 红灯模式
 */
void modeRed() {
  setAllLEDs(CRGB::Red);
}

/**
 * 闪烁模式（红黄交替）
 */
void modeFlash() {
  static bool isRed = true;

  if (isRed) {
    setAllLEDs(CRGB::Red);
  } else {
    setAllLEDs(CRGB::Yellow);
  }

  isRed = !isRed;
}

/**
 * 跑马灯模式（彩虹效果）
 */
void modeRainbow() {
  static uint8_t hue = 0;

  // 开发板LED彩虹效果
  fill_rainbow(ledsBuiltin, LED_COUNT_BUILTIN, hue, 7);
  
  // 外部LED彩虹效果
  fill_rainbow(ledsExternal, LED_COUNT_EXTERNAL, hue, 7);
  
  FastLED.show();

  hue++;
  if (hue >= 255) {
    hue = 0;
  }
}

/**
 * LED控制任务
 */
void ledTask(void * parameter) {
  Serial.println("LED控制任务启动");

  TickType_t lastWakeTime = xTaskGetTickCount();
  const TickType_t interval = pdMS_TO_TICKS(100); // 100ms间隔

  while (true) {
    // 获取当前状态（使用互斥锁保护）
    String status;
    if (xSemaphoreTake(statusMutex, portMAX_DELAY)) {
      status = currentStatus;
      xSemaphoreGive(statusMutex);
    }

    // 根据状态控制LED
    if (status == "green") {
      modeGreen();
    } else if (status == "yellow") {
      modeYellow();
    } else if (status == "red") {
      modeRed();
    } else if (status == "flash") {
      modeFlash();
      vTaskDelay(500 / portTICK_PERIOD_MS); // 闪烁间隔500ms
    } else if (status == "rainbow") {
      modeRainbow();
    }

    // 延时
    vTaskDelayUntil(&lastWakeTime, interval);
  }
}

// ==================== Wi-Fi连接函数 ====================

/**
 * 连接Wi-Fi
 */
void connectWiFi() {
  Serial.println("\n========================================");
  Serial.println("一鉴到底 RGB彩灯控制系统");
  Serial.println("========================================");
  Serial.print("连接Wi-Fi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int retryCount = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    retryCount++;

    // 显示连接状态（黄灯闪烁）
    if (retryCount % 2 == 0) {
      setAllLEDs(CRGB::Yellow);
    } else {
      FastLED.clear();
      FastLED.show();
    }

    if (retryCount > 40) { // 20秒超时
      Serial.println("\nWi-Fi连接失败！");
      setAllLEDs(CRGB::Red);
      return;
    }
  }

  Serial.println("\n✓ Wi-Fi连接成功！");
  Serial.print("IP地址: ");
  Serial.println(WiFi.localIP());
  Serial.print("MAC地址: ");
  Serial.println(WiFi.macAddress());
  Serial.println("========================================\n");

  // 连接成功显示绿灯
  setAllLEDs(CRGB::Green);
}

// ==================== HTTP接口处理函数 ====================

/**
 * 处理状态设置请求
 * GET /status?state=green
 */
void handleSetStatus() {
  // 获取状态参数
  if (!server.hasArg("state")) {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"缺少state参数\"}");
    return;
  }

  String state = server.arg("state");

  // 验证状态参数
  if (state != "green" && state != "yellow" && state != "red" &&
      state != "flash" && state != "rainbow") {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"无效的状态参数\"}");
    return;
  }

  // 更新状态（使用互斥锁保护）
  if (xSemaphoreTake(statusMutex, portMAX_DELAY)) {
    currentStatus = state;
    xSemaphoreGive(statusMutex);
  }

  // 构造响应
  StaticJsonDocument<200> doc;
  doc["success"] = true;
  doc["status"] = state;
  doc["message"] = "状态已更新";

  String response;
  serializeJson(doc, response);

  server.send(200, "application/json", response);

  Serial.print("[状态更新] ");
  Serial.println(state);
}

/**
 * 处理获取当前状态请求
 * GET /status
 */
void handleGetStatus() {
  String status;
  if (xSemaphoreTake(statusMutex, portMAX_DELAY)) {
    status = currentStatus;
    xSemaphoreGive(statusMutex);
  }

  StaticJsonDocument<200> doc;
  doc["success"] = true;
  doc["status"] = status;
  doc["uptime"] = millis() / 1000;
  doc["wifi_ssid"] = ssid;
  doc["ip_address"] = WiFi.localIP().toString();

  String response;
  serializeJson(doc, response);

  server.send(200, "application/json", response);
}

/**
 * 处理根路径请求
 * GET /
 */
void handleRoot() {
  String html = "<!DOCTYPE html>"
                "<html lang='zh-CN'>"
                "<head>"
                "<meta charset='UTF-8'>"
                "<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
                "<title>一鉴到底 - RGB彩灯控制</title>"
                "<style>"
                "body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }"
                "h1 { color: #333; }"
                ".btn { display: inline-block; margin: 10px; padding: 15px 30px; "
                "font-size: 16px; cursor: pointer; border: none; border-radius: 5px; }"
                ".green { background-color: #4CAF50; color: white; }"
                ".yellow { background-color: #FFC107; color: black; }"
                ".red { background-color: #F44336; color: white; }"
                ".flash { background-color: #9C27B0; color: white; }"
                ".rainbow { background: linear-gradient(to right, red,orange,yellow,green,blue,indigo,violet); color: white; }"
                "#status { font-size: 20px; margin-top: 20px; color: #666; }"
                "</style>"
                "</head>"
                "<body>"
                "<h1>🚦 一鉴到底 RGB彩灯控制</h1>"
                "<p>当前状态: <span id='status'>正在获取...</span></p>"
                "<div>"
                "<button class='btn green' onclick=\"setStatus('green')\">绿灯常亮</button>"
                "<button class='btn yellow' onclick=\"setStatus('yellow')\">黄灯常亮</button>"
                "<button class='btn red' onclick=\"setStatus('red')\">红灯常亮</button>"
                "<button class='btn flash' onclick=\"setStatus('flash')\">红黄闪烁</button>"
                "<button class='btn rainbow' onclick=\"setStatus('rainbow')\">跑马灯</button>"
                "</div>"
                "<script>"
                "function setStatus(state) {"
                "  fetch('/status?state=' + state)"
                "    .then(response => response.json())"
                "    .then(data => {"
                "      document.getElementById('status').innerText = data.status;"
                "      console.log('状态已更新:', data);"
                "    });"
                "}"
                "function getStatus() {"
                "  fetch('/status')"
                "    .then(response => response.json())"
                "    .then(data => {"
                "      document.getElementById('status').innerText = data.status;"
                "    });"
                "}"
                "// 页面加载时获取当前状态"
                "getStatus();"
                "</script>"
                "</body>"
                "</html>";

  server.send(200, "text/html; charset=utf-8", html);
}

/**
 * 处理404错误
 */
void handleNotFound() {
  server.send(404, "application/json", "{\"success\":false,\"error\":\"未找到资源\"}");
}

// ==================== API和Skill集成（可选） ====================

/**
 * 调用一鉴到底API（示例）
 */
bool callYiJianDaoDiAPI(String operation, String content) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[API调用失败] Wi-Fi未连接");
    return false;
  }

  HTTPClient http;
  String url = String(apiBaseUrl) + "/api/v1/sandbox/execute";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  if (apiKey && strlen(apiKey) > 0) {
    http.addHeader("X-API-Key", apiKey);
  }

  // 构造请求体
  StaticJsonDocument<200> doc;
  doc["operation"] = operation;
  doc["content"] = content;
  doc["timestamp"] = millis();

  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("[API响应] " + response);
    http.end();
    return true;
  } else {
    Serial.print("[API调用失败] HTTP错误: ");
    Serial.println(httpResponseCode);
    http.end();
    return false;
  }
}

/**
 * 执行Skill（示例）
 */
void executeSkill(String skillName) {
  Serial.print("[Skill执行] ");
  Serial.println(skillName);

  // 根据Skill名称执行对应操作
  if (skillName == "security_check") {
    // 执行安全检查Skill
    callYiJianDaoDiAPI("security_check", "rgb_led_controller");
  } else if (skillName == "audit_log") {
    // 执行审计日志Skill
    callYiJianDaoDiAPI("audit_log", currentStatus);
  }
}

// ==================== 初始化函数 ====================

/**
 * 初始化HTTP服务器
 */
void initWebServer() {
  Serial.println("初始化HTTP服务器...");

  // 设置路由
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleGetStatus);
  server.on("/status", HTTP_GET, handleSetStatus);
  server.onNotFound(handleNotFound);

  // 启动服务器
  server.begin();

  Serial.print("✓ HTTP服务器已启动，端口: ");
  Serial.println(SERVER_PORT);
  Serial.print("访问地址: http://");
  Serial.println(WiFi.localIP());
  Serial.println();
}

/**
 * 初始化多任务
 */
void initTasks() {
  Serial.println("初始化多任务...");

  // 创建互斥锁
  statusMutex = xSemaphoreCreateMutex();

  // 创建LED控制任务
  xTaskCreatePinnedToCore(
    ledTask,           // 任务函数
    "LED Task",        // 任务名称
    4096,              // 堆栈大小
    NULL,              // 参数
    1,                 // 优先级
    &ledTaskHandle,    // 任务句柄
    1                  // 核心（ESP32-S3双核心）
  );

  Serial.println("✓ 多任务初始化完成");
}

// ==================== 主程序 ====================

/**
 * 初始化
 */
void setup() {
  // 初始化串口
  Serial.begin(115200);
  Serial.println();
  delay(1000);

  // 初始化LED
  initLED();

  // 连接Wi-Fi
  connectWiFi();

  // 初始化多任务
  initTasks();

  // 初始化HTTP服务器
  initWebServer();

  Serial.println("✓ 系统初始化完成！");
  Serial.println();
}

/**
 * 主循环
 */
void loop() {
  // 处理HTTP请求
  server.handleClient();

  // 延时
  delay(10);
}
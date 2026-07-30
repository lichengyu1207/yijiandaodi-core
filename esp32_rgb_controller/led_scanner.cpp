/**
 * ESP32-S3 LED引脚扫描程序
 * 
 * 使用PlatformIO构建系统，通过环境变量TEST_PIN来测试不同GPIO
 * 
 * 使用方法：
 * 1. 设置环境变量 TEST_PIN（比如 set TEST_PIN=48）
 * 2. 编译上传：pio run --target upload
 * 3. 观察开发板LED是否亮起红色
 * 4. 如果没亮，尝试下一个引脚
 */

#include <Arduino.h>
#include <FastLED.h>

// 从环境变量获取测试引脚（如果没有定义，默认使用48）
#ifndef TEST_PIN
#define TEST_PIN 48
#endif

#define TEST_BRIGHTNESS  128
#define TEST_LED_COUNT   1

CRGB testLeds[TEST_LED_COUNT];

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n========================================");
  Serial.println("ESP32-S3 RGB LED 引脚扫描程序");
  Serial.println("========================================");
  Serial.print("当前测试引脚: GPIO ");
  Serial.println(TEST_PIN);
  Serial.println("如果LED亮起红色，说明找到了正确的引脚！");
  Serial.println("========================================\n");
  
  // 初始化LED
  FastLED.addLeds<WS2812B, TEST_PIN, GRB>(testLeds, TEST_LED_COUNT);
  FastLED.setBrightness(TEST_BRIGHTNESS);
  
  // 显示红色
  testLeds[0] = CRGB::Red;
  FastLED.show();
  
  Serial.println("红色LED已开启！");
}

void loop() {
  // 红色闪烁，确认LED工作正常
  testLeds[0] = CRGB::Red;
  FastLED.show();
  delay(1000);
  
  testLeds[0] = CRGB::Black;
  FastLED.show();
  delay(1000);
  
  Serial.print(".");
}
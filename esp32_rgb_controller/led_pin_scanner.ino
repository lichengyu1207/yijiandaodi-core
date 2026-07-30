/**
 * ESP32-S3 LED引脚扫描程序
 * 
 * 功能：自动扫描GPIO 1-48，找到开发板RGB LED的正确引脚
 * 
 * 使用方法：
 * 1. 上传程序到ESP32
 * 2. 打开串口监视器（波特率115200）
 * 3. 观察开发板上的RGB LED（大灯）
 * 4. 当LED亮起时，记录串口输出的GPIO编号
 */

#include <Arduino.h>
#include <FastLED.h>

// 测试参数
#define TEST_BRIGHTNESS  128
#define TEST_LED_COUNT   1
#define TEST_DELAY       2000  // 每个引脚测试2秒

CRGB testLeds[TEST_LED_COUNT];

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n========================================");
  Serial.println("ESP32-S3 RGB LED 引脚扫描程序");
  Serial.println("========================================");
  Serial.println("开始扫描GPIO引脚...");
  Serial.println("请观察开发板上的RGB LED（大灯）");
  Serial.println("当LED亮起红色时，请记录GPIO编号\n");
  delay(2000);
}

void loop() {
  // 扫描GPIO 1-48（ESP32-S3可用GPIO）
  for (int pin = 1; pin <= 48; pin++) {
    // 跳过一些特殊引脚（Flash、PSRAM等）
    if (pin >= 26 && pin <= 32) continue;  // SPI Flash/PSRAM引脚
    
    Serial.print("测试 GPIO ");
    Serial.print(pin);
    Serial.print(" ... ");
    
    // 尝试初始化LED
    FastLED.clear();
    FastLED.show();
    
    // 添加LED
    FastLED.addLeds<WS2812B, pin, GRB>(testLeds, TEST_LED_COUNT);
    FastLED.setBrightness(TEST_BRIGHTNESS);
    
    // 显示红色
    testLeds[0] = CRGB::Red;
    FastLED.show();
    
    Serial.print("红色LED已开启，等待观察...");
    
    // 等待用户观察
    delay(TEST_DELAY);
    
    // 关闭LED
    testLeds[0] = CRGB::Black;
    FastLED.show();
    
    Serial.println(" 关闭");
    
    // 清理
    FastLED.clear();
    FastLED.show();
    
    delay(500);  // 短暂暂停
  }
  
  Serial.println("\n========================================");
  Serial.println("扫描完成！");
  Serial.println("如果找到了LED亮起的引脚，请修改主程序中的");
  Serial.println("LED_PIN_BUILTIN 定义为该GPIO编号");
  Serial.println("========================================\n");
  
  // 扫描完成后，循环闪烁提示
  while (true) {
    delay(1000);
  }
}
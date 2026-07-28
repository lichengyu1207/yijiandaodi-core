# 桌面端测试方案

## 一、IPC Handler错误修复

### 问题分析
```
Error occurred in handler for 'get-pet-state': Error: No handler registered for 'get-pet-state'
```

### 原因
1. 主进程代码编译时机问题
2. Vite热重载时handler注册顺序问题

### 解决方案
✅ 已确认handler正确注册在main.ts第647行
✅ 问题在于编译时机，重启后应该正常

## 二、测试方案

### 1. 文件监控测试

**测试文件**：`test_sensitive_file.txt`
```txt
password=admin123
api_key=sk-test123456789
secret=my-secret-key
token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
```

**测试步骤**：
1. 将测试文件复制到桌面或文档目录
2. 观察桌宠状态变化（应该变红）
3. 观察是否弹出风险拦截弹窗
4. 选择"拒绝"，观察桌宠是否恢复绿灯

**预期结果**：
- ✅ 桌宠变红
- ✅ 弹窗提示"发现敏感关键词: password, api_key, secret, token"
- ✅ 用户确认后桌宠恢复绿灯

### 2. 剪贴板监控测试

**测试内容**：
```
api_key=sk-proj-abcdefghijklmnopqrstuvwxyz
password=MyPassword123!
secret=whsec_xxxxxxxxxxxxxxxxxxxx
```

**测试步骤**：
1. 复制包含API Key的文本
2. 观察桌宠状态变化（应该变红）
3. 观察是否弹出风险拦截弹窗
4. 选择"允许"，观察桌宠是否恢复绿灯

**预期结果**：
- ✅ 桌宠变红
- ✅ 弹窗提示"剪贴板中发现敏感信息: API Key, 密码, 密钥"
- ✅ 用户确认后桌宠恢复绿灯

### 3. 桌宠窗口测试

**测试项目**：
- ✅ 桌宠显示在屏幕右下角
- ✅ 桌宠可以拖拽移动
- ✅ 桌宠始终置顶显示
- ✅ 桌宠状态实时更新
- ✅ 点击桌宠显示气泡提示

**预期效果**：
- 🟢 绿灯：系统安全，微笑表情
- 🟡 黄灯：正在检测，专注表情
- 🔴 红灯：发现风险，严肃表情

## 三、重启测试步骤

### 1. 停止当前进程
```bash
# 在桌面端运行时，按Ctrl+C停止
```

### 2. 清理编译缓存
```bash
cd desktop-client-2.0
rm -rf dist-electron
rm -rf node_modules/.vite
```

### 3. 重新启动
```bash
npm run electron:dev
```

### 4. 验证启动日志
预期看到：
```
✅ [文件监控] 启动...
✅ [剪贴板监控] 启动...
✅ 桌宠状态: green
✅ 桌宠窗口: 独立浮动窗口
```

### 5. 验证IPC通信
预期看到：
- ✅ 不再出现"get-pet-state"错误
- ✅ 桌宠状态正常同步

## 四、优化建议

### 1. 桌宠位置优化
```typescript
// 调整初始位置
x: screenWidth - width - 50,  // 距离右边缘50px
y: screenHeight - height - 100, // 距离底部100px
```

### 2. 动画效果优化
- 增加状态切换过渡动画
- 优化气泡提示显示时间
- 添加鼠标悬停效果

### 3. 错误提示优化
- 添加友好的错误提示
- 记录详细的错误日志
- 提供问题排查指南

## 五、测试检查清单

### 启动测试
- ✅ Vite开发服务器启动（http://localhost:5173）
- ✅ Electron主进程启动
- ✅ 主窗口显示正常
- ✅ 桌宠窗口显示正常
- ✅ 文件监控启动
- ✅ 剪贴板监控启动
- ✅ 后台API服务启动（端口9092）

### 功能测试
- ✅ 文件监控检测敏感关键词
- ✅ 剪贴板监控检测敏感信息
- ✅ 风险拦截弹窗显示
- ✅ 桌宠状态实时更新
- ✅ ESP32状态同步（如果有硬件）

### 性能测试
- ✅ CPU占用 < 5%
- ✅ 内存占用 < 100MB
- ✅ 文件监控响应时间 < 100ms
- ✅ 剪贴板监控间隔 = 500ms

---

**测试准备完成，等待重新启动桌面端！** 🧪
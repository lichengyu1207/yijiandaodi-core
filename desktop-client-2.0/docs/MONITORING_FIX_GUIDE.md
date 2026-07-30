# 🔧 监控系统问题诊断和修复指南

## ❓ 问题描述

用户反馈：
- "桌宠能检测到，但系统检测不到"
- "无法检测后台"
- "无法检测 Win"
- "AI Agent 检测"

## ✅ 诊断结果

经过完整测试，监控系统**工作正常**：

```
✅ API Key 检测正常
✅ SQL 注入检测正常
✅ XSS 检测正常
✅ 密码检测正常
✅ 记录存储正常
```

## 🔍 问题根源

### 1. 为什么"桌宠能检测到，但系统检测不到"？

**根本原因**：Dashboard 页面没有正确获取记录

**证据**：
- 监控模块工作正常（已测试）
- 桌宠状态更新正常（用户确认）
- 记录保存逻辑存在（代码确认）

**可能原因**：
- IPC 通信问题
- Dashboard 页面没有实时更新
- 记录保存路径不一致

### 2. 为什么"无法检测后台"？

**根本原因**：监控只在启动时运行，不会自动检测已运行的后台应用

**解决方案**：
- 新增进程监控（`processMonitor.ts`）
- 新增网络监控（`networkMonitor.ts`）

### 3. 为什么"无法检测 Win"？

**根本原因**：Windows 系统级别的操作需要特殊权限

**解决方案**：
- 使用 Windows API
- 需要管理员权限
- 使用进程和网络监控

### 4. AI Agent 监控

**当前支持**：
- ✅ OpenAI ChatGPT（剪贴板 + 网络）
- ✅ Claude（剪贴板 + 网络）
- ✅ Cursor（进程 + 剪贴板）
- ✅ GitHub Copilot（剪贴板 + 网络）
- ✅ VS Code + AI（进程 + 剪贴板）

**实现方式**：
1. **剪贴板监控**（已有）- 检测复制的内容
2. **文件监控**（已有）- 检测文件内容
3. **进程监控**（新增）- 检测运行的 AI 应用
4. **网络监控**（新增）- 检测 AI API 调用

## 🛠️ 修复步骤

### 步骤1：确认 Dashboard 记录获取

检查 `src/pages/Dashboard.tsx`：

```typescript
// 确保这个逻辑正确
useEffect(() => {
  const fetchRecords = async () => {
    try {
      // 从本地 IPC 获取记录
      if (window.electronAPI?.getOperations) {
        const localOperations = await window.electronAPI.getOperations();
        setRecords(localOperations);
      }
    } catch (error) {
      console.error('获取记录失败:', error);
    }
  };

  fetchRecords();
  const interval = setInterval(fetchRecords, 3000);
  return () => clearInterval(interval);
}, []);
```

### 步骤2：确认 IPC 处理器注册

检查 `electron/ipc/handlers.ts`：

```typescript
// 确保这个 handler 正确注册
ipcMain.handle('get-operations', async () => {
  const storageService = this.storageService;
  return storageService.getOperations();
});
```

### 步骤3：确认记录保存路径

检查 `electron/services/storageService.ts`：

```typescript
// 确保路径正确
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const OPERATIONS_FILE = path.join(DATA_DIR, 'operations.json');
```

### 步骤4：实时更新记录显示

修改 Dashboard 页面：

```typescript
// 添加实时更新监听
useEffect(() => {
  const handleRecordUpdate = (record) => {
    setRecords(prev => [record, ...prev]);
  };

  // 监听新记录事件
  window.electronAPI?.onRecordUpdate(handleRecordUpdate);

  return () => {
    window.electronAPI?.removeRecordUpdateListener(handleRecordUpdate);
  };
}, []);
```

## 🚀 新增功能

### 1. 进程监控（已创建）

自动检测运行中的 AI 应用：

```typescript
import { ProcessMonitor } from './monitoring/processMonitor';

const monitor = new ProcessMonitor();
monitor.setAIAgentDetectedCallback((process) => {
  console.log('检测到 AI 应用:', process.name);
});
monitor.start();
```

### 2. 网络监控（已创建）

监控 AI API 调用：

```typescript
import { NetworkMonitor } from './monitoring/networkMonitor';

const monitor = new NetworkMonitor();
monitor.setAIAPIRequestDetectedCallback((request) => {
  console.log('检测到 AI API 调用:', request.domain);
});
monitor.start();
```

### 3. 监控诊断工具（已创建）

测试监控系统：

```typescript
import { MonitoringDiagnostic } from './monitoring/monitoringDiagnostic';

const diagnostic = new MonitoringDiagnostic();
diagnostic.runFullDiagnostic();
```

## 📊 集成到主进程

在 `electron/main.ts` 中添加：

```typescript
// 导入新模块
import { ProcessMonitor, NetworkMonitor } from './monitoring';

// 创建实例
const processMonitor = new ProcessMonitor();
const networkMonitor = new NetworkMonitor();

// 设置回调
processMonitor.setAIAgentDetectedCallback((process) => {
  console.log('[AI Agent] 检测到:', process.name);
  updatePetState('yellow', `检测到 ${process.name}`);
});

networkMonitor.setAIAPIRequestDetectedCallback((request) => {
  console.log('[AI API] 调用:', request.domain);
  updatePetState('yellow', `API 调用: ${request.domain}`);
});

// 启动监控
processMonitor.start();
networkMonitor.start();
```

## 🎯 预期效果

修复后，用户应该能够：

1. **✅ 看到检测记录**
   - Dashboard 实时显示所有检测记录
   - 点击记录查看详细信息

2. **✅ 检测后台活动**
   - 自动检测运行中的 AI 应用
   - 记录使用时间和频率

3. **✅ 检测 Win 系统操作**
   - 通过进程和网络监控
   - 检测系统级别的活动

4. **✅ 检测 AI Agent**
   - 支持主流 AI 平台
   - 自动识别 AI 应用和 API 调用

## 📝 测试步骤

1. **启动应用**
   ```bash
   cd desktop-client-2.0
   npm run dev
   ```

2. **测试剪贴板监控**
   - 复制 `sk-proj-abc123`
   - 查看桌宠是否变红
   - 检查 Dashboard 是否显示记录

3. **测试进程监控**
   - 打开 Cursor 或 VS Code
   - 查看控制台是否检测到进程
   - 检查桌宠状态变化

4. **测试网络监控**
   - 使用 AI API
   - 查看是否检测到 API 调用
   - 检查记录是否保存

## 💡 故障排除

### 问题1：Dashboard 不显示记录

**解决方案**：
1. 检查 IPC 通信
2. 确认记录保存路径
3. 查看控制台错误信息

### 问题2：桌宠不显示

**解决方案**：
1. 检查窗口创建逻辑
2. 确认预加载脚本正确
3. 查看渲染进程错误

### 问题3：监控不工作

**解决方案**：
1. 运行诊断工具
2. 检查监控启动日志
3. 确认安全知识库加载成功

---

**需要帮助？** 运行 `node test-monitoring.js` 测试监控系统！
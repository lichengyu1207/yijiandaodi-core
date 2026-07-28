# 🔗 本地包集成指南

## 📦 已添加依赖

已在 `package.json` 中添加：

```json
{
  "dependencies": {
    "yijiandaodi-security-core": "file:../npm-package"
  }
}
```

## 🚀 安装步骤

### 步骤1：安装依赖

```bash
cd c:\MsSafeData\Desktop\yijiandaodi\desktop-client-2.0
npm install
```

### 步骤2：在代码中使用

#### 在主进程中使用

```typescript
// electron/main.ts
import { YijianDaoDiCore } from 'yijiandaodi-security-core';

// 创建核心实例
const core = new YijianDaoDiCore({
  storage: {
    path: path.join(app.getPath('userData'), 'data'),
    maxRecords: 100
  },
  callbacks: {
    onRiskDetected: (risks, context) => {
      console.log('发现风险:', risks.length, '个');
      // 触发风险警告
      showRiskWarning(risks, context);
    },
    onSaveRecord: (record) => {
      console.log('记录已保存:', record.id);
    }
  }
});

// 初始化
core.initialize();

// 在文件监控中使用
async function checkFileContent(filePath: string, content: string) {
  const risks = core.detect(content);
  
  if (risks.length > 0) {
    const report = core.detectWithReport(content, filePath);
    console.log('审计报告:', report);
    return report;
  }
  
  return null;
}

// 在剪贴板监控中使用
async function checkClipboardContent(content: string) {
  const risks = core.detect(content);
  
  if (risks.length > 0) {
    const report = core.detectWithReport(content, '剪贴板');
    return report;
  }
  
  return null;
}
```

#### 在渲染进程中使用

```typescript
// src/pages/Dashboard.tsx
import { YijianDaoDiCore } from 'yijiandaodi-security-core';

const Dashboard: React.FC = () => {
  const [core] = useState(() => new YijianDaoDiCore());
  
  const handleAnalyze = async (content: string) => {
    const risks = core.detect(content);
    
    if (risks.length > 0) {
      const report = core.detectWithReport(content, '手动分析');
      console.log('检测结果:', report);
    }
  };
  
  return (
    <div>
      {/* 你的 UI 代码 */}
    </div>
  );
};
```

## 🔧 集成到现有监控模块

### 修改文件监控

```typescript
// electron/monitoring/fileMonitor.ts
import { YijianDaoDiCore } from 'yijiandaodi-security-core';

export class FileMonitor {
  private core: YijianDaoDiCore;
  
  constructor() {
    this.core = new YijianDaoDiCore();
  }
  
  async checkFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const risks = this.core.detect(content);
    
    if (risks.length > 0) {
      const report = this.core.detectWithReport(content, filePath);
      // 发送报告到主窗口
      this.onRiskDetected?.(report);
    }
  }
}
```

### 修改剪贴板监控

```typescript
// electron/monitoring/clipboardMonitor.ts
import { YijianDaoDiCore } from 'yijiandaodi-security-core';

export class ClipboardMonitor {
  private core: YijianDaoDiCore;
  
  constructor() {
    this.core = new YijianDaoDiCore();
  }
  
  async checkClipboard(content: string) {
    const risks = this.core.detect(content);
    
    if (risks.length > 0) {
      const report = this.core.detectWithReport(content, '剪贴板');
      // 发送报告到主窗口
      this.onRiskDetected?.(report);
    }
  }
}
```

## 📊 可用的 API

### `YijianDaoDiCore` 类

#### 构造函数选项

```typescript
interface YijianDaoDiCoreOptions {
  storage?: {
    path?: string;      // 存储路径
    maxRecords?: number; // 最大记录数
  };
  callbacks?: {
    onRiskDetected?: (risks: Risk[], context: any) => void;
    onSaveRecord?: (record: AuditRecord) => void;
    onError?: (error: Error) => void;
  };
}
```

#### 方法

- `detect(content: string): Risk[]` - 检测风险
- `detectWithReport(content: string, source: string): AuditRecord` - 检测并生成报告
- `getRecords(): AuditRecord[]` - 获取所有记录
- `clearRecords(): void` - 清除所有记录
- `exportRecords(format: 'json' | 'csv'): string` - 导出记录

### `Risk` 类型

```typescript
interface Risk {
  type: string;      // 风险类型（sqli, xss, apikey 等）
  matched: string;   // 匹配的内容
  risk: 'low' | 'medium' | 'high'; // 风险等级
  position: {
    start: number;
    end: number;
  };
}
```

### `AuditRecord` 类型

```typescript
interface AuditRecord {
  id: string;
  timestamp: string;
  source: string;
  content: string;
  risks: Risk[];
  risk_level: 'low' | 'medium' | 'high';
  risk_score: number;
  audit_hash: string;
  should_block: boolean;
  explanation: string;
}
```

## ✅ 验证集成

### 测试代码

```typescript
// 测试检测功能
const testCore = new YijianDaoDiCore();

// 测试1：API Key 检测
const risks1 = testCore.detect('sk-proj-abc123');
console.log('API Key 检测:', risks1);

// 测试2：SQL 注入检测
const risks2 = testCore.detect('SELECT * FROM users WHERE 1=1');
console.log('SQL 注入检测:', risks2);

// 测试3：生成报告
const report = testCore.detectWithReport('password=admin', '测试');
console.log('审计报告:', report);
```

## 🎯 下一步

1. ✅ 运行 `npm install` 安装本地包
2. ✅ 在监控模块中集成核心库
3. ✅ 测试功能是否正常
4. ✅ 优化用户体验

---

**准备好了吗？** 运行 `npm install` 开始使用吧！
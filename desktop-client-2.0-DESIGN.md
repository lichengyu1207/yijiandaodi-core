# 一鉴到底 2.0 - 桌面端设计

## 核心定位

**一个本地运行的 AI 操作行为校验工具**

**核心价值**：
- 不出域（数据不离开用户设备）
- 操作白盒化（完整记录操作过程）
- 常态化巡检（持续监控 AI 行为）
- 一键生成证据报告

---

## 界面结构

```
┌─────────────────────────────────────────────────────────────┐
│  一鉴到底                              🔔 ⚙️ 👤              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │              🔴 录制中                               │   │
│  │                                                     │   │
│  │   已录制 47 个操作 · DeepSeek · 15:32               │   │
│  │                                                     │   │
│  │   [停止录制]                                         │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ 📝 分析  │  │ ✅ 验证  │  │ 📄 报告  │               │
│  │ 操作记录 │  │ 原创性   │  │ 生成证据 │               │
│  └──────────┘  └──────────┘  └──────────┘               │
│                                                             │
│  最近操作                                                   │
│  ├─ 15:32 AI_PROMPT: 帮我写一个登录页面...                  │
│  ├─ 15:31 PAGE_LOAD: deepseek.com                         │
│  ├─ 15:30 AI_RESPONSE: 好的，我来帮你设计...                │
│  └─ 15:28 PAGE_LOAD: chat.deepseek.com                    │
│                                                             │
│  [查看更多]                                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 页面设计

### 1. 主界面（Dashboard）

**功能**：
- 录制状态显示
- 快捷操作按钮
- 最近操作列表

**代码**：

```tsx
// desktop-client/src/pages/Dashboard.tsx

import { useState, useEffect } from 'react';

export function Dashboard() {
  const [isRecording, setIsRecording] = useState(false);
  const [operations, setOperations] = useState([]);
  const [operationCount, setOperationCount] = useState(0);
  const [platform, setPlatform] = useState('unknown');
  const [startTime, setStartTime] = useState<Date | null>(null);

  const handleStartRecord = async () => {
    // 开始录制
    setIsRecording(true);
    setStartTime(new Date());
    // 调用后端 API 开始录制
  };

  const handleStopRecord = async () => {
    // 停止录制
    setIsRecording(false);
    // 调用后端 API 停止录制
  };

  return (
    <div className="dashboard">
      {/* 录制状态卡片 */}
      <div className="recording-card">
        <div className={`status ${isRecording ? 'active' : 'idle'}`}>
          {isRecording ? '🔴 录制中' : '⚪ 空闲'}
        </div>
        {isRecording && (
          <div className="info">
            已录制 {operationCount} 个操作 · {platform} · {startTime?.toLocaleTimeString()}
          </div>
        )}
        <button
          className={`btn ${isRecording ? 'stop' : 'start'}`}
          onClick={isRecording ? handleStopRecord : handleStartRecord}
        >
          {isRecording ? '停止录制' : '开始录制'}
        </button>
      </div>

      {/* 快捷操作 */}
      <div className="quick-actions">
        <button className="action-card" onClick={() => {/* 分析操作 */}}>
          <span className="icon">📝</span>
          <span className="label">分析</span>
          <span className="desc">操作记录</span>
        </button>
        <button className="action-card" onClick={() => {/* 验证原创性 */}}>
          <span className="icon">✅</span>
          <span className="label">验证</span>
          <span className="desc">原创性</span>
        </button>
        <button className="action-card" onClick={() => {/* 生成报告 */}}>
          <span className="icon">📄</span>
          <span className="label">报告</span>
          <span className="desc">生成证据</span>
        </button>
      </div>

      {/* 最近操作 */}
      <div className="recent-operations">
        <h3>最近操作</h3>
        <ul>
          {operations.slice(0, 4).map((op, i) => (
            <li key={i}>
              <span className="time">{op.time}</span>
              <span className="type">{op.type}</span>
              <span className="preview">{op.preview}</span>
            </li>
          ))}
        </ul>
        <button className="view-more">查看更多</button>
      </div>
    </div>
  );
}
```

---

### 2. 分析页面（Analysis）

**功能**：
- 显示操作时间线
- 按类型筛选
- 详情查看

**代码**：

```tsx
// desktop-client/src/pages/Analysis.tsx

export function Analysis() {
  const [operations, setOperations] = useState([]);
  const [filter, setFilter] = useState('all');

  return (
    <div className="analysis">
      <div className="header">
        <h2>操作记录分析</h2>
        <div className="filters">
          <button onClick={() => setFilter('all')}>全部</button>
          <button onClick={() => setFilter('AI_PROMPT')}>AI提问</button>
          <button onClick={() => setFilter('AI_RESPONSE')}>AI回复</button>
          <button onClick={() => setFilter('PAGE_LOAD')}>页面加载</button>
        </div>
      </div>

      <div className="timeline">
        {operations
          .filter(op => filter === 'all' || op.type === filter)
          .map((op, i) => (
            <div key={i} className="timeline-item">
              <div className="time">{op.timestamp}</div>
              <div className="dot"></div>
              <div className="content">
                <div className="type">{op.type}</div>
                <div className="preview">{op.data.preview}</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
```

---

### 3. 验证页面（Verification）

**功能**：
- 原创性验证
- AI 分析结果
- 评分显示

**代码**：

```tsx
// desktop-client/src/pages/Verification.tsx

export function Verification() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    // 调用后端 API 验证
    const res = await fetch('/api/auth/agent/flow/', {
      method: 'POST',
      body: JSON.stringify({
        action: 'verify',
        agent_type: 'verifier'
      })
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="verification">
      <h2>原创性验证</h2>

      <button onClick={handleVerify} disabled={loading}>
        {loading ? '验证中...' : '开始验证'}
      </button>

      {result && (
        <div className="result">
          <div className="score">
            <span className="number">{result.score}</span>
            <span className="label">分</span>
          </div>
          <div className="analysis">
            <h3>AI 分析</h3>
            <p>{result.analysis}</p>
          </div>
          <div className="hash">
            <span>验证哈希：</span>
            <code>{result.hash}</code>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 4. 报告页面（Report）

**功能**：
- 生成证据报告
- 导出 PDF/JSON
- 历史报告

**代码**：

```tsx
// desktop-client/src/pages/Report.tsx

export function Report() {
  const [reports, setReports] = useState([]);

  const handleGenerate = async () => {
    // 生成报告
  };

  const handleExport = async (format: 'pdf' | 'json') => {
    // 导出报告
  };

  return (
    <div className="report">
      <h2>证据报告</h2>

      <div className="actions">
        <button onClick={handleGenerate}>生成新报告</button>
        <button onClick={() => handleExport('pdf')}>导出 PDF</button>
        <button onClick={() => handleExport('json')}>导出 JSON</button>
      </div>

      <div className="report-list">
        <h3>历史报告</h3>
        {reports.map((report, i) => (
          <div key={i} className="report-item">
            <div className="info">
              <span className="date">{report.date}</span>
              <span className="count">{report.operationCount} 个操作</span>
            </div>
            <button onClick={() => {/* 查看详情 */}}>查看</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 5. 设置页面（Settings）

**功能**：
- 本地存储路径
- API 配置
- 数据导出

**代码**：

```tsx
// desktop-client/src/pages/Settings.tsx

export function Settings() {
  const [storagePath, setStoragePath] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');

  return (
    <div className="settings">
      <h2>设置</h2>

      <div className="setting-item">
        <label>本地存储路径</label>
        <input
          type="text"
          value={storagePath}
          onChange={e => setStoragePath(e.target.value)}
        />
        <button>选择路径</button>
      </div>

      <div className="setting-item">
        <label>API 端点</label>
        <input
          type="text"
          value={apiEndpoint}
          onChange={e => setApiEndpoint(e.target.value)}
        />
      </div>

      <div className="data-actions">
        <button>导出所有数据</button>
        <button>清除本地数据</button>
      </div>
    </div>
  );
}
```

---

## 样式设计

```css
/* desktop-client/src/App.css */

:root {
  --primary: #3B82F6;
  --success: #10B981;
  --danger: #EF4444;
  --bg: #FFFFFF;
  --text: #1F2937;
  --border: #E5E7EB;
}

.dashboard {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

/* 录制卡片 */
.recording-card {
  background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
  border-radius: 16px;
  padding: 32px;
  color: white;
  text-align: center;
  margin-bottom: 24px;
}

.recording-card .status {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 16px;
}

.recording-card .btn {
  background: white;
  color: #3B82F6;
  border: none;
  padding: 12px 32px;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

/* 快捷操作 */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.action-card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.action-card:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.action-card .icon {
  font-size: 32px;
}

.action-card .label {
  display: block;
  font-size: 18px;
  font-weight: 600;
  margin: 8px 0;
}

/* 最近操作 */
.recent-operations {
  background: white;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
}

.recent-operations ul {
  list-style: none;
  padding: 0;
}

.recent-operations li {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
```

---

## Electron 主进程

```typescript
// desktop-client/electron/main.ts

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

// IPC 通信
ipcMain.handle('start-record', async () => {
  // 开始录制逻辑
});

ipcMain.handle('stop-record', async () => {
  // 停止录制逻辑
});

ipcMain.handle('get-operations', async () => {
  // 获取操作记录
});
```

---

## 文件结构

```
desktop-client/
├── electron/
│   ├── main.ts           # 主进程
│   ├── preload.ts        # 预加载脚本
│   └── tray.ts           # 系统托盘
│
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx  # 主界面
│   │   ├── Analysis.tsx   # 分析页面
│   │   ├── Verification.tsx  # 验证页面
│   │   ├── Report.tsx     # 报告页面
│   │   └── Settings.tsx   # 设置页面
│   │
│   ├── App.tsx
│   ├── App.css
│   └── main.tsx
│
├── package.json
└── electron-builder.yml
```

---

## 核心特点

1. **简洁界面**：只有 5 个页面，无多余功能
2. **本地优先**：数据存储在本地，不上云
3. **一键操作**：录制、验证、报告一键完成
4. **清晰状态**：录制状态一目了然

---

**下一步**：开始实现桌面端代码？
# 一鉴到底 - 三层架构实现报告

## 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    用户桌面端 (Tauri/Electron)              │
│                    ↓ 配置策略                                │
├─────────────────────────────────────────────────────────────┤
│                一鉴到底核心引擎                              │
│                ↓ 流量劫持 & 系统监控                         │
├─────────────────────────────────────────────────────────────┤
│   第一层：Agent监控与数据采集层（已完成）                    │
│   ├── MCP/A2A协议代理 (mcp_proxy.py)                        │
│   │   └── 中间人代理，解析JSON-RPC消息                       │
│   ├── 系统级行为监控 (system_monitor.py)                    │
│   │   └── psutil进程监控 + Falco规则导出                     │
│   └── 桌面端实时状态显示                                     │
│       └── 协议代理状态 + 系统监控状态                        │
├─────────────────────────────────────────────────────────────┤
│   第二层：智能分析与数据主权层（已完成）                     │
│   ├── 本地智能分析引擎 (local_engine.py)                    │
│   │   ├── 规则引擎（金额、敏感文件、可疑命令）               │
│   │   ├── 本地推理（Ollama + deepseek-coder）               │
│   │   └── 云端推理（DeepSeek API，备用）                    │
│   └── 不可篡改审计与存证 (immutable_audit.py)               │
│       ├── 默克尔树数据完整性验证                             │
│       └── 链式结构 + immudb集成                             │
├─────────────────────────────────────────────────────────────┤
│   第三层：统一安全接口层（已完成）                           │
│   ├── OCSF标准格式导出 (ocsf_exporter.py)                   │
│   │   └── 兼容Splunk、Elastic Security等                    │
│   └── OpenTelemetry格式导出                                 │
│       └── 兼容现代可观测性系统                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 第一层：Agent监控与数据采集层

### 1.1 MCP协议代理 (`mcp_proxy.py`)

**功能：**
- 中间人代理，监听AI Agent通信
- 解析JSON-RPC消息（tools/call, resources/write等）
- 调用巡检API分析风险
- 自动拦截高风险操作

**关键代码：**
```python
class MCPProxy:
    async def handle_request(self, request_data: bytes) -> bytes:
        message = MCPMessage.from_dict(json.loads(request_data))
        analysis = await self.analyze_request(message)
        
        if analysis.should_block:
            return self.create_blocked_response(message, analysis)
        
        return request_data  # 放行
```

**启动方式：**
```bash
python backend/run_mcp_proxy.py --port 8765
```

### 1.2 系统级行为监控 (`system_monitor.py`)

**功能：**
- 监控进程创建（检测高风险进程）
- 监控网络连接（检测反向连接）
- 导出Falco规则（Linux）

**监控内容：**
- 高风险进程：nc, nmap, sqlmap, meterpreter
- 可疑命令：base64, curl|bash, eval, exec
- 可疑外连：端口 4444, 5555, 6666

**Falco规则导出：**
```yaml
- rule: Agent 执行网络工具
  condition: spawned_process and proc.name in (nc, ncat)
  priority: WARNING
```

### 1.3 桌面端实时状态

**显示内容：**
- 巡检状态（正在巡检/已暂停）
- 协议代理状态（已连接/未连接）
- 系统监控状态（进程/网络）

---

## 第二层：智能分析与数据主权层

### 2.1 本地智能分析引擎 (`local_engine.py`)

**三层推理策略：**

```
操作内容
    ↓
┌─────────────────────────────┐
│ 规则引擎（毫秒级）           │
│ 金额检查 / 敏感文件 / 命令   │
└─────────────────────────────┘
    ↓ 未命中规则
┌─────────────────────────────┐
│ 本地推理（秒级）             │
│ Ollama + deepseek-coder     │
│ 数据不出域                  │
└─────────────────────────────┘
    ↓ 本地不可用
┌─────────────────────────────┐
│ 云端推理（备用）             │
│ DeepSeek API                │
└─────────────────────────────┘
```

**规则引擎示例：**
```python
# 金额异常
if amount >= 100000:
    risk_level = 'high'
    
# 敏感文件
if '/etc/passwd' in content:
    risk_level = 'high'
    
# 可疑命令
if 'base64' in content and '-e' in content:
    risk_level = 'high'
```

### 2.2 不可篡改审计与存证 (`immutable_audit.py`)

**默克尔树实现：**
```python
class MerkleTree:
    def add_leaf(self, data: str) -> str:
        leaf_hash = self.hash(data)
        self.leaves.append(leaf_hash)
        self._build_tree()
        return leaf_hash
    
    def get_proof(self, index: int) -> List[str]:
        # 获取默克尔证明，用于验证数据完整性
```

**审计记录结构：**
```python
@dataclass
class AuditRecord:
    id: str
    timestamp: str
    operation_type: str
    content_hash: str
    previous_hash: str      # 链式结构
    merkle_proof: List[str] # 默克尔证明
```

---

## 第三层：统一安全接口层

### 3.1 OCSF标准格式 (`ocsf_exporter.py`)

**Open Cybersecurity Schema Framework：**
- 兼容Splunk、Elastic Security、Microsoft Sentinel
- 标准化安全事件格式
- 便于企业安全系统集成

**OCSF事件结构：**
```json
{
  "metadata": {
    "product": {"name": "一鉴到底", "version": "2.0.0"}
  },
  "severity_id": 3,
  "status": "Failure",
  "class_uid": 200199,
  "class_name": "Security Finding",
  "actor": {"name": "user-123"},
  "message": "检测到敏感配置变更",
  "remediation": {"desc": "建议二次确认"}
}
```

**导出方式：**
```bash
GET /auth/patrol/export/?format=ocsf
GET /auth/patrol/export/?format=otel
```

### 3.2 Splunk集成

**查询示例：**
```splunk
# 高风险事件统计
index=security source="一鉴到底"
| stats count by severity_id, class_name

# 最近拦截事件
index=security source="一鉴到底" severity_id>=3
| table time, actor.name, message
```

### 3.3 Elasticsearch集成

**查询示例：**
```json
{
  "query": {
    "bool": {
      "must": [
        {"term": {"metadata.product.name": "一鉴到底"}},
        {"range": {"severity_id": {"gte": 3}}}
      ]
    }
  }
}
```

---

## 核心API端点

### 巡检核心 (`patrol_urls.py`)

| 端点 | 方法 | 功能 |
|------|------|------|
| `/auth/patrol/status/` | GET | 获取巡检状态 |
| `/auth/patrol/analyze/` | POST | 分析操作风险 |
| `/auth/patrol/confirm/<id>/` | POST | 确认拦截操作 |
| `/auth/patrol/operations/` | GET | 获取操作记录 |
| `/auth/patrol/export/` | GET | 导出报告（json/ocsf/otel） |

### 分析请求示例

```bash
POST /auth/patrol/analyze/
{
  "type": "code",
  "title": "Git Push",
  "content": "修改文件: config.py",
  "timestamp": "2026-07-20T10:00:00Z"
}

Response:
{
  "success": true,
  "operation": {
    "id": "abc123",
    "risk_level": "high",
    "status": "blocked",
    "mode": "local",
    "confidence": 0.95,
    "analysis": "检测到敏感配置变更",
    "audit_id": "audit-001",
    "audit_hash": "def456"
  }
}
```

---

## 核心价值实现

| 核心价值 | 实现方式 |
|----------|----------|
| 操作白盒化 | MCP代理 + 系统监控 + Grok分析 |
| 授权透明化 | 规则引擎 + 拦截弹窗 |
| 证据可追溯 | 默克尔树 + 链式结构 + OCSF导出 |
| 数据不出域 | 本地推理（Ollama）+ 本地存储 |

---

## 文件清单

```
backend/auth_app/
├── mcp_proxy.py          # MCP协议代理
├── system_monitor.py     # 系统级监控
├── local_engine.py       # 本地智能分析引擎
├── immutable_audit.py    # 不可篡改审计
├── ocsf_exporter.py      # OCSF标准导出
├── patrol_urls.py        # 巡检核心API
└── run_mcp_proxy.py      # 代理启动器

desktop-client-2.0/
├── electron/
│   ├── main.ts           # Electron主进程
│   └── preload.ts        # 预加载脚本
└── src/
    ├── App.tsx           # 主应用
    └── pages/
        ├── Dashboard.tsx # 实时巡检面板
        └── Settings.tsx  # 设置页
```

---

## 下一步

1. **启动测试** - 测试三层架构的完整流程
2. **打磨演示** - 按"代码安全"场景练习演示
3. **文档完善** - 更新用户手册和技术文档
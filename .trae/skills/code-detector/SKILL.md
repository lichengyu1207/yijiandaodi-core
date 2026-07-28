---
name: "code-detector"
description: "代码安全检测器 Skill。当需要对代码进行静态分析、危险模式检测、复杂度评估、语言白名单检查时调用。集成在 SandboxExecutor 的 CodeAnalyzer 中。"
---

# 代码安全检测器 (CodeAnalyzer)

## 概述
嵌入在沙箱执行引擎中的代码静态分析组件，作为执行前的**第一道安检门**。对输入代码进行四维分析后决定是否允许进入沙箱子进程执行。

对应 Service: `CodeAnalyzer` (`backend/p2p_app/services/execution_engine.py`，嵌套于 `SandboxExecutor` 内部)

**注意**: CodeAnalyzer 不提供独立的 HTTP API 端点，其能力通过以下两种方式暴露：
1. **POST `/api/p2p/v1/pipeline/execute`** — 统一流水线自动调用（L6 阶段内置）
2. **POST `/api/p2p/v1/security/check`** — 安全网关快速模式可做补充检测
3. **Python SDK 直接调用** — `CodeAnalyzer.analyze()` 方法

## 检测维度

### 1. 语言白名单检查
仅允许以下语言类型通过:

| 语言 | 执行方式 | 说明 |
|------|---------|------|
| python | `python -c <code>` | Python 3 解释器 |
| javascript | `node -e <code>` | Node.js 运行时 |
| typescript | `node -e <code>` | 通过 Node.js 执行 |
| bash | `bash -c <code>` | Bash shell |
| html | 文本输出模式 | 不实际渲染 |

**不支持的语言直接返回 `risk_level='critical'`，`safe=False`**

### 2. 危险模式匹配 (BLOCKED_PATTERNS)
使用正则表达式检测 11 种危险代码模式:

| 模式 | 正则 | 风险等级 | 说明 |
|------|------|---------|------|
| `import os.system` | `import\s+os\.system` | high | 系统命令注入 |
| `import subprocess` | `import\s+subprocess` | high | 子进程逃逸 |
| eval() | `eval\s*\(` | high | 动态代码执行 |
| exec() | `exec\s*\(` | high | 动态代码执行 |
| __import__ | `__import__` | high | 动态导入 |
| open("/etc | `open\s*\([\'"]\/etc` | high | 系统文件读取 |
| open("/proc | `open\s*\([\'"]\/proc` | high | 进程信息泄露 |
| rm -rf / | `rm\s+-rf\s+/` | high | 破坏性删除 |
| chmod 777 | `chmod\s+777` | high | 权限提升 |
| .env 引用 | `\.env\s*[\'"]` | high | 敏感文件访问 |
| socket 创建 | `socket\.socket` | medium | 网络连接 |

### 3. 复杂度评估
基于代码静态特征评估资源需求:

| 指标 | 低风险 | 中风险警告 | 阈值 |
|------|-------|-----------|------|
| 代码行数 | ≤500 行 | >500 行 | 500 |
| 循环嵌套深度 | ≤5 层 | >5 层 | 5 |
| 导入模块数 | ≤20 个 | >20 个 | 20 |

### 4. 资源需求预估
根据代码特征自动估算所需资源:
```python
estimated_resources = {
    'memory_mb': min(512, max(16, line_count // 10)),     # 内存: 16~512MB
    'cpu_seconds': min(300, max(5, line_count // 50)),     # CPU时间: 5~300s
    'disk_mb': min(256, max(1, len(code) // 1024)),        # 磁盘: 1~256MB
}
```

## 分析结果格式

```python
{
    'safe': bool,              # 是否允许执行 (risk_level != 'critical')
    'risk_level': str,         # low / medium / high / critical
    'warnings': list[str],     # 检测到的警告信息列表
    'estimated_resources': {    # 预估资源需求
        'memory_mb': int,
        'cpu_seconds': int,
        'disk_mb': int,
    }
}
```

**决策逻辑**:
- `critical` → ❌ **拒绝执行** (exit_code=-1)
- `high` → ❌ **拒绝执行** (检测到危险模式)
- `medium` → ⚠️ **允许执行** (记录警告)
- `low` → ✅ **正常执行**

## Python SDK 调用示例

```python
from p2p_app.services.execution_engine import CodeAnalyzer, SandboxExecutor

analyzer = CodeAnalyzer()

# ── 案例1: 安全代码 ──
safe_code = """
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

result = fibonacci(10)
print(result)
"""

analysis = analyzer.analyze(safe_code, language="python")
assert analysis['safe'] == True
assert analysis['risk_level'] == 'low'
print(f"✅ 安全 | 警告数: {len(analysis['warnings'])}")
print(f"   预估资源: {analysis['estimated_resources']}")

# ── 案例2: 危险代码 (含 eval) ──
dangerous_code = "user_input = '__import__(\"os\").system(\"ls\")'\neval(user_input)"

analysis = analyzer.analyze(dangerous_code, language="python")
assert analysis['safe'] == False
assert analysis['risk_level'] == 'high'
print(f"❌ 危险 | 风险等级: {analysis['risk_level']}")
for w in analysis['warnings']:
    print(f"   ⚠️ {w}")

# ── 案例3: 不支持的语言 ──
analysis = analyzer.analyze("SELECT * FROM users;", language="sql")
assert analysis['safe'] == False
assert analysis['risk_level'] == 'critical'
print(f"❌ 不支持的语言: {analysis['warnings'][0]}")

# ── 案例4: 高复杂度代码 ──
complex_code = "\n".join([f"for i{i}:" + "".join([f"\n  for j{j}:" for j in range(6)]) + "\n    pass" for i in range(6)])
analysis = analyzer.analyze(complex_code, language="python")
print(f"⚠️ 复杂度: {analysis['risk_level']} | 警告: {analysis['warnings']}")

# ── 完整执行流程 (预检 + 沙箱) ──
executor = SandboxExecutor()
result = executor.execute(code=safe_code, language="python", timeout=30)
if result['exit_code'] == 0:
    print(f"执行成功: {result['stdout'].strip()}")
else:
    print(f"执行失败: {result['stderr']}")
```

## 与安全网关的关系

```
用户输入
  │
  ▼
┌──────────────────────┐
│ L3 ASS SecurityGateway│ ← 全面安全检查 (注入/XSS/分类/签名)
│   quick_check()      │ ← 快速模式: 注入检测 + 风险评分
└──────────┬───────────┘
           │ passed
           ▼
┌──────────────────────┐
│ L6 CodeAnalyzer      │ ← 语言白名单 + 危险模式 + 复杂度
│   analyze()          │
└──────────┬───────────┘
           │ safe=True
           ▼
┌──────────────────────┐
│ L6 SandboxExecutor   │ ← 子进程隔离执行
│   execute()          │
└──────────────────────┘
```

## curl 示例

```bash
# 通过统一流水线触发 (内置 CodeAnalyzer 预检)
curl -X POST http://localhost:8000/api/p2p/v1/pipeline/execute \
  -H "Content-Type: application/json" \
  -d '{"input_content": "print(42)", "workflow_type": "python"}'

# 通过安全网关做补充检测
curl -X POST http://localhost:8000/api/p2p/v1/security/check \
  -H "Content-Type: application/json" \
  -d '{"text":"import os.system(\"rm -rf /\")","mode":"quick"}'
```

## 触发词
"代码检测", "危险模式", "静态分析", "代码审查", "代码安全",
"code analysis", "dangerous pattern", "code safety check",
"语言白名单", "复杂度评估", "沙箱预检", "blocked pattern",
"eval检测", "注入防护", "代码审计"

## 注意事项与限制
- **无独立 HTTP 端点**，需通过 pipeline/execute 或 SDK 调用
- 检测为纯正则匹配，不进行 AST 解析（性能优先）
- `eval()` 和 `exec()` 始终被标记为 dangerous
- `.env` 文件引用会被拦截（防止配置泄露）
- HTML 类型代码不会实际渲染，仅作文本输出
- 资源预估为粗略估计，实际消耗以运行时为准
- 新的危险模式可通过修改 `BLOCKED_PATTERNS` 列表扩展

## 错误场景
| 场景 | exit_code | stderr 内容 |
|------|-----------|------------|
| 不支持的语言 | -1 | `安全预检未通过: 不支持的语言类型: xxx` |
| 检测到危险模式 | -1 | `安全预检未通过: [pattern] 在位置 x-y` |
| 沙箱内部错误 | -2 | `沙箱内部错误: ...` |
| 执行超时 | -9 | `执行超时 (30s)` |

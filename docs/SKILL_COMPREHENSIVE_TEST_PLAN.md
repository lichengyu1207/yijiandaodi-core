# Skill完整测试方案

## 一、主要Skill测试

### 1.1 TRAE-code-review（代码审查）

**测试目的**：验证代码审查功能是否正常工作

**测试步骤**：

#### 测试1：基础代码审查
```
用户输入：
请审查这段代码的安全性：

def login(username, password):
    if username == "admin" and password == "123456":
        return True
    return False

预期响应：
- ✅ 识别硬编码密码风险
- ✅ 建议使用环境变量
- ✅ 提供改进建议
- ✅ 返回审查报告
```

#### 测试2：复杂代码审查
```
用户输入：
请审查这段代码：

def process_data(data):
    query = "SELECT * FROM users WHERE id=" + data['id']
    cursor.execute(query)
    return cursor.fetchall()

预期响应：
- ✅ 识别SQL注入风险
- ✅ 建议参数化查询
- ✅ 提供安全代码示例
```

#### 测试3：批量代码审查
```
用户输入：
请审查这些文件的安全性：
（上传多个代码文件）

预期响应：
- ✅ 逐个文件分析
- ✅ 汇总风险清单
- ✅ 提供优先级建议
```

---

### 1.2 TRAE-debugger（调试工具）

**测试目的**：验证调试功能是否能帮助定位问题

**测试步骤**：

#### 测试1：错误调试
```
用户输入：
帮我调试这个错误：

TypeError: 'NoneType' object is not iterable
at line 42 in process_items()

预期响应：
- ✅ 分析可能原因
- ✅ 提供调试步骤
- ✅ 建议修复方法
- ✅ 提供预防措施
```

#### 测试2：性能问题调试
```
用户输入：
这个函数运行很慢，帮我优化：

def find_duplicates(items):
    duplicates = []
    for i in items:
        for j in items:
            if i == j and items.index(i) != items.index(j):
                duplicates.append(i)
    return duplicates

预期响应：
- ✅ 识别性能瓶颈
- ✅ 提供优化建议
- ✅ 给出优化后代码
- ✅ 对比性能提升
```

#### 测试3：实时调试
```
用户输入：
启动调试服务器，监控这段代码的执行：

（粘贴代码）

预期响应：
- ✅ 启动调试服务器
- ✅ 收集执行日志
- ✅ 提供实时监控
- ✅ 生成调试报告
```

---

### 1.3 TRAE-security-review（安全审查）

**测试目的**：验证安全审查功能的准确性和全面性

**测试步骤**：

#### 测试1：Web安全审查
```
用户输入：
请进行安全审查：

@app.route('/api/user')
def get_user():
    user_id = request.args.get('id')
    user = db.execute(f"SELECT * FROM users WHERE id={user_id}")
    return jsonify(user)

预期响应：
- ✅ 识别SQL注入
- ✅ 识别参数验证缺失
- ✅ 识别错误处理缺失
- ✅ 提供修复建议
```

#### 测试2：API安全审查
```
用户输入：
审查这个API端点的安全性：

POST /api/login
Body: {"username": "admin", "password": "123"}

预期响应：
- ✅ 检查认证机制
- ✅ 检查密码强度
- ✅ 检查速率限制
- ✅ 检查Token安全
```

#### 测试3：配置安全审查
```
用户输入：
审查这个配置文件的安全性：

DATABASE_URL=postgres://admin:password123@localhost:5432/mydb
SECRET_KEY=abc123
API_KEY=sk-1234567890abcdef

预期响应：
- ✅ 识别敏感信息泄露
- ✅ 识别弱密码
- ✅ 建议使用环境变量
- ✅ 提供加密建议
```

---

### 1.4 sandbox-executor（沙箱执行）

**测试目的**：验证沙箱执行环境的安全性和功能性

**测试步骤**：

#### 测试1：Python代码执行
```
用户输入：
在沙箱中执行这段Python代码：

import math
result = math.sqrt(16)
print(result)

预期响应：
- ✅ 沙箱环境启动
- ✅ 代码执行成功
- ✅ 返回执行结果：4.0
- ✅ 执行日志记录
```

#### 测试2：危险代码拦截
```
用户输入：
执行这段代码：

import os
os.system('rm -rf /')

预期响应：
- ✅ 检测到危险操作
- ✅ 拒绝执行
- ✅ 返回安全警告
- ✅ 记录安全事件
```

#### 测试3：资源限制测试
```
用户输入：
执行这段代码：

while True:
    pass

预期响应：
- ✅ 执行超时
- ✅ 自动终止进程
- ✅ 返回超时错误
- ✅ 释放资源
```

---

## 二、附属Skill测试

### 2.1 content-moderator（内容审核）

**测试步骤**：

#### 测试1：敏感内容检测
```
用户输入：
审核这段内容是否合规：

这是一段包含不当词汇的内容...

预期响应：
- ✅ 检测敏感词
- ✅ 内容分级
- ✅ 提供修改建议
- ✅ 生成审核报告
```

#### 测试2：XSS防护
```
用户输入：
净化这段HTML：

<script>alert('XSS')</script><p>Hello</p>

预期响应：
- ✅ 移除script标签
- ✅ 保留安全内容
- ✅ 返回净化结果
```

---

### 2.2 ass-gateway（安全网关）

**测试步骤**：

#### 测试1：输入检测
```
用户输入：
检测这段输入的安全性：

'; DROP TABLE users; --

预期响应：
- ✅ 检测SQL注入
- ✅ 拦截恶意输入
- ✅ 返回风险评估
```

#### 测试2：签名验证
```
用户输入：
验证这个签名的有效性：

data={"user":"admin"}&signature=abc123...

预期响应：
- ✅ 签名验证
- ✅ 数据完整性检查
- ✅ 返回验证结果
```

---

### 2.3 dag-orchestrator（工作流编排）

**测试步骤**：

#### 测试1：创建工作流
```
用户输入：
创建一个数据处理工作流：
1. 读取CSV文件
2. 数据清洗
3. 数据分析
4. 生成报告

预期响应：
- ✅ 创建DAG工作流
- ✅ 定义任务依赖
- ✅ 返回工作流ID
- ✅ 提供执行计划
```

#### 测试2：执行工作流
```
用户输入：
执行工作流 workflow_123

预期响应：
- ✅ 启动工作流
- ✅ 监控执行状态
- ✅ 返回执行结果
- ✅ 生成执行日志
```

---

### 2.4 result-aggregator（结果聚合）

**测试步骤**：

#### 测试1：数据聚合
```
用户输入：
聚合这些结果：

[{"id":1,"score":85},{"id":2,"score":90}]
[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]

预期响应：
- ✅ 数据合并
- ✅ 冲突处理
- ✅ 返回聚合结果
```

---

### 2.5 node-discovery（节点发现）

**测试步骤**：

#### 测试1：节点搜索
```
用户输入：
搜索可用节点，要求：
- CPU >= 4核
- 内存 >= 8GB
- 支持GPU

预期响应：
- ✅ 返回匹配节点列表
- ✅ 显示节点性能指标
- ✅ 提供负载情况
```

---

### 2.6 p2p-scheduler（P2P调度）

**测试步骤**：

#### 测试1：任务分发
```
用户输入：
将这个任务分发到3个节点：

{"task":"process_data","input":"data.csv"}

预期响应：
- ✅ 选择最优节点
- ✅ 分发任务
- ✅ 监控执行状态
- ✅ 收集结果
```

---

### 2.7 idle-detector（闲时检测）

**测试步骤**：

#### 测试1：资源监控
```
用户输入：
检测节点资源空闲状态

预期响应：
- ✅ 返回CPU使用率
- ✅ 返回内存使用率
- ✅ 判断是否空闲
- ✅ 提供任务迁移建议
```

---

### 2.8 compliance-reporter（合规报告）

**测试步骤**：

#### 测试1：生成合规报告
```
用户输入：
生成节点行为的合规报告

预期响应：
- ✅ 收集行为日志
- ✅ 分析合规性
- ✅ 生成审计报告
- ✅ 提供改进建议
```

---

### 2.9 hashchain-audit（哈希链审计）

**测试步骤**：

#### 测试1：验证审计链
```
用户输入：
验证这个审计链的完整性：

hash1 -> hash2 -> hash3

预期响应：
- ✅ 验证哈希链接
- ✅ 检查时间戳
- ✅ 返回验证结果
- ✅ 生成审计证明
```

---

### 2.10 output-verifier（输出验证）

**测试步骤**：

#### 测试1：签名验证
```
用户输入：
验证这个输出的签名：

{"data":"...","signature":"abc123"}

预期响应：
- ✅ 验证签名
- ✅ 检查数据完整性
- ✅ 返回验证结果
```

---

### 2.11 eihm-router（EIHM路由）

**测试步骤**：

#### 测试1：最优路由
```
用户输入：
计算任务的最优路由：
- 输入数据大小：100MB
- 计算复杂度：高
- 时效要求：实时

预期响应：
- ✅ 成本估算
- ✅ 节点匹配
- ✅ 返回最优路由
- ✅ 提供调度建议
```

---

### 2.12 data-masker（数据脱敏）

**测试步骤**：

#### 测试1：敏感数据脱敏
```
用户输入：
脱敏这些数据：

手机号：13800138000
身份证：110101199001011234
银行卡：6222021234567890

预期响应：
- ✅ 手机号：138****8000
- ✅ 身份证：110101********1234
- ✅ 银行卡：6222****7890
- ✅ 返回脱敏结果
```

---

## 三、综合测试流程

### 3.1 测试执行顺序

```
Phase 1: 主要Skill测试（优先级高）
1. TRAE-code-review
2. TRAE-debugger
3. TRAE-security-review
4. sandbox-executor

Phase 2: 附属Skill测试
5. content-moderator
6. ass-gateway
7. dag-orchestrator
8. result-aggregator
9. node-discovery
10. p2p-scheduler
11. idle-detector
12. compliance-reporter
13. hashchain-audit
14. output-verifier
15. eihm-router
16. data-masker
```

### 3.2 测试报告模板

```markdown
# Skill功能测试报告

## 测试信息
- 测试日期：2026-07-29
- 测试环境：生产环境
- 测试版本：v1.0.0

## 主要Skill测试结果
| Skill | 状态 | 响应时间 | 准确性 |
|-------|------|---------|--------|
| TRAE-code-review | ✅ | 2.3s | 95% |
| TRAE-debugger | ✅ | 1.8s | 90% |
| TRAE-security-review | ✅ | 2.5s | 92% |
| sandbox-executor | ✅ | 1.5s | 100% |

## 附属Skill测试结果
| Skill | 状态 | 响应时间 | 准确性 |
|-------|------|---------|--------|
| content-moderator | ✅ | 0.8s | 98% |
| ass-gateway | ✅ | 0.5s | 100% |
| dag-orchestrator | ✅ | 3.2s | 95% |
| ... | ... | ... | ... |

## 发现问题
- （列出发现的问题）

## 改进建议
- （列出改进建议）
```

---

**Skill完整测试方案已创建，可按需执行测试！**
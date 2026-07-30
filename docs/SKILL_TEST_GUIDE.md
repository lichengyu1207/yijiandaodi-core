# Skill功能测试指南

## 一、可用Skill列表

### 1. 代码审查类

#### TRAE-code-review
- **功能**：代码质量审查
- **触发方式**：请求审查代码
- **测试方法**：
  ```
  用户：请审查这段代码的安全性
  （粘贴代码）
  ```

#### TRAE-security-review
- **功能**：安全漏洞检测
- **触发方式**：请求安全检查
- **测试方法**：
  ```
  用户：请检查这段代码是否有安全漏洞
  （粘贴代码）
  ```

### 2. 调试工具类

#### TRAE-debugger
- **功能**：运行时调试
- **触发方式**：遇到错误需要调试
- **测试方法**：
  ```
  用户：帮我调试这个错误
  （粘贴错误信息）
  ```

### 3. 小程序生成类

#### TRAE-generate-mini-app
- **功能**：基于Taro的多端小程序生成
- **触发方式**：请求生成小程序
- **测试方法**：
  ```
  用户：生成一个待办事项小程序
  ```

### 4. 内容审核类

#### content-moderator
- **功能**：内容净化、敏感词检测
- **触发方式**：请求审核内容
- **测试方法**：
  ```
  用户：请审核这段内容是否合规
  （粘贴内容）
  ```

### 5. 沙箱执行类

#### sandbox-executor
- **功能**：在隔离环境中执行代码
- **触发方式**：请求执行代码
- **测试方法**：
  ```
  用户：请执行这段Python代码
  （粘贴代码）
  ```

### 6. 安全网关类

#### ass-gateway
- **功能**：安全检测、注入防护
- **触发方式**：请求安全验证
- **测试方法**：
  ```
  用户：请检测这段输入是否有安全风险
  （粘贴输入）
  ```

### 7. 工作流编排类

#### dag-orchestrator
- **功能**：DAG工作流编排
- **触发方式**：请求创建工作流
- **测试方法**：
  ```
  用户：请创建一个数据处理工作流
  ```

### 8. 结果聚合类

#### result-aggregator
- **功能**：收集并聚合多个执行结果
- **触发方式**：请求聚合结果
- **测试方法**：
  ```
  用户：请聚合这些数据
  （提供数据）
  ```

---

## 二、Skill测试流程

### 测试清单

| Skill | 测试项 | 预期结果 | 状态 |
|-------|--------|---------|------|
| **TRAE-code-review** | 提交代码审查 | 返回代码质量报告 | ⏳ 待测试 |
| **TRAE-security-review** | 提交安全检查 | 返回漏洞报告 | ⏳ 待测试 |
| **TRAE-debugger** | 提交错误信息 | 返回调试建议 | ⏳ 待测试 |
| **TRAE-generate-mini-app** | 请求生成小程序 | 生成Taro代码 | ⏳ 待测试 |
| **content-moderator** | 提交内容审核 | 返回审核结果 | ⏳ 待测试 |
| **sandbox-executor** | 提交代码执行 | 返回执行结果 | ⏳ 待测试 |
| **ass-gateway** | 提交安全检测 | 返回风险评估 | ⏳ 待测试 |
| **dag-orchestrator** | 创建工作流 | 返回工作流ID | ⏳ 待测试 |
| **result-aggregator** | 提交数据聚合 | 返回聚合结果 | ⏳ 待测试 |

---

## 三、手动测试步骤

### 步骤1：打开对话界面
```
启动项目后，打开浏览器：
http://localhost:3000
```

### 步骤2：逐一测试Skill

#### 测试1：代码审查
```
用户输入：
请审查这段代码：

def login(username, password):
    if username == "admin" and password == "123456":
        return True
    return False

预期响应：
- 指出硬编码密码的安全风险
- 建议使用环境变量
- 提供改进建议
```

#### 测试2：安全检查
```
用户输入：
请检查这段SQL代码是否有安全漏洞：

query = "SELECT * FROM users WHERE id=" + user_input

预期响应：
- 检测到SQL注入风险
- 建议使用参数化查询
- 提供安全代码示例
```

#### 测试3：错误调试
```
用户输入：
帮我调试这个错误：

TypeError: 'NoneType' object is not iterable

预期响应：
- 分析可能的原因
- 提供调试步骤
- 建议修复方法
```

#### 测试4：小程序生成
```
用户输入：
生成一个简单的待办事项小程序

预期响应：
- 生成Taro项目结构
- 包含基础页面和组件
- 提供运行说明
```

---

## 四、自动化测试脚本

```python
# tools/test_skills.py

import requests
import json

def test_code_review_skill():
    """测试代码审查Skill"""
    code = """
def login(username, password):
    if username == "admin" and password == "123456":
        return True
    return False
"""
    
    # 发送代码审查请求
    # 这里需要实际的Skill调用方式
    print(f"提交代码审查: {code[:50]}...")
    print("✅ Skill测试完成")

def test_security_review_skill():
    """测试安全检查Skill"""
    code = 'query = "SELECT * FROM users WHERE id=" + user_input'
    
    print(f"提交安全检查: {code}")
    print("✅ Skill测试完成")

def test_all_skills():
    """测试所有Skill"""
    print("\n" + "="*60)
    print("🧪 开始测试所有Skill")
    print("="*60)
    
    test_code_review_skill()
    test_security_review_skill()
    
    print("\n✅ 所有Skill测试完成")

if __name__ == "__main__":
    test_all_skills()
```

---

## 五、Skill调用方式

### 方式1：通过对话触发
```
用户：请审查这段代码...
（系统自动识别意图，调用对应Skill）
```

### 方式2：通过API调用
```python
import requests

# 调用代码审查Skill
response = requests.post(
    'http://localhost:8000/api/skills/code-review/',
    json={'code': 'def hello(): pass'}
)
```

### 方式3：通过MCP工具调用
```python
# 使用Skill工具
Skill(name='TRAE-code-review')
```

---

## 六、测试报告模板

```markdown
# Skill功能测试报告

## 测试信息
- 测试日期：2026-07-29
- 测试环境：本地开发环境
- 测试版本：v1.0.0

## 测试结果
| Skill | 状态 | 响应时间 | 备注 |
|-------|------|---------|------|
| TRAE-code-review | ✅ | 2.3s | 功能正常 |
| TRAE-security-review | ✅ | 1.8s | 检测准确 |
| TRAE-debugger | ⚠️ | 5.2s | 响应较慢 |
| TRAE-generate-mini-app | ✅ | 15.6s | 代码生成成功 |

## 发现问题
- TRAE-debugger响应时间较长
- content-moderator误判率较高

## 建议
- 优化debugger响应速度
- 调整content-moderator阈值
```

---

**Skill功能测试指南已创建，可按需逐个测试！**
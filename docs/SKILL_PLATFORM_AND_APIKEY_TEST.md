# yijiandaodi-skill平台测试与API Key完整测试方案

## 一、yijiandaodi-skill平台测试

### 1.1 平台功能检查

#### 检查1：Skill路由是否注册
```python
# backend/fangdudu_backend/urls.py
# 检查是否包含skill相关路由
```

#### 检查2：Skill模型是否存在
```python
# backend/auth_app/models.py
# 查找Skill相关模型定义
```

---

### 1.2 Skill平台API端点

#### 端点1：Skill列表
```
GET /api/skills/
返回：所有可用Skill列表
```

#### 端点2：Skill详情
```
GET /api/skills/{skill_id}/
返回：Skill详细信息
```

#### 端点3：执行Skill
```
POST /api/skills/{skill_id}/execute/
请求体：
{
    "input_data": "...",
    "params": {...}
}
返回：执行结果
```

---

### 1.3 Skill平台测试流程

#### 测试1：获取Skill列表
```bash
curl -X GET http://localhost:8000/api/skills/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 测试2：查看Skill详情
```bash
curl -X GET http://localhost:8000/api/skills/trse-code-review/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 测试3：执行Skill
```bash
curl -X POST http://localhost:8000/api/skills/trse-code-review/execute/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "def hello(): pass",
    "language": "python"
  }'
```

---

## 二、API Key完整测试方案

### 2.1 API Key生成流程

#### 步骤1：用户注册/登录
```bash
# 注册
POST /api/auth/register/
{
    "username": "testuser",
    "email": "test@test.com",
    "password": "Test@123",
    "confirm_password": "Test@123",
    "privacy_agreed": true
}

# 登录
POST /api/auth/login/
{
    "username": "testuser",
    "password": "Test@123"
}

# 返回Token
{
    "access": "eyJ...",
    "refresh": "eyJ..."
}
```

#### 步骤2：生成API Key
```bash
POST /api/api-keys/generate/
Headers: Authorization: Bearer {access_token}
Body:
{
    "name": "My API Key",
    "permissions": ["read", "write"],
    "expires_in_days": 365
}

# 返回
{
    "api_key": "yijia_sk_live_1234567890abcdef",
    "name": "My API Key",
    "created_at": "2026-07-29T10:00:00Z",
    "expires_at": "2027-07-29T10:00:00Z"
}
```

#### 步骤3：管理API Key
```bash
# 查看所有API Key
GET /api/api-keys/

# 删除API Key
DELETE /api/api-keys/{key_id}/

# 更新API Key
PUT /api/api-keys/{key_id}/
{
    "name": "Updated Key Name"
}
```

---

### 2.2 API Key认证测试

#### 测试1：使用API Key访问API
```bash
curl -X GET http://localhost:8000/api/userinfo/ \
  -H "X-API-Key: yijia_sk_live_1234567890abcdef"
```

#### 测试2：无效API Key测试
```bash
curl -X GET http://localhost:8000/api/userinfo/ \
  -H "X-API-Key: invalid_key"

# 预期返回401
```

#### 测试3：过期API Key测试
```bash
curl -X GET http://localhost:8000/api/userinfo/ \
  -H "X-API-Key: yijia_sk_expired_..."

# 预期返回403
```

---

### 2.3 API Key权限测试

#### 测试1：只读权限
```bash
# API Key权限：read

# 允许的请求
GET /api/sessions/  ✅

# 禁止的请求
POST /api/sessions/  ❌ 403
DELETE /api/sessions/1/  ❌ 403
```

#### 测试2：读写权限
```bash
# API Key权限：read, write

# 允许的请求
GET /api/sessions/  ✅
POST /api/sessions/  ✅

# 禁止的请求
DELETE /api/sessions/1/  ❌ 403
```

#### 测试3：完全权限
```bash
# API Key权限：read, write, delete

# 所有请求都允许
GET /api/sessions/  ✅
POST /api/sessions/  ✅
DELETE /api/sessions/1/  ✅
```

---

### 2.4 API Key限流测试

#### 测试1：频率限制
```bash
# API Key配置：100次/分钟

for i in {1..101}; do
    curl -X GET http://localhost:8000/api/health/ \
      -H "X-API-Key: yijia_sk_live_..."
done

# 第101次请求应返回429 Too Many Requests
```

#### 测试2：并发限制
```bash
# API Key配置：10并发

# 使用ab或wrk进行并发测试
ab -n 100 -c 20 -H "X-API-Key: yijia_sk_live_..." \
    http://localhost:8000/api/health/

# 超过10并发应返回429
```

---

### 2.5 API Key监控与日志

#### 测试1：请求日志记录
```bash
# 所有API Key请求应记录日志

# 查看日志
GET /api/api-keys/logs/
Headers: Authorization: Bearer {admin_token}

# 返回
{
    "logs": [
        {
            "api_key_id": "key_123",
            "endpoint": "/api/sessions/",
            "method": "GET",
            "status_code": 200,
            "response_time_ms": 45,
            "timestamp": "2026-07-29T10:00:00Z"
        }
    ]
}
```

#### 测试2：异常监控
```bash
# 检测异常使用模式

# 查看异常报告
GET /api/api-keys/anomalies/

# 返回
{
    "anomalies": [
        {
            "api_key_id": "key_123",
            "type": "high_frequency",
            "description": "请求频率异常：500次/分钟",
            "detected_at": "2026-07-29T10:00:00Z"
        }
    ]
}
```

---

### 2.6 API Key安全最佳实践

#### 实践1：环境变量存储
```python
# .env文件
YIJIANDAODI_API_KEY=yijia_sk_live_1234567890abcdef

# Python代码
import os
api_key = os.getenv('YIJIANDAODI_API_KEY')
```

#### 实践2：定期轮换
```bash
# 生成新的API Key
POST /api/api-keys/generate/

# 更新环境变量

# 删除旧的API Key
DELETE /api/api-keys/{old_key_id}/
```

#### 实践3：权限最小化
```bash
# 只授予必要的权限
{
    "permissions": ["read"]  # 只读权限
}
```

---

## 三、完整接入流程示例

### 3.1 Python接入示例

```python
import requests

class YijiandaodiClient:
    def __init__(self, api_key):
        self.base_url = "http://localhost:8000"
        self.api_key = api_key
        self.headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json"
        }
    
    def get_sessions(self):
        """获取会话列表"""
        response = requests.get(
            f"{self.base_url}/api/extension/sessions/",
            headers=self.headers
        )
        return response.json()
    
    def create_session(self, session_data):
        """创建会话"""
        response = requests.post(
            f"{self.base_url}/api/extension/sync/start/",
            headers=self.headers,
            json=session_data
        )
        return response.json()
    
    def execute_skill(self, skill_id, input_data):
        """执行Skill"""
        response = requests.post(
            f"{self.base_url}/api/skills/{skill_id}/execute/",
            headers=self.headers,
            json={"input_data": input_data}
        )
        return response.json()

# 使用示例
client = YijiandaodiClient("yijia_sk_live_1234567890abcdef")

# 获取会话
sessions = client.get_sessions()

# 创建会话
session = client.create_session({
    "session_id": "test_session",
    "title": "测试会话",
    "platforms": ["DeepSeek"]
})

# 执行Skill
result = client.execute_skill("trse-code-review", {
    "code": "def hello(): pass"
})
```

---

### 3.2 JavaScript接入示例

```javascript
class YijiandaodiClient {
    constructor(apiKey) {
        this.baseUrl = 'http://localhost:8000';
        this.apiKey = apiKey;
    }
    
    async getSessions() {
        const response = await fetch(`${this.baseUrl}/api/extension/sessions/`, {
            headers: {
                'X-API-Key': this.apiKey
            }
        });
        return response.json();
    }
    
    async createSession(sessionData) {
        const response = await fetch(`${this.baseUrl}/api/extension/sync/start/`, {
            method: 'POST',
            headers: {
                'X-API-Key': this.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionData)
        });
        return response.json();
    }
    
    async executeSkill(skillId, input_data) {
        const response = await fetch(`${this.baseUrl}/api/skills/${skillId}/execute/`, {
            method: 'POST',
            headers: {
                'X-API-Key': this.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ input_data })
        });
        return response.json();
    }
}

// 使用示例
const client = new YijiandaodiClient('yijia_sk_live_1234567890abcdef');

// 获取会话
const sessions = await client.getSessions();

// 创建会话
const session = await client.createSession({
    session_id: 'test_session',
    title: '测试会话',
    platforms: ['DeepSeek']
});

// 执行Skill
const result = await client.executeSkill('trse-code-review', {
    code: 'function hello() {}'
});
```

---

## 四、自动化测试脚本

```python
"""
API Key完整测试脚本
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"

class APIKeyTester:
    def __init__(self):
        self.access_token = None
        self.api_key = None
        
    def test_full_flow(self):
        """测试完整流程"""
        print("\n" + "="*60)
        print("🧪 API Key完整流程测试")
        print("="*60)
        
        # 1. 用户注册
        print("\n步骤1: 用户注册")
        response = requests.post(
            f"{BASE_URL}/api/auth/register/",
            json={
                "username": f"apikey_test_{int(time.time())}",
                "email": f"test{int(time.time())}@test.com",
                "password": "Test@123",
                "confirm_password": "Test@123",
                "privacy_agreed": True
            }
        )
        print(f"注册状态: {response.status_code}")
        
        # 2. 用户登录
        print("\n步骤2: 用户登录")
        username = f"apikey_test_{int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/auth/login/",
            json={
                "username": username,
                "password": "Test@123"
            }
        )
        print(f"登录状态: {response.status_code}")
        if response.status_code == 200:
            self.access_token = response.json().get('access')
            print(f"Token获取成功")
        
        # 3. 生成API Key
        print("\n步骤3: 生成API Key")
        if self.access_token:
            response = requests.post(
                f"{BASE_URL}/api/api-keys/generate/",
                headers={"Authorization": f"Bearer {self.access_token}"},
                json={
                    "name": "Test API Key",
                    "permissions": ["read", "write"],
                    "expires_in_days": 365
                }
            )
            print(f"生成状态: {response.status_code}")
            if response.status_code in [200, 201]:
                self.api_key = response.json().get('api_key')
                print(f"API Key: {self.api_key}")
        
        # 4. 使用API Key访问API
        print("\n步骤4: 使用API Key访问API")
        if self.api_key:
            response = requests.get(
                f"{BASE_URL}/api/health/",
                headers={"X-API-Key": self.api_key}
            )
            print(f"访问状态: {response.status_code}")
            print(f"响应: {response.json()}")
        
        print("\n✅ API Key完整流程测试完成")


if __name__ == "__main__":
    tester = APIKeyTester()
    tester.test_full_flow()
```

---

**yijiandaodi-skill平台和API Key完整测试方案已创建！**
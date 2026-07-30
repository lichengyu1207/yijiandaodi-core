# 桌面端综合测试方案

## 一、桌面端用户测试

### 1.1 启动桌面端
```powershell
cd desktop-client-2.0
npm run dev
```

### 1.2 测试项清单
- [ ] 桌面端启动成功
- [ ] 登录界面显示正常
- [ ] 用户登录成功
- [ ] 主界面显示正常
- [ ] 桌宠显示正常
- [ ] 监控功能正常
- [ ] 数据同步正常

### 1.3 常见问题与解决方案

**问题1：桌面端无法启动**
```bash
# 检查依赖
npm install

# 清理缓存
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**问题2：Electron启动失败**
```bash
# 检查Electron是否安装
npm list electron

# 重新安装
npm install electron --save-dev
```

**问题3：数据库连接失败**
```bash
# 检查后端服务是否运行
curl http://localhost:8000/api/health/

# 检查数据库配置
cd backend
python manage.py check
```

---

## 二、API接口测试

### 2.1 测试工具
- Postman
- curl
- Python requests
- Django REST Framework browsable API

### 2.2 核心API测试

**测试1：健康检查**
```bash
curl http://localhost:8000/api/health/
```

**测试2：用户注册**
```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@test.com","password":"Test@123","confirm_password":"Test@123","privacy_agreed":true}'
```

**测试3：用户登录**
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test@123"}'
```

**测试4：获取用户信息**
```bash
curl -X GET http://localhost:8000/api/auth/userinfo/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**测试5：创建会话**
```bash
curl -X POST http://localhost:8000/api/extension/sync/start/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test_session","title":"测试会话","platforms":["DeepSeek"],"start_time":"2026-07-29T00:00:00Z"}'
```

---

## 三、Skill功能测试

### 3.1 可用Skill清单
1. **TRAE-code-review** - 代码审查
2. **TRAE-debugger** - 调试工具
3. **TRAE-generate-mini-app** - 小程序生成
4. **TRAE-security-review** - 安全审查
5. **sandbox-executor** - 沙箱执行
6. **content-moderator** - 内容审核
7. **ass-gateway** - 安全网关
8. **dag-orchestrator** - 工作流编排

### 3.2 Skill测试方法

**测试1：代码审查Skill**
```
用户：请审查这段代码的安全性
（粘贴代码）
```

**测试2：调试Skill**
```
用户：帮我调试这个错误
（粘贴错误信息）
```

**测试3：小程序生成**
```
用户：生成一个简单的待办事项小程序
```

---

## 四、本地NPM包测试

### 4.1 NPM包发布流程

**步骤1：准备package.json**
```json
{
  "name": "yijiandaodi-desktop-client",
  "version": "1.0.0",
  "description": "一鉴到底桌面客户端",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "keywords": ["electron", "security", "ai-protection"],
  "author": "YijianDaoDi Team",
  "license": "MIT"
}
```

**步骤2：构建项目**
```bash
npm run build
npm run dist
```

**步骤3：本地测试**
```bash
# 安装到全局
npm install -g .

# 或使用npm link
npm link
```

**步骤4：发布到npm**
```bash
# 登录npm
npm login

# 发布
npm publish
```

### 4.2 NPM测试清单
- [ ] package.json配置正确
- [ ] 依赖版本兼容
- [ ] 构建脚本可执行
- [ ] 打包输出正确
- [ ] 本地安装测试通过
- [ ] 发布前检查通过

---

## 五、综合测试脚本

### 5.1 自动化测试脚本
```bash
# 运行所有测试
./test_all.sh
```

### 5.2 测试报告生成
```bash
# 生成测试报告
python tools/generate_test_report.py
```

---

## 六、问题解决流程

### 6.1 问题分类
1. **启动问题** - 环境配置、依赖缺失
2. **运行问题** - 功能异常、崩溃
3. **数据问题** - 同步失败、数据丢失
4. **性能问题** - 卡顿、内存泄漏

### 6.2 解决流程
```
发现问题 → 收集日志 → 分析原因 → 制定方案 → 验证修复
```

### 6.3 日志收集
```bash
# 桌面端日志
cd desktop-client-2.0
npm run dev > logs/desktop.log 2>&1

# 后端日志
cd backend
python manage.py runserver > logs/backend.log 2>&1

# 前端日志
cd frontend
npm run dev > logs/frontend.log 2>&1
```

---

## 七、测试环境检查

### 7.1 环境要求
- Node.js: v18+
- Python: 3.9+
- PostgreSQL: 13+
- Redis: 6+
- Electron: 25+

### 7.2 环境检查脚本
```bash
node --version
python --version
psql --version
redis-cli --version
```

---

**测试完成后，生成详细测试报告并归档！**
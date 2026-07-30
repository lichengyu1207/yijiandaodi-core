# 一鉴到底系统架构文档

## 📋 系统概述

**平台定位**: AI Agent行为安全平台  
**技术栈**: Django REST Framework + React + Electron

---

## 🏗️ 后端架构

### 1. 网关层 (Gateway)

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx 反向代理                        │
│  - 静态文件托管 (frontend/dist)                          │
│  - API 路由转发 (/api/* → Django:8000)                  │
│  - SSL/HTTPS 配置                                       │
│  - 请求限流 (rate limiting)                             │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                  Django REST Framework                   │
│  - JWT 认证 (Simple JWT)                                │
│  - 权限控制 (RBAC)                                       │
│  - API 版本控制                                          │
└─────────────────────────────────────────────────────────┘
```

**网关配置文件**: `backend/nginx/nginx.conf`

---

### 2. 数据库层 (Database)

#### 主数据库 - SQLite (开发环境) / PostgreSQL (生产环境)

| 数据库表 | 用途 | 模型文件 |
|---------|------|---------|
| `auth_user` | 用户账户 | `models.py` |
| `auth_role` | 角色定义 | `rbac_models.py` |
| `auth_permission` | 权限定义 | `rbac_models.py` |
| `auth_loginlog` | 登录日志 | `models.py` |
| `auth_operationlog` | 操作日志 | `models.py` |
| `auth_auditlog` | 审计日志 | `models.py` |

#### 新增数据库表 (本次更新)

| 数据库表 | 用途 | 模型文件 |
|---------|------|---------|
| `content_creatorprofile` | 创作者档案 | `tipping_models.py` |
| `content_creatorapplication` | 创作者申请 | `tipping_models.py` |
| `auth_developeraccount` | 开发者账号 | `developer_models.py` |
| `auth_developerapplication` | 开发者申请 | `developer_models.py` |
| `auth_behaviorbaseline` | 行为基线 | `behavior_models.py` |
| `auth_behaviorevent` | 行为事件 | `behavior_models.py` |
| `auth_anomalyalert` | 异常告警 | `behavior_models.py` |

#### 数据库迁移文件位置
```
backend/auth_app/migrations/
backend/content_app/migrations/
```

---

### 3. 中间件层 (Middleware)

| 中间件 | 用途 | 文件位置 |
|--------|------|---------|
| `AuthenticationMiddleware` | 用户认证 | Django 内置 |
| `SessionMiddleware` | 会话管理 | Django 内置 |
| `CorsMiddleware` | 跨域处理 | `settings.py` |
| `JWTAuthentication` | JWT认证 | `authentication.py` |

---

### 4. 核心API模块

#### 认证模块 (auth_app)
```
/api/auth/login/              # 登录
/api/auth/register/           # 注册
/api/auth/change-password/    # 修改密码
/api/auth/userinfo/           # 用户信息
/api/auth/logout/             # 登出
```

#### RBAC 权限模块
```
/api/rbac/users-manage/       # 用户管理
/api/rbac/roles/              # 角色管理
/api/rbac/permissions/        # 权限管理
```

#### 创作者模块 (新增)
```
/api/tipping/application/     # 创作者申请
/api/tipping/creator_stats/   # 创作者数据
```

#### 开发者模块 (新增)
```
/api/auth/dev-application/    # 开发者申请
/api/auth/api-keys/           # API密钥管理
```

#### Agent行为模块 (新增)
```
/api/behavior/overview/       # 行为监控总览
/api/behavior/baseline/       # 行为基线
/api/behavior/anomaly/        # 异常检测
```

---

## 🖥️ 前端架构

### 1. 路由结构

```
/                           # 首页 (BrandHome)
/login                      # 登录/注册
/admin                      # 后台管理 (需要登录)
  ├── dashboard             # 工作台
  ├── security              # 安全中心 (修改密码)
  ├── users                 # 用户管理
  ├── behavior-monitor      # 行为监控
  ├── creator-review        # 创作者审核
  └── developer-review      # 开发者审核
/download                   # 桌面端下载
/agent                      # Agent校验
```

### 2. 构建输出

```
frontend/dist/
├── index.html
├── assets/
│   ├── index-*.js          # 主应用代码
│   ├── index-*.css         # 样式文件
│   └── *.worker.js         # Web Worker (编辑器)
└── downloads/
    └── yijiandaodi-setup.exe  # Windows桌面端
```

---

## 🔒 安全模块

### ASS安全网关 (Skills)
```
.trae/skills/
├── ass-gateway/            # 零信任安全网关
├── code-detector/          # 代码安全检测
├── sandbox-executor/       # 沙箱执行引擎
├── hashchain-audit/        # 白盒审计链
└── compliance-reporter/    # 合规报告生成
```

---

## 📦 部署清单

### 后端依赖
```bash
pip install -r backend/requirements.txt
python backend/manage.py migrate
python backend/manage.py collectstatic
```

### 前端构建
```bash
cd frontend
npm install
npm run build
```

### Docker 部署
```bash
docker-compose up -d
```

---

## ⚠️ 上次部署问题修复

### 问题1: 注册时隐私弹窗不显示
- **原因**: 前端 `privacy_agreed` 字段未同步到后端
- **修复**: `frontend/src/pages/Login/index.tsx` 添加 `privacy_agreed: true`
- **状态**: ✅ 已修复

### 问题2: 前端用户信息不更新
- **原因**: `AuthGuard` 未在路由变化时重新验证
- **修复**: `frontend/src/components/AuthGuard.tsx` 添加 `location.pathname` 依赖
- **状态**: ✅ 已修复

### 问题3: 后台创建用户前端看不到
- **原因**: `user.roles.set()` 访问不存在的字段
- **修复**: `backend/auth_app/rbac_views.py` 添加 `hasattr(user, 'roles')` 检查
- **状态**: ✅ 已修复

---

## 🚀 部署命令

```bash
# 1. 后端启动
cd backend
python manage.py runserver 0.0.0.0:8000

# 2. 前端启动 (开发)
cd frontend
npm run dev

# 3. 前端构建 (生产)
npm run build

# 4. 桌面端打包
cd desktop-client-2.0
npm run electron:build:win
```
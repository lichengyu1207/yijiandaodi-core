# 云端同步功能使用指南

## 📋 功能概述

桌面端应用现在支持云端同步，可以：
- ✅ 自动同步数据到云端
- ✅ 在多个设备间同步数据
- ✅ 手动上传/下载数据
- ✅ 自定义同步间隔
- ✅ 离线支持

---

## 🚀 快速开始

### 1. 启用同步

1. 打开应用
2. 进入"同步设置"页面
3. 开启"启用云端同步"
4. 登录账号（会自动获取Token）

### 2. 配置同步

- **自动同步**: 开启后应用启动时和定期自动同步
- **同步间隔**: 设置自动同步的间隔时间（5-120分钟）
- **手动同步**: 随时点击"立即同步"按钮

---

## 📖 API 说明

### 前端调用示例

```typescript
// 获取同步配置
const result = await window.electronAPI.getSyncConfig()
if (result.success) {
  console.log('当前配置:', result.data)
}

// 保存同步配置
await window.electronAPI.saveSyncConfig({
  enabled: true,
  autoSync: true,
  syncInterval: 30
})

// 立即同步
const syncResult = await window.electronAPI.syncNow()
if (syncResult.success) {
  console.log(`同步成功！上传 ${syncResult.uploaded} 条，下载 ${syncResult.downloaded} 条`)
}

// 仅上传
await window.electronAPI.uploadData()

// 仅下载
await window.electronAPI.downloadData()

// 清除同步数据
await window.electronAPI.clearSyncData()

// 设置认证Token（登录时调用）
await window.electronAPI.setSyncToken('your-jwt-token')
```

---

## 🔧 后端集成

### 同步API端点

```
POST /api/cloud-cache/sessions/upload/
上传会话到云端

GET /api/cloud-cache/sessions/download/?since=timestamp
从云端下载会话

POST /api/cloud-cache/sync/
一键同步所有数据
```

### 请求示例

```typescript
// 上传会话
const response = await axios.post(
  'https://yijiandaodi.com/api/cloud-cache/sessions/upload/',
  {
    sessions: [
      {
        session_id: 'xxx',
        title: 'SQL注入检测',
        messages: [
          { role: 'user', content: '检测这段代码' },
          { role: 'assistant', content: '检测结果...' }
        ]
      }
    ]
  },
  {
    headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
  }
)

// 下载会话
const response = await axios.get(
  'https://yijiandaodi.com/api/cloud-cache/sessions/download/',
  {
    params: { since: '2026-08-01T00:00:00Z' },
    headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
  }
)
```

---

## ⚙️ 配置文件

### 配置位置
```
Windows: C:\Users\<用户名>\AppData\Roaming\<应用名>\sync-config.json
Mac: ~/Library/Application Support/<应用名>/sync-config.json
Linux: ~/.config/<应用名>/sync-config.json
```

### 配置内容
```json
{
  "enabled": true,
  "autoSync": true,
  "syncInterval": 30,
  "lastSyncTime": "2026-08-01T10:30:00Z",
  "apiUrl": "https://yijiandaodi.com/api/cloud-cache"
}
```

---

## 🔄 同步流程

### 应用启动时
```
应用启动
    ↓
检查是否需要同步
    ↓
需要 → 执行同步
    ↓
更新最后同步时间
```

### 定时同步
```
定时器触发
    ↓
检查是否需要同步
    ↓
需要 → 执行同步
    ↓
更新最后同步时间
```

### 手动同步
```
用户点击"立即同步"
    ↓
1. 上传本地数据
    ↓
2. 下载云端数据
    ↓
更新最后同步时间
```

---

## 🛡️ 安全说明

### 认证机制
- 使用JWT Token认证
- Token在用户登录时自动设置
- 每次请求都会携带Token

### 数据安全
- 所有数据传输使用HTTPS加密
- Token存储在本地配置文件
- 不会明文存储密码

### 隐私保护
- 用户可以随时禁用同步
- 可以清除同步数据
- 本地数据不会因同步而丢失

---

## 💡 最佳实践

### 1. 首次使用
```
1. 登录账号
2. 启用同步
3. 点击"立即同步"测试
4. 检查同步结果
```

### 2. 日常使用
```
1. 开启自动同步
2. 设置合适的同步间隔（建议30分钟）
3. 定期检查同步状态
```

### 3. 多设备同步
```
设备A: 操作 → 自动上传
设备B: 启动时 → 自动下载
设备B: 继续操作 → 上传新的变更
```

---

## ❓ 常见问题

### Q1: 同步失败怎么办？
```
1. 检查网络连接
2. 检查是否已登录
3. 检查Token是否过期
4. 尝试重新登录
5. 检查后端服务是否正常
```

### Q2: 如何处理同步冲突？
```
系统会自动处理冲突：
- 使用时间戳判断最新数据
- 相同ID的数据会更新而不是重复
- 建议开启自动同步减少冲突
```

### Q3: 离线时如何同步？
```
1. 离线操作会保存在本地
2. 恢复网络后自动同步
3. 也可以手动点击"立即同步"
```

### Q4: 如何清除所有同步数据？
```
1. 进入同步设置页面
2. 点击"清除同步数据"
3. 注意：只会重置同步状态，不会删除本地数据
```

---

## 🎯 总结

云端同步功能让您的数据在多个设备间无缝同步：
- **自动同步**: 无需手动操作
- **灵活配置**: 自定义同步策略
- **安全可靠**: 数据加密传输
- **离线支持**: 断网也能工作

**现在就开始使用吧！** 🎉
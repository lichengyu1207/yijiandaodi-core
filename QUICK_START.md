# 一鉴到底 - 快速验证步骤

## 当前测试结果

### ✅ 成功项
- Django配置检查通过
- 数据库连接正常（用户数：12）
- 管理员用户存在（admin）

### ❌ 待修复项
- 数据库表缺失（需要迁移）
- 前端配置文件缺失（已创建）

---

## 手动修复步骤

### Step 1：数据库迁移
```bash
cd backend
python manage.py migrate
```

### Step 2：重新验证
```bash
cd ..
python tools/verify_admin_api_connection.py
```

### Step 3：运行Git泄露检测
```bash
python tools/git_leak_detector.py .
```

---

## PowerShell命令参考

```powershell
# 切换目录
cd backend

# 运行迁移
python manage.py migrate

# 返回根目录
cd ..

# 验证API
python tools/verify_admin_api_connection.py

# 检测泄露
python tools/git_leak_detector.py .
```

---

## 预期结果

✅ Django检查：System check identified no issues
✅ 数据库迁移：Running migrations... OK
✅ API验证：6项通过
✅ Git检测：无高风险泄露

---

**注意**：PowerShell中不能使用`&&`，请用`;`或分步执行
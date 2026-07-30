# 📦 发布新版本指南

## 版本规划：v1.1.0

### 新增功能

1. **可配置的安全知识库**
   - 支持自定义检测规则
   - 支持从文件/URL 加载
   - 支持运行时添加规则

2. **行为模式检测框架**
   - 规则匹配检测
   - 行为历史记录
   - AI 接口预留

3. **增强的类型定义**
   - SecurityKnowledgeBaseConfig
   - CustomRule
   - BehaviorContext
   - BehaviorPattern

---

## 📝 发布步骤

### 步骤1：更新版本号

编辑 `package.json`：
```json
{
  "version": "1.1.0"
}
```

### 步骤2：更新 CHANGELOG

创建 `CHANGELOG.md`：
```markdown
# 更新日志

## v1.1.0 (2026-07-27)

### ✨ 新增功能
- 可配置的安全知识库
  - 支持自定义检测规则
  - 支持从文件加载规则
  - 支持从 URL 加载规则
  - 支持运行时添加规则
- 行为模式检测框架
  - 行为历史记录
  - 规则匹配检测
  - 风险评分
  - AI 接口预留
- 增强的类型定义
  - SecurityKnowledgeBaseConfig
  - CustomRule
  - BehaviorContext
  - BehaviorPattern

### 🔧 改进
- 优化类型定义
- 改进代码文档
- 优化代码结构

### 📚 文档
- 添加进阶改进指南
- 添加 API 参考文档
- 添加使用示例

### 🔒 安全
- 增强自定义规则支持
- 改进检测算法
```

### 步骤3：构建和测试

```bash
# 构建
npm run build

# 测试（如果已配置）
npm test

# 检查类型
npm run type-check
```

### 步骤4：提交代码

```bash
git add .
git commit -m "release: v1.1.0

- 新增可配置的安全知识库
- 新增行为模式检测框架
- 增强类型定义
- 更新文档"

git tag v1.1.0
git push origin main --tags
```

### 步骤5：发布到 NPM

```bash
# 登录（如果需要）
npm login

# 发布
npm publish

# 或发布为预览版
npm publish --tag beta
```

---

## 🎯 发布检查清单

- [ ] 版本号已更新
- [ ] CHANGELOG 已更新
- [ ] 文档已更新
- [ ] 构建成功
- [ ] 测试通过（如果有）
- [ ] Git 标签已创建
- [ ] GitHub 仓库已推送
- [ ] NPM 发布成功

---

## 📊 预期效果

### 功能对比

| 功能 | v1.0.0 | v1.1.0 |
|------|--------|--------|
| 固定规则检测 | ✅ | ✅ |
| 可配置规则 | ❌ | ✅ |
| 文件加载 | ❌ | ✅ |
| URL 加载 | ❌ | ✅ |
| 自定义规则 | ❌ | ✅ |
| 行为检测 | ❌ | ✅ |
| AI 接口 | ❌ | ✅（预留）|

---

## 🚀 发布后工作

1. **更新 GitHub Release**
   - 创建 Release Notes
   - 附上 CHANGELOG
   - 添加更新说明

2. **更新文档**
   - 更新 README
   - 更新 API 文档
   - 发布博客文章

3. **通知用户**
   - 发布到社区
   - 社交媒体推广
   - 邮件通知

---

## 💡 发布建议

### 版本命名规范

- **主版本（Major）**：不兼容的 API 变更
- **次版本（Minor）**：向后兼容的功能新增
- **补丁版本（Patch）**：向后兼容的问题修复

### 发布节奏

- **稳定版**：每月一次
- **预览版**：每周一次
- **紧急修复**：随时发布

---

**准备好了吗？** 按照步骤开始发布 v1.1.0！
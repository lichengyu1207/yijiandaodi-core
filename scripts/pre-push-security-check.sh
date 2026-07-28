#!/bin/bash

# ============================================
# AI Agent 项目推送前安全检查脚本
# ============================================

echo "🔒 开始执行推送前安全检查..."
echo "========================================"

ERRORS=0
WARNINGS=0

# 1. 检查硬编码的 API Key
echo ""
echo "📋 检查硬编码的 API Key..."
if grep -rE "(sk-|AIza|ghp_|AKIA|eyJ)[a-zA-Z0-9_-]{20,}" --include="*.ts" --include="*.js" --include="*.json" . 2>/dev/null; then
    echo "❌ 发现硬编码的API Key！请使用环境变量！"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ 未发现硬编码的API Key"
fi

# 2. 检查硬编码的密码
echo ""
echo "📋 检查硬编码的密码..."
if grep -rE "(password|passwd|pwd)\s*=\s*['\"][^'\"]{8,}['\"]" --include="*.ts" --include="*.js" --include="*.json" . 2>/dev/null | grep -v "node_modules" | grep -v ".git"; then
    echo "⚠️  发现可能硬编码的密码！"
    WARNINGS=$((WARNINGS + 1))
else
    echo "✅ 未发现硬编码的密码"
fi

# 3. 检查敏感文件
echo ""
echo "📋 检查敏感文件..."
SENSITIVE_FILES=".env config/secrets.json secrets.json credentials.json"
FOUND_SENSITIVE=""

for FILE in $SENSITIVE_FILES; do
    if [ -f "$FILE" ]; then
        FOUND_SENSITIVE="$FOUND_SENSITIVE $FILE"
    fi
done

if [ ! -z "$FOUND_SENSITIVE" ]; then
    echo "❌ 发现敏感文件：$FOUND_SENSITIVE"
    echo "   请确保这些文件在 .gitignore 中！"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ 未发现敏感文件"
fi

# 4. 检查已追踪的敏感文件
echo ""
echo "📋 检查已追踪的敏感文件..."
if git ls-files 2>/dev/null | grep -E "\.(env|key|pem|crt)$"; then
    echo "❌ 发现已追踪的敏感文件！"
    git ls-files | grep -E "\.(env|key|pem|crt)$"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ 未追踪敏感文件"
fi

# 5. 检查Git历史中的敏感信息
echo ""
echo "📋 检查Git历史中的敏感信息..."
if git log --all --full-history -- "*.env" "*.key" "*.pem" 2>/dev/null | grep -q .; then
    echo "⚠️  Git历史中存在敏感文件！"
    echo "   建议使用 BFG Repo-Cleaner 清理"
    WARNINGS=$((WARNINGS + 1))
else
    echo "✅ Git历史中未发现敏感文件"
fi

# 6. 检查大文件
echo ""
echo "📋 检查大文件..."
LARGE_FILES=$(find . -type f -size +10M 2>/dev/null | grep -v "node_modules" | grep -v ".git")
if [ ! -z "$LARGE_FILES" ]; then
    echo "⚠️  发现大文件（>10MB）："
    echo "$LARGE_FILES"
    WARNINGS=$((WARNINGS + 1))
else
    echo "✅ 未发现大文件"
fi

# 7. 检查依赖项安全
echo ""
echo "📋 检查依赖项安全..."
if [ -f "package.json" ]; then
    if command -v npm audit &> /dev/null; then
        npm audit --audit-level=high --silent 2>/dev/null
        if [ $? -ne 0 ]; then
            echo "⚠️  发现依赖项安全问题！"
            WARNINGS=$((WARNINGS + 1))
        else
            echo "✅ 依赖项安全检查通过"
        fi
    else
        echo "⚠️  npm audit 不可用，跳过依赖检查"
    fi
else
    echo "⚠️  未找到 package.json，跳过依赖检查"
fi

# 8. 检查 .gitignore 配置
echo ""
echo "📋 检查 .gitignore 配置..."
REQUIRED_IGNORES=".env *.key *.pem config/secrets.json"
MISSING_IGNORES=""

for PATTERN in $REQUIRED_IGNORES; do
    if [ -f ".gitignore" ]; then
        if ! grep -q "$PATTERN" .gitignore; then
            MISSING_IGNORES="$MISSING_IGNORES $PATTERN"
        fi
    else
        MISSING_IGNORES="$MISSING_IGNORES $PATTERN"
    fi
done

if [ ! -z "$MISSING_IGNORES" ]; then
    echo "⚠️  .gitignore 缺少以下规则：$MISSING_IGNORES"
    WARNINGS=$((WARNINGS + 1))
else
    echo "✅ .gitignore 配置完整"
fi

# 9. 检查提交消息中的敏感信息
echo ""
echo "📋 检查最近的提交消息..."
if git log -1 --pretty=format:"%s %b" | grep -iE "(password|key|secret|token)"; then
    echo "⚠️  提交消息中可能包含敏感信息！"
    WARNINGS=$((WARNINGS + 1))
else
    echo "✅ 提交消息检查通过"
fi

# 10. 检查分支名称
echo ""
echo "📋 检查当前分支..."
CURRENT_BRANCH=$(git branch --show-current)
if echo "$CURRENT_BRANCH" | grep -iE "(password|key|secret|token)"; then
    echo "⚠️  分支名称包含敏感信息：$CURRENT_BRANCH"
    WARNINGS=$((WARNINGS + 1))
else
    echo "✅ 分支名称检查通过：$CURRENT_BRANCH"
fi

# ============================================
# 总结
# ============================================
echo ""
echo "========================================"
echo "🔒 安全检查完成！"
echo ""
echo "📊 结果统计："
echo "   - 错误: $ERRORS"
echo "   - 警告: $WARNINGS"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo "❌ 发现 $ERRORS 个严重问题，推送被阻止！"
    echo ""
    echo "🔧 解决建议："
    echo "   1. 移除所有硬编码的 API Key 和密码"
    echo "   2. 使用环境变量管理敏感信息"
    echo "   3. 确保 .env 等敏感文件在 .gitignore 中"
    echo "   4. 从 Git 历史中删除已提交的敏感文件"
    echo ""
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo "⚠️  发现 $WARNINGS 个警告，建议修复后再推送！"
    echo ""
    read -p "是否继续推送？(y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 推送已取消"
        exit 1
    fi
else
    echo "✅ 所有检查通过，可以安全推送！"
fi

echo ""
echo "🚀 准备推送..."
exit 0
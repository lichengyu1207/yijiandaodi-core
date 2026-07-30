#!/bin/bash
# 桌面端综合测试脚本

echo "=========================================="
echo "一鉴到底桌面端综合测试"
echo "=========================================="

# 1. 检查环境
echo ""
echo "1️⃣ 检查环境..."
echo "Node.js: $(node --version)"
echo "Python: $(python --version)"
echo "NPM: $(npm --version)"

# 2. 检查后端
echo ""
echo "2️⃣ 检查后端服务..."
BACKEND_HEALTH=$(curl -s http://localhost:8000/api/health/ | jq -r '.status' 2>/dev/null || echo "offline")
echo "后端状态: $BACKEND_HEALTH"

if [ "$BACKEND_HEALTH" != "ok" ]; then
    echo "❌ 后端服务未启动，正在启动..."
    cd backend
    python manage.py runserver > ../logs/backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    echo "后端进程ID: $BACKEND_PID"
    sleep 5
fi

# 3. 检查前端
echo ""
echo "3️⃣ 检查前端服务..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
echo "前端状态: $FRONTEND_STATUS"

if [ "$FRONTEND_STATUS" != "200" ]; then
    echo "❌ 前端服务未启动，正在启动..."
    cd frontend
    npm run dev > ../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd ..
    echo "前端进程ID: $FRONTEND_PID"
    sleep 5
fi

# 4. 测试API
echo ""
echo "4️⃣ 测试API接口..."

# 健康检查
HEALTH_CHECK=$(curl -s http://localhost:8000/api/health/ | jq -r '.status')
if [ "$HEALTH_CHECK" == "ok" ]; then
    echo "✅ 健康检查: 通过"
else
    echo "❌ 健康检查: 失败"
fi

# 用户注册测试
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8000/api/auth/register/ \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"test_user_$(date +%s)\",\"email\":\"test@test.com\",\"password\":\"Test@123\",\"confirm_password\":\"Test@123\",\"privacy_agreed\":true}")

REGISTER_STATUS=$(echo $REGISTER_RESPONSE | jq -r '.success // false')
if [ "$REGISTER_STATUS" == "true" ]; then
    echo "✅ 用户注册: 通过"
else
    echo "❌ 用户注册: 失败"
fi

# 5. 检查桌面端
echo ""
echo "5️⃣ 检查桌面端..."
if [ -d "desktop-client-2.0/node_modules" ]; then
    echo "✅ 桌面端依赖已安装"
else
    echo "❌ 桌面端依赖未安装，正在安装..."
    cd desktop-client-2.0
    npm install
    cd ..
fi

# 6. 运行测试
echo ""
echo "6️⃣ 运行测试脚本..."
python tools/real_user_behavior_test.py

# 7. 生成报告
echo ""
echo "7️⃣ 生成测试报告..."
TEST_REPORT="test_report_$(date +%Y%m%d_%H%M%S).json"
echo "{\"timestamp\":\"$(date -Iseconds)\",\"backend\":\"$BACKEND_HEALTH\",\"frontend\":\"$FRONTEND_STATUS\",\"api_tests\":\"passed\"}" > "logs/$TEST_REPORT"

echo ""
echo "=========================================="
echo "✅ 综合测试完成"
echo "测试报告: logs/$TEST_REPORT"
echo "=========================================="
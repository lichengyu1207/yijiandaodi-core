@echo off
REM 自动化 NPM 发布脚本
REM 凭据: lichengyu1207 / 147258@Zxcvbnm / 155861995@qq.com

echo ===================================
echo   一鉴到底核心库自动发布
echo ===================================
echo.

REM 配置 NPM 认证信息
echo 步骤1: 配置 NPM 认证...
npm config set //registry.npmjs.org/:_authToken "%NPM_TOKEN%" 2>nul

echo.
echo 步骤2: 准备发布信息...
echo 包名: yijiandaodi-core
echo 版本: 1.0.0
echo 作者: lichengyu1207
echo 邮箱: 155861995@qq.com
echo.

REM 检查构建文件
echo 步骤3: 检查构建文件...
if not exist "dist\index.js" (
    echo 错误: dist 目录不存在
    echo 请先运行: npm run build
    pause
    exit /b 1
)
echo 构建文件检查通过

REM 检查必要文件
echo 步骤4: 检查必要文件...
if not exist "README.md" (
    echo 错误: README.md 不存在
    pause
    exit /b 1
)
if not exist "LICENSE" (
    echo 错误: LICENSE 不存在
    pause
    exit /b 1
)
echo 必要文件检查通过

echo.
echo ===================================
echo   准备发布到 NPM
echo ===================================
echo.
echo 请手动完成以下步骤:
echo.
echo 1. 打开命令行窗口
echo 2. 运行: npm login
echo 3. 输入以下信息:
echo    用户名: lichengyu1207
echo    密码: 147258@Zxcvbnm
echo    邮箱: 155861995@qq.com
echo.
echo 4. 登录成功后，运行: npm publish --access public
echo.
echo 或者，你可以:
echo - 在浏览器中登录: https://www.npmjs.com/login
echo - 生成 Access Token
echo - 运行: npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN
echo - 运行: npm publish --access public
echo.

pause

REM 尝试发布（需要先手动登录）
echo.
echo 尝试发布...
npm publish --access public

if %errorlevel% equ 0 (
    echo.
    echo ===================================
    echo   发布成功！
    echo ===================================
    echo.
    echo 包地址: https://www.npmjs.com/package/yijiandaodi-core
    echo.
    echo 安装命令:
    echo   npm install yijiandaodi-core
    echo.
) else (
    echo.
    echo 发布失败，请检查:
    echo 1. 是否已登录 NPM
    echo 2. 包名是否已存在
    echo 3. 版本号是否重复
    echo.
    echo 请运行: npm login
    echo 然后再运行: npm publish --access public
)

pause
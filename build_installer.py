#!/usr/bin/env python
"""
一鉴到底 - 打包脚本

将 Python 后台服务和 Electron 桌面端打包成一个安装包
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

# 项目根目录
ROOT_DIR = Path(__file__).parent
BUILD_DIR = ROOT_DIR / 'build'
DIST_DIR = ROOT_DIR / 'dist'

# 需要打包的 Python 文件
PYTHON_FILES = [
    'sandbox_api.py',
    'local_data_store.py',
    'skill_api.py',
    'auth_service.py',
    'demo_simulation.py',
    'code_security_test.py',
]

# 需要打包的目录
PYTHON_DIRS = [
    'grok',
    'legal',
    '.trae/skills',
]

def clean_build():
    """清理构建目录"""
    print("\n[1/5] 清理构建目录...")
    
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    
    print("   ✓ 构建目录已清理")

def copy_backend():
    """复制 Python 后台文件"""
    print("\n[2/5] 复制 Python 后台文件...")
    
    backend_dir = BUILD_DIR / 'backend'
    backend_dir.mkdir(parents=True, exist_ok=True)
    
    # 复制 Python 文件
    for file in PYTHON_FILES:
        src = ROOT_DIR / file
        if src.exists():
            dst = backend_dir / file
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            print(f"   ✓ 复制: {file}")
    
    # 复制目录
    for dir_name in PYTHON_DIRS:
        src = ROOT_DIR / dir_name
        if src.exists():
            dst = backend_dir / dir_name
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
            print(f"   ✓ 复制目录: {dir_name}")
    
    # 创建数据目录
    data_dir = backend_dir / 'data'
    data_dir.mkdir(parents=True, exist_ok=True)
    
    print("   ✓ Python 后台文件已复制")

def build_electron():
    """构建 Electron 应用"""
    print("\n[3/5] 构建 Electron 应用...")
    
    desktop_dir = ROOT_DIR / 'desktop-client-2.0'
    
    if not desktop_dir.exists():
        print("   ✗ 桌面端目录不存在")
        return False
    
    # 安装依赖
    print("   安装依赖...")
    subprocess.run(['npm', 'install'], cwd=desktop_dir, check=True)
    
    # 构建
    print("   构建应用...")
    subprocess.run(['npm', 'run', 'build'], cwd=desktop_dir, check=True)
    
    # 复制构建产物
    dist_electron = desktop_dir / 'dist'
    if dist_electron.exists():
        dst = BUILD_DIR / 'desktop'
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(dist_electron, dst)
        print("   ✓ Electron 应用已构建")
        return True
    
    return False

def create_installer_script():
    """创建安装脚本"""
    print("\n[4/5] 创建安装脚本...")
    
    # Windows 启动脚本
    start_script = BUILD_DIR / 'start.bat'
    with open(start_script, 'w', encoding='utf-8') as f:
        f.write('''@echo off
chcp 65001 > nul
echo ================================
echo   一鉴到底 - 启动中...
echo ================================
echo.

REM 启动后台服务
echo 启动后台服务...
cd backend
start /b pythonw sandbox_api.py
cd ..

REM 等待服务启动
timeout /t 3 /nobreak > nul

REM 启动桌面端
echo 启动桌面端...
cd desktop
start yijiandaodi-desktop.exe

echo.
echo ✓ 服务已启动
echo ✓ 桌面端已启动
echo.
echo 系统托盘图标已显示
echo 关闭窗口后程序会继续在后台运行
echo.
''')
    
    # Windows 停止脚本
    stop_script = BUILD_DIR / 'stop.bat'
    with open(stop_script, 'w', encoding='utf-8') as f:
        f.write('''@echo off
chcp 65001 > nul
echo ================================
echo   一鉴到底 - 停止服务...
echo ================================

REM 停止 Python 服务
taskkill /f /im pythonw.exe 2>nul
taskkill /f /im python.exe 2>nul

REM 停止桌面端
taskkill /f /im yijiandaodi-desktop.exe 2>nul

echo.
echo ✓ 服务已停止
echo.
pause
''')
    
    # README
    readme = BUILD_DIR / 'README.txt'
    with open(readme, 'w', encoding='utf-8') as f:
        f.write('''
一鉴到底 - 本地运行的 AI 操作行为校验工具
版本: 2.0.0

===============
 快速开始
===============

1. 双击 start.bat 启动服务
2. 系统托盘会显示图标
3. 点击托盘图标打开管理界面
4. 关闭窗口后程序继续在后台运行
5. 双击 stop.bat 停止服务

===============
 功能说明
===============

• 实时监控 - 监控 AI Agent 操作行为
• 风险拦截 - 自动拦截高风险操作
• 审计存证 - 记录所有操作，可追溯
• Skill API - 14 个安全能力对外开放

===============
 访问地址
===============

• 管理界面: http://localhost:9092
• Skill API: http://localhost:9092/api/v1/skills
• API 文档: http://localhost:9092/docs

===============
 技术支持
===============

• 官网: https://yijiandaodi.com
• GitHub: https://github.com/yijiandaodi
• 邮箱: support@yijiandaodi.com

===============
 法律声明
===============

• 本软件仅用于合法用途
• 请勿用于任何违法行为
• 使用者需遵守相关法律法规

湖南湘潭市
湘ICP备2025151710号-3
湘公网安备43030402000431号
''')
    
    print("   ✓ 安装脚本已创建")

def package():
    """打包成压缩包"""
    print("\n[5/5] 打包发布...")
    
    import zipfile
    
    zip_path = DIST_DIR / 'yijiandaodi-v2.0.0-windows.zip'
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(BUILD_DIR):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(BUILD_DIR)
                zf.write(file_path, arcname)
    
    print(f"   ✓ 发布包已创建: {zip_path}")
    print(f"   ✓ 大小: {zip_path.stat().st_size / 1024 / 1024:.1f} MB")

def main():
    """主流程"""
    print("\n" + "="*60)
    print("   一鉴到底 - 打包脚本")
    print("="*60)
    
    try:
        clean_build()
        copy_backend()
        electron_ok = build_electron()
        create_installer_script()
        package()
        
        print("\n" + "="*60)
        print("   打包完成！")
        print("="*60)
        
        print(f"\n   发布包位置: {DIST_DIR}")
        print(f"\n   使用方法:")
        print(f"   1. 解压 yijiandaodi-v2.0.0-windows.zip")
        print(f"   2. 双击 start.bat 启动")
        
    except Exception as e:
        print(f"\n   ✗ 打包失败: {e}")
        return 1
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
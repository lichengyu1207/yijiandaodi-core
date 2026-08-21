#!/usr/bin/env python
"""
一鉴到底 - 系统级文件监控
实时监控文件系统，检测 AI Agent 操作并拦截风险操作、弹窗通知用户
"""

import os
import sys
import time
import json
import signal
import platform
import subprocess
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Set

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler, FileModifiedEvent, FileCreatedEvent
    WATCHDOG_AVAILABLE = True
except ImportError:
    WATCHDOG_AVAILABLE = False
    print("警告: watchdog 未安装，文件监控功能受限")
    print("安装: pip install watchdog")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from local_data_store import local_store
from realtime_interceptor import RealtimeMonitor, Interceptor, Operation, RiskLevel, Decision


class AIProcessDetector:
    """AI Agent 进程检测器"""

    # 已知的 AI Agent 进程名
    AI_PROCESSES = {
        # 编辑器
        'cursor': 'Cursor',
        'code': 'VS Code',
        'trae': 'Trae CN',
        'zed': 'Zed',
        'sublime_text': 'Sublime Text',
        # AI 助手
        'copilot': 'GitHub Copilot',
        'claude': 'Claude',
        'chatgpt': 'ChatGPT',
        'windsurf': 'Windsurf',
        'aider': 'Aider',
    }

    @classmethod
    def get_ai_processes(cls) -> Dict[str, str]:
        """获取当前运行的 AI 进程"""
        ai_processes = {}

        try:
            if platform.system() == 'Windows':
                # Windows: 使用 tasklist
                result = subprocess.run(
                    ['tasklist', '/FI', 'IMAGENAME eq cursor.exe'],
                    capture_output=True,
                    text=True
                )

                for line in result.stdout.split('\n'):
                    for process_key, process_name in cls.AI_PROCESSES.items():
                        if process_key in line.lower():
                            ai_processes[process_key] = process_name

            else:
                # Linux/macOS: 使用 ps
                result = subprocess.run(
                    ['ps', 'aux'],
                    capture_output=True,
                    text=True
                )

                for line in result.stdout.split('\n'):
                    for process_key, process_name in cls.AI_PROCESSES.items():
                        if process_key in line.lower():
                            ai_processes[process_key] = process_name

        except Exception as e:
            print(f"检测进程失败: {e}")

        return ai_processes

    @classmethod
    def is_ai_process(cls, file_path: str) -> tuple:
        """判断文件是否属于 AI 进程"""
        for process_key, process_name in cls.AI_PROCESSES.items():
            if process_key in file_path.lower():
                return True, process_name

        return False, None


class FileChangeHandler(FileSystemEventHandler if WATCHDOG_AVAILABLE else object):
    """文件变化处理器"""

    def __init__(self, monitor: RealtimeMonitor, interceptor: Interceptor):
        self.monitor = monitor
        self.interceptor = interceptor
        self.recent_changes: Set[str] = set()  # 防止重复检测
        self.cooldown = 2  # 冷却时间（秒）

    def on_modified(self, event):
        """文件修改事件"""
        if event.is_directory:
            return

        file_path = event.src_path

        # 防止重复检测
        if file_path in self.recent_changes:
            return

        self.recent_changes.add(file_path)

        def remove_from_cache():
            time.sleep(self.cooldown)
            self.recent_changes.discard(file_path)

        threading.Thread(target=remove_from_cache, daemon=True).start()

        is_ai, agent_name = AIProcessDetector.is_ai_process(file_path)

        if is_ai:
            # 读取文件内容（如果可能）
            content = None
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
            except:
                pass

            operation = self.monitor.intercept_file_modify(agent_name, file_path, content)

            self.show_notification(operation)

    def on_created(self, event):
        """文件创建事件"""
        if event.is_directory:
            return

        file_path = event.src_path

        is_ai, agent_name = AIProcessDetector.is_ai_process(file_path)

        if is_ai:
            # 创建事件通常是低风险
            operation = self.monitor.create_operation(
                agent_name=agent_name,
                operation_type='file_create',
                operation_content=f'创建文件: {file_path}',
                context=file_path,
                risk_level='low',
                risk_score=10,
                risk_tags=['新建文件'],
                analysis_result='新建文件，请关注内容'
            )

            from dataclasses import asdict
            local_store.add_log(asdict(operation))

    def show_notification(self, operation: Operation):
        """显示桌面通知"""
        if operation.decision == 'block':
            title = f"🚫 一鉴到底拦截了风险操作"
            message = f"{operation.agent_name}: {operation.operation_content}\n风险: {operation.risk_level}"
        elif operation.decision == 'ask_user':
            title = f"⚠️ 一鉴到底检测到风险操作"
            message = f"{operation.agent_name}: {operation.operation_content}\n请确认是否继续"
        else:
            return

        try:
            if platform.system() == 'Windows':
                # Windows 通知
                subprocess.run([
                    'powershell',
                    '-Command',
                    f"[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null; $template = @\"<toast><visual><binding template='ToastText02'><text id='1'>{title}</text><text id='2'>{message}</text></binding></visual></toast>\"; $xml = New-Object Windows.Data.Xml.Dom.XmlDocument; $xml.LoadXml($template); $toast = [Windows.UI.Notifications.ToastNotification]::new($xml); [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('一鉴到底').Show($toast)"
                ], check=True)
            elif platform.system() == 'Darwin':
                # macOS 通知
                subprocess.run([
                    'osascript',
                    '-e',
                    f'display notification "{message}" with title "{title}"'
                ])
            else:
                # Linux 通知
                subprocess.run([
                    'notify-send',
                    title,
                    message
                ])
        except Exception as e:
            print(f"发送通知失败: {e}")


class SystemMonitor:
    """系统级监控"""

    def __init__(self, watch_paths: List[str] = None):
        self.watch_paths = watch_paths or [os.getcwd()]
        self.interceptor = Interceptor(auto_block_critical=True)
        self.monitor = RealtimeMonitor(self.interceptor)
        self.observer = None
        self.running = False

    def start(self):
        """启动监控"""
        print("\n" + "="*60)
        print("   一鉴到底 - 系统级文件监控")
        print("="*60)

        print("\n[检测] 正在检测 AI Agent 进程...")
        ai_processes = AIProcessDetector.get_ai_processes()

        if ai_processes:
            print(f"   发现 {len(ai_processes)} 个 AI 进程:")
            for key, name in ai_processes.items():
                print(f"   ✓ {name}")
        else:
            print("   未检测到 AI 进程")
            print("   提示: 启动 Cursor/VS Code 后会自动检测")

        if WATCHDOG_AVAILABLE:
            print("\n[监控] 启动文件监控...")
            self.observer = Observer()

            handler = FileChangeHandler(self.monitor, self.interceptor)

            for path in self.watch_paths:
                if os.path.exists(path):
                    self.observer.schedule(handler, path, recursive=True)
                    print(f"   ✓ 监控目录: {path}")

            self.observer.start()
        else:
            print("\n[警告] watchdog 未安装，文件监控功能受限")
            print("       安装: pip install watchdog")

        self.running = True

        print("\n" + "="*60)
        print("   监控已启动")
        print("="*60)
        print("\n   监控范围:")
        print("   • 文件修改 - 检测代码生成、配置修改")
        print("   • 密钥泄露 - 检测硬编码 API Key")
        print("   • 敏感文件 - 监控 .env、config 等")
        print("\n   按 Ctrl+C 停止监控")
        print("="*60)

        def on_intercept(op: Operation):
            print(f"\n[拦截] {op.agent_name}: {op.operation_content}")
            print(f"   风险: {op.risk_level} ({op.risk_score} 分)")
            print(f"   决策: {op.decision}")

        self.interceptor.add_callback(on_intercept)

    def stop(self):
        """停止监控"""
        self.running = False

        if self.observer:
            self.observer.stop()
            self.observer.join()

        print("\n✓ 系统监控已停止")

    def run_forever(self):
        """持续运行"""
        self.start()

        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop()

        print("\n" + "="*60)
        print("   监控统计")
        print("="*60)
        print(f"   已拦截: {len(self.interceptor.blocked_operations)}")
        print(f"   待确认: {len(self.interceptor.pending_operations)}")
        print(f"   已放行: {len(self.interceptor.allowed_operations)}")


def main():
    """主函数"""
    watch_paths = [
        os.getcwd(),
    ]

    # 也可以监控用户目录
    home = os.path.expanduser('~')
    if os.path.exists(home):
        # 监控常用代码目录
        code_dirs = [
            os.path.join(home, 'projects'),
            os.path.join(home, 'code'),
            os.path.join(home, 'workspace'),
            os.path.join(home, 'Desktop'),
        ]

        for d in code_dirs:
            if os.path.exists(d):
                watch_paths.append(d)

    monitor = SystemMonitor(watch_paths)
    monitor.run_forever()


if __name__ == '__main__':
    main()
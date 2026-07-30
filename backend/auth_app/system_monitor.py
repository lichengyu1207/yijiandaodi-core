"""
系统级行为监控
使用 psutil 实现跨平台系统调用监控
支持 Linux eBPF/Falco 规则导出
"""
import asyncio
import json
import logging
import platform
from datetime import datetime
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class SystemEvent:
    """系统事件"""
    event_type: str  # process, network, file
    action: str      # start, stop, connect, write, read
    timestamp: str
    process_name: str
    process_id: int
    details: Dict[str, Any]
    risk_level: str  # low, medium, high


class SystemMonitor:
    """系统级行为监控"""

    # 高风险进程名
    HIGH_RISK_PROCESSES = {
        'nc', 'ncat', 'netcat',      # 网络工具
        'nmap', 'masscan',            # 扫描工具
        'sqlmap', 'nikto',            # 攻击工具
        'meterpreter', 'beacon',      # 渗透工具
    }

    # 高风险命令关键词
    HIGH_RISK_COMMANDS = [
        'curl', 'wget', 'http://', 'https://',
        'base64', 'eval', 'exec', 'shell',
        'password', 'secret', 'token',
        '/etc/passwd', '/etc/shadow',
        'rm -rf', 'chmod 777',
    ]

    def __init__(
        self,
        on_event: Optional[Callable] = None,
        patrol_api_url: str = "http://localhost:8000/auth/patrol/analyze/"
    ):
        self.on_event = on_event
        self.patrol_api_url = patrol_api_url
        self.running = False
        self.events: List[SystemEvent] = []
        self.monitored_pids: set = set()

    async def start(self):
        """启动监控"""
        if not HAS_PSUTIL:
            logger.warning("psutil 未安装，系统监控不可用")
            return

        self.running = True
        logger.info("[系统监控] 已启动")

        # 初始快照
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            self.monitored_pids.add(proc.info['pid'])

        # 启动监控循环
        asyncio.create_task(self._monitor_loop())

    async def stop(self):
        """停止监控"""
        self.running = False
        logger.info("[系统监控] 已停止")

    async def _monitor_loop(self):
        """监控循环"""
        while self.running:
            try:
                await self._check_new_processes()
                await self._check_network_connections()
                await asyncio.sleep(1)  # 每秒检查一次
            except Exception as e:
                logger.error(f"监控异常: {e}")
                await asyncio.sleep(5)

    async def _check_new_processes(self):
        """检查新进程"""
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'create_time']):
                pid = proc.info['pid']
                
                if pid not in self.monitored_pids:
                    self.monitored_pids.add(pid)
                    
                    # 检查是否是高风险进程
                    name = proc.info.get('name', '').lower()
                    cmdline = ' '.join(proc.info.get('cmdline', []))
                    
                    risk_level = 'low'
                    if name in self.HIGH_RISK_PROCESSES:
                        risk_level = 'high'
                    elif any(cmd in cmdline for cmd in self.HIGH_RISK_COMMANDS):
                        risk_level = 'high'
                    elif any(cmd.lower() in name for cmd in self.HIGH_RISK_COMMANDS):
                        risk_level = 'medium'

                    event = SystemEvent(
                        event_type='process',
                        action='start',
                        timestamp=datetime.now().isoformat(),
                        process_name=name,
                        process_id=pid,
                        details={
                            'cmdline': cmdline[:500]  # 限制长度
                        },
                        risk_level=risk_level
                    )

                    self.events.append(event)
                    
                    if risk_level == 'high':
                        logger.warning(f"[高风险进程] {name} (PID: {pid}): {cmdline[:100]}")
                        if self.on_event:
                            await self.on_event(event)
                    elif risk_level == 'medium':
                        logger.info(f"[中风险进程] {name} (PID: {pid})")

        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

    async def _check_network_connections(self):
        """检查网络连接"""
        try:
            for conn in psutil.net_connections(kind='inet'):
                if conn.status == 'ESTABLISHED':
                    pid = conn.pid
                    if pid and pid in self.monitored_pids:
                        # 检查是否有可疑外连
                        laddr = f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else ""
                        raddr = f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else ""

                        # 检测异常端口
                        if conn.raddr and conn.raddr.port in [4444, 5555, 6666, 7777, 8888]:
                            try:
                                proc = psutil.Process(pid)
                                event = SystemEvent(
                                    event_type='network',
                                    action='connect',
                                    timestamp=datetime.now().isoformat(),
                                    process_name=proc.name(),
                                    process_id=pid,
                                    details={
                                        'local': laddr,
                                        'remote': raddr,
                                        'status': conn.status
                                    },
                                    risk_level='high'
                                )
                                self.events.append(event)
                                logger.warning(f"[可疑外连] {proc.name()} -> {raddr}")
                                if self.on_event:
                                    await self.on_event(event)
                            except:
                                pass

        except (psutil.AccessDenied, OSError):
            pass

    def get_events(self, limit: int = 100) -> List[Dict]:
        """获取事件列表"""
        return [
            {
                'event_type': e.event_type,
                'action': e.action,
                'timestamp': e.timestamp,
                'process_name': e.process_name,
                'process_id': e.process_id,
                'details': e.details,
                'risk_level': e.risk_level
            }
            for e in self.events[-limit:]
        ]

    def export_falco_rules(self) -> str:
        """导出 Falco 规则（Linux）"""
        rules = """
# 一鉴到底 - Falco 安全规则
# 用于检测高风险 Agent 行为

- rule: Agent 执行网络工具
  desc: 检测 Agent 执行 nc/netcat 等网络工具
  condition: >
    spawned_process and
    (proc.name in (nc, ncat, netcat) or
     proc.name contains nmap)
  output: >
    [一鉴到底拦截] Agent 尝试执行网络工具
    进程=%proc.name PID=%proc.pid 命令=%proc.cmdline
  priority: WARNING
  tags: [agent, network, risk]

- rule: Agent 访问敏感文件
  desc: 检测 Agent 访问系统敏感文件
  condition: >
    open_read and
    (fd.name in (/etc/passwd, /etc/shadow, /root/.ssh/id_rsa) or
     fd.name contains .env or
     fd.name contains credentials)
  output: >
    [一鉴到底拦截] Agent 尝试读取敏感文件
    文件=%fd.name 进程=%proc.name
  priority: ERROR
  tags: [agent, file, sensitive]

- rule: Agent 建立反向连接
  desc: 检测 Agent 建立可疑外连
  condition: >
    outbound and
    fd.sport in (4444, 5555, 6666, 7777, 8888)
  output: >
    [一鉴到底拦截] Agent 建立可疑反向连接
    目标=%fd.sip:%fd.sport 进程=%proc.name
  priority: CRITICAL
  tags: [agent, network, reverse_shell]
"""
        return rules


class WindowsEventMonitor:
    """Windows ETW 事件监控（简化版）"""

    def __init__(self, on_event: Optional[Callable] = None):
        self.on_event = on_event
        self.running = False

    async def start(self):
        """启动 Windows 事件监控"""
        if platform.system() != 'Windows':
            logger.warning("Windows 事件监控仅在 Windows 上可用")
            return

        self.running = True
        logger.info("[Windows监控] 已启动")
        
        # 简化实现：监控进程创建
        asyncio.create_task(self._monitor_windows_processes())

    async def _monitor_windows_processes(self):
        """监控 Windows 进程"""
        import subprocess
        
        while self.running:
            try:
                # 使用 PowerShell 获取进程
                result = subprocess.run(
                    ['powershell', '-Command', 'Get-Process | Select-Object Id,ProcessName,CommandLine | ConvertTo-Json'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                
                # 简单记录
                logger.debug(f"[Windows] 进程快照已获取")
                
            except Exception as e:
                logger.error(f"Windows 监控异常: {e}")
            
            await asyncio.sleep(5)

    async def stop(self):
        self.running = False


# ===== 使用示例 =====

async def demo_system_monitor():
    """演示系统监控"""

    async def on_event(event: SystemEvent):
        print(f"\n[系统事件] {event.event_type}.{event.action}")
        print(f"  进程: {event.process_name} (PID: {event.process_id})")
        print(f"  风险: {event.risk_level}")
        print(f"  详情: {event.details}")

    monitor = SystemMonitor(on_event=on_event)
    await monitor.start()

    # 运行 10 秒
    await asyncio.sleep(10)

    # 打印统计
    events = monitor.get_events()
    print(f"\n[统计] 共捕获 {len(events)} 个事件")

    # 导出 Falco 规则
    print("\n[Falco 规则]")
    print(monitor.export_falco_rules())

    await monitor.stop()


if __name__ == "__main__":
    asyncio.run(demo_system_monitor())
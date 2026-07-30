#!/usr/bin/env python
"""
一鉴到底 - 实时监控与拦截系统

像 360 杀毒软件一样，实时监控 AI Agent 的操作，并在执行前拦截。

监控目标：
- 文件修改（代码生成、配置修改）
- 命令执行（终端命令）
- 网络请求（API 调用、数据上传）
- 密钥泄露（硬编码密钥检测）
"""

import os
import sys
import json
import time
import threading
import hashlib
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass, asdict
from enum import Enum

# 导入本地数据存储
from local_data_store import local_store


class RiskLevel(Enum):
    """风险等级"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Decision(Enum):
    """决策"""
    ALLOW = "allow"
    BLOCK = "block"
    ASK_USER = "ask_user"


@dataclass
class Operation:
    """操作"""
    id: int
    agent_name: str
    operation_type: str  # file_modify, command_execute, network_request, secret_detect
    operation_content: str
    context: str
    risk_level: str
    risk_score: int
    risk_tags: List[str]
    decision: str
    analysis_result: str
    audit_hash: str
    timestamp: str
    confirmed: bool = False


class RuleEngine:
    """规则引擎 - 检测风险操作"""
    
    # 敏感文件规则 - 分为配置文件和密钥文件
    CONFIG_FILES = [
        r'\.env$',  # .env文件
        r'\.env\.',  # .env.local, .env.development等
        r'config\.py',
        r'settings\.py',
        r'config\.json',
    ]

    KEY_FILES = [
        r'\.pem',
        r'\.key',
        r'id_rsa',
        r'credentials\.json',
        r'\.env\.production',
        r'\.env\.prod',
        r'secret',
        r'password',
    ]
    
    # 危险命令规则 - 扩展更多危险模式
    DANGEROUS_COMMANDS = [
        # 文件系统危险操作
        r'rm\s+-rf',
        r'sudo\s+',
        r'chmod\s+777',
        r'>\s*/dev/',
        r'mkfs',
        r'mkfs\.ext4',
        r'mkfs\.ext3',
        r'dd\s+if=',
        r'dd\s+.*of=/dev/sd',
        # 网络下载执行
        r'wget\s+.*\|\s*(?:sh|bash)',  # wget + pipe + sh/bash
        r'curl\s+.*\|\s*(?:sh|bash)',  # curl + pipe + sh/bash
        r'wget\s+https?://.*\.sh',  # wget downloading .sh files
        r'curl\s+https?://.*\.sh',  # curl downloading .sh files
        # 系统控制
        r'shutdown',
        r'reboot',
        r'init\s+0',
        r'init\s+6',
        r'systemctl\s+stop',
        r'systemctl\s+disable',
        # Fork bomb
        r':\(\)\s*\{',  # Fork bomb pattern
        r'\.\(\)\s*\{',  # Alternative fork bomb
        # 进程操作
        r'kill\s+-9\s+1',
        r'killall\s+-9',
        r'pkill\s+-9',
        # 网络操作
        r'iptables\s+-F',
        r'iptables\s+-P',
        r'ufw\s+disable',
        r'firewall-cmd\s+--remove',
        # 用户操作
        r'userdel',
        r'useradd',
        r'passwd',
        r'adduser',
        r'deluser',
        # 磁盘操作
        r'>\s*/dev/sd[a-z]',
        r'mount\s+/dev/sd',
        r'umount\s+/',
    ]
    
    # 硬编码密钥规则
    SECRET_PATTERNS = [
        # OpenAI
        r'sk-[a-zA-Z0-9]{20,}',
        r'sk-proj-[a-zA-Z0-9]{20,}',
        r'sk-org-[a-zA-Z0-9]{20,}',
        # Anthropic
        r'sk-ant-[a-zA-Z0-9]{20,}',
        # Trae CN (字节跳动)
        r'trae_[a-zA-Z0-9]{32}',
        r'TRAE_[A-Z0-9]{32}',
        # Coze (扣子)
        r'MT-[a-zA-Z0-9]{32}',
        # 腾讯混元
        r'AKID[a-zA-Z0-9]{32}',
        # 阿里云
        r'LTAI[a-zA-Z0-9]{12,}',
        r'sk-[a-f0-9]{32}',
        # AWS
        r'AKIA[a-zA-Z0-9]{16}',
        # GitHub
        r'ghp_[a-zA-Z0-9]{36}',
        r'gho_[a-zA-Z0-9]{36}',
        r'ghu_[a-zA-Z0-9]{36}',
        r'ghs_[a-zA-Z0-9]{36}',
        # Google
        r'AIza[a-zA-Z0-9_-]{35}',
        # Stripe
        r'sk_live_[a-zA-Z0-9]{24}',
        r'sk_test_[a-zA-Z0-9]{24}',
        r'pk_live_[a-zA-Z0-9]{24}',
        r'pk_test_[a-zA-Z0-9]{24}',
        # Slack
        r'xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}',
        # Mailgun
        r'key-[a-zA-Z0-9]{32}',
        # Twilio
        r'[a-f0-9]{32}',
        # DeepSeek
        r'deepseek_[a-zA-Z0-9]{32}',
        # 通用密钥
        r'api[_-]?key\s*=\s*["\'][^"\']{20,}["\']',
        r'secret[_-]?key\s*=\s*["\'][^"\']{20,}["\']',
        r'password\s*=\s*["\'][^"\']{8,}["\']',
    ]
    
    # 生产环境关键词
    PRODUCTION_KEYWORDS = [
        'production',
        'prod',
        'master',
        'main',
        'release',
        'live',
    ]
    
    def analyze_file_modify(self, file_path: str, content: str = None) -> Dict:
        """分析文件修改操作"""
        risks = []
        risk_score = 0

        # 检查密钥文件（高风险，直接 block）
        for pattern in self.KEY_FILES:
            if re.search(pattern, file_path, re.IGNORECASE):
                risks.append('密钥文件')
                risk_score = 95  # 高风险，直接拦截
                break

        # 如果不是密钥文件，检查配置文件（中等风险，需要用户确认）
        if risk_score == 0:
            for pattern in self.CONFIG_FILES:
                if re.search(pattern, file_path, re.IGNORECASE):
                    risks.append('配置文件')
                    risk_score = 70  # 中等风险，需要用户确认
                    break

        # 检查内容中的密钥
        if content:
            for pattern in self.SECRET_PATTERNS:
                matches = re.findall(pattern, content)
                if matches:
                    risks.append(f'硬编码密钥 ({len(matches)} 个)')
                    risk_score = max(risk_score, 95)  # 如果内容包含密钥，提升为高风险

        return {
            'risks': risks,
            'risk_score': min(risk_score, 100),
            'risk_level': 'critical' if risk_score >= 80 else 'high' if risk_score >= 50 else 'medium' if risk_score >= 30 else 'low'
        }
    
    def analyze_command(self, command: str) -> Dict:
        """分析命令执行"""
        risks = []
        risk_score = 0
        
        # 检查危险命令
        for pattern in self.DANGEROUS_COMMANDS:
            if re.search(pattern, command, re.IGNORECASE):
                risks.append('危险命令')
                risk_score += 80
        
        return {
            'risks': risks,
            'risk_score': min(risk_score, 100),
            'risk_level': 'critical' if risk_score >= 80 else 'high'
        }
    
    def analyze_code_content(self, code: str) -> Dict:
        """分析代码内容"""
        risks = []
        risk_score = 0

        # 检查硬编码密钥 - 高风险，直接 block
        for pattern in self.SECRET_PATTERNS:
            matches = re.findall(pattern, code)
            if matches:
                risks.append(f'硬编码密钥 ({len(matches)} 个)')
                risk_score += 90 * len(matches)  # 提高到 90 分，确保 critical

        # 检查危险函数调用中的命令
        dangerous_function_patterns = [
            r'subprocess\.(?:call|run|Popen)\s*\(\s*["\']([^"\']+)["\']',
            r'os\.system\s*\(\s*["\']([^"\']+)["\']',
            r'os\.popen\s*\(\s*["\']([^"\']+)["\']',
        ]
        for pattern in dangerous_function_patterns:
            matches = re.findall(pattern, code)
            for cmd in matches:
                # 检查命令是否包含危险模式
                cmd_analysis = self.analyze_command(cmd)
                if cmd_analysis['risk_score'] > 0:
                    risks.append(f'危险命令: {cmd[:20]}...')
                    risk_score = max(risk_score, cmd_analysis['risk_score'])

        # 检查危险函数（即使没有命令参数）- 提高风险评分到90分
        dangerous_functions = ['eval', 'exec', 'compile', 'os.system', 'subprocess.call', 'subprocess.run', 'subprocess.Popen', 'os.popen']
        for func in dangerous_functions:
            if func in code and '危险命令' not in ', '.join(risks):
                risks.append(f'危险函数: {func}')
                risk_score = max(risk_score, 90)  # 提高到90分，确保critical级别

        # 检查 SQL 注入 - 扩展更多模式
        sql_patterns = [
            r'SELECT.*\+.*',  # SELECT + 字符串拼接
            r'INSERT.*\+.*',  # INSERT + 字符串拼接
            r'UPDATE.*\+.*',  # UPDATE + 字符串拼接
            r'DELETE.*\+.*',  # DELETE + 字符串拼接
            r'cursor\.execute\(.*\+',  # cursor.execute + 拼接
            r'f[\'"].*SELECT.*\{.*\}.*[\'"]',  # f-string SQL
            r'f[\'"].*INSERT.*\{.*\}.*[\'"]',  # f-string INSERT
            r'f[\'"].*UPDATE.*\{.*\}.*[\'"]',  # f-string UPDATE
            r'f[\'"].*DELETE.*\{.*\}.*[\'"]',  # f-string DELETE
            r'\.execute\(.*request\.',  # execute + request参数
            r'SELECT.*request\.',  # SELECT + request参数
            r'SELECT.*\.GET\[',  # SELECT + GET参数
            r'SELECT.*\.POST\[',  # SELECT + POST参数
        ]
        for pattern in sql_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                risks.append('SQL 注入风险')
                risk_score += 85

        # 检查 XSS 风险 - 扩展更多模式
        xss_patterns = [
            r'innerHTML\s*=',  # innerHTML赋值
            r'document\.write',  # document.write
            r'eval\s*\(',  # eval函数
            r'return\s+[\'"].*<',  # 返回HTML标签拼接
            r'\+.*user_input',  # 用户输入拼接
            r'request\.response',  # 响应数据直接使用
            r'location\.hash',  # URL hash使用
            r'request\.getParameter',  # 获取参数并使用
            r'new\s+Function\s*\(',  # JavaScript动态函数
            r'setTimeout\s*\(',  # 定时器执行
            r'setInterval\s*\(',  # 定时器执行
            r'location\.href\s*=',  # URL跳转
            r'window\.location\s*=',  # URL跳转
            r'iframe\.src\s*=',  # iframe src修改
            r'on\w+\s*=',  # 事件处理器（onclick, onmouseover等）
            r'\.html\s*\(',  # jQuery html方法
            r'data:text/html',  # data URI
            r'render_template_string',  # 模板注入
            r'f["\'].*<.*\{',  # f-string HTML拼接
            r'return\s+f["\'].*<',  # 返回f-string HTML
        ]
        for pattern in xss_patterns:
            if re.search(pattern, code):
                risks.append('XSS 风险')
                risk_score += 80

        # 检查电商场景风险 - 扩展更多模式
        ecommerce_high_risk = [
            r'order\.total\s*=',  # 订单金额修改
            r'user\.balance\s*[+-]?=',  # 用户余额修改
            r'order\.status\s*=',  # 订单状态修改
            r'user\.ssn',  # 用户敏感信息
            r'return.*user\.',  # 返回用户信息
            r'order\.paid\s*=\s*True',  # 支付状态篡改
            r'request\.GET\[.*status',  # 支付回调参数
            r'request\.POST\[.*paid',  # 支付参数
        ]
        for pattern in ecommerce_high_risk:
            if re.search(pattern, code):
                risks.append('电商交易风险')
                risk_score += 90

        # 优惠券滥用 - 中等风险，需要用户确认
        ecommerce_medium_risk = [
            r'apply_coupon',  # 优惠券使用（任何形式）
            r'for.*range.*apply_coupon',  # 批量优惠券
        ]
        for pattern in ecommerce_medium_risk:
            if re.search(pattern, code):
                risks.append('电商交易风险 - 优惠券')
                risk_score = max(risk_score, 70)  # 中等风险，需要用户确认

        # 检查金融场景风险 - 扩展更多模式
        finance_patterns = [
            r'account\.balance\s*=',  # 账户余额修改
            r'loan\.rate\s*=',  # 利率修改
            r'risk_check\.enabled\s*=',  # 风控规则修改
            r'AuditLog.*delete',  # 审计日志删除
            r'transfer\.amount\s*=',  # 转账金额篡改
            r'Transaction.*delete',  # 交易记录删除
            r'\.objects\..*\.delete\(\)',  # 任何ORM删除操作
            r'withdrawal\.amount',  # 提现金额
            r'payment\.amount',  # 支付金额
            r'deposit\.amount',  # 存款金额
        ]
        for pattern in finance_patterns:
            if re.search(pattern, code):
                risks.append('金融数据风险')
                risk_score += 95

        # 检查医疗场景风险 - 扩展更多模式
        # 高风险，直接拦截
        healthcare_high_risk = [
            r'patient\.medical_history',  # 病历信息
            r'patient\.diagnosis',  # 诊断信息
            r'prescription\.dosage\s*=',  # 处方剂量修改
            r'medicine\.stock',  # 药品库存修改（包括 += -=）
            r'patient\.ssn',  # 患者敏感信息
            r'patient\.id_card',  # 患者身份证
            r'return.*patient\.',  # 返回患者信息
            r'prescription\.create',  # 创建处方
            r'medical_record',  # 医疗记录
        ]
        for pattern in healthcare_high_risk:
            if re.search(pattern, code):
                risks.append('医疗数据风险')
                risk_score += 90

        # 中等风险，需要用户确认
        healthcare_medium_risk = [
            r'diagnosis\.result\s*=',  # 诊断结果修改
            r'export.*patient',  # 导出患者数据
            r'export_patients',  # 患者导出函数
        ]
        for pattern in healthcare_medium_risk:
            if re.search(pattern, code):
                risks.append('医疗数据风险 - 需确认')
                risk_score = max(risk_score, 70)  # 中等风险，需要用户确认

        # 检查其他安全风险
        # 高风险，直接拦截
        other_high_risk = [
            r'pickle\.loads',  # 反序列化漏洞
            r'yaml\.load\s*\(',  # YAML反序列化
            r'user\.password',  # 密码泄露
            r'user\.ssn',  # SSN泄露
            r'user\.credit_card',  # 信用卡泄露
            r'hashlib\.md5\s*\(',  # 不安全加密
            r'DES\.new',  # 不安全加密
            r'require\s*\(\s*["\']eval["\']',  # 不安全依赖
        ]
        for pattern in other_high_risk:
            if re.search(pattern, code):
                risks.append('安全风险')
                risk_score = max(risk_score, 95)

        # 中等风险，需要用户确认
        other_medium_risk = [
            r'open\s*\(\s*request\.',  # 路径遍历（直接打开request参数）
            r'os\.path\.join.*user',  # 路径拼接
            r'requests\.get\s*\(\s*user',  # SSRF
            r'urllib\.request\.urlopen\s*\(\s*user',  # SSRF
            r'xml\.parse\s*\(\s*user',  # XML注入
            r'ET\.fromstring\s*\(\s*user',  # XML注入
            r'DEBUG\s*=\s*True',  # 调试模式
            r'app\.run\s*\(\s*debug\s*=\s*True',  # 调试模式
            r'CORS\s*\(\s*\*\s*,\s*origins\s*=\s*["\']\*["\']',  # CORS配置不当
            r'@app\.route.*methods\s*=\s*\["\*"\]',  # 路由配置不当
            r'import\s+pickle',  # 导入危险模块
        ]
        for pattern in other_medium_risk:
            if re.search(pattern, code):
                risks.append('安全风险 - 需确认')
                risk_score = max(risk_score, 70)

        return {
            'risks': risks,
            'risk_score': min(risk_score, 100),
            'risk_level': 'critical' if risk_score >= 80 else 'high' if risk_score >= 50 else 'medium' if risk_score >= 30 else 'low'
        }


class Interceptor:
    """拦截器 - 决策和拦截"""
    
    def __init__(self, auto_block_critical: bool = True):
        self.auto_block_critical = auto_block_critical
        self.pending_operations = []  # 待用户确认的操作
        self.blocked_operations = []  # 已拦截的操作
        self.allowed_operations = []  # 已放行的操作
        self.callbacks = []  # 回调函数列表（用于通知桌面端）
    
    def add_callback(self, callback: Callable):
        """添加回调函数"""
        self.callbacks.append(callback)
    
    def notify(self, operation: Operation):
        """通知所有回调"""
        for callback in self.callbacks:
            try:
                callback(operation)
            except Exception as e:
                print(f"回调失败: {e}")
    
    def decide(self, operation: Operation) -> Decision:
        """决策"""
        # 严重风险自动拦截
        if operation.risk_level == 'critical' and self.auto_block_critical:
            operation.decision = 'block'
            self.blocked_operations.append(operation)
            self.notify(operation)
            return Decision.BLOCK
        
        # 高风险需要用户确认
        if operation.risk_level in ['high', 'critical']:
            operation.decision = 'ask_user'
            self.pending_operations.append(operation)
            self.notify(operation)
            return Decision.ASK_USER
        
        # 低风险自动放行
        operation.decision = 'allow'
        self.allowed_operations.append(operation)
        return Decision.ALLOW
    
    def user_confirm(self, operation_id: int, approved: bool):
        """用户确认"""
        for op in self.pending_operations:
            if op.id == operation_id:
                if approved:
                    op.decision = 'allow'
                    op.confirmed = True
                    self.allowed_operations.append(op)
                else:
                    op.decision = 'block'
                    op.confirmed = True
                    self.blocked_operations.append(op)
                
                self.pending_operations.remove(op)
                
                # 更新数据库
                local_store.update_log(operation_id, {
                    'decision': op.decision,
                    'confirmed': True
                })
                
                return op
        
        return None


class RealtimeMonitor:
    """实时监控器"""
    
    def __init__(self, interceptor: Interceptor):
        self.interceptor = interceptor
        self.rule_engine = RuleEngine()
        self.running = False
        self.operation_id = 0
        
        # 监控的目录
        self.watch_paths = [
            os.getcwd(),  # 当前工作目录
        ]
        
        # AI Agent 进程名
        self.agent_processes = [
            'cursor',
            'code',
            'trae',
            'copilot',
            'claude',
            'chatgpt',
        ]
    
    def generate_operation_id(self) -> int:
        """生成操作 ID"""
        self.operation_id += 1
        return self.operation_id
    
    def create_operation(self, agent_name: str, operation_type: str, 
                         operation_content: str, context: str,
                         risk_level: str, risk_score: int, 
                         risk_tags: List[str], analysis_result: str) -> Operation:
        """创建操作"""
        op_id = self.generate_operation_id()
        
        # 生成审计哈希
        audit_data = json.dumps({
            'agent': agent_name,
            'operation': operation_content,
            'timestamp': datetime.now().isoformat()
        })
        audit_hash = hashlib.sha256(audit_data.encode()).hexdigest()[:16]
        
        return Operation(
            id=op_id,
            agent_name=agent_name,
            operation_type=operation_type,
            operation_content=operation_content,
            context=context,
            risk_level=risk_level,
            risk_score=risk_score,
            risk_tags=risk_tags,
            decision='pending',
            analysis_result=analysis_result,
            audit_hash=audit_hash,
            timestamp=datetime.now().isoformat()
        )
    
    def monitor_file_changes(self):
        """监控文件变化"""
        # 这里可以使用 watchdog 库实现实时文件监控
        # 目前是简化版本，演示概念
        pass
    
    def intercept_file_modify(self, agent_name: str, file_path: str, content: str = None) -> Operation:
        """拦截文件修改"""
        # 分析风险
        analysis = self.rule_engine.analyze_file_modify(file_path, content)
        
        # 创建操作
        operation = self.create_operation(
            agent_name=agent_name,
            operation_type='file_modify',
            operation_content=f'修改文件: {file_path}',
            context=file_path,
            risk_level=analysis['risk_level'],
            risk_score=analysis['risk_score'],
            risk_tags=analysis['risks'],
            analysis_result=json.dumps({
                'recommendation': f'检测到 {", ".join(analysis["risks"])}'
            })
        )
        
        # 决策
        decision = self.interceptor.decide(operation)
        
        # 记录到数据库
        local_store.add_log(asdict(operation))
        
        return operation
    
    def intercept_command(self, agent_name: str, command: str) -> Operation:
        """拦截命令执行"""
        # 分析风险
        analysis = self.rule_engine.analyze_command(command)
        
        # 创建操作
        operation = self.create_operation(
            agent_name=agent_name,
            operation_type='command_execute',
            operation_content=f'执行命令: {command}',
            context='系统命令',
            risk_level=analysis['risk_level'],
            risk_score=analysis['risk_score'],
            risk_tags=analysis['risks'],
            analysis_result=json.dumps({
                'recommendation': f'检测到 {", ".join(analysis["risks"])}'
            })
        )
        
        # 决策
        decision = self.interceptor.decide(operation)
        
        # 记录到数据库
        local_store.add_log(asdict(operation))
        
        return operation
    
    def intercept_code_generate(self, agent_name: str, code: str) -> Operation:
        """拦截代码生成"""
        # 分析风险
        analysis = self.rule_engine.analyze_code_content(code)
        
        # 创建操作
        operation = self.create_operation(
            agent_name=agent_name,
            operation_type='code_generate',
            operation_content=f'生成代码 ({len(code)} 字符)',
            context='代码生成',
            risk_level=analysis['risk_level'],
            risk_score=analysis['risk_score'],
            risk_tags=analysis['risks'],
            analysis_result=json.dumps({
                'recommendation': f'检测到 {", ".join(analysis["risks"])}'
            })
        )
        
        # 决策
        decision = self.interceptor.decide(operation)
        
        # 记录到数据库
        local_store.add_log(asdict(operation))
        
        return operation
    
    def start(self):
        """启动监控"""
        self.running = True
        print("\n✓ 实时监控已启动")
        print("  监控目标: 文件修改、命令执行、密钥泄露")
        print("  按 Ctrl+C 停止")
    
    def stop(self):
        """停止监控"""
        self.running = False
        print("\n✓ 实时监控已停止")


# ===== 测试场景 =====

def test_intercept():
    """测试拦截功能"""
    print("\n" + "="*60)
    print("   实时拦截测试")
    print("="*60)
    
    # 创建监控器和拦截器
    interceptor = Interceptor(auto_block_critical=True)
    monitor = RealtimeMonitor(interceptor)
    
    # 添加回调函数（模拟桌面端通知）
    def on_operation(op: Operation):
        print(f"\n[拦截] {op.agent_name}: {op.operation_content}")
        print(f"   风险: {op.risk_level} ({op.risk_score} 分)")
        print(f"   决策: {op.decision}")
    
    interceptor.add_callback(on_operation)
    
    # 启动监控
    monitor.start()
    
    # 测试场景 1: 硬编码密钥
    print("\n[场景 1] AI 生成包含 API Key 的代码")
    code_with_secret = '''
import openai

OPENAI_API_KEY = "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

def call_gpt(prompt):
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    return client.chat.completions.create(...)
'''
    
    op1 = monitor.intercept_code_generate('Trae CN', code_with_secret)
    print(f"   结果: {op1.decision}")
    
    # 测试场景 2: 敏感文件修改
    print("\n[场景 2] AI 修改生产环境配置")
    op2 = monitor.intercept_file_modify('Cursor', 'config/production.py', 'DATABASE_URL=...')
    print(f"   结果: {op2.decision}")
    
    # 测试场景 3: 危险命令
    print("\n[场景 3] AI 执行危险命令")
    op3 = monitor.intercept_command('Copilot', 'rm -rf /tmp/*')
    print(f"   结果: {op3.decision}")
    
    # 测试场景 4: 正常操作
    print("\n[场景 4] AI 生成正常代码")
    normal_code = '''
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)
'''
    op4 = monitor.intercept_code_generate('Cursor', normal_code)
    print(f"   结果: {op4.decision}")
    
    print("\n" + "="*60)
    print("   测试完成")
    print("="*60)
    
    print(f"\n   拦截统计:")
    print(f"   - 已拦截: {len(interceptor.blocked_operations)}")
    print(f"   - 待确认: {len(interceptor.pending_operations)}")
    print(f"   - 已放行: {len(interceptor.allowed_operations)}")


if __name__ == '__main__':
    test_intercept()
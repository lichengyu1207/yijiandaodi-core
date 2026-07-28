"""Agent健康监控系统 - 提供稳定可预期的执行环境"""

from django.db import models
from django.conf import settings
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
from collections import defaultdict
import hashlib


class AgentHeartbeat(models.Model):
    """Agent心跳记录"""
    agent_code = models.CharField(max_length=50, db_index=True)
    agent_name = models.CharField(max_length=100)
    session_id = models.CharField(max_length=64, db_index=True)
    current_task = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, default='healthy')  # healthy/warning/timeout/stuck
    heartbeat_time = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'agent_heartbeat'


class AgentBehaviorLoop(models.Model):
    """Agent行为循环检测记录"""
    agent_code = models.CharField(max_length=50, db_index=True)
    behavior_hash = models.CharField(max_length=64, db_index=True)
    loop_count = models.IntegerField(default=0)
    loop_detected = models.BooleanField(default=False)
    detected_time = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'agent_behavior_loop'


class HealthMonitor:
    """Agent健康监控器"""
    
    def __init__(self):
        self.timeout_threshold = 60  # 超时阈值（秒）
        self.loop_threshold = 5      # 循环阈值（重复次数）
        self.heartbeat_cache = defaultdict(dict)
        self.behavior_history = defaultdict(list)
    
    def record_heartbeat(self, agent_code: str, task: str, session_id: str) -> Dict:
        """记录Agent心跳"""
        now = datetime.now()
        
        # 保存到数据库
        heartbeat = AgentHeartbeat.objects.create(
            agent_code=agent_code,
            agent_name=agent_code,
            session_id=session_id,
            current_task=task,
            status='healthy'
        )
        
        # 更新缓存
        self.heartbeat_cache[agent_code] = {
            'last_heartbeat': now,
            'task': task,
            'session_id': session_id
        }
        
        # 检查超时状态
        status, message = self.check_timeout(agent_code)
        
        return {
            'heartbeat_id': heartbeat.id,
            'status': status,
            'message': message,
            'timestamp': now.isoformat()
        }
    
    def check_timeout(self, agent_code: str) -> Tuple[str, str]:
        """检查Agent超时状态"""
        cache = self.heartbeat_cache.get(agent_code, {})
        last_time = cache.get('last_heartbeat')
        
        if not last_time:
            return 'offline', 'Agent离线'
        
        age = (datetime.now() - last_time).total_seconds()
        
        if age > self.timeout_threshold:
            return 'timeout', f'超时{age:.0f}秒，Agent可能卡死'
        elif age > self.timeout_threshold * 0.5:
            return 'warning', f'心跳延迟{age:.0f}秒'
        
        return 'healthy', '健康'
    
    def detect_loop(self, agent_code: str, behavior_data: Dict) -> Dict:
        """检测Agent行为循环"""
        # 计算行为哈希
        behavior_hash = hashlib.md5(str(behavior_data).encode()).hexdigest()
        
        # 记录到历史
        history = self.behavior_history[agent_code]
        history.append({
            'hash': behavior_hash,
            'timestamp': datetime.now()
        })
        
        # 只保留最近10条
        if len(history) > 10:
            history = history[-10:]
            self.behavior_history[agent_code] = history
        
        # 检查循环（最近5次行为是否相同）
        recent_hashes = [h['hash'] for h in history[-self.loop_threshold:]]
        is_loop = len(recent_hashes) == self.loop_threshold and all(h == behavior_hash for h in recent_hashes)
        
        # 保存到数据库
        if is_loop:
            loop_record = AgentBehaviorLoop.objects.create(
                agent_code=agent_code,
                behavior_hash=behavior_hash,
                loop_count=self.loop_threshold,
                loop_detected=True
            )
        
        return {
            'loop_detected': is_loop,
            'loop_count': len(recent_hashes) if is_loop else 0,
            'behavior_hash': behavior_hash,
            'recommendation': '拦截异常行为，停止Agent执行' if is_loop else '继续执行'
        }
    
    def check_business_context(self, context: str, operation: str) -> Dict:
        """检查业务上下文，避免开发环境误报"""
        # 开发模式白名单
        dev_whitelist = [
            'file_read', 'file_write', 'api_test', 'compile', 
            'test_run', 'debug', 'git_push', 'git_pull', 
            'npm_install', 'pip_install', 'docker_build'
        ]
        
        # 生产模式白名单
        prod_whitelist = [
            'read:content', 'write:report', 'api_call', 
            'data_access', 'tool_call', 'session_create'
        ]
        
        is_safe = False
        
        if context == 'development':
            is_safe = operation in dev_whitelist
            message = '开发环境正常操作，不触发告警' if is_safe else f'开发环境异常操作: {operation}'
        elif context == 'production':
            is_safe = operation in prod_whitelist
            message = '生产环境正常操作' if is_safe else f'生产环境异常操作: {operation}'
        else:
            message = f'未知业务上下文: {context}'
        
        return {
            'context': context,
            'operation': operation,
            'is_safe': is_safe,
            'message': message,
            'whitelist_applied': True,
            'recommendation': '允许执行' if is_safe else '触发安全检测'
        }
    
    def get_health_summary(self, agents: List[str]) -> List[Dict]:
        """获取Agent健康状态总览"""
        summary = []
        
        for agent in agents:
            # 检查超时状态
            status, message = self.check_timeout(agent)
            
            # 检查循环状态
            history = self.behavior_history.get(agent, [])
            loop_count = sum(1 for h in history[-self.loop_threshold:] 
                           if h.get('hash') == history[-1].get('hash')) if history else 0
            
            # 获取最近心跳
            last_heartbeat = AgentHeartbeat.objects.filter(
                agent_code=agent
            ).order_by('-heartbeat_time').first()
            
            summary.append({
                'agent_code': agent,
                'status': status,
                'message': message,
                'loop_count': loop_count,
                'current_task': last_heartbeat.current_task if last_heartbeat else None,
                'last_heartbeat': last_heartbeat.heartbeat_time.isoformat() if last_heartbeat else None
            })
        
        return summary


health_monitor = HealthMonitor()
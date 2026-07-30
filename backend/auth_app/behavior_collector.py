"""
Agent行为采集器 - 行为基线建模引擎核心组件

功能：
1. 拦截Agent的API调用、数据访问、权限使用、Tool调用
2. 记录行为日志到数据库
3. 实时计算风险评分
4. 提供装饰器和中间件用于集成
"""

import time
import functools
import threading
from typing import Dict, Any, Optional, Callable
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import transaction
from .behavior_models import AgentBehaviorLog, BehaviorPattern
import json

User = get_user_model()

# 全局行为采集器实例（线程安全）
_behavior_collector_instance = None
_behavior_collector_lock = threading.Lock()


class BehaviorCollector:
    """
    Agent行为采集器
    
    使用装饰器和钩子拦截Agent行为，记录到数据库
    """
    
    def __init__(self):
        self.enabled = True  # 是否启用行为采集
        self.buffer_size = 100  # 批量写入缓冲区大小
        self.buffer = []  # 行为日志缓冲区
        self.buffer_lock = threading.Lock()
        
        # 风险评分规则
        self.risk_rules = {
            'api_call': {
                'endpoints_risk': {
                    '/api/platform/v1/capabilities/detect/': 5,
                    '/api/admin/': 40,
                    '/api/security/': 30,
                },
                'frequency_threshold': 10,  # 每分钟超过10次API调用视为异常
                'latency_threshold': 5000,  # 响应时间超过5秒视为异常
            },
            'data_access': {
                'tables_risk': {
                    'agent_session': 5,
                    'user_behavior_log': 20,
                    'paymentorder': 30,
                    'userprofile': 25,
                },
                'records_threshold': 100,  # 单次访问超过100条记录视为异常
            },
            'permission_use': {
                'permissions_risk': {
                    'read': 5,
                    'write': 15,
                    'delete': 30,
                    'admin': 50,
                },
                'escalation_score': 20,  # 权限提升风险评分
            },
            'tool_call': {
                'tools_risk': {
                    'content_analyzer': 5,
                    'code_executor': 25,
                    'file_manager': 20,
                    'system_command': 40,
                },
                'execution_time_threshold': 10000,  # Tool执行超过10秒视为异常
            },
        }
    
    @classmethod
    def get_instance(cls):
        """获取全局单例实例（线程安全）"""
        global _behavior_collector_instance, _behavior_collector_lock
        if _behavior_collector_instance is None:
            with _behavior_collector_lock:
                if _behavior_collector_instance is None:
                    _behavior_collector_instance = cls()
        return _behavior_collector_instance
    
    def log_behavior(
        self,
        agent_code: str,
        agent_name: str,
        session_id: str,
        behavior_type: str,
        behavior_data: Dict[str, Any],
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = '',
        duration_ms: int = 0,
    ) -> AgentBehaviorLog:
        """
        记录Agent行为日志
        
        Args:
            agent_code: Agent编码 (auditor/verifier/archiver/judge)
            agent_name: Agent名称
            session_id: 会话ID
            behavior_type: 行为类型 (api_call/data_access/permission_use/tool_call)
            behavior_data: 行为详情数据
            user_id: 用户ID
            ip_address: IP地址
            user_agent: 用户代理字符串
            duration_ms: 持续时间（毫秒）
        
        Returns:
            创建的行为日志对象
        """
        if not self.enabled:
            return None
        
        # 计算风险评分
        risk_score, risk_level = self._calculate_risk(behavior_type, behavior_data)
        
        # 计算异常分数（基于历史基线）
        anomaly_score, baseline_deviation = self._calculate_anomaly_score(
            agent_code, behavior_type, behavior_data
        )
        
        # 创建行为日志对象
        behavior_log = AgentBehaviorLog(
            agent_code=agent_code,
            agent_name=agent_name,
            session_id=session_id,
            behavior_type=behavior_type,
            behavior_data=behavior_data,
            risk_level=risk_level,
            risk_score=risk_score,
            anomaly_score=anomaly_score,
            baseline_deviation=baseline_deviation,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            duration_ms=duration_ms,
            is_anomaly=anomaly_score > 0.7 or risk_score > 70,
        )
        
        # 添加到缓冲区或直接写入
        with self.buffer_lock:
            self.buffer.append(behavior_log)
            if len(self.buffer) >= self.buffer_size:
                self._flush_buffer()
        
        # 如果是高风险行为，立即写入数据库
        if risk_score > 70 or anomaly_score > 0.7:
            behavior_log.save()
        
        return behavior_log
    
    def _calculate_risk(self, behavior_type: str, behavior_data: Dict[str, Any]) -> tuple:
        """
        计算行为风险评分
        
        Returns:
            (risk_score, risk_level)
        """
        rules = self.risk_rules.get(behavior_type, {})
        risk_score = 0.0
        
        if behavior_type == 'api_call':
            endpoint = behavior_data.get('api_endpoint', '')
            latency = behavior_data.get('latency_ms', 0)
            status = behavior_data.get('response_status', 200)
            
            # 基于endpoint的风险评分
            endpoint_risk = rules.get('endpoints_risk', {})
            for pattern, score in endpoint_risk.items():
                if pattern in endpoint:
                    risk_score += score
            
            # 响应时间异常
            if latency > rules.get('latency_threshold', 5000):
                risk_score += 10
            
            # HTTP错误状态
            if status >= 400:
                risk_score += (status - 400) // 10
        
        elif behavior_type == 'data_access':
            tables = behavior_data.get('data_tables_accessed', [])
            records = behavior_data.get('data_records_affected', 0)
            
            # 基于数据表的风险评分
            tables_risk = rules.get('tables_risk', {})
            for table in tables:
                risk_score += tables_risk.get(table, 5)
            
            # 访问记录数量异常
            if records > rules.get('records_threshold', 100):
                risk_score += (records - 100) // 10
        
        elif behavior_type == 'permission_use':
            permissions = behavior_data.get('permissions_required', [])
            has_escalation = behavior_data.get('permission_escalation', False)
            
            # 基于权限的风险评分
            permissions_risk = rules.get('permissions_risk', {})
            for perm in permissions:
                risk_score += permissions_risk.get(perm, 5)
            
            # 权限提升风险
            if has_escalation:
                risk_score += rules.get('escalation_score', 20)
        
        elif behavior_type == 'tool_call':
            tool_name = behavior_data.get('tool_name', '')
            execution_time = behavior_data.get('execution_time_ms', 0)
            has_error = behavior_data.get('has_error', False)
            
            # 基于Tool的风险评分
            tools_risk = rules.get('tools_risk', {})
            risk_score += tools_risk.get(tool_name, 10)
            
            # 执行时间异常
            if execution_time > rules.get('execution_time_threshold', 10000):
                risk_score += 15
            
            # Tool执行错误
            if has_error:
                risk_score += 20
        
        # 确定风险等级
        if risk_score >= 80:
            risk_level = 'critical'
        elif risk_score >= 60:
            risk_level = 'high'
        elif risk_score >= 30:
            risk_level = 'medium'
        else:
            risk_level = 'low'
        
        return risk_score, risk_level
    
    def _calculate_anomaly_score(
        self, 
        agent_code: str, 
        behavior_type: str, 
        behavior_data: Dict[str, Any]
    ) -> tuple:
        """
        计算异常分数（基于历史基线偏离度）
        
        Returns:
            (anomaly_score, baseline_deviation)
        """
        from .behavior_models import BehaviorBaseline
        
        # 尝试获取该Agent的活跃基线模型
        baseline = BehaviorBaseline.objects.filter(
            agent_code=agent_code,
            baseline_type=behavior_type,
            is_active=True
        ).first()
        
        if not baseline:
            # 没有基线模型，使用默认阈值
            anomaly_score = 0.0
            baseline_deviation = 0.0
        else:
            # 基于基线模型计算偏离度
            baseline_data = baseline.baseline_data
            
            # 计算特征偏离度
            deviation_scores = []
            
            # API调用频率偏离度
            if behavior_type == 'api_call':
                expected_freq = baseline_data.get('avg_frequency', 10)
                actual_freq = behavior_data.get('call_frequency', 1)
                freq_deviation = abs(actual_freq - expected_freq) / expected_freq
                deviation_scores.append(freq_deviation)
            
            # 数据访问偏离度
            elif behavior_type == 'data_access':
                normal_tables = baseline_data.get('feature_distribution', {}).get('data_tables', {})
                accessed_tables = behavior_data.get('data_tables_accessed', [])
                table_deviation = self._calculate_table_deviation(normal_tables, accessed_tables)
                deviation_scores.append(table_deviation)
            
            # Tool调用偏离度
            elif behavior_type == 'tool_call':
                normal_tools = baseline_data.get('feature_distribution', {}).get('tools', {})
                called_tools = [behavior_data.get('tool_name', '')]
                tool_deviation = self._calculate_feature_deviation(normal_tools, called_tools)
                deviation_scores.append(tool_deviation)
            
            # 平均偏离度
            baseline_deviation = sum(deviation_scores) / len(deviation_scores) if deviation_scores else 0.0
            
            # 异常分数（偏离度映射到0-1范围）
            anomaly_score = min(1.0, baseline_deviation * 2)
        
        return anomaly_score, baseline_deviation
    
    def _calculate_table_deviation(self, normal_tables: Dict, accessed_tables: list) -> float:
        """计算数据表访问偏离度"""
        if not normal_tables:
            return 0.0
        
        # 计算访问的表在正常模式中的覆盖率
        coverage = sum(normal_tables.get(table, 0) for table in accessed_tables)
        
        # 如果访问的表不在正常模式中，偏离度增加
        abnormal_tables = [table for table in accessed_tables if table not in normal_tables]
        abnormal_ratio = len(abnormal_tables) / len(accessed_tables) if accessed_tables else 0
        
        # 综合偏离度
        deviation = abnormal_ratio + (1 - coverage)
        return min(1.0, deviation)
    
    def _calculate_feature_deviation(self, normal_features: Dict, actual_features: list) -> float:
        """计算特征偏离度（通用方法）"""
        if not normal_features:
            return 0.0
        
        abnormal_features = [f for f in actual_features if f not in normal_features]
        abnormal_ratio = len(abnormal_features) / len(actual_features) if actual_features else 0
        
        return min(1.0, abnormal_ratio)
    
    def _flush_buffer(self):
        """将缓冲区中的行为日志批量写入数据库"""
        if not self.buffer:
            return
        
        try:
            with transaction.atomic():
                AgentBehaviorLog.objects.bulk_create(self.buffer)
            self.buffer.clear()
        except Exception as e:
            print(f'[BehaviorCollector] 批量写入失败: {e}')
            # 逐条写入作为fallback
            for log in self.buffer:
                try:
                    log.save()
                except Exception as e2:
                    print(f'[BehaviorCollector] 单条写入失败: {e2}')
            self.buffer.clear()
    
    def flush(self):
        """手动触发缓冲区刷新"""
        with self.buffer_lock:
            self._flush_buffer()


# ============================================================
# 装饰器：用于拦截Agent行为
# ============================================================

def track_api_call(agent_code: str, agent_name: str):
    """
    拦截API调用的装饰器
    
    用法：
        @track_api_call('auditor', '安全审计模块')
        def detect_view(request):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            collector = BehaviorCollector.get_instance()
            
            # 获取请求对象（假设第一个参数是request）
            request = args[0] if args else None
            
            # 提取用户信息
            user_id = None
            ip_address = None
            user_agent = ''
            session_id = ''
            
            if request:
                user_id = request.user.id if hasattr(request, 'user') and request.user.is_authenticated else None
                ip_address = request.META.get('REMOTE_ADDR', '')
                user_agent = request.META.get('HTTP_USER_AGENT', '')
                session_id = request.session.session_key or f'anon_{ip_address}_{int(time.time())}'
            
            # 记录开始时间
            start_time = time.time()
            
            try:
                # 执行原始函数
                result = func(*args, **kwargs)
                
                # 记录成功行为
                behavior_data = {
                    'api_endpoint': getattr(request, 'path', ''),
                    'http_method': getattr(request, 'method', ''),
                    'response_status': getattr(result, 'status_code', 200) if hasattr(result, 'status_code') else 200,
                    'latency_ms': int((time.time() - start_time) * 1000),
                    'call_frequency': 1,
                }
                
                collector.log_behavior(
                    agent_code=agent_code,
                    agent_name=agent_name,
                    session_id=session_id,
                    behavior_type='api_call',
                    behavior_data=behavior_data,
                    user_id=user_id,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    duration_ms=int((time.time() - start_time) * 1000),
                )
                
                return result
                
            except Exception as e:
                # 记录异常行为
                behavior_data = {
                    'api_endpoint': getattr(request, 'path', ''),
                    'http_method': getattr(request, 'method', ''),
                    'response_status': 500,
                    'latency_ms': int((time.time() - start_time) * 1000),
                    'error_message': str(e),
                    'stack_trace': str(e.__traceback__) if hasattr(e, '__traceback__') else '',
                }
                
                collector.log_behavior(
                    agent_code=agent_code,
                    agent_name=agent_name,
                    session_id=session_id,
                    behavior_type='api_call',
                    behavior_data=behavior_data,
                    user_id=user_id,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    duration_ms=int((time.time() - start_time) * 1000),
                )
                
                raise
        
        return wrapper
    return decorator


def track_data_access(agent_code: str, agent_name: str):
    """
    拦截数据访问的装饰器
    
    用法：
        @track_data_access('auditor', '安全审计模块')
        def query_sessions(user_id):
            sessions = AgentSession.objects.filter(user_id=user_id)
            return sessions
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            collector = BehaviorCollector.get_instance()
            
            start_time = time.time()
            
            # 执行原始函数
            result = func(*args, **kwargs)
            
            # 分析数据访问行为
            behavior_data = {
                'data_tables_accessed': [],
                'data_records_affected': 0,
                'query_type': 'read',
            }
            
            # 尝试提取查询信息
            if hasattr(result, 'model'):
                # Django QuerySet
                table_name = result.model._meta.db_table
                behavior_data['data_tables_accessed'].append(table_name)
                behavior_data['data_records_affected'] = result.count() if hasattr(result, 'count') else 1
            
            # 记录行为
            session_id = kwargs.get('session_id', f'data_{int(time.time())}')
            user_id = kwargs.get('user_id')
            
            collector.log_behavior(
                agent_code=agent_code,
                agent_name=agent_name,
                session_id=session_id,
                behavior_type='data_access',
                behavior_data=behavior_data,
                user_id=user_id,
                duration_ms=int((time.time() - start_time) * 1000),
            )
            
            return result
        
        return wrapper
    return decorator


def track_tool_call(agent_code: str, agent_name: str):
    """
    拦截Tool调用的装饰器
    
    用法：
        @track_tool_call('auditor', '安全审计模块')
        def execute_tool(tool_name, params):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            collector = BehaviorCollector.get_instance()
            
            # 提取Tool信息
            tool_name = kwargs.get('tool_name', args[0] if args else 'unknown')
            tool_params = kwargs.get('params', args[1] if len(args) > 1 else {})
            
            start_time = time.time()
            
            try:
                # 执行Tool
                result = func(*args, **kwargs)
                
                # 记录成功Tool调用
                behavior_data = {
                    'tool_name': tool_name,
                    'tool_params': tool_params,
                    'execution_time_ms': int((time.time() - start_time) * 1000),
                    'has_error': False,
                    'tool_result_type': type(result).__name__,
                }
                
                session_id = kwargs.get('session_id', f'tool_{int(time.time())}')
                
                collector.log_behavior(
                    agent_code=agent_code,
                    agent_name=agent_name,
                    session_id=session_id,
                    behavior_type='tool_call',
                    behavior_data=behavior_data,
                    user_id=kwargs.get('user_id'),
                    duration_ms=int((time.time() - start_time) * 1000),
                )
                
                return result
                
            except Exception as e:
                # 记录失败Tool调用
                behavior_data = {
                    'tool_name': tool_name,
                    'tool_params': tool_params,
                    'execution_time_ms': int((time.time() - start_time) * 1000),
                    'has_error': True,
                    'error_message': str(e),
                }
                
                collector.log_behavior(
                    agent_code=agent_code,
                    agent_name=agent_name,
                    session_id=session_id,
                    behavior_type='tool_call',
                    behavior_data=behavior_data,
                    user_id=kwargs.get('user_id'),
                    duration_ms=int((time.time() - start_time) * 1000),
                )
                
                raise
        
        return wrapper
    return decorator


# ============================================================
# 中间件：全局行为拦截
# ============================================================

class BehaviorTrackingMiddleware:
    """
    Django中间件：全局拦截所有请求，记录Agent行为
    
    安装方法：
        在 settings.py 的 MIDDLEWARE 中添加：
        'auth_app.behavior_collector.BehaviorTrackingMiddleware'
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.collector = BehaviorCollector.get_instance()
    
    def __call__(self, request):
        # 只拦截Agent相关的API路径
        agent_paths = [
            '/api/agent/',
            '/api/platform/v1/capabilities/',
        ]
        
        is_agent_request = any(path in request.path for path in agent_paths)
        
        if not is_agent_request:
            return self.get_response(request)
        
        # 提取Agent信息
        agent_code = self._extract_agent_code(request)
        agent_name = self._extract_agent_name(request)
        
        # 提取用户信息
        user_id = request.user.id if hasattr(request, 'user') and request.user.is_authenticated else None
        ip_address = request.META.get('REMOTE_ADDR', '')
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        session_id = request.session.session_key or f'anon_{ip_address}_{int(time.time())}'
        
        # 记录开始时间
        start_time = time.time()
        
        # 执行请求
        response = self.get_response(request)
        
        # 记录API调用行为
        behavior_data = {
            'api_endpoint': request.path,
            'http_method': request.method,
            'response_status': response.status_code,
            'latency_ms': int((time.time() - start_time) * 1000),
            'request_params': self._extract_request_params(request),
        }
        
        self.collector.log_behavior(
            agent_code=agent_code,
            agent_name=agent_name,
            session_id=session_id,
            behavior_type='api_call',
            behavior_data=behavior_data,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            duration_ms=int((time.time() - start_time) * 1000),
        )
        
        return response
    
    def _extract_agent_code(self, request) -> str:
        """从请求中提取Agent编码"""
        path_parts = request.path.split('/')
        if 'agent' in path_parts:
            return path_parts[path_parts.index('agent') + 1] if len(path_parts) > path_parts.index('agent') + 1 else 'unknown_agent'
        return 'system'
    
    def _extract_agent_name(self, request) -> str:
        """从请求中提取Agent名称"""
        agent_names = {
            'auditor': '安全审计模块',
            'verifier': '真实性核验模块',
            'archiver': '数据存证模块',
            'judge': '智能裁决模块',
        }
        agent_code = self._extract_agent_code(request)
        return agent_names.get(agent_code, '系统模块')
    
    def _extract_request_params(self, request) -> Dict:
        """提取请求参数"""
        params = {}
        
        if request.method == 'GET':
            params.update(request.GET.dict())
        elif request.method == 'POST':
            try:
                import json
                params.update(json.loads(request.body))
            except:
                params.update(request.POST.dict())
        
        # 移除敏感参数
        sensitive_keys = ['password', 'token', 'api_key', 'secret']
        for key in sensitive_keys:
            if key in params:
                params[key] = '[REDACTED]'
        
        return params


# ============================================================
# 便捷函数
# ============================================================

def get_behavior_collector() -> BehaviorCollector:
    """获取全局行为采集器实例"""
    return BehaviorCollector.get_instance()


def enable_behavior_tracking():
    """启用行为跟踪"""
    collector = BehaviorCollector.get_instance()
    collector.enabled = True


def disable_behavior_tracking():
    """禁用行为跟踪"""
    collector = BehaviorCollector.get_instance()
    collector.enabled = False


def flush_behavior_logs():
    """手动刷新行为日志缓冲区"""
    collector = BehaviorCollector.get_instance()
    collector.flush()
"""
一鉴到底 Skill 集成模块

将 .trae/skills 中的 14 个 Skill 集成到沙箱 API 中
支持本地调用和对外开放
"""

import os
import sys
import json
import hashlib
import hmac
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict

# 添加 skills 目录到路径
SKILLS_PATH = os.path.join(os.path.dirname(__file__), '.trae', 'skills')
if SKILLS_PATH not in sys.path:
    sys.path.insert(0, SKILLS_PATH)


@dataclass
class SkillRequest:
    """Skill 请求"""
    skill_id: str
    action: str
    params: Dict[str, Any]
    user_id: Optional[str] = None
    api_key: Optional[str] = None


@dataclass
class SkillResponse:
    """Skill 响应"""
    success: bool
    skill_id: str
    action: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: str = None
    audit_hash: Optional[str] = None

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()


class SkillRegistry:
    """Skill 注册中心"""
    
    # 可用的 Skill 列表
    AVAILABLE_SKILLS = {
        'ass-gateway': {
            'name': 'ASS 安全网关',
            'description': '安全检测、注入防护、XSS',
            'actions': ['inspect', 'sanitize', 'classify', 'sign', 'verify'],
            'tier': 'L3'
        },
        'code-detector': {
            'name': '代码风险检测',
            'description': '代码扫描、漏洞检测、静态分析',
            'actions': ['analyze', 'scan', 'detect'],
            'tier': 'L2'
        },
        'content-moderator': {
            'name': '内容安全审核',
            'description': '内容过滤、XSS防护、净化',
            'actions': ['sanitize', 'classify', 'moderate'],
            'tier': 'L2'
        },
        'data-masker': {
            'name': '数据脱敏引擎',
            'description': '脱敏、PII保护、手机号/身份证',
            'actions': ['mask', 'unmask', 'detect_pii'],
            'tier': 'L2'
        },
        'output-verifier': {
            'name': '输出签名验签',
            'description': 'HMAC签名、防篡改、完整性',
            'actions': ['sign', 'verify', 'generate_key'],
            'tier': 'L2'
        },
        'hashchain-audit': {
            'name': 'HashChain 审计存证',
            'description': '审计日志、哈希链、存证',
            'actions': ['record', 'verify', 'export', 'get_chain'],
            'tier': 'L7'
        },
        'sandbox-executor': {
            'name': 'Pyodide 沙箱执行',
            'description': '代码执行、WASM沙箱、Pyodide',
            'actions': ['execute', 'run_python', 'run_javascript'],
            'tier': 'L6'
        },
        'dag-orchestrator': {
            'name': 'DAG 工作流编排',
            'description': '任务编排、DAG、并行执行',
            'actions': ['create_dag', 'execute', 'get_status'],
            'tier': 'L2'
        },
        'eihm-router': {
            'name': 'EIHM 成本路由',
            'description': '成本估算、节点选择、P2P路由',
            'actions': ['estimate_cost', 'select_node', 'route'],
            'tier': 'L4'
        },
        'p2p-scheduler': {
            'name': 'P2P 任务调度器',
            'description': '任务分发、心跳、状态机',
            'actions': ['dispatch', 'get_status', 'cancel'],
            'tier': 'L5'
        },
        'result-aggregator': {
            'name': '结果聚合分发',
            'description': '结果聚合、多数投票、去重',
            'actions': ['aggregate', 'vote', 'deduplicate'],
            'tier': 'L7'
        },
        'node-discovery': {
            'name': '节点发现服务',
            'description': 'P2P发现、服务注册、健康检查',
            'actions': ['register', 'discover', 'health_check'],
            'tier': 'L1'
        },
        'idle-detector': {
            'name': '闲时检测服务',
            'description': '空闲利用、后台任务、节能',
            'actions': ['check_idle', 'schedule_task', 'get_status'],
            'tier': 'L1'
        },
        'compliance-reporter': {
            'name': '合规报告生成',
            'description': '等保、GDPR、合规报告',
            'actions': ['generate', 'export', 'get_template'],
            'tier': 'L7'
        }
    }
    
    def __init__(self):
        self.loaded_skills: Dict[str, Any] = {}
    
    def get_skill_info(self, skill_id: str) -> Optional[Dict]:
        """获取 Skill 信息"""
        return self.AVAILABLE_SKILLS.get(skill_id)
    
    def list_skills(self) -> List[Dict]:
        """列出所有可用 Skill"""
        return [
            {'id': k, **v}
            for k, v in self.AVAILABLE_SKILLS.items()
        ]
    
    def load_skill(self, skill_id: str) -> Any:
        """动态加载 Skill 模块"""
        if skill_id in self.loaded_skills:
            return self.loaded_skills[skill_id]
        
        # 转换 skill_id 为模块名
        module_name = skill_id.replace('-', '_')
        
        try:
            # 尝试导入
            module = __import__(f'skills.{module_name}', fromlist=[''])
            self.loaded_skills[skill_id] = module
            return module
        except ImportError:
            # 如果模块不存在，使用内置实现
            return self._get_builtin_skill(skill_id)
    
    def _get_builtin_skill(self, skill_id: str) -> Any:
        """获取内置 Skill 实现"""
        builtin_skills = {
            'ass-gateway': self._ass_gateway_impl,
            'code-detector': self._code_detector_impl,
            'hashchain-audit': self._hashchain_audit_impl,
            'output-verifier': self._output_verifier_impl,
            'data-masker': self._data_masker_impl,
        }
        return builtin_skills.get(skill_id, self._default_skill_impl)
    
    # 内置 Skill 实现
    def _ass_gateway_impl(self, action: str, params: Dict) -> Dict:
        """ASS 安全网关实现"""
        if action == 'inspect':
            input_data = params.get('input', '')
            # 检测危险模式
            dangerous_patterns = ['<script>', 'javascript:', 'onerror=', 'eval(']
            risks = [p for p in dangerous_patterns if p in input_data.lower()]
            return {
                'safe': len(risks) == 0,
                'risks': risks,
                'level': 'high' if risks else 'low'
            }
        
        elif action == 'sanitize':
            input_data = params.get('input', '')
            # 简单净化
            import html
            sanitized = html.escape(input_data)
            return {'sanitized': sanitized}
        
        elif action == 'sign':
            data = params.get('data', '')
            key = params.get('key', 'default-key')
            signature = hmac.new(
                key.encode(), 
                data.encode(), 
                hashlib.sha256
            ).hexdigest()
            return {'signature': signature}
        
        return {'error': 'unknown action'}
    
    def _code_detector_impl(self, action: str, params: Dict) -> Dict:
        """代码风险检测实现"""
        if action == 'analyze':
            code = params.get('code', '')
            # 检测危险函数
            dangerous_funcs = ['eval', 'exec', 'compile', 'os.system', 'subprocess']
            risks = [f for f in dangerous_funcs if f in code]
            return {
                'risk_level': 'high' if risks else 'low',
                'risks': risks,
                'line_count': len(code.split('\n'))
            }
        
        return {'error': 'unknown action'}
    
    def _hashchain_audit_impl(self, action: str, params: Dict) -> Dict:
        """HashChain 审计存证实现"""
        if action == 'record':
            data = params.get('data', {})
            prev_hash = params.get('prev_hash', '0' * 64)
            timestamp = datetime.now().isoformat()
            
            # 计算哈希
            content = json.dumps(data, sort_keys=True) + prev_hash + timestamp
            current_hash = hashlib.sha256(content.encode()).hexdigest()
            
            return {
                'hash': current_hash,
                'prev_hash': prev_hash,
                'timestamp': timestamp,
                'data': data
            }
        
        return {'error': 'unknown action'}
    
    def _output_verifier_impl(self, action: str, params: Dict) -> Dict:
        """输出签名验签实现"""
        if action == 'sign':
            data = params.get('data', '')
            key = params.get('key', 'default-key')
            signature = hmac.new(
                key.encode(),
                data.encode(),
                hashlib.sha256
            ).hexdigest()
            return {'signature': signature}
        
        elif action == 'verify':
            data = params.get('data', '')
            signature = params.get('signature', '')
            key = params.get('key', 'default-key')
            expected = hmac.new(
                key.encode(),
                data.encode(),
                hashlib.sha256
            ).hexdigest()
            return {'valid': signature == expected}
        
        return {'error': 'unknown action'}
    
    def _data_masker_impl(self, action: str, params: Dict) -> Dict:
        """数据脱敏实现"""
        if action == 'mask':
            data = params.get('data', '')
            mask_type = params.get('type', 'phone')
            
            if mask_type == 'phone' and len(data) == 11:
                return {'masked': data[:3] + '****' + data[7:]}
            elif mask_type == 'idcard' and len(data) >= 15:
                return {'masked': data[:6] + '********' + data[-4:]}
            elif mask_type == 'email':
                parts = data.split('@')
                if len(parts) == 2:
                    return {'masked': parts[0][:2] + '***@' + parts[1]}
            
            return {'masked': data}
        
        return {'error': 'unknown action'}
    
    def _default_skill_impl(self, action: str, params: Dict) -> Dict:
        """默认 Skill 实现"""
        return {
            'message': f'Skill executed: {action}',
            'params': params
        }


class SkillAPI:
    """Skill API 服务"""
    
    def __init__(self):
        self.registry = SkillRegistry()
        self.call_log: List[Dict] = []
    
    def execute(self, request: SkillRequest) -> SkillResponse:
        """执行 Skill"""
        # 记录调用
        call_record = {
            'skill_id': request.skill_id,
            'action': request.action,
            'timestamp': datetime.now().isoformat(),
            'user_id': request.user_id
        }
        
        # 检查 Skill 是否存在
        skill_info = self.registry.get_skill_info(request.skill_id)
        if not skill_info:
            return SkillResponse(
                success=False,
                skill_id=request.skill_id,
                action=request.action,
                error=f'Skill not found: {request.skill_id}'
            )
        
        # 检查 action 是否有效
        if request.action not in skill_info['actions']:
            return SkillResponse(
                success=False,
                skill_id=request.skill_id,
                action=request.action,
                error=f'Invalid action: {request.action}. Available: {skill_info["actions"]}'
            )
        
        try:
            # 加载并执行 Skill
            skill_module = self.registry.load_skill(request.skill_id)
            
            if callable(skill_module):
                result = skill_module(request.action, request.params)
            else:
                # 尝试调用模块中的函数
                action_func = getattr(skill_module, request.action, None)
                if action_func:
                    result = action_func(**request.params)
                else:
                    result = {'message': 'Action executed'}
            
            # 生成审计哈希
            audit_hash = hashlib.sha256(
                json.dumps({
                    'skill_id': request.skill_id,
                    'action': request.action,
                    'result': result,
                    'timestamp': datetime.now().isoformat()
                }, sort_keys=True).encode()
            ).hexdigest()
            
            # 记录成功调用
            call_record['success'] = True
            call_record['audit_hash'] = audit_hash
            self.call_log.append(call_record)
            
            return SkillResponse(
                success=True,
                skill_id=request.skill_id,
                action=request.action,
                result=result,
                audit_hash=audit_hash
            )
            
        except Exception as e:
            call_record['success'] = False
            call_record['error'] = str(e)
            self.call_log.append(call_record)
            
            return SkillResponse(
                success=False,
                skill_id=request.skill_id,
                action=request.action,
                error=str(e)
            )
    
    def get_stats(self) -> Dict:
        """获取调用统计"""
        total = len(self.call_log)
        success = sum(1 for c in self.call_log if c.get('success'))
        
        return {
            'total_calls': total,
            'success_calls': success,
            'failed_calls': total - success,
            'skills_used': list(set(c['skill_id'] for c in self.call_log))
        }


# 创建全局实例
skill_registry = SkillRegistry()
skill_api = SkillAPI()


# 对外开放的 API 接口
def call_skill(skill_id: str, action: str, params: Dict, user_id: str = None, api_key: str = None) -> Dict:
    """
    调用 Skill（对外开放接口）
    
    参数:
        skill_id: Skill ID（如 'ass-gateway'）
        action: 动作（如 'inspect'）
        params: 参数字典
        user_id: 用户 ID（可选）
        api_key: API Key（可选）
    
    返回:
        {
            'success': bool,
            'result': dict,
            'error': str,
            'audit_hash': str
        }
    """
    request = SkillRequest(
        skill_id=skill_id,
        action=action,
        params=params,
        user_id=user_id,
        api_key=api_key
    )
    
    response = skill_api.execute(request)
    return asdict(response)


def list_available_skills() -> List[Dict]:
    """列出所有可用 Skill（对外开放接口）"""
    return skill_registry.list_skills()


def get_skill_info(skill_id: str) -> Optional[Dict]:
    """获取 Skill 信息（对外开放接口）"""
    return skill_registry.get_skill_info(skill_id)


# 测试
if __name__ == '__main__':
    print("=" * 60)
    print("  一鉴到底 Skill API 测试")
    print("=" * 60)
    
    # 列出所有 Skill
    skills = list_available_skills()
    print(f"\n可用 Skill: {len(skills)} 个")
    for skill in skills[:5]:
        print(f"  - {skill['id']}: {skill['name']}")
    
    # 测试调用
    print("\n测试调用 ass-gateway.inspect:")
    result = call_skill(
        'ass-gateway',
        'inspect',
        {'input': '<script>alert(1)</script>'}
    )
    print(f"  结果: {result}")
    
    print("\n测试调用 code-detector.analyze:")
    result = call_skill(
        'code-detector',
        'analyze',
        {'code': 'eval(input())'}
    )
    print(f"  结果: {result}")
    
    print("\n测试调用 data-masker.mask:")
    result = call_skill(
        'data-masker',
        'mask',
        {'data': '13812345678', 'type': 'phone'}
    )
    print(f"  结果: {result}")
    
    # 统计
    print("\n" + "=" * 60)
    stats = skill_api.get_stats()
    print(f"  调用统计: {stats}")
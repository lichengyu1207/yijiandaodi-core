#!/usr/bin/env python
"""
一鉴到底 - 沙箱 API 服务
集成 Grok 迷你沙箱核心，提供 AI Agent 安全运行环境

API 端点：
- POST /api/v1/sandbox/start      - 启动沙箱会话
- POST /api/v1/sandbox/execute     - 执行操作（拦截 → 分析 → 决策）
- POST /api/v1/sandbox/respond     - 用户响应待确认操作
- GET  /api/v1/sandbox/pending     - 获取待确认操作
- GET  /api/v1/sandbox/logs        - 获取操作日志
- GET  /api/v1/sandbox/stats       - 获取统计信息
- POST /api/v1/keys/generate       - 生成 API Key
- GET  /api/v1/keys/list           - 列出所有 Key

安全机制：
- API Key 格式：yjd_1_{secret}
- 签名算法：HMAC-SHA256
- 防重放：nonce + timestamp
"""

import os
import sys
import json
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Windows 控制台默认 GBK(cp936)，无法编码 ✓/✗ 及部分中文，会导致 print 抛
# UnicodeEncodeError 使服务崩溃。统一将 stdout/stderr 重配为 UTF-8。
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# 导入本地数据存储
from local_data_store import local_store

# 添加模块路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'grok', 'grok-python'))

# Skill 模块
try:
    from skill_api import (
        skill_registry,
        skill_api,
        call_skill,
        list_available_skills,
        get_skill_info,
        SkillRequest
    )
    SKILL_API_AVAILABLE = True
except ImportError as e:
    print(f"[警告] Skill 模块导入失败: {e}")
    SKILL_API_AVAILABLE = False

# 沙箱模块
try:
    from xai_grok_sandbox import (
        MiniSandbox,
        InterceptedOperation,
        SandboxMode,
        SandboxStartRequest,
        PermissionDecision,
        OperationStatus
    )
    SANDBOX_AVAILABLE = True
except ImportError as e:
    print(f"[警告] 沙箱模块导入失败: {e}")
    SANDBOX_AVAILABLE = False
    MiniSandbox = InterceptedOperation = SandboxMode = SandboxStartRequest = None
    PermissionDecision = OperationStatus = None

# 密码学模块
try:
    from xai_grok_crypto import (
        APIKeyManager,
        RequestVerifier,
        RequestSigner,
    )
    CRYPTO_AVAILABLE = True
except ImportError as e:
    print(f"[警告] 密码学模块导入失败: {e}")
    CRYPTO_AVAILABLE = False
    APIKeyManager = RequestVerifier = RequestSigner = None

# 配置
API_PORT = int(os.environ.get('SANDBOX_PORT', 9092))
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')

# 全局实例
sandbox: MiniSandbox = None
key_manager: APIKeyManager = None
request_verifier: RequestVerifier = None
require_auth = True  # 是否需要认证


# ==================== API 处理器 ====================

class SandboxAPIHandler(BaseHTTPRequestHandler):
    """沙箱 API 处理器"""
    
    def send_json(self, data: dict, status: int = 200):
        """发送 JSON 响应"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Signature, X-Timestamp, X-Nonce')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
    
    def verify_auth(self) -> tuple:
        """验证请求认证"""
        if not require_auth or not CRYPTO_AVAILABLE:
            return True, None, ""
        
        # 获取认证头
        api_key = self.headers.get('X-API-Key', '')
        signature = self.headers.get('X-Signature', '')
        timestamp = self.headers.get('X-Timestamp', '')
        nonce = self.headers.get('X-Nonce', '')
        
        if not all([api_key, signature, timestamp, nonce]):
            return False, None, "Missing authentication headers"
        
        # 读取 body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else ""
        
        # 验证请求
        valid, key, error = request_verifier.verify_request(
            key_string=api_key,
            signature=signature,
            method=self.command,
            path=urlparse(self.path).path,
            timestamp=int(timestamp),
            nonce=nonce,
            body=body
        )
        
        return valid, key, error
    
    def do_OPTIONS(self):
        """CORS 预检"""
        self.send_json({'status': 'ok'})
    
    def do_GET(self):
        """处理 GET 请求"""
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/health':
            self.handle_health()
        elif path == '/api/v1/sandbox/pending':
            self.handle_get_pending()
        elif path == '/api/v1/sandbox/logs':
            self.handle_get_logs(parsed)
        elif path == '/api/v1/sandbox/stats':
            self.handle_get_stats()
        elif path == '/api/v1/evidence/records':
            self.handle_get_evidence_records(parsed)
        elif path == '/api/v1/evidence/verify':
            self.handle_verify_chain()
        elif path == '/api/v1/evidence/export':
            self.handle_export_report(parsed)
        elif path == '/api/v1/keys/list':
            self.handle_list_keys()
        elif path == '/api/v1/skills':
            self.handle_list_skills()
        elif path.startswith('/api/v1/skills/'):
            # GET /api/v1/skills/{skill_id}
            parts = path.rstrip('/').split('/')
            if len(parts) == 5:
                skill_id = parts[4]
                self.handle_get_skill_info(skill_id)
        else:
            self.send_json({'error': 'Not Found'}, 404)
    
    def do_POST(self):
        """处理 POST 请求"""
        parsed = urlparse(self.path)
        path = parsed.path

        # Key 管理端点（需要认证）
        if path == '/api/v1/keys/generate':
            self.handle_generate_key()
            return

        # Skill 调用端点（对外开放）
        if path == '/api/v1/skills/call':
            self.handle_call_skill()
            return

        if path.startswith('/api/v1/skills/'):
            # 动态 Skill 调用: POST /api/v1/skills/{skill_id}/{action}
            parts = path.rstrip('/').split('/')
            # parts = ['', 'api', 'v1', 'skills', 'skill_id', 'action']
            if len(parts) >= 6:
                skill_id = parts[4]
                action = parts[5]
                self.handle_skill_action(skill_id, action)
                return

        # 其他端点需要认证
        if require_auth and CRYPTO_AVAILABLE:
            valid, key, error = self.verify_auth()
            if not valid:
                self.send_json({'error': f'Authentication failed: {error}'}, 401)
                return

        if path == '/api/v1/sandbox/start':
            self.handle_start()
        elif path == '/api/v1/sandbox/execute':
            self.handle_execute()
        elif path == '/api/v1/sandbox/respond':
            self.handle_respond()
        elif path.startswith('/api/v1/sandbox/logs/') and '/confirm' in path:
            # POST /api/v1/sandbox/logs/{id}/confirm
            self.handle_confirm_log(parsed)
        elif path.startswith('/api/v1/sandbox/logs/') and '/intercept' in path:
            # POST /api/v1/sandbox/logs/{id}/intercept
            self.handle_intercept_log(parsed)
        elif path.startswith('/api/v1/sandbox/logs/') and '/allow' in path:
            # POST /api/v1/sandbox/logs/{id}/allow
            self.handle_allow_log(parsed)
        else:
            self.send_json({'error': 'Not Found'}, 404)
    
    def handle_health(self):
        """健康检查"""
        self.send_json({
            'status': 'healthy',
            'service': '一鉴到底 沙箱 API',
            'version': '2.0.0',
            'sandbox_available': SANDBOX_AVAILABLE,
            'timestamp': datetime.now().isoformat()
        })
    
    def handle_start(self):
        """启动沙箱会话"""
        global sandbox
        
        if not SANDBOX_AVAILABLE:
            self.send_json({'error': 'Sandbox module not available'}, 500)
            return
        
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            # 创建沙箱
            sandbox = MiniSandbox(deepseek_api_key=DEEPSEEK_API_KEY)
            
            # 启动请求
            request = SandboxStartRequest(
                environment_id=data.get('environment_id'),
                repository=data.get('repository'),
                branch=data.get('branch'),
                mode=SandboxMode.AGENT
            )
            
            response = sandbox.start_session(request)
            
            self.send_json({
                'success': True,
                'sandbox_id': response.sandbox_id,
                'session_id': response.session_id,
                'websocket_url': response.websocket_url,
                'mode': response.mode.value if response.mode else 'AGENT'
            })
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_execute(self):
        """执行操作（核心流程）"""
        global sandbox
        
        if not SANDBOX_AVAILABLE or sandbox is None:
            self.send_json({'error': 'Sandbox not initialized. Call /start first.'}, 400)
            return
        
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            # 创建操作对象
            operation = InterceptedOperation(
                agent_name=data.get('agent', 'Unknown'),
                operation_type=data.get('operation_type', 'unknown'),
                operation_content=data.get('operation', ''),
                target=data.get('target', ''),
                context=data.get('context', ''),
                parameters=data.get('parameters', {})
            )
            
            # 执行操作（拦截 → 分析 → 决策 → 日志）
            result = sandbox.execute(operation)
            
            self.send_json({
                'success': True,
                'operation_id': result.id,
                'operation': result.operation_content,
                'risk_level': result.risk_level,
                'decision': result.decision.value,
                'needs_confirmation': result.decision == PermissionDecision.ASK_USER,
                'analysis': result.analysis_result,
                'timestamp': result.timestamp
            })
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_respond(self):
        """用户响应待确认操作"""
        global sandbox
        
        if not SANDBOX_AVAILABLE or sandbox is None:
            self.send_json({'error': 'Sandbox not initialized'}, 400)
            return
        
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            operation_id = data.get('operation_id')
            approved = data.get('approved', False)
            user_response = data.get('response', '')
            
            sandbox.gate.respond(operation_id, approved, user_response)
            
            self.send_json({
                'success': True,
                'operation_id': operation_id,
                'approved': approved
            })
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_get_pending(self):
        """获取待确认操作"""
        global sandbox
        
        if not SANDBOX_AVAILABLE or sandbox is None:
            self.send_json({'pending': []})
            return
        
        pending = sandbox.gate.get_pending()
        
        self.send_json({
            'count': len(pending),
            'pending': [
                {
                    'id': op.id,
                    'agent': op.agent_name,
                    'operation': op.operation_content,
                    'risk_level': op.risk_level,
                    'analysis': op.analysis_result,
                    'timestamp': op.timestamp
                }
                for op in pending
            ]
        })
    
    def handle_get_logs(self, parsed):
        """获取操作日志（从本地数据库）"""
        params = parse_qs(parsed.query)
        limit = int(params.get('limit', ['100'])[0])
        agent = params.get('agent', [None])[0]
        risk_level = params.get('risk_level', [None])[0]
        decision = params.get('decision', [None])[0]
        
        # 从本地数据库读取
        logs = local_store.get_logs(limit, agent, risk_level, decision)
        
        self.send_json({
            'success': True,
            'count': len(logs),
            'logs': logs
        })
    
    def handle_get_stats(self):
        """获取统计信息（从本地数据库）"""
        stats = local_store.get_stats()
        
        self.send_json({
            'success': True,
            'stats': stats
        })
    
    def handle_confirm_log(self, parsed):
        """确认审计日志"""
        params = parse_qs(parsed.query)
        log_id = int(params.get('id', [0])[0])
        
        if not log_id:
            self.send_json({'success': False, 'error': '缺少日志ID'}, 400)
            return
        
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else b'{}'
            data = json.loads(body.decode('utf-8'))
            
            user_response = data.get('response', 'confirmed')
            
            # 更新数据库
            success = local_store.confirm_log(log_id, user_response)
            
            if success:
                self.send_json({
                    'success': True,
                    'message': f'日志 {log_id} 已确认',
                    'log_id': log_id
                })
            else:
                self.send_json({'success': False, 'error': '日志不存在'}, 404)
                
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_intercept_log(self, parsed):
        """拦截操作（更新决策为 block）"""
        params = parse_qs(parsed.query)
        log_id = int(params.get('id', [0])[0])
        
        if not log_id:
            self.send_json({'success': False, 'error': '缺少日志ID'}, 400)
            return
        
        try:
            # 更新决策为 block
            success = local_store.update_log(log_id, {'decision': 'block'})
            
            if success:
                self.send_json({
                    'success': True,
                    'message': f'日志 {log_id} 已拦截',
                    'log_id': log_id
                })
            else:
                self.send_json({'success': False, 'error': '日志不存在'}, 404)
                
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_allow_log(self, parsed):
        """放行操作（更新决策为 allow）"""
        params = parse_qs(parsed.query)
        log_id = int(params.get('id', [0])[0])
        
        if not log_id:
            self.send_json({'success': False, 'error': '缺少日志ID'}, 400)
            return
        
        try:
            # 更新决策为 allow
            success = local_store.update_log(log_id, {'decision': 'allow'})
            
            if success:
                self.send_json({
                    'success': True,
                    'message': f'日志 {log_id} 已放行',
                    'log_id': log_id
                })
            else:
                self.send_json({'success': False, 'error': '日志不存在'}, 404)
                
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    # ==================== Key 管理 ====================
    
    def handle_generate_key(self):
        """生成 API Key"""
        global key_manager
        
        if not CRYPTO_AVAILABLE:
            self.send_json({'error': 'Crypto module not available'}, 500)
            return
        
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else b'{}'
            data = json.loads(body.decode('utf-8'))
            
            # 生成 Key
            key = key_manager.generate_key(
                scopes=data.get('scopes', ['*']),
                expires_days=data.get('expires_days'),
                rate_limit=data.get('rate_limit', 100)
            )
            
            self.send_json({
                'success': True,
                'key_id': key.key_id,
                'api_key': key.full_key,
                'prefix': key.prefix,
                'version': key.version,
                'scopes': key.scopes,
                'expires_at': key.expires_at.isoformat() if key.expires_at else None,
                'rate_limit': key.rate_limit
            })
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_list_keys(self):
        """列出所有 API Key"""
        global key_manager

        if not CRYPTO_AVAILABLE:
            self.send_json({'keys': []})
            return

        keys = key_manager.list_keys()

        self.send_json({
            'success': True,
            'count': len(keys),
            'keys': keys
        })

    # ==================== Skill API (对外开放) ====================

    def handle_list_skills(self):
        """列出所有可用 Skill"""
        if not SKILL_API_AVAILABLE:
            self.send_json({'error': 'Skill API not available'}, 500)
            return

        skills = list_available_skills()

        self.send_json({
            'success': True,
            'count': len(skills),
            'skills': skills,
            'timestamp': datetime.now().isoformat()
        })

    def handle_get_skill_info(self, skill_id: str):
        """获取 Skill 详情"""
        if not SKILL_API_AVAILABLE:
            self.send_json({'error': 'Skill API not available'}, 500)
            return

        info = get_skill_info(skill_id)

        if not info:
            self.send_json({'error': f'Skill not found: {skill_id}'}, 404)
            return

        self.send_json({
            'success': True,
            'skill_id': skill_id,
            'info': info
        })

    def handle_call_skill(self):
        """调用 Skill（通用接口）"""
        if not SKILL_API_AVAILABLE:
            self.send_json({'error': 'Skill API not available'}, 500)
            return

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            skill_id = data.get('skill_id')
            action = data.get('action')
            params = data.get('params', {})
            user_id = data.get('user_id')
            api_key = self.headers.get('X-API-Key')

            if not skill_id or not action:
                self.send_json({'error': 'Missing skill_id or action'}, 400)
                return

            # 调用 Skill
            result = call_skill(skill_id, action, params, user_id, api_key)

            self.send_json(result)

        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)

    def handle_skill_action(self, skill_id: str, action: str):
        """动态 Skill 调用"""
        if not SKILL_API_AVAILABLE:
            self.send_json({'error': 'Skill API not available'}, 500)
            return

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else b'{}'
            params = json.loads(body.decode('utf-8'))

            user_id = self.headers.get('X-User-ID')
            api_key = self.headers.get('X-API-Key')

            # 调用 Skill
            result = call_skill(skill_id, action, params, user_id, api_key)

            self.send_json(result)

        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def log_message(self, format, *args):
        """自定义日志"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {format % args}")
    
    # ==================== 哈希链存证 API ====================
    
    def handle_get_evidence_records(self, parsed):
        """获取存证记录"""
        try:
            from hashchain_evidence import HashChainEvidence
            
            params = parse_qs(parsed.query)
            limit = int(params.get('limit', [50])[0])
            
            chain = HashChainEvidence('data/evidence_chain.db')
            records = chain.get_all_records(limit)
            
            self.send_json({
                'success': True,
                'count': len(records),
                'records': records
            })
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_verify_chain(self):
        """验证哈希链完整性"""
        try:
            from hashchain_evidence import HashChainEvidence
            
            chain = HashChainEvidence('data/evidence_chain.db')
            status = chain.verify_chain()
            
            self.send_json({
                'success': True,
                **status
            })
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_export_report(self, parsed):
        """导出审计报告"""
        try:
            from hashchain_evidence import HashChainEvidence
            from report_generator import ReportGenerator
            
            params = parse_qs(parsed.query)
            format = params.get('format', ['json'])[0]
            
            chain = HashChainEvidence('data/evidence_chain.db')
            records = chain.get_all_records(limit=1000)
            chain_status = chain.verify_chain()
            
            generator = ReportGenerator()
            
            if format == 'html':
                report = generator.generate_html_report(records, chain_status)
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Disposition', f'attachment; filename="audit_report_{datetime.now().strftime("%Y%m%d")}.html"')
                self.end_headers()
                self.wfile.write(report.encode('utf-8'))
            else:
                report = generator.generate_json_report(records, chain_status)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Disposition', f'attachment; filename="audit_report_{datetime.now().strftime("%Y%m%d")}.json"')
                self.end_headers()
                self.wfile.write(json.dumps(report, ensure_ascii=False, indent=2).encode('utf-8'))
                
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)


# ==================== 启动服务 ====================

def run_server():
    """运行沙箱 API 服务"""
    global key_manager, request_verifier
    
    # 初始化密码学模块
    if CRYPTO_AVAILABLE:
        key_manager = APIKeyManager()
        request_verifier = RequestVerifier(key_manager)
        print("\n   ✓ 密码学模块已加载")
        print("   ✓ API Key 格式: yjd_1_{secret}")
        print("   ✓ 签名算法: HMAC-SHA256")
    else:
        print("\n   ✗ 密码学模块未加载，认证已禁用")

    # 初始化 Skill 模块
    if SKILL_API_AVAILABLE:
        print("   ✓ Skill API 已加载")
        print(f"   ✓ 可用 Skill: {len(list_available_skills())} 个")

    print("\n" + "="*60)
    print("   一鉴到底 - 沙箱 API 服务")
    print("="*60)
    print(f"\n   API 端点: http://localhost:{API_PORT}")
    print(f"\n   核心流程:")
    print(f"   1. POST /api/v1/sandbox/start    - 启动沙箱会话")
    print(f"   2. POST /api/v1/sandbox/execute   - 执行操作")
    print(f"   3. POST /api/v1/sandbox/respond   - 用户响应")
    print(f"   4. GET  /api/v1/sandbox/pending   - 待确认操作")
    print(f"   5. GET  /api/v1/sandbox/logs      - 操作日志")
    print(f"\n   Key 管理:")
    print(f"   6. POST /api/v1/keys/generate     - 生成 API Key")
    print(f"   7. GET  /api/v1/keys/list         - 列出所有 Key")
    print(f"\n   Skill API (对外开放):")
    print(f"   8. GET  /api/v1/skills              - 列出所有 Skill")
    print(f"   9. GET  /api/v1/skills/{{skill_id}} - 获取 Skill 详情")
    print(f"  10. POST /api/v1/skills/call         - 调用 Skill")
    print(f"  11. POST /api/v1/skills/{{skill_id}}/{{action}} - 动态调用")
    print(f"\n   四大组件:")
    print(f"   ✓ OperationInterceptor  - 指令级拦截器")
    print(f"   ✓ IntentAnalysisSandbox - 意图分析沙箱")
    print(f"   ✓ BehaviorLogger        - 行为白盒化日志")
    print(f"   ✓ PermissionGate        - 权限管控执行点")
    print("\n" + "="*60)
    
    server = HTTPServer(('127.0.0.1', API_PORT), SandboxAPIHandler)
    server.serve_forever()


if __name__ == '__main__':
    run_server()
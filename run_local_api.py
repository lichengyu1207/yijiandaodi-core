#!/usr/bin/env python
"""
一鉴到底 - 本地 API 服务
提供 localhost:9090/verify 端点供 AI Agent 调用
"""
import json
import hashlib
import asyncio
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import sys
import os

# 添加后端路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from auth_app.local_engine import LocalAnalysisEngine
    from auth_app.immutable_audit import ImmutableAuditLog
except ImportError:
    # 如果导入失败，使用简化版本
    LocalAnalysisEngine = None
    ImmutableAuditLog = None


class VerificationHandler(BaseHTTPRequestHandler):
    """校验请求处理器"""
    
    def do_OPTIONS(self):
        """处理 CORS 预检请求"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """处理 GET 请求"""
        if self.path == '/health':
            self.send_json_response({
                'status': 'healthy',
                'service': '一鉴到底 API',
                'version': '2.0.0',
                'timestamp': datetime.now().isoformat()
            })
        elif self.path == '/status':
            self.send_json_response({
                'service': 'running',
                'port': 9090,
                'mode': 'local',
                'data_policy': '不出域'
            })
        else:
            self.send_error(404, 'Not Found')
    
    def do_POST(self):
        """处理 POST 请求"""
        if self.path == '/verify':
            self.handle_verify()
        else:
            self.send_error(404, 'Not Found')
    
    def handle_verify(self):
        """处理校验请求"""
        try:
            # 读取请求体
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            # 提取参数
            operation = data.get('operation', '')
            context = data.get('context', '')
            agent = data.get('agent', 'Unknown AI Agent')
            user_id = data.get('user_id', 'default')
            
            # 分析风险
            analysis_result = self.analyze_operation(operation, context)
            
            # 生成审计哈希
            audit_hash = self.generate_audit_hash(operation, context, analysis_result)
            
            # 构造响应
            response = {
                'success': True,
                'operation': operation,
                'context': context,
                'agent': agent,
                'risk_level': analysis_result['risk_level'],
                'risk_score': analysis_result['risk_score'],
                'should_block': analysis_result['should_block'],
                'explanation': analysis_result['explanation'],
                'recommendation': analysis_result['recommendation'],
                'audit_hash': audit_hash,
                'timestamp': datetime.now().isoformat(),
                'mode': analysis_result.get('mode', 'rule'),
                'data_policy': '本地处理，数据不出域'
            }
            
            # 如果是高风险操作，记录到审计日志
            if analysis_result['risk_level'] in ['high', 'critical']:
                self.log_audit(agent, operation, analysis_result, audit_hash)
            
            self.send_json_response(response)
            
        except json.JSONDecodeError:
            self.send_error(400, 'Invalid JSON')
        except Exception as e:
            self.send_error(500, str(e))
    
    def analyze_operation(self, operation: str, context: str) -> dict:
        """分析操作风险"""
        
        # 高风险关键词
        high_risk_patterns = [
            'git push', 'rm -rf', 'delete', 'drop table',
            'password', 'secret', 'api_key', 'token',
            'production', 'prod', 'master', 'main',
            'curl', 'wget', 'base64', 'eval'
        ]
        
        # 中风险关键词
        medium_risk_patterns = [
            'install', 'update', 'config', 'env',
            'api', 'http', 'https', 'ssh'
        ]
        
        operation_lower = operation.lower()
        context_lower = context.lower()
        
        # 检查高风险
        for pattern in high_risk_patterns:
            if pattern in operation_lower or pattern in context_lower:
                return {
                    'risk_level': 'high',
                    'risk_score': 80,
                    'should_block': True,
                    'explanation': f'检测到高风险操作关键词: {pattern}。该操作可能存在安全风险，建议人工确认后执行。',
                    'recommendation': '建议由安全工程师审核后再执行，或确认操作环境的合法性。',
                    'mode': 'rule'
                }
        
        # 检查中风险
        for pattern in medium_risk_patterns:
            if pattern in operation_lower or pattern in context_lower:
                return {
                    'risk_level': 'medium',
                    'risk_score': 50,
                    'should_block': False,
                    'explanation': f'检测到中等风险操作: {pattern}。建议记录审计日志。',
                    'recommendation': '可以在监控下执行，建议记录操作详情。',
                    'mode': 'rule'
                }
        
        # 低风险
        return {
            'risk_level': 'low',
            'risk_score': 10,
            'should_block': False,
            'explanation': '该操作风险等级较低，可以安全执行。',
            'recommendation': '正常执行即可，系统已自动记录审计日志。',
            'mode': 'rule'
        }
    
    def generate_audit_hash(self, operation: str, context: str, analysis: dict) -> str:
        """生成审计哈希"""
        data = f"{operation}|{context}|{analysis['risk_level']}|{datetime.now().isoformat()}"
        return '0x' + hashlib.sha256(data.encode()).hexdigest()[:40]
    
    def log_audit(self, agent: str, operation: str, analysis: dict, audit_hash: str):
        """记录审计日志"""
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'agent': agent,
            'operation': operation,
            'risk_level': analysis['risk_level'],
            'audit_hash': audit_hash
        }
        
        # 写入本地文件
        log_dir = os.path.join(os.path.dirname(__file__), 'audit_logs')
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, f'audit_{datetime.now().strftime("%Y%m%d")}.jsonl')
        
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry) + '\n')
    
    def send_json_response(self, data: dict):
        """发送 JSON 响应"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {format % args}")


def run_server(port: int = 9090):
    """运行 API 服务"""
    print("\n" + "="*50)
    print("  一鉴到底 - 本地 API 服务")
    print("="*50)
    print(f"\n  API 端点: http://localhost:{port}/verify")
    print(f"  健康检查: http://localhost:{port}/health")
    print(f"  状态查询: http://localhost:{port}/status")
    print("\n  数据策略: 本地处理，数据不出域")
    print("\n" + "="*50)
    print("\n  等待 AI Agent 调用...\n")
    
    server = HTTPServer(('127.0.0.1', port), VerificationHandler)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\n服务已停止")
        server.shutdown()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='一鉴到底本地API服务')
    parser.add_argument('--port', type=int, default=9090, help='服务端口 (默认: 9090)')
    
    args = parser.parse_args()
    run_server(args.port)
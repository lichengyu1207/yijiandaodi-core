#!/usr/bin/env python
"""
一鉴到底 - 实名认证 API
提供手机号验证和实名认证功能
"""

import os
import json
import hashlib
import sqlite3
import secrets
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# 配置
AUTH_PORT = 9091
DB_PATH = os.path.join(os.path.dirname(__file__), 'auth.db')

# 验证码存储（生产环境应使用 Redis）
VERIFICATION_CODES = {}

# ==================== 数据库初始化 ====================

def init_database():
    """初始化认证数据库"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 用户表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            phone_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            name_hash TEXT NOT NULL,
            verified INTEGER DEFAULT 0,
            verified_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 认证日志表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS auth_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT,
            action TEXT NOT NULL,
            ip TEXT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    print(f"[认证数据库] 初始化完成: {DB_PATH}")


def hash_data(data: str) -> str:
    """哈希敏感数据"""
    return hashlib.sha256(data.encode()).hexdigest()


def generate_code() -> str:
    """生成6位验证码"""
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])


# ==================== API 处理器 ====================

class AuthHandler(BaseHTTPRequestHandler):
    """认证 API 处理器"""
    
    def send_json(self, data: dict, status: int = 200):
        """发送 JSON 响应"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
    
    def do_OPTIONS(self):
        """CORS 预检"""
        self.send_json({'status': 'ok'})
    
    def do_GET(self):
        """处理 GET 请求"""
        parsed = urlparse(self.path)
        path = parsed.path
        
        if path == '/health':
            self.send_json({
                'status': 'healthy',
                'service': '实名认证 API',
                'version': '1.0.0'
            })
        
        elif path == '/api/v1/auth/status':
            # 检查认证状态（需传入手机号）
            params = parse_qs(parsed.query)
            phone = params.get('phone', [None])[0]
            
            if phone:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute('SELECT verified, verified_at FROM users WHERE phone = ?', (phone,))
                row = cursor.fetchone()
                conn.close()
                
                if row and row[0]:
                    self.send_json({
                        'success': True,
                        'is_verified': True,
                        'verified_at': row[1]
                    })
                else:
                    self.send_json({
                        'success': True,
                        'is_verified': False
                    })
            else:
                self.send_json({
                    'success': False,
                    'error': 'phone parameter required'
                }, 400)
        
        else:
            self.send_json({'error': 'Not Found'}, 404)
    
    def do_POST(self):
        """处理 POST 请求"""
        parsed = urlparse(self.path)
        path = parsed.path
        
        if path == '/api/v1/auth/send-code':
            self.handle_send_code()
        elif path == '/api/v1/auth/verify-code':
            self.handle_verify_code()
        elif path == '/api/v1/auth/verify-name':
            self.handle_verify_name()
        else:
            self.send_json({'error': 'Not Found'}, 404)
    
    def handle_send_code(self):
        """发送验证码"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            phone = data.get('phone', '')
            
            # 验证手机号格式
            if not phone or len(phone) != 11:
                self.send_json({'success': False, 'error': '请输入正确的手机号'}, 400)
                return
            
            # 生成验证码
            code = generate_code()
            
            # 存储验证码（5分钟有效）
            VERIFICATION_CODES[phone] = {
                'code': code,
                'expires': time.time() + 300
            }
            
            # 生产环境应调用短信 API
            print(f"[验证码] {phone} -> {code}")
            
            self.send_json({
                'success': True,
                'message': '验证码已发送',
                'expires_in': 300
            })
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_verify_code(self):
        """验证验证码"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            phone = data.get('phone', '')
            code = data.get('code', '')
            
            # 检查验证码
            stored = VERIFICATION_CODES.get(phone)
            
            if not stored:
                self.send_json({'success': False, 'error': '请先获取验证码'}, 400)
                return
            
            if time.time() > stored['expires']:
                del VERIFICATION_CODES[phone]
                self.send_json({'success': False, 'error': '验证码已过期'}, 400)
                return
            
            if code != stored['code']:
                self.send_json({'success': False, 'error': '验证码错误'}, 400)
                return
            
            # 验证成功，删除验证码
            del VERIFICATION_CODES[phone]
            
            self.send_json({
                'success': True,
                'message': '验证码正确'
            })
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_verify_name(self):
        """实名认证"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            phone = data.get('phone', '')
            name = data.get('name', '')
            
            if not phone or not name:
                self.send_json({'success': False, 'error': '手机号和姓名不能为空'}, 400)
                return
            
            # 哈希敏感数据
            phone_hash = hash_data(phone)
            name_hash = hash_data(name)
            
            # 存储到数据库
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # 检查是否已存在
            cursor.execute('SELECT id FROM users WHERE phone = ?', (phone,))
            if cursor.fetchone():
                # 更新
                cursor.execute('''
                    UPDATE users SET name = ?, name_hash = ?, verified = 1, verified_at = ?
                    WHERE phone = ?
                ''', (name, name_hash, datetime.now().isoformat(), phone))
            else:
                # 插入
                cursor.execute('''
                    INSERT INTO users (phone, phone_hash, name, name_hash, verified, verified_at)
                    VALUES (?, ?, ?, ?, 1, ?)
                ''', (phone, phone_hash, name, name_hash, datetime.now().isoformat()))
            
            conn.commit()
            conn.close()
            
            self.send_json({
                'success': True,
                'message': '实名认证成功',
                'verified_at': datetime.now().isoformat()
            })
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def log_message(self, format, *args):
        """自定义日志"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {format % args}")


# ==================== 启动服务 ====================

def run_server():
    """运行认证服务"""
    print("\n" + "="*60)
    print("   一鉴到底 - 实名认证 API")
    print("="*60)
    print(f"\n   API 端点: http://localhost:{AUTH_PORT}")
    print(f"   发送验证码: POST /api/v1/auth/send-code")
    print(f"   验证验证码: POST /api/v1/auth/verify-code")
    print(f"   实名认证:   POST /api/v1/auth/verify-name")
    print(f"   认证状态:   GET  /api/v1/auth/status")
    print("\n" + "="*60)
    
    init_database()
    
    server = HTTPServer(('127.0.0.1', AUTH_PORT), AuthHandler)
    server.serve_forever()


if __name__ == '__main__':
    run_server()
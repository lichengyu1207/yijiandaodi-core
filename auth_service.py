#!/usr/bin/env python
"""
一鉴到底 - 等保二级认证服务

端口: 9093
功能:
- 密码登录/注册
- 短信验证码
- 人脸识别（预留接口）
- 实名认证
- 用户数据库同步
"""

import os
import sys
import json
import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import re

# 配置
AUTH_PORT = int(os.environ.get('AUTH_PORT', 9093))
DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'users.db')

# 确保 data 目录存在
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# ==================== 数据库 ====================

class UserDB:
    """用户数据库"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.init_db()
    
    def get_conn(self):
        return sqlite3.connect(self.db_path)
    
    def init_db(self):
        """初始化数据库"""
        conn = self.get_conn()
        cursor = conn.cursor()
        
        # 用户表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                phone TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                name TEXT,
                id_card TEXT,
                face_registered INTEGER DEFAULT 0,
                is_realname INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                created_at TEXT NOT NULL,
                last_login TEXT
            )
        ''')
        
        # 登录日志表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS login_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                login_type TEXT NOT NULL,
                ip_address TEXT,
                device_info TEXT,
                success INTEGER NOT NULL,
                timestamp TEXT NOT NULL
            )
        ''')
        
        # 验证码表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS verification_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT NOT NULL,
                code TEXT NOT NULL,
                code_type TEXT NOT NULL,
                used INTEGER DEFAULT 0,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        ''')
        
        # API Key 表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                key_id TEXT NOT NULL,
                api_key TEXT NOT NULL,
                scopes TEXT,
                rate_limit INTEGER DEFAULT 1000,
                created_at TEXT NOT NULL,
                expires_at TEXT,
                last_used TEXT
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def create_user(self, phone: str, password: str) -> dict:
        """创建用户"""
        user_id = secrets.token_hex(8)
        salt = secrets.token_hex(16)
        password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
        
        conn = self.get_conn()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO users (id, phone, password_hash, salt, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, phone, password_hash, salt, datetime.now().isoformat()))
            
            conn.commit()
            
            return {
                'success': True,
                'user_id': user_id,
                'phone': phone
            }
        except sqlite3.IntegrityError:
            return {'success': False, 'error': '手机号已注册'}
        finally:
            conn.close()
    
    def verify_password(self, phone: str, password: str) -> dict:
        """验证密码"""
        conn = self.get_conn()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, password_hash, salt, name, is_realname, face_registered
            FROM users WHERE phone = ?
        ''', (phone,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return {'success': False, 'error': '用户不存在'}
        
        user_id, password_hash, salt, name, is_realname, face_registered = row
        
        # 验证密码
        input_hash = hashlib.sha256((password + salt).encode()).hexdigest()
        
        if input_hash != password_hash:
            return {'success': False, 'error': '密码错误'}
        
        # 更新最后登录时间
        conn = self.get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE users SET last_login = ? WHERE id = ?
        ''', (datetime.now().isoformat(), user_id))
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'user_id': user_id,
            'phone': phone,
            'name': name,
            'is_realname': bool(is_realname),
            'face_registered': bool(face_registered)
        }
    
    def save_verification_code(self, phone: str, code: str, code_type: str = 'login'):
        """保存验证码"""
        conn = self.get_conn()
        cursor = conn.cursor()
        
        expires_at = datetime.now() + timedelta(minutes=5)
        
        cursor.execute('''
            INSERT INTO verification_codes (phone, code, code_type, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (phone, code, code_type, expires_at.isoformat(), datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
    
    def verify_code(self, phone: str, code: str, code_type: str = 'login') -> bool:
        """验证验证码"""
        conn = self.get_conn()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id FROM verification_codes
            WHERE phone = ? AND code = ? AND code_type = ? AND used = 0 AND expires_at > ?
            ORDER BY created_at DESC LIMIT 1
        ''', (phone, code, code_type, datetime.now().isoformat()))
        
        row = cursor.fetchone()
        
        if row:
            # 标记为已使用
            cursor.execute('UPDATE verification_codes SET used = 1 WHERE id = ?', (row[0],))
            conn.commit()
            conn.close()
            return True
        
        conn.close()
        return False
    
    def update_realname(self, user_id: str, name: str, id_card: str) -> dict:
        """更新实名信息"""
        conn = self.get_conn()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                UPDATE users SET name = ?, id_card = ?, is_realname = 1
                WHERE id = ?
            ''', (name, id_card, user_id))
            
            conn.commit()
            conn.close()
            
            return {'success': True, 'name': name}
        except Exception as e:
            conn.close()
            return {'success': False, 'error': str(e)}
    
    def log_login(self, user_id: str, login_type: str, success: bool, ip: str = None, device: str = None):
        """记录登录日志"""
        conn = self.get_conn()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO login_logs (user_id, login_type, ip_address, device_info, success, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, login_type, ip, device, int(success), datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
    
    def create_api_key(self, user_id: str, scopes: list = None) -> dict:
        """创建 API Key"""
        key_id = secrets.token_hex(4)
        api_key = f"yjd_1_{secrets.token_hex(32)}"
        
        conn = self.get_conn()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO api_keys (user_id, key_id, api_key, scopes, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, key_id, api_key, json.dumps(scopes or ['*']), datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
        
        return {
            'key_id': key_id,
            'api_key': api_key
        }
    
    def get_user_api_keys(self, user_id: str) -> list:
        """获取用户的 API Key"""
        conn = self.get_conn()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT key_id, api_key, scopes, created_at, last_used
            FROM api_keys WHERE user_id = ?
        ''', (user_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                'key_id': row[0],
                'api_key': row[1][:10] + '...',
                'scopes': json.loads(row[2]),
                'created_at': row[3],
                'last_used': row[4]
            }
            for row in rows
        ]


# 全局数据库实例
user_db = UserDB(DB_PATH)


# ==================== API 处理器 ====================

class AuthAPIHandler(BaseHTTPRequestHandler):
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
            self.handle_health()
        elif path == '/api/v1/user/info':
            self.handle_get_user_info()
        else:
            self.send_json({'error': 'Not Found'}, 404)
    
    def do_POST(self):
        """处理 POST 请求"""
        parsed = urlparse(self.path)
        path = parsed.path
        
        if path == '/api/v1/auth/register':
            self.handle_register()
        elif path == '/api/v1/auth/login':
            self.handle_login()
        elif path == '/api/v1/auth/login-with-code':
            self.handle_login_with_code()
        elif path == '/api/v1/auth/send-code':
            self.handle_send_code()
        elif path == '/api/v1/auth/verify-code':
            self.handle_verify_code()
        elif path == '/api/v1/auth/verify-realname':
            self.handle_verify_realname()
        elif path == '/api/v1/auth/face-register':
            self.handle_face_register()
        elif path == '/api/v1/auth/face-verify':
            self.handle_face_verify()
        elif path == '/api/v1/keys/generate':
            self.handle_generate_key()
        elif path == '/api/v1/keys/list':
            self.handle_list_keys()
        else:
            self.send_json({'error': 'Not Found'}, 404)
    
    def handle_health(self):
        """健康检查"""
        self.send_json({
            'status': 'healthy',
            'service': '一鉴到底 认证服务',
            'version': '2.0.0',
            'timestamp': datetime.now().isoformat()
        })
    
    def handle_register(self):
        """用户注册"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            phone = data.get('phone', '')
            password = data.get('password', '')
            code = data.get('code', '')
            
            # 验证手机号
            if not re.match(r'^1[3-9]\d{9}$', phone):
                self.send_json({'success': False, 'error': '手机号格式错误'}, 400)
                return
            
            # 验证密码强度
            if len(password) < 8:
                self.send_json({'success': False, 'error': '密码至少8位'}, 400)
                return
            
            # 验证验证码
            if not user_db.verify_code(phone, code, 'register'):
                self.send_json({'success': False, 'error': '验证码错误或已过期'}, 400)
                return
            
            # 创建用户
            result = user_db.create_user(phone, password)
            
            if result['success']:
                # 记录登录日志
                user_db.log_login(result['user_id'], 'register', True)
            
            self.send_json(result)
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_login(self):
        """密码登录"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            phone = data.get('phone', '')
            password = data.get('password', '')
            
            # 验证密码
            result = user_db.verify_password(phone, password)
            
            # 记录登录日志
            if result['success']:
                user_db.log_login(result['user_id'], 'password', True)
            else:
                user_db.log_login('', 'password', False)
            
            self.send_json(result)
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_login_with_code(self):
        """验证码登录"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            phone = data.get('phone', '')
            code = data.get('code', '')
            
            # 验证验证码
            if not user_db.verify_code(phone, code, 'login'):
                self.send_json({'success': False, 'error': '验证码错误或已过期'}, 400)
                return
            
            # 查找或创建用户
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('SELECT id, name, is_realname FROM users WHERE phone = ?', (phone,))
            row = cursor.fetchone()
            conn.close()
            
            if row:
                user_id, name, is_realname = row
                result = {
                    'success': True,
                    'user_id': user_id,
                    'phone': phone,
                    'name': name,
                    'is_realname': bool(is_realname)
                }
            else:
                # 自动注册
                result = user_db.create_user(phone, secrets.token_hex(16))
                result['is_realname'] = False
            
            # 记录登录日志
            user_db.log_login(result['user_id'], 'sms_code', True)
            
            self.send_json(result)
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_send_code(self):
        """发送验证码"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            phone = data.get('phone', '')
            code_type = data.get('type', 'login')
            
            if not re.match(r'^1[3-9]\d{9}$', phone):
                self.send_json({'success': False, 'error': '手机号格式错误'}, 400)
                return
            
            # 生成验证码
            code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
            
            # 保存验证码
            user_db.save_verification_code(phone, code, code_type)
            
            # TODO: 调用短信服务发送验证码
            # 开发环境：返回验证码
            self.send_json({
                'success': True,
                'message': '验证码已发送',
                'dev_code': code  # 开发模式
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
            
            if user_db.verify_code(phone, code, 'login'):
                self.send_json({'success': True})
            else:
                self.send_json({'success': False, 'error': '验证码错误'}, 400)
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_verify_realname(self):
        """实名认证"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            user_id = data.get('user_id', '')
            name = data.get('name', '')
            id_card = data.get('id_card', '')
            
            # 验证姓名
            if not name or len(name) < 2:
                self.send_json({'success': False, 'error': '请输入正确的姓名'}, 400)
                return
            
            # 验证身份证号
            if not re.match(r'^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$', id_card):
                self.send_json({'success': False, 'error': '身份证号格式错误'}, 400)
                return
            
            # 更新实名信息
            result = user_db.update_realname(user_id, name, id_card)
            
            self.send_json(result)
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_face_register(self):
        """人脸注册"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            user_id = data.get('user_id', '')
            face_data = data.get('face_data', '')  # Base64 图片
            
            # TODO: 调用人脸识别服务
            # 开发模式：模拟成功
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('UPDATE users SET face_registered = 1 WHERE id = ?', (user_id,))
            conn.commit()
            conn.close()
            
            self.send_json({
                'success': True,
                'message': '人脸注册成功'
            })
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_face_verify(self):
        """人脸验证"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            user_id = data.get('user_id', '')
            face_data = data.get('face_data', '')
            
            # TODO: 调用人脸识别服务
            # 开发模式：模拟成功
            self.send_json({
                'success': True,
                'message': '人脸验证通过'
            })
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_generate_key(self):
        """生成 API Key"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            user_id = data.get('user_id', '')
            scopes = data.get('scopes', ['*'])
            
            result = user_db.create_api_key(user_id, scopes)
            
            self.send_json({
                'success': True,
                'key_id': result['key_id'],
                'api_key': result['api_key']
            })
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_list_keys(self):
        """列出 API Key"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            user_id = data.get('user_id', '')
            keys = user_db.get_user_api_keys(user_id)
            
            self.send_json({
                'success': True,
                'count': len(keys),
                'keys': keys
            })
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def handle_get_user_info(self):
        """获取用户信息"""
        try:
            params = parse_qs(urlparse(self.path).query)
            user_id = params.get('user_id', [''])[0]
            
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, phone, name, is_realname, face_registered, created_at
                FROM users WHERE id = ?
            ''', (user_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                self.send_json({
                    'success': True,
                    'user': {
                        'id': row[0],
                        'phone': row[1],
                        'name': row[2],
                        'is_realname': bool(row[3]),
                        'face_registered': bool(row[4]),
                        'created_at': row[5]
                    }
                })
            else:
                self.send_json({'success': False, 'error': '用户不存在'}, 404)
            
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)
    
    def log_message(self, format, *args):
        """自定义日志"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {format % args}")


# ==================== 启动服务 ====================

def run_server():
    """运行认证服务"""
    print("\n" + "="*60)
    print("   一鉴到底 - 等保二级认证服务")
    print("="*60)
    print(f"\n   服务地址: http://localhost:{AUTH_PORT}")
    print(f"\n   认证方式:")
    print(f"   1. 密码登录: POST /api/v1/auth/login")
    print(f"   2. 验证码登录: POST /api/v1/auth/login-with-code")
    print(f"   3. 人脸识别: POST /api/v1/auth/face-verify")
    print(f"\n   用户管理:")
    print(f"   4. POST /api/v1/auth/register     - 用户注册")
    print(f"   5. POST /api/v1/auth/send-code    - 发送验证码")
    print(f"   6. POST /api/v1/auth/verify-realname - 实名认证")
    print(f"\n   API Key 管理:")
    print(f"   7. POST /api/v1/keys/generate     - 生成 API Key")
    print(f"   8. POST /api/v1/keys/list         - 列出 Key")
    print(f"\n   数据库: {DB_PATH}")
    print("="*60)
    
    server = HTTPServer(('127.0.0.1', AUTH_PORT), AuthAPIHandler)
    server.serve_forever()


if __name__ == '__main__':
    run_server()
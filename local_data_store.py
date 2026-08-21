#!/usr/bin/env python
"""
一鉴到底 - 本地数据存储服务

所有数据存储在本地 SQLite 数据库中，不上传云端
"""

import os
import json
import sqlite3
import hashlib
from datetime import datetime
from typing import List, Dict, Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, 'yijiandaodi_local.db')


class LocalDataStore:
    """本地数据存储"""
    
    def __init__(self):
        self.db_path = DB_PATH
        self._init_db()
    
    def _get_conn(self):
        return sqlite3.connect(self.db_path)
    
    def _init_db(self):
        """初始化数据库"""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                agent_name TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                operation_content TEXT NOT NULL,
                context TEXT,
                risk_level TEXT NOT NULL,
                risk_score INTEGER DEFAULT 0,
                risk_tags TEXT,
                decision TEXT NOT NULL,
                analysis_result TEXT,
                audit_hash TEXT,
                user_response TEXT,
                confirmed INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT,
                updated_at TEXT NOT NULL
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key_id TEXT UNIQUE NOT NULL,
                api_key TEXT NOT NULL,
                scopes TEXT,
                rate_limit INTEGER DEFAULT 1000,
                used_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                expires_at TEXT,
                last_used TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS evidence_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                audit_hash TEXT UNIQUE NOT NULL,
                audit_log_id INTEGER,
                signature TEXT,
                evidence_type TEXT,
                exported_at TEXT,
                file_path TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def add_log(self, log_data: Dict) -> Dict:
        """添加审计日志"""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        # 生成审计哈希
        audit_data = json.dumps({
            'agent': log_data.get('agent_name'),
            'operation': log_data.get('operation_content'),
            'timestamp': datetime.now().isoformat()
        })
        audit_hash = hashlib.sha256(audit_data.encode()).hexdigest()[:16]
        
        now = datetime.now().isoformat()
        
        cursor.execute('''
            INSERT INTO audit_logs 
            (timestamp, agent_name, operation_type, operation_content, context,
             risk_level, risk_score, risk_tags, decision, analysis_result, 
             audit_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            log_data.get('timestamp', now),
            log_data.get('agent_name', 'Unknown'),
            log_data.get('operation_type', 'unknown'),
            log_data.get('operation_content', ''),
            log_data.get('context', ''),
            log_data.get('risk_level', 'low'),
            log_data.get('risk_score', 0),
            json.dumps(log_data.get('risk_tags', [])),
            log_data.get('decision', 'allow'),
            json.dumps(log_data.get('analysis_result', {})),
            audit_hash,
            now
        ))
        
        log_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'id': log_id,
            'audit_hash': audit_hash
        }
    
    def get_logs(self, limit: int = 100, agent: str = None, 
                 risk_level: str = None, decision: str = None) -> List[Dict]:
        """获取审计日志"""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        query = 'SELECT * FROM audit_logs WHERE 1=1'
        params = []
        
        if agent:
            query += ' AND agent_name = ?'
            params.append(agent)
        
        if risk_level:
            query += ' AND risk_level = ?'
            params.append(risk_level)
        
        if decision:
            query += ' AND decision = ?'
            params.append(decision)
        
        query += ' ORDER BY id DESC LIMIT ?'
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        logs = []
        for row in rows:
            logs.append({
                'id': row[0],
                'timestamp': row[1],
                'agent_name': row[2],
                'operation_type': row[3],
                'operation_content': row[4],
                'context': row[5],
                'risk_level': row[6],
                'risk_score': row[7],
                'risk_tags': json.loads(row[8]) if row[8] else [],
                'decision': row[9],
                'analysis_result': json.loads(row[10]) if row[10] else {},
                'audit_hash': row[11],
                'user_response': row[12],
                'created_at': row[13]
            })
        
        return logs
    
    def get_log_by_id(self, log_id: int) -> Optional[Dict]:
        """获取单条日志"""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM audit_logs WHERE id = ?', (log_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0],
                'timestamp': row[1],
                'agent_name': row[2],
                'operation_type': row[3],
                'operation_content': row[4],
                'context': row[5],
                'risk_level': row[6],
                'risk_score': row[7],
                'risk_tags': json.loads(row[8]) if row[8] else [],
                'decision': row[9],
                'analysis_result': json.loads(row[10]) if row[10] else {},
                'audit_hash': row[11],
                'user_response': row[12],
                'created_at': row[13]
            }
        
        return None
    
    def update_log(self, log_id: int, updates: Dict) -> bool:
        """更新审计日志"""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        update_fields = []
        values = []
        
        if 'decision' in updates:
            update_fields.append('decision = ?')
            values.append(updates['decision'])
        
        if 'user_response' in updates:
            update_fields.append('user_response = ?')
            values.append(updates['user_response'])
        
        if 'confirmed' in updates:
            update_fields.append('confirmed = ?')
            values.append(updates['confirmed'])
        
        if not update_fields:
            conn.close()
            return False
        
        values.append(log_id)
        
        cursor.execute(
            f'UPDATE audit_logs SET {", ".join(update_fields)} WHERE id = ?',
            values
        )
        
        conn.commit()
        affected = cursor.rowcount > 0
        conn.close()
        
        return affected
    
    def confirm_log(self, log_id: int, user_response: str = 'confirmed') -> Dict:
        """确认审计日志"""
        return self.update_log(log_id, {
            'user_response': user_response,
            'confirmed': True
        })
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM audit_logs')
        total = cursor.fetchone()[0]
        
        cursor.execute('SELECT risk_level, COUNT(*) FROM audit_logs GROUP BY risk_level')
        risk_stats = {row[0]: row[1] for row in cursor.fetchall()}
        
        cursor.execute('SELECT decision, COUNT(*) FROM audit_logs GROUP BY decision')
        decision_stats = {row[0]: row[1] for row in cursor.fetchall()}
        
        cursor.execute('SELECT agent_name, COUNT(*) FROM audit_logs GROUP BY agent_name')
        agent_stats = {row[0]: row[1] for row in cursor.fetchall()}
        
        conn.close()
        
        return {
            'total': total,
            'by_risk_level': risk_stats,
            'by_decision': decision_stats,
            'by_agent': agent_stats
        }
    
    def set_config(self, key: str, value: str):
        """设置配置"""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO user_config (key, value, updated_at)
            VALUES (?, ?, ?)
        ''', (key, value, datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
    
    def get_config(self, key: str) -> Optional[str]:
        """获取配置"""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        cursor.execute('SELECT value FROM user_config WHERE key = ?', (key,))
        row = cursor.fetchone()
        conn.close()
        
        return row[0] if row else None
    
    def create_api_key(self, scopes: List[str] = None, rate_limit: int = 1000) -> Dict:
        """创建 API Key"""
        import secrets
        
        key_id = secrets.token_hex(4)
        api_key = f"yjd_1_{secrets.token_hex(32)}"
        
        conn = self._get_conn()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO api_keys (key_id, api_key, scopes, rate_limit, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (key_id, api_key, json.dumps(scopes or ['*']), rate_limit, 
              datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
        
        return {
            'key_id': key_id,
            'api_key': api_key,
            'scopes': scopes or ['*'],
            'rate_limit': rate_limit
        }
    
    def list_api_keys(self) -> List[Dict]:
        """列出所有 API Key"""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        cursor.execute('SELECT key_id, api_key, scopes, rate_limit, used_count, created_at, last_used FROM api_keys')
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                'key_id': row[0],
                'api_key': row[1][:10] + '...',
                'scopes': json.loads(row[2]) if row[2] else ['*'],
                'rate_limit': row[3],
                'used_count': row[4],
                'created_at': row[5],
                'last_used': row[6]
            }
            for row in rows
        ]
    
    def verify_api_key(self, api_key: str) -> bool:
        """验证 API Key"""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        cursor.execute('SELECT id, rate_limit, used_count FROM api_keys WHERE api_key = ?', (api_key,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return False
        
        key_id, rate_limit, used_count = row
        
        # 检查是否超限
        if used_count >= rate_limit:
            conn.close()
            return False
        
        cursor.execute('''
            UPDATE api_keys SET used_count = used_count + 1, last_used = ?
            WHERE id = ?
        ''', (datetime.now().isoformat(), key_id))
        
        conn.commit()
        conn.close()
        
        return True
    
    def create_evidence(self, audit_hash: str, audit_log_id: int, 
                        evidence_type: str = 'json') -> Dict:
        """创建存证"""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        # 生成签名
        signature = hashlib.sha256(f"{audit_hash}:{datetime.now().isoformat()}".encode()).hexdigest()
        
        cursor.execute('''
            INSERT INTO evidence_records 
            (audit_hash, audit_log_id, signature, evidence_type, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (audit_hash, audit_log_id, signature, evidence_type, 
              datetime.now().isoformat()))
        
        evidence_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'evidence_id': evidence_id,
            'audit_hash': audit_hash,
            'signature': signature
        }
    
    def list_evidence(self, limit: int = 50) -> List[Dict]:
        """列出存证记录"""
        conn = self._get_conn()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT e.id, e.audit_hash, e.signature, e.evidence_type, 
                   e.exported_at, e.created_at, a.agent_name, a.operation_content
            FROM evidence_records e
            LEFT JOIN audit_logs a ON e.audit_log_id = a.id
            ORDER BY e.id DESC LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                'id': row[0],
                'audit_hash': row[1],
                'signature': row[2],
                'evidence_type': row[3],
                'exported_at': row[4],
                'created_at': row[5],
                'agent_name': row[6],
                'operation_content': row[7]
            }
            for row in rows
        ]
    
    def init_test_data(self):
        """初始化测试数据（仅用于演示）"""
        test_logs = [
            {
                'agent_name': 'Trae CN',
                'operation_type': 'code_generate',
                'operation_content': '生成代码：创建 API 客户端',
                'context': 'Python',
                'risk_level': 'critical',
                'risk_score': 100,
                'risk_tags': ['硬编码密钥', 'Trae CN API Key'],
                'decision': 'block',
                'analysis_result': {'recommendation': '检测到硬编码的 Trae CN API Key'}
            },
            {
                'agent_name': 'Trae CN',
                'operation_type': 'file_modify',
                'operation_content': '修改文件：config.py',
                'context': '敏感配置文件',
                'risk_level': 'high',
                'risk_score': 80,
                'risk_tags': ['敏感文件', '生产环境配置'],
                'decision': 'block',
                'analysis_result': {'recommendation': '检测到生产环境数据库配置修改'}
            },
            {
                'agent_name': 'Cursor',
                'operation_type': 'command_execute',
                'operation_content': '执行命令：rm -rf /tmp/*',
                'context': '系统命令',
                'risk_level': 'critical',
                'risk_score': 100,
                'risk_tags': ['危险命令', '系统破坏'],
                'decision': 'block',
                'analysis_result': {'recommendation': '检测到危险的系统命令执行'}
            },
            {
                'agent_name': 'Cursor',
                'operation_type': 'code_generate',
                'operation_content': '生成代码：快速排序算法',
                'context': 'Python',
                'risk_level': 'low',
                'risk_score': 10,
                'risk_tags': [],
                'decision': 'allow',
                'analysis_result': {'recommendation': '正常代码，无风险'}
            },
            {
                'agent_name': 'Copilot',
                'operation_type': 'batch_modify',
                'operation_content': '批量修改 7 个文件',
                'context': '批量操作',
                'risk_level': 'medium',
                'risk_score': 50,
                'risk_tags': ['批量操作'],
                'decision': 'alert',
                'analysis_result': {'recommendation': '批量文件修改，需用户确认'}
            }
        ]
        
        for log in test_logs:
            self.add_log(log)
        
        print(f"已初始化 {len(test_logs)} 条测试数据")


local_store = LocalDataStore()


if __name__ == '__main__':
    print("\n" + "="*60)
    print("   一鉴到底 - 本地数据存储")
    print("="*60)
    
    print(f"\n   数据库路径: {DB_PATH}")
    
    print("\n   初始化测试数据...")
    local_store.init_test_data()
    
    print("\n   审计日志:")
    logs = local_store.get_logs(limit=5)
    for log in logs:
        print(f"   - [{log['risk_level']}] {log['agent_name']}: {log['operation_content'][:30]}")
    
    stats = local_store.get_stats()
    print(f"\n   统计: {stats}")
    
    print("\n" + "="*60)
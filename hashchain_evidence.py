#!/usr/bin/env python
"""
一鉴到底 - 哈希链不可篡改存证系统

实现原理：
1. 每条记录的哈希包含前一条记录的哈希（链式结构）
2. 任何修改都会导致后续所有哈希失效
3. 支持验证整个链的完整性
"""

import os
import json
import hashlib
import time
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
import sqlite3


@dataclass
class AuditRecord:
    """审计记录"""
    id: int
    timestamp: str
    agent_name: str
    operation_type: str
    operation_content: str
    context: str
    risk_level: str
    risk_score: int
    risk_tags: List[str]
    decision: str
    analysis_result: str
    # 哈希链字段
    record_hash: str  # 当前记录的哈希
    prev_hash: str    # 前一条记录的哈希
    chain_index: int   # 链中的位置


class HashChainEvidence:
    """哈希链存证系统"""
    
    def __init__(self, db_path: str = 'data/evidence_chain.db'):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """初始化数据库"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS evidence_chain (
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
                record_hash TEXT NOT NULL,
                prev_hash TEXT,
                chain_index INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
        ''')
        
        # 创建索引
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_record_hash ON evidence_chain(record_hash)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_chain_index ON evidence_chain(chain_index)')
        
        conn.commit()
        conn.close()
    
    def _compute_hash(self, record: Dict) -> str:
        """计算记录哈希（包含前一条记录的哈希）"""
        # 需要哈希的字段
        hash_data = {
            'timestamp': record['timestamp'],
            'agent_name': record['agent_name'],
            'operation_type': record['operation_type'],
            'operation_content': record['operation_content'],
            'risk_level': record['risk_level'],
            'risk_score': record['risk_score'],
            'decision': record['decision'],
            'prev_hash': record.get('prev_hash', '0'),  # 前一条记录的哈希
            'chain_index': record['chain_index']
        }
        
        # 序列化并计算 SHA-256
        data_str = json.dumps(hash_data, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()
    
    def get_last_record(self) -> Optional[Dict]:
        """获取最后一条记录"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM evidence_chain 
            ORDER BY chain_index DESC 
            LIMIT 1
        ''')
        
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
                'risk_tags': row[8],
                'decision': row[9],
                'analysis_result': row[10],
                'record_hash': row[11],
                'prev_hash': row[12],
                'chain_index': row[13]
            }
        
        return None
    
    def add_record(self, record: Dict) -> Dict:
        """添加记录到哈希链"""
        
        # 获取最后一条记录
        last_record = self.get_last_record()
        
        # 设置前一条记录的哈希
        if last_record:
            prev_hash = last_record['record_hash']
            chain_index = last_record['chain_index'] + 1
        else:
            prev_hash = '0'  # 第一条记录的前置哈希为 0
            chain_index = 1
        
        # 更新记录
        record['prev_hash'] = prev_hash
        record['chain_index'] = chain_index
        
        # 计算当前记录的哈希
        record['record_hash'] = self._compute_hash(record)
        
        # 保存到数据库
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO evidence_chain (
                timestamp, agent_name, operation_type, operation_content,
                context, risk_level, risk_score, risk_tags, decision,
                analysis_result, record_hash, prev_hash, chain_index, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record['timestamp'],
            record['agent_name'],
            record['operation_type'],
            record['operation_content'],
            record.get('context', ''),
            record['risk_level'],
            record['risk_score'],
            json.dumps(record.get('risk_tags', [])),
            record['decision'],
            record.get('analysis_result', ''),
            record['record_hash'],
            record['prev_hash'],
            record['chain_index'],
            datetime.now().isoformat()
        ))
        
        record['id'] = cursor.lastrowid
        
        conn.commit()
        conn.close()
        
        return record
    
    def verify_chain(self) -> Dict:
        """验证整个哈希链的完整性"""
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM evidence_chain ORDER BY chain_index')
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            return {'valid': True, 'total_records': 0, 'errors': []}
        
        errors = []
        prev_hash = '0'
        
        for row in rows:
            record = {
                'id': row[0],
                'timestamp': row[1],
                'agent_name': row[2],
                'operation_type': row[3],
                'operation_content': row[4],
                'context': row[5],
                'risk_level': row[6],
                'risk_score': row[7],
                'risk_tags': row[8],
                'decision': row[9],
                'analysis_result': row[10],
                'record_hash': row[11],
                'prev_hash': row[12],
                'chain_index': row[13]
            }
            
            # 验证前置哈希是否匹配
            if record['prev_hash'] != prev_hash:
                errors.append({
                    'record_id': record['id'],
                    'chain_index': record['chain_index'],
                    'error': '前置哈希不匹配',
                    'expected': prev_hash,
                    'actual': record['prev_hash']
                })
            
            # 验证当前记录的哈希是否正确
            computed_hash = self._compute_hash(record)
            if computed_hash != record['record_hash']:
                errors.append({
                    'record_id': record['id'],
                    'chain_index': record['chain_index'],
                    'error': '记录哈希被篡改',
                    'expected': computed_hash,
                    'actual': record['record_hash']
                })
            
            # 更新前置哈希
            prev_hash = record['record_hash']
        
        return {
            'valid': len(errors) == 0,
            'total_records': len(rows),
            'last_hash': prev_hash,
            'errors': errors
        }
    
    def get_record_by_hash(self, record_hash: str) -> Optional[Dict]:
        """根据哈希获取记录"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM evidence_chain WHERE record_hash = ?', (record_hash,))
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
                'analysis_result': row[10],
                'record_hash': row[11],
                'prev_hash': row[12],
                'chain_index': row[13],
                'created_at': row[14]
            }
        
        return None
    
    def get_all_records(self, limit: int = 50) -> List[Dict]:
        """获取所有记录"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM evidence_chain 
            ORDER BY chain_index DESC 
            LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        records = []
        for row in rows:
            records.append({
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
                'analysis_result': row[10],
                'record_hash': row[11],
                'prev_hash': row[12],
                'chain_index': row[13],
                'created_at': row[14]
            })
        
        return records
    
    def export_report(self, record_id: int = None, format: str = 'json') -> Dict:
        """导出审计报告"""
        
        if record_id:
            # 导出单条记录
            record = self.get_record_by_id(record_id)
            if not record:
                return {'error': '记录不存在'}
            
            return self._generate_report([record], format)
        else:
            # 导出所有记录
            records = self.get_all_records(limit=1000)
            return self._generate_report(records, format)
    
    def _generate_report(self, records: List[Dict], format: str) -> Dict:
        """生成报告"""
        
        # 验证链完整性
        chain_status = self.verify_chain()
        
        report = {
            'report_id': hashlib.sha256(str(time.time()).encode()).hexdigest()[:16],
            'generated_at': datetime.now().isoformat(),
            'issuer': '一鉴到底 AI 行为审计系统',
            'chain_status': chain_status,
            'summary': {
                'total_records': len(records),
                'by_risk_level': {},
                'by_agent': {},
                'by_decision': {}
            },
            'records': records
        }
        
        # 统计
        for record in records:
            # 按风险等级统计
            level = record['risk_level']
            report['summary']['by_risk_level'][level] = report['summary']['by_risk_level'].get(level, 0) + 1
            
            # 按 Agent 统计
            agent = record['agent_name']
            report['summary']['by_agent'][agent] = report['summary']['by_agent'].get(agent, 0) + 1
            
            # 按决策统计
            decision = record['decision']
            report['summary']['by_decision'][decision] = report['summary']['by_decision'].get(decision, 0) + 1
        
        return report
    
    def get_record_by_id(self, record_id: int) -> Optional[Dict]:
        """根据 ID 获取记录"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM evidence_chain WHERE id = ?', (record_id,))
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
                'analysis_result': row[10],
                'record_hash': row[11],
                'prev_hash': row[12],
                'chain_index': row[13],
                'created_at': row[14]
            }
        
        return None


# ===== 测试 =====

def test_hash_chain():
    """测试哈希链"""
    print("\n" + "="*60)
    print("   哈希链存证测试")
    print("="*60)
    
    chain = HashChainEvidence('data/test_evidence_chain.db')
    
    # 添加测试记录
    records = [
        {
            'timestamp': datetime.now().isoformat(),
            'agent_name': 'Trae CN',
            'operation_type': 'code_generate',
            'operation_content': '生成 API 客户端代码',
            'risk_level': 'critical',
            'risk_score': 90,
            'risk_tags': ['硬编码密钥'],
            'decision': 'block'
        },
        {
            'timestamp': datetime.now().isoformat(),
            'agent_name': 'Cursor',
            'operation_type': 'file_modify',
            'operation_content': '修改 config.py',
            'risk_level': 'high',
            'risk_score': 70,
            'risk_tags': ['敏感文件'],
            'decision': 'ask_user'
        },
        {
            'timestamp': datetime.now().isoformat(),
            'agent_name': 'Copilot',
            'operation_type': 'code_generate',
            'operation_content': '生成排序算法',
            'risk_level': 'low',
            'risk_score': 10,
            'risk_tags': [],
            'decision': 'allow'
        }
    ]
    
    print("\n[添加记录到哈希链]")
    for record in records:
        added = chain.add_record(record)
        print(f"   ✓ 记录 #{added['chain_index']}: {added['agent_name']}")
        print(f"     哈希: {added['record_hash'][:16]}...")
        print(f"     前置: {added['prev_hash'][:16]}...")
    
    # 验证链
    print("\n[验证哈希链完整性]")
    status = chain.verify_chain()
    print(f"   完整性: {'✓ 有效' if status['valid'] else '✗ 无效'}")
    print(f"   总记录: {status['total_records']}")
    print(f"   最后哈希: {status['last_hash'][:16]}...")
    
    if status['errors']:
        print(f"   错误: {len(status['errors'])} 个")
        for error in status['errors']:
            print(f"     - 记录 #{error['record_id']}: {error['error']}")
    
    # 导出报告
    print("\n[导出审计报告]")
    report = chain.export_report()
    print(f"   报告 ID: {report['report_id']}")
    print(f"   生成时间: {report['generated_at']}")
    print(f"   总记录数: {report['summary']['total_records']}")
    
    print("\n" + "="*60)


if __name__ == '__main__':
    test_hash_chain()
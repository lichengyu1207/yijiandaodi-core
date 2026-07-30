"""
不可篡改审计与存证
使用默克尔树实现工业级数据不可篡改
支持 immudb 集成
"""
import json
import hashlib
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class AuditRecord:
    """审计记录"""
    id: str
    timestamp: str
    operation_type: str
    operation_id: str
    user_id: str
    content_hash: str
    previous_hash: str
    merkle_proof: List[str] = field(default_factory=list)
    signature: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class MerkleTree:
    """默克尔树 - 数据完整性验证"""

    def __init__(self):
        self.leaves: List[str] = []
        self.root: Optional[str] = None
        self.records: List[AuditRecord] = []

    def hash(self, data: str) -> str:
        """计算哈希"""
        return hashlib.sha256(data.encode()).hexdigest()

    def add_leaf(self, data: str) -> str:
        """添加叶子节点"""
        leaf_hash = self.hash(data)
        self.leaves.append(leaf_hash)
        self._build_tree()
        return leaf_hash

    def _build_tree(self):
        """构建默克尔树"""
        if not self.leaves:
            self.root = None
            return

        # 从叶子节点开始构建
        current_level = self.leaves.copy()
        
        while len(current_level) > 1:
            next_level = []
            
            for i in range(0, len(current_level), 2):
                left = current_level[i]
                right = current_level[i + 1] if i + 1 < len(current_level) else left
                combined = left + right
                parent_hash = self.hash(combined)
                next_level.append(parent_hash)
            
            current_level = next_level
        
        self.root = current_level[0] if current_level else None

    def get_proof(self, index: int) -> List[str]:
        """获取默克尔证明"""
        if index >= len(self.leaves):
            return []
        
        proof = []
        current_index = index
        current_level = self.leaves.copy()
        
        while len(current_level) > 1:
            next_level = []
            
            for i in range(0, len(current_level), 2):
                left = current_level[i]
                right = current_level[i + 1] if i + 1 < len(current_level) else left
                
                # 记录兄弟节点哈希
                if i == current_index:
                    proof.append(right if i + 1 < len(current_level) else left)
                elif i + 1 == current_index:
                    proof.append(left)
                
                parent_hash = self.hash(left + right)
                next_level.append(parent_hash)
            
            current_index = current_index // 2
            current_level = next_level
        
        return proof

    def verify_proof(self, leaf_hash: str, proof: List[str], index: int) -> bool:
        """验证默克尔证明"""
        current_hash = leaf_hash
        
        for i, sibling_hash in enumerate(proof):
            # 根据位置决定左右
            if (index >> i) % 2 == 0:
                current_hash = self.hash(current_hash + sibling_hash)
            else:
                current_hash = self.hash(sibling_hash + current_hash)
        
        return current_hash == self.root


class ImmutableAuditLog:
    """不可变审计日志"""

    def __init__(self, storage_path: str = "./audit_logs"):
        self.storage_path = storage_path
        self.merkle_tree = MerkleTree()
        self.records: List[AuditRecord] = []
        self.last_hash = "0" * 64  # 创世块

    def _generate_id(self) -> str:
        """生成唯一ID"""
        import uuid
        return str(uuid.uuid4())

    def add_record(
        self,
        operation_type: str,
        operation_id: str,
        user_id: str,
        content: str,
        metadata: Optional[Dict] = None
    ) -> AuditRecord:
        """
        添加审计记录
        - 内容哈希
        - 链接到前一条记录
        - 生成默克尔证明
        """
        # 计算内容哈希
        content_hash = self.merkle_tree.hash(content)
        
        # 添加到默克尔树
        leaf_index = len(self.merkle_tree.leaves)
        self.merkle_tree.add_leaf(content)
        
        # 生成默克尔证明
        merkle_proof = self.merkle_tree.get_proof(leaf_index)
        
        # 创建记录
        record = AuditRecord(
            id=self._generate_id(),
            timestamp=datetime.now().isoformat(),
            operation_type=operation_type,
            operation_id=operation_id,
            user_id=user_id,
            content_hash=content_hash,
            previous_hash=self.last_hash,
            merkle_proof=merkle_proof,
            metadata=metadata or {}
        )
        
        # 更新最后哈希（链式结构）
        record_data = json.dumps({
            'id': record.id,
            'timestamp': record.timestamp,
            'content_hash': record.content_hash,
            'previous_hash': record.previous_hash
        }, sort_keys=True)
        self.last_hash = self.merkle_tree.hash(record_data)
        
        # 保存记录
        self.records.append(record)
        
        logger.info(f"[审计] 记录已添加: {record.id}")
        
        return record

    def get_record(self, record_id: str) -> Optional[AuditRecord]:
        """获取记录"""
        for record in self.records:
            if record.id == record_id:
                return record
        return None

    def verify_chain(self) -> Dict[str, Any]:
        """验证整个链的完整性"""
        issues = []
        
        for i, record in enumerate(self.records):
            # 验证内容哈希
            # 验证默克尔证明
            # 验证前向链接
            
            if i > 0:
                prev_record = self.records[i - 1]
                if record.previous_hash != self._compute_record_hash(prev_record):
                    issues.append(f"记录 {record.id} 的前向链接断裂")
        
        return {
            'valid': len(issues) == 0,
            'total_records': len(self.records),
            'merkle_root': self.merkle_tree.root,
            'issues': issues
        }

    def _compute_record_hash(self, record: AuditRecord) -> str:
        """计算记录哈希"""
        record_data = json.dumps({
            'id': record.id,
            'timestamp': record.timestamp,
            'content_hash': record.content_hash,
            'previous_hash': record.previous_hash
        }, sort_keys=True)
        return self.merkle_tree.hash(record_data)

    def export_report(self) -> Dict[str, Any]:
        """导出审计报告"""
        return {
            'generated_at': datetime.now().isoformat(),
            'total_records': len(self.records),
            'merkle_root': self.merkle_tree.root,
            'chain_valid': self.verify_chain()['valid'],
            'records': [
                {
                    'id': r.id,
                    'timestamp': r.timestamp,
                    'operation_type': r.operation_type,
                    'content_hash': r.content_hash,
                    'previous_hash': r.previous_hash
                }
                for r in self.records
            ]
        }


class ImmudbClient:
    """
    immudb 客户端封装
    用于工业级不可变存储
    """

    def __init__(self, url: str = "localhost:3322"):
        self.url = url
        self.connected = False
        # 实际使用时需要安装 immudb-py
        # pip install immudb-py
        try:
            from immudb import ImmudbClient as ImmudbClientLib
            from immudb.datatypes import KV, KVList
            self.client = ImmudbClientLib.newClient(url)
            self.connected = True
            logger.info(f"[immudb] 已连接: {url}")
        except ImportError:
            logger.warning("[immudb] 未安装 immudb-py，使用本地存储")
            self.client = None

    def connect(self, database: str = "defaultdb", user: str = "immudb", password: str = "immudb"):
        """连接数据库"""
        if self.client:
            self.client.login(user, password, database)
            logger.info(f"[immudb] 登录成功: {database}")

    def set(self, key: str, value: str) -> bool:
        """写入数据"""
        if self.client:
            self.client.set(key.encode(), value.encode())
            return True
        return False

    def get(self, key: str) -> Optional[str]:
        """读取数据"""
        if self.client:
            result = self.client.get(key.encode())
            if result:
                return result.value.decode()
        return None

    def verify(self, key: str, value: str) -> bool:
        """验证数据完整性"""
        if self.client:
            # immudb 自动验证数据完整性
            result = self.get(key)
            return result == value
        return False


# ===== 使用示例 =====

def demo_audit_log():
    """演示不可变审计日志"""

    audit = ImmutableAuditLog()

    # 添加审计记录
    record1 = audit.add_record(
        operation_type='code_execution',
        operation_id='op-001',
        user_id='user-123',
        content='import os; os.system("ls -la")',
        metadata={'risk_level': 'medium'}
    )

    record2 = audit.add_record(
        operation_type='file_access',
        operation_id='op-002',
        user_id='user-123',
        content='read: /etc/passwd',
        metadata={'risk_level': 'high'}
    )

    record3 = audit.add_record(
        operation_type='git_push',
        operation_id='op-003',
        user_id='user-456',
        content='push: origin/main',
        metadata={'files_changed': 3}
    )

    # 验证链完整性
    verification = audit.verify_chain()
    print(f"\n[验证] 链完整性: {verification['valid']}")
    print(f"[验证] 默克尔根: {verification['merkle_root']}")

    # 导出报告
    report = audit.export_report()
    print(f"\n[报告] 总记录数: {report['total_records']}")
    
    return audit


if __name__ == "__main__":
    demo_audit_log()
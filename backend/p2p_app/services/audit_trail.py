import hashlib
import json
import time
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


class HashChain:
    """
    轻量级哈希链 - 用于不可篡改日志存储
    每条记录包含前一条记录的hash，形成链式结构
    任何篡改都会导致后续所有hash断裂

    支持内存存储 + 可选持久化到数据库
    """

    def __init__(self, chain_name: str = 'default'):
        self.chain_name = chain_name
        self.last_hash = '0' * 64  # 创世区块hash（全0）
        self._entries: list[dict] = []
        self._index = 0

    def add_entry(self, data: dict) -> str:
        """
        添加一条审计记录：
        1. 序列化数据 + 时间戳 + 前序hash
        2. 计算 SHA256 hash
        3. 存储记录
        4. 更新 last_hash
        返回当前 hash
        """
        self._index += 1
        timestamp = datetime.now().isoformat()

        entry = {
            'seq': self._index,
            'chain': self.chain_name,
            'prev_hash': self.last_hash,
            'timestamp': timestamp,
            'data': data,
        }

        # 计算当前记录的hash
        entry_str = json.dumps(entry, sort_keys=True, ensure_ascii=False)
        current_hash = hashlib.sha256(entry_str.encode('utf-8')).hexdigest()

        entry['hash'] = current_hash
        self._entries.append(entry)
        self.last_hash = current_hash

        logger.debug(
            f'HashChain[{self.chain_name}] added entry #{self._index}: '
            f'hash={current_hash[:16]}...'
        )

        return current_hash

    def verify_integrity(self) -> tuple[bool, int]:
        """验证链完整性，返回 (是否完整, 总条数)"""
        if not self._entries:
            return True, 0

        expected_prev = '0' * 64
        for i, entry in enumerate(self._entries):
            if entry.get('prev_hash') != expected_prev:
                logger.warning(
                    f'HashChain[{self.chain_name}] integrity broken at index {i}: '
                    f'expected prev={expected_prev[:16]}..., got={entry.get("prev_hash", "None")[:16]}'
                )
                return False, len(self._entries)

            # 重算hash验证
            check_entry = {k: v for k, v in entry.items() if k != 'hash'}
            entry_str = json.dumps(check_entry, sort_keys=True, ensure_ascii=False)
            recomputed = hashlib.sha256(entry_str.encode('utf-8')).hexdigest()
            if recomputed != entry.get('hash'):
                logger.warning(
                    f'HashChain[{self.chain_name}] hash mismatch at index {i}'
                )
                return False, len(self._entries)

            expected_prev = entry['hash']

        return True, len(self._entries)

    def get_entries(self, limit: int = 50, offset: int = 0) -> list[dict]:
        """查询审计记录"""
        end = offset + limit
        sliced = self._entries[offset:end]
        # 返回副本，不暴露内部引用
        return [
            {
                'seq': e['seq'],
                'chain': e['chain'],
                'hash': e['hash'],
                'prev_hash': e['prev_hash'],
                'timestamp': e['timestamp'],
                'data': e['data'],
            }
            for e in sliced
        ]

    @property
    def length(self) -> int:
        return len(self._entries)

    @property
    def head_hash(self) -> str:
        return self.last_hash


class AuditEvent:
    """审计事件类型"""
    TASK_CREATED = 'task.created'
    TASK_DISPATCHED = 'task.dispatched'
    SHARD_ASSIGNED = 'shard.assigned'
    EXECUTION_STARTED = 'execution.started'
    EXECUTION_COMPLETED = 'execution.completed'
    EXECUTION_FAILED = 'execution.failed'
    SECURITY_CHECK = 'security.check'
    SECURITY_BLOCKED = 'security.blocked'
    COST_ROUTED = 'cost.routed'
    NODE_HEARTBEAT = 'node.heartbeat'
    NODE_REGISTERED = 'node.registered'
    RESULT_VERIFIED = 'result.verified'
    AUDIT_REPORT = 'audit.report'

    @classmethod
    def all_events(cls) -> list[str]:
        return [
            v for k, v in vars(cls).items()
            if not k.startswith('_') and isinstance(v, str) and '.' in v
        ]


class AuditLogger:
    """审计日志记录器 - 白盒审计核心"""

    # 事件类型到哈希链的映射
    CHAIN_MAPPING = {
        # 任务生命周期事件
        AuditEvent.TASK_CREATED: 'task_lifecycle',
        AuditEvent.TASK_DISPATCHED: 'task_lifecycle',
        AuditEvent.SHARD_ASSIGNED: 'task_lifecycle',
        # 执行事件
        AuditEvent.EXECUTION_STARTED: 'execution_log',
        AuditEvent.EXECUTION_COMPLETED: 'execution_log',
        AuditEvent.EXECUTION_FAILED: 'execution_log',
        AuditEvent.RESULT_VERIFIED: 'execution_log',
        # 安全事件
        AuditEvent.SECURITY_CHECK: 'security_events',
        AuditEvent.SECURITY_BLOCKED: 'security_events',
        # 成本/路由事件
        AuditEvent.COST_ROUTED: 'cost_tracking',
        # 节点事件
        AuditEvent.NODE_HEARTBEAT: 'task_lifecycle',
        AuditEvent.NODE_REGISTERED: 'task_lifecycle',
        # 审计报告
        AuditEvent.AUDIT_REPORT: 'security_events',
    }

    def __init__(self):
        self.hash_chains = {
            'task_lifecycle': HashChain('task_lifecycle'),
            'security_events': HashChain('security_events'),
            'execution_log': HashChain('execution_log'),
            'cost_tracking': HashChain('cost_tracking'),
        }
        self._all_entries: list[dict] = []  # 全局索引，用于跨链查询

    def log(self, event_type: str, entity_id: str, data: dict,
            user_id: str = None, ip_address: str = None) -> str:
        """
        记录一条审计日志：
        1. 构建事件对象（event_type, entity_id, timestamp, user_id, ip, data）
        2. 写入对应 HashChain
        3. 返回 audit_id（hash值）
        """
        event_data = {
            'event_type': event_type,
            'entity_id': entity_id,
            'user_id': user_id,
            'ip_address': ip_address,
            'payload': data,
            'logged_at': datetime.now().isoformat(),
        }

        chain_name = self.CHAIN_MAPPING.get(event_type, 'task_lifecycle')
        chain = self.hash_chains.get(chain_name)
        if not chain:
            chain = self.hash_chains['task_lifecycle']

        audit_id = chain.add_entry(event_data)

        # 写入全局索引
        global_entry = {
            **event_data,
            'audit_id': audit_id,
            'chain': chain_name,
        }
        self._all_entries.append(global_entry)

        logger.info(
            f'Audit log: [{event_type}] entity={entity_id} '
            f'id={audit_id[:16]}... chain={chain_name}'
        )

        return audit_id

    def log_security_gate(self, request_id: str, gateway_result: dict) -> str:
        """记录安全网关处理结果"""
        event_type = (
            AuditEvent.SECURITY_BLOCKED
            if not gateway_result.get('passed', False)
            else AuditEvent.SECURITY_CHECK
        )
        return self.log(
            event_type=event_type,
            entity_id=request_id,
            data={
                'gateway_result': gateway_result,
                'request_id': request_id,
            },
        )

    def log_execution(self, shard_id: str, node_id: str,
                      execution_result: dict) -> str:
        """记录执行结果"""
        exit_code = execution_result.get('exit_code', -1)
        event_type = (
            AuditEvent.EXECUTION_FAILED
            if exit_code != 0
            else AuditEvent.EXECUTION_COMPLETED
        )

        return self.log(
            event_type=event_type,
            entity_id=shard_id,
            data={
                'node_id': node_id,
                'exit_code': exit_code,
                'execution_time_ms': execution_result.get('execution_time_ms', 0),
                'stdout_preview': (execution_result.get('stdout', '') or '')[:200],
                'stderr_preview': (execution_result.get('stderr', '') or '')[:200],
                'resource_usage': execution_result.get('resource_usage', {}),
            },
        )

    def log_cost_routing(self, task_id: str, routing_decision: dict) -> str:
        """记录成本路由决策"""
        return self.log(
            event_type=AuditEvent.COST_ROUTED,
            entity_id=task_id,
            data=routing_decision,
        )

    def query_logs(self, event_type: str = None, entity_id: str = None,
                   start_time: datetime = None, end_time: datetime = None,
                   limit: int = 100) -> list[dict]:
        """查询审计日志（支持多维度筛选）"""
        results = []

        for entry in reversed(self._all_entries):
            if event_type and entry.get('event_type') != event_type:
                continue
            if entity_id and entry.get('entity_id') != entity_id:
                continue
            if start_time:
                entry_time = entry.get('logged_at', '')
                try:
                    if datetime.fromisoformat(entry_time) < start_time:
                        continue
                except (ValueError, TypeError):
                    pass
            if end_time:
                entry_time = entry.get('logged_at', '')
                try:
                    if datetime.fromisoformat(entry_time) > end_time:
                        continue
                except (ValueError, TypeError):
                    pass

            results.append({
                'audit_id': entry.get('audit_id'),
                'event_type': entry.get('event_type'),
                'entity_id': entry.get('entity_id'),
                'user_id': entry.get('user_id'),
                'ip_address': entry.get('ip_address'),
                'payload': entry.get('payload'),
                'logged_at': entry.get('logged_at'),
                'chain': entry.get('chain'),
            })

            if len(results) >= limit:
                break

        return results

    def get_chain_status(self) -> dict:
        """获取所有哈希链的状态摘要"""
        status = {}
        for name, chain in self.hash_chains.items():
            is_valid, count = chain.verify_integrity()
            status[name] = {
                'length': count,
                'head_hash': chain.head_hash,
                'integrity_ok': is_valid,
            }
        return status


class ComplianceReporter:
    """合规报告生成器"""

    def __init__(self, audit_logger: AuditLogger = None):
        self.audit = audit_logger or AuditLogger()

    def generate_task_report(self, task_id: str) -> dict:
        """
        为单个任务生成合规报告：
        1. 任务基本信息
        2. 安全检查记录
        3. 执行过程日志
        4. 结果验证记录
        5. 成本明细
        6. 审计链完整性证明
        """
        from ..models import TaskDispatch

        try:
            task = TaskDispatch.objects.get(task_id=task_id)
        except TaskDispatch.DoesNotExist:
            return {
                'error': f'Task {task_id} not found',
                'task_id': task_id,
            }

        # 收集该任务相关的所有审计日志
        logs = self.audit.query_logs(entity_id=task_id, limit=500)

        security_logs = [
            l for l in logs
            if l.get('event_type') in (
                AuditEvent.SECURITY_CHECK, AuditEvent.SECURITY_BLOCKED
            )
        ]
        execution_logs = [
            l for l in logs
            if l.get('event_type') in (
                AuditEvent.EXECUTION_STARTED,
                AuditEvent.EXECUTION_COMPLETED,
                AuditEvent.EXECUTION_FAILED,
            )
        ]
        cost_logs = [
            l for l in logs
            if l.get('event_type') == AuditEvent.COST_ROUTED
        ]

        # 验证各链完整性
        chain_status = self.audit.get_chain_status()

        report = {
            'report_type': 'task_compliance',
            'generated_at': datetime.now().isoformat(),
            'task_info': {
                'task_id': task.task_id,
                'task_type': task.task_type,
                'status': task.status,
                'security_level': task.security_level,
                'privacy_level': task.privacy_level,
                'created_at': task.created_at.isoformat() if task.created_at else None,
                'completed_at': task.completed_at.isoformat() if task.completed_at else None,
                'created_by': task.created_by,
            },
            'security_checks': {
                'total_checks': len(security_logs),
                'blocked_count': len([
                    l for l in security_logs
                    if l.get('event_type') == AuditEvent.SECURITY_BLOCKED
                ]),
                'details': security_logs,
            },
            'execution_trace': {
                'total_events': len(execution_logs),
                'events': execution_logs,
            },
            'cost_records': cost_logs,
            'integrity_proof': chain_status,
            'total_audit_entries': len(logs),
        }

        # 记录本次报告生成
        self.audit.log(
            event_type=AuditEvent.AUDIT_REPORT,
            entity_id=task_id,
            data={'report_type': 'task_compliance'},
        )

        return report

    def generate_node_report(self, node_id: str,
                             start_time: datetime, end_time: datetime) -> dict:
        """生成节点行为报告"""
        from ..models import P2PNode

        try:
            node = P2PNode.objects.get(node_id=node_id)
        except P2PNode.DoesNotExist:
            return {'error': f'Node {node_id} not found', 'node_id': node_id}

        logs = self.audit.query_logs(
            start_time=start_time,
            end_time=end_time,
            limit=1000,
        )

        node_related = [
            l for l in logs
            if node_id in (l.get('entity_id', '') or '')
            or node_id in json.dumps(l.get('payload', {}))
        ]

        report = {
            'report_type': 'node_behavior',
            'generated_at': datetime.now().isoformat(),
            'node_info': {
                'node_id': node.node_id,
                'node_type': node.node_type,
                'status': node.status,
                'reputation_score': node.reputation_score,
                'total_tasks_completed': node.total_tasks_completed,
                'location': node.location,
            },
            'time_range': {
                'start': start_time.isoformat(),
                'end': end_time.isoformat(),
            },
            'related_audit_events': len(node_related),
            'events': node_related[:200],
        }

        self.audit.log(
            event_type=AuditEvent.AUDIT_REPORT,
            entity_id=node_id,
            data={'report_type': 'node_behavior'},
        )

        return report

    def generate_system_snapshot(self) -> dict:
        """生成系统快照（全部活跃任务、节点状态、安全事件统计）"""
        from ..models import TaskDispatch, P2PNode

        active_tasks = TaskDispatch.objects.filter(
            status__in=['created', 'sharding', 'dispatching', 'executing', 'aggregating']
        ).order_by('-created_at')[:50]

        online_nodes = P2PNode.objects.filter(status='online')

        security_events = self.audit.query_logs(
            event_type=AuditEvent.SECURITY_BLOCKED,
            limit=200,
        )

        chain_status = self.audit.get_chain_status()

        total_entries = sum(c['length'] for c in chain_status.values())

        snapshot = {
            'snapshot_type': 'system_snapshot',
            'generated_at': datetime.now().isoformat(),
            'active_tasks': [
                {
                    'task_id': t.task_id,
                    'status': t.status,
                    'task_type': t.task_type,
                    'total_shards': t.total_shards,
                    'completed_shards': t.completed_shards,
                    'created_at': t.created_at.isoformat() if t.created_at else None,
                }
                for t in active_tasks
            ],
            'online_nodes': [
                {
                    'node_id': n.node_id,
                    'node_type': n.node_type,
                    'reputation_score': n.reputation_score,
                    'location': n.location,
                    'last_heartbeat': n.last_heartbeat.isoformat() if n.last_heartbeat else None,
                }
                for n in online_nodes
            ],
            'statistics': {
                'active_task_count': active_tasks.count(),
                'online_node_count': online_nodes.count(),
                'security_block_event_count': len(security_events),
                'total_audit_entries': total_entries,
            },
            'recent_security_blocks': security_events[:20],
            'audit_chain_integrity': chain_status,
        }

        self.audit.log(
            event_type=AuditEvent.AUDIT_REPORT,
            entity_id='system',
            data={'report_type': 'system_snapshot'},
        )

        return snapshot

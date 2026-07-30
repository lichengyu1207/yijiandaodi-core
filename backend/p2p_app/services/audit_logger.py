"""
L7 哈希链审计存证 - 持久化版

替代原来的内存版本，将审计数据持久化到数据库。
提供完整的 CRUD 接口和查询统计能力。
"""

import hashlib
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Optional

from django.db import transaction
from django.db.models import Count, Avg
from django.utils import timezone

logger = logging.getLogger(__name__)


class PersistentAuditLogger:
    """
    持久化审计日志器

    功能:
    - 哈希链节点写入与查询
    - 安全事件记录
    - 限流记录
    - 合规报告生成
    """

    def __init__(self):
        from .models import AuditChain, SecurityEventLog, RateLimitRecord
        self.AuditChain = AuditChain
        self.SecurityEventLog = SecurityEventLog
        self.RateLimitRecord = RateLimitRecord

    # ───────────────────────────────────────
    # 哈希链操作
    # ───────────────────────────────────────

    def append_to_chain(
        self,
        chain_type: str,
        event_type: str,
        payload: dict,
        metadata: Optional[dict] = None,
    ) -> dict:
        """
        向指定哈希链追加一个节点

        Returns:
            {node_id, current_hash, previous_hash, chain_type, event_type, created_at}
        """
        # 获取链上最后一个节点的哈希
        last_node = self.AuditChain.objects.filter(
            chain_type=chain_type
        ).order_by('-created_at').first()

        previous_hash = last_node.current_hash if last_node else ''

        # 构建待签名数据
        timestamp = time.time()
        data_str = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        data_hash = hashlib.sha256(data_str.encode()).hexdigest()

        # 当前节点哈希 = SHA256(previous_hash + data_hash + timestamp)
        sign_input = f"{previous_hash}|{data_hash}|{timestamp}"
        current_hash = hashlib.sha256(sign_input.encode()).hexdigest()

        # 写入数据库
        node = self.AuditChain.objects.create(
            chain_type=chain_type,
            event_type=event_type,
            previous_hash=previous_hash,
            current_hash=current_hash,
            data_hash=data_hash,
            payload=payload,
            metadata=metadata or {},
        )

        logger.info(f"AuditChain appended: {chain_type}/{event_type} node={node.id} hash={current_hash[:16]}...")

        return {
            'node_id': node.id,
            'current_hash': current_hash,
            'previous_hash': previous_hash,
            'chain_type': chain_type,
            'event_type': event_type,
            'created_at': node.created_at.isoformat(),
        }

    def get_chain(self, chain_type: str, limit: int = 100) -> list[dict]:
        """获取指定链的最新节点列表"""
        nodes = self.AuditChain.objects.filter(
            chain_type=chain_type
        ).order_by('-created_at')[:limit]

        return [
            {
                'id': n.id,
                'event_type': n.event_type,
                'previous_hash': n.previous_hash[:16] + '...',
                'current_hash': n.current_hash[:16] + '...',
                'payload_summary': str(n.payload)[:80],
                'created_at': n.created_at.isoformat(),
            }
            for n in nodes
        ]

    def verify_chain_integrity(self, chain_type: str) -> dict:
        """
        验证指定链的完整性

        Returns:
            {is_valid, total_nodes, verified_nodes, broken_at, first_hash, last_hash}
        """
        nodes = list(self.AuditChain.objects.filter(
            chain_type=chain_type
        ).order_by('created_at'))

        total = len(nodes)
        if total == 0:
            return {'is_valid': True, 'total_nodes': 0, 'verified_nodes': 0}

        verified = 0
        prev_hash = ''
        broken_at = None

        for i, node in enumerate(nodes):
            if i == 0:
                # 第一个节点: previous_hash 应该为空
                if node.previous_hash != '':
                    broken_at = i
                    break
            else:
                # 后续节点: previous_hash 应等于上一个节点的 current_hash
                if node.previous_hash != prev_hash:
                    broken_at = i
                    break

            prev_hash = node.current_hash
            verified += 1

        return {
            'is_valid': broken_at is None,
            'total_nodes': total,
            'verified_nodes': verified,
            'broken_at': broken_at,
            'first_hash': nodes[0].current_hash[:16] + '...' if nodes else '',
            'last_hash': nodes[-1].current_hash[:16] + '...' if nodes else '',
        }

    def get_all_chains_status(self) -> dict:
        """获取全部 4 条链的状态摘要"""
        result = {}
        for chain_type, _label in self.AuditChain.CHAIN_TYPES:
            integrity = self.verify_chain_integrity(chain_type)
            count = self.AuditChain.objects.filter(chain_type=chain_type).count()
            result[chain_type] = {
                'label': _label,
                'node_count': count,
                **integrity,
            }
        return result

    # ───────────────────────────────────────
    # 安全事件记录
    # ───────────────────────────────────────

    def log_security_event(
        self,
        category: str,
        message: str,
        level: str = 'info',
        user_id: str = '',
        ip_address: str = '',
        device_fingerprint: str = '',
        request_path: str = '',
        details: Optional[dict] = None,
        risk_score: float = 0.0,
        action_taken: str = 'log',
    ):
        """记录一条安全事件"""
        event = self.SecurityEventLog.objects.create(
            level=level,
            category=category,
            user_id=user_id,
            ip_address=ip_address or None,
            device_fingerprint=device_fingerprint,
            request_path=request_path,
            message=message,
            details=details or {},
            risk_score=risk_score,
            action_taken=action_taken,
        )

        if level in ('warning', 'critical'):
            logger.warning(f"SecurityEvent [{level}] {category}: {message}")

        return event.id

    def get_recent_events(
        self,
        hours: int = 24,
        level: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict]:
        """查询最近的安全事件"""
        since = timezone.now() - timedelta(hours=hours)
        qs = self.SecurityEventLog.objects.filter(created_at__gte=since)

        if level:
            qs = qs.filter(level=level)
        if category:
            qs = qs.filter(category=category)

        events = qs.order_by('-created_at')[:limit]

        return [
            {
                'id': e.id,
                'level': e.level,
                'category': e.category,
                'message': e.message,
                'user_id': e.user_id[:12] + '...' if len(e.user_id) > 12 else e.user_id,
                'ip_address': str(e.ip_address),
                'risk_score': e.risk_score,
                'action_taken': e.action_taken,
                'created_at': e.created_at.isoformat(),
            }
            for e in events
        ]

    def get_security_stats(self, hours: int = 24) -> dict:
        """获取安全事件统计"""
        since = timezone.now() - timedelta(hours=hours)
        qs = self.SecurityEventLog.objects.filter(created_at__gte=since)

        total = qs.count()
        by_level = dict(qs.values_list('level').annotate(count=Count('id')))
        by_category = dict(qs.values_list('category').annotate(count=Count('id')))
        avg_risk = qs.aggregate(avg=Avg('risk_score'))['avg'] or 0
        blocked_count = qs.filter(action_taken='block').count()

        return {
            'period_hours': hours,
            'total_events': total,
            'by_level': by_level,
            'by_category': by_category,
            'avg_risk_score': round(avg_risk, 2),
            'blocked_count': blocked_count,
            'block_rate': round(blocked_count / max(total, 1) * 100, 1),
        }

    # ───────────────────────────────────────
    # 限流记录
    # ───────────────────────────────────────

    def record_rate_limit(
        self,
        limit_type: str,  # user / ip / device
        identifier: str,
        blocked: bool = False,
    ):
        """记录一次限流事件"""
        now = timezone.now()
        window_start = now.replace(second=0, microsecond=0)

        record, created = self.RateLimitRecord.objects.get_or_create(
            limit_type=limit_type,
            identifier=identifier,
            window_start=window_start,
            defaults={'request_count': 1, 'blocked': blocked},
        )

        if not created:
            record.request_count += 1
            if blocked:
                record.blocked = True
            record.save(update_fields=['request_count', 'blocked'])

    def get_top_limited_ips(self, hours: int = 24, limit: int = 10) -> list[dict]:
        """获取被限频最多的 IP 列表"""
        since = timezone.now() - timedelta(hours=hours)
        records = self.RateLimitRecord.objects.filter(
            limit_type='ip',
            window_start__gte=since,
            blocked=True,
        ).values('identifier').annotate(
            total_blocked=Count('request_count'),
        ).order_by('-total_blocked')[:limit]

        return list(records)


# 全局单例
persistent_audit_logger = PersistentAuditLogger()

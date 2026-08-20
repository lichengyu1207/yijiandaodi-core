"""
告警服务 - 处理预警触发和推送

功能：
1. 判断是否触发告警
2. WebSocket推送告警到桌面端
3. 记录告警历史
"""

from typing import Dict, Any
from django.utils import timezone
import logging

logger = logging.getLogger('security_audit')


class AlertService:
    """告警服务"""

    # 告警阈值配置
    DANGER_THRESHOLD = 70
    CRITICAL_THRESHOLD = 90

    # 告警类型映射
    ALERT_TYPE_MAPPING = {
        'danger': 'warning',
        'critical': 'critical',
    }

    @classmethod
    def handle_alert(cls, activity_log, risk_assessment_result) -> Dict[str, Any]:
        """
        处理告警（增强版 - 包含Agent身份信息）

        Args:
            activity_log: AgentActivityLog实例
            risk_assessment_result: RiskAssessmentResult实例

        Returns:
            告警信息字典
        """
        # 判断是否触发告警
        if not risk_assessment_result.should_alert:
            return None

        # 获取Agent身份信息（如果存在）
        agent_identity = None
        agent_trust_level = 'unknown'
        agent_name = 'Unknown Agent'

        if hasattr(activity_log, 'agent') and activity_log.agent:
            agent_identity = activity_log.agent
            agent_trust_level = agent_identity.trust_level
            agent_name = agent_identity.agent_name

        # 构建告警信息（增强版）
        alert_data = {
            'alert_id': f"alert_{activity_log.activity_id}",
            'timestamp': timezone.now().isoformat(),
            'session_id': activity_log.session_id,
            'client_id': activity_log.client_id,

            # Agent身份信息（新增）
            'agent': {
                'id': agent_identity.agent_id if agent_identity else None,
                'name': agent_name,
                'type': activity_log.agent_type,
                'trust_level': agent_trust_level,
            },

            # 行为信息
            'action': activity_log.action,
            'target': activity_log.target,
            'source': activity_log.source,

            # 风险评估信息
            'risk_level': risk_assessment_result.risk_level,
            'overall_score': risk_assessment_result.overall_score,
            'risk_score': activity_log.risk_score,

            # 建议和详情
            'recommendations': risk_assessment_result.recommendations,
            'activity_id': activity_log.activity_id,
            'metadata': activity_log.metadata,
        }

        # 根据风险等级确定告警类型
        alert_type = cls.ALERT_TYPE_MAPPING.get(
            risk_assessment_result.risk_level,
            'warning'
        )

        alert_data['alert_type'] = alert_type

        # 记录告警日志（增强版）
        cls._log_alert(alert_data, agent_name, agent_trust_level)

        # WebSocket推送告警（包含Agent身份）
        cls._push_alert(alert_data)

        return alert_data

    @classmethod
    def _log_alert(cls, alert_data: Dict[str, Any], agent_name: str = None, trust_level: str = None):
        """记录告警日志（增强版）"""
        agent_info = f"{agent_name} ({trust_level})" if agent_name else alert_data['agent_type']

        log_message = (
            f"[ALERT][{alert_data['alert_type'].upper()}] "
            f"Agent: {agent_info} | "
            f"Action: {alert_data['action']} | "
            f"Score: {alert_data['overall_score']:.1f} | "
            f"Session: {alert_data['session_id']} | "
            f"Target: {alert_data['target'][:50]}"
        )

        if alert_data['alert_type'] == 'critical':
            logger.critical(log_message)
        else:
            logger.warning(log_message)

    @classmethod
    def _push_alert(cls, alert_data: Dict[str, Any]):
        """
        WebSocket推送告警到桌面端

        通用推送：优先推送到 agent_alerts_{client_id} 组；
        无 client_id 的全局告警（如消费额度预警）推送到 quota_alerts 组。
        """
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync

            channel_layer = get_channel_layer()

            if channel_layer:
                group = alert_data.get('client_id')
                if group:
                    group_name = f"agent_alerts_{group}"
                else:
                    group_name = "quota_alerts"
                # 推送告警到指定客户端频道组
                async_to_sync(channel_layer.group_send)(
                    group_name,
                    {
                        'type': 'alert_message',
                        'data': alert_data
                    }
                )

                logger.info(f"[WebSocket] 推送告警到频道组 {group_name}")
            else:
                logger.warning("[WebSocket] Channel Layer未配置，告警未推送")

        except Exception as e:
            logger.error(f"[WebSocket] 告警推送失败: {e}", exc_info=True)

    @classmethod
    def push_quota_alert(cls, status: str, pct: float, config: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        P1-2 消费额度预警：全局共享额度使用率达到阈值时，经 WebSocket 推送到桌面端。

        Args:
            status: 'warning' | 'alert'（对应阈值分级）
            pct: 已使用百分比（如 82.5）
            config: /api/settings/quota-alert 配置（含 notify 通知方式）

        Returns:
            告警信息字典
        """
        config = config or {}
        notify = config.get('notify') or []
        alert_data = {
            'alert_id': f"quota_{timezone.now().strftime('%Y%m%d%H%M%S')}",
            'timestamp': timezone.now().isoformat(),
            'alert_type': 'critical' if status == 'alert' else 'warning',
            'category': 'quota',
            'title': '消费额度已达临界' if status == 'alert' else '消费额度预警',
            'message': f'平台共享额度已使用 {pct}%',
            'pct': pct,
            'status': status,
            'notify': notify,
        }

        if status == 'alert':
            logger.critical(f"[ALERT][QUOTA] 平台共享额度临界 {pct}%")
        else:
            logger.warning(f"[ALERT][QUOTA] 平台共享额度预警 {pct}%")

        cls._push_alert(alert_data)
        return alert_data

    @classmethod
    def push_event_alert(cls, event: str, level: str, title: str,
                         message: str, config: Dict[str, Any] = None) -> Dict[str, Any]:
        """网关事件告警（circuit_open / quota_exhausted 等）：经 WebSocket 推送到桌面端。

        Args:
            event: 事件标识（与 /api/settings/quota-alert 的 rules 键一致），作为 category
            level: 'warning' | 'critical'
            title/message: 告警文案
            config: /api/settings/quota-alert 配置（含 notify 通知方式）
        """
        config = config or {}
        alert_data = {
            'alert_id': f"{event}_{timezone.now().strftime('%Y%m%d%H%M%S')}",
            'timestamp': timezone.now().isoformat(),
            'alert_type': level,
            'category': event,
            'title': title,
            'message': message,
            'notify': config.get('notify') or [],
        }

        if level == 'critical':
            logger.critical('[ALERT][%s] %s | %s', event.upper(), title, message)
        else:
            logger.warning('[ALERT][%s] %s | %s', event.upper(), title, message)

        cls._push_alert(alert_data)
        return alert_data

    @classmethod
    def get_recent_alerts(cls, client_id: str, limit: int = 10) -> list:
        """
        获取最近的告警历史

        TODO: 从数据库或缓存中获取告警历史
        """
        # 当前版本：返回空列表
        # 后续版本：从AgentActivityAggregation或专门的告警表中查询
        return []
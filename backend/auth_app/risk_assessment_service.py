"""
风险评估服务 - 实时计算综合风险分数

移植自前端 behaviorRiskScorer.ts
核心算法：
1. 时间衰减加权平均（最近10个行为）
2. 频率加分（1分钟内超过3次风险行为）
3. 序列加分（连续风险行为模式）
"""

from typing import Dict, List, Optional
from django.utils import timezone
from datetime import timedelta
from collections import defaultdict
import math


class RiskAssessmentResult:
    """风险评估结果"""

    def __init__(self, overall_score: float, risk_level: str, should_alert: bool, recommendations: List[str]):
        self.overall_score = overall_score
        self.risk_level = risk_level
        self.should_alert = should_alert
        self.recommendations = recommendations

    def to_dict(self):
        return {
            'overall_score': self.overall_score,
            'risk_level': self.risk_level,
            'should_alert': self.should_alert,
            'recommendations': self.recommendations,
        }


class RiskAssessmentService:
    """
    风险评估服务（增强版）

    维护per-session内存缓存，避免频繁查库
    支持基于Agent信任级别的动态阈值调整
    """

    # 类级别缓存：{session_id: [AgentActivityLog, ...]}
    _session_cache: Dict[str, List] = defaultdict(list)

    # 基础配置参数
    MAX_HISTORY_SIZE = 100  # 每个session最多缓存100条
    BASE_ALERT_THRESHOLD = 70
    BASE_CRITICAL_THRESHOLD = 90

    # Agent信任级别相关的阈值调整因子
    # 信任级别越高，阈值越高（更严格）
    TRUST_LEVEL_FACTORS = {
        'critical': 1.2,   # 关键级Agent：阈值提高20%（更严格）
        'high': 1.0,       # 高信任级：标准阈值
        'medium': 0.85,    # 中信任级：阈值降低15%（更宽松）
        'low': 0.7,        # 低信任级：阈值降低30%（宽松）
    }

    # Agent权限相关的风险加成
    PERMISSION_RISK_BONUSES = {
        'unauthorized_access': 30,    # 越权访问加30分
        'permission_denied': 20,      # 权限拒绝加20分
        'suspicious_behavior': 15,    # 可疑行为加15分
    }

    @classmethod
    def assess_activity(cls, activity_log) -> RiskAssessmentResult:
        """
        评估单个活动日志的综合风险（增强版）

        Args:
            activity_log: AgentActivityLog实例

        Returns:
            RiskAssessmentResult
        """
        # 1. 添加到缓存
        session_id = activity_log.session_id
        cls._session_cache[session_id].append(activity_log)

        # 限制缓存大小
        if len(cls._session_cache[session_id]) > cls.MAX_HISTORY_SIZE:
            cls._session_cache[session_id].pop(0)

        # 2. 获取Agent信任级别调整因子
        agent_trust_level = cls._get_agent_trust_level(activity_log)
        trust_factor = cls.TRUST_LEVEL_FACTORS.get(agent_trust_level, 1.0)

        # 3. 计算综合风险分数
        base_score = cls._calculate_overall_score(session_id)

        # 4. 检查Agent权限（权限越权加成）
        permission_bonus = cls._check_agent_permissions(activity_log)

        # 5. 应用信任级别调整和权限加成
        adjusted_score = base_score + permission_bonus

        # 6. 根据信任级别动态调整阈值
        alert_threshold = cls.BASE_ALERT_THRESHOLD * trust_factor
        critical_threshold = cls.BASE_CRITICAL_THRESHOLD * trust_factor

        # 7. 确定风险等级（使用调整后的阈值）
        risk_level = cls._determine_risk_level(adjusted_score, alert_threshold, critical_threshold)

        # 8. 生成建议
        recommendations = cls._generate_recommendations(adjusted_score, activity_log, agent_trust_level)

        # 9. 判断是否需要告警（使用调整后的阈值）
        should_alert = adjusted_score >= alert_threshold

        return RiskAssessmentResult(
            overall_score=min(adjusted_score, 100),  # 上限100分
            risk_level=risk_level,
            should_alert=should_alert,
            recommendations=recommendations,
        )

    @classmethod
    def _get_agent_trust_level(cls, activity_log) -> str:
        """
        获取Agent的信任级别

        Args:
            activity_log: AgentActivityLog实例

        Returns:
            str: 信任级别（low/medium/high/critical）
        """
        # 从activity_log的agent字段获取信任级别
        if hasattr(activity_log, 'agent') and activity_log.agent:
            return activity_log.agent.trust_level

        # 如果没有关联Agent，默认为low级别（最宽松）
        return 'low'

    @classmethod
    def _check_agent_permissions(cls, activity_log) -> float:
        """
        检查Agent是否有执行当前操作的权限

        Args:
            activity_log: AgentActivityLog实例

        Returns:
            float: 权限风险加成分数
        """
        bonus = 0.0

        # 如果没有关联Agent，不检查权限
        if not hasattr(activity_log, 'agent') or not activity_log.agent:
            return bonus

        agent = activity_log.agent
        permissions = agent.permissions or {}

        # 检查文件操作权限
        if activity_log.action == 'file_operation':
            if not permissions.get('file.access', False):
                bonus += cls.PERMISSION_RISK_BONUSES['unauthorized_access']

        # 检查剪贴板操作权限
        if activity_log.action == 'clipboard_operation':
            if not permissions.get('clipboard.access', False):
                bonus += cls.PERMISSION_RISK_BONUSES['unauthorized_access']

        # 检查网络访问权限
        if activity_log.action == 'ai_api_call':
            if not permissions.get('network.access', False):
                bonus += cls.PERMISSION_RISK_BONUSES['unauthorized_access']

        # 检查进程启动权限
        if activity_log.action == 'process_started':
            if not permissions.get('process.execute', False):
                bonus += cls.PERMISSION_RISK_BONUSES['unauthorized_access']

        # 高风险行为检查（无论权限如何）
        if activity_log.risk_score > 80:
            bonus += cls.PERMISSION_RISK_BONUSES['suspicious_behavior']

        return bonus

    @classmethod
    def _calculate_overall_score(cls, session_id: str) -> float:
        """
        计算综合风险分数

        算法：
        1. 时间衰减加权平均（最近10个行为）
        2. 频率加分
        3. 序列加分
        """
        recent_behaviors = cls._session_cache[session_id][-10:]

        if not recent_behaviors:
            return 0.0

        # 时间衰减加权平均
        weights = [math.pow(1.2, i) for i in range(len(recent_behaviors))]
        total_weight = sum(weights)

        weighted_sum = sum(
            behavior.risk_score * weights[i]
            for i, behavior in enumerate(recent_behaviors)
        )

        base_score = weighted_sum / total_weight

        # 频率加分
        frequency_bonus = cls._calculate_frequency_bonus(session_id)

        # 序列加分
        sequence_bonus = cls._calculate_sequence_bonus(session_id)

        return min(base_score + frequency_bonus + sequence_bonus, 100)

    @classmethod
    def _calculate_frequency_bonus(cls, session_id: str) -> float:
        """
        频率加分：1分钟内超过3次风险行为（>50分），每次额外+5分
        """
        one_minute_ago = timezone.now() - timedelta(minutes=1)

        recent_risk_count = sum(
            1 for behavior in cls._session_cache[session_id]
            if behavior.timestamp > one_minute_ago and behavior.risk_score > 50
        )

        return max(0, (recent_risk_count - 3) * 5)

    @classmethod
    def _calculate_sequence_bonus(cls, session_id: str) -> float:
        """
        序列加分：检测连续攻击模式
        """
        recent = cls._session_cache[session_id][-5:]

        if len(recent) < 3:
            return 0.0

        # 连续高风险行为
        high_risk_count = sum(1 for b in recent if b.risk_score > 60)
        if high_risk_count >= 3:
            return 15.0

        # 文件+剪贴板组合（数据泄露）
        has_file_op = any(b.action == 'file_operation' for b in recent)
        has_clipboard_op = any(b.action == 'clipboard_operation' for b in recent)

        if has_file_op and has_clipboard_op and any(b.risk_score > 50 for b in recent):
            return 10.0

        return 0.0

    @classmethod
    def _determine_risk_level(cls, score: float, alert_threshold: float = None, critical_threshold: float = None) -> str:
        """
        确定风险等级（支持动态阈值）

        Args:
            score: 风险分数
            alert_threshold: 告警阈值（可选，默认使用BASE_ALERT_THRESHOLD）
            critical_threshold: 严重阈值（可选，默认使用BASE_CRITICAL_THRESHOLD）

        Returns:
            str: 风险等级（safe/warning/danger/critical）
        """
        if alert_threshold is None:
            alert_threshold = cls.BASE_ALERT_THRESHOLD
        if critical_threshold is None:
            critical_threshold = cls.BASE_CRITICAL_THRESHOLD

        if score >= critical_threshold:
            return 'critical'
        elif score >= alert_threshold:
            return 'danger'
        elif score >= 50:
            return 'warning'
        else:
            return 'safe'

    @classmethod
    def _generate_recommendations(cls, score: float, activity_log, agent_trust_level: str = None) -> List[str]:
        """
        生成建议（增强版）

        Args:
            score: 风险分数
            activity_log: AgentActivityLog实例
            agent_trust_level: Agent信任级别

        Returns:
            List[str]: 建议列表
        """
        recommendations = []

        # 基于分数的建议
        if score >= 90:
            recommendations.append('⚠️ 发现严重安全风险，建议立即暂停Agent操作')
        elif score >= 70:
            recommendations.append('⚡ 检测到高风险行为，建议审查Agent操作')
        elif score >= 50:
            recommendations.append('📋 发现中等风险行为，建议关注')

        # Agent信任级别相关建议
        if agent_trust_level:
            trust_messages = {
                'critical': '🔒 关键级Agent操作，执行严格风控策略',
                'high': '🔐 高信任级Agent，应用标准风控策略',
                'medium': '⚠️ 中信任级Agent，应用宽松风控策略',
                'low': '🚨 低信任级Agent，应用最宽松风控策略'
            }
            if agent_trust_level in trust_messages:
                recommendations.append(trust_messages[agent_trust_level])

        # 基于检测类型的建议
        if hasattr(activity_log, 'metadata') and isinstance(activity_log.metadata, dict):
            detected_types = activity_log.metadata.get('detected_types', [])

            if 'sqli' in detected_types or 'sql_injection' in detected_types:
                recommendations.append('🔍 发现SQL注入风险，建议检查数据库操作')

            if 'xss' in detected_types:
                recommendations.append('🔍 发现XSS风险，建议检查输出编码')

            if 'apikey' in detected_types or 'api_key' in detected_types:
                recommendations.append('🔑 发现API Key泄露风险，建议立即更新密钥')

            if 'code_injection' in detected_types:
                recommendations.append('💻 发现代码注入风险，建议检查动态执行')

        # 基于行为类型的建议
        if activity_log.action == 'clipboard_operation' and activity_log.risk_score > 60:
            recommendations.append('📋 剪贴板包含敏感信息，建议检查数据流向')

        if activity_log.action == 'file_operation' and activity_log.risk_score > 70:
            recommendations.append('📁 文件操作风险较高，建议检查文件内容')

        # Agent类型和身份信息
        if hasattr(activity_log, 'agent') and activity_log.agent:
            recommendations.append(f'🤖 Agent: {activity_log.agent.agent_name} ({activity_log.agent.agent_type})')
        elif activity_log.agent_type != 'unknown':
            recommendations.append(f'🤖 来源: {activity_log.agent_type.upper()}')

        return recommendations

    @classmethod
    def clear_cache(cls, session_id: Optional[str] = None):
        """清空缓存"""
        if session_id:
            cls._session_cache[session_id].clear()
        else:
            cls._session_cache.clear()

    @classmethod
    def get_cache_stats(cls) -> Dict:
        """获取缓存统计"""
        return {
            'total_sessions': len(cls._session_cache),
            'total_activities': sum(len(v) for v in cls._session_cache.values()),
            'sessions': {
                session_id: len(activities)
                for session_id, activities in cls._session_cache.items()
            }
        }
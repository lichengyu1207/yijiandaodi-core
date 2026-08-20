"""
Agent活动日志信号处理

当AgentActivityLog写入数据库时，自动触发：
1. 风险评估
2. 告警触发
3. 轨迹构建（阶段2新增，异步执行）
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from .agent_activity_models import AgentActivityLog
from .risk_assessment_service import RiskAssessmentService
from .alert_service import AlertService
from .tasks import build_trajectory_async
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=AgentActivityLog)
def handle_agent_activity_created(sender, instance, created, **kwargs):
    """
    Agent活动日志创建时的信号处理

    Args:
        sender: 模型类
        instance: AgentActivityLog实例
        created: 是否为新创建
        **kwargs: 额外参数
    """
    if not created:
        # 只处理新创建的记录，忽略更新
        return

    try:
        # 1. 实时风险评估（同步执行，保持实时性）
        risk_assessment = RiskAssessmentService.assess_activity(instance)

        # 2. 处理告警（同步执行，保持实时性）
        if risk_assessment.should_alert:
            alert_data = AlertService.handle_alert(instance, risk_assessment)

            if alert_data:
                logger.info(
                    f"[Agent活动监控] 触发告警: {risk_assessment.risk_level} "
                    f"- 分数: {risk_assessment.overall_score:.1f} "
                    f"- Session: {instance.session_id}"
                )

        # 3. 异步构建行为轨迹（避免阻塞主线程）
        # 传递activity_id而非对象，避免序列化问题
        build_trajectory_async.delay(instance.activity_id)

        logger.info(
            f"[Agent活动监控] 已提交轨迹构建任务: "
            f"activity_id={instance.activity_id}"
        )

    except Exception as e:
        logger.error(
            f"[Agent活动监控] 信号处理失败: {e}",
            exc_info=True
        )
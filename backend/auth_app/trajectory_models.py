"""
Agent行为轨迹模型

阶段2：链路聚合 - 按会话聚合行为序列，建立行为轨迹库
"""

from django.db import models
from django.utils import timezone
import json


class BehaviorTrajectory(models.Model):
    """
    行为轨迹模型

    按session_id聚合同一会话的所有Agent活动日志，
    存储完整的操作序列和链路风险评估结果
    """

    # 主键
    trajectory_id = models.CharField(
        max_length=50,
        primary_key=True,
        verbose_name='轨迹ID',
        help_text='格式: traj_{session_id}'
    )

    # 会话标识
    session_id = models.CharField(
        max_length=50,
        db_index=True,
        verbose_name='会话ID',
        help_text='与AgentActivityLog.session_id一致'
    )

    client_id = models.CharField(
        max_length=64,
        db_index=True,
        verbose_name='客户端ID',
        help_text='桌面端唯一标识'
    )

    # 行为链路（JSON数组）
    behavior_chain = models.JSONField(
        default=list,
        verbose_name='行为链路',
        help_text='操作序列，格式: [{"activity_id": "...", "agent_type": "cursor", "action": "file_operation", ...}, ...]'
    )

    # 链路风险评估
    chain_risk_score = models.FloatField(
        default=0.0,
        verbose_name='链路风险分数',
        help_text='0-100，整条链路的综合风险分数'
    )

    # 异常标志
    anomaly_flags = models.JSONField(
        default=list,
        verbose_name='异常标志',
        help_text='检测到的异常模式，格式: ["sequence_high_risk", "data_exfiltration", "privilege_escalation"]'
    )

    # 时间信息
    start_time = models.DateTimeField(
        verbose_name='开始时间',
        help_text='第一条活动的时间'
    )

    end_time = models.DateTimeField(
        verbose_name='结束时间',
        help_text='最后一条活动的时间'
    )

    duration_seconds = models.IntegerField(
        default=0,
        verbose_name='持续时间（秒）',
        help_text='轨迹持续的总时间'
    )

    # 统计信息
    total_activities = models.IntegerField(
        default=0,
        verbose_name='总活动数',
        help_text='轨迹中包含的活动总数'
    )

    high_risk_count = models.IntegerField(
        default=0,
        verbose_name='高风险活动数',
        help_text='risk_score>=70的活动数量'
    )

    critical_count = models.IntegerField(
        default=0,
        verbose_name='严重风险活动数',
        help_text='risk_score>=90的活动数量'
    )

    # Agent类型分布
    agent_types = models.JSONField(
        default=dict,
        verbose_name='Agent类型分布',
        help_text='格式: {"cursor": 10, "claude": 5}'
    )

    # 操作类型分布
    action_types = models.JSONField(
        default=dict,
        verbose_name='操作类型分布',
        help_text='格式: {"file_operation": 8, "clipboard_operation": 3}'
    )

    # 污点传播信息（复用前端taintTracking逻辑）
    taint_flows = models.JSONField(
        default=list,
        verbose_name='污点传播链',
        help_text='污点数据流向，格式: [{"source": "...", "sink": "...", "taint_id": "..."}]'
    )

    # 链路状态
    status = models.CharField(
        max_length=20,
        default='active',
        verbose_name='链路状态',
        help_text='active/archived/terminated'
    )

    # 元数据
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'auth_behavior_trajectory'
        verbose_name = 'Agent行为轨迹'
        verbose_name_plural = 'Agent行为轨迹'
        ordering = ['-start_time']

        # 索引
        indexes = [
            models.Index(fields=['session_id'], name='idx_trajectory_session'),
            models.Index(fields=['client_id', 'start_time'], name='idx_trajectory_client_time'),
            models.Index(fields=['chain_risk_score', 'start_time'], name='idx_trajectory_risk_time'),
            models.Index(fields=['status', 'updated_at'], name='idx_trajectory_status_time'),
        ]

    def __str__(self):
        return f"Trajectory({self.session_id}): {self.total_activities} activities, risk={self.chain_risk_score:.1f}"

    def add_activity(self, activity_log) -> None:
        """
        添加活动到轨迹中

        Args:
            activity_log: AgentActivityLog实例
        """
        # 构建活动摘要
        activity_summary = {
            'activity_id': activity_log.activity_id,
            'agent_type': activity_log.agent_type,
            'action': activity_log.action,
            'target': activity_log.target,
            'risk_level': activity_log.risk_level,
            'risk_score': activity_log.risk_score,
            'timestamp': activity_log.timestamp.isoformat(),
        }

        # 追加到链路
        if not self.behavior_chain:
            self.behavior_chain = []
        self.behavior_chain.append(activity_summary)

        # 更新时间范围
        if not self.start_time or activity_log.timestamp < self.start_time:
            self.start_time = activity_log.timestamp

        if not self.end_time or activity_log.timestamp > self.end_time:
            self.end_time = activity_log.timestamp

        # 计算持续时间
        if self.start_time and self.end_time:
            self.duration_seconds = int((self.end_time - self.start_time).total_seconds())

        # 更新统计
        self.total_activities = len(self.behavior_chain)

        if activity_log.risk_score >= 90:
            self.critical_count += 1
        elif activity_log.risk_score >= 70:
            self.high_risk_count += 1

        # 更新Agent类型分布
        if not self.agent_types:
            self.agent_types = {}
        self.agent_types[activity_log.agent_type] = self.agent_types.get(activity_log.agent_type, 0) + 1

        # 更新操作类型分布
        if not self.action_types:
            self.action_types = {}
        self.action_types[activity_log.action] = self.action_types.get(activity_log.action, 0) + 1

    def calculate_chain_risk(self) -> float:
        """
        计算整条链路的综合风险分数

        复用RiskAssessmentService的序列检测逻辑

        Returns:
            float: 0-100
        """
        import time
        calc_start = time.time()

        # 基于活动风险分数的加权平均
        if not self.behavior_chain:
            return 0.0

        # 时间衰减加权（越新权重越高）
        import math
        step1_start = time.time()
        weights = [math.pow(1.2, i) for i in range(len(self.behavior_chain))]
        total_weight = sum(weights)
        step1_duration = (time.time() - step1_start) * 1000

        weighted_sum = sum(
            activity['risk_score'] * weights[i]
            for i, activity in enumerate(self.behavior_chain)
        )

        base_score = weighted_sum / total_weight
        step2_duration = (time.time() - step1_start - step1_duration/1000) * 1000

        # 频率加分：短时间内大量高风险操作
        step3_start = time.time()
        frequency_bonus = 0.0
        if self.duration_seconds > 0:
            risk_density = (self.high_risk_count + self.critical_count) / (self.duration_seconds / 60)
            if risk_density > 3:  # 每分钟超过3次高风险操作
                frequency_bonus = min(risk_density * 2, 20)
        step3_duration = (time.time() - step3_start) * 1000

        # 序列加分：检测特定攻击模式
        step4_start = time.time()
        sequence_bonus = self._detect_attack_patterns()
        step4_duration = (time.time() - step4_start) * 1000

        total_score = min(base_score + frequency_bonus + sequence_bonus, 100)

        # 记录性能日志（仅在DEBUG级别）
        total_duration = (time.time() - calc_start) * 1000
        if total_duration > 10:  # 超过10ms才记录详细日志
            import logging
            logger = logging.getLogger(__name__)
            logger.debug(
                f"[calculate_chain_risk] 计算完成 "
                f"总耗时={total_duration:.2f}ms "
                f"步骤1-权重计算={step1_duration:.2f}ms "
                f"步骤2-加权平均={step2_duration:.2f}ms "
                f"步骤3-频率加分={step3_duration:.2f}ms "
                f"步骤4-序列检测={step4_duration:.2f}ms "
                f"base_score={base_score:.1f} "
                f"frequency_bonus={frequency_bonus:.1f} "
                f"sequence_bonus={sequence_bonus:.1f} "
                f"total_score={total_score:.1f}"
            )

        return total_score

    def _detect_attack_patterns(self) -> float:
        """
        检测已知攻击模式

        Returns:
            float: 模式加分
        """
        import time
        detect_start = time.time()

        bonus = 0.0
        self.anomaly_flags = []

        if not self.behavior_chain:
            return bonus

        # 模式1：数据外泄（文件操作 + 剪贴板操作）
        pattern1_start = time.time()
        has_file_op = any(a['action'] == 'file_operation' for a in self.behavior_chain)
        has_clipboard_op = any(a['action'] == 'clipboard_operation' for a in self.behavior_chain)

        if has_file_op and has_clipboard_op and self.high_risk_count >= 2:
            bonus += 15.0
            self.anomaly_flags.append('data_exfiltration')
        pattern1_duration = (time.time() - pattern1_start) * 1000

        # 模式2：权限提升（进程启动 + 文件操作）
        pattern2_start = time.time()
        has_process_start = any(a['action'] == 'process_started' for a in self.behavior_chain)
        if has_process_start and has_file_op and any(a['risk_score'] >= 80 for a in self.behavior_chain):
            bonus += 20.0
            self.anomaly_flags.append('privilege_escalation')
        pattern2_duration = (time.time() - pattern2_start) * 1000

        # 模式3：连续高风险操作
        pattern3_start = time.time()
        consecutive_high = 0
        for activity in self.behavior_chain:
            if activity['risk_score'] >= 70:
                consecutive_high += 1
            else:
                consecutive_high = 0

            if consecutive_high >= 3:
                bonus += 10.0
                self.anomaly_flags.append('consecutive_high_risk')
                break
        pattern3_duration = (time.time() - pattern3_start) * 1000

        # 模式4：AI辅助攻击（大量AI API调用 + 高风险操作）
        pattern4_start = time.time()
        ai_call_count = sum(1 for a in self.behavior_chain if a['action'] == 'ai_api_call')
        if ai_call_count >= 3 and self.high_risk_count >= 2:
            bonus += 12.0
            self.anomaly_flags.append('ai_assisted_attack')
        pattern4_duration = (time.time() - pattern4_start) * 1000

        # 记录性能日志（仅在DEBUG级别）
        total_duration = (time.time() - detect_start) * 1000
        if total_duration > 5:  # 超过5ms才记录详细日志
            import logging
            logger = logging.getLogger(__name__)
            logger.debug(
                f"[_detect_attack_patterns] 检测完成 "
                f"总耗时={total_duration:.2f}ms "
                f"模式1-数据外泄={pattern1_duration:.2f}ms "
                f"模式2-权限提升={pattern2_duration:.2f}ms "
                f"模式3-连续高风险={pattern3_duration:.2f}ms "
                f"模式4-AI辅助攻击={pattern4_duration:.2f}ms "
                f"anomaly_flags={self.anomaly_flags} "
                f"bonus={bonus:.1f}"
            )

        return bonus


class TrajectoryArchive(models.Model):
    """
    轨迹归档表

    用于存储超过保留期的历史轨迹，释放主表空间
    """

    trajectory_id = models.CharField(max_length=50, primary_key=True)
    session_id = models.CharField(max_length=50, db_index=True)
    client_id = models.CharField(max_length=64, db_index=True)

    behavior_chain = models.JSONField()
    chain_risk_score = models.FloatField()
    anomaly_flags = models.JSONField()

    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    duration_seconds = models.IntegerField()

    total_activities = models.IntegerField()
    high_risk_count = models.IntegerField()
    critical_count = models.IntegerField()

    agent_types = models.JSONField()
    action_types = models.JSONField()
    taint_flows = models.JSONField()

    archived_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'auth_trajectory_archive'
        verbose_name = '轨迹归档'
        verbose_name_plural = '轨迹归档'
        ordering = ['-start_time']
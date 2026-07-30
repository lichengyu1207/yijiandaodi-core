"""Agent行为数据模型（完整版）"""

from django.db import models
from django.conf import settings
from datetime import datetime
import uuid


def generate_behavior_id():
    return f"bh_{uuid.uuid4().hex[:16]}"

def generate_baseline_id():
    return f"bl_{uuid.uuid4().hex[:16]}"

def generate_pattern_id():
    return f"pt_{uuid.uuid4().hex[:16]}"

def generate_anomaly_id():
    return f"an_{uuid.uuid4().hex[:16]}"


class AgentBehaviorLog(models.Model):
    """Agent行为日志（完整版）"""
    behavior_id = models.CharField(max_length=64, db_index=True, default=generate_behavior_id)  # 移除unique约束
    agent_code = models.CharField(max_length=50, db_index=True)
    agent_name = models.CharField(max_length=100, default='', verbose_name='Agent名称')
    behavior_type = models.CharField(max_length=50)
    behavior_data = models.JSONField(default=dict)
    session_id = models.CharField(max_length=64, db_index=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    # 风险评估字段
    risk_level = models.CharField(max_length=20, default='info', verbose_name='风险等级')
    risk_score = models.FloatField(default=0.0, verbose_name='风险评分')
    anomaly_score = models.FloatField(default=0.0, verbose_name='异常评分')
    baseline_deviation = models.FloatField(default=0.0, verbose_name='基线偏离度')
    is_anomaly = models.BooleanField(default=False, verbose_name='是否异常')
    
    # 执行详情字段
    duration_ms = models.IntegerField(default=0, verbose_name='执行时长(毫秒)')
    
    # 用户信息字段
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, verbose_name='用户')
    ip_address = models.GenericIPAddressField(default='', verbose_name='IP地址')
    user_agent = models.TextField(default='', verbose_name='User-Agent')
    
    # 审核信息字段
    is_reviewed = models.BooleanField(default=False, verbose_name='是否已审核')
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, related_name='reviewed_behaviors', on_delete=models.SET_NULL, verbose_name='审核人')
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='审核时间')

    class Meta:
        db_table = 'agent_behavior_log'
        verbose_name = 'Agent行为日志'
        verbose_name_plural = 'Agent行为日志'
        ordering=['-timestamp']
        indexes = [
            models.Index(fields=['agent_code', '-timestamp'], name='idx_behavior_agent_time'),
            models.Index(fields=['risk_level'], name='idx_behavior_risk'),
            models.Index(fields=['is_anomaly'], name='idx_behavior_anomaly'),
        ]
    
    def __str__(self):
        return f'{self.agent_code} - {self.behavior_type} - {self.timestamp}'


class BehaviorBaseline(models.Model):
    """行为基线（完整版）"""
    baseline_id = models.CharField(max_length=64, db_index=True, default=generate_baseline_id)  # 移除unique约束
    agent_code = models.CharField(max_length=50, db_index=True, default='')  # 添加默认值
    behavior_type = models.CharField(max_length=50, default='unknown')  # 添加默认值
    baseline_type = models.CharField(max_length=50, default='statistical', verbose_name='基线类型')
    version = models.CharField(max_length=20, default='v1.0', verbose_name='版本')
    baseline_data = models.JSONField(default=dict)
    deviation_threshold = models.FloatField(default=2.0)
    
    # 统计周期字段
    period_start = models.DateTimeField(auto_now_add=True, verbose_name='统计开始时间')
    period_end = models.DateTimeField(null=True, blank=True, verbose_name='统计结束时间')
    sample_count = models.IntegerField(default=0, verbose_name='样本数量')
    
    # 模型性能字段
    accuracy = models.FloatField(default=0.0, verbose_name='准确率')
    precision = models.FloatField(default=0.0, verbose_name='精确率')
    recall = models.FloatField(default=0.0, verbose_name='召回率')
    f1_score = models.FloatField(default=0.0, verbose_name='F1分数')
    
    # 激活状态
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'behavior_baseline'
        verbose_name = '行为基线'
        verbose_name_plural = '行为基线'
        ordering=['-updated_at']
        indexes = [
            models.Index(fields=['agent_code', 'baseline_type'], name='idx_baseline_agent_type'),
            models.Index(fields=['is_active'], name='idx_baseline_active'),
        ]
    
    def __str__(self):
        return f'{self.agent_code} - {self.baseline_type} ({self.version})'


class BehaviorPattern(models.Model):
    """行为模式（完整版）"""
    pattern_id = models.CharField(max_length=64, db_index=True, default=generate_pattern_id)  # 移除unique约束
    agent_code = models.CharField(max_length=50, db_index=True, default='')  # 添加默认值
    pattern_name = models.CharField(max_length=100, default='')  # 添加默认值
    pattern_type = models.CharField(max_length=50, default='unknown')  # 添加默认值
    pattern_data = models.JSONField(default=dict)
    pattern_definition = models.JSONField(default=dict, verbose_name='模式定义')
    frequency = models.IntegerField(default=0)
    
    # 统计信息字段
    occurrence_count = models.IntegerField(default=0, verbose_name='出现次数')
    support = models.FloatField(default=0.0, verbose_name='支持度')
    confidence = models.FloatField(default=0.0, verbose_name='置信度')
    last_occurred_at = models.DateTimeField(null=True, blank=True, verbose_name='最后出现时间')
    
    is_normal = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        db_table = 'behavior_pattern'
        verbose_name = '行为模式'
        verbose_name_plural = '行为模式'
        ordering=['-occurrence_count']
        indexes = [
            models.Index(fields=['agent_code', 'pattern_type'], name='idx_pattern_agent_type'),
            models.Index(fields=['is_normal'], name='idx_pattern_normal'),
        ]
    
    def __str__(self):
        return f'{self.agent_code} - {self.pattern_name} ({self.pattern_type})'


class AnomalyDetection(models.Model):
    """异常检测结果（完整版）"""
    anomaly_id = models.CharField(max_length=64, db_index=True, default=generate_anomaly_id)  # 移除unique约束
    agent_code = models.CharField(max_length=50, db_index=True, default='')  # 添加默认值
    behavior_id = models.CharField(max_length=64, db_index=True, default=generate_behavior_id)
    anomaly_type = models.CharField(max_length=50, default='unknown')  # 添加默认值
    deviation_score = models.FloatField(default=0.0)
    severity = models.CharField(max_length=20, default='medium')
    description = models.TextField(default='')
    detected_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    # 详细信息字段
    confidence = models.FloatField(default=0.0, verbose_name='置信度')
    status = models.CharField(max_length=20, default='detected', verbose_name='状态')
    detection_method = models.CharField(max_length=50, default='baseline', verbose_name='检测方法')
    anomaly_description = models.TextField(default='', verbose_name='异常描述')
    anomaly_data = models.JSONField(default=dict, verbose_name='异常数据')
    
    # 关联行为日志
    behavior_log = models.ForeignKey(AgentBehaviorLog, null=True, on_delete=models.SET_NULL, verbose_name='行为日志', related_name='anomalies')
    
    # 处理信息字段
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, verbose_name='分配人')
    resolution_notes = models.TextField(default='', verbose_name='解决说明')
    resolved_at = models.DateTimeField(null=True, blank=True, verbose_name='解决时间')
    
    class Meta:
        db_table = 'anomaly_detection'
        verbose_name = '异常检测结果'
        verbose_name_plural = '异常检测结果'
        ordering=['-detected_at']
        indexes = [
            models.Index(fields=['agent_code', '-detected_at'], name='idx_anomaly_agent_time'),
            models.Index(fields=['severity'], name='idx_anomaly_severity'),
            models.Index(fields=['status'], name='idx_anomaly_status'),
        ]
    
    def __str__(self):
        return f'{self.agent_code} - {self.anomaly_type} ({self.severity})'
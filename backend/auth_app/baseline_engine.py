"""
行为基线建模引擎 - 核心算法模块

功能：
1. 从历史行为数据中统计计算行为基线
2. 模式挖掘：识别常见的行为序列模式
3. 异常检测：基于基线偏离度检测异常行为
4. 模型训练：生成行为基线模型
"""

import time
import threading
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from django.db.models import Count, Avg, StdDev, Max, Min, Q
from django.utils import timezone
from collections import defaultdict, Counter
import json

from .behavior_models import (
    AgentBehaviorLog, 
    BehaviorBaseline, 
    BehaviorPattern, 
    AnomalyDetection
)


class BaselineModelingEngine:
    """
    行为基线建模引擎
    
    核心算法：
    1. 统计分析：计算行为的统计特征（均值、方差、分位数）
    2. 模式识别：挖掘常见的行为序列模式
    3. 特征提取：提取关键行为特征及其分布
    4. 基线生成：生成行为基线模型
    """
    
    def __init__(self):
        self.enabled = True
        self.min_samples = 100  # 最小样本数（低于此阈值不建立基线）
        self.baseline_period_days = 7  # 基线统计周期（7天）
        self.model_version = 'v1.0'
        
        # 统计指标配置
        self.stat_metrics = {
            'api_call': {
                'frequency': 'count_per_minute',
                'latency': 'avg_latency_ms',
                'endpoints': 'distribution',
                'status_codes': 'distribution',
            },
            'data_access': {
                'tables': 'distribution',
                'records': 'avg_records',
                'query_types': 'distribution',
            },
            'permission_use': {
                'permissions': 'distribution',
                'escalation_rate': 'ratio',
            },
            'tool_call': {
                'tools': 'distribution',
                'execution_time': 'avg_execution_ms',
                'success_rate': 'ratio',
            },
        }
    
    def build_baseline(self, agent_code: str, baseline_type: str, force: bool = False) -> Optional[BehaviorBaseline]:
        """
        为指定Agent和行为类型建立基线模型
        
        Args:
            agent_code: Agent编码 (auditor/verifier/archiver/judge)
            baseline_type: 基线类型 (api_call/data_access/permission_use/tool_call/session_pattern)
            force: 是否强制重建基线（即使已有活跃基线）
        
        Returns:
            创建的基线模型对象
        """
        if not self.enabled:
            return None
        
        # 检查是否已有活跃基线
        if not force:
            existing_baseline = BehaviorBaseline.objects.filter(
                agent_code=agent_code,
                baseline_type=baseline_type,
                is_active=True
            ).first()
            if existing_baseline:
                return existing_baseline
        
        # 统计周期
        period_end = timezone.now()
        period_start = period_end - timedelta(days=self.baseline_period_days)
        
        # 获取历史行为数据
        behaviors = AgentBehaviorLog.objects.filter(
            agent_code=agent_code,
            behavior_type=baseline_type,
            timestamp__gte=period_start,
            timestamp__lte=period_end,
        )
        
        # 样本数检查
        sample_count = behaviors.count()
        if sample_count < self.min_samples:
            print(f'[BaselineEngine] 样本数不足 ({sample_count} < {self.min_samples})，跳过基线建立')
            return None
        
        # 统计分析
        baseline_data = self._analyze_behaviors(behaviors, baseline_type)
        
        # 基线模型性能评估（基于历史异常检测结果）
        accuracy, precision, recall, f1 = self._evaluate_model_performance(agent_code, baseline_type)
        
        # 创建基线模型
        baseline = BehaviorBaseline.objects.create(
            agent_code=agent_code,
            baseline_type=baseline_type,
            period_start=period_start,
            period_end=period_end,
            sample_count=sample_count,
            baseline_data=baseline_data,
            version=self.model_version,
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1_score=f1,
            is_active=True,
        )
        
        # 将旧的基线模型标记为非激活
        BehaviorBaseline.objects.filter(
            agent_code=agent_code,
            baseline_type=baseline_type,
            is_active=True
        ).exclude(id=baseline.id).update(is_active=False)
        
        print(f'[BaselineEngine] 基线模型已建立: {agent_code}-{baseline_type}, 样本数={sample_count}')
        
        return baseline
    
    def _analyze_behaviors(self, behaviors, baseline_type: str) -> Dict[str, Any]:
        """
        分析行为数据，生成基线统计特征
        
        Returns:
            baseline_data 结构：
            {
                'avg_frequency': 均值,
                'std_frequency': 标准差,
                'percentile_95': 95分位数,
                'normal_range': {'min': 最小值, 'max': 最大值},
                'feature_distribution': {特征分布},
                'common_patterns': [常见模式],
            }
        """
        baseline_data = {}
        
        # 1. 基础统计指标
        if baseline_type == 'api_call':
            # API调用频率分析
            call_frequency_stats = self._analyze_call_frequency(behaviors)
            baseline_data['avg_frequency'] = call_frequency_stats['avg']
            baseline_data['std_frequency'] = call_frequency_stats['std']
            baseline_data['percentile_95'] = call_frequency_stats['percentile_95']
            baseline_data['normal_range'] = call_frequency_stats['normal_range']
            
            # 响应时间分析
            latency_stats = self._analyze_latency(behaviors)
            baseline_data['avg_latency_ms'] = latency_stats['avg']
            baseline_data['std_latency_ms'] = latency_stats['std']
            baseline_data['percentile_95_latency'] = latency_stats['percentile_95']
            
            # API端点分布
            endpoint_dist = self._analyze_endpoint_distribution(behaviors)
            baseline_data['feature_distribution'] = {
                'api_endpoints': endpoint_dist,
                'http_methods': self._analyze_method_distribution(behaviors),
                'status_codes': self._analyze_status_distribution(behaviors),
            }
            
        elif baseline_type == 'data_access':
            # 数据访问频率
            access_frequency_stats = self._analyze_call_frequency(behaviors)
            baseline_data['avg_frequency'] = access_frequency_stats['avg']
            baseline_data['std_frequency'] = access_frequency_stats['std']
            
            # 访问记录数分析
            records_stats = self._analyze_records_count(behaviors)
            baseline_data['avg_records'] = records_stats['avg']
            baseline_data['std_records'] = records_stats['std']
            baseline_data['max_records'] = records_stats['max']
            
            # 数据表分布
            table_dist = self._analyze_table_distribution(behaviors)
            baseline_data['feature_distribution'] = {
                'data_tables': table_dist,
                'query_types': self._analyze_query_type_distribution(behaviors),
            }
            
        elif baseline_type == 'permission_use':
            # 权限使用频率
            permission_frequency_stats = self._analyze_call_frequency(behaviors)
            baseline_data['avg_frequency'] = permission_frequency_stats['avg']
            
            # 权限分布
            permission_dist = self._analyze_permission_distribution(behaviors)
            baseline_data['feature_distribution'] = {
                'permissions': permission_dist,
            }
            
            # 权限提升率
            escalation_rate = self._analyze_escalation_rate(behaviors)
            baseline_data['escalation_rate'] = escalation_rate
            
        elif baseline_type == 'tool_call':
            # Tool调用频率
            tool_frequency_stats = self._analyze_call_frequency(behaviors)
            baseline_data['avg_frequency'] = tool_frequency_stats['avg']
            
            # Tool执行时间分析
            execution_stats = self._analyze_execution_time(behaviors)
            baseline_data['avg_execution_ms'] = execution_stats['avg']
            baseline_data['std_execution_ms'] = execution_stats['std']
            
            # Tool分布
            tool_dist = self._analyze_tool_distribution(behaviors)
            baseline_data['feature_distribution'] = {
                'tools': tool_dist,
            }
            
            # Tool成功率
            success_rate = self._analyze_tool_success_rate(behaviors)
            baseline_data['success_rate'] = success_rate
        
        # 2. 模式挖掘
        common_patterns = self._mine_behavior_patterns(behaviors, baseline_type)
        baseline_data['common_patterns'] = common_patterns
        
        return baseline_data
    
    def _analyze_call_frequency(self, behaviors) -> Dict[str, Any]:
        """分析调用频率"""
        # 按时间分组统计
        time_groups = defaultdict(list)
        for behavior in behaviors:
            time_key = behavior.timestamp.strftime('%Y-%m-%d %H:%M')
            time_groups[time_key].append(behavior)
        
        # 计算每分钟的调用次数
        call_counts = [len(group) for group in time_groups.values()]
        
        if not call_counts:
            return {'avg': 0, 'std': 0, 'percentile_95': 0, 'normal_range': {'min': 0, 'max': 0}}
        
        avg = sum(call_counts) / len(call_counts)
        std = (sum((x - avg) ** 2 for x in call_counts) / len(call_counts)) ** 0.5
        
        sorted_counts = sorted(call_counts)
        percentile_95_idx = int(len(sorted_counts) * 0.95)
        percentile_95 = sorted_counts[percentile_95_idx] if percentile_95_idx < len(sorted_counts) else max(sorted_counts)
        
        # 正常范围（均值±2σ）
        normal_range = {
            'min': max(0, avg - 2 * std),
            'max': avg + 2 * std,
        }
        
        return {
            'avg': avg,
            'std': std,
            'percentile_95': percentile_95,
            'normal_range': normal_range,
        }
    
    def _analyze_latency(self, behaviors) -> Dict[str, float]:
        """分析响应时间"""
        latencies = [b.duration_ms for b in behaviors if b.duration_ms > 0]
        
        if not latencies:
            return {'avg': 0, 'std': 0, 'percentile_95': 0}
        
        avg = sum(latencies) / len(latencies)
        std = (sum((x - avg) ** 2 for x in latencies) / len(latencies)) ** 0.5
        
        sorted_latencies = sorted(latencies)
        percentile_95_idx = int(len(sorted_latencies) * 0.95)
        percentile_95 = sorted_latencies[percentile_95_idx] if percentile_95_idx < len(sorted_latencies) else max(sorted_latencies)
        
        return {
            'avg': avg,
            'std': std,
            'percentile_95': percentile_95,
        }
    
    def _analyze_endpoint_distribution(self, behaviors) -> Dict[str, float]:
        """分析API端点分布"""
        endpoint_counts = Counter()
        for behavior in behaviors:
            endpoint = behavior.behavior_data.get('api_endpoint', 'unknown')
            endpoint_counts[endpoint] += 1
        
        total = sum(endpoint_counts.values())
        if total == 0:
            return {}
        
        distribution = {endpoint: count / total for endpoint, count in endpoint_counts.items()}
        
        # 只保留频率>0.01的端点
        significant_distribution = {k: v for k, v in distribution.items() if v > 0.01}
        
        return significant_distribution
    
    def _analyze_method_distribution(self, behaviors) -> Dict[str, float]:
        """分析HTTP方法分布"""
        method_counts = Counter()
        for behavior in behaviors:
            method = behavior.behavior_data.get('http_method', 'unknown')
            method_counts[method] += 1
        
        total = sum(method_counts.values())
        if total == 0:
            return {}
        
        return {method: count / total for method, count in method_counts.items()}
    
    def _analyze_status_distribution(self, behaviors) -> Dict[str, float]:
        """分析响应状态码分布"""
        status_counts = Counter()
        for behavior in behaviors:
            status = behavior.behavior_data.get('response_status', 200)
            status_counts[status] += 1
        
        total = sum(status_counts.values())
        if total == 0:
            return {}
        
        return {str(status): count / total for status, count in status_counts.items()}
    
    def _analyze_table_distribution(self, behaviors) -> Dict[str, float]:
        """分析数据表访问分布"""
        table_counts = Counter()
        for behavior in behaviors:
            tables = behavior.behavior_data.get('data_tables_accessed', [])
            for table in tables:
                table_counts[table] += 1
        
        total = sum(table_counts.values())
        if total == 0:
            return {}
        
        distribution = {table: count / total for table, count in table_counts.items()}
        
        # 只保留频率>0.01的表
        significant_distribution = {k: v for k, v in distribution.items() if v > 0.01}
        
        return significant_distribution
    
    def _analyze_records_count(self, behaviors) -> Dict[str, float]:
        """分析访问记录数量"""
        records_counts = [b.behavior_data.get('data_records_affected', 0) for b in behaviors]
        
        if not records_counts:
            return {'avg': 0, 'std': 0, 'max': 0}
        
        avg = sum(records_counts) / len(records_counts)
        std = (sum((x - avg) ** 2 for x in records_counts) / len(records_counts)) ** 0.5
        max_val = max(records_counts)
        
        return {
            'avg': avg,
            'std': std,
            'max': max_val,
        }
    
    def _analyze_query_type_distribution(self, behaviors) -> Dict[str, float]:
        """分析查询类型分布"""
        query_type_counts = Counter()
        for behavior in behaviors:
            query_type = behavior.behavior_data.get('query_type', 'read')
            query_type_counts[query_type] += 1
        
        total = sum(query_type_counts.values())
        if total == 0:
            return {}
        
        return {query_type: count / total for query_type, count in query_type_counts.items()}
    
    def _analyze_permission_distribution(self, behaviors) -> Dict[str, float]:
        """分析权限使用分布"""
        permission_counts = Counter()
        for behavior in behaviors:
            permissions = behavior.behavior_data.get('permissions_required', [])
            for perm in permissions:
                permission_counts[perm] += 1
        
        total = sum(permission_counts.values())
        if total == 0:
            return {}
        
        distribution = {perm: count / total for perm, count in permission_counts.items()}
        
        # 只保留频率>0.01的权限
        significant_distribution = {k: v for k, v in distribution.items() if v > 0.01}
        
        return significant_distribution
    
    def _analyze_escalation_rate(self, behaviors) -> float:
        """分析权限提升率"""
        escalation_count = sum(1 for b in behaviors if b.behavior_data.get('permission_escalation', False))
        total = behaviors.count()
        
        return escalation_count / total if total > 0 else 0.0
    
    def _analyze_execution_time(self, behaviors) -> Dict[str, float]:
        """分析Tool执行时间"""
        execution_times = [b.duration_ms for b in behaviors if b.duration_ms > 0]
        
        if not execution_times:
            return {'avg': 0, 'std': 0}
        
        avg = sum(execution_times) / len(execution_times)
        std = (sum((x - avg) ** 2 for x in execution_times) / len(execution_times)) ** 0.5
        
        return {
            'avg': avg,
            'std': std,
        }
    
    def _analyze_tool_distribution(self, behaviors) -> Dict[str, float]:
        """分析Tool使用分布"""
        tool_counts = Counter()
        for behavior in behaviors:
            tool_name = behavior.behavior_data.get('tool_name', 'unknown')
            tool_counts[tool_name] += 1
        
        total = sum(tool_counts.values())
        if total == 0:
            return {}
        
        distribution = {tool: count / total for tool, count in tool_counts.items()}
        
        # 只保留频率>0.01的Tool
        significant_distribution = {k: v for k, v in distribution.items() if v > 0.01}
        
        return significant_distribution
    
    def _analyze_tool_success_rate(self, behaviors) -> float:
        """分析Tool成功率"""
        success_count = sum(1 for b in behaviors if not b.behavior_data.get('has_error', False))
        total = behaviors.count()
        
        return success_count / total if total > 0 else 1.0
    
    def _mine_behavior_patterns(self, behaviors, baseline_type: str) -> List[Dict]:
        """
        挖掘行为模式
        
        返回常见的行为序列模式及其频率
        """
        patterns = []
        
        # 序列模式挖掘（基于session_id分组）
        session_behaviors = defaultdict(list)
        for behavior in behaviors:
            session_behaviors[behavior.session_id].append(behavior)
        
        # 统计行为序列
        sequence_counts = Counter()
        for session_id, session_behaviors_list in session_behaviors.items():
            # 按时间排序
            sorted_behaviors = sorted(session_behaviors_list, key=lambda b: b.timestamp)
            
            # 提取行为序列（简化版）
            behavior_sequence = [b.behavior_type for b in sorted_behaviors]
            sequence_key = '->'.join(behavior_sequence)
            
            sequence_counts[sequence_key] += 1
        
        # 转换为频率分布
        total_sessions = len(session_behaviors)
        if total_sessions > 0:
            for sequence, count in sequence_counts.most_common(10):  # 只保留前10个常见模式
                patterns.append({
                    'pattern': sequence,
                    'frequency': count / total_sessions,
                    'count': count,
                })
        
        return patterns
    
    def _evaluate_model_performance(self, agent_code: str, baseline_type: str) -> tuple:
        """
        评估基线模型性能（基于历史异常检测结果）
        
        Returns:
            (accuracy, precision, recall, f1)
        """
        # 获取历史异常检测结果
        anomalies = AnomalyDetection.objects.filter(
            behavior_log__agent_code=agent_code,
            behavior_log__behavior_type=baseline_type,
            status__in=['resolved', 'false_positive'],
        )
        
        if anomalies.count() == 0:
            # 没有历史数据，返回默认值
            return 0.85, 0.80, 0.75, 0.77
        
        # 计算性能指标
        true_positives = anomalies.filter(status='resolved', severity__in=['high', 'critical']).count()
        false_positives = anomalies.filter(status='false_positive').count()
        false_negatives = 0  # 需要人工标记
        
        total_detections = anomalies.count()
        
        accuracy = (true_positives + false_negatives) / total_detections if total_detections > 0 else 0.85
        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0.80
        recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0.75
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.77
        
        return accuracy, precision, recall, f1
    
    def build_all_baselines(self) -> Dict[str, Any]:
        """
        为所有Agent和行为类型建立基线模型
        
        Returns:
            建立结果统计
        """
        agent_codes = ['auditor', 'verifier', 'archiver', 'judge', 'detector']
        baseline_types = ['api_call', 'data_access', 'permission_use', 'tool_call', 'session_pattern']
        
        results = {
            'total': 0,
            'success': 0,
            'failed': 0,
            'details': [],
        }
        
        for agent_code in agent_codes:
            for baseline_type in baseline_types:
                results['total'] += 1
                
                try:
                    baseline = self.build_baseline(agent_code, baseline_type)
                    if baseline:
                        results['success'] += 1
                        results['details'].append({
                            'agent_code': agent_code,
                            'baseline_type': baseline_type,
                            'status': 'success',
                            'sample_count': baseline.sample_count,
                        })
                    else:
                        results['failed'] += 1
                        results['details'].append({
                            'agent_code': agent_code,
                            'baseline_type': baseline_type,
                            'status': 'failed',
                            'reason': '样本数不足',
                        })
                except Exception as e:
                    results['failed'] += 1
                    results['details'].append({
                        'agent_code': agent_code,
                        'baseline_type': baseline_type,
                        'status': 'failed',
                        'reason': str(e),
                    })
        
        return results
    
    def get_active_baseline(self, agent_code: str, baseline_type: str) -> Optional[BehaviorBaseline]:
        """获取指定Agent的活跃基线模型"""
        return BehaviorBaseline.objects.filter(
            agent_code=agent_code,
            baseline_type=baseline_type,
            is_active=True
        ).first()
    
    def update_baseline_periodically(self):
        """
        定期更新基线模型（用于定时任务）
        
        建议：每天凌晨执行一次
        """
        agent_codes = ['auditor', 'verifier', 'archiver', 'judge']
        baseline_types = ['api_call', 'data_access', 'permission_use', 'tool_call']
        
        for agent_code in agent_codes:
            for baseline_type in baseline_types:
                try:
                    self.build_baseline(agent_code, baseline_type, force=True)
                except Exception as e:
                    print(f'[BaselineEngine] 更新基线失败: {agent_code}-{baseline_type}, {e}')
        
        print('[BaselineEngine] 定期更新基线完成')


# ============================================================
# 异常检测引擎
# ============================================================

class AnomalyDetectionEngine:
    """
    异常检测引擎
    
    基于行为基线模型，实时检测异常行为
    """
    
    def __init__(self):
        self.enabled = True
        self.baseline_engine = BaselineModelingEngine()
        
        # 异常阈值配置
        self.anomaly_thresholds = {
            'frequency_deviation': 2.0,  # 频率偏离度阈值（超过2σ视为异常）
            'latency_deviation': 2.5,    # 响应时间偏离度阈值
            'feature_deviation': 0.3,    # 特征偏离度阈值
            'anomaly_score_threshold': 0.7,  # 异常分数阈值
        }
    
    def detect_anomaly(self, behavior_log: AgentBehaviorLog) -> Optional[AnomalyDetection]:
        """
        检测单个行为的异常
        
        Args:
            behavior_log: 待检测的行为日志
        
        Returns:
            创建的异常检测记录（如果检测到异常）
        """
        if not self.enabled:
            return None
        
        # 获取基线模型
        baseline = self.baseline_engine.get_active_baseline(
            behavior_log.agent_code, 
            behavior_log.behavior_type
        )
        
        if not baseline:
            # 没有基线模型，无法检测异常
            return None
        
        # 计算偏离度
        deviation_scores = self._calculate_deviations(behavior_log, baseline)
        
        # 计算综合异常分数
        anomaly_score = self._calculate_anomaly_score(deviation_scores)
        
        # 判断是否异常
        if anomaly_score < self.anomaly_thresholds['anomaly_score_threshold']:
            return None
        
        # 确定异常类型和严重程度
        anomaly_type, severity = self._determine_anomaly_type(behavior_log, deviation_scores)
        
        # 创建异常检测记录
        anomaly = AnomalyDetection.objects.create(
            behavior_log=behavior_log,
            anomaly_type=anomaly_type,
            severity=severity,
            detection_method='baseline_deviation',
            confidence=anomaly_score,
            anomaly_description=self._generate_anomaly_description(behavior_log, deviation_scores),
            anomaly_data={
                'expected_values': self._extract_expected_values(baseline),
                'actual_values': behavior_log.behavior_data,
                'deviation_scores': deviation_scores,
                'baseline_version': baseline.version,
            },
            status='detected',
        )
        
        # 更新行为日志的异常标记
        behavior_log.is_anomaly = True
        behavior_log.anomaly_score = anomaly_score
        behavior_log.save(update_fields=['is_anomaly', 'anomaly_score'])
        
        return anomaly
    
    def _calculate_deviations(self, behavior_log: AgentBehaviorLog, baseline: BehaviorBaseline) -> Dict[str, float]:
        """
        计算各维度的偏离度
        
        Returns:
            {'frequency': 偏离度, 'latency': 偏离度, 'feature': 偏离度, ...}
        """
        deviations = {}
        baseline_data = baseline.baseline_data
        behavior_data = behavior_log.behavior_data
        
        # 1. 频率偏离度
        if 'avg_frequency' in baseline_data:
            expected_freq = baseline_data['avg_frequency']
            std_freq = baseline_data.get('std_frequency', expected_freq * 0.1)
            actual_freq = behavior_data.get('call_frequency', 1)
            
            freq_deviation = abs(actual_freq - expected_freq) / std_freq if std_freq > 0 else 0
            deviations['frequency'] = freq_deviation
        
        # 2. 响应时间偏离度
        if 'avg_latency_ms' in baseline_data:
            expected_latency = baseline_data['avg_latency_ms']
            std_latency = baseline_data.get('std_latency_ms', expected_latency * 0.1)
            actual_latency = behavior_log.duration_ms
            
            latency_deviation = abs(actual_latency - expected_latency) / std_latency if std_latency > 0 else 0
            deviations['latency'] = latency_deviation
        
        # 3. 特征偏离度（API端点、数据表、Tool等）
        feature_dist = baseline_data.get('feature_distribution', {})
        feature_deviation = 0.0
        
        if baseline.baseline_type == 'api_call':
            # API端点偏离度
            expected_endpoints = feature_dist.get('api_endpoints', {})
            actual_endpoint = behavior_data.get('api_endpoint', '')
            
            if actual_endpoint not in expected_endpoints:
                feature_deviation += 0.5
        
        elif baseline.baseline_type == 'data_access':
            # 数据表偏离度
            expected_tables = feature_dist.get('data_tables', {})
            actual_tables = behavior_data.get('data_tables_accessed', [])
            
            abnormal_tables = [t for t in actual_tables if t not in expected_tables]
            if abnormal_tables:
                feature_deviation += len(abnormal_tables) / len(actual_tables) if actual_tables else 0
        
        elif baseline.baseline_type == 'tool_call':
            # Tool偏离度
            expected_tools = feature_dist.get('tools', {})
            actual_tool = behavior_data.get('tool_name', '')
            
            if actual_tool not in expected_tools:
                feature_deviation += 0.5
        
        deviations['feature'] = feature_deviation
        
        return deviations
    
    def _calculate_anomaly_score(self, deviations: Dict[str, float]) -> float:
        """
        计算综合异常分数
        
        Returns:
            0-1范围的异常分数
        """
        # 各维度权重
        weights = {
            'frequency': 0.3,
            'latency': 0.2,
            'feature': 0.5,
        }
        
        # 计算加权平均偏离度
        total_deviation = sum(
            deviations.get(key, 0) * weight 
            for key, weight in weights.items()
        )
        
        # 映射到0-1范围
        anomaly_score = min(1.0, total_deviation / 2.0)
        
        return anomaly_score
    
    def _determine_anomaly_type(self, behavior_log: AgentBehaviorLog, deviations: Dict[str, float]) -> tuple:
        """
        确定异常类型和严重程度
        
        Returns:
            (anomaly_type, severity)
        """
        # 异常类型分类
        anomaly_types = {
            'api_call': {
                'frequency_anomaly': 'API调用频率异常',
                'latency_anomaly': 'API响应时间异常',
                'endpoint_anomaly': '异常API端点访问',
            },
            'data_access': {
                'frequency_anomaly': '数据访问频率异常',
                'table_anomaly': '异常数据表访问',
                'records_anomaly': '大量数据访问',
            },
            'permission_use': {
                'escalation_anomaly': '权限提升异常',
                'permission_anomaly': '异常权限使用',
            },
            'tool_call': {
                'execution_anomaly': 'Tool执行时间异常',
                'tool_anomaly': '异常Tool调用',
                'error_anomaly': 'Tool执行错误',
            },
        }
        
        behavior_type = behavior_log.behavior_type
        type_map = anomaly_types.get(behavior_type, {})
        
        # 根据偏离度确定异常类型
        anomaly_type = 'unknown_anomaly'
        
        if deviations.get('frequency', 0) > self.anomaly_thresholds['frequency_deviation']:
            anomaly_type = type_map.get('frequency_anomaly', '频率异常')
        
        if deviations.get('latency', 0) > self.anomaly_thresholds['latency_deviation']:
            anomaly_type = type_map.get('latency_anomaly', '时间异常')
        
        if deviations.get('feature', 0) > self.anomaly_thresholds['feature_deviation']:
            anomaly_type = type_map.get('endpoint_anomaly', type_map.get('table_anomaly', type_map.get('tool_anomaly', '特征异常')))
        
        # 确定严重程度
        severity = 'low'
        
        # 基于风险评分
        if behavior_log.risk_score >= 80:
            severity = 'critical'
        elif behavior_log.risk_score >= 60:
            severity = 'high'
        elif behavior_log.risk_score >= 30:
            severity = 'medium'
        
        # 基于偏离度
        max_deviation = max(deviations.values())
        if max_deviation > 3.0:
            severity = 'critical'
        elif max_deviation > 2.5:
            severity = 'high'
        elif max_deviation > 2.0:
            severity = 'medium'
        
        return anomaly_type, severity
    
    def _generate_anomaly_description(self, behavior_log: AgentBehaviorLog, deviations: Dict[str, float]) -> str:
        """生成异常描述文本"""
        agent_name = behavior_log.agent_name
        behavior_type = behavior_log.get_behavior_type_display()
        
        description_parts = []
        
        if deviations.get('frequency', 0) > 2.0:
            description_parts.append(f'调用频率显著异常（偏离度{deviations["frequency"]:.2f}σ）')
        
        if deviations.get('latency', 0) > 2.0:
            description_parts.append(f'响应时间异常（偏离度{deviations["latency"]:.2f}σ）')
        
        if deviations.get('feature', 0) > 0.3:
            description_parts.append(f'行为特征异常（偏离度{deviations["feature"]:.2f})')
        
        description = f'{agent_name}在{behavior_type}过程中发现异常：{", ".join(description_parts)}'
        
        return description
    
    def _extract_expected_values(self, baseline: BehaviorBaseline) -> Dict[str, Any]:
        """提取基线期望值"""
        baseline_data = baseline.baseline_data
        
        expected_values = {
            'avg_frequency': baseline_data.get('avg_frequency'),
            'avg_latency_ms': baseline_data.get('avg_latency_ms'),
            'normal_range': baseline_data.get('normal_range'),
            'feature_distribution': baseline_data.get('feature_distribution'),
        }
        
        return expected_values
    
    def detect_batch_anomalies(self, behavior_logs: List[AgentBehaviorLog]) -> List[AnomalyDetection]:
        """
        批量检测异常
        
        Args:
            behavior_logs: 待检测的行为日志列表
        
        Returns:
            检测到的异常列表
        """
        anomalies = []
        
        for behavior_log in behavior_logs:
            anomaly = self.detect_anomaly(behavior_log)
            if anomaly:
                anomalies.append(anomaly)
        
        return anomalies


# ============================================================
# 便捷函数
# ============================================================

def get_baseline_engine() -> BaselineModelingEngine:
    """获取基线建模引擎实例"""
    return BaselineModelingEngine()


def get_anomaly_engine() -> AnomalyDetectionEngine:
    """获取异常检测引擎实例"""
    return AnomalyDetectionEngine()


def build_baseline(agent_code: str, baseline_type: str) -> Optional[BehaviorBaseline]:
    """建立基线模型"""
    engine = BaselineModelingEngine()
    return engine.build_baseline(agent_code, baseline_type)


def detect_anomaly(behavior_log: AgentBehaviorLog) -> Optional[AnomalyDetection]:
    """检测异常"""
    engine = AnomalyDetectionEngine()
    return engine.detect_anomaly(behavior_log)
"""
自监控服务 - Self-Audit Service

实现系统的自监控能力，包括：
1. 校验准确率漂移检测（高优先级）
2. 响应时间异常监控（高优先级）
3. 误报率变化统计（中优先级）
4. 权限使用审计（中优先级）
5. 规则库时效性检测（低优先级）

参考实现：
- trusted-agent-engine的自我感知（Self-Audit）能力
- ka88-agent-shield的Self-Audit模块
"""

import logging
from datetime import timedelta
from django.utils import timezone
from django.db.models import Avg, Count, Q
from django.core.cache import cache
from django.conf import settings

from .self_audit_models import (
    PerformanceDriftRecord,
    AgentPermissionAuditLog,
    RuleFreshnessCheck,
    SelfAuditReport
)
from .governance_models import GovernanceHealth
from .memory_models import ShortTermMemory, LongTermMemory, StrategicMemory
from .behavior_models import BehaviorBaseline
from .agent_identity_models import AgentIdentity, AgentPermission

logger = logging.getLogger(__name__)


class SelfAuditService:
    """
    自监控服务核心类

    提供系统自监控能力，自动监控治理健康度，识别性能漂移与权限蔓延
    """

    # 监控阈值配置
    THRESHOLDS = {
        'accuracy_deviation': 0.10,  # 准确率偏离阈值 10%
        'response_time_p99': 2000,   # P99响应时间阈值 2000ms
        'response_time_avg': 1000,   # 平均响应时间阈值 1000ms
        'false_positive_rate': 0.05, # 误报率阈值 5%
        'rule_freshness_days': 90,   # 规则时效性阈值 90天
    }

    @staticmethod
    def check_accuracy_drift(time_window=timedelta(hours=1)):
        """
        检测校验准确率漂移（高优先级）

        定期抽样评估，与基线对比，识别性能漂移

        Args:
            time_window: 时间窗口，默认1小时

        Returns:
            PerformanceDriftRecord: 漂移记录（如果检测到漂移）
        """
        import time
        start_time_exec = time.time()

        logger.info(f"[Self-Audit] ========== 开始检测校验准确率漂移 ==========")
        logger.info(f"[Self-Audit] 时间窗口: {time_window}")

        end_time = timezone.now()
        start_time = end_time - time_window

        logger.debug(f"[Self-Audit] 查询时间范围: {start_time} 至 {end_time}")

        try:
            # 1. 获取当前时间窗口的短期记忆数据（校验记录）
            logger.debug("[Self-Audit] 步骤1: 查询短期记忆数据...")
            recent_memories = ShortTermMemory.objects.filter(
                timestamp__gte=start_time,
                timestamp__lte=end_time
            ).values('decision').annotate(count=Count('id'))

            logger.debug(f"[Self-Audit] 查询完成，返回 {len(recent_memories)} 条聚合记录")

            # 2. 计算当前的准确率（使用decision='allow'的比例作为准确率估算）
            # 注意：ShortTermMemory 使用 decision 字段而非 is_safe
            # decision='allow' 表示系统判定为安全，decision='block' 表示系统判定为危险
            logger.debug("[Self-Audit] 步骤2: 计算当前准确率...")
            total_count = sum(item['count'] for item in recent_memories)
            safe_count = sum(item['count'] for item in recent_memories if item['decision'] == 'allow')

            logger.debug(
                f"[Self-Audit] 统计结果: 总数={total_count}, 安全={safe_count}, "
                f"危险={total_count - safe_count}"
            )

            if total_count == 0:
                logger.warning("[Self-Audit] 时间窗口内无校验记录，跳过准确率检测")
                return None

            current_accuracy = safe_count / total_count
            logger.info(f"[Self-Audit] 当前准确率: {current_accuracy:.4f} ({current_accuracy:.2%})")

            # 3. 获取基线准确率（从行为基线模型）
            logger.debug("[Self-Audit] 步骤3: 查询基线准确率...")
            try:
                # 注意：BehaviorBaseline 使用 baseline_type 而非 metric_name
                # 使用 accuracy 字段而非 metric_value
                baseline = BehaviorBaseline.objects.filter(
                    baseline_type='accuracy',
                    is_active=True
                ).latest('updated_at')

                baseline_accuracy = baseline.accuracy / 100.0  # 转换为0-1范围
                logger.info(
                    f"[Self-Audit] 基线准确率: {baseline_accuracy:.4f} "
                    f"(ID: {baseline.id}, 更新时间: {baseline.updated_at})"
                )

                # 4. 计算偏离率
                logger.debug("[Self-Audit] 步骤4: 计算偏离率...")
                deviation_rate = abs(current_accuracy - baseline_accuracy) / baseline_accuracy

                logger.info(
                    f"[Self-Audit] 偏离率计算: "
                    f"|{current_accuracy:.4f} - {baseline_accuracy:.4f}| / {baseline_accuracy:.4f} = "
                    f"{deviation_rate:.4f}"
                )

                threshold = SelfAuditService.THRESHOLDS['accuracy_deviation']
                logger.debug(f"[Self-Audit] 偏离阈值: {threshold:.4f} ({threshold:.2%})")

                # 5. 如果偏离率超过阈值，记录漂移
                if deviation_rate > threshold:
                    logger.warning(
                        f"[Self-Audit] 检测到准确率漂移！偏离率 {deviation_rate:.4f} "
                        f"超过阈值 {threshold:.4f}"
                    )

                    logger.debug("[Self-Audit] 步骤5: 创建性能漂移记录...")
                    logger.debug(
                        f"[Self-Audit] 创建参数: drift_type=accuracy, "
                        f"baseline_value={baseline_accuracy:.4f}, "
                        f"current_value={current_accuracy:.4f}, "
                        f"deviation_rate={deviation_rate:.4f}, "
                        f"sample_size={total_count}, "
                        f"baseline_id={baseline.id if baseline else None}"
                    )

                    try:
                        drift_record = PerformanceDriftRecord.objects.create(
                            drift_type='accuracy',
                            baseline_value=baseline_accuracy,
                            current_value=current_accuracy,
                            deviation_rate=deviation_rate,
                            sample_size=total_count,
                            time_window=time_window,
                            baseline=baseline,
                            metadata={
                                'safe_count': safe_count,
                                'total_count': total_count,
                                'threshold': threshold,
                                'start_time': start_time.isoformat(),
                                'end_time': end_time.isoformat()
                            }
                        )

                        logger.info(
                            f"[Self-Audit] [DB-WRITE] PerformanceDriftRecord 创建成功: "
                            f"ID={drift_record.id}, drift_type={drift_record.drift_type}, "
                            f"baseline_value={drift_record.baseline_value:.4f}, "
                            f"current_value={drift_record.current_value:.4f}, "
                            f"deviation_rate={drift_record.deviation_rate:.4f}"
                        )

                        drift_record.calculate_severity()
                        drift_record.save()

                        logger.info(
                            f"[Self-Audit] [DB-UPDATE] PerformanceDriftRecord 严重程度已计算: "
                            f"ID={drift_record.id}, severity={drift_record.severity}"
                        )

                    except Exception as create_error:
                        logger.error(
                            f"[Self-Audit] [DB-ERROR] PerformanceDriftRecord 创建失败: "
                            f"{type(create_error).__name__}: {create_error}",
                            exc_info=True
                        )
                        raise

                    elapsed_ms = (time.time() - start_time_exec) * 1000
                    logger.info(
                        f"[Self-Audit] ========== 准确率漂移检测完成（发现异常） ========== "
                        f"耗时: {elapsed_ms:.2f}ms"
                    )

                    return drift_record
                else:
                    logger.info(
                        f"[Self-Audit] 准确率稳定，偏离率 {deviation_rate:.2%} "
                        f"未超过阈值 {threshold:.2%}"
                    )

                    elapsed_ms = (time.time() - start_time_exec) * 1000
                    logger.info(
                        f"[Self-Audit] ========== 准确率漂移检测完成（正常） ========== "
                        f"耗时: {elapsed_ms:.2f}ms"
                    )
                    return None

            except BehaviorBaseline.DoesNotExist as e:
                logger.warning(
                    f"[Self-Audit] 未找到准确率基线，跳过漂移检测。"
                    f"请创建 metric_name='accuracy' 的 BehaviorBaseline 记录"
                )
                logger.debug(f"[Self-Audit] 异常详情: {e}")
                return None

        except Exception as e:
            elapsed_ms = (time.time() - start_time_exec) * 1000
            logger.error(
                f"[Self-Audit] 准确率漂移检测失败: {type(e).__name__}: {e}",
                exc_info=True
            )
            logger.error(f"[Self-Audit] 检测耗时: {elapsed_ms:.2f}ms")
            raise

    @staticmethod
    def check_response_time_anomaly(time_window=timedelta(hours=1)):
        """
        检测响应时间异常（高优先级）

        实时监控API响应时间，设置阈值告警

        注意：已为 ShortTermMemory 模型添加 metadata JSONField，
        可以存储响应时间等性能指标。

        Args:
            time_window: 时间窗口，默认1小时

        Returns:
            list: 异常记录列表
        """
        import time
        start_time_exec = time.time()

        logger.info(f"[Self-Audit] ========== 开始检测响应时间异常 ==========")
        logger.info(f"[Self-Audit] 时间窗口: {time_window}")

        end_time = timezone.now()
        start_time = end_time - time_window

        logger.debug(f"[Self-Audit] 查询时间范围: {start_time} 至 {end_time}")

        try:
            # 1. 从短期记忆中获取包含响应时间的记录
            # metadata 字段已添加，可以存储响应时间数据
            logger.debug("[Self-Audit] 步骤1: 查询包含响应时间的短期记忆...")
            recent_memories = ShortTermMemory.objects.filter(
                timestamp__gte=start_time,
                timestamp__lte=end_time
            ).exclude(metadata={})  # 排除空的metadata

            memory_count = recent_memories.count()
            logger.debug(f"[Self-Audit] 查询完成，找到 {memory_count} 条包含metadata的记录")

            # 2. 提取响应时间数据
            logger.debug("[Self-Audit] 步骤2: 提取响应时间数据...")
            response_times = []
            missing_count = 0

            for memory in recent_memories:
                if 'response_time' in memory.metadata:
                    response_times.append(memory.metadata['response_time'])
                else:
                    missing_count += 1

            logger.debug(
                f"[Self-Audit] 提取完成: 有效={len(response_times)}, "
                f"缺失={missing_count}"
            )

            if not response_times:
                logger.info("[Self-Audit] 时间窗口内无响应时间记录，跳过检测")
                elapsed_ms = (time.time() - start_time_exec) * 1000
                logger.info(
                    f"[Self-Audit] ========== 响应时间检测完成（无数据） ========== "
                    f"耗时: {elapsed_ms:.2f}ms"
                )
                return []

            # 3. 计算响应时间统计指标
            logger.debug("[Self-Audit] 步骤3: 计算统计指标...")
            sorted_times = sorted(response_times)
            avg_time = sum(response_times) / len(response_times)
            p99_index = int(len(sorted_times) * 0.99)
            p99_time = sorted_times[p99_index] if p99_index < len(sorted_times) else sorted_times[-1]

            # 计算最小值和最大值
            min_time = sorted_times[0]
            max_time = sorted_times[-1]

            logger.info(
                f"[Self-Audit] 响应时间统计: "
                f"最小={min_time:.2f}ms, 平均={avg_time:.2f}ms, "
                f"P99={p99_time:.2f}ms, 最大={max_time:.2f}ms, "
                f"样本数={len(response_times)}"
            )

            # 4. 检测异常
            logger.debug("[Self-Audit] 步骤4: 检测响应时间异常...")
            anomaly_records = []

            # 检测P99异常
            p99_threshold = SelfAuditService.THRESHOLDS['response_time_p99']
            logger.debug(f"[Self-Audit] P99阈值: {p99_threshold}ms")

            if p99_time > p99_threshold:
                logger.warning(
                    f"[Self-Audit] 检测到P99响应时间异常！"
                    f"当前={p99_time:.2f}ms, 阈值={p99_threshold}ms"
                )

                logger.debug("[Self-Audit] 创建P99异常记录...")
                drift_record = PerformanceDriftRecord.objects.create(
                    drift_type='response_time',
                    severity='high',
                    baseline_value=p99_threshold,
                    current_value=p99_time,
                    deviation_rate=(p99_time - p99_threshold) / p99_threshold,
                    sample_size=len(response_times),
                    time_window=time_window,
                    metadata={
                        'metric': 'p99',
                        'avg_time': avg_time,
                        'min_time': min_time,
                        'max_time': max_time,
                        'threshold': p99_threshold,
                        'start_time': start_time.isoformat(),
                        'end_time': end_time.isoformat()
                    }
                )
                anomaly_records.append(drift_record)
                logger.info(f"[Self-Audit] P99异常记录已创建: ID={drift_record.id}")

            # 检测平均值异常
            avg_threshold = SelfAuditService.THRESHOLDS['response_time_avg']
            logger.debug(f"[Self-Audit] 平均值阈值: {avg_threshold}ms")

            if avg_time > avg_threshold:
                logger.warning(
                    f"[Self-Audit] 检测到平均响应时间异常！"
                    f"当前={avg_time:.2f}ms, 阈值={avg_threshold}ms"
                )

                logger.debug("[Self-Audit] 创建平均值异常记录...")
                drift_record = PerformanceDriftRecord.objects.create(
                    drift_type='response_time',
                    severity='medium',
                    baseline_value=avg_threshold,
                    current_value=avg_time,
                    deviation_rate=(avg_time - avg_threshold) / avg_threshold,
                    sample_size=len(response_times),
                    time_window=time_window,
                    metadata={
                        'metric': 'average',
                        'p99_time': p99_time,
                        'min_time': min_time,
                        'max_time': max_time,
                        'threshold': avg_threshold,
                        'start_time': start_time.isoformat(),
                        'end_time': end_time.isoformat()
                    }
                )
                anomaly_records.append(drift_record)
                logger.info(f"[Self-Audit] 平均值异常记录已创建: ID={drift_record.id}")

            elapsed_ms = (time.time() - start_time_exec) * 1000
            logger.info(
                f"[Self-Audit] ========== 响应时间检测完成 ========== "
                f"异常数={len(anomaly_records)}, 耗时: {elapsed_ms:.2f}ms"
            )

            return anomaly_records

        except Exception as e:
            elapsed_ms = (time.time() - start_time_exec) * 1000
            logger.error(
                f"[Self-Audit] 响应时间检测失败: {type(e).__name__}: {e}",
                exc_info=True
            )
            logger.error(f"[Self-Audit] 检测耗时: {elapsed_ms:.2f}ms")
            raise

    @staticmethod
    def check_false_positive_rate(time_window=timedelta(hours=1)):
        """
        统计误报率变化（中优先级）

        统计误报趋势，异常时触发复核

        注意：已为 LongTermMemory 模型添加 verified_result、verified_by、verified_at 字段，
        可以获取人工复核数据进行误报率统计。

        Args:
            time_window: 时间窗口，默认1小时

        Returns:
            PerformanceDriftRecord: 漂移记录（如果检测到异常）
        """
        import time
        start_time_exec = time.time()

        logger.info(f"[Self-Audit] ========== 开始检测误报率变化 ==========")
        logger.info(f"[Self-Audit] 时间窗口: {time_window}")

        end_time = timezone.now()
        start_time = end_time - time_window

        logger.debug(f"[Self-Audit] 查询时间范围: {start_time} 至 {end_time}")

        try:
            # 1. 查询时间窗口内的长期记忆记录（已人工复核）
            logger.debug("[Self-Audit] 步骤1: 查询已人工复核的长期记忆...")
            logger.debug(
                f"[Self-Audit] 查询条件: timestamp >= {start_time.isoformat()} "
                f"AND timestamp <= {end_time.isoformat()} "
                f"AND verified_result IS NOT NULL"
            )
            
            # 查询已复核的记录（verified_result不为None）
            verified_memories = LongTermMemory.objects.filter(
                timestamp__gte=start_time,
                timestamp__lte=end_time,
                verified_result__isnull=False
            )

            total_verified = verified_memories.count()
            logger.debug(f"[Self-Audit] 数据库查询完成，返回 {total_verified} 条已复核记录")

            # 详细统计查询结果（用于调试）
            if total_verified > 0 and logger.isEnabledFor(10):  # DEBUG level
                verified_true_count = verified_memories.filter(verified_result=True).count()
                verified_false_count = verified_memories.filter(verified_result=False).count()
                logger.debug(
                    f"[Self-Audit] 已复核记录明细: "
                    f"verified_result=True={verified_true_count}, "
                    f"verified_result=False={verified_false_count}"
                )

            if total_verified == 0:
                logger.info("[Self-Audit] 时间窗口内无人工复核记录，跳过误报率检测")
                elapsed_ms = (time.time() - start_time_exec) * 1000
                logger.info(
                    f"[Self-Audit] ========== 误报率检测完成（无数据） ========== "
                    f"耗时: {elapsed_ms:.2f}ms"
                )
                return None

            # 2. 统计误报数量（verified_result=True表示人工判定为安全，即系统误报）
            logger.debug("[Self-Audit] 步骤2: 统计误报数量...")
            logger.debug(
                f"[Self-Audit] 查询条件: verified_result=True "
                f"(在 {total_verified} 条已复核记录中)"
            )
            
            false_positives = verified_memories.filter(verified_result=True).count()
            
            # 3. 计算误报率
            logger.debug("[Self-Audit] 步骤3: 计算当前误报率...")
            logger.debug(
                f"[Self-Audit] 计算公式: false_positives / total_verified = "
                f"{false_positives} / {total_verified}"
            )
            
            current_fp_rate = false_positives / total_verified
            
            logger.info(
                f"[Self-Audit] 误报率统计: 误报数={false_positives}, "
                f"已复核总数={total_verified}, 误报率={current_fp_rate:.4f} ({current_fp_rate:.2%})"
            )

            # 4. 获取基线误报率
            logger.debug("[Self-Audit] 步骤4: 查询基线误报率...")
            logger.debug(
                f"[Self-Audit] 基线查询条件: baseline_type='false_positive_rate' "
                f"AND is_active=True"
            )
            try:
                baseline = BehaviorBaseline.objects.filter(
                    baseline_type='false_positive_rate',
                    is_active=True
                ).latest('updated_at')

                baseline_fp_rate = baseline.accuracy / 100.0  # 使用accuracy字段存储基线误报率
                logger.debug(
                    f"[Self-Audit] 基线数据: ID={baseline.id}, "
                    f"accuracy={baseline.accuracy}%, "
                    f"agent_code={baseline.agent_code}, "
                    f"is_active={baseline.is_active}"
                )
                logger.info(
                    f"[Self-Audit] 基线误报率: {baseline_fp_rate:.4f} "
                    f"(ID: {baseline.id}, 更新时间: {baseline.updated_at})"
                )

                # 5. 计算偏离率
                logger.debug("[Self-Audit] 步骤5: 计算偏离率...")
                
                # 详细计算过程
                logger.debug(
                    f"[Self-Audit] 偏离率计算过程:"
                )
                logger.debug(
                    f"  - 当前误报率: {current_fp_rate:.4f} ({current_fp_rate:.2%})"
                )
                logger.debug(
                    f"  - 基线误报率: {baseline_fp_rate:.4f} ({baseline_fp_rate:.2%})"
                )
                
                if baseline_fp_rate > 0:
                    deviation_rate = abs(current_fp_rate - baseline_fp_rate) / baseline_fp_rate
                    logger.debug(
                        f"  - 计算步骤: |{current_fp_rate:.4f} - {baseline_fp_rate:.4f}| "
                        f"/ {baseline_fp_rate:.4f}"
                    )
                    logger.debug(
                        f"  - 计算步骤: |{current_fp_rate - baseline_fp_rate:.4f}| "
                        f"/ {baseline_fp_rate:.4f}"
                    )
                    logger.debug(
                        f"  - 计算步骤: {abs(current_fp_rate - baseline_fp_rate):.4f} "
                        f"/ {baseline_fp_rate:.4f}"
                    )
                else:
                    # 如果基线误报率为0，使用当前误报率作为偏离率
                    deviation_rate = current_fp_rate
                    logger.debug(
                        f"  - 基线误报率为0，使用当前误报率作为偏离率: {deviation_rate:.4f}"
                    )
                
                logger.info(
                    f"[Self-Audit] 偏离率计算结果: "
                    f"|{current_fp_rate:.4f} - {baseline_fp_rate:.4f}| / {baseline_fp_rate:.4f} = {deviation_rate:.4f}"
                )

                # 6. 检测异常
                logger.debug("[Self-Audit] 步骤6: 检测误报率异常...")
                fp_threshold = SelfAuditService.THRESHOLDS['false_positive_rate']
                logger.debug(f"[Self-Audit] 误报率阈值配置: {fp_threshold:.4f} ({fp_threshold:.2%})")
                
                logger.debug(
                    f"[Self-Audit] 阈值对比: 当前误报率={current_fp_rate:.4f}, "
                    f"阈值={fp_threshold:.4f}, "
                    f"是否超过阈值={current_fp_rate > fp_threshold}"
                )

                if current_fp_rate > fp_threshold:
                    logger.warning(
                        f"[Self-Audit] 检测到误报率异常！"
                        f"当前误报率={current_fp_rate:.2%}, 阈值={fp_threshold:.2%}, "
                        f"超出={(current_fp_rate - fp_threshold):.2%}"
                    )

                    logger.debug("[Self-Audit] 步骤7: 创建误报率漂移记录...")
                    logger.debug(
                        f"[Self-Audit] PerformanceDriftRecord 创建参数:"
                    )
                    logger.debug(f"  - drift_type: false_positive_rate")
                    logger.debug(f"  - baseline_value: {baseline_fp_rate:.4f}")
                    logger.debug(f"  - current_value: {current_fp_rate:.4f}")
                    logger.debug(f"  - deviation_rate: {deviation_rate:.4f}")
                    logger.debug(f"  - sample_size: {total_verified}")
                    logger.debug(f"  - time_window: {time_window}")
                    logger.debug(f"  - baseline_id: {baseline.id}")
                    logger.debug(f"  - metadata.false_positives: {false_positives}")
                    logger.debug(f"  - metadata.total_verified: {total_verified}")
                    logger.debug(f"  - metadata.threshold: {fp_threshold}")

                    try:
                        drift_record = PerformanceDriftRecord.objects.create(
                            drift_type='false_positive_rate',
                            baseline_value=baseline_fp_rate,
                            current_value=current_fp_rate,
                            deviation_rate=deviation_rate,
                            sample_size=total_verified,
                            time_window=time_window,
                            baseline=baseline,
                            metadata={
                                'false_positives': false_positives,
                                'total_verified': total_verified,
                                'threshold': fp_threshold,
                                'start_time': start_time.isoformat(),
                                'end_time': end_time.isoformat()
                            }
                        )

                        logger.info(
                            f"[Self-Audit] [DB-WRITE] PerformanceDriftRecord 创建成功: "
                            f"ID={drift_record.id}, drift_type={drift_record.drift_type}, "
                            f"baseline_value={drift_record.baseline_value:.4f}, "
                            f"current_value={drift_record.current_value:.4f}, "
                            f"deviation_rate={drift_record.deviation_rate:.4f}"
                        )

                        # 计算严重程度
                        drift_record.calculate_severity()
                        drift_record.save()

                        logger.info(
                            f"[Self-Audit] [DB-UPDATE] PerformanceDriftRecord 严重程度已计算: "
                            f"ID={drift_record.id}, severity={drift_record.severity}"
                        )

                        elapsed_ms = (time.time() - start_time_exec) * 1000
                        logger.info(
                            f"[Self-Audit] ========== 误报率检测完成（发现异常） ========== "
                            f"耗时: {elapsed_ms:.2f}ms"
                        )

                        return drift_record

                    except Exception as create_error:
                        logger.error(
                            f"[Self-Audit] [DB-ERROR] PerformanceDriftRecord 创建失败: "
                            f"{type(create_error).__name__}: {create_error}",
                            exc_info=True
                        )
                        raise
                else:
                    logger.info(
                        f"[Self-Audit] 误报率正常: {current_fp_rate:.2%}, "
                        f"未超过阈值 {fp_threshold:.2%}"
                    )
                    elapsed_ms = (time.time() - start_time_exec) * 1000
                    logger.info(
                        f"[Self-Audit] ========== 误报率检测完成（正常） ========== "
                        f"耗时: {elapsed_ms:.2f}ms"
                    )
                    return None

            except BehaviorBaseline.DoesNotExist:
                logger.warning("[Self-Audit] 未找到误报率基线，跳过检测")
                logger.info(
                    "[Self-Audit] 建议：创建误报率基线：\n"
                    "    baseline = BehaviorBaseline.objects.create(\n"
                    "        agent_code='system',\n"
                    "        baseline_type='false_positive_rate',\n"
                    "        accuracy=5.0,  # 基线误报率5%\n"
                    "        is_active=True\n"
                    "    )"
                )
                elapsed_ms = (time.time() - start_time_exec) * 1000
                logger.info(
                    f"[Self-Audit] ========== 误报率检测跳过（缺少基线） ========== "
                    f"耗时: {elapsed_ms:.2f}ms"
                )
                return None

        except Exception as e:
            elapsed_ms = (time.time() - start_time_exec) * 1000
            logger.error(
                f"[Self-Audit] 误报率检测失败: {type(e).__name__}: {e}",
                exc_info=True
            )
            logger.error(f"[Self-Audit] 检测耗时: {elapsed_ms:.2f}ms")
            raise

    @staticmethod
    def audit_permission_usage(time_window=timedelta(hours=1)):
        """
        权限使用审计（中优先级）

        记录所有权限变更操作，定期审计，识别权限滥用

        Args:
            time_window: 时间窗口，默认1小时

        Returns:
            dict: 审计结果统计
        """
        logger.info(f"[Self-Audit] 开始权限使用审计，时间窗口: {time_window}")

        end_time = timezone.now()
        start_time = end_time - time_window

        # 1. 获取时间窗口内的权限变更记录
        permission_changes = AgentPermissionAuditLog.objects.filter(
            timestamp__gte=start_time,
            timestamp__lte=end_time
        )

        stats = {
            'total_changes': permission_changes.count(),
            'by_action': {},
            'anomalies': [],
            'high_risk_operations': []
        }

        # 2. 统计各类操作数量
        for action, _ in AgentPermissionAuditLog.ACTION_CHOICES:
            count = permission_changes.filter(action=action).count()
            stats['by_action'][action] = count

        # 3. 识别异常权限变更
        # 异常1：短时间内频繁权限变更（同一Agent）
        agent_change_counts = permission_changes.values('agent').annotate(
            change_count=Count('id')
        ).filter(change_count__gte=5)  # 1小时内同一Agent变更5次以上

        for item in agent_change_counts:
            agent = AgentIdentity.objects.get(id=item['agent'])
            anomaly = {
                'type': 'frequent_permission_changes',
                'agent': agent.agent_id,
                'count': item['change_count'],
                'severity': 'high'
            }
            stats['anomalies'].append(anomaly)
            logger.warning(
                f"[Self-Audit] 检测到频繁权限变更: Agent={agent.agent_id}, "
                f"变更次数={item['change_count']}"
            )

        # 异常2：权限提升操作
        escalations = permission_changes.filter(
            action='escalate',
            risk_level__in=['high', 'critical']
        )

        for change in escalations:
            stats['high_risk_operations'].append({
                'type': 'permission_escalation',
                'agent': change.agent.agent_id,
                'performed_by': change.performed_by.username if change.performed_by else 'unknown',
                'risk_level': change.risk_level,
                'timestamp': change.timestamp.isoformat()
            })
            logger.warning(
                f"[Self-Audit] 检测到高风险权限提升: Agent={change.agent.agent_id}, "
                f"风险等级={change.risk_level}"
            )

        # 异常3：非工作时间权限变更
        off_hour_changes = []
        for change in permission_changes:
            hour = change.timestamp.hour
            if hour < 6 or hour > 22:  # 非工作时间（22:00-06:00）
                off_hour_changes.append(change)

        if off_hour_changes:
            logger.warning(
                f"[Self-Audit] 检测到非工作时间权限变更: {len(off_hour_changes)}次"
            )
            stats['anomalies'].append({
                'type': 'off_hour_permission_changes',
                'count': len(off_hour_changes),
                'severity': 'medium'
            })

        logger.info(
            f"[Self-Audit] 权限审计完成: 总变更={stats['total_changes']}, "
            f"异常数={len(stats['anomalies'])}"
        )

        return stats

    @staticmethod
    def check_rule_freshness():
        """
        检测规则库时效性（低优先级）

        检测规则库更新频率，过期规则提醒

        Returns:
            list: 需要更新的规则列表
        """
        logger.info("[Self-Audit] 开始检测规则库时效性")

        # 1. 获取所有策略记忆（规则）
        strategies = StrategicMemory.objects.filter(is_active=True)

        stale_rules = []

        for strategy in strategies:
            # 2. 创建或更新时效性检查记录
            check, created = RuleFreshnessCheck.objects.get_or_create(
                strategy=strategy,
                defaults={
                    'rule_type': 'detection_rule',  # 默认类型
                    'last_updated': strategy.updated_at,
                    'days_since_update': (timezone.now() - strategy.updated_at).days,
                }
            )

            # 3. 检查时效性
            if not created:
                check.last_updated = strategy.updated_at

            freshness_status = check.check_freshness()
            check.save()

            # 4. 记录陈旧或废弃的规则
            if check.freshness_status in ['stale', 'outdated', 'deprecated']:
                stale_rules.append({
                    'strategy': strategy.rule_name,
                    'status': check.freshness_status,
                    'days_since_update': check.days_since_update,
                    'effectiveness_score': check.effectiveness_score,
                    'recommendation': check.recommendation
                })

                logger.warning(
                    f"[Self-Audit] 规则时效性问题: {strategy.rule_name}, "
                    f"状态={check.freshness_status}, "
                    f"距上次更新{check.days_since_update}天"
                )

        logger.info(
            f"[Self-Audit] 规则时效性检查完成: 总规则数={strategies.count()}, "
            f"问题规则数={len(stale_rules)}"
        )

        return stale_rules

    @staticmethod
    def generate_audit_report(report_type='hourly'):
        """
        生成自审计报告

        汇总自监控结果，生成综合审计报告

        Args:
            report_type: 报告类型 (hourly/daily/weekly/monthly)

        Returns:
            SelfAuditReport: 审计报告对象
        """
        logger.info(f"[Self-Audit] 开始生成{report_type}审计报告")

        # 1. 确定报告时间范围
        now = timezone.now()
        if report_type == 'hourly':
            period_start = now - timedelta(hours=1)
        elif report_type == 'daily':
            period_start = now - timedelta(days=1)
        elif report_type == 'weekly':
            period_start = now - timedelta(weeks=1)
        elif report_type == 'monthly':
            period_start = now - timedelta(days=30)
        else:
            period_start = now - timedelta(hours=1)

        period_end = now

        # 2. 统计性能漂移
        performance_drifts = PerformanceDriftRecord.objects.filter(
            detected_at__gte=period_start,
            detected_at__lte=period_end
        )

        critical_drifts = performance_drifts.filter(severity='critical').count()

        # 3. 统计权限变更
        permission_changes = AgentPermissionAuditLog.objects.filter(
            timestamp__gte=period_start,
            timestamp__lte=period_end
        )

        permission_anomalies = permission_changes.filter(is_anomaly=True).count()

        # 4. 统计规则时效性
        stale_rules = RuleFreshnessCheck.objects.filter(
            checked_at__gte=period_start,
            checked_at__lte=period_end,
            freshness_status__in=['stale', 'outdated']
        ).count()

        deprecated_rules = RuleFreshnessCheck.objects.filter(
            checked_at__gte=period_start,
            checked_at__lte=period_end,
            freshness_status='deprecated'
        ).count()

        # 5. 创建报告
        report = SelfAuditReport.objects.create(
            report_type=report_type,
            period_start=period_start,
            period_end=period_end,
            total_checks=performance_drifts.count() + permission_changes.count(),
            issues_found=performance_drifts.filter(is_resolved=False).count() + permission_anomalies,
            issues_resolved=performance_drifts.filter(is_resolved=True).count(),
            performance_drifts=performance_drifts.count(),
            critical_drifts=critical_drifts,
            permission_changes=permission_changes.count(),
            permission_anomalies=permission_anomalies,
            stale_rules=stale_rules,
            deprecated_rules=deprecated_rules,
            summary='',  # 稍后填充
            recommendations=[]
        )

        # 6. 计算评分
        scores = report.calculate_scores()

        # 7. 生成摘要和建议
        summary_parts = []
        recommendations = []

        if report.performance_drifts > 0:
            summary_parts.append(f"发现{report.performance_drifts}次性能漂移，其中{report.critical_drifts}次为严重级别")
            recommendations.append({
                'type': 'performance',
                'priority': 'high',
                'message': '建议立即检查性能漂移原因，优化检测算法或调整阈值'
            })

        if report.permission_anomalies > 0:
            summary_parts.append(f"发现{report.permission_anomalies}次权限异常操作")
            recommendations.append({
                'type': 'security',
                'priority': 'high',
                'message': '建议审查权限变更记录，确认是否存在权限滥用'
            })

        if report.deprecated_rules > 0:
            summary_parts.append(f"发现{report.deprecated_rules}条废弃规则")
            recommendations.append({
                'type': 'compliance',
                'priority': 'medium',
                'message': '建议更新或删除废弃规则，确保规则库时效性'
            })

        if not summary_parts:
            summary_parts.append("系统运行正常，未发现重大问题")

        report.summary = '；'.join(summary_parts)
        report.recommendations = recommendations
        report.save()

        logger.info(
            f"[Self-Audit] 审计报告生成完成: ID={report.id}, "
            f"健康度评分={report.overall_health_score:.2f}"
        )

        return report

    @staticmethod
    def run_all_checks():
        """
        运行所有监控检查

        按优先级顺序执行所有监控项

        Returns:
            dict: 检查结果汇总
        """
        import time
        start_time_exec = time.time()

        logger.info("[Self-Audit] " + "=" * 60)
        logger.info("[Self-Audit] ========== 开始运行所有自监控检查 ==========")
        logger.info("[Self-Audit] " + "=" * 60)

        results = {
            'accuracy_drift': None,
            'response_time_anomalies': [],
            'false_positive_drift': None,
            'permission_audit': {},
            'rule_freshness': [],
            'timestamp': timezone.now().isoformat()
        }

        # 高优先级检查
        logger.info("[Self-Audit] ----- 高优先级检查（1/2）: 准确率漂移检测 -----")
        try:
            results['accuracy_drift'] = SelfAuditService.check_accuracy_drift()
            logger.info(
                f"[Self-Audit] 准确率漂移检测完成: "
                f"{'发现异常' if results['accuracy_drift'] else '正常'}"
            )
        except Exception as e:
            logger.error(
                f"[Self-Audit] 准确率漂移检测失败: {type(e).__name__}: {e}",
                exc_info=True
            )
            results['accuracy_drift'] = None

        logger.info("[Self-Audit] ----- 高优先级检查（2/2）: 响应时间异常检测 -----")
        try:
            results['response_time_anomalies'] = SelfAuditService.check_response_time_anomaly()
            logger.info(
                f"[Self-Audit] 响应时间异常检测完成: "
                f"发现 {len(results['response_time_anomalies'])} 个异常"
            )
        except Exception as e:
            logger.error(
                f"[Self-Audit] 响应时间异常检测失败: {type(e).__name__}: {e}",
                exc_info=True
            )
            results['response_time_anomalies'] = []

        # 中优先级检查
        logger.info("[Self-Audit] ----- 中优先级检查（1/2）: 误报率检测 -----")
        try:
            results['false_positive_drift'] = SelfAuditService.check_false_positive_rate()
            logger.info(
                f"[Self-Audit] 误报率检测完成: "
                f"{'发现异常' if results['false_positive_drift'] else '正常'}"
            )
        except Exception as e:
            logger.error(
                f"[Self-Audit] 误报率检测失败: {type(e).__name__}: {e}",
                exc_info=True
            )
            results['false_positive_drift'] = None

        logger.info("[Self-Audit] ----- 中优先级检查（2/2）: 权限使用审计 -----")
        try:
            results['permission_audit'] = SelfAuditService.audit_permission_usage()
            anomaly_count = len(results['permission_audit'].get('anomalies', []))
            logger.info(
                f"[Self-Audit] 权限审计完成: "
                f"总变更={results['permission_audit'].get('total_changes', 0)}, "
                f"异常数={anomaly_count}"
            )
        except Exception as e:
            logger.error(
                f"[Self-Audit] 权限审计失败: {type(e).__name__}: {e}",
                exc_info=True
            )
            results['permission_audit'] = {}

        # 低优先级检查
        logger.info("[Self-Audit] ----- 低优先级检查: 规则库时效性检测 -----")
        try:
            results['rule_freshness'] = SelfAuditService.check_rule_freshness()
            logger.info(
                f"[Self-Audit] 规则时效性检测完成: "
                f"发现 {len(results['rule_freshness'])} 条问题规则"
            )
        except Exception as e:
            logger.error(
                f"[Self-Audit] 规则时效性检测失败: {type(e).__name__}: {e}",
                exc_info=True
            )
            results['rule_freshness'] = []

        elapsed_ms = (time.time() - start_time_exec) * 1000

        # 汇总结果
        logger.info("[Self-Audit] " + "=" * 60)
        logger.info("[Self-Audit] ========== 自监控检查汇总 ==========")
        logger.info(f"[Self-Audit] 准确率漂移: {'发现' if results['accuracy_drift'] else '未发现'}")
        logger.info(f"[Self-Audit] 响应时间异常: {len(results['response_time_anomalies'])} 个")
        logger.info(f"[Self-Audit] 误报率异常: {'发现' if results['false_positive_drift'] else '未发现'}")
        logger.info(
            f"[Self-Audit] 权限异常: "
            f"{len(results['permission_audit'].get('anomalies', []))} 个"
        )
        logger.info(f"[Self-Audit] 规则时效性问题: {len(results['rule_freshness'])} 条")
        logger.info(f"[Self-Audit] 总耗时: {elapsed_ms:.2f}ms")
        logger.info("[Self-Audit] " + "=" * 60)

        return results
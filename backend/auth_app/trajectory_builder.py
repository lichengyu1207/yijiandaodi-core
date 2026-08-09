"""
轨迹构建服务

自动将AgentActivityLog聚合成BehaviorTrajectory
"""

import logging
import time
import json
from datetime import timedelta
from typing import Optional
from django.db import transaction
from django.utils import timezone

from .trajectory_models import BehaviorTrajectory, TrajectoryArchive
from .agent_activity_models import AgentActivityLog
from .trajectory_logger import get_trajectory_logger, LogFields

# 使用结构化日志记录器
logger = get_trajectory_logger()


class TrajectoryBuilder:
    """
    轨迹构建器

    功能：
    1. 自动将AgentActivityLog追加到对应的BehaviorTrajectory
    2. 实时更新链路风险分数
    3. 检测异常模式并打标
    """

    # 轨迹超时时间（秒）- 超过此时间未活动则认为会话结束
    TRAJECTORY_TIMEOUT = 3600  # 1小时

    @classmethod
    def build_or_update_trajectory(cls, activity_log: AgentActivityLog) -> Optional[BehaviorTrajectory]:
        """
        构建或更新轨迹

        Args:
            activity_log: 新的Agent活动日志

        Returns:
            BehaviorTrajectory实例或None
        """
        start_time = time.time()
        trajectory_id = f"traj_{activity_log.session_id}"

        try:
            logger.info(
                "开始构建轨迹",
                **{
                    LogFields.TRAJECTORY_ID: trajectory_id,
                    LogFields.SESSION_ID: activity_log.session_id,
                    LogFields.ACTIVITY_ID: activity_log.activity_id,
                    LogFields.CLIENT_ID: activity_log.client_id,
                }
            )

            with transaction.atomic():
                # 步骤1: 查询现有轨迹
                step1_start = time.time()
                trajectory = BehaviorTrajectory.objects.filter(
                    trajectory_id=trajectory_id
                ).first()
                step1_duration = (time.time() - step1_start) * 1000

                logger.debug(
                    "步骤1-查询轨迹完成",
                    **{
                        LogFields.STEP1_QUERY_MS: round(step1_duration, 2),
                        'trajectory_exists': trajectory is not None,
                    }
                )

                if not trajectory:
                    # 创建新轨迹
                    step2_start = time.time()
                    trajectory = BehaviorTrajectory(
                        trajectory_id=trajectory_id,
                        session_id=activity_log.session_id,
                        client_id=activity_log.client_id,
                        start_time=activity_log.timestamp,
                        end_time=activity_log.timestamp,
                        behavior_chain=[],
                        agent_types={},
                        action_types={},
                        taint_flows=[],
                        anomaly_flags=[],
                    )
                    step2_duration = (time.time() - step2_start) * 1000

                    logger.info(
                        "步骤2-创建新轨迹完成",
                        **{
                            LogFields.STEP2_CREATE_MS: round(step2_duration, 2),
                            LogFields.TRAJECTORY_ID: trajectory_id,
                        }
                    )

                # 步骤3: 添加活动到轨迹
                step3_start = time.time()
                trajectory.add_activity(activity_log)
                step3_duration = (time.time() - step3_start) * 1000

                logger.debug(
                    "步骤3-添加活动完成",
                    **{
                        LogFields.STEP3_ADD_MS: round(step3_duration, 2),
                        LogFields.TOTAL_ACTIVITIES: trajectory.total_activities,
                    }
                )

                # 步骤4: 计算链路风险
                step4_start = time.time()
                trajectory.chain_risk_score = trajectory.calculate_chain_risk()
                step4_duration = (time.time() - step4_start) * 1000

                logger.info(
                    "步骤4-计算链路风险完成",
                    **{
                        LogFields.STEP4_CALCULATE_MS: round(step4_duration, 2),
                        LogFields.CHAIN_RISK_SCORE: round(trajectory.chain_risk_score, 1),
                        LogFields.ANOMALY_FLAGS: trajectory.anomaly_flags,
                    }
                )

                # 步骤5: 保存轨迹
                step5_start = time.time()
                trajectory.save()
                step5_duration = (time.time() - step5_start) * 1000

                logger.debug(
                    "步骤5-保存轨迹完成",
                    **{
                        LogFields.STEP5_SAVE_MS: round(step5_duration, 2),
                        LogFields.TRAJECTORY_ID: trajectory.trajectory_id,
                    }
                )

            total_duration = (time.time() - start_time) * 1000

            # 使用性能日志方法（自动判断是否警告）
            # 注意：duration_ms已在位置参数中传递，不需要在kwargs中重复
            logger.log_performance(
                "轨迹构建完成",
                total_duration,  # 作为位置参数传递
                threshold_ms=100.0,
                **{
                    LogFields.TRAJECTORY_ID: trajectory_id,
                    LogFields.TOTAL_ACTIVITIES: trajectory.total_activities,
                    LogFields.CHAIN_RISK_SCORE: round(trajectory.chain_risk_score, 1),
                    # LogFields.DURATION_MS已移除，避免与位置参数冲突
                }
            )

            return trajectory

        except Exception as e:
            total_duration = (time.time() - start_time) * 1000
            logger.error(
                "构建轨迹失败",
                **{
                    LogFields.DURATION_MS: round(total_duration, 2),
                    LogFields.TRAJECTORY_ID: trajectory_id,
                    'error': str(e),
                    'error_type': type(e).__name__,
                }
            )
            return None

    @classmethod
    def archive_old_trajectories(cls, days: int = 7) -> int:
        """
        归档旧轨迹

        Args:
            days: 超过多少天的轨迹需要归档

        Returns:
            归档的轨迹数量
        """
        start_time = time.time()
        cutoff_date = timezone.now() - timedelta(days=days)

        logger.info(
            "开始归档旧轨迹",
            **{
                'cutoff_days': days,
                'cutoff_date': cutoff_date.isoformat(),
            }
        )

        # 步骤1: 查询需要归档的轨迹
        step1_start = time.time()
        old_trajectories_query = BehaviorTrajectory.objects.filter(
            end_time__lt=cutoff_date,
            status='active'
        )
        step1_duration = (time.time() - step1_start) * 1000

        # 获取总数（不执行查询）
        total_count = old_trajectories_query.count()

        logger.info(
            "步骤1-查询待归档轨迹完成",
            **{
                LogFields.DURATION_MS: round(step1_duration, 2),
                'total_to_archive': total_count,
                'query_type': 'filter_and_count',
            }
        )

        if total_count == 0:
            logger.info("无需归档的轨迹")
            return 0

        # 步骤2: 批量归档
        archived_count = 0
        failed_count = 0

        # 性能统计
        total_create_duration = 0.0
        total_delete_duration = 0.0
        total_json_serialize_duration = 0.0

        # 批量处理（每批100条）
        batch_size = 100
        batch_num = 0

        logger.info(
            "开始批量归档",
            **{
                'total_count': total_count,
                'batch_size': batch_size,
                'estimated_batches': (total_count // batch_size) + 1,
            }
        )

        # 获取所有轨迹（惰性查询）
        old_trajectories = old_trajectories_query.all()

        for trajectory in old_trajectories:
            try:
                archive_start = time.time()

                # 步骤2.1: JSON序列化（耗时操作）
                json_start = time.time()
                trajectory_data = {
                    'trajectory_id': trajectory.trajectory_id,
                    'session_id': trajectory.session_id,
                    'client_id': trajectory.client_id,
                    'behavior_chain': trajectory.behavior_chain,
                    'chain_risk_score': trajectory.chain_risk_score,
                    'anomaly_flags': trajectory.anomaly_flags,
                    'start_time': trajectory.start_time,
                    'end_time': trajectory.end_time,
                    'duration_seconds': trajectory.duration_seconds,
                    'total_activities': trajectory.total_activities,
                    'high_risk_count': trajectory.high_risk_count,
                    'critical_count': trajectory.critical_count,
                    'agent_types': trajectory.agent_types,
                    'action_types': trajectory.action_types,
                    'taint_flows': trajectory.taint_flows,
                }
                json_duration = (time.time() - json_start) * 1000
                total_json_serialize_duration += json_duration

                # 步骤2.2: 创建归档记录（INSERT操作）
                create_start = time.time()
                TrajectoryArchive.objects.create(**trajectory_data)
                create_duration = (time.time() - create_start) * 1000
                total_create_duration += create_duration

                # 步骤2.3: 删除原记录（DELETE操作）
                delete_start = time.time()
                trajectory.delete()
                delete_duration = (time.time() - delete_start) * 1000
                total_delete_duration += delete_duration

                archive_duration = (time.time() - archive_start) * 1000
                archived_count += 1

                # 每10条或最后一条记录详细日志
                if archived_count % 10 == 0 or archived_count == total_count:
                    logger.debug(
                        "归档轨迹完成",
                        **{
                            LogFields.TRAJECTORY_ID: trajectory.trajectory_id,
                            LogFields.DURATION_MS: round(archive_duration, 2),
                            'json_serialize_ms': round(json_duration, 2),
                            'db_create_ms': round(create_duration, 2),
                            'db_delete_ms': round(delete_duration, 2),
                            'progress': f"{archived_count}/{total_count}",
                            'progress_percent': round(archived_count / total_count * 100, 1),
                        }
                    )

                # 批次进度日志
                if archived_count % batch_size == 0:
                    batch_num += 1
                    batch_duration = (time.time() - start_time) * 1000

                    logger.info(
                        "批次归档完成",
                        **{
                            'batch_num': batch_num,
                            'batch_size': batch_size,
                            'archived_count': archived_count,
                            'remaining_count': total_count - archived_count,
                            'batch_duration_ms': round(batch_duration, 2),
                            'avg_per_trajectory_ms': round(batch_duration / archived_count, 2),
                            'accumulated_create_ms': round(total_create_duration, 2),
                            'accumulated_delete_ms': round(total_delete_duration, 2),
                            'accumulated_json_ms': round(total_json_serialize_duration, 2),
                        }
                    )

            except Exception as e:
                failed_count += 1

                logger.error(
                    "归档轨迹失败",
                    **{
                        LogFields.TRAJECTORY_ID: trajectory.trajectory_id,
                        'error': str(e),
                        'error_type': type(e).__name__,
                        'archived_count': archived_count,
                        'failed_count': failed_count,
                    }
                )

        total_duration = (time.time() - start_time) * 1000

        # 计算详细统计
        avg_create_ms = total_create_duration / max(archived_count, 1)
        avg_delete_ms = total_delete_duration / max(archived_count, 1)
        avg_json_ms = total_json_serialize_duration / max(archived_count, 1)

        # 使用性能日志方法（自动判断是否警告）
        logger.log_performance(
            "归档完成",
            total_duration,  # 作为位置参数传递
            threshold_ms=5000.0,
            **{
                LogFields.ARCHIVED_COUNT: archived_count,
                LogFields.FAILED_COUNT: failed_count,
                LogFields.AVG_DURATION_MS: round(total_duration / max(archived_count, 1), 2),
                LogFields.DURATION_MS: round(total_duration, 2),
                # 详细性能拆解
                'total_create_ms': round(total_create_duration, 2),
                'total_delete_ms': round(total_delete_duration, 2),
                'total_json_ms': round(total_json_serialize_duration, 2),
                'avg_create_ms': round(avg_create_ms, 2),
                'avg_delete_ms': round(avg_delete_ms, 2),
                'avg_json_ms': round(avg_json_ms, 2),
                'create_percent': round(total_create_duration / total_duration * 100, 1),
                'delete_percent': round(total_delete_duration / total_duration * 100, 1),
                'json_percent': round(total_json_serialize_duration / total_duration * 100, 1),
            }
        )

        # 性能瓶颈分析
        if avg_create_ms > 50:
            logger.warning(
                "性能瓶颈: INSERT操作过慢",
                **{
                    'avg_create_ms': round(avg_create_ms, 2),
                    'suggestion': '考虑使用bulk_create批量插入',
                }
            )

        if avg_delete_ms > 30:
            logger.warning(
                "性能瓶颈: DELETE操作过慢",
                **{
                    'avg_delete_ms': round(avg_delete_ms, 2),
                    'suggestion': '检查数据库索引或考虑批量删除',
                }
            )

        if avg_json_ms > 20:
            logger.warning(
                "性能瓶颈: JSON序列化过慢",
                **{
                    'avg_json_ms': round(avg_json_ms, 2),
                    'suggestion': 'behavior_chain字段过大，考虑压缩或分表',
                }
            )

        # 磁盘空间检查
        try:
            from .data_cleanup_service import DataCleanupService
            db_path = '/data'  # Django数据库路径
            disk_info = DataCleanupService.check_disk_space(db_path)

            if disk_info:
                logger.info(
                    "归档后磁盘空间状态",
                    **{
                        'free_gb': disk_info.get('free_gb'),
                        'used_percent': disk_info.get('used_percent'),
                        'db_size_mb': disk_info.get('db_size_mb'),
                    }
                )

                # 磁盘空间不足警告
                if disk_info.get('used_percent', 0) > 85:
                    logger.warning(
                        "⚠️ 磁盘空间不足，建议清理数据",
                        **{
                            'free_gb': disk_info.get('free_gb'),
                            'used_percent': disk_info.get('used_percent'),
                            'suggestion': '运行DataCleanupService.cleanup_old_activities()',
                        }
                    )

        except Exception as e:
            logger.error(
                "检查磁盘空间失败",
                **{
                    'error': str(e),
                    'error_type': type(e).__name__,
                }
            )

        return archived_count

    @classmethod
    def get_high_risk_trajectories(cls, limit: int = 10) -> list:
        """
        获取高风险轨迹

        Args:
            limit: 返回数量限制

        Returns:
            高风险轨迹列表
        """
        return list(
            BehaviorTrajectory.objects.filter(
                chain_risk_score__gte=70
            ).order_by('-chain_risk_score')[:limit]
        )

    @classmethod
    def get_trajectory_stats(cls) -> dict:
        """
        获取轨迹统计信息

        Returns:
            统计字典
        """
        total_count = BehaviorTrajectory.objects.count()
        active_count = BehaviorTrajectory.objects.filter(status='active').count()
        high_risk_count = BehaviorTrajectory.objects.filter(chain_risk_score__gte=70).count()
        critical_count = BehaviorTrajectory.objects.filter(chain_risk_score__gte=90).count()

        return {
            'total_trajectories': total_count,
            'active_trajectories': active_count,
            'high_risk_trajectories': high_risk_count,
            'critical_trajectories': critical_count,
        }
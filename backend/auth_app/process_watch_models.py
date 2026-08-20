"""
进程行为监控数据模型

功能：
- 记录漫剧生产工具（剪映/即梦/PR等）的启动、退出与运行时长
- 为“本周在剪映上花费了多少时间”“工具使用频率”等统计提供数据
- 与文件变动、网络请求联动，合并成完整的行为存证

作者：一鉴到底团队
创建时间：2026-08-13
"""

from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class ProcessUsageRecord(models.Model):
    """
    进程使用记录

    每次工具进程的启动→退出 记为一个 session。
    """

    # 基本信息
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='process_usage_records',
        verbose_name='所属用户'
    )

    # 工具信息
    tool_name = models.CharField(
        max_length=100,
        verbose_name='工具名称',
        help_text='如：剪映、即梦、Premiere、CapCut、After Effects'
    )

    process_name = models.CharField(
        max_length=255,
        verbose_name='进程名称',
        help_text='可执行文件名，如 JianyingPro.exe'
    )

    pid = models.IntegerField(
        verbose_name='进程PID',
        help_text='本次会话的进程PID'
    )

    # 会话时间
    session_start = models.DateTimeField(
        verbose_name='会话开始时间',
        help_text='进程启动时间'
    )

    session_end = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='会话结束时间',
        help_text='进程退出时间；为空表示仍在运行'
    )

    duration_seconds = models.IntegerField(
        default=0,
        verbose_name='运行时长(秒)'
    )

    # 关联信息
    related_files = models.JSONField(
        default=list,
        verbose_name='关联文件',
        help_text='会话期间发生的文件操作路径列表'
    )

    has_related_files = models.BooleanField(
        null=True,
        blank=True,
        verbose_name='是否已确定关联文件',
        help_text=(
            'null=尚未确定（文件监控未开启/未采集）；'
            'false=已扫描但确实无文件操作；true=有文件操作'
        )
    )

    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='记录创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'process_usage_records'
        ordering = ['-session_start']
        verbose_name = '进程使用记录'
        verbose_name_plural = '进程使用记录管理'
        indexes = [
            models.Index(fields=['user', '-session_start'], name='idx_pur_user_time'),
            models.Index(fields=['tool_name'], name='idx_pur_tool'),
            models.Index(fields=['user', 'pid'], name='idx_pur_user_pid'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'pid', 'session_start'],
                name='uniq_pur_user_pid_start'
            )
        ]

    def __str__(self):
        return f"{self.tool_name} ({self.process_name}) - {self.duration_seconds}s"

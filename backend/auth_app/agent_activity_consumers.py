"""
Agent活动告警WebSocket消费者

实时推送告警到桌面端客户端
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async
import logging

logger = logging.getLogger(__name__)


class AgentAlertConsumer(AsyncWebsocketConsumer):
    """
    Agent告警WebSocket消费者

    客户端连接：
    ws://localhost:9092/ws/agent-alerts/{client_id}/

    订阅规则：
    - 每个client_id对应一个独立的告警频道
    - 只有匹配client_id的告警才会推送给客户端
    """

    async def connect(self):
        """
        WebSocket连接建立
        """
        # 从URL路径获取client_id
        self.client_id = self.scope['url_route']['kwargs'].get('client_id')

        if not self.client_id:
            logger.error('[WebSocket] 缺少client_id参数')
            await self.close()
            return

        # 构建频道名称
        self.room_group_name = f'agent_alerts_{self.client_id}'

        # 加入频道组
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        # 接受连接
        await self.accept()

        logger.info(f'[WebSocket] 客户端连接成功: {self.client_id}')

        # 发送连接成功消息
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'client_id': self.client_id,
            'message': 'WebSocket连接已建立'
        }))

    async def disconnect(self, close_code):
        """
        WebSocket连接断开
        """
        if hasattr(self, 'room_group_name'):
            # 离开频道组
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

            logger.info(f'[WebSocket] 客户端断开连接: {self.client_id}')

    async def receive(self, text_data):
        """
        接收客户端消息
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'unknown')

            logger.debug(f'[WebSocket] 收到消息: {message_type} from {self.client_id}')

            # 处理心跳检测
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp')
                }))

            # 处理其他消息类型（可扩展）
            elif message_type == 'get_stats':
                # 获取统计信息
                stats = await self.get_client_stats()
                await self.send(text_data=json.dumps({
                    'type': 'stats',
                    'data': stats
                }))

        except json.JSONDecodeError:
            logger.error(f'[WebSocket] 无效的JSON数据: {text_data}')
        except Exception as e:
            logger.error(f'[WebSocket] 处理消息失败: {e}', exc_info=True)

    async def alert_message(self, event):
        """
        接收频道组的告警消息并推送给客户端

        Args:
            event: {'type': 'alert_message', 'data': {...}}
        """
        alert_data = event['data']

        logger.info(
            f"[WebSocket] 推送告警到客户端 {self.client_id}: "
            f"Level={alert_data.get('risk_level')} "
            f"Score={alert_data.get('overall_score', 0):.1f}"
        )

        # 发送告警消息
        await self.send(text_data=json.dumps({
            'type': 'alert',
            'data': alert_data
        }))

    async def task_alert(self, event):
        """
        接收频道组的任务告警消息并推送给客户端

        Args:
            event: {'type': 'task_alert', 'data': {...}}
        """
        alert_data = event['data']

        logger.info(
            f"[WebSocket] 推送任务告警到客户端 {self.client_id}: "
            f"Task={alert_data.get('task_name')} "
            f"Error={alert_data.get('error', 'Unknown')[:50]}"
        )

        # 发送任务告警消息
        await self.send(text_data=json.dumps({
            'type': 'task_alert',
            'data': alert_data
        }))

    @database_sync_to_async
    def get_client_stats(self):
        """
        获取客户端统计信息（异步）
        """
        from .agent_activity_models import AgentActivityLog
        from django.db.models import Count, Avg

        # 查询最近1小时的统计
        from django.utils import timezone
        from datetime import timedelta

        one_hour_ago = timezone.now() - timedelta(hours=1)

        stats = AgentActivityLog.objects.filter(
            client_id=self.client_id,
            timestamp__gte=one_hour_ago
        ).aggregate(
            total_count=Count('activity_id'),
            avg_score=Avg('risk_score'),
            high_risk_count=Count('activity_id', filter={'risk_level__in': ['high', 'critical']})
        )

        return {
            'client_id': self.client_id,
            'last_hour': {
                'total_count': stats['total_count'],
                'avg_score': round(stats['avg_score'] or 0, 1),
                'high_risk_count': stats['high_risk_count']
            }
        }
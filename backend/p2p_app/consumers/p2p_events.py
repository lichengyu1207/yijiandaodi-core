import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async

from p2p_app.models import P2PNode

logger = logging.getLogger(__name__)


class P2PEventConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.node_id = self.scope["url_route"]["kwargs"]["node_id"]
        try:
            node_exists = await sync_to_async(P2PNode.objects.filter(node_id=self.node_id).exists)()
            if not node_exists:
                logger.warning(f"[WS] 节点 {self.node_id} 不存在，拒绝连接")
                await self.close(code=4004)
                return

            self.group_name = f"p2p_node_{self.node_id}"
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.info(f"[WS] 节点 {self.node_id} 已连接，channel: {self.channel_name}")
        except Exception as e:
            logger.error(f"[WS] 节点 {self.node_id} 连接异常: {e}", exc_info=True)
            await self.close(code=4000)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            event_type = data.get("event_type")
            payload = data.get("payload", {})

            handlers = {
                "heartbeat": self.handle_heartbeat,
                "task_result": self.handle_task_result,
                "idle_state_change": self.handle_idle_change,
                "error": self.handle_error,
            }

            handler = handlers.get(event_type)
            if handler:
                await handler(payload)
            else:
                await self.send(json.dumps({
                    "type": "error",
                    "message": f"未知事件类型: {event_type}",
                    "code": 4001,
                }))
        except json.JSONDecodeError:
            await self.send(json.dumps({
                "type": "error",
                "message": "无效的 JSON 格式",
                "code": 4002,
            }))
        except Exception as e:
            logger.error(f"[WS] 处理消息异常 (node={self.node_id}): {e}", exc_info=True)
            await self.send(json.dumps({
                "type": "error",
                "message": "服务器内部错误",
                "code": 5000,
            }))

    async def handle_heartbeat(self, payload):
        logger.info(f"[WS] 收到心跳 (node={self.node_id}), payload: {payload}")

    async def handle_task_result(self, payload):
        shard_id = payload.get("shard_id")
        result = payload.get("result")
        signature = payload.get("signature")

        logger.info(
            f"[WS] 收到任务结果 (node={self.node_id}, shard={shard_id}), "
            f"signature={signature[:16]}..."
        )

        await self.send(json.dumps({
            "type": "task_result_ack",
            "shard_id": shard_id,
            "status": "received",
        }))

    async def handle_idle_change(self, payload):
        old_state = payload.get("old_state")
        new_state = payload.get("new_state")
        reason = payload.get("reason", "")

        logger.info(
            f"[WS] 空闲状态变更 (node={self.node_id}): "
            f"{old_state} -> {new_state}, 原因: {reason}"
        )

        if new_state == "BUSY":
            logger.warning(f"[WS] 节点 {self.node_id} 进入 BUSY 状态，可能触发 force_migrate")

        try:
            node = await sync_to_async(P2PNode.objects.get)(node_id=self.node_id)
            status_map = {
                "IDLE": "online",
                "PARTIAL_BUSY": "busy",
                "BUSY": "busy",
            }
            new_status = status_map.get(new_state, node.status)
            if new_status != node.status:
                node.status = new_status
                await sync_to_async(node.save)()
                logger.info(f"[WS] 节点 {self.node_id} 状态已更新为: {new_status}")
        except P2PNode.DoesNotExist:
            logger.error(f"[WS] 更新节点状态失败: 节点 {self.node_id} 不存在")

    async def handle_error(self, payload):
        error_code = payload.get("error_code", "UNKNOWN")
        error_message = payload.get("error_message", "")
        context = payload.get("context", {})

        logger.error(
            f"[WS] 节点错误报告 (node={self.node_id}): "
            f"code={error_code}, msg={error_message}, context={context}"
        )

    async def task_dispatched(self, event):
        await self.send(json.dumps({
            "type": "task_dispatched",
            "task_id": event["task_id"],
            "payload": event["payload"],
            "signature": event.get("ass_signature", ""),
            "timeout": event.get("timeout", 300),
        }))

    async def force_migrate(self, event):
        await self.send(json.dumps({
            "type": "force_migrate",
            "task_ids": event["task_ids"],
            "reason": event["reason"],
        }))

    async def config_update(self, event):
        await self.send(json.dumps({
            "type": "config_update",
            "config": event.get("config", {}),
            "version": event.get("version"),
        }))

    async def maintenance_notice(self, event):
        await self.send(json.dumps({
            "type": "maintenance_notice",
            "scheduled_at": event.get("scheduled_at"),
            "duration_minutes": event.get("duration_minutes"),
            "reason": event.get("reason", "计划维护"),
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
            logger.info(
                f"[WS] 节点 {self.node_id} 断开连接, "
                f"close_code={close_code}, channel={self.channel_name}"
            )

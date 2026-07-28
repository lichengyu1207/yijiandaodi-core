"""
MCP (Model Context Protocol) 中间人代理
监听 Agent 通信，解析操作指令，交由巡检 API 分析
支持 WebSocket 和 HTTP 协议
"""
import json
import asyncio
import logging
from typing import Dict, Any, Optional, Callable
from dataclasses import dataclass
from datetime import datetime
import httpx
import websockets
from aiohttp import web

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class MCPMessage:
    """MCP 消息结构"""
    jsonrpc: str = "2.0"
    id: Optional[int] = None
    method: Optional[str] = None
    params: Optional[Dict[str, Any]] = None
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None

    @classmethod
    def from_dict(cls, data: Dict) -> 'MCPMessage':
        return cls(
            jsonrpc=data.get('jsonrpc', '2.0'),
            id=data.get('id'),
            method=data.get('method'),
            params=data.get('params'),
            result=data.get('result'),
            error=data.get('error')
        )

    def to_dict(self) -> Dict:
        data = {'jsonrpc': self.jsonrpc}
        if self.id is not None:
            data['id'] = self.id
        if self.method:
            data['method'] = self.method
        if self.params:
            data['params'] = self.params
        if self.result is not None:
            data['result'] = self.result
        if self.error:
            data['error'] = self.error
        return data


@dataclass
class OperationAnalysis:
    """操作分析结果"""
    operation_id: str
    risk_level: str  # low, medium, high
    status: str  # normal, warning, blocked
    analysis: str
    recommendation: str
    should_block: bool


class MCPProxy:
    """MCP 协议中间人代理"""

    def __init__(
        self,
        patrol_api_url: str = "http://localhost:8000/auth/patrol/analyze/",
        on_operation: Optional[Callable] = None
    ):
        self.patrol_api_url = patrol_api_url
        self.on_operation = on_operation
        self.client = httpx.AsyncClient(timeout=30.0)

        # 高风险方法列表
        self.high_risk_methods = {
            'tools/call',       # 调用工具
            'resources/write',  # 写入资源
            'resources/delete', # 删除资源
            'prompts/execute',  # 执行提示词
        }

        # 需要监控的工具名
        self.monitored_tools = {
            'read_file',
            'write_file',
            'execute_command',
            'http_request',
            'bash',
            'python',
            'git',
        }

    async def analyze_request(self, message: MCPMessage) -> Optional[OperationAnalysis]:
        """
        分析请求消息，判断是否需要拦截
        """
        if not message.method:
            return None

        # 只监控特定方法
        if message.method not in self.high_risk_methods:
            return None

        # 提取操作信息
        operation = self._extract_operation(message)
        if not operation:
            return None

        # 调用巡检 API
        try:
            response = await self.client.post(
                self.patrol_api_url,
                json={
                    'type': operation['type'],
                    'title': operation['title'],
                    'content': operation['content'],
                    'timestamp': datetime.now().isoformat()
                }
            )

            if response.status_code == 200:
                data = response.json()
                result = data.get('operation', {})

                analysis = OperationAnalysis(
                    operation_id=result.get('id', ''),
                    risk_level=result.get('risk_level', 'low'),
                    status=result.get('status', 'normal'),
                    analysis=result.get('analysis', ''),
                    recommendation=result.get('recommendation', ''),
                    should_block=result.get('status') == 'blocked'
                )

                # 触发回调
                if self.on_operation:
                    await self.on_operation(analysis)

                return analysis

        except Exception as e:
            logger.error(f"分析请求失败: {e}")

        return None

    def _extract_operation(self, message: MCPMessage) -> Optional[Dict]:
        """从消息中提取操作信息"""
        params = message.params or {}

        if message.method == 'tools/call':
            tool_name = params.get('name', '')
            if tool_name in self.monitored_tools:
                return {
                    'type': 'code',
                    'title': f"调用工具: {tool_name}",
                    'content': json.dumps(params.get('arguments', {}), ensure_ascii=False)
                }

        elif message.method == 'resources/write':
            return {
                'type': 'code',
                'title': f"写入资源: {params.get('uri', 'unknown')}",
                'content': str(params.get('content', ''))
            }

        elif message.method == 'prompts/execute':
            return {
                'type': 'ai_chat',
                'title': f"执行提示词: {params.get('name', 'unknown')}",
                'content': str(params.get('arguments', {}))
            }

        return None

    def create_blocked_response(self, message: MCPMessage, analysis: OperationAnalysis) -> MCPMessage:
        """创建拦截响应"""
        return MCPMessage(
            jsonrpc="2.0",
            id=message.id,
            error={
                "code": -32000,
                "message": f"【一鉴到底巡检拦截】{analysis.analysis}",
                "data": {
                    "risk_level": analysis.risk_level,
                    "recommendation": analysis.recommendation
                }
            }
        )

    async def handle_request(self, request_data: bytes) -> bytes:
        """
        处理客户端请求
        返回转发给目标的数据，或拦截响应
        """
        try:
            data = json.loads(request_data)
            message = MCPMessage.from_dict(data)

            # 分析请求
            analysis = await self.analyze_request(message)

            if analysis and analysis.should_block:
                # 拦截请求
                logger.warning(f"[拦截] {message.method}: {analysis.analysis}")
                response = self.create_blocked_response(message, analysis)
                return json.dumps(response.to_dict()).encode()

            # 放行请求
            logger.info(f"[放行] {message.method}")
            return request_data

        except json.JSONDecodeError:
            logger.error("无效的 JSON 请求")
            return request_data
        except Exception as e:
            logger.error(f"处理请求异常: {e}")
            return request_data


class A2AProxy:
    """A2A (Agent-to-Agent) 协议代理"""

    def __init__(
        self,
        patrol_api_url: str = "http://localhost:8000/auth/patrol/analyze/",
        on_operation: Optional[Callable] = None
    ):
        self.patrol_api_url = patrol_api_url
        self.on_operation = on_operation
        self.client = httpx.AsyncClient(timeout=30.0)

    async def analyze_agent_message(self, message: Dict) -> Optional[OperationAnalysis]:
        """分析 Agent 间通信消息"""
        # A2A 消息结构示例
        # {
        #   "from": "agent-1",
        #   "to": "agent-2",
        #   "action": "execute_code",
        #   "payload": { ... }
        # }

        action = message.get('action', '')
        if action in ['execute_code', 'send_data', 'modify_config']:
            operation = {
                'type': 'ai_chat',
                'title': f"Agent通信: {action}",
                'content': json.dumps(message.get('payload', {}), ensure_ascii=False),
                'timestamp': datetime.now().isoformat()
            }

            try:
                response = await self.client.post(
                    self.patrol_api_url,
                    json=operation
                )

                if response.status_code == 200:
                    data = response.json()
                    result = data.get('operation', {})

                    analysis = OperationAnalysis(
                        operation_id=result.get('id', ''),
                        risk_level=result.get('risk_level', 'low'),
                        status=result.get('status', 'normal'),
                        analysis=result.get('analysis', ''),
                        recommendation=result.get('recommendation', ''),
                        should_block=result.get('status') == 'blocked'
                    )

                    if self.on_operation:
                        await self.on_operation(analysis)

                    return analysis

            except Exception as e:
                logger.error(f"A2A 分析失败: {e}")

        return None


# ===== 使用示例 =====

async def demo_mcp_proxy():
    """演示 MCP 代理工作流程"""

    async def on_operation_detected(analysis: OperationAnalysis):
        print(f"\n[检测到操作]")
        print(f"风险等级: {analysis.risk_level}")
        print(f"分析结果: {analysis.analysis}")
        print(f"是否拦截: {analysis.should_block}")

    proxy = MCPProxy(
        patrol_api_url="http://localhost:8000/auth/patrol/analyze/",
        on_operation=on_operation_detected
    )

    # 模拟 MCP 请求
    test_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "execute_command",
            "arguments": {
                "command": "git push origin main"
            }
        }
    }

    request_bytes = json.dumps(test_request).encode()
    result = await proxy.handle_request(request_bytes)

    print("\n[代理结果]")
    print(json.dumps(json.loads(result), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(demo_mcp_proxy())
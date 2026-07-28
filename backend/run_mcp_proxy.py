#!/usr/bin/env python
"""
MCP 代理启动器
启动本地 MCP 中间人代理，监控 Agent 通信
"""
import asyncio
import json
import sys
import os

# 添加后端路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from auth_app.mcp_proxy import MCPProxy, OperationAnalysis


class ProxyServer:
    """本地代理服务器"""

    def __init__(self, host: str = "127.0.0.1", port: int = 8765):
        self.host = host
        self.port = port
        self.proxy = MCPProxy(
            patrol_api_url="http://localhost:8000/auth/patrol/analyze/",
            on_operation=self.on_operation
        )
        self.stats = {
            'total': 0,
            'blocked': 0,
            'passed': 0
        }

    async def on_operation(self, analysis: OperationAnalysis):
        """操作检测回调"""
        self.stats['total'] += 1
        if analysis.should_block:
            self.stats['blocked'] += 1
            print(f"\n[拦截] {analysis.analysis}")
        else:
            self.stats['passed'] += 1
            print(f"\n[放行] 风险: {analysis.risk_level}")

    async def handle_client(self, reader, writer):
        """处理客户端连接"""
        addr = writer.get_extra_info('peername')
        print(f"\n[连接] {addr}")

        try:
            while True:
                data = await reader.read(4096)
                if not data:
                    break

                # 通过代理处理
                result = await self.proxy.handle_request(data)

                # 返回结果
                writer.write(result)
                await writer.drain()

        except Exception as e:
            print(f"[错误] {e}")
        finally:
            writer.close()
            await writer.wait_closed()
            print(f"[断开] {addr}")

    async def start(self):
        """启动代理服务器"""
        server = await asyncio.start_server(
            self.handle_client,
            self.host,
            self.port
        )

        addr = server.sockets[0].getsockname()
        print(f"""
╔══════════════════════════════════════════╗
║      一鉴到底 - MCP 协议代理已启动        ║
╠══════════════════════════════════════════╣
║  监听地址: {self.host}:{self.port}
║  巡检API: http://localhost:8000
║  
║  使用方法:
║  1. 配置 Agent 使用代理: {self.host}:{self.port}
║  2. 所有 MCP 流量将通过巡检
║  3. 高风险操作将被自动拦截
╚══════════════════════════════════════════╝
        """)

        async with server:
            await server.serve_forever()

    def print_stats(self):
        """打印统计信息"""
        print(f"\n[统计] 总计: {self.stats['total']} | 拦截: {self.stats['blocked']} | 放行: {self.stats['passed']}")


def main():
    """主入口"""
    import argparse

    parser = argparse.ArgumentParser(description='MCP 协议代理')
    parser.add_argument('--host', default='127.0.0.1', help='监听地址')
    parser.add_argument('--port', type=int, default=8765, help='监听端口')

    args = parser.parse_args()

    server = ProxyServer(host=args.host, port=args.port)

    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        server.print_stats()
        print("\n[停止] 代理已关闭")


if __name__ == "__main__":
    main()
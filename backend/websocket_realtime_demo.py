"""
WebSocket实时告警推送完整流程演示

展示如何通过API触发风险评估，并实时推送到客户端
"""

import asyncio
import json
import websockets
import requests
import time
from threading import Thread

# API和WebSocket配置
API_BASE = 'http://localhost:9092/api'
WS_BASE = 'ws://localhost:9092/ws'


class RealTimeAlertDemo:
    """实时告警推送演示"""

    def __init__(self, client_id):
        self.client_id = client_id
        self.ws_url = f'{WS_BASE}/agent-alerts/{client_id}/'
        self.alerts_received = []

    def start_websocket_client(self):
        """启动WebSocket客户端监听告警"""
        print(f"\n[WebSocket客户端] 连接到 {self.ws_url}")

        async def listen_alerts():
            try:
                async with websockets.connect(self.ws_url) as websocket:
                    print(f"[WebSocket客户端] ✓ 连接成功，等待告警...")

                    # 监听消息
                    async for message in websocket:
                        try:
                            data = json.loads(message)
                            self.handle_websocket_message(data)
                        except json.JSONDecodeError:
                            print(f"[WebSocket客户端] 无效消息: {message}")

            except Exception as e:
                print(f"[WebSocket客户端] 连接错误: {e}")

        # 在后台线程运行WebSocket客户端
        def run_ws_client():
            asyncio.run(listen_alerts())

        thread = Thread(target=run_ws_client, daemon=True)
        thread.start()

        # 给WebSocket一些时间连接
        time.sleep(2)

    def handle_websocket_message(self, data):
        """处理WebSocket消息"""
        message_type = data.get('type')

        if message_type == 'connection_established':
            print(f"[WebSocket客户端] {data['message']}")

        elif message_type == 'alert':
            alert = data['data']
            self.alerts_received.append(alert)

            print(f"\n{'=' * 80}")
            print(f"[实时告警] 收到告警推送!")
            print(f"{'=' * 80}")
            print(f"告警ID: {alert['alert_id']}")
            print(f"时间: {alert['timestamp']}")
            print(f"\nAgent身份:")
            print(f"  名称: {alert['agent']['name']}")
            print(f"  类型: {alert['agent']['type']}")
            print(f"  信任级别: {alert['agent']['trust_level']}")
            print(f"\n风险信息:")
            print(f"  操作: {alert['action']}")
            print(f"  目标: {alert['target']}")
            print(f"  风险等级: {alert['risk_level']}")
            print(f"  综合分数: {alert['overall_score']:.1f}")
            print(f"\n建议:")
            for i, rec in enumerate(alert['recommendations'][:3], 1):
                print(f"  {i}. {rec}")

        elif message_type == 'pong':
            # 心跳响应，忽略
            pass

    def trigger_alert_via_api(self, activity_id):
        """通过API触发告警"""
        print(f"\n[API调用] 触发风险评估...")

        response = requests.post(
            f'{API_BASE}/risk-assessment/alerts/trigger/',
            json={'activity_id': activity_id, 'force': False},
            headers={'Content-Type': 'application/json'}
        )

        if response.status_code == 200:
            result = response.json()
            if result['alert']:
                print(f"[API调用] ✓ 告警触发成功: {result['alert']['alert_id']}")
                print(f"[API调用] 等待WebSocket推送...")
                # 等待WebSocket推送
                time.sleep(1)
            else:
                print(f"[API调用] {result['message']}")
        else:
            print(f"[API调用] ✗ 告警触发失败: {response.text}")


def demo_workflow():
    """演示完整工作流程"""

    print("=" * 80)
    print("WebSocket实时告警推送演示")
    print("=" * 80)

    print("\n工作流程说明:")
    print("1. 客户端连接WebSocket监听告警")
    print("2. 通过API触发风险评估")
    print("3. 风险评估判断是否需要告警")
    print("4. 如果需要，触发告警并实时推送到客户端")
    print("5. 客户端WebSocket收到实时告警推送")

    client_id = 'demo_client_001'

    # 1. 启动WebSocket客户端
    demo = RealTimeAlertDemo(client_id)
    demo.start_websocket_client()

    # 2. 模拟创建活动日志
    print("\n[数据准备] 模拟创建高风险活动...")

    # 这里需要先有活动日志，使用之前创建的
    # 实际场景中，活动日志会通过批量上报API创建

    activity_id = input("\n请输入活动日志ID进行测试（或按Enter跳过）: ").strip()

    if activity_id:
        # 3. 通过API触发告警
        demo.trigger_alert_via_api(activity_id)

        # 4. 等待并检查结果
        time.sleep(2)

        print(f"\n{'=' * 80}")
        print("演示结果")
        print(f"{'=' * 80}")
        print(f"接收到的告警数量: {len(demo.alerts_received)}")

        if demo.alerts_received:
            print("\n✓ 实时告警推送成功！")
        else:
            print("\n⚠ 未收到告警推送，可能风险分数未达到阈值")

    print("\n按Enter键退出...")
    input()


def test_websocket_connection():
    """测试WebSocket连接"""
    import asyncio

    async def test():
        uri = 'ws://localhost:9092/ws/agent-alerts/test_client/'

        print(f"测试WebSocket连接: {uri}")

        try:
            async with websockets.connect(uri) as websocket:
                print("✓ WebSocket连接成功")

                # 发送心跳
                await websocket.send(json.dumps({
                    'type': 'ping',
                    'timestamp': time.time()
                }))

                # 接收消息
                message = await websocket.recv()
                data = json.loads(message)
                print(f"✓ 收到消息: {data}")

        except Exception as e:
            print(f"✗ WebSocket连接失败: {e}")

    asyncio.run(test())


if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1:
        if sys.argv[1] == '--test-connection':
            test_websocket_connection()
        else:
            print("用法:")
            print("  python websocket_realtime_demo.py --test-connection  # 测试WebSocket连接")
            print("  python websocket_realtime_demo.py                    # 运行完整演示")
    else:
        demo_workflow()
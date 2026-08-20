"""
测试WebSocket实时告警推送

验证：
1. Django Channels Consumer正常工作
2. AlertService推送到Channel Layer
3. WebSocket客户端接收到告警
"""

import asyncio
import json
import websockets
import requests
from datetime import datetime

API_BASE = 'http://localhost:9092/api'
WS_BASE = 'ws://localhost:9092'

CLIENT_ID = 'test_ws_client_001'

async def test_websocket_alerts():
    print("=" * 60)
    print("测试WebSocket实时告警推送")
    print("=" * 60)

    # 1. 连接WebSocket
    ws_url = f"{WS_BASE}/ws/agent-alerts/{CLIENT_ID}/"
    print(f"\n连接WebSocket: {ws_url}")

    try:
        async with websockets.connect(ws_url) as websocket:
            print("✅ WebSocket连接成功")

            # 接收连接确认消息
            response = await websocket.recv()
            message = json.loads(response)
            print(f"收到消息: {message}")

            if message.get('type') == 'connection_established':
                print(f"✅ 服务器确认连接: {message['message']}")

            # 2. 发送测试告警数据
            print(f"\n发送测试告警数据...")
            test_payload = {
                'client_id': CLIENT_ID,
                'session_id': 'test_ws_session_001',
                'activities': [
                    {
                        'agent_type': 'cursor',
                        'action': 'file_operation',
                        'target': '/workspace/secrets.yaml',
                        'risk_level': 'critical',
                        'risk_score': 95,
                        'confidence': 1.0,
                        'source': 'file',
                        'timestamp': datetime.now().isoformat(),
                        'metadata': {
                            'detected_types': ['apikey', 'pii'],
                            'risk_count': 2,
                        }
                    }
                ]
            }

            response = requests.post(
                f'{API_BASE}/agent-activities/batch/',
                json=test_payload,
                headers={'Content-Type': 'application/json'}
            )

            if response.ok:
                result = response.json()
                print(f"✅ 上报成功: {result}")
                print(f"   触发告警数: {result['alerts_triggered']}")

                # 3. 等待接收WebSocket告警消息
                print(f"\n等待接收告警消息...")
                try:
                    # 设置超时5秒
                    alert_message = await asyncio.wait_for(
                        websocket.recv(),
                        timeout=5.0
                    )

                    alert_data = json.loads(alert_message)
                    print(f"\n✅ 收到告警消息:")
                    print(f"   类型: {alert_data.get('type')}")
                    print(f"   风险等级: {alert_data['data']['risk_level']}")
                    print(f"   综合分数: {alert_data['data']['overall_score']}")
                    print(f"   Agent: {alert_data['data']['agent_type']}")
                    print(f"   操作: {alert_data['data']['action']}")
                    print(f"   建议: {alert_data['data']['recommendations']}")

                except asyncio.TimeoutError:
                    print("❌ 未在5秒内收到告警消息")

            else:
                print(f"❌ 上报失败: {response.status_code}")
                print(f"   {response.text}")

    except Exception as e:
        print(f"❌ WebSocket连接失败: {e}")

    print("\n" + "=" * 60)
    print("✅ 测试完成！")
    print("=" * 60)

# 运行测试
if __name__ == '__main__':
    asyncio.run(test_websocket_alerts())
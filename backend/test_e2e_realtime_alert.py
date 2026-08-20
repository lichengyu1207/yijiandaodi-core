"""
端到端实时告警推送测试

测试完整流程：
1. 创建Agent身份
2. 启动WebSocket客户端监听
3. 上报Agent活动日志
4. 自动触发风险评估
5. 实时推送告警到WebSocket客户端
"""

import os
import sys
import django
import json
import time
import asyncio
import websockets
from threading import Thread
from queue import Queue

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.utils import timezone
from django.contrib.auth import get_user_model
from auth_app.agent_identity_models import AgentIdentity
from auth_app.agent_activity_models import AgentActivityLog
from auth_app.risk_assessment_service import RiskAssessmentService
from auth_app.alert_service import AlertService

User = get_user_model()


class E2EAlertTest:
    """端到端告警测试"""

    def __init__(self, client_id):
        self.client_id = client_id
        self.ws_url = f'ws://localhost:9092/ws/agent-alerts/{client_id}/'
        self.alert_queue = Queue()
        self.ws_connected = False

    def run_test(self):
        """运行完整测试"""
        print("=" * 80)
        print("端到端实时告警推送测试")
        print("=" * 80)

        # 1. 启动WebSocket客户端
        print("\n[步骤1] 启动WebSocket客户端...")
        self.start_websocket_client()

        # 等待WebSocket连接
        time.sleep(2)

        if not self.ws_connected:
            print("✗ WebSocket连接失败，跳过测试")
            return

        # 2. 创建Agent身份
        print("\n[步骤2] 创建Agent身份...")
        agent, api_key = self.create_agent()

        # 3. 上报高风险活动
        print("\n[步骤3] 上报高风险活动...")
        activity = self.report_high_risk_activity(agent)

        # 4. 触发风险评估
        print("\n[步骤4] 触发风险评估...")
        result = self.trigger_risk_assessment(activity)

        # 5. 检查WebSocket推送
        print("\n[步骤5] 检查WebSocket推送...")
        self.check_websocket_alert()

        # 6. 清理测试数据
        print("\n[步骤6] 清理测试数据...")
        self.cleanup(agent)

        print("\n" + "=" * 80)
        print("测试完成")
        print("=" * 80)

    def start_websocket_client(self):
        """启动WebSocket客户端"""
        print(f"WebSocket URL: {self.ws_url}")

        async def listen():
            try:
                async with websockets.connect(self.ws_url) as websocket:
                    self.ws_connected = True
                    print("✓ WebSocket连接成功")

                    # 发送心跳
                    await websocket.send(json.dumps({
                        'type': 'ping',
                        'timestamp': time.time()
                    }))

                    # 监听消息
                    async for message in websocket:
                        try:
                            data = json.loads(message)
                            self.handle_message(data)
                        except json.JSONDecodeError:
                            print(f"无效消息: {message}")

            except Exception as e:
                print(f"✗ WebSocket连接错误: {e}")
                self.ws_connected = False

        def run():
            asyncio.run(listen())

        thread = Thread(target=run, daemon=True)
        thread.start()

    def handle_message(self, data):
        """处理WebSocket消息"""
        message_type = data.get('type')

        if message_type == 'connection_established':
            print(f"✓ {data['message']}")

        elif message_type == 'alert':
            alert = data['data']
            self.alert_queue.put(alert)

            print("\n" + "=" * 80)
            print("[实时告警推送] ✓ 收到告警!")
            print("=" * 80)
            print(f"告警ID: {alert['alert_id']}")
            print(f"Agent: {alert['agent']['name']}")
            print(f"信任级别: {alert['agent']['trust_level']}")
            print(f"风险等级: {alert['risk_level']}")
            print(f"风险分数: {alert['overall_score']:.1f}")
            print(f"操作: {alert['action']}")
            print(f"目标: {alert['target']}")

    def create_agent(self):
        """创建Agent身份"""
        test_user, _ = User.objects.get_or_create(
            username='e2e_alert_test_user',
            defaults={'email': 'e2e_alert@example.com'}
        )

        agent, api_key = AgentIdentity.create_agent(
            agent_name='E2EAlertTest_HighTrust',
            agent_type='claude',
            trust_level='high',
            owner=test_user,
            created_by=test_user
        )

        print(f"✓ 创建Agent: {agent.agent_name}")
        print(f"  Agent ID: {agent.agent_id}")
        print(f"  信任级别: {agent.trust_level}")
        print(f"  API Key: {api_key[:20]}...{api_key[-10:]}")

        return agent, api_key

    def report_high_risk_activity(self, agent):
        """上报高风险活动"""
        # 清空缓存，确保全新评估
        RiskAssessmentService.clear_cache()

        # 创建高风险活动（75分，超过high级别的70分阈值）
        activity = AgentActivityLog.objects.create(
            agent=agent,
            agent_type=agent.agent_type,
            action='file_operation',
            target='/sensitive/database_config.py',
            risk_level='high',
            risk_score=75,
            confidence=0.95,
            source='file',
            timestamp=timezone.now(),
            session_id=f'e2e_test_{self.client_id}',
            client_id=self.client_id,
            metadata={'test': 'e2e_alert_push'}
        )

        print(f"✓ 创建高风险活动: {activity.activity_id}")
        print(f"  操作: {activity.action}")
        print(f"  目标: {activity.target}")
        print(f"  风险分数: {activity.risk_score}")

        return activity

    def trigger_risk_assessment(self, activity):
        """触发风险评估"""
        result = RiskAssessmentService.assess_activity(activity)

        print(f"✓ 风险评估完成:")
        print(f"  综合风险分数: {result.overall_score:.1f}")
        print(f"  风险等级: {result.risk_level}")
        print(f"  是否触发告警: {result.should_alert}")
        print(f"  告警阈值: {RiskAssessmentService.BASE_ALERT_THRESHOLD * RiskAssessmentService.TRUST_LEVEL_FACTORS['high']:.1f}")

        # 如果触发告警，手动触发推送
        if result.should_alert:
            print("  触发告警推送...")
            alert_data = AlertService.handle_alert(activity, result)
            if alert_data:
                print(f"  ✓ 告警已推送: {alert_data['alert_id']}")

        return result

    def check_websocket_alert(self):
        """检查WebSocket推送"""
        print("等待WebSocket推送...")

        try:
            # 等待最多5秒
            alert = self.alert_queue.get(timeout=5)

            print("\n✓✓✓ 端到端测试成功！")
            print("  - Agent身份创建成功")
            print("  - 高风险活动上报成功")
            print("  - 风险评估正确触发")
            print("  - WebSocket实时推送成功")

            return True

        except:
            print("\n⚠ 未收到WebSocket推送")
            print("  可能原因:")
            print("  1. WebSocket服务未启动")
            print("  2. Redis未启动（如果使用channels-redis）")
            print("  3. Channel Layer配置错误")

            return False

    def cleanup(self, agent):
        """清理测试数据"""
        try:
            # 删除活动日志
            AgentActivityLog.objects.filter(session_id=f'e2e_test_{self.client_id}').delete()

            # 删除Agent
            agent.delete()

            print("✓ 测试数据已清理")

        except Exception as e:
            print(f"✗ 清理失败: {e}")


def test_websocket_service():
    """测试WebSocket服务是否正常"""
    print("\n测试WebSocket服务...")

    async def test():
        try:
            uri = 'ws://localhost:9092/ws/agent-alerts/test_client/'
            async with websockets.connect(uri) as websocket:
                print("✓ WebSocket服务正常")
                return True
        except Exception as e:
            print(f"✗ WebSocket服务异常: {e}")
            print("\n请确保:")
            print("  1. Django Channels已安装: pip install channels channels-redis")
            print("  2. Redis已启动: redis-server")
            print("  3. ASGI服务器已启动: daphne -b 0.0.0.0 -p 9092 fangdudu_backend.asgi:application")
            return False

    return asyncio.run(test())


if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == '--test-service':
        # 测试WebSocket服务
        test_websocket_service()
    else:
        # 运行端到端测试
        # 先测试WebSocket服务
        if test_websocket_service():
            test = E2EAlertTest('e2e_test_client_001')
            test.run_test()
        else:
            print("\n请先启动WebSocket服务，然后再运行测试")
            print("启动命令: daphne -b 0.0.0.0 -p 9092 fangdudu_backend.asgi:application")
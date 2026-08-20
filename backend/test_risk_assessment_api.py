"""
测试风险评估和告警API接口
验证API功能是否正常工作
"""

import requests
import json

# API基础URL
API_BASE = 'http://localhost:9092/api'


def test_risk_assessment_api():
    """测试风险评估API接口"""

    print("=" * 80)
    print("风险评估API接口测试")
    print("=" * 80)

    # 1. 创建测试数据（使用已有的活动日志）
    print("\n[步骤1] 查询现有活动日志...")

    # 这里假设数据库中已有活动日志，实际测试时需要先创建
    # 我们可以使用之前测试脚本创建的活动日志

    activity_id = input("请输入活动日志ID进行测试（或按Enter跳过）: ").strip()

    if not activity_id:
        print("跳过API测试，因为没有提供活动日志ID")
        return

    # 2. 测试单个风险评估接口
    print("\n[步骤2] 测试单个风险评估接口...")
    print(f"POST {API_BASE}/risk-assessment/assess/")

    response = requests.post(
        f'{API_BASE}/risk-assessment/assess/',
        json={'activity_id': activity_id},
        headers={'Content-Type': 'application/json'}
    )

    print(f"响应状态码: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print(f"✓ 风险评估成功:")
        print(f"  活动ID: {result['result']['activity_id']}")
        print(f"  综合风险分数: {result['result']['overall_score']:.1f}")
        print(f"  风险等级: {result['result']['risk_level']}")
        print(f"  是否触发告警: {result['result']['should_alert']}")
        print(f"  Agent身份: {result['result']['agent_name']}")
        print(f"  信任级别: {result['result']['agent_trust_level']}")
        print(f"  调整后阈值: {result['result']['alert_threshold']:.1f}")
        print(f"  权限加成: {result['result']['permission_bonus']:.1f}")

        if result['result']['recommendations']:
            print(f"  建议:")
            for rec in result['result']['recommendations'][:3]:
                print(f"    - {rec}")
    else:
        print(f"✗ 风险评估失败: {response.text}")

    # 3. 测试批量风险评估接口
    print("\n[步骤3] 测试批量风险评估接口...")
    print(f"POST {API_BASE}/risk-assessment/assess-batch/")

    response = requests.post(
        f'{API_BASE}/risk-assessment/assess-batch/',
        json={'activity_ids': [activity_id]},
        headers={'Content-Type': 'application/json'}
    )

    print(f"响应状态码: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print(f"✓ 批量风险评估成功:")
        print(f"  总评估数: {result['total_count']}")
        print(f"  触发告警数: {result['alert_count']}")
    else:
        print(f"✗ 批量风险评估失败: {response.text}")

    # 4. 测试触发告警接口
    print("\n[步骤4] 测试触发告警接口...")
    print(f"POST {API_BASE}/risk-assessment/alerts/trigger/")

    response = requests.post(
        f'{API_BASE}/risk-assessment/alerts/trigger/',
        json={'activity_id': activity_id, 'force': False},
        headers={'Content-Type': 'application/json'}
    )

    print(f"响应状态码: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        if result['alert']:
            print(f"✓ 告警触发成功:")
            print(f"  告警ID: {result['alert']['alert_id']}")
            print(f"  风险等级: {result['alert']['risk_level']}")
            print(f"  Agent: {result['alert']['agent']['name']}")
        else:
            print(f"  {result['message']}")
    else:
        print(f"✗ 告警触发失败: {response.text}")

    # 5. 测试缓存统计接口
    print("\n[步骤5] 测试缓存统计接口...")
    print(f"GET {API_BASE}/risk-assessment/cache-stats/")

    response = requests.get(f'{API_BASE}/risk-assessment/cache-stats/')

    print(f"响应状态码: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print(f"✓ 缓存统计获取成功:")
        print(f"  总会话数: {result['cache_stats']['total_sessions']}")
        print(f"  总活动数: {result['cache_stats']['total_activities']}")
    else:
        print(f"✗ 缓存统计获取失败: {response.text}")

    print("\n" + "=" * 80)
    print("API接口测试完成")
    print("=" * 80)


def test_api_without_server():
    """不启动服务器的本地测试"""

    print("=" * 80)
    print("本地测试（不启动服务器）")
    print("=" * 80)

    # 直接调用API视图函数
    from auth_app.risk_assessment_views import assess_risk
    from rest_framework.test import APIRequestFactory

    factory = APIRequestFactory()

    print("\n[测试1] 测试单个风险评估...")

    # 需要先有活动日志ID
    from auth_app.agent_activity_models import AgentActivityLog

    # 获取最新的一个活动日志
    activity = AgentActivityLog.objects.first()

    if activity:
        request = factory.post(
            '/api/risk-assessment/assess/',
            {'activity_id': activity.activity_id},
            format='json'
        )

        response = assess_risk(request)

        print(f"响应状态码: {response.status_code}")
        print(f"响应数据: {json.dumps(response.data, indent=2, ensure_ascii=False)}")
    else:
        print("数据库中没有活动日志，跳过测试")


if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == '--local':
        # 本地测试模式
        import django
        import os
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
        django.setup()
        test_api_without_server()
    else:
        # HTTP API测试模式
        test_risk_assessment_api()
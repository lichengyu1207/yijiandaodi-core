"""
测试Agent活动日志批量上报管道

验证：
1. 后端API接收批量日志
2. 风险评估自动触发
3. 告警机制正常工作
"""

import os
import sys
import django
import requests
import json
from datetime import datetime


def main():
    # 设置Django环境
    sys.path.insert(0, '.')
    os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
    django.setup()

    from auth_app.agent_activity_models import AgentActivityLog
    from auth_app.risk_assessment_service import RiskAssessmentService

    API_BASE = 'http://localhost:9092/api'

    print("=" * 60)
    print("测试Agent活动日志批量上报管道")
    print("=" * 60)

    # 清空缓存
    RiskAssessmentService.clear_cache()

    # 清空测试数据
    print("\n清理旧测试数据...")
    AgentActivityLog.objects.filter(client_id='test_batch_upload').delete()

    # 构建测试数据
    test_payload = {
        'client_id': 'test_batch_upload',
        'session_id': 'test_session_batch_001',
        'activities': [
            {
                'agent_type': 'cursor',
                'action': 'file_operation',
                'target': '/workspace/secrets.yaml',
                'risk_level': 'high',
                'risk_score': 75,
                'confidence': 0.95,
                'source': 'file',
                'timestamp': datetime.now().isoformat(),
                'metadata': {
                    'detected_types': ['apikey', 'pii'],
                    'risk_count': 2,
                }
            },
            {
                'agent_type': 'cursor',
                'action': 'clipboard_operation',
                'target': 'clipboard',
                'risk_level': 'medium',
                'risk_score': 55,
                'confidence': 0.90,
                'source': 'clipboard',
                'timestamp': datetime.now().isoformat(),
                'metadata': {}
            },
            {
                'agent_type': 'cursor',
                'action': 'ai_api_call',
                'target': 'api.openai.com',
                'risk_level': 'low',
                'risk_score': 20,
                'confidence': 1.0,
                'source': 'network',
                'timestamp': datetime.now().isoformat(),
                'metadata': {}
            },
        ]
    }

    print(f"\n准备上报 {len(test_payload['activities'])} 条日志")

    # 发送批量上报请求
    try:
        response = requests.post(
            f'{API_BASE}/agent-activities/batch/',
            json=test_payload,
            headers={'Content-Type': 'application/json'}
        )

        print(f"\n响应状态码: {response.status_code}")

        if response.ok:
            result = response.json()
            print(f"\n✅ 上报成功:")
            print(f"  创建记录数: {result['created_count']}")
            print(f"  触发告警数: {result['alerts_triggered']}")
            print(f"  消息: {result['message']}")

            # 验证数据库
            db_count = AgentActivityLog.objects.filter(client_id='test_batch_upload').count()
            print(f"\n数据库记录数: {db_count}")

            # 查看风险评估缓存
            cache_stats = RiskAssessmentService.get_cache_stats()
            print(f"\n风险评估缓存:")
            print(f"  总会话数: {cache_stats['total_sessions']}")
            print(f"  总活动数: {cache_stats['total_activities']}")

            # 查询记录详情
            print(f"\n记录详情:")
            for log in AgentActivityLog.objects.filter(client_id='test_batch_upload').order_by('-risk_score')[:5]:
                print(f"  [{log.risk_level}] {log.agent_type} - {log.action} - {log.risk_score}分")

        else:
            print(f"\n❌ 上报失败:")
            print(f"  {response.text}")

    except Exception as e:
        print(f"\n❌ 请求异常: {e}")

    # 清理测试数据
    print("\n\n清理测试数据...")
    AgentActivityLog.objects.filter(client_id='test_batch_upload').delete()
    print("✅ 测试数据已清理")

    print("\n" + "=" * 60)
    print("✅ 管道测试完成！")
    print("=" * 60)


if __name__ == '__main__':
    main()

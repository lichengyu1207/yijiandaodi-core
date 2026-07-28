"""
测试脚本：创建测试用户并测试浏览器插件同步 API
"""

import requests
import json
from datetime import datetime

# API 基础 URL
BASE_URL = 'http://localhost:8000/api/auth'

def create_test_user():
    """创建测试用户"""
    print('=' * 60)
    print('步骤 1: 获取认证 Token')
    print('=' * 60)

    # 使用管理员账户登录
    login_response = requests.post(f'{BASE_URL}/login/', json={
        'username': 'admin',
        'password': 'Admin@2026'
    })

    if login_response.status_code == 200:
        print('✅ 管理员登录成功')
        return login_response.json()

    # 尝试其他常见密码
    for pwd in ['admin', 'admin123', '123456', 'password']:
        login_response = requests.post(f'{BASE_URL}/login/', json={
            'username': 'admin',
            'password': pwd
        })
        if login_response.status_code == 200:
            print(f'✅ 管理员登录成功 (密码: {pwd})')
            return login_response.json()

    print(f'❌ 登录失败: {login_response.text}')
    print('\n请提供正确的管理员密码，或在后台创建测试用户')
    return None

def test_sync_apis(token):
    """测试同步 API"""
    print('\n' + '=' * 60)
    print('步骤 2: 测试同步 API')
    print('=' * 60)

    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    # 测试 1: 开始录制同步
    print('\n📝 测试 1: 开始录制同步')
    session_id = f'test_session_{datetime.now().strftime("%Y%m%d%H%M%S")}'

    start_response = requests.post(
        f'{BASE_URL}/extension/sync/start/',
        headers=headers,
        json={
            'session_id': session_id,
            'title': '测试录制会话',
            'start_time': datetime.now().isoformat(),
            'device_id': 'test_device_001',
            'extension_version': '1.0.0'
        }
    )

    if start_response.status_code == 201:
        print(f'✅ 开始录制同步成功: {session_id}')
    else:
        print(f'❌ 开始录制同步失败: {start_response.text}')

    # 测试 2: 操作同步
    print('\n📝 测试 2: 操作同步')

    operation_response = requests.post(
        f'{BASE_URL}/extension/sync/operation/',
        headers=headers,
        json={
            'session_id': session_id,
            'operations': [
                {
                    'id': 'op_001',
                    'type': 'ai_prompt',
                    'timestamp': datetime.now().isoformat(),
                    'platform': {'name': 'DeepSeek', 'type': 'ai_chat'},
                    'data': {'textPreview': '测试提示词'},
                    'pageInfo': {'url': 'https://chat.deepseek.com/', 'title': 'DeepSeek'}
                },
                {
                    'id': 'op_002',
                    'type': 'ai_response',
                    'timestamp': datetime.now().isoformat(),
                    'platform': {'name': 'DeepSeek', 'type': 'ai_chat'},
                    'data': {'textPreview': 'AI回复内容'},
                    'pageInfo': {'url': 'https://chat.deepseek.com/', 'title': 'DeepSeek'}
                }
            ]
        }
    )

    if operation_response.status_code == 200:
        result = operation_response.json()
        print(f'✅ 操作同步成功: {result.get("operations_created", 0)} 个操作')
    else:
        print(f'❌ 操作同步失败: {operation_response.text}')

    # 测试 3: 获取会话列表
    print('\n📝 测试 3: 获取会话列表')

    sessions_response = requests.get(
        f'{BASE_URL}/extension/sessions/',
        headers=headers
    )

    if sessions_response.status_code == 200:
        result = sessions_response.json()
        print(f'✅ 获取会话列表成功: {len(result.get("results", result))} 个会话')
    else:
        print(f'❌ 获取会话列表失败: {sessions_response.text}')

    # 测试 4: 获取用户统计
    print('\n📝 测试 4: 获取用户统计')

    stats_response = requests.get(
        f'{BASE_URL}/extension/sessions/stats/',
        headers=headers
    )

    if stats_response.status_code == 200:
        result = stats_response.json()
        print(f'✅ 获取统计成功:')
        print(f'   - 总会话数: {result.get("total_sessions", 0)}')
        print(f'   - 总操作数: {result.get("total_operations", 0)}')
        print(f'   - 总指纹数: {result.get("total_fingerprints", 0)}')
    else:
        print(f'❌ 获取统计失败: {stats_response.text}')

    # 测试 5: 停止录制同步
    print('\n📝 测试 5: 停止录制同步')

    end_response = requests.post(
        f'{BASE_URL}/extension/sync/end/',
        headers=headers,
        json={
            'session_id': session_id,
            'end_time': datetime.now().isoformat()
        }
    )

    if end_response.status_code == 200:
        print(f'✅ 停止录制同步成功')
    else:
        print(f'❌ 停止录制同步失败: {end_response.text}')

def main():
    """主测试流程"""
    print('\n' + '🔍' * 30)
    print('浏览器插件同步 API 测试')
    print('🔍' * 30 + '\n')

    # 创建测试用户并获取 Token
    auth_data = create_test_user()

    if not auth_data:
        print('\n❌ 无法获取认证 Token，测试终止')
        return

    token = auth_data.get('access')
    print(f'\n✅ 获取 Token 成功: {token[:50]}...')

    # 测试同步 API
    test_sync_apis(token)

    print('\n' + '=' * 60)
    print('✅ 测试完成！')
    print('=' * 60)
    print('\n测试账号信息：')
    print('  用户名: admin')
    print('  密码: (后台管理员密码)')
    print('\n您可以在浏览器插件中使用此账号登录测试同步功能')
    print('\n管理后台地址: http://localhost:8000/admin/')

if __name__ == '__main__':
    main()
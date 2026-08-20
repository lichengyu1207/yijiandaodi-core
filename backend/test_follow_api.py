import requests
import json
import sys


def main():
    # 修复Windows控制台编码
    sys.stdout.reconfigure(encoding='utf-8')

    BASE_URL = 'http://localhost:8000/api/front'

    print('=' * 60)
    print('Test 1: Get article detail (should include is_followed, follower_count)')
    print('=' * 60)
    try:
        resp = requests.get(f'{BASE_URL}/articles/1/')
        data = resp.json()
        print(f'[OK] Title: {data.get("title")}')
        print(f'    author_article_count: {data.get("author_article_count")}')
        print(f'    author_total_reads: {data.get("author_total_reads")}')
        print(f'    is_followed: {data.get("is_followed")}')
        print(f'    follower_count: {data.get("follower_count")}')
    except Exception as e:
        print(f'[ERROR] {e}')

    print('\n' + '=' * 60)
    print('Test 2: Check follow status API')
    print('=' * 60)
    try:
        resp = requests.get(f'{BASE_URL}/articles/1/follow_status/')
        data = resp.json()
        print(f'[OK] is_followed: {data.get("is_followed")}')
        print(f'    follower_count: {data.get("follower_count")}')
    except Exception as e:
        print(f'[ERROR] {e}')

    print('\n' + '=' * 60)
    print('Test 3: Follow action')
    print('=' * 60)
    try:
        resp = requests.post(f'{BASE_URL}/articles/1/follow/', json={'user_id': 1})
        data = resp.json()
        print(f'[OK] success: {data.get("success")}')
        print(f'    followed: {data.get("followed")}')
        print(f'    follower_count: {data.get("follower_count")}')
        print(f'    message: {data.get("message")}')
    except Exception as e:
        print(f'[ERROR] {e}')

    print('\n' + '=' * 60)
    print('Test 4: Check status again (should be followed)')
    print('=' * 60)
    try:
        resp = requests.get(f'{BASE_URL}/articles/1/follow_status/?user_id=1')
        data = resp.json()
        print(f'[OK] is_followed: {data.get("is_followed")} (expected True)')
        print(f'    follower_count: {data.get("follower_count")} (expected >= 1)')
    except Exception as e:
        print(f'[ERROR] {e}')

    print('\n' + '=' * 60)
    print('Test 5: Unfollow (toggle again)')
    print('=' * 60)
    try:
        resp = requests.post(f'{BASE_URL}/articles/1/follow/', json={'user_id': 1})
        data = resp.json()
        print(f'[OK] success: {data.get("success")}')
        print(f'    followed: {data.get("followed")} (expected False)')
        print(f'    follower_count: {data.get("follower_count")} (expected 0)')
        print(f'    message: {data.get("message")}')
    except Exception as e:
        print(f'[ERROR] {e}')

    print('\n' + '=' * 60)
    print('All tests completed!')
    print('=' * 60)


if __name__ == '__main__':
    main()

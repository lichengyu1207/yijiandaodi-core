import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = 'http://localhost:8000/api/front'

# 先获取文章列表
print('Getting article list...')
resp = requests.get(f'{BASE_URL}/articles/?page_size=3')
data = resp.json()

# 兼容多种返回格式
articles = data.get('data') or data.get('results') or data
if isinstance(articles, dict):
    articles = articles.get('results', [])

print(f'Found {len(articles)} articles:')
for art in articles[:3]:
    print(f"  - ID: {art.get('id')}, Title: {art.get('title', 'N/A')[:50]}")

if articles:
    first_id = articles[0].get('id')
    print(f'\n\nTesting with article ID: {first_id}')
    print('=' * 60)

    # 测试详情API
    resp2 = requests.get(f'{BASE_URL}/articles/{first_id}/')
    detail = resp2.json()
    print('\nArticle Detail API Response:')
    print(json.dumps(detail, indent=2, ensure_ascii=False))

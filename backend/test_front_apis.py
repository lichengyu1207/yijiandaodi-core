#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""前台API测试脚本 - 简化版"""
import subprocess
import json
import sys
import io

BASE_URL = "http://127.0.0.1:8000"

def test_api(name, url, method='GET', data=None, expected_status=200):
    """使用curl测试单个API"""
    cmd = ['curl', '-s', '-w', '\\n%{http_code}', '-X', method]
    
    if method == 'POST' and data:
        cmd.extend(['-H', 'Content-Type: application/json', '-d', data])
    
    cmd.append(f"{BASE_URL}{url}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        output = result.stdout.strip()
        
        if '\n' in output:
            body, status_code = output.rsplit('\n', 1)
        else:
            body, status_code = '', output
        
        status_code = int(status_code)
        
        status_icon = '✅' if status_code == expected_status else '❌'
        print(f"{status_icon} {name}")
        print(f"   URL: {BASE_URL}{url}")
        print(f"   状态码: {status_code} (期望: {expected_status})")
        
        if status_code == 429:
            print(f"   ⚠️  429 Too Many Requests - 限流问题！")
        elif status_code == 404:
            print(f"   ⚠️  404 Not Found - 路由不存在！")
        elif status_code == expected_status and body:
            try:
                result_data = json.loads(body)
                keys = list(result_data.keys()) if isinstance(result_data, dict) else type(result_data).__name__
                print(f"   返回数据结构: {keys}")
            except:
                pass
        
        print()
        return status_code == expected_status
        
    except Exception as e:
        print(f"❌ {name}")
        print(f"   URL: {BASE_URL}{url}")
        print(f"   错误: {e}\n")
        return False

def main():
    # 设置标准输出编码为 UTF-8
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

    print("=" * 70)
    print("🧪 前台 API 测试 - 验证所有接口是否正常（非429/404）")
    print("=" * 70)
    print("⚠️  请确保 Django 开发服务器已启动在 http://127.0.0.1:8000")
    print("   运行: .\\venv\\Scripts\\python.exe manage.py runserver")
    print()
    
    results = []
    
    # 测试1-6: 基础API
    results.append(test_api(
        "1. GET /api/front/categories/ (分类列表)",
        '/api/front/categories/'
    ))
    
    results.append(test_api(
        "2. GET /api/front/tags/ (标签列表)",
        '/api/front/tags/'
    ))
    
    results.append(test_api(
        "3. GET /api/front/articles/?sort=-publish_time&page=1&page_size=12",
        '/api/front/articles/',
        method='GET'
    ))
    
    results.append(test_api(
        "4. GET /api/front/articles/hot/?period=week (热门文章)",
        '/api/front/articles/hot/?period=week'
    ))
    
    results.append(test_api(
        "5. GET /api/banners/public/ (公开轮播图)",
        '/api/banners/public/'
    ))
    
    # 尝试获取第一篇文章ID
    print("📝 正在获取已发布文章ID用于后续测试...")
    try:
        result = subprocess.run(
            ['curl', '-s', f'{BASE_URL}/api/front/articles/?page_size=1'],
            capture_output=True,
            text=True,
            timeout=5
        )
        data = json.loads(result.stdout)
        
        if data.get('results') and len(data['results']) > 0:
            article_id = data['results'][0]['id']
            print(f"   找到文章 ID: {article_id}\n")
            
            # 测试6-9: 文章相关API
            results.append(test_api(
                f"6. GET /api/front/articles/{article_id}/ (文章详情)",
                f'/api/front/articles/{article_id}/'
            ))
            
            results.append(test_api(
                f"7. POST /api/front/articles/{article_id}/like/ (点赞)",
                f'/api/front/articles/{article_id}/like/',
                method='POST',
                expected_status=200
            ))
            
            results.append(test_api(
                f"8. GET /api/front/articles/{article_id}/comments/ (评论列表)",
                f'/api/front/articles/{article_id}/comments/'
            ))
            
            comment_data = json.dumps({'content': '自动化测试'})
            results.append(test_api(
                f"9. POST /api/front/articles/{article_id}/comments/ (发表评论)",
                f'/api/front/articles/{article_id}/comments/',
                method='POST',
                data=comment_data,
                expected_status=201
            ))
        else:
            print("   ⚠️  没有找到已发布的文章\n")
            results.extend([False, False, False, False])
            
    except Exception as e:
        print(f"   ⚠️  获取文章失败: {e}\n")
        results.extend([False, False, False, False])
    
    # 汇总结果
    print("=" * 70)
    total_tests = len(results)
    passed_count = sum(results)
    failed_count = total_tests - passed_count
    
    success_rate = (passed_count / total_tests * 100) if total_tests > 0 else 0
    print(f"📊 测试汇总:")
    print(f"   总计: {total_tests} 个测试")
    print(f"   通过: {passed_count} ✅")
    print(f"   失败: {failed_count} ❌")
    print(f"   通过率: {success_rate:.1f}%")
    print("=" * 70)
    
    if failed_count > 0:
        print("\n❌ 存在失败的API调用，请检查上方错误信息")
        return 1
    else:
        print("\n🎉 所有前台API测试通过！")
        print("✨ 429限流问题已修复")
        return 0

if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)

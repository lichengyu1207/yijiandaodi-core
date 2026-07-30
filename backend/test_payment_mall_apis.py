#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
支付和商城模块接口验证脚本
用于确认4个关键接口返回200而不是429
"""

import urllib.request
import urllib.error
import json
import sys

BASE_URL = "http://localhost:8000"

TEST_ENDPOINTS = [
    {
        "name": "热门技能排行",
        "url": "/api/payment/hotness/top-skills/?limit=9",
        "method": "GET",
        "expected_status": 200,
        "check_success": True,
        "check_data_key": "items",
    },
    {
        "name": "首单优惠信息",
        "url": "/api/payment/first-order-promo/",
        "method": "GET",
        "expected_status": 200,
        "check_success": True,
        "check_data_key": None,  # 可以为None
    },
    {
        "name": "热门商品",
        "url": "/api/mall/mall-products/hot-products/",
        "method": "GET",
        "expected_status": 200,
        "check_success": True,
        "check_data_key": None,  # 返回列表
    },
    {
        "name": "推荐卡片",
        "url": "/api/recommendation/promo-card/feed-cards/?position=feed_middle&limit=2",
        "method": "GET",
        "expected_status": 200,
        "check_success": True,
        "check_data_key": "cards",
    },
]


def test_endpoint(endpoint):
    """测试单个接口"""
    name = endpoint["name"]
    url = BASE_URL + endpoint["url"]
    method = endpoint.get("method", "GET")
    expected_status = endpoint.get("expected_status", 200)

    print(f"\n{'='*60}")
    print(f"测试: {name}")
    print(f"URL: {url}")
    print(f"方法: {method}")

    try:
        req = urllib.request.Request(url, method=method)
        resp = urllib.request.urlopen(req, timeout=10)

        status = resp.status
        data = json.loads(resp.read().decode())

        print(f"状态码: {status}")

        if status != expected_status:
            print(f"[FAIL] 失败: 期望状态码 {expected_status}, 实际得到 {status}")
            return False

        if endpoint.get("check_success") and not data.get("success"):
            print(f"[FAIL] 失败: success字段不为True")
            return False

        data_key = endpoint.get("check_data_key")
        if data_key:
            actual_data = data.get("data", {})
            if isinstance(actual_data, dict) and data_key in actual_data:
                items = actual_data[data_key]
                print(f"[PASS] 成功! 返回{len(items)}条{data_key}数据")
            else:
                print(f"[PASS] 成功! (数据结构: {type(actual_data).__name__})")
        elif data.get("data") is not None:
            actual_data = data.get("data")
            if isinstance(actual_data, list):
                print(f"[PASS] 成功! 返回{len(actual_data)}条数据")
            elif isinstance(actual_data, dict):
                print(f"[PASS] 成功! 返回字典数据 (keys: {list(actual_data.keys())[:5]})")
            else:
                print(f"[PASS] 成功! 数据类型: {type(actual_data).__name__}")
        else:
            print(f"[PASS] 成功! (data为None或空)")

        return True

    except urllib.error.HTTPError as e:
        print(f"[FAIL] HTTP错误: {e.code} - {e.reason}")
        if e.code == 429:
            print("[WARNING] 这是429 Too Many Requests错误!")
        try:
            error_body = e.read().decode()
            print(f"响应内容: {error_body[:500]}")
        except:
            pass
        return False
    except urllib.error.URLError as e:
        print(f"[FAIL] URL错误: {e.reason}")
        return False
    except Exception as e:
        print(f"[FAIL] 异常: {str(e)}")
        return False


def main():
    """主函数"""
    print("="*60)
    print("支付和商城模块接口验证脚本")
    print("="*60)
    print(f"基础URL: {BASE_URL}")
    print(f"测试时间: __import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')")

    results = []
    for endpoint in TEST_ENDPOINTS:
        result = test_endpoint(endpoint)
        results.append((endpoint["name"], result))

    print("\n" + "="*60)
    print("测试结果汇总:")
    print("="*60)

    passed = sum(1 for _, r in results if r)
    total = len(results)

    for name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{status}: {name}")

    print("\n" + "-"*60)
    print(f"总计: {passed}/{total} 通过")

    if passed == total:
        print("[SUCCESS] 所有接口都返回200状态码，429问题已修复!")
        return 0
    else:
        print(f"[WARNING] 有{total - passed}个接口未通过检查")
        return 1


if __name__ == "__main__":
    sys.exit(main())

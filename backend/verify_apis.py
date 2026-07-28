"""
后台管理模块 API 联调验证脚本
测试 5 个模块的所有关键接口是否返回 200
"""

import requests
import json
import sys
import io

# 设置输出编码为 UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE_URL = "http://localhost:8000/api"

def test_api(name, method, url, expected_status=200, data=None, auth_token=None):
    """测试单个 API 接口"""
    headers = {"Content-Type": "application/json"}
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method == "GET":
            resp = requests.get(f"{BASE_URL}{url}", headers=headers, timeout=10)
        elif method == "POST":
            resp = requests.post(f"{BASE_URL}{url}", headers=headers, json=data, timeout=10)
        else:
            return False, f"Unsupported method: {method}"
        
        status_ok = resp.status_code == expected_status
        status_icon = "[OK]" if status_ok else "[FAIL]"
        print(f"  {status_icon} {name}: {resp.status_code} {method} {url}")
        if not status_ok:
            print(f"      Response: {resp.text[:200]}")
        return status_ok, resp.status_code
    except Exception as e:
        print(f"  [ERROR] {name}: ERROR - {str(e)}")
        return False, str(e)

def get_auth_token():
    """获取认证 token"""
    # 尝试使用超级用户登录
    try:
        resp = requests.post(f"{BASE_URL}/auth/login/", json={
            "username": "admin",
            "password": "Admin123456"
        }, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            # 尝试多种可能的 token 位置
            token = (
                data.get("data", {}).get("access") or
                data.get("data", {}).get("token") or
                data.get("access") or
                data.get("token")
            )
            if token:
                print(f"\n[TOKEN] Got authentication token")
                return token
            print(f"[DEBUG] Login response: {str(data)[:200]}")
    except Exception as e:
        print(f"[DEBUG] Login error: {e}")
    
    print("\n[WARN] Cannot get auth token, testing public APIs only")
    return None

def main():
    print("=" * 70)
    print("[TEST] Backend Admin Module API Integration Test")
    print("=" * 70)
    
    # 获取认证 token
    auth_token = get_auth_token()
    
    results = {
        "passed": 0,
        "failed": 0,
        "errors": []
    }
    
    def record_result(name, ok, detail):
        if ok:
            results["passed"] += 1
        else:
            results["failed"] += 1
            results["errors"].append((name, detail))
    
    # ========== 模块A: RBAC 权限管理 ==========
    print("\n" + "=" * 70)
    print("[Module A] RBAC Permission Management (api/rbac/)")
    print("=" * 70)
    
    rbac_tests = [
        ("Role List", "GET", "/rbac/roles/"),
        ("Permission List", "GET", "/rbac/permissions/"),
        ("Permission Tree", "GET", "/rbac/permissions/tree/"),
        ("Menu List", "GET", "/rbac/menus/"),
        ("Menu Tree", "GET", "/rbac/menus/tree/"),
        ("Operation Logs", "GET", "/rbac/operation-logs/"),
        ("Audit Logs", "GET", "/rbac/permission-audit-logs/"),
    ]
    
    for name, method, url in rbac_tests:
        ok, detail = test_api(name, method, url, auth_token=auth_token)
        record_result(name, ok, detail)
    
    # ========== 模块B: AI Agent 配置 ==========
    print("\n" + "=" * 70)
    print("[Module B] AI Agent Configuration (api/agent/)")
    print("=" * 70)
    
    agent_tests = [
        ("Agent Config List", "GET", "/agent/configs/"),
        ("Public Configs", "GET", "/agent/public/configs/"),
    ]
    
    for name, method, url in agent_tests:
        ok, detail = test_api(name, method, url, auth_token=auth_token)
        record_result(name, ok, detail)
    
    # ========== 模块C: 安全防护 ==========
    print("\n" + "=" * 70)
    print("[Module C] Security Protection (api/security/)")
    print("=" * 70)
    
    security_tests = [
        ("Security Rules", "GET", "/security/rules/"),
        ("Rule Statistics", "GET", "/security/rules/statistics/"),
        ("Risk Logs", "GET", "/security/risk-logs/"),
        ("Risk Summary", "GET", "/security/risk-logs/summary/"),
        ("Content Check (Public)", "POST", "/security/check/check_content/", 
         {"content": "test content"}),
    ]
    
    for test_data in security_tests:
        name = test_data[0]
        method = test_data[1]
        url = test_data[2]
        data = test_data[3] if len(test_data) > 3 else None
        # 内容检测接口是公开的，不需要认证
        if "check_content" in url or "check_tool" in url:
            ok, detail = test_api(name, method, url, data=data)
        else:
            ok, detail = test_api(name, method, url, data=data, auth_token=auth_token)
        record_result(name, ok, detail)
    
    # ========== 模块D: RAG 知识库 ==========
    print("\n" + "=" * 70)
    print("[Module D] RAG Knowledge Base (api/rag/)")
    print("=" * 70)
    
    rag_tests = [
        ("KB Categories", "GET", "/rag/categories/"),
        ("Category Statistics", "GET", "/rag/categories/statistics/"),
        ("Document List", "GET", "/rag/documents/"),
        ("Retrieval Logs", "GET", "/rag/logs/"),
    ]
    
    for name, method, url in rag_tests:
        ok, detail = test_api(name, method, url, auth_token=auth_token)
        record_result(name, ok, detail)
    
    # ========== 模块E: 风控规则 ==========
    print("\n" + "=" * 70)
    print("[Module E] Risk Control Rules (api/risk-control/)")
    print("=" * 70)
    
    risk_tests = [
        ("Risk Control Rules", "GET", "/risk-control/rules/"),
        ("Rule Categories", "GET", "/risk-control/rules/categories/"),
        ("Rule Statistics", "GET", "/risk-control/rules/statistics/"),
        ("Audit Logs", "GET", "/risk-control/audit-logs/"),
        ("Audit Log Statistics", "GET", "/risk-control/audit-logs/statistics/"),
    ]
    
    for name, method, url in risk_tests:
        ok, detail = test_api(name, method, url, auth_token=auth_token)
        record_result(name, ok, detail)
    
    # ========== 结果汇总 ==========
    print("\n" + "=" * 70)
    print("[SUMMARY] Test Results")
    print("=" * 70)
    total = results["passed"] + results["failed"]
    print(f"Total: {total} APIs tested")
    print(f"[PASS] {results['passed']} passed")
    print(f"[FAIL] {results['failed']} failed")
    
    if results["errors"]:
        print("\n[FAILED] APIs:")
        for name, detail in results["errors"]:
            print(f"   - {name}: {detail}")
    
    success_rate = (results["passed"] / total * 100) if total > 0 else 0
    print(f"\nSuccess Rate: {success_rate:.1f}%")
    
    if results["failed"] == 0:
        print("\n[SUCCESS] All APIs passed! Integration successful!")
        return 0
    else:
        print(f"\n[WARNING] {results['failed']} APIs need to be fixed")
        return 1

if __name__ == "__main__":
    sys.exit(main())

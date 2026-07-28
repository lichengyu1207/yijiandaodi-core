# -*- coding: utf-8 -*-
import urllib.request
import json

BASE = "http://127.0.0.1:8000"

def test(name, url, method="GET", data=None):
    try:
        if data:
            req = urllib.request.Request(
                BASE + url,
                data=json.dumps(data).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method=method
            )
        else:
            req = urllib.request.Request(BASE + url, method=method)

        with urllib.request.urlopen(req, timeout=5) as resp:
            body = json.loads(resp.read().decode('utf-8'))
            print(f"[OK] {name}")
            print(f"     URL: {url}")
            print(f"     Status: {resp.status}")
            if isinstance(body, dict):
                print(f"     Keys: {list(body.keys())}")
            else:
                print(f"     Type: {type(body).__name__}")
            print()
            return True
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='ignore')
        print(f"[FAIL] {name}")
        print(f"      URL: {url}")
        print(f"      Status: {e.code}")
        if e.code == 429:
            print("      ERROR: 429 Too Many Requests (Rate Limited!)")
        elif e.code == 404:
            print("      ERROR: 404 Not Found")
        print(f"      Body: {body[:200]}")
        print()
        return False
    except Exception as e:
        print(f"[ERROR] {name}: {e}\n")
        return False

print("=" * 60)
print("Frontend API Test")
print("=" * 60)
print()

results = []

results.append(test("1. Categories", "/api/front/categories/"))
results.append(test("2. Tags", "/api/front/tags/"))
results.append(test("3. Articles List", "/api/front/articles/?sort=-publish_time&page=1&page_size=12"))
results.append(test("4. Hot Articles", "/api/front/articles/hot/?period=week"))
results.append(test("5. Banners Public", "/api/banners/public/"))

# Get first article ID for detail tests
try:
    req = urllib.request.Request(BASE + "/api/front/articles/?page_size=1")
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode())
        articles = data.get('results', [])
        if articles:
            aid = articles[0]['id']
            print(f"Found article ID: {aid}\n")

            results.append(test(f"6. Article Detail ({aid})", f"/api/front/articles/{aid}/"))
            results.append(test(f"7. Like Article ({aid})", f"/api/front/articles/{aid}/like/", "POST"))
            results.append(test(f"8. Comments ({aid})", f"/api/front/articles/{aid}/comments/"))
            results.append(test(f"9. Post Comment ({aid})", f"/api/front/articles/{aid}/comments/", "POST",
                               {"content": "test comment"}))
        else:
            print("[WARN] No published articles found\n")
            results.extend([False]*4)
except Exception as e:
    print(f"[ERROR] Cannot get article ID: {e}\n")
    results.extend([False]*4)

print("=" * 60)
total = len(results)
ok = sum(results)
fail = total - ok
print(f"Result: {ok}/{total} passed, {fail} failed")
if fail == 0:
    print("\nAll APIs working! 429 issue FIXED!")
else:
    print("\nSome tests failed - check above")
print("=" * 60)

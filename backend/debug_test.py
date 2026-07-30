# -*- coding: utf-8 -*-
import urllib.request
import json

BASE = "http://127.0.0.1:8000"

print("Testing comment POST...")
url = BASE + "/api/front/articles/3656/comments/"
data = json.dumps({"content": "test"}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')

try:
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(f"Status: {resp.status}")
        print(f"Body: {resp.read().decode()}")
except urllib.error.HTTPError as e:
    print(f"Error Status: {e.code}")
    print(f"Error Body: {e.read().decode()[:500]}")
except Exception as e:
    print(f"Exception: {e}")

print("\nTesting banners...")
try:
    req2 = urllib.request.Request(BASE + "/api/banners/public/")
    with urllib.request.urlopen(req2, timeout=5) as resp:
        print(f"Status: {resp.status}")
        print(f"Body: {resp.read().decode()[:200]}")
except Exception as e:
    print(f"Error: {e}")

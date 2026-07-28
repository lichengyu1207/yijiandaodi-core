# -*- coding: utf-8 -*-
import urllib.request
import json

BASE = "http://127.0.0.1:8000"

print("Testing article detail...")
try:
    req = urllib.request.Request(BASE + "/api/front/articles/3656/")
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(f"Status: {resp.status}")
        body = resp.read().decode()
        print(f"Body (first 500 chars): {body[:500]}")
except urllib.error.HTTPError as e:
    print(f"Error Status: {e.code}")
    body = e.read().decode()
    print(f"Error Body (first 1000 chars): {body[:1000]}")
except Exception as e:
    print(f"Exception: {e}")

print("\n" + "="*60)
print("Testing comment POST (after fix)...")
try:
    data = json.dumps({"content": "test comment from fix"}).encode('utf-8')
    req = urllib.request.Request(
        BASE + "/api/front/articles/3656/comments/",
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(f"Status: {resp.status}")
        body = resp.read().decode()
        print(f"Body: {body[:500]}")
except urllib.error.HTTPError as e:
    print(f"Error Status: {e.code}")
    body = e.read().decode()
    print(f"Error Body: {body[:500]}")
except Exception as e:
    print(f"Exception: {e}")

print("\n" + "="*60)
print("Testing banners public via /api/front/banners/public/...")
try:
    req = urllib.request.Request(BASE + "/api/front/banners/public/")
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(f"Status: {resp.status}")
        body = resp.read().decode()
        print(f"Body (first 300 chars): {body[:300]}")
except urllib.error.HTTPError as e:
    print(f"Error Status: {e.code}")
except Exception as e:
    print(f"Exception: {e}")

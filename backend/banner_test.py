# -*- coding: utf-8 -*-
import urllib.request
import json

BASE = "http://127.0.0.1:8000"

print("Test 1: /api/banners/public/ (original frontend call)")
try:
    req = urllib.request.Request(BASE + "/api/banners/public/")
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(f"  Status: {resp.status}")
        print(f"  Body: {resp.read().decode()[:300]}")
except urllib.error.HTTPError as e:
    print(f"  Error: {e.code}")
except Exception as e:
    print(f"  Exception: {e}")

print("\nTest 2: /api/front/banners/public/ (new route)")
try:
    req = urllib.request.Request(BASE + "/api/front/banners/public/")
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(f"  Status: {resp.status}")
        print(f"  Body: {resp.read().decode()[:300]}")
except urllib.error.HTTPError as e:
    print(f"  Error: {e.code}")
except Exception as e:
    print(f"  Exception: {e}")

print("\nTest 3: /api/content/banners/public/ (via content urls)")
try:
    req = urllib.request.Request(BASE + "/api/content/banners/public/")
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(f"  Status: {resp.status}")
        print(f"  Body: {resp.read().decode()[:300]}")
except urllib.error.HTTPError as e:
    print(f"  Error: {e.code}")
except Exception as e:
    print(f"  Exception: {e}")

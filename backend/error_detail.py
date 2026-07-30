# -*- coding: utf-8 -*-
import urllib.request
import json
import re

BASE = "http://127.0.0.1:8000"

print("Getting full error for article detail...")
try:
    req = urllib.request.Request(BASE + "/api/front/articles/3656/")
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(f"Status: {resp.status}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    # Extract traceback
    match = re.search(r'<pre class="exception_value">(.*?)</pre>', body, re.DOTALL)
    if match:
        print(f"Exception: {match.group(1).strip()}")
    
    # Extract traceback details
    match2 = re.search(r'<div id="traceback">(.*?)</div>', body, re.DOTALL)
    if match2:
        tb = match2.group(1)
        # Find the error line
        lines = tb.split('\n')
        for i, line in enumerate(lines):
            if 'AssertionError' in line or 'front_views.py' in line or 'front_serializers.py' in line:
                print(f"Traceback context: ...{line.strip()}...")
                if i+1 < len(lines):
                    print(f"Next line: ...{lines[i+1].strip()}...")

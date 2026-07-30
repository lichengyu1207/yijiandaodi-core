import urllib.request
import sys

try:
    r = urllib.request.urlopen('http://127.0.0.1:8000/api/banners/public/')
    print(f"STATUS: {r.status}")
    print(f"BODY: {r.read().decode()}")
except urllib.error.HTTPError as e:
    print(f"ERROR STATUS: {e.code}", file=sys.stderr)
    print(f"ERROR BODY: {e.read().decode()[:500]}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"EXCEPTION: {e}", file=sys.stderr)
    sys.exit(1)

import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()

from django.urls import reverse, resolve

# Test 1: reverse
try:
    url = reverse('p2p-pipeline-summary')
    print(f'REVERSE OK: {url}', flush=True)
except Exception as e:
    print(f'REVERSE ERROR: {e}', flush=True)

# Test 2: resolve
try:
    match = resolve('/api/p2p/v1/pipeline/summary/')
    print(f'RESOLVE OK: {match.func.__name__}', flush=True)
except Exception as e:
    print(f'RESOLVE ERROR: {e}', flush=True)

# Test 3: resolve execute
try:
    match = resolve('/api/p2p/v1/pipeline/execute')
    print(f'RESOLVE EXECUTE OK: {match.func.__name__}', flush=True)
except Exception as e:
    print(f'RESOLVE EXECUTE ERROR: {e}', flush=True)

# Test 4: list all p2p urls
from p2p_app import urls as p2p_urls
print(f'\nP2P URL patterns ({len(p2p_urls.urlpatterns)}):', flush=True)
for p in p2p_urls.urlpatterns:
    print(f'  {p.pattern} -> {p.name or p.callback.__name__ if hasattr(p, "callback") else "?"}', flush=True)

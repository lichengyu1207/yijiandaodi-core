import os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
import django
django.setup()

from django.test import Client
c = Client()

urls_to_test = [
    '/api/p2p/v1/network/topology',
    '/api/p2p/v1/security/check',
    '/api/p2p/v1/workflows',
    '/api/p2p/v1/pipeline/summary/',
    '/api/p2p/v1/pipeline/execute',
]

for u in urls_to_test:
    resp = c.get(u)
    print(f'{u} -> {resp.status_code}', flush=True)
    if resp.status_code == 500:
        print(f'  ERROR: {resp.content.decode()[:500]}', flush=True)

# Also try: can we access PipelineSummaryView directly?
print('\n--- Direct view test ---', flush=True)
try:
    from p2p_app.views import PipelineSummaryView
    v = PipelineSummaryView()
    print(f'PipelineSummaryView OK, methods={v.http_method_names}', flush=True)
except Exception as e:
    print(f'Direct import error: {e}', flush=True)
    import traceback
    traceback.print_exc()

import sys, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')

import django
django.setup()

# Try the simplest possible test: just load URLconf
print('Loading URLconf...', flush=True)
try:
    from django.urls import clear_url_caches, set_urlconf
    from fangdudu_backend.urls import urlpatterns as root_patterns
    print(f'Root URLconf loaded: {len(root_patterns)} patterns', flush=True)
    
    # Find p2p resolver
    for p in root_patterns:
        if hasattr(p, 'url_pattern_name') or (hasattr(p, 'pattern') and 'p2p' in str(p.pattern)):
            print(f'  P2P pattern: {p.pattern}', flush=True)
            if hasattr(p, 'url_patterns'):
                for sp in p.url_patterns:
                    sname = getattr(sp, 'name', '')
                    if 'pipeline' in sname:
                        print(f'    PIPELINE: {sp.pattern} -> {sname}', flush=True)
except Exception as e:
    print(f'URLconf ERROR: {e}', flush=True)
    import traceback
    traceback.print_exc()

print('DONE', flush=True)

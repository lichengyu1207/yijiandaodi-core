import sys, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')

# Capture all output
print('=== Starting Django runserver check ===', flush=True)

try:
    import django
    from django.core.management import execute_from_command_line
    print('Django imported OK', flush=True)
    
    # Instead of runserver, just test URLconf loading
    from django.urls import get_resolver
    resolver = get_resolver()
    print(f'URLconf loaded: {len(resolver.url_patterns)} top-level patterns', flush=True)
    
    # Try to find pipeline patterns
    def find_patterns(patterns, depth=0):
        for p in patterns:
            name = getattr(p, 'name', '') or ''
            pattern = str(getattr(p, 'pattern', ''))
            if 'pipeline' in (name + pattern).lower():
                print(f'  {"  "*depth}FOUND: {pattern} -> {name}', flush=True)
            if hasattr(p, 'url_patterns'):
                find_patterns(p.url_patterns, depth+1)
    
    find_patterns(resolver.url_patterns)
    print('=== Check complete ===', flush=True)

except Exception as e:
    import traceback
    print(f'ERROR: {e}', flush=True)
    traceback.print_exc(file=sys.stdout)

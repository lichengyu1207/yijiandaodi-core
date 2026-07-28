import os, sys
os.chdir(r'C:\MsSafeData\Desktop\yijiandaodi\backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
sys.path.insert(0, '.')
import django
django.setup()
from content_app.models import Article, Category

print('=== Sample Articles ===')
for a in Article.objects.all()[:10]:
    print(f'  [{a.id}] "{a.title[:50]}" | xinfa={a.xinfa_tag} | zone={a.zone_id} | pinned={a.is_pinned}')

print('\n=== Xinfa Tag Distribution ===')
from django.db.models import Count
for row in Article.objects.values_list('xinfa_tag').annotate(c=Count('id')).order_by('-c'):
    print(f'  {row[0] or "(empty)"}: {row[1]}')

print('\n=== Category Distribution ===')
for c in Category.objects.all():
    cnt = Article.objects.filter(category=c).count()
    print(f'  [{c.id}] {c.name}: {cnt}')

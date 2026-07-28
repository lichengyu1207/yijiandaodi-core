import os, sys
os.chdir(r'C:\MsSafeData\Desktop\yijiandaodi\backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
sys.path.insert(0, '.')
import django
django.setup()
from content_app.models import Article, Category, Tag

with open(r'C:\MsSafeData\Desktop\yijiandaodi\backend\db_check.txt', 'w', encoding='utf-8') as f:
    f.write(f'Categories: {Category.objects.count()}\n')
    for c in Category.objects.all():
        f.write(f'  [{c.id}] {c.name} ({c.slug})\n')
    
    f.write(f'\nArticles: {Article.objects.count()}\n')
    if Article.objects.exists():
        for a in Article.objects.all()[:10]:
            f.write(f'  [{a.id}] "{a.title[:60]}" | xinfa={a.xinfa_tag} | zone={a.zone_id} | pinned={a.is_pinned}\n')
    
    f.write(f'\nXinfa Tag Distribution:\n')
    from django.db.models import Count
    for row in Article.objects.values_list('xinfa_tag').annotate(c=Count('id')).order_by('-c'):
        f.write(f'  {row[0] or "(empty)"}: {row[1]}\n')
    
    f.write(f'\nPinned: {Article.objects.filter(is_pinned=True).count()}\n')
    f.write(f'Published: {Article.objects.filter(status="published").count()}\n')
    f.write(f'Tags: {Tag.objects.count()}\n')

print('Done, check db_check.txt')

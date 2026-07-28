import os, sys
os.chdir(r'C:\MsSafeData\Desktop\yijiandaodi\backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
sys.path.insert(0, '.')
import django
django.setup()
from content_app.models import Article, Category, Tag

print(f'Categories: {Category.objects.count()}')
for c in Category.objects.all():
    print(f'  [{c.id}] {c.name} ({c.slug})')

print(f'\nArticles: {Article.objects.count()}')
if Article.objects.exists():
    a = Article.objects.first()
    print(f'  First: "{a.title}" | xinfa={a.xinfa_tag} | cat={a.category.name if a.category else None}')
    
print(f'\nTags: {Tag.objects.count()}')
for t in Tag.objects.all()[:10]:
    print(f'  - {t.name}')

print(f'\nPinned: {Article.objects.filter(is_pinned=True).count()}')
print(f'Published: {Article.objects.filter(status="published").count()}')

import os, sys
os.chdir(r'C:\MsSafeData\Desktop\yijiandaodi\backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
sys.path.insert(0, '.')
import django
django.setup()
from content_app.models import Article

with open(r'C:\MsSafeData\Desktop\yijiandaodi\backend\titles_check.txt', 'w', encoding='utf-8') as f:
    articles = Article.objects.all().order_by('id')[:30]
    f.write(f'Total: {Article.objects.count()}\n\n')
    for a in articles:
        f.write(f'[{a.id}] ({len(a.title)}字) "{a.title}"\n')
    f.write('\n--- len stats ---\n')
    lengths = [len(a.title) for a in Article.objects.all()]
    import statistics
    f.write(f'min={min(lengths)}, max={max(lengths)}, avg={statistics.mean(lengths):.0f}, median={statistics.median(lengths):.0f}\n')
print('Done')

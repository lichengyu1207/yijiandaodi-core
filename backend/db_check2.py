import os, sys, django
sys.path.insert(0, '.')
os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
django.setup()
from content_app.models import Article, Category
with open('db_result.txt', 'w', encoding='utf-8') as f:
    f.write('Articles: %d\n' % Article.objects.count())
    f.write('Categories: %d\n' % Category.objects.count())
    arts = list(Article.objects.all()[:5])
    for a in arts:
        f.write('\n--- Article %d ---\n' % a.id)
        f.write('Title: %s\n' % a.title)
        f.write('Category: %s\n' % (a.category.name if a.category else 'None'))
        f.write('Summary(first 80): %s...\n' % a.summary[:80] if a.summary else 'None')
print('DONE - check db_result.txt')

import os, sys, django
sys.path.insert(0, '.')
os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
django.setup()
from content_app.models import Article, Category, Tag, FrontAuthor
print('Articles:', Article.objects.count())
print('Categories:', Category.objects.count())
print('Tags:', Tag.objects.count())
print('Authors:', FrontAuthor.objects.count())
a = Article.objects.first()
if a:
    print('First ID:', a.id)
    print('Title repr:', repr(a.title[:80]))
    print('Category:', a.category.name if a.category else 'None')

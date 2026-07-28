import os, sys, django
sys.path.insert(0, '.')
os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
django.setup()
from content_app.models import Article
arts = list(Article.objects.all()[:3])
with open('cover_result.txt', 'w', encoding='utf-8') as f:
    for a in arts:
        f.write('[%d] %s\n' % (a.id, a.cover_image))
print('DONE')

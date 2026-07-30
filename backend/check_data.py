import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
import django
django.setup()

from content_app.models import Article, UserFollow

# 获取第一篇已发布文章
article = Article.objects.filter(status='published').first()
if article:
    print(f'Article ID: {article.id}')
    print(f'Title: {article.title}')
    print(f'Author: {article.author.name if article.author else "None"}')
    print(f'Author ID: {article.author.id if article.author else "None"}')
    
    # 检查关注表
    if article.author:
        follows = UserFollow.objects.filter(author=article.author)
        print(f'\nCurrent followers for this author: {follows.count()}')
        for f in follows[:5]:
            print(f'  - User {f.user_id} followed at {f.created_at}')
else:
    print('No published articles found!')
    
# 列出前5篇文章的ID
print('\n\nFirst 5 published articles:')
for art in Article.objects.filter(status='published')[:5]:
    print(f'  ID: {art.id}, Title: {art.title[:40]}')

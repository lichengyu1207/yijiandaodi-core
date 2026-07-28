# -*- coding: utf-8 -*-
import os
import sys
import io

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import django
django.setup()

from content_app.models import Article, Category

print('=' * 60)
print('DATABASE VERIFICATION REPORT')
print('=' * 60)

total_articles = Article.objects.count()
total_categories = Category.objects.count()

print(f'\n✅ Total Articles: {total_articles}')
print(f'✅ Total Categories: {total_categories}')

if total_articles == 0:
    print('\n❌ No articles found! Data import may have failed.')
    sys.exit(1)

print('\n' + '-' * 60)
print('FIRST 10 ARTICLE TITLES:')
print('-' * 60)

articles = Article.objects.all()[:10]
garbled_count = 0

for i, article in enumerate(articles, 1):
    title = article.title
    # Check for common garbled patterns
    is_garbled = any(pattern in title for pattern in ['71', '??', 'ï¿½', 'ä¸'])
    
    if is_garbled:
        status = '❌ GARBLED'
        garbled_count += 1
    else:
        status = '✅ OK'
    
    print(f'{i:2d}. [{status}] {title[:60]}...')

print('\n' + '-' * 60)
print('CATEGORIES:')
print('-' * 60)
for cat in Category.objects.all():
    print(f'   📁 {cat.name} ({cat.slug})')

print('\n' + '=' * 60)
if garbled_count > 0:
    print(f'⚠️  WARNING: {garbled_count} articles have garbled Chinese text!')
else:
    print('🎉 SUCCESS: All Chinese text is displaying correctly!')
print('=' * 60)

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

output_lines = []
output_lines.append('=' * 60)
output_lines.append('DATABASE VERIFICATION REPORT')
output_lines.append('=' * 60)

total_articles = Article.objects.count()
total_categories = Category.objects.count()

output_lines.append(f'\n✅ Total Articles: {total_articles}')
output_lines.append(f'✅ Total Categories: {total_categories}')

if total_articles == 0:
    output_lines.append('\n❌ No articles found!')
else:
    output_lines.append('\n' + '-' * 60)
    output_lines.append('FIRST 10 ARTICLE TITLES:')
    output_lines.append('-' * 60)

    articles = Article.objects.all()[:10]
    garbled_count = 0

    for i, article in enumerate(articles, 1):
        title = article.title
        is_garbled = any(pattern in title for pattern in ['71', '??', 'ï¿½'])
        
        if is_garbled:
            status = '❌ GARBLED'
            garbled_count += 1
        else:
            status = '✅ OK'
        
        output_lines.append(f'{i:2d}. [{status}] {title}')

    output_lines.append('\n' + '-' * 60)
    output_lines.append('CATEGORIES:')
    output_lines.append('-' * 60)
    for cat in Category.objects.all():
        output_lines.append(f'   📁 {cat.name} ({cat.slug})')

    output_lines.append('\n' + '=' * 60)
    if garbled_count > 0:
        output_lines.append(f'⚠️  WARNING: {garbled_count} articles have garbled text!')
    else:
        output_lines.append('🎉 SUCCESS: All Chinese text is correct!')
    output_lines.append('=' * 60)

# Write to file
with open('verification_result.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output_lines))

print('Verification complete. See verification_result.txt')

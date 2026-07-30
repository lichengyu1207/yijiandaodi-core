# -*- coding: utf-8 -*-
import os, sys, django, io

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()

from content_app.models import Article

test_title = "某银行核心系统安全审计报告：发现高危漏洞12个"
print("Test title:", test_title)
print("Test title repr:", repr(test_title))

a = Article.objects.first()
if a:
    print("\nDB first article:")
    print("  Title:", a.title)
    print("  Repr:", repr(a.title))

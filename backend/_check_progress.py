import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
import django; django.setup()
from content_app.rag_models import KnowledgeDocument, DocumentChunk
d = KnowledgeDocument.objects.count()
c = DocumentChunk.objects.count()
pct = c / 100000 * 100
print(f"Docs={d} Chunks={c} Progress={pct:.1f}%")

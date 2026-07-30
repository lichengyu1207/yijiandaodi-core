import os
import time
from django.utils import timezone
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.filters import SearchFilter, OrderingFilter
from django.conf import settings

from .rag_models import (
    KnowledgeBaseCategory,
    KnowledgeDocument,
    DocumentChunk,
    RetrievalLog,
    RAGOperationLog,
)
from .rag_serializers import (
    KnowledgeBaseCategorySerializer,
    KnowledgeDocumentListSerializer,
    KnowledgeDocumentDetailSerializer,
    DocumentUploadSerializer,
    DocumentChunkSerializer,
    RetrievalRequestSerializer,
    RetrievalResponseSerializer,
    RAGQuestionRequestSerializer,
    RAGQuestionResponseSerializer,
    RetrievalLogSerializer,
    RAGOperationLogSerializer,
)
from .rag_audit_mixin import RAGAuditMixin
from .rag_service import (
    DocumentParser,
    TextChunker,
    EmbeddingService,
    RetrievalService,
    RAGPipeline,
)


class KnowledgeCategoryViewSet(viewsets.ModelViewSet):
    """知识库分类管理 API"""
    queryset = KnowledgeBaseCategory.objects.all()
    serializer_class = KnowledgeBaseCategorySerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data,
        })

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        from django.db.models import Sum
        stats = {
            'total_categories': KnowledgeBaseCategory.objects.filter(is_active=True).count(),
            'total_documents': KnowledgeDocument.objects.filter(status='completed').count(),
            'total_chunks': DocumentChunk.objects.count(),
            'total_size_bytes': KnowledgeDocument.objects.aggregate(
                total=Sum('file_size')
            )['total'] or 0,
        }
        return Response({'success': True, 'data': stats})


class KnowledgeDocumentViewSet(viewsets.ModelViewSet):
    """知识库文档管理 API"""
    queryset = KnowledgeDocument.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return KnowledgeDocumentListSerializer
        elif self.action == 'retrieve':
            return KnowledgeDocumentDetailSerializer
        return KnowledgeDocumentDetailSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        category_id = request.query_params.get('category_id')
        doc_status = request.query_params.get('status')
        search = request.query_params.get('search')

        if category_id:
            queryset = queryset.filter(category_id=category_id)
        if doc_status:
            queryset = queryset.filter(status=doc_status)
        if search:
            queryset = queryset.filter(title__icontains=search)

        queryset = queryset.order_by('-created_at')
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data,
        })

    @action(detail=False, methods=['post'])
    def upload(self, request):
        """
        上传并处理文档

        流程: 上传 → 解析 → 分块 → 向量化 → 入库
        """
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = serializer.validated_data
        uploaded_file = validated_data['file']
        start_time = time.time()

        try:
            # Step 1: 保存文件
            upload_dir = os.path.join(settings.MEDIA_ROOT, 'knowledge_base', str(validated_data['category_id']))
            os.makedirs(upload_dir, exist_ok=True)

            file_path = os.path.join(upload_dir, uploaded_file.name)
            with open(file_path, 'wb+') as f:
                for chunk in uploaded_file.chunks():
                    f.write(chunk)

            # Step 2: 创建文档记录
            file_type = self._detect_file_type(uploaded_file.name)
            document = KnowledgeDocument.objects.create(
                title=validated_data['title'],
                category_id=validated_data['category_id'],
                file_name=uploaded_file.name,
                file_path=file_path,
                file_size=uploaded_file.size,
                file_type=file_type,
                status='uploading',
                progress=0,
                uploaded_by=getattr(request.user, 'id', 0) or 0,
                is_public=validated_data.get('is_public', True),
            )

            # Step 3: 异步处理（简化版，实际可用Celery）
            self._process_document(document, file_path, file_type)

            RAGAuditMixin.log_operation(
                request, 'upload', 'document', document.id, document.title,
                detail={'file_name': uploaded_file.name, 'file_size': uploaded_file.size, 'category_id': validated_data['category_id']},
                duration_ms=time.time() * 1000 - start_time
            )

            return Response({
                'success': True,
                'message': '文档上传成功，正在后台处理中',
                'data': {
                    'document_id': document.id,
                    'status': document.status,
                    'progress': document.progress,
                }
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'文档处理失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def chunks(self, request, pk=None):
        """获取文档的所有分片"""
        document = self.get_object()
        chunks = document.chunks.all().order_by('chunk_index')
        serializer = DocumentChunkSerializer(chunks, many=True)
        return Response({
            'success': True,
            'count': chunks.count(),
            'data': serializer.data,
        })

    @action(detail=True, methods=['delete'])
    def delete_with_chunks(self, request, pk=None):
        """删除文档及其所有分片"""
        document = self.get_object()
        doc_title = document.title
        category = document.category

        # 删除文件
        if document.file_path and os.path.exists(document.file_path):
            os.remove(document.file_path)

        # 删除分片（级联删除）
        chunk_count = document.chunks.count()
        document.chunks.all().delete()

        # 先删文档，再更新分类统计
        document.delete()

        # 更新分类统计（此时文档已删除，count 正确）
        if category:
            category.update_counts()

        RAGAuditMixin.log_operation(
            request, 'delete', 'document', pk, doc_title,
            detail={'chunks_deleted': chunk_count}
        )

        return Response({
            'success': True,
            'message': f'已删除文档「{doc_title}」及{chunk_count}个分片',
        })

    @staticmethod
    def _detect_file_type(filename: str) -> str:
        ext = filename.lower().split('.')[-1] if '.' in filename else ''
        type_map = {
            'pdf': 'pdf', 'doc': 'word', 'docx': 'word',
            'txt': 'txt', 'md': 'markdown', 'markdown': 'markdown',
            'xls': 'excel', 'xlsx': 'excel', 'html': 'html',
            'json': 'json',
        }
        return type_map.get(ext, 'other')

    @staticmethod
    def _process_document(document: KnowledgeDocument, file_path: str, file_type: str):
        """
        处理文档：解析 → 分块 → 向量化
        （同步执行，生产环境应使用异步任务队列）
        """
        try:
            # 解析
            document.status = 'parsing'
            document.progress = 20
            document.save()

            parsed = DocumentParser.parse_file(file_path, file_type)
            text_content = parsed['text']
            sections = parsed.get('sections', [])

            document.word_count = len(text_content.split())
            summary_raw = text_content[:500].strip()
            document.summary = summary_raw if len(summary_raw) > 10 else f'{document.title} - {document.file_name}'
            document.save(update_fields=['word_count', 'summary'])

            # 分块
            document.status = 'chunking'
            document.progress = 50
            document.save()

            chunks = TextChunker.chunk_text(
                text_content,
                sections=sections,
            )

            # 向量化 + 入库
            document.status = 'embedding'
            document.progress = 70
            document.save()

            created_chunks = []
            for chunk_data in chunks:
                embedding = EmbeddingService.generate_embedding(chunk_data['content'])
                encoded_embedding = EmbeddingService.encode_embedding_to_base64(embedding)

                chunk_obj = DocumentChunk.objects.create(
                    document=document,
                    chunk_index=chunk_data['index'],
                    content=chunk_data['content'],
                    page_number=chunk_data['page_number'],
                    section_title=chunk_data['section_title'],
                    token_count=chunk_data['token_count'],
                    char_count=chunk_data['char_count'],
                    embedding=encoded_embedding,
                )
                created_chunks.append(chunk_obj)

            # 完成
            document.status = 'completed'
            document.progress = 100
            document.chunk_count = len(created_chunks)
            document.page_count = len(sections)
            document.save()

            # 更新分类统计
            if document.category:
                document.category.update_counts()

        except Exception as e:
            document.status = 'failed'
            document.error_message = str(e)
            document.save()


class RAGSearchViewSet(viewsets.GenericViewSet):
    """RAG 检索和问答 API（公开接口）"""
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'])
    def search(self, request):
        """
        知识库检索接口

        支持三种模式：
        - semantic: 纯语义检索
        - keyword: 纯关键词检索
        - hybrid: 混合检索（默认）
        """
        serializer = RetrievalRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        query = serializer.validated_data['query']
        category_slug = serializer.validated_data.get('category_slug', '')
        top_k = serializer.validated_data.get('top_k', 5)
        query_type = serializer.validated_data.get('query_type', 'hybrid')
        min_score = serializer.validated_data.get('min_score', 0.5)

        start_time = time.time()

        if query_type == 'semantic':
            results, total, _ = RetrievalService.semantic_search(
                query, category_slug, top_k, min_score
            )
        elif query_type == 'keyword':
            results, total, _ = RetrievalService.keyword_search(
                query, category_slug, top_k
            )
        else:
            results, total, _ = RetrievalService.hybrid_search(
                query, category_slug, top_k, min_score
            )

        response_time = int((time.time() - start_time) * 1000)

        # 记录审计日志
        RAGAuditMixin.log_operation(
            request, 'search', 'search', None, query[:100],
            detail={'query_type': query_type, 'top_k': top_k, 'results_count': len(results)},
            duration_ms=response_time
        )

        # 记录日志
        user_id = getattr(request.user, 'id', None) or request.data.get('user_id', 0)
        RetrievalLog.objects.create(
            query=query,
            query_type=query_type,
            results_count=len(results),
            top_chunks=[r['chunk_id'] for r in results],
            response_time_ms=response_time,
            user_id=user_id,
            session_id=request.data.get('session_id', ''),
            ip_address=self._get_client_ip(request),
        )

        return Response({
            'success': True,
            'data': {
                'query': query,
                'results': results,
                'total_found': total,
                'response_time_ms': response_time,
                'query_type': query_type,
            }
        })

    @action(detail=False, methods=['post'])
    def ask(self, request):
        """
        RAG问答接口

        基于知识库内容生成答案，附带引用来源
        """
        serializer = RAGQuestionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question = serializer.validated_data['question']
        category_slug = serializer.validated_data.get('category_slug', '')
        top_k = serializer.validated_data.get('top_k', 3)

        result = RAGPipeline.answer_question(question, category_slug, top_k)

        # 记录审计日志
        RAGAuditMixin.log_operation(
            request, 'ask', 'ask', None, question[:100],
            detail={'top_k': top_k, 'sources_count': len(result.get('sources', []))},
            duration_ms=result.get('response_time_ms', 0)
        )

        # 记录日志
        user_id = getattr(request.user, 'id', None) or request.data.get('user_id', 0)
        RetrievalLog.objects.create(
            query=f'[Q&A] {question}',
            query_type='hybrid',
            results_count=len(result.get('sources', [])),
            top_chunks=[s['chunk_id'] for s in result.get('sources', [])],
            response_time_ms=result.get('response_time_ms', 0),
            user_id=user_id,
            session_id=serializer.validated_data.get('session_id', ''),
            ip_address=self._get_client_ip(request),
        )

        return Response({
            'success': True,
            'data': result
        })

    @staticmethod
    def _get_client_ip(request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '')


class RetrievalLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """检索日志查询 API（只读）"""
    queryset = RetrievalLog.objects.all()
    serializer_class = RetrievalLogSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        query_type = request.query_params.get('query_type')

        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)
        if query_type:
            queryset = queryset.filter(query_type=query_type)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data,
        })


class RAGOperationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """RAG操作审计日志（只读）"""
    queryset = RAGOperationLog.objects.all()
    serializer_class = RAGOperationLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['target_name', 'username', 'error_message', 'action']
    ordering_fields = ['created_at', 'duration_ms', 'action']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        action = self.request.query_params.get('action')
        status_param = self.request.query_params.get('status')
        target_type = self.request.query_params.get('target_type')

        if action:
            qs = qs.filter(action=action)
        if status_param:
            qs = qs.filter(status=status_param)
        if target_type:
            qs = qs.filter(target_type=target_type)
        return qs

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        from django.db.models import Count
        from datetime import timedelta

        qs = RAGOperationLog.objects.all()

        today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

        stats = {
            'total': qs.count(),
            'today': qs.filter(created_at__gte=today).count(),
            'success': qs.filter(status='success').count(),
            'failed': qs.filter(status='failed').count(),
            'by_action': dict(qs.values_list('action').annotate(count=Count('id')).order_by('-count')),
            'by_status': dict(qs.values_list('status').annotate(count=Count('id'))),
            'recent_7_days': [],
        }

        for i in range(7):
            day = today - timedelta(days=6-i)
            day_count = qs.filter(created_at__date=day.date()).count()
            stats['recent_7_days'].append({
                'date': day.strftime('%Y-%m-%d'),
                'count': day_count
            })

        return Response({'success': True, 'data': stats})

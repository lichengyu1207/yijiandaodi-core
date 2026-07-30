from rest_framework import serializers
from .rag_models import (
    KnowledgeBaseCategory,
    KnowledgeDocument,
    DocumentChunk,
    RetrievalLog,
    RAGOperationLog,
)


class KnowledgeBaseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeBaseCategory
        fields = [
            'id', 'name', 'slug', 'description', 'icon',
            'sort_order', 'is_active', 'document_count', 'chunk_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'document_count', 'chunk_count', 'created_at', 'updated_at']


class DocumentChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentChunk
        fields = [
            'id', 'chunk_index', 'content', 'metadata',
            'page_number', 'section_title', 'token_count',
            'char_count', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class KnowledgeDocumentListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    file_type_display = serializers.CharField(source='get_file_type_display', read_only=True)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get('summary'):
            import re
            summary = re.sub(r'<[^>]+>', ' ', str(data['summary']))
            summary = re.sub(r'[^\u4e00-\u9fffa-zA-Z0-9\s\.,;:!?()（）。，；：！？、\-]', '', summary)
            summary = re.sub(r'\s+', ' ', summary).strip()
            data['summary'] = summary[:200] if len(summary) > 10 else ''
        return data

    class Meta:
        model = KnowledgeDocument
        fields = [
            'id', 'title', 'category', 'category_name',
            'file_name', 'file_size', 'file_type', 'file_type_display',
            'status', 'status_display', 'progress',
            'word_count', 'chunk_count', 'summary',
            'is_public', 'uploaded_by',
            'created_at', 'updated_at',
        ]


class KnowledgeDocumentDetailSerializer(serializers.ModelSerializer):
    category = KnowledgeBaseCategorySerializer(read_only=True)
    chunks = DocumentChunkSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    file_type_display = serializers.CharField(source='get_file_type_display', read_only=True)

    class Meta:
        model = KnowledgeDocument
        fields = [
            'id', 'title', 'category', 'file_name', 'file_path',
            'file_size', 'file_type', 'file_type_display',
            'status', 'status_display', 'progress', 'error_message',
            'page_count', 'word_count', 'chunk_count',
            'summary', 'keywords',
            'is_public', 'allowed_roles',
            'uploaded_by', 'chunks',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'status', 'progress', 'created_at', 'updated_at']


class DocumentUploadSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=500, required=True)
    category_id = serializers.IntegerField(required=True)
    file = serializers.FileField(required=True)
    is_public = serializers.BooleanField(default=True)


class RetrievalRequestSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=2000, required=True)
    category_slug = serializers.CharField(max_length=100, required=False, default='')
    top_k = serializers.IntegerField(default=5, min_value=1, max_value=20)
    query_type = serializers.ChoiceField(
        choices=['semantic', 'keyword', 'hybrid'],
        default='hybrid'
    )
    min_score = serializers.FloatField(default=0.5, min_value=0.0, max_value=1.0)


class RetrievalResultSerializer(serializers.Serializer):
    chunk_id = serializers.IntegerField()
    content = serializers.CharField()
    document_title = serializers.CharField()
    score = serializers.FloatField()
    metadata = serializers.DictField()
    page_number = serializers.IntegerField(default=0)
    section_title = serializers.CharField(default='')


class RetrievalResponseSerializer(serializers.Serializer):
    query = serializers.CharField()
    results = RetrievalResultSerializer(many=True)
    total_found = serializers.IntegerField()
    response_time_ms = serializers.IntegerField()
    query_type = serializers.CharField()


class RAGQuestionRequestSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=2000, required=True)
    category_slug = serializers.CharField(max_length=100, required=False, default='')
    top_k = serializers.IntegerField(default=3, min_value=1, max_value=10)
    session_id = serializers.CharField(max_length=100, required=False, default='')
    user_id = serializers.IntegerField(required=False, default=0)


class RAGQuestionResponseSerializer(serializers.Serializer):
    answer = serializers.CharField()
    sources = RetrievalResultSerializer(many=True)
    confidence = serializers.FloatField()
    model_used = serializers.CharField()
    response_time_ms = serializers.IntegerField()


class RetrievalLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = RetrievalLog
        fields = [
            'id', 'query', 'query_type', 'results_count',
            'response_time_ms', 'user_id', 'session_id',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class RAGOperationLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    user_info = serializers.SerializerMethodField()

    class Meta:
        model = RAGOperationLog
        fields = ['id', 'action', 'action_display', 'target_type', 'target_id',
                  'target_name', 'username', 'ip_address', 'status', 'status_display',
                  'error_message', 'duration_ms', 'request_detail', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_user_info(self, obj):
        if obj.username:
            return obj.username
        return obj.ip_address or '系统'

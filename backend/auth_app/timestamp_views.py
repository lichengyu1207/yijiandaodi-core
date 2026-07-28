"""
可信时间戳API视图

接口：
- GET /api/timestamp/now/ - 获取当前北京时间
- POST /api/timestamp/generate/ - 生成时间戳
- POST /api/timestamp/verify/ - 验证时间戳
- POST /api/timestamp/chain/ - 构建证据链
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .trusted_timestamp import (
    get_timestamp_service,
    get_evidence_chain_builder,
)


class TrustedTimestampViewSet(viewsets.ViewSet):
    """可信时间戳API"""
    
    permission_classes = [AllowAny]
    
    @extend_schema(
        summary='获取当前北京时间',
        description='从国家授时中心获取可信北京时间（UTC+8）',
    )
    @action(detail=False, methods=['get'])
    def now(self, request):
        """获取当前北京时间"""
        
        service = get_timestamp_service()
        beijing_time = service.get_beijing_time()
        
        return Response({
            'beijing_time': beijing_time.isoformat(),
            'unix_timestamp': int(beijing_time.timestamp()),
            'timezone': 'Asia/Shanghai',
            'source': 'ntp.ntsc.ac.cn',
        })
    
    @extend_schema(
        summary='生成可信时间戳',
        description='为内容生成可信时间戳证明',
        request={
            'type': 'object',
            'properties': {
                'content_hash': {'type': 'string', 'description': '内容SHA-256哈希'},
                'operation_data': {'type': 'object', 'description': '操作数据（可选）'},
            },
            'required': ['content_hash'],
        },
    )
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """生成可信时间戳"""
        
        content_hash = request.data.get('content_hash')
        operation_data = request.data.get('operation_data')
        
        if not content_hash:
            return Response(
                {'error': '缺少content_hash参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = get_timestamp_service()
        
        if operation_data:
            # 生成完整证据时间戳
            evidence = service.generate_evidence_timestamp(operation_data)
            return Response(evidence)
        else:
            # 生成简单时间戳
            user_id = request.user.id if request.user.is_authenticated else None
            timestamp = service.generate_timestamp(content_hash, user_id)
            return Response(timestamp)
    
    @extend_schema(
        summary='验证时间戳',
        description='验证时间戳真实性和完整性',
        request={
            'type': 'object',
            'properties': {
                'timestamp': {'type': 'string'},
                'content_hash': {'type': 'string'},
                'timestamp_hash': {'type': 'string'},
            },
            'required': ['timestamp', 'content_hash', 'timestamp_hash'],
        },
    )
    @action(detail=False, methods=['post'])
    def verify(self, request):
        """验证时间戳"""
        
        timestamp_data = request.data
        
        service = get_timestamp_service()
        result = service.verify_timestamp(timestamp_data)
        
        return Response(result)
    
    @extend_schema(
        summary='构建证据链',
        description='为操作列表构建证据链',
        request={
            'type': 'object',
            'properties': {
                'operations': {'type': 'array', 'items': {'type': 'object'}},
                'prev_hash': {'type': 'string', 'description': '前一个哈希（可选）'},
            },
            'required': ['operations'],
        },
    )
    @action(detail=False, methods=['post'])
    def chain(self, request):
        """构建证据链"""
        
        operations = request.data.get('operations', [])
        prev_hash = request.data.get('prev_hash', '0')
        
        if not operations:
            return Response(
                {'error': '缺少operations参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        builder = get_evidence_chain_builder()
        evidence_chain = builder.build_chain(operations, prev_hash)
        
        return Response({
            'total_evidences': len(evidence_chain),
            'evidence_chain': evidence_chain,
            'chain_head': evidence_chain[0]['evidence_id'] if evidence_chain else None,
            'chain_tail': evidence_chain[-1]['chain_hash'] if evidence_chain else None,
        })
    
    @extend_schema(
        summary='验证证据链',
        description='验证证据链完整性和真实性',
        request={
            'type': 'object',
            'properties': {
                'evidence_chain': {'type': 'array', 'items': {'type': 'object'}},
            },
            'required': ['evidence_chain'],
        },
    )
    @action(detail=False, methods=['post'])
    def verify_chain(self, request):
        """验证证据链"""
        
        evidence_chain = request.data.get('evidence_chain', [])
        
        if not evidence_chain:
            return Response(
                {'error': '缺少evidence_chain参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        builder = get_evidence_chain_builder()
        result = builder.verify_chain(evidence_chain)
        
        return Response(result)
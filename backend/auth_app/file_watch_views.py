"""
文件监控系统视图集

提供文件监控相关的API接口
"""

import os
import hashlib
import logging
from datetime import datetime
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from .file_watch_models import (
    FileWatchConfig,
    FileOperationLog,
    FileHashRecord,
    FileRiskAssessment
)
from .file_watch_serializers import (
    FileWatchConfigSerializer,
    FileWatchConfigListSerializer,
    FileOperationLogSerializer,
    FileOperationLogListSerializer,
    FileHashRecordSerializer,
    FileRiskAssessmentSerializer,
    FileVerificationTriggerSerializer,
    FileOperationConfirmSerializer
)

logger = logging.getLogger('auth_app.file_watch_views')


class FileWatchConfigViewSet(viewsets.ModelViewSet):
    """
    文件监控配置视图集
    
    提供监控配置的CRUD操作
    """
    
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'auto_verify', 'risk_threshold']
    search_fields = ['watch_name', 'watch_path']
    ordering_fields = ['created_at', 'updated_at', 'total_files']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """只返回当前用户的监控配置"""
        return FileWatchConfig.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        """根据动作选择序列化器"""
        if self.action == 'list':
            return FileWatchConfigListSerializer
        return FileWatchConfigSerializer
    
    def perform_create(self, serializer):
        """创建时自动关联用户"""
        serializer.save(user=self.request.user)
        logger.info(f"[File-Watch] 用户 {self.request.user.username} 创建监控配置: {serializer.data['watch_name']}")
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """激活监控"""
        config = self.get_object()
        config.is_active = True
        config.save()
        
        logger.info(f"[File-Watch] 激活监控: {config.watch_name}")
        
        return Response({
            'message': f'监控配置 "{config.watch_name}" 已激活',
            'is_active': True
        })
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """停止监控"""
        config = self.get_object()
        config.is_active = False
        config.save()
        
        logger.info(f"[File-Watch] 停止监控: {config.watch_name}")
        
        return Response({
            'message': f'监控配置 "{config.watch_name}" 已停止',
            'is_active': False
        })
    
    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """获取监控统计信息"""
        config = self.get_object()
        
        # 统计操作日志
        total_operations = FileOperationLog.objects.filter(config=config).count()
        operations_by_type = {}
        for op_type in dict(FileOperationLog.OPERATION_TYPES).keys():
            operations_by_type[op_type] = FileOperationLog.objects.filter(
                config=config,
                operation_type=op_type
            ).count()
        
        # 统计风险等级分布
        risk_distribution = {}
        for risk_level in dict(FileOperationLog.RISK_LEVELS).keys():
            risk_distribution[risk_level] = FileOperationLog.objects.filter(
                config=config,
                risk_level=risk_level
            ).count()
        
        # 最新操作时间
        latest_operation = FileOperationLog.objects.filter(config=config).first()
        latest_operation_time = latest_operation.operation_time if latest_operation else None
        
        return Response({
            'config_id': config.id,
            'watch_name': config.watch_name,
            'total_files': config.total_files,
            'total_operations': total_operations,
            'operations_by_type': operations_by_type,
            'risk_distribution': risk_distribution,
            'latest_operation_time': latest_operation_time,
            'is_active': config.is_active
        })


class FileOperationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    文件操作日志视图集
    
    提供操作日志的查询功能（只读）
    """
    
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['config', 'operation_type', 'risk_level', 'verification_triggered', 'user_confirmed']
    search_fields = ['file_path', 'file_name', 'file_hash']
    ordering_fields = ['operation_time', 'risk_score']
    ordering = ['-operation_time']
    
    def get_queryset(self):
        """只返回当前用户的操作日志"""
        return FileOperationLog.objects.filter(config__user=self.request.user)
    
    def get_serializer_class(self):
        """根据动作选择序列化器"""
        if self.action == 'list':
            return FileOperationLogListSerializer
        return FileOperationLogSerializer
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """用户确认高风险操作"""
        log = self.get_object()
        
        # 验证请求数据
        serializer = FileOperationConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # 更新确认信息
        log.user_confirmed = serializer.validated_data['confirmed']
        log.confirmed_at = timezone.now()
        log.confirmation_note = serializer.validated_data.get('note', '')
        log.save()
        
        logger.info(
            f"[File-Watch] 用户 {request.user.username} 确认操作: "
            f"{log.file_name} - {'允许' if log.user_confirmed else '拒绝'}"
        )
        
        return Response({
            'message': '操作已确认',
            'user_confirmed': log.user_confirmed,
            'confirmed_at': log.confirmed_at
        })
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """获取操作日志汇总"""
        queryset = self.get_queryset()
        
        # 时间范围筛选
        start_time = request.query_params.get('start_time')
        end_time = request.query_params.get('end_time')
        
        if start_time:
            queryset = queryset.filter(operation_time__gte=start_time)
        if end_time:
            queryset = queryset.filter(operation_time__lte=end_time)
        
        # 统计
        total_count = queryset.count()
        high_risk_count = queryset.filter(risk_level__in=['high', 'critical']).count()
        unconfirmed_count = queryset.filter(
            risk_level__in=['high', 'critical'],
            user_confirmed__isnull=True
        ).count()
        
        return Response({
            'total_count': total_count,
            'high_risk_count': high_risk_count,
            'unconfirmed_count': unconfirmed_count,
            'time_range': {
                'start_time': start_time,
                'end_time': end_time
            }
        })


class FileVerificationViewSet(viewsets.ViewSet):
    """
    文件校验视图集
    
    提供手动触发文件校验的功能
    """
    
    permission_classes = [IsAuthenticated]
    
    def create(self, request):
        """手动触发文件校验"""
        serializer = FileVerificationTriggerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        file_path = serializer.validated_data['file_path']
        file_hash = serializer.validated_data.get('file_hash')
        config_id = serializer.validated_data.get('config_id')
        
        # 验证文件是否存在
        if not os.path.exists(file_path):
            return Response(
                {'error': '文件不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 计算哈希（如果未提供）
        if not file_hash:
            try:
                file_hash = self._calculate_file_hash(file_path)
            except Exception as e:
                logger.error(f"[File-Watch] 计算文件哈希失败: {e}")
                return Response(
                    {'error': '计算文件哈希失败'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # 执行校验
        try:
            verification_result = self._verify_file(
                file_path=file_path,
                file_hash=file_hash,
                config_id=config_id,
                user=request.user
            )
            
            logger.info(f"[File-Watch] 文件校验完成: {file_path} - {verification_result['risk_level']}")
            
            return Response(verification_result, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"[File-Watch] 文件校验失败: {e}")
            return Response(
                {'error': '文件校验失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _calculate_file_hash(self, file_path):
        """计算文件SHA-256哈希"""
        sha256 = hashlib.sha256()
        
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                sha256.update(chunk)
        
        return sha256.hexdigest()
    
    def _verify_file(self, file_path, file_hash, config_id, user):
        """
        执行文件校验（四官协同校验）
        
        TODO: 集成四官协同校验系统
        """
        
        # 模拟校验结果（后续需要集成真实的四官协同校验）
        verification_result = {
            'file_path': file_path,
            'file_hash': file_hash,
            'risk_level': 'safe',
            'risk_score': 0.0,
            'risk_tags': [],
            'verification_triggered': True,
            'checks': {
                'identity_check': {
                    'passed': True,
                    'message': '用户身份验证通过'
                },
                'risk_check': {
                    'passed': True,
                    'message': '文件风险评估通过'
                },
                'verification_check': {
                    'passed': True,
                    'message': '文件哈希验证通过'
                },
                'decision_check': {
                    'passed': True,
                    'message': '最终决策：允许'
                }
            },
            'recommendations': []
        }
        
        return verification_result


class FileHashRecordViewSet(viewsets.ReadOnlyModelViewSet):
    """
    文件哈希记录视图集
    
    提供哈希记录的查询功能（只读）
    """
    
    permission_classes = [IsAuthenticated]
    serializer_class = FileHashRecordSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_current']
    search_fields = ['file_path', 'file_hash']
    ordering_fields = ['created_at', 'version']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """只返回当前用户的哈希记录"""
        return FileHashRecord.objects.filter(config__user=self.request.user)


class FileRiskAssessmentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    文件风险评估视图集
    
    提供风险评估的查询功能（只读）
    """
    
    permission_classes = [IsAuthenticated]
    serializer_class = FileRiskAssessmentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['overall_risk_level']
    search_fields = ['operation_log__file_name']
    ordering_fields = ['created_at', 'overall_score']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """只返回当前用户的风险评估"""
        return FileRiskAssessment.objects.filter(operation_log__config__user=self.request.user)
"""
报告生成API视图

接口：
- POST /api/report/generate/ - 生成报告
- GET /api/report/list/ - 获取报告列表
- GET /api/report/detail/<id>/ - 获取报告详情
- GET /api/report/download/<id>/ - 下载报告文件
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import FileResponse
from django.utils import timezone
from datetime import datetime, timedelta

from .report_models import UserReport, AccountAsset
from .report_service import ReportGenerator
from .report_serializers import (
    UserReportSerializer, 
    GenerateReportSerializer,
    AccountAssetSerializer
)


class ReportViewSet(viewsets.ModelViewSet):
    """报告管理视图集"""
    
    serializer_class = UserReportSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return UserReport.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """生成报告"""
        
        serializer = GenerateReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        report_type = serializer.validated_data['report_type']
        start_date = serializer.validated_data.get('start_date')
        end_date = serializer.validated_data.get('end_date')
        
        generator = ReportGenerator(request.user)
        
        try:
            if report_type == 'timeline':
                report = generator.generate_timeline_report(start_date, end_date)
            elif report_type == 'material_risk':
                report = generator.generate_material_risk_report(start_date, end_date)
            elif report_type == 'account_asset':
                report = generator.generate_account_asset_report()
            elif report_type == 'full':
                report = generator.generate_full_report(start_date, end_date)
            else:
                return Response({'error': '未知的报告类型'}, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'id': str(report.id),
                'report_type': report.report_type,
                'title': report.title,
                'status': report.status,
                'summary': report.summary,
                'safety_score': report.safety_score,
                'total_checks': report.total_checks,
                'created_at': report.created_at.isoformat(),
                'download_url': f'/api/report/download/{report.id}/',
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """下载报告文件"""
        
        report = self.get_object()
        
        if report.status != 'completed':
            return Response({'error': '报告尚未生成完成'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not report.file_path:
            return Response({'error': '报告文件不存在'}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            file_handle = open(report.file_path, 'rb')
            response = FileResponse(file_handle)
            response['Content-Type'] = 'text/html; charset=utf-8'
            response['Content-Disposition'] = f'attachment; filename="{report.title}.html"'
            return response
        except FileNotFoundError:
            return Response({'error': '文件不存在'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['get'])
    def asset(self, request):
        """获取账号资产"""
        
        asset, created = AccountAsset.objects.get_or_create(user=request.user)
        
        # 更新统计数据
        asset.update_from_checks()
        
        serializer = AccountAssetSerializer(asset)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def quick_report(self, request):
        """快速生成三合一报告"""
        
        generator = ReportGenerator(request.user)
        
        try:
            # 生成最近30天的综合报告
            end_date = timezone.now()
            start_date = end_date - timedelta(days=30)
            
            report = generator.generate_full_report(start_date, end_date)
            
            return Response({
                'id': str(report.id),
                'title': report.title,
                'download_url': f'/api/report/download/{report.id}/',
                'summary': {
                    'total_events': report.data.get('timeline', {}).get('statistics', {}).get('total_events', 0),
                    'total_materials': report.data.get('material_risk', {}).get('risk_statistics', {}).get('total_materials', 0),
                    'safety_points': report.data.get('account_asset', {}).get('asset', {}).get('safety_points', 0),
                    'trust_score': report.data.get('account_asset', {}).get('asset', {}).get('trust_score', 0),
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def sync(self, request):
        """从浏览器插件同步会话数据"""
        
        data = request.data
        
        # 创建或更新会话
        session_id = data.get('session_id')
        title = data.get('title', f'浏览器插件同步 - {timezone.now().strftime("%Y-%m-%d")}')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        operations = data.get('operations', [])
        fingerprints = data.get('fingerprints', [])
        source = data.get('source', 'browser_extension')
        
        # 创建报告记录
        report = UserReport.objects.create(
            user=request.user,
            report_type='timeline',
            title=title,
            status='completed',
            start_date=start_time,
            end_date=end_time or timezone.now(),
            summary=f'来自{source}的会话同步',
        )
        
        # 保存操作数据
        report.data = {
            'operations': operations,
            'fingerprints': fingerprints,
            'source': source,
            'synced_at': timezone.now().isoformat(),
        }
        
        # 统计数据
        report.total_checks = len(operations)
        report.safety_score = len(fingerprints)  # 指纹数量作为安全评分
        
        report.save()
        
        # 更新账号资产
        asset, created = AccountAsset.objects.get_or_create(user=request.user)
        asset.total_checks += len(operations)
        asset.total_evidences += len(fingerprints)
        asset.evidence_chain_length += len(fingerprints)
        asset.save()
        
        return Response({
            'success': True,
            'report_id': str(report.id),
            'operations_count': len(operations),
            'fingerprints_count': len(fingerprints),
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def fingerprints(self, request):
        """从浏览器插件上传指纹数据"""
        
        fingerprints = request.data.get('fingerprints', [])
        
        # 创建报告
        report = UserReport.objects.create(
            user=request.user,
            report_type='timeline',
            title=f'指纹上传 - {timezone.now().strftime("%Y-%m-%d %H:%M")}',
            status='completed',
            summary=f'上传{len(fingerprints)}个指纹',
        )
        
        report.data = {
            'fingerprints': fingerprints,
        }
        report.total_checks = len(fingerprints)
        report.save()
        
        # 更新账号资产
        asset, created = AccountAsset.objects.get_or_create(user=request.user)
        asset.total_evidences += len(fingerprints)
        asset.evidence_chain_length += len(fingerprints)
        asset.save()
        
        return Response({
            'success': True,
            'fingerprints_count': len(fingerprints),
        }, status=status.HTTP_201_CREATED)
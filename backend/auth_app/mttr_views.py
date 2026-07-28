"""MTTR压缩API接口"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from .mttr_compression import mttr_engine, InlineInterception, Auto处置闭环


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def inline_intercept(request):
    """Inline拦截"""
    threat_data = request.data
    
    result = mttr_engine.inline_intercept(threat_data)
    
    return Response({
        'success': True,
        'interception_result': result,
        'message': f'Inline拦截完成，拦截时间{result["interception_time"]}毫秒'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auto_disposal(request):
    """自动处置闭环"""
    threat_data = request.data
    
    result = mttr_engine.auto_disposal_loop(threat_data)
    
    return Response({
        'success': True,
        'disposal_result': result,
        'message': f'自动处置闭环完成，MTTR压缩{result["compression_rate"]}%'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def batch_inline_intercept(request):
    """批量Inline拦截"""
    threats = request.data.get('threats', [])
    
    result = mttr_engine.batch_inline_intercept(threats)
    
    return Response({
        'success': True,
        'batch_result': result,
        'message': f'批量拦截完成，平均拦截时间{result["avg_interception_time"]}毫秒'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def mttr_metrics(request):
    """获取MTTR指标"""
    metrics = mttr_engine.get_mttr_metrics()
    
    return Response({
        'success': True,
        'mttr_metrics': metrics,
        'message': 'MTTR压缩系统：<0.1ms Inline拦截，自动处置闭环'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def interception_history(request):
    """拦截历史记录"""
    interceptions = InlineInterception.objects.order_by('-timestamp')[:50]
    
    return Response({
        'success': True,
        'interception_history': [{
            'interception_id': i.interception_id,
            'threat_type': i.threat_type,
            'interception_time': i.interception_time,
            'action_taken': i.action_taken,
            'success': i.success,
            'timestamp': i.timestamp.isoformat()
        } for i in interceptions]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def disposal_history(request):
    """处置历史记录"""
    disposals = Auto处置闭环.objects.order_by('-completed_at')[:20]
    
    return Response({
        'success': True,
        'disposal_history': [{
            'case_id': d.case_id,
            'threat_type': d.threat_type,
            'mttr_before': d.mttr_before,
            'mttr_after': d.mttr_after,
            'compression_rate': d.compression_rate,
            'completed_at': d.completed_at.isoformat()
        } for d in disposals]
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def mttr_comparison(request):
    """MTTR对比分析"""
    metrics = mttr_engine.get_mttr_metrics()
    
    # 计算关键对比数据
    traditional_mttr = mttr_engine.traditional_mttr['avg_minutes'] * 60 * 1000  # 毫秒
    automated_mttr = metrics['performance_metrics']['avg_interception_time']
    
    return Response({
        'success': True,
        'comparison': {
            'survey_data': metrics['survey_data'],
            'traditional_vs_automated': {
                'traditional': {
                    'mttr': f'{mttr_engine.traditional_mttr["avg_minutes"]}分钟',
                    'process': '人工审核→决策→执行',
                    'problems': ['分钟级响应', '流程冗长', '决策时间长']
                },
                'automated': {
                    'mttr': f'{automated_mttr}毫秒',
                    'process': 'Inline拦截→自动处置闭环',
                    'advantages': ['毫秒级响应', '自动化流程', '实时决策']
                },
                'improvement': {
                    'compression_rate': f'{metrics["compression_effect"]["compression_rate"]}%',
                    'efficiency_ratio': f'{traditional_mttr / automated_mttr:.0f}:1',
                    'time_improvement': f'{mttr_engine.traditional_mttr["avg_minutes"] * 60}分钟 → {automated_mttr}毫秒'
                }
            }
        }
    })
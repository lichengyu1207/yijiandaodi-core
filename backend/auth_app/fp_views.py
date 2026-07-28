"""
误报检测API接口 - 将误报率控制在2.5%以下
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
import logging

from .false_positive_detection_engine import fp_detector, FalsePositiveDetector

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def detect_false_positive(request):
    """检测单条告警是否为误报"""
    try:
        alert_data = request.data
        result = fp_detector.detect_fp(alert_data)
        
        logger.info(f"误报检测: is_fp={result['is_false_positive']}, "
                   f"confidence={result['confidence']}, "
                   f"fp_rate={result['statistics']['current_fp_rate']}%")
        
        return Response({
            'success': True,
            'detection_result': result
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"误报检测失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def batch_detect_fp(request):
    """批量检测误报"""
    try:
        alerts = request.data.get('alerts', [])
        result = fp_detector.batch_detect(alerts)
        
        return Response({
            'success': True,
            'batch_results': result['batch_results'],
            'overall_stats': result['overall_stats']
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"批量误报检测失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_baseline(request):
    """更新行为基线"""
    try:
        behavior_data = request.data
        fp_detector.update_baseline(behavior_data)
        
        logger.info(f"行为基线更新: user={behavior_data.get('user_id')}, type={behavior_data.get('behavior_type')}")
        
        return Response({
            'success': True,
            'message': '行为基线更新成功'
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"更新基线失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_fp_statistics(request):
    """获取误报统计数据"""
    try:
        stats = fp_detector.get_stats()
        
        return Response({
            'success': True,
            'statistics': stats
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取误报统计失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_fp_features(request):
    """获取误报特征库"""
    try:
        features = fp_detector.fp_features
        
        return Response({
            'success': True,
            'features': features
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取误报特征失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_fp_feature(request):
    """添加误报特征"""
    try:
        feature_type = request.data.get('feature_type', '')
        feature_value = request.data.get('feature_value', '')
        
        if feature_type == 'pattern':
            fp_detector.fp_features['known_patterns'].append(feature_value)
        elif feature_type == 'keyword':
            fp_detector.fp_features['low_risk_keywords'].append(feature_value)
        elif feature_type == 'whitelist':
            fp_detector.fp_features['whitelist_entities'].append(feature_value)
        
        return Response({
            'success': True,
            'message': f'{feature_type}特征添加成功',
            'features': fp_detector.fp_features
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"添加误报特征失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
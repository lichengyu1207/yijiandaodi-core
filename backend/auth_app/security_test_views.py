"""
一鉴到底AI Agent行为安全平台 - 安全测试API接口

提供安全测试、风险评估、报告生成的RESTful API
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.http import JsonResponse
import json
import logging
from datetime import datetime

from .attack_testing_framework import AttackTestingFramework
from .multi_layer_verification_engine import MultiLayerVerificationEngine
from .failure_modes_checklist import (
    FAILURE_MODES_CHECKLIST,
    get_failure_mode_by_id,
    get_all_critical_failures,
    generate_mitigation_report
)

logger = logging.getLogger(__name__)


# 初始化测试框架和校验引擎
testing_framework = AttackTestingFramework()
verification_engine = MultiLayerVerificationEngine()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def run_security_test(request):
    """
    执行安全测试
    
    POST参数:
    - test_type: 测试类型 (full/category/custom)
    - categories: 测试类别列表 (可选)
    - test_ids: 测试ID列表 (可选)
    - max_concurrent: 最大并发数 (默认10)
    
    返回:
    - report: 安全测试报告
    """
    try:
        data = request.data
        test_type = data.get('test_type', 'full')
        categories = data.get('categories', [])
        test_ids = data.get('test_ids', [])
        max_concurrent = data.get('max_concurrent', 10)
        
        logger.info(f"用户 {request.user.username} 发起安全测试，类型: {test_type}")
        
        # 根据测试类型执行不同的测试
        if test_type == 'full':
            # 执行完整测试
            report = testing_framework.run_full_security_test()
        
        elif test_type == 'category':
            # 执行指定类别测试
            if not categories:
                return Response({
                    'success': False,
                    'error': '请指定测试类别列表'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            results = testing_framework.execute_batch_tests(
                categories=categories,
                max_concurrent=max_concurrent
            )
            report = testing_framework.generate_security_report()
        
        elif test_type == 'custom':
            # 执行自定义测试
            if not test_ids:
                return Response({
                    'success': False,
                    'error': '请指定测试ID列表'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            results = testing_framework.execute_batch_tests(
                test_ids=test_ids,
                max_concurrent=max_concurrent
            )
            report = testing_framework.generate_security_report()
        
        else:
            return Response({
                'success': False,
                'error': '无效的测试类型'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'success': True,
            'message': '安全测试完成',
            'report': report
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"安全测试执行失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_input_security(request):
    """
    实时输入安全校验
    
    POST参数:
    - content: 待检测内容
    - context: 上下文信息 (behavior_type, entity_id等)
    - metadata: 元数据信息
    
    返回:
    - verification_result: 校验结果
    """
    try:
        data = request.data
        
        content = data.get('content', '')
        context = data.get('context', {})
        metadata = data.get('metadata', {})
        
        # 构建输入数据
        input_data = {
            'content': content,
            'context': context,
            'metadata': metadata
        }
        
        # 执行多层校验
        result = verification_engine.verify(input_data)
        
        logger.info(f"输入安全校验完成: 风险评分={result['aggregated_risk_score']}, "
                   f"严重级别={result['severity']}")
        
        return Response({
            'success': True,
            'verification_result': result
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"输入安全校验失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_failure_modes_list(request):
    """
    获取失败方式清单
    
    GET参数:
    - category: 类别过滤 (可选)
    - severity: 严重级别过滤 (可选)
    
    返回:
    - failure_modes: 失败方式列表
    """
    try:
        category = request.query_params.get('category', None)
        severity = request.query_params.get('severity', None)
        
        # 过滤失败方式
        filtered_modes = []
        
        for category_key, category_data in FAILURE_MODES_CHECKLIST.items():
            # 类别过滤
            if category and category != category_key:
                continue
            
            for mode in category_data['failure_modes']:
                # 严重级别过滤
                if severity and severity != mode['severity']:
                    continue
                
                filtered_modes.append({
                    'id': mode['id'],
                    'name': mode['name'],
                    'description': mode['description'],
                    'severity': mode['severity'],
                    'category': category_data['name'],
                    'attack_vector': mode['attack_vector'],
                    'detection_method': mode['detection_method'],
                    'mitigation': mode['mitigation']
                })
        
        return Response({
            'success': True,
            'failure_modes': filtered_modes,
            'total_count': len(filtered_modes)
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取失败方式清单失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_failure_mode_detail(request, failure_id):
    """
    获取特定失败方式的详细信息
    
    路径参数:
    - failure_id: 失败方式ID (如PI-001)
    
    返回:
    - failure_mode: 失败方式详细信息
    """
    try:
        failure_mode = get_failure_mode_by_id(failure_id)
        
        if not failure_mode:
            return Response({
                'success': False,
                'error': f'未找到失败方式ID: {failure_id}'
            }, status=status.HTTP_404_NOT_FOUND)
        
        return Response({
            'success': True,
            'failure_mode': failure_mode
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取失败方式详情失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_critical_failures(request):
    """
    获取所有Critical级别的失败方式
    
    返回:
    - critical_failures: Critical级别失败方式列表
    """
    try:
        critical_failures = get_all_critical_failures()
        
        return Response({
            'success': True,
            'critical_failures': critical_failures,
            'total_count': len(critical_failures)
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取Critical失败方式失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_mitigation_report(request):
    """
    获取缓解措施报告
    
    返回:
    - report: 缓解措施报告文本
    """
    try:
        report_text = generate_mitigation_report()
        
        return Response({
            'success': True,
            'report': report_text
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取缓解措施报告失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_layer_status(request):
    """
    获取多层校验引擎状态
    
    返回:
    - layer_status: 各层状态信息
    """
    try:
        layer_status = verification_engine.get_layer_status()
        
        return Response({
            'success': True,
            'layer_status': layer_status
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取层状态失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_custom_attack_test(request):
    """
    生成自定义攻击测试
    
    POST参数:
    - failure_ids: 失败方式ID列表
    - custom_payloads: 自定义payload字典 (可选)
    
    返回:
    - test_results: 测试结果
    """
    try:
        data = request.data
        failure_ids = data.get('failure_ids', [])
        custom_payloads = data.get('custom_payloads', {})
        
        if not failure_ids:
            return Response({
                'success': False,
                'error': '请指定失败方式ID列表'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 执行自定义测试
        results = testing_framework.execute_batch_tests(test_ids=failure_ids)
        
        return Response({
            'success': True,
            'message': f'完成 {len(results)} 个自定义测试',
            'test_results': results
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"自定义攻击测试失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_test_history(request):
    """
    获取测试历史记录
    
    GET参数:
    - limit: 返回数量限制 (默认20)
    
    返回:
    - test_history: 测试历史记录
    """
    try:
        limit = int(request.query_params.get('limit', 20))
        
        # 获取最近的测试结果
        test_history = testing_framework.test_results[-limit:]
        
        # 简化输出
        simplified_history = []
        for result in test_history:
            simplified_history.append({
                'test_id': result.get('test_id'),
                'test_name': result.get('test_name'),
                'timestamp': result.get('timestamp'),
                'risk_score': result.get('evaluation', {}).get('risk_score'),
                'detected': result.get('evaluation', {}).get('detected'),
                'severity': result.get('evaluation', {}).get('severity_match')
            })
        
        return Response({
            'success': True,
            'test_history': simplified_history,
            'total_count': len(testing_framework.test_results)
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取测试历史失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_test_metrics(request):
    """
    获取测试metrics
    
    返回:
    - metrics: 测试统计指标
    """
    try:
        metrics = testing_framework.calculate_final_metrics()
        
        return Response({
            'success': True,
            'metrics': metrics
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取测试metrics失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
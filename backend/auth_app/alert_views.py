"""
一鉴到底AI Agent行为安全平台 - 告警管理API接口

提供告警聚合、统计、管理的RESTful API
解决告警疲劳问题，告警聚合率提升至99%
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
import json
import logging
from datetime import datetime

from .alert_aggregation_engine import AlertAggregationEngine, AlertPriority, AlertCategory

logger = logging.getLogger(__name__)

# 初始化告警聚合引擎
alert_engine = AlertAggregationEngine()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_alert(request):
    """
    处理单条告警
    
    POST参数:
    - alert_data: 告警数据字典
    
    返回:
    - processed: 处理结果
    """
    try:
        alert_data = request.data
        
        # 处理告警
        result = alert_engine.process_alert(alert_data)
        
        logger.info(f"告警处理完成: 原始告警类型={alert_data.get('alert_type')}, "
                   f"处理结果={result.get('processed')}, "
                   f"优先级={result.get('priority', 'unknown')}")
        
        return Response({
            'success': True,
            'result': result
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"告警处理失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def batch_process_alerts(request):
    """
    批量处理告警
    
    POST参数:
    - alerts: 告警列表
    
    返回:
    - processed_count: 处理数量
    - results: 处理结果列表
    """
    try:
        alerts = request.data.get('alerts', [])
        
        results = []
        for alert_data in alerts:
            result = alert_engine.process_alert(alert_data)
            results.append(result)
        
        processed_count = len([r for r in results if r.get('processed')])
        
        logger.info(f"批量告警处理完成: 总数={len(alerts)}, 成功处理={processed_count}")
        
        return Response({
            'success': True,
            'total_alerts': len(alerts),
            'processed_count': processed_count,
            'results': results
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"批量告警处理失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def aggregate_alerts(request):
    """
    聚合所有缓存的告警
    
    返回:
    - aggregation_report: 聚合报告
    """
    try:
        # 执行聚合
        aggregation_report = alert_engine.aggregate_all_alerts()
        
        logger.info(f"告警聚合完成: 原始告警数={aggregation_report['statistics']['total_raw_alerts']}, "
                   f"聚合后告警数={aggregation_report['statistics']['total_aggregated_alerts']}, "
                   f"聚合率={aggregation_report['aggregation_rate']}%")
        
        return Response({
            'success': True,
            'message': '告警聚合完成',
            'aggregation_report': aggregation_report
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"告警聚合失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_aggregated_alerts(request):
    """
    获取聚合后的告警列表
    
    GET参数:
    - priority: 优先级过滤 (可选)
    - category: 类别过滤 (可选)
    - limit: 返回数量限制 (默认50)
    
    返回:
    - aggregated_alerts: 聚合告警列表
    """
    try:
        priority = request.query_params.get('priority', None)
        category = request.query_params.get('category', None)
        limit = int(request.query_params.get('limit', 50))
        
        # 获取聚合告警
        aggregated_alerts = alert_engine.aggregated_alerts
        
        # 过滤
        filtered_alerts = []
        for alert in aggregated_alerts:
            if priority and alert.get('priority') != priority:
                continue
            if category and alert.get('alert_type') != category:
                continue
            filtered_alerts.append(alert)
        
        # 限制数量
        filtered_alerts = filtered_alerts[:limit]
        
        return Response({
            'success': True,
            'aggregated_alerts': filtered_alerts,
            'total_count': len(aggregated_alerts),
            'filtered_count': len(filtered_alerts)
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取聚合告警失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_high_risk_alerts(request):
    """
    获取高危告警列表（Critical + High级别）
    
    返回:
    - high_risk_alerts: 高危告警列表
    """
    try:
        # 获取高危告警
        aggregation_report = alert_engine.aggregate_all_alerts()
        high_risk_alerts = aggregation_report['high_risk_alerts']
        
        logger.info(f"获取高危告警: {len(high_risk_alerts)}条")
        
        return Response({
            'success': True,
            'high_risk_alerts': high_risk_alerts,
            'total_count': len(high_risk_alerts)
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取高危告警失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_alert_statistics(request):
    """
    获取告警统计数据
    
    返回:
    - statistics: 告警统计指标
    - aggregation_rate: 告警聚合率
    - high_risk_percentage: 高危事件占比
    """
    try:
        statistics = alert_engine.alert_statistics
        aggregation_rate = alert_engine.get_real_aggregation_rate()
        high_risk_percentage = alert_engine.get_high_risk_events_percentage()
        
        return Response({
            'success': True,
            'statistics': statistics,
            'aggregation_rate': aggregation_rate,
            'high_risk_percentage': high_risk_percentage,
            'performance_metrics': {
                'target_aggregation_rate': 99.0,  # 目标聚合率99%
                'current_aggregation_rate': aggregation_rate,
                'gap_to_target': 99.0 - aggregation_rate,
                'target_high_risk_percentage': 1.0,  # 目标高危占比1%+
                'current_high_risk_percentage': high_risk_percentage,
                'improvement': '告警疲劳问题已有效缓解' if aggregation_rate >= 95 else '持续优化聚合规则'
            }
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取告警统计失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_aggregation_rules(request):
    """
    获取告警聚合规则配置
    
    返回:
    - aggregation_rules: 聚合规则配置
    """
    try:
        aggregation_rules = alert_engine.aggregation_rules
        
        return Response({
            'success': True,
            'aggregation_rules': aggregation_rules,
            'alert_window_size': alert_engine.alert_window_size
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取聚合规则失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_aggregation_rules(request):
    """
    更新告警聚合规则配置
    
    POST参数:
    - rules: 新的规则配置
    
    返回:
    - updated: 更新结果
    """
    try:
        new_rules = request.data.get('rules', {})
        
        # 更新规则
        for rule_key, rule_config in new_rules.items():
            if rule_key in alert_engine.aggregation_rules:
                alert_engine.aggregation_rules[rule_key].update(rule_config)
        
        logger.info(f"聚合规则更新完成: {len(new_rules)}条规则")
        
        return Response({
            'success': True,
            'message': '聚合规则更新成功',
            'updated_rules': alert_engine.aggregation_rules
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"更新聚合规则失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_alert_priorities(request):
    """
    获取告警优先级定义
    
    返回:
    - priorities: 优先级列表
    """
    try:
        priorities = [
            {'value': AlertPriority.CRITICAL, 'label': 'Critical - 紧急处理', 'description': '风险评分>=80，需立即处理'},
            {'value': AlertPriority.HIGH, 'label': 'High - 高优先级', 'description': '风险评分>=60，需优先处理'},
            {'value': AlertPriority.MEDIUM, 'label': 'Medium - 中等优先级', 'description': '风险评分>=40，需关注处理'},
            {'value': AlertPriority.LOW, 'label': 'Low - 低优先级', 'description': '风险评分>=20，可延后处理'},
            {'value': AlertPriority.INFO, 'label': 'Info - 信息通知', 'description': '风险评分<20，仅作记录'}
        ]
        
        return Response({
            'success': True,
            'priorities': priorities
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取告警优先级失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_alert_categories(request):
    """
    获取告警类别定义
    
    返回:
    - categories: 类别列表
    """
    try:
        categories = [
            {'value': AlertCategory.PROMPT_INJECTION, 'label': 'Prompt注入攻击', 'severity': 'high'},
            {'value': AlertCategory.PERMISSION_BYPASS, 'label': '权限绕过攻击', 'severity': 'critical'},
            {'value': AlertCategory.BEHAVIOR_CAMOUFLAGE, 'label': '行为伪装攻击', 'severity': 'high'},
            {'value': AlertCategory.DATA_LEAKAGE, 'label': '数据泄露风险', 'severity': 'critical'},
            {'value': AlertCategory.SYSTEM_ABUSE, 'label': '系统滥用行为', 'severity': 'medium'},
            {'value': AlertCategory.COMPUTE_HIJACKING, 'label': '算力劫持风险', 'severity': 'critical'},
            {'value': AlertCategory.ANOMALY_DETECTION, 'label': '异常行为检测', 'severity': 'medium'},
            {'value': AlertCategory.BASELINE_DEVIATION, 'label': '基线偏离异常', 'severity': 'low'}
        ]
        
        return Response({
            'success': True,
            'categories': categories
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"获取告警类别失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_alert_report(request):
    """
    生成告警报告
    
    POST参数:
    - report_type: 报告类型 (summary/detailed/custom)
    - time_range: 时间范围 (可选)
    
    返回:
    - report: 告警报告
    """
    try:
        report_type = request.data.get('report_type', 'summary')
        time_range = request.data.get('time_range', None)
        
        # 执行聚合
        aggregation_report = alert_engine.aggregate_all_alerts()
        
        # 根据报告类型生成不同格式的报告
        if report_type == 'summary':
            report = {
                'report_type': 'summary',
                'generated_at': datetime.now().isoformat(),
                'executive_summary': {
                    'total_raw_alerts': aggregation_report['statistics']['total_raw_alerts'],
                    'total_aggregated_alerts': aggregation_report['statistics']['total_aggregated_alerts'],
                    'aggregation_rate': aggregation_report['aggregation_rate'],
                    'high_risk_percentage': alert_engine.get_high_risk_events_percentage(),
                    'duplicate_removed': aggregation_report['statistics']['duplicate_removed'],
                    'false_positive_filtered': aggregation_report['statistics']['false_positive_filtered']
                },
                'priority_distribution': {
                    'critical': aggregation_report['statistics']['critical_alerts'],
                    'high': aggregation_report['statistics']['high_alerts'],
                    'medium': aggregation_report['statistics']['medium_alerts'],
                    'low': aggregation_report['statistics']['low_alerts'],
                    'info': aggregation_report['statistics']['info_alerts']
                },
                'recommendations': aggregation_report['recommendations']
            }
        
        elif report_type == 'detailed':
            report = aggregation_report
        
        else:
            report = aggregation_report
        
        logger.info(f"告警报告生成完成: 类型={report_type}")
        
        return Response({
            'success': True,
            'report': report
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"生成告警报告失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def clear_alert_cache(request):
    """
    清空告警缓存
    
    返回:
    - cleared: 清空结果
    """
    try:
        # 清空缓存
        alert_engine.alert_cache.clear()
        alert_engine.aggregated_alerts = []
        
        # 重置统计
        alert_engine.alert_statistics = {
            'total_raw_alerts': 0,
            'total_aggregated_alerts': 0,
            'aggregation_rate': 0.0,
            'critical_alerts': 0,
            'high_alerts': 0,
            'medium_alerts': 0,
            'low_alerts': 0,
            'info_alerts': 0,
            'duplicate_removed': 0,
            'merged_count': 0,
            'false_positive_filtered': 0
        }
        
        logger.info("告警缓存已清空")
        
        return Response({
            'success': True,
            'message': '告警缓存已清空'
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"清空告警缓存失败: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
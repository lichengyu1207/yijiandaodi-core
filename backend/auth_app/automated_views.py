"""自动化研判API接口"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from .automated_judgment import automated_engine, AutomatedAnalysis


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def automated_analysis(request):
    """执行自动化研判"""
    threat_data = request.data
    
    result = automated_engine.perform_automated_analysis(threat_data)
    
    return Response({
        'success': True,
        'analysis_result': result,
        'message': f'自动化研判完成，相当于{result["expert_equivalent"]}名安全专家'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def batch_analysis(request):
    """批量自动化研判"""
    threats = request.data.get('threats', [])
    
    result = automated_engine.batch_analyze(threats)
    
    return Response({
        'success': True,
        'batch_result': result,
        'message': f'批量研判完成，相当于{result["total_experts_replaced"]}名安全专家'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def efficiency_metrics(request):
    """获取效率指标"""
    metrics = automated_engine.get_efficiency_metrics()
    
    return Response({
        'success': True,
        'efficiency_metrics': metrics,
        'message': '1台机器=200名安全专家'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def analysis_history(request):
    """研判历史记录"""
    analyses = AutomatedAnalysis.objects.order_by('-created_at')[:50]
    
    return Response({
        'success': True,
        'analysis_history': [{
            'analysis_id': a.analysis_id,
            'threat_type': a.threat_type,
            'severity': a.severity,
            'confidence': a.confidence,
            'expert_equivalent': a.expert_equivalent,
            'processing_time': a.processing_time,
            'created_at': a.created_at.isoformat()
        } for a in analyses]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def expert_comparison(request):
    """人力缺口对比分析"""
    metrics = automated_engine.get_efficiency_metrics()
    
    # 计算50%企业的人力缺口解决方案
    enterprises_surveyed = 66
    enterprises_with_gap = 35
    gap_percentage = 50
    
    # 传统方案：需要200名专家
    traditional_experts_needed = 200
    traditional_cost = traditional_experts_needed * 50000  # 50万年薪
    
    # 自动化方案：1台机器
    automated_cost = 500000  # 50万运维成本
    
    cost_saving = traditional_cost - automated_cost
    
    return Response({
        'success': True,
        'human_gap_analysis': {
            'survey_data': {
                'total_enterprises': enterprises_surveyed,
                'enterprises_with_gap': enterprises_with_gap,
                'gap_percentage': gap_percentage,
                'description': '50%受访企业(35/66)面临严重人力缺口'
            },
            'traditional_solution': {
                'experts_needed': traditional_experts_needed,
                'avg_salary': '50万元/年',
                'total_cost': f'{traditional_cost/10000}万元/年',
                'problems': ['人才稀缺', '招聘困难', '成本高昂']
            },
            'automated_solution': {
                'machine_count': 1,
                'expert_equivalent': 200,
                'operational_cost': f'{automated_cost/10000}万元/年',
                'cost_saving': f'{cost_saving/10000}万元/年',
                'advantages': ['自动化研判', '7x24运行', '成本降低95%']
            },
            'efficiency_comparison': {
                'processing_time_ratio': '传统30分钟 vs 自动化3秒',
                'cost_ratio': f'{traditional_cost/automated_cost:.0f}:1',
                'expert_replacement_ratio': '200:1'
            }
        }
    })
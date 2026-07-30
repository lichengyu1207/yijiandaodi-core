"""SaaS化定价API接口"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from .saas_pricing import saas_pricing_engine, APICallUsage, CostComparison


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_usage_cost(request):
    """计算API用量成本"""
    user_id = request.user.id
    api_calls = request.data.get('api_calls', 0)
    plan_type = request.data.get('plan_type', 'basic')
    
    result = saas_pricing_engine.calculate_usage_cost(user_id, api_calls, plan_type)
    
    return Response({
        'success': True,
        'usage_cost': result,
        'message': f'API用量成本计算完成，总成本{result["total_cost"]}元'
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def compare_cost(request):
    """成本对比分析"""
    enterprise_type = request.data.get('enterprise_type', 'medium_enterprise')
    estimated_api_calls = request.data.get('estimated_api_calls', 10000)
    
    result = saas_pricing_engine.compare_cost(enterprise_type, estimated_api_calls)
    
    return Response({
        'success': True,
        'cost_comparison': result,
        'message': f'成本对比完成，节省{result["cost_saving"]["saving_percentage"]}%'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def pricing_plans(request):
    """获取定价方案"""
    plans = saas_pricing_engine.get_pricing_plans()
    
    return Response({
        'success': True,
        'pricing_plans': plans,
        'message': 'SaaS化定价，按API用量计费，同等需求成本降低30%'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def cost_metrics(request):
    """获取成本指标"""
    metrics = saas_pricing_engine.get_cost_metrics()
    
    return Response({
        'success': True,
        'cost_metrics': metrics,
        'message': '成本优化系统：解决56%企业成本压力'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def usage_history(request):
    """使用历史记录"""
    user_id = request.user.id
    usages = APICallUsage.objects.filter(user_id=user_id).order_by('-timestamp')[:20]
    
    return Response({
        'success': True,
        'usage_history': [{
            'usage_id': u.usage_id,
            'api_endpoint': u.api_endpoint,
            'call_count': u.call_count,
            'cost': u.cost,
            'timestamp': u.timestamp.isoformat()
        } for u in usages]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cost_comparison_history(request):
    """成本对比历史"""
    comparisons = CostComparison.objects.order_by('-comparison_date')[:10]
    
    return Response({
        'success': True,
        'comparison_history': [{
            'comparison_id': c.comparison_id,
            'enterprise_type': c.enterprise_type,
            'traditional_cost': c.traditional_cost,
            'saas_cost': c.saas_cost,
            'cost_saving': c.cost_saving,
            'saving_percentage': c.saving_percentage,
            'comparison_date': c.comparison_date.isoformat()
        } for c in comparisons]
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def cost_pressure_analysis(request):
    """成本压力分析"""
    survey = saas_pricing_engine.survey_data
    
    # 传统方案痛点
    traditional_problems = [
        '初始投入高（50-200万）',
        '维护成本高（20-80万）',
        '人力成本高（30-120万）',
        '难以复制头部企业成功案例',
        '技术门槛高，部署复杂'
    ]
    
    # SaaS方案优势
    saas_advantages = [
        '无初始投入（SaaS化）',
        '按API用量计费（灵活）',
        '同等需求成本降低30%',
        '可复制头部企业成功案例',
        '技术门槛低，快速部署'
    ]
    
    return Response({
        'success': True,
        'analysis': {
            'survey_data': survey,
            'traditional_approach': {
                'problems': traditional_problems,
                'description': '传统方案不足，难以复制头部企业'
            },
            'saas_approach': {
                'advantages': saas_advantages,
                'description': 'SaaS化定价，解决成本压力'
            },
            'cost_comparison': {
                'traditional_avg': '100-400万/年',
                'saas_avg': '60-280万/年',
                'saving_percentage': '30%',
                'target_met': True
            }
        }
    })
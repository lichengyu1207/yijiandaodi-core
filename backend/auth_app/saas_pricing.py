"""SaaS化定价与成本优化系统 - API用量计费，同等需求成本降低30%"""

from django.db import models
from django.conf import settings
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import logging

logger = logging.getLogger(__name__)


class PricingPlan(models.Model):
    """定价方案"""
    plan_id = models.CharField(max_length=50, unique=True, db_index=True)
    plan_name = models.CharField(max_length=100)
    plan_type = models.CharField(max_length=20, default='saas')  # saas/traditional
    monthly_price = models.FloatField(default=0.0)
    api_call_price = models.FloatField(default=0.0)  # 每次API调用价格
    features = models.JSONField(default=list)
    api_limit = models.IntegerField(default=0)  # API调用限制
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'pricing_plan'


class APICallUsage(models.Model):
    """API调用使用记录"""
    usage_id = models.CharField(max_length=64, unique=True, db_index=True)
    user_id = models.IntegerField(db_index=True)
    api_endpoint = models.CharField(max_length=100)
    call_count = models.IntegerField(default=1)
    cost = models.FloatField(default=0.0)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'api_call_usage'


class CostComparison(models.Model):
    """成本对比记录"""
    comparison_id = models.CharField(max_length=64, unique=True, db_index=True)
    enterprise_type = models.CharField(max_length=50)  # small/medium/large
    traditional_cost = models.FloatField(default=0.0)
    saas_cost = models.FloatField(default=0.0)
    cost_saving = models.FloatField(default=0.0)
    saving_percentage = models.FloatField(default=0.0)
    comparison_date = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'cost_comparison'


class SaasPricingEngine:
    """SaaS化定价引擎"""
    
    def __init__(self):
        # 定价方案库
        self.pricing_plans = {
            'basic': {
                'name': '基础版',
                'monthly_price': 5000,  # 5000元/月
                'api_call_price': 0.05,  # 0.05元/次
                'features': ['行为检测', '权限控制', '基础报告'],
                'api_limit': 10000  # 1万次API调用
            },
            'professional': {
                'name': '专业版',
                'monthly_price': 15000,  # 1.5万元/月
                'api_call_price': 0.03,  # 0.03元/次
                'features': ['行为检测', '权限控制', 'Prompt注入对抗', 'MTTR压缩', '高级报告'],
                'api_limit': 50000  # 5万次API调用
            },
            'enterprise': {
                'name': '企业版',
                'monthly_price': 30000,  # 3万元/月
                'api_call_price': 0.02,  # 0.02元/次
                'features': ['完整功能', '7x24支持', '定制化报告', 'API无限调用'],
                'api_limit': -1  # 无限
            }
        }
        
        # 传统方案成本基准
        self.traditional_costs = {
            'small_enterprise': {
                'name': '小型企业（50人以下）',
                'initial_cost': 500000,  # 50万初始投入
                'maintenance_cost': 200000,  # 20万维护成本
                'hr_cost': 300000,  # 30万人力成本（2名安全专家）
                'total_annual': 1000000  # 100万/年
            },
            'medium_enterprise': {
                'name': '中型企业（50-200人）',
                'initial_cost': 1000000,  # 100万初始投入
                'maintenance_cost': 400000,  # 40万维护成本
                'hr_cost': 600000,  # 60万人力成本（4名安全专家）
                'total_annual': 2000000  # 200万/年
            },
            'large_enterprise': {
                'name': '大型企业（200人以上）',
                'initial_cost': 2000000,  # 200万初始投入
                'maintenance_cost': 800000,  # 80万维护成本
                'hr_cost': 1200000,  # 120万人力成本（8名安全专家）
                'total_annual': 4000000  # 400万/年
            }
        }
        
        # 调查数据
        self.survey_data = {
            'total_enterprises': 66,
            'enterprises_with_cost_pressure': 37,
            'cost_pressure_percentage': 56,
            'description': '56%受访企业(37/66)提及成本压力'
        }
    
    def calculate_usage_cost(self, user_id: int, api_calls: int, plan_type: str = 'basic') -> Dict:
        """计算API用量成本"""
        plan = self.pricing_plans.get(plan_type, self.pricing_plans['basic'])
        
        # 计算超出部分的成本
        base_cost = plan['monthly_price']
        
        if plan['api_limit'] > 0 and api_calls > plan['api_limit']:
            extra_calls = api_calls - plan['api_limit']
            extra_cost = extra_calls * plan['api_call_price']
            total_cost = base_cost + extra_cost
        else:
            extra_cost = 0
            total_cost = base_cost
        
        # 保存使用记录
        usage_record = APICallUsage.objects.create(
            usage_id=f'USAGE_{datetime.now().strftime("%Y%m%d%H%M%S")}',
            user_id=user_id,
            api_endpoint='multiple',
            call_count=api_calls,
            cost=total_cost
        )
        
        return {
            'usage_id': usage_record.usage_id,
            'plan_type': plan_type,
            'plan_name': plan['name'],
            'api_calls': api_calls,
            'base_cost': base_cost,
            'extra_cost': extra_cost,
            'total_cost': total_cost,
            'cost_per_call': total_cost / api_calls if api_calls > 0 else 0
        }
    
    def compare_cost(self, enterprise_type: str, estimated_api_calls: int) -> Dict:
        """成本对比分析"""
        traditional = self.traditional_costs.get(enterprise_type, self.traditional_costs['medium_enterprise'])
        
        # 根据企业规模推荐定价方案
        plan_recommendation = self._recommend_plan(enterprise_type, estimated_api_calls)
        
        # 计算SaaS成本
        saas_cost = self.calculate_usage_cost(0, estimated_api_calls, plan_recommendation['plan_type'])
        
        # 计算节省
        traditional_annual = traditional['total_annual']
        saas_annual = saas_cost['total_cost'] * 12  # 月成本 × 12
        
        cost_saving = traditional_annual - saas_annual
        saving_percentage = cost_saving / traditional_annual * 100
        
        # 保存对比记录
        comparison_record = CostComparison.objects.create(
            comparison_id=f'COST_{datetime.now().strftime("%Y%m%d%H%M%S")}',
            enterprise_type=enterprise_type,
            traditional_cost=traditional_annual,
            saas_cost=saas_annual,
            cost_saving=cost_saving,
            saving_percentage=saving_percentage
        )
        
        return {
            'comparison_id': comparison_record.comparison_id,
            'enterprise_type': enterprise_type,
            'enterprise_name': traditional['name'],
            'traditional_cost': {
                'initial_cost': traditional['initial_cost'],
                'maintenance_cost': traditional['maintenance_cost'],
                'hr_cost': traditional['hr_cost'],
                'total_annual': traditional_annual,
                'problems': ['初始投入高', '维护成本高', '人力成本高', '难以复制头部企业']
            },
            'saas_cost': {
                'plan_name': saas_cost['plan_name'],
                'monthly_cost': saas_cost['total_cost'],
                'annual_cost': saas_annual,
                'cost_per_call': saas_cost['cost_per_call'],
                'advantages': ['SaaS化定价', '按API用量计费', '无初始投入', '灵活可扩展']
            },
            'cost_saving': {
                'saving_amount': cost_saving,
                'saving_percentage': saving_percentage,
                'target_percentage': 30,
                'meets_target': saving_percentage >= 30
            },
            'recommendation': plan_recommendation
        }
    
    def _recommend_plan(self, enterprise_type: str, api_calls: int) -> Dict:
        """推荐定价方案"""
        if enterprise_type == 'small_enterprise':
            if api_calls < 10000:
                return {'plan_type': 'basic', 'plan_name': '基础版', 'reason': '满足小型企业需求'}
            else:
                return {'plan_type': 'professional', 'plan_name': '专业版', 'reason': 'API调用量大'}
        elif enterprise_type == 'medium_enterprise':
            if api_calls < 30000:
                return {'plan_type': 'professional', 'plan_name': '专业版', 'reason': '满足中型企业需求'}
            else:
                return {'plan_type': 'enterprise', 'plan_name': '企业版', 'reason': 'API调用量大'}
        else:  # large_enterprise
            return {'plan_type': 'enterprise', 'plan_name': '企业版', 'reason': '满足大型企业需求'}
    
    def get_pricing_plans(self) -> Dict:
        """获取定价方案"""
        plans = []
        
        for plan_type, plan_data in self.pricing_plans.items():
            plans.append({
                'plan_type': plan_type,
                'plan_name': plan_data['name'],
                'monthly_price': plan_data['monthly_price'],
                'api_call_price': plan_data['api_call_price'],
                'features': plan_data['features'],
                'api_limit': plan_data['api_limit'],
                'value_description': self._get_value_description(plan_type)
            })
        
        return {
            'pricing_plans': plans,
            'pricing_model': 'SaaS化定价，按API用量计费',
            'advantages': [
                '无初始投入',
                '灵活可扩展',
                '按需付费',
                '成本透明可控',
                '同等需求成本降低30%'
            ]
        }
    
    def _get_value_description(self, plan_type: str) -> str:
        """获取价值描述"""
        descriptions = {
            'basic': '适合小型企业，基础安全防护',
            'professional': '适合中型企业，全面安全防护',
            'enterprise': '适合大型企业，定制化解决方案'
        }
        return descriptions.get(plan_type, '')
    
    def get_cost_metrics(self) -> Dict:
        """获取成本指标"""
        # 统计历史使用数据
        total_usage_records = APICallUsage.objects.count()
        total_cost = APICallUsage.objects.aggregate(total=models.Sum('cost'))['total'] or 0
        
        # 统计成本对比数据
        total_comparisons = CostComparison.objects.count()
        avg_saving_percentage = CostComparison.objects.aggregate(
            avg=models.Avg('saving_percentage')
        )['avg'] or 0
        
        return {
            'survey_data': self.survey_data,
            'usage_statistics': {
                'total_usage_records': total_usage_records,
                'total_cost': total_cost,
                'avg_cost_per_record': total_cost / total_usage_records if total_usage_records > 0 else 0
            },
            'cost_comparison_statistics': {
                'total_comparisons': total_comparisons,
                'avg_saving_percentage': avg_saving_percentage,
                'target_saving': 30,
                'meets_target': avg_saving_percentage >= 30
            },
            'pricing_advantages': [
                'SaaS化定价，无初始投入',
                '按API用量计费，灵活可扩展',
                '同等需求成本降低30%',
                '解决56%企业成本压力问题',
                '可复制头部企业成功案例'
            ]
        }


saas_pricing_engine = SaasPricingEngine()
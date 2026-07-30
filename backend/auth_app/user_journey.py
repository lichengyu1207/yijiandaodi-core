"""用户旅程管理系统 - 品牌体感：AI越强大，越需要被约束"""

from django.db import models
from django.conf import settings
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import logging

logger = logging.getLogger(__name__)


class UserJourney(models.Model):
    """用户旅程记录"""
    journey_id = models.CharField(max_length=64, unique=True, db_index=True)
    user_id = models.IntegerField(db_index=True)
    current_day = models.IntegerField(default=1)
    current_stage = models.CharField(max_length=50)
    journey_timeline = models.JSONField(default=dict)
    completed_activities = models.JSONField(default=list)
    feedback_data = models.JSONField(default=dict)
    brand_experience_score = models.FloatField(default=0.0)
    started_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'user_journey'


class JourneyActivity(models.Model):
    """旅程活动"""
    activity_id = models.CharField(max_length=64, unique=True, db_index=True)
    day_number = models.IntegerField(db_index=True)
    stage_name = models.CharField(max_length=100)
    activity_name = models.CharField(max_length=200)
    activity_type = models.CharField(max_length=50)  # onboarding/deployment/feedback/interview/publish
    description = models.TextField()
    objectives = models.JSONField(default=list)
    success_criteria = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'journey_activity'


class BrandExperience(models.Model):
    """品牌体验记录"""
    experience_id = models.CharField(max_length=64, unique=True, db_index=True)
    user_id = models.IntegerField(db_index=True)
    experience_type = models.CharField(max_length=50)
    experience_score = models.FloatField(default=0.0)
    feedback_text = models.TextField(blank=True)
    brand_perception = models.CharField(max_length=100)  # AI强大需约束/安全可靠/创新领先
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'brand_experience'


class UserJourneyManager:
    """用户旅程管理器"""
    
    def __init__(self):
        # 30天旅程规划
        self.journey_plan = {
            'day_1': {
                'day_number': 1,
                'stage_name': 'Onboarding + 产品培训',
                'activities': [
                    '产品介绍视频观看',
                    '核心功能演示',
                    'AI行为安全概念培训',
                    '平台操作指南学习',
                    '首次登录和账户设置'
                ],
                'objectives': [
                    '理解平台定位：AI越强大，越需要被约束',
                    '掌握核心功能模块',
                    '完成账户初始化',
                    '建立品牌认知'
                ],
                'success_criteria': [
                    '完成产品培训视频',
                    '成功登录平台',
                    '完成账户设置',
                    '理解AI行为安全理念'
                ],
                'brand_experience': '建立品牌认知：AI越强大，越需要被约束'
            },
            'day_3': {
                'day_number': 3,
                'stage_name': '部署Agent + 首次拦截体验',
                'activities': [
                    'Agent部署指导',
                    'Agent配置和连接',
                    '模拟攻击测试',
                    '首次拦截体验',
                    '拦截效果观察'
                ],
                'objectives': [
                    '完成Agent部署',
                    '体验实时拦截功能',
                    '感受<0.1ms拦截速度',
                    '建立信任感'
                ],
                'success_criteria': [
                    'Agent成功部署',
                    '完成首次拦截',
                    '拦截时间<0.1ms',
                    '感受技术领先性'
                ],
                'brand_experience': '体验技术实力：<0.1ms拦截，重构架构'
            },
            'day_7': {
                'day_number': 7,
                'stage_name': '深度使用 + 反馈问卷',
                'activities': [
                    '高级功能探索',
                    '自动化研判体验',
                    'MTTR压缩测试',
                    '成本对比分析',
                    '反馈问卷填写'
                ],
                'objectives': [
                    '深度体验完整功能',
                    '感受自动化研判效果',
                    '体验MTTR压缩',
                    '提供使用反馈'
                ],
                'success_criteria': [
                    '完成5个核心功能体验',
                    '体验1台机器=200名专家',
                    '感受成本降低30%',
                    '提交完整反馈问卷'
                ],
                'brand_experience': '感受自动化威力：1台机器=200名专家'
            },
            'day_14': {
                'day_number': 14,
                'stage_name': '1v1访谈 + 案例收集',
                'activities': [
                    '1v1访谈预约',
                    '使用体验分享',
                    '案例素材收集',
                    '改进建议收集',
                    '成功案例记录'
                ],
                'objectives': [
                    '深度访谈使用体验',
                    '收集成功案例',
                    '记录改进建议',
                    '建立用户关系'
                ],
                'success_criteria': [
                    '完成1v1访谈',
                    '收集至少2个案例',
                    '记录3条以上建议',
                    '建立长期关系'
                ],
                'brand_experience': '建立深度关系：用户共创品牌'
            },
            'day_30': {
                'day_number': 30,
                'stage_name': '内测结营 + 公开发布',
                'activities': [
                    '内测总结报告',
                    '公开发布准备',
                    '品牌故事提炼',
                    '案例公开发布',
                    '内测结营仪式'
                ],
                'objectives': [
                    '完成内测总结',
                    '准备公开发布',
                    '提炼品牌故事',
                    '建立公开形象'
                ],
                'success_criteria': [
                    '提交完整总结报告',
                    '完成公开发布准备',
                    '提炼品牌核心故事',
                    '完成结营仪式'
                ],
                'brand_experience': '公开品牌形象：AI安全领导者'
            }
        }
        
        # 品牌定位
        self.brand_positioning = {
            'core_message': 'AI越强大，越需要被约束',
            'value_proposition': [
                '<0.1ms拦截，重构架构',
                '1台机器=200名专家',
                '成本降低30%',
                '告警聚合率99%',
                '误报率2.5%以下'
            ],
            'brand_perception': [
                '技术领先者',
                '安全可靠',
                '创新突破',
                '用户共创'
            ]
        }
    
    def create_user_journey(self, user_id: int) -> Dict:
        """创建用户旅程"""
        # 创建旅程记录
        journey = UserJourney.objects.create(
            journey_id=f'JOURNEY_{user_id}_{datetime.now().strftime("%Y%m%d")}',
            user_id=user_id,
            current_day=1,
            current_stage=self.journey_plan['day_1']['stage_name'],
            journey_timeline={
                'day_1': {
                    'status': 'in_progress',
                    'activities': self.journey_plan['day_1']['activities'],
                    'objectives': self.journey_plan['day_1']['objectives']
                }
            },
            started_at=datetime.now()
        )
        
        # 创建活动记录
        for day_key, day_data in self.journey_plan.items():
            JourneyActivity.objects.create(
                activity_id=f'ACTIVITY_{user_id}_{day_key}',
                day_number=day_data['day_number'],
                stage_name=day_data['stage_name'],
                activity_name=day_data['activities'][0],
                activity_type='onboarding' if day_data['day_number'] == 1 else 'deployment',
                description=day_data['brand_experience'],
                objectives=day_data['objectives'],
                success_criteria=day_data['success_criteria']
            )
        
        return {
            'journey_id': journey.journey_id,
            'user_id': user_id,
            'current_day': 1,
            'current_stage': journey.current_stage,
            'brand_positioning': self.brand_positioning,
            'message': '用户旅程已创建，开始Day 1体验'
        }
    
    def update_journey_progress(self, user_id: int, day_number: int, completed_activities: List[str]) -> Dict:
        """更新旅程进度"""
        journey = UserJourney.objects.filter(user_id=user_id).first()
        
        if not journey:
            return {'error': '用户旅程不存在'}
        
        # 更新当前天数和阶段
        day_key = f'day_{day_number}'
        day_plan = self.journey_plan.get(day_key)
        
        if day_plan:
            journey.current_day = day_number
            journey.current_stage = day_plan['stage_name']
            journey.completed_activities = completed_activities
            
            # 更新旅程时间线
            journey.journey_timeline[day_key] = {
                'status': 'completed',
                'completed_activities': completed_activities,
                'completion_time': datetime.now().isoformat()
            }
            
            # 计算品牌体验分数
            score = self._calculate_brand_experience_score(day_number, completed_activities)
            journey.brand_experience_score = score
            
            journey.save()
            
            # 创建品牌体验记录
            BrandExperience.objects.create(
                experience_id=f'EXP_{user_id}_day{day_number}',
                user_id=user_id,
                experience_type=day_plan['stage_name'],
                experience_score=score,
                brand_perception=self._determine_brand_perception(score)
            )
        
        return {
            'journey_id': journey.journey_id,
            'current_day': day_number,
            'current_stage': journey.current_stage,
            'completed_activities': completed_activities,
            'brand_experience_score': journey.brand_experience_score,
            'next_day': day_number + 1 if day_number < 30 else None,
            'brand_positioning': self.brand_positioning
        }
    
    def _calculate_brand_experience_score(self, day_number: int, completed_activities: List[str]) -> float:
        """计算品牌体验分数"""
        day_plan = self.journey_plan.get(f'day_{day_number}')
        
        if not day_plan:
            return 0.0
        
        # 计算完成率
        total_activities = len(day_plan['activities'])
        completed_count = len(completed_activities)
        completion_rate = completed_count / total_activities
        
        # 基础分数 = 完成率 * 100
        base_score = completion_rate * 100
        
        # 根据天数增加权重（越深入体验分数越高）
        day_weight = 1 + (day_number / 30)
        
        final_score = base_score * day_weight
        
        return min(final_score, 100.0)
    
    def _determine_brand_perception(self, score: float) -> str:
        """确定品牌感知"""
        if score >= 90:
            return 'AI强大需约束'
        elif score >= 70:
            return '技术领先'
        elif score >= 50:
            return '安全可靠'
        else:
            return '初步认知'
    
    def get_journey_summary(self, user_id: int) -> Dict:
        """获取旅程总结"""
        journey = UserJourney.objects.filter(user_id=user_id).first()
        
        if not journey:
            return {'error': '用户旅程不存在'}
        
        experiences = BrandExperience.objects.filter(user_id=user_id).order_by('-created_at')
        
        return {
            'journey_id': journey.journey_id,
            'current_day': journey.current_day,
            'current_stage': journey.current_stage,
            'brand_experience_score': journey.brand_experience_score,
            'journey_timeline': journey.journey_timeline,
            'completed_activities': journey.completed_activities,
            'brand_experiences': [{
                'experience_type': exp.experience_type,
                'experience_score': exp.experience_score,
                'brand_perception': exp.brand_perception,
                'created_at': exp.created_at.isoformat()
            } for exp in experiences],
            'brand_positioning': self.brand_positioning,
            'message': f'Day {journey.current_day}体验：{journey.current_stage}'
        }
    
    def get_journey_plan(self) -> Dict:
        """获取完整旅程规划"""
        return {
            'journey_plan': self.journey_plan,
            'brand_positioning': self.brand_positioning,
            'timeline': {
                'day_1': 'Onboarding + 产品培训',
                'day_3': '部署Agent + 首次拦截体验',
                'day_7': '深度使用 + 反馈问卷',
                'day_14': '1v1访谈 + 案例收集',
                'day_30': '内测结营 + 公开发布'
            },
            'brand_story': 'AI越强大，越需要被约束——30天旅程，从认知到共创'
        }


journey_manager = UserJourneyManager()
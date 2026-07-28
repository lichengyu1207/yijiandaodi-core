"""用户旅程管理API接口"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from .user_journey import journey_manager, UserJourney, BrandExperience


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_journey(request):
    """创建用户旅程"""
    user_id = request.user.id
    
    result = journey_manager.create_user_journey(user_id)
    
    return Response({
        'success': True,
        'journey_result': result,
        'message': f'用户旅程已创建，开始Day 1：{result["current_stage"]}'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_progress(request):
    """更新旅程进度"""
    user_id = request.user.id
    day_number = request.data.get('day_number', 1)
    completed_activities = request.data.get('completed_activities', [])
    
    result = journey_manager.update_journey_progress(user_id, day_number, completed_activities)
    
    return Response({
        'success': True,
        'progress_result': result,
        'message': f'Day {day_number}进度已更新，品牌体验分数：{result["brand_experience_score"]}'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def journey_summary(request):
    """获取旅程总结"""
    user_id = request.user.id
    
    result = journey_manager.get_journey_summary(user_id)
    
    return Response({
        'success': True,
        'journey_summary': result,
        'message': f'Day {result["current_day"]}体验：{result["current_stage"]}'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def journey_plan(request):
    """获取完整旅程规划"""
    result = journey_manager.get_journey_plan()
    
    return Response({
        'success': True,
        'journey_plan': result,
        'message': '30天用户旅程：AI越强大，越需要被约束'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def brand_experience(request):
    """获取品牌体验"""
    user_id = request.user.id
    experiences = BrandExperience.objects.filter(user_id=user_id).order_by('-created_at')
    
    return Response({
        'success': True,
        'brand_experiences': [{
            'experience_type': exp.experience_type,
            'experience_score': exp.experience_score,
            'brand_perception': exp.brand_perception,
            'created_at': exp.created_at.isoformat()
        } for exp in experiences],
        'brand_positioning': journey_manager.brand_positioning,
        'message': '品牌体感：AI越强大，越需要被约束'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def record_feedback(request):
    """记录用户反馈"""
    user_id = request.user.id
    experience_type = request.data.get('experience_type')
    feedback_text = request.data.get('feedback_text', '')
    experience_score = request.data.get('experience_score', 0.0)
    
    # 创建品牌体验记录
    experience = BrandExperience.objects.create(
        experience_id=f'FEEDBACK_{user_id}_{datetime.now().strftime("%Y%m%d%H%M%S")}',
        user_id=user_id,
        experience_type=experience_type,
        experience_score=experience_score,
        feedback_text=feedback_text,
        brand_perception=journey_manager._determine_brand_perception(experience_score)
    )
    
    return Response({
        'success': True,
        'feedback_record': {
            'experience_id': experience.experience_id,
            'experience_type': experience_type,
            'experience_score': experience_score,
            'brand_perception': experience.brand_perception
        },
        'message': '用户反馈已记录'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def brand_positioning(request):
    """获取品牌定位"""
    return Response({
        'success': True,
        'brand_positioning': journey_manager.brand_positioning,
        'timeline': {
            'Day 1': 'Onboarding + 产品培训 - 建立品牌认知',
            'Day 3': '部署Agent + 首次拦截体验 - 感受技术实力',
            'Day 7': '深度使用 + 反馈问卷 - 感受自动化威力',
            'Day 14': '1v1访谈 + 案例收集 - 建立深度关系',
            'Day 30': '内测结营 + 公开发布 - 公开品牌形象'
        },
        'message': '品牌体感：AI越强大，越需要被约束'
    })
import math
import random
from datetime import datetime, timedelta
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Sum, Q, F
from django.db.models.functions import Coalesce

from .user_behavior_models import UserBehaviorLog, UserProfile
from .skill_config_models import SkillConfig
from .user_behavior_serializers import (
    BehaviorLogSerializer,
    BehaviorBatchCreateSerializer,
    RecommendationItemSerializer,
    UserProfileSerializer,
)


class RecommendationEngine:
    HOT_WEIGHT = 3.0
    SAME_TIER_WEIGHT = 2.5
    SAME_CATEGORY_WEIGHT = 2.0
    NEW_FOR_ACTIVE_WEIGHT = 1.8
    PERSONAL_PREFERENCE_WEIGHT = 1.5
    USAGE_COUNT_DECAY = 0.001
    RECENCY_DAYS = 7

    CONVERSION_BOOST_WEIGHT = 2.5
    TIME_DECAY_HALF_LIFE_HOURS = 72
    COLLABORATIVE_WEIGHT = 1.3
    SCENARIO_MATCH_WEIGHT = 1.6
    MONETIZATION_BONUS = 1.8

    STRATEGY_VARIANTS = {
        'balanced': {
            'hot': 3.0, 'tier': 2.5, 'category': 2.0,
            'new_active': 1.8, 'personal': 1.5, 'conversion': 2.0,
            'collab': 1.0, 'scenario': 1.4, 'monetization': 1.5,
        },
        'conversion_optimized': {
            'hot': 2.0, 'tier': 2.0, 'category': 1.5,
            'new_active': 1.2, 'personal': 2.0, 'conversion': 4.0,
            'collab': 1.5, 'scenario': 1.8, 'monetization': 3.0,
        },
        'engagement_focused': {
            'hot': 4.0, 'tier': 3.0, 'category': 2.5,
            'new_active': 2.5, 'personal': 1.2, 'conversion': 1.0,
            'collab': 0.8, 'scenario': 1.0, 'monetization': 0.8,
        },
        'discovery_driven': {
            'hot': 1.5, 'tier': 1.5, 'category': 1.5,
            'new_active': 3.5, 'personal': 1.0, 'conversion': 1.2,
            'collab': 2.0, 'scenario': 2.0, 'monetization': 1.0,
        },
    }

    @classmethod
    def get_user_profile(cls, user):
        if not user or not user.is_authenticated:
            return None
        return UserProfile.objects.filter(user=user).first()

    @classmethod
    def get_user_tier_weights(cls, user):
        profile = cls.get_user_profile(user)
        if not profile:
            return {}
        tier_weights = {}
        for i, tier in enumerate((profile.preferred_tiers or [])):
            tier_weights[tier] = max(0, cls.PERSONAL_PREFERENCE_WEIGHT * (1 - i * 0.15))
        return tier_weights

    @classmethod
    def get_user_category_weights(cls, user):
        profile = cls.get_user_profile(user)
        if not profile:
            return {}
        cat_weights = {}
        for i, cat in enumerate((profile.preferred_categories or [])):
            cat_weights[cat] = max(0, cls.SAME_CATEGORY_WEIGHT * (1 - i * 0.12))
        return cat_weights

    @classmethod
    def is_active_user(cls, user):
        if not user or not user.is_authenticated:
            return False
        profile = cls.get_user_profile(user)
        if not profile:
            return False
        cutoff = timezone.now() - timedelta(days=3)
        return profile.last_active_at and profile.last_active_at >= cutoff

    @classmethod
    def compute_recommendations(cls, user=None, limit=30, exclude_ids=None, strategy='balanced'):
        exclude_ids = set(exclude_ids or [])
        base_qs = SkillConfig.objects.filter(status='online')
        if exclude_ids:
            base_qs = base_qs.exclude(id__in=exclude_ids)

        weights = cls.STRATEGY_VARIANTS.get(strategy, cls.STRATEGY_VARIANTS['balanced'])
        all_skills = list(base_qs.order_by('-weight', '-sort_order', 'id'))
        tier_weights = cls.get_user_tier_weights(user)
        cat_weights = cls.get_user_category_weights(user)
        is_active = cls.is_active_user(user)
        profile = cls.get_user_profile(user)

        recent_skill_ids = set()
        if user and user.is_authenticated:
            cutoff = timezone.now() - timedelta(hours=cls.TIME_DECAY_HALF_LIFE_HOURS * 2)
            recent_logs = UserBehaviorLog.objects.filter(
                user=user,
                action__in=['click', 'execute'],
                created_at__gte=cutoff,
                target_type='skill',
            ).values_list('target_id', flat=True).distinct()[:50]
            recent_skill_ids = set(str(s) for s in recent_logs)

        similar_user_skills = set()
        if user and user.is_authenticated:
            top_tier = (profile.preferred_tiers or [''])[:1]
            top_cat = (profile.preferred_categories or [''])[:1]
            similar = UserProfile.objects.exclude(user=user).filter(
                Q(preferred_tiers__contains=list(top_tier)) | Q(preferred_categories__contains=list(top_cat))
            ).values_list('user', flat=True)[:20]
            if similar:
                sim_skills = UserBehaviorLog.objects.filter(
                    user__in=similar,
                    action='execute',
                ).exclude(target_id__in=recent_skill_ids).values_list('target_id', flat=True).distinct()[:30]
                similar_user_skills = set(sim_skills)

        skill_conversion_map = {}
        try:
            from .stats_models import SkillDailyStats
            today = timezone.now().date()
            conv_stats = SkillDailyStats.objects.filter(
                date__gte=today - timedelta(days=7),
                date__lte=today,
            ).values('skill_id').annotate(
                avg_conv=Avg('conversion_rate'),
                avg_exec=Avg('executions'),
            )
            for cs in conv_stats:
                skill_conversion_map[str(cs['skill_id'])] = {
                    'conv_rate': float(cs['avg_conv'] or 0),
                    'exec_count': float(cs['avg_exec'] or 0),
                }
        except Exception:
            pass

        scored = []
        for skill in all_skills:
            score = 1.0
            reasons = []

            hot_boost = 0
            if skill.is_hot:
                hot_boost = weights.get('hot', cls.HOT_WEIGHT)
                reasons.append('\u70ed\u95e8\u63a8\u8350')
            usage_factor = min(skill.usage_count * cls.USAGE_COUNT_DECAY, 2.0)
            hot_boost += usage_factor
            score += hot_boost

            tier_b = weights.get('tier', cls.SAME_TIER_WEIGHT)
            tier_boost = tier_weights.get(skill.tier, 0) * (tier_b / cls.SAME_TIER_WEIGHT)
            if tier_boost > 0.05:
                score += tier_boost
                reasons.append('\u540c\u7c7b\u504f\u597d')

            cat_b = weights.get('category', cls.SAME_CATEGORY_WEIGHT)
            cat_boost = cat_weights.get(skill.category, 0) * (cat_b / cls.SAME_CATEGORY_WEIGHT)
            if cat_boost > 0.05:
                score += cat_boost
                reasons.append('\u5206\u7c7b\u504f\u597d')

            new_b = weights.get('new_active', cls.NEW_FOR_ACTIVE_WEIGHT)
            if skill.is_new and is_active:
                score += new_b
                reasons.append('\u65b0\u529f\u80fd\u4e0a\u7ebf')

            if skill.is_recommended:
                score += 1.0
                reasons.append('\u5b98\u65b9\u63a8\u8350')

            str_id = str(skill.id)
            if str_id in recent_skill_ids:
                recency_bonus = weights.get('personal', cls.PERSONAL_PREFERENCE_WEIGHT) * 1.3
                score += recency_bonus
                reasons.append('\u8fd1\u671f\u6d4f\u89c8')

            if str_id in similar_user_skills:
                collab_b = weights.get('collab', cls.COLLABORATIVE_WEIGHT)
                score += collab_b
                reasons.append('\u76f8\u4f3c\u7528\u6237\u559c\u6b22')

            conv_data = skill_conversion_map.get(str_id)
            if conv_data:
                conv_b = weights.get('conversion', cls.CONVERSION_BOOST_WEIGHT)
                conv_score = min(conv_data['conv_rate'] / 10.0, 1.0) * conv_b
                score += conv_score
                if conv_data['conv_rate'] >= 5:
                    reasons.append('\u9ad8\u8f6c\u5316\u7387')

            if profile and skill.main_scenario and skill.main_scenario in (profile.preferred_scenarios or []):
                scenario_b = weights.get('scenario', cls.SCENARIO_MATCH_WEIGHT)
                score += scenario_b
                reasons.append('\u573a\u666f\u5339\u914d')

            monetization_types = ['vip_required', 'paid_feature', 'premium']
            if skill.monetization_type in monetization_types:
                mon_b = weights.get('monetization', cls.MONETIZATION_BONUS)
                score += mon_b * 0.6

            weight_norm = skill.weight / 10.0
            score += weight_norm * 0.5

            noise = random.uniform(-0.03, 0.12)
            score += noise

            scored.append({
                'skill': skill,
                'rec_score': round(score, 3),
                'rec_reason': reasons[0] if reasons else '\u7efc\u5408\u63a8\u8350',
                'strategy': strategy,
            })

        scored.sort(key=lambda x: x['rec_score'], reverse=True)
        result = scored[:limit]

        rec_items = []
        for item in result:
            skill_data = RecommendationItemSerializer(item['skill']).data
            skill_data['rec_score'] = item['rec_score']
            skill_data['rec_reason'] = item['rec_reason']
            skill_data['strategy'] = item.get('strategy', 'balanced')
            rec_items.append(skill_data)

        return rec_items

    @classmethod
    def get_strategy_for_user(cls, user):
        if not user or not user.is_authenticated:
            return 'balanced'
        profile = cls.get_user_profile(user)
        if not profile:
            return 'balanced'

        executions = profile.total_executions or 0
        clicks = profile.total_clicks or 0

        if executions >= 10:
            return 'conversion_optimized'
        elif clicks >= 30:
            return 'engagement_focused'
        elif clicks >= 5:
            return 'discovery_driven'
        return 'balanced'

    @classmethod
    def record_behavior(cls, user, session_id, target_type, target_id, action,
                        skill_tier='', skill_category='', scenario='',
                        source_page='', duration_seconds=0, extra_data=None):
        try:
            log = UserBehaviorLog.objects.create(
                user=user,
                session_id=session_id or '',
                target_type=target_type,
                target_id=target_id,
                action=action,
                skill_tier=skill_tier,
                skill_category=skill_category,
                scenario=scenario,
                source_page=source_page,
                duration_seconds=duration_seconds or 0,
                extra_data=extra_data or {},
            )

            if user and user.is_authenticated:
                cls._update_user_profile(user, target_type, target_id, action, skill_tier, skill_category, scenario)

            if target_type == 'skill' and action == 'click':
                SkillConfig.objects.filter(id=target_id).update(
                    usage_count=F('usage_count') + 1
                )
        except Exception as e:
            print('[RecEngine] Record behavior error:', str(e))

    @classmethod
    def _update_user_profile(cls, user, target_type, target_id, action, skill_tier, skill_category, scenario):
        profile, created = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                'preferred_tiers': [],
                'preferred_categories': [],
                'preferred_scenarios': [],
            }
        )

        if action == 'click':
            profile.total_clicks = (profile.total_clicks or 0) + 1
        elif action == 'execute':
            profile.total_executions = (profile.total_executions or 0) + 1

        tiers = list(profile.preferred_tiers or [])
        categories = list(profile.preferred_categories or [])
        scenarios = list(profile.preferred_scenarios or [])

        if skill_tier and skill_tier not in tiers:
            tiers.insert(0, skill_tier)
            tiers = tiers[:10]
            profile.preferred_tiers = tiers

        if skill_category and skill_category not in categories:
            categories.insert(0, skill_category)
            categories = categories[:15]
            profile.preferred_categories = categories

        if scenario and scenario not in scenarios:
            scenarios.insert(0, scenario)
            scenarios = scenarios[:10]
            profile.preferred_scenarios = scenarios

        profile.save(update_fields=[
            'preferred_tiers', 'preferred_categories', 'preferred_scenarios',
            'total_clicks', 'total_executions', 'last_active_at',
        ])


class UserBehaviorViewSet(viewsets.ViewSet):
    permission_classes = []

    @action(detail=False, methods=['post'], url_path='track')
    def track(self, request):
        serializer = BehaviorBatchCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': '参数校验失败',
                'errors': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        logs_data = data.get('logs', [])
        session_id = data.get('session_id', '')

        user = request.user if request.user.is_authenticated else None

        count = 0
        for log_entry in logs_data:
            RecommendationEngine.record_behavior(
                user=user,
                session_id=session_id,
                target_type=log_entry.get('target_type', 'skill'),
                target_id=log_entry.get('target_id', 0),
                action=log_entry.get('action', 'click'),
                skill_tier=log_entry.get('skill_tier', ''),
                skill_category=log_entry.get('skill_category', ''),
                scenario=log_entry.get('scenario', ''),
                source_page=log_entry.get('source_page', ''),
                duration_seconds=log_entry.get('duration_seconds', 0),
                extra_data=log_entry.get('extra_data', {}),
            )
            count += 1

        return Response({
            'success': True,
            'message': f'已记录 {count} 条行为数据',
            'data': {'count': count},
        })

    @action(detail=False, methods=['get'], url_path='recommendations')
    def recommendations(self, request):
        user = request.user if request.user.is_authenticated else None
        limit = min(int(request.query_params.get('limit', 30)), 50)
        strategy = request.query_params.get('strategy', 'auto')

        if strategy == 'auto':
            strategy = RecommendationEngine.get_strategy_for_user(user)

        rec_items = RecommendationEngine.compute_recommendations(
            user=user,
            limit=limit,
            strategy=strategy,
        )

        profile = None
        if user:
            profile = RecommendationEngine.get_user_profile(user)

        return Response({
            'success': True,
            'data': {
                'recommendations': rec_items,
                'total': len(rec_items),
                'user_is_active': RecommendationEngine.is_active_user(user),
                'user_profile': UserProfileSerializer(profile).data if profile else None,
                'strategy_used': strategy,
                'algorithm_version': 'v2.0',
            },
        })

    @action(detail=False, methods=['get'], url_path='hot-skills')
    def hot_skills(self, request):
        limit = min(int(request.query_params.get('limit', 20)), 50)

        hot_skills = SkillConfig.objects.filter(
            status='online'
        ).annotate(
            effective_weight=(
                F('weight') +
                Coalesce(F('usage_count'), 0) * 0.1 +
                (1 if Q(is_hot=True) else 0) * 5 +
                (1 if Q(is_recommended=True) else 0) * 3
            )
        ).order_by('-effective_weight', '-id')[:limit]

        from .user_behavior_serializers import RecommendationItemSerializer
        items = []
        for s in hot_skills:
            item_data = RecommendationItemSerializer(s).data
            item_data['rec_score'] = float(s.effective_weight or s.weight)
            item_data['rec_reason'] = '热门排行' if s.is_hot else '高权重推荐'
            items.append(item_data)

        return Response({
            'success': True,
            'data': {
                'hot_skills': items,
                'count': len(items),
            },
        })

    @action(detail=False, methods=['get'], url_path='new-for-you')
    def new_for_you(self, request):
        user = request.user if request.user.is_authenticated else None
        limit = min(int(request.query_params.get('limit', 15)), 30)

        is_active = RecommendationEngine.is_active_user(user)

        new_qs = SkillConfig.objects.filter(status='online', is_new=True)
        if is_active:
            new_qs = new_qs.annotate(
                new_score=(F('weight') * 1.5 + F('sort_order') * 0.1)
            ).order_by('-new_score', '-id')[:limit]
        else:
            new_qs = new_qs.order_by('-weight', '-id')[:min(limit, 8)]

        from .user_behavior_serializers import RecommendationItemSerializer
        items = []
        for s in new_qs:
            item_data = RecommendationItemSerializer(s).data
            item_data['rec_score'] = float(getattr(s, 'new_score', s.weight) or s.weight)
            item_data['rec_reason'] = '新功能首发' if is_active else '最新上线'
            items.append(item_data)

        return Response({
            'success': True,
            'data': {
                'new_skills': items,
                'count': len(items),
                'is_active_user': is_active,
            },
        })

    @action(detail=False, methods=['get'], url_path='similar-skills')
    def similar_skills(self, request):
        skill_id = request.query_params.get('skill_id')
        limit = min(int(request.query_params.get('limit', 10)), 20)

        if not skill_id:
            return Response({'success': False, 'message': '缺少skill_id'}, status=400)

        try:
            ref_skill = SkillConfig.objects.get(id=skill_id, status='online')
        except SkillConfig.DoesNotExist:
            return Response({'success': False, 'message': '技能不存在'}, status=404)

        similar = SkillConfig.objects.filter(
            status='online'
        ).exclude(id=skill_id).annotate(
            match_score=(
                (1 if Q(tier=ref_skill.tier) else 0) * 3 +
                (1 if Q(category=ref_skill.category) else 0) * 2 +
                (1 if Q(main_scenario=ref_skill.main_scenario) else 0) * 2.5 +
                F('weight') * 0.1
            )
        ).order_by('-match_score', '-id')[:limit]

        from .user_behavior_serializers import RecommendationItemSerializer
        items = []
        for s in similar:
            item_data = RecommendationItemSerializer(s).data
            item_data['rec_score'] = float(s.match_score or 0)
            reason_parts = []
            if s.tier == ref_skill.tier: reason_parts.append('同类层级')
            if s.category == ref_skill.category: reason_parts.append('同分类')
            if s.main_scenario == ref_skill.main_scenario: reason_parts.append('同场景')
            item_data['rec_reason'] = '+'.join(reason_parts) if reason_parts else '相似推荐'
            items.append(item_data)

        return Response({
            'success': True,
            'data': {
                'reference_skill': ref_skill.name,
                'similar_skills': items,
                'count': len(items),
            },
        })

    @action(detail=False, methods=['get'], url_path='detector-engines')
    def detector_engines(self, request):
        from .user_behavior_serializers import RecommendationItemSerializer

        DETECTOR_SKILL_IDS = [1, 4, 5, 7, 51, 52, 57, 58, 59, 62, 63]
        detector_skills = SkillConfig.objects.filter(
            id__in=DETECTOR_SKILL_IDS,
            status='online',
            api_endpoint__ne=''
        ).order_by('-weight', 'sort_order')

        items = []
        for s in detector_skills:
            item_data = RecommendationItemSerializer(s).data
            item_data['is_detector_engine'] = True
            item_data['rec_score'] = float(s.weight or 10)
            item_data['rec_reason'] = f'核心检测引擎 · 对标{s.target_product or "自研"}'
            items.append(item_data)

        return Response({
            'success': True,
            'message': '一鉴到底 7 大核心检测引擎',
            'data': {
                'detector_engines': items,
                'count': len(items),
                'engine_categories': {
                    'content_security': {'name': '内容安全', 'engines': ['全品类内容安全检测', '反欺诈与异常行为检测']},
                    'ai_detection': {'name': 'AI检测', 'engines': ['AI+抄袭双引擎', '学术论文分章节深度检测']},
                    'plagiarism': {'name': '抄袭检测', 'engines': ['全网内容抄袭比对(Copyscale)']},
                    'optimization': {'name': '优化增强', 'engines': ['语法纠错与文风优化(Grammarly)', '简历优化建议(Resume Worded)']},
                },
            },
        })

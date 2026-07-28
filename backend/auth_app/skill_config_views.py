from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import models

from .skill_config_models import SkillConfig
from .skill_config_serializers import (
    SkillConfigListSerializer,
    SkillConfigCreateSerializer,
    SkillConfigUpdateSerializer,
    SkillConfigPagination,
)


class SkillConfigViewSet(viewsets.ModelViewSet):
    queryset = SkillConfig.objects.filter(status='online').order_by('-weight', '-sort_order', 'id')
    permission_classes = [IsAuthenticated]
    pagination_class = SkillConfigPagination

    def get_serializer_class(self):
        if self.action == 'list':
            return SkillConfigListSerializer
        if self.action == 'create':
            return SkillConfigCreateSerializer
        return SkillConfigUpdateSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'public_list', 'public_search', 'categories', 'stats']:
            return []
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'], url_path='public-list')
    def public_list(self, request):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response({'success': True, 'data': serializer.data})

    @action(detail=False, methods=['get'], url_path='public-search')
    def public_search(self, request):
        query = request.query_params.get('q', '').strip()
        tier = request.query_params.get('tier', '')
        category = request.query_params.get('category', '')
        scenario = request.query_params.get('scenario', '')
        monetization = request.query_params.get('monetization', '')
        is_recommended = request.query_params.get('recommended', '')
        is_hot = request.query_params.get('hot', '')
        is_new = request.query_params.get('new', '')
        page_size = min(int(request.query_params.get('page_size', 20)), 50)

        queryset = self.get_queryset()

        if query:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(name__icontains=query) |
                Q(category__icontains=query) |
                Q(main_scenario__icontains=query) |
                Q(keywords__icontains=query) |
                Q(description__icontains=query)
            )
        if tier:
            queryset = queryset.filter(tier=tier)
        if category:
            queryset = queryset.filter(category=category)
        if scenario:
            queryset = queryset.filter(main_scenario=scenario)
        if monetization:
            queryset = queryset.filter(monetization_type=monetization)
        if is_recommended == 'true':
            queryset = queryset.filter(is_recommended=True)
        if is_hot == 'true':
            queryset = queryset.filter(is_hot=True)
        if is_new == 'true':
            queryset = queryset.filter(is_new=True)

        paginator = SkillConfigPagination()
        paginator.page_size = page_size
        page = paginator.paginate_queryset(queryset, request)
        if page is not None:
            serializer = SkillConfigListSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = SkillConfigListSerializer(queryset, many=True)
        return Response({'success': True, 'data': serializer.data})

    @action(detail=False, methods=['get'], url_path='categories')
    def categories(self, request):
        tiers = SkillConfig.objects.values('tier').annotate(
            count=models.Count('id'),
            total_weight=models.Sum('weight'),
        ).order_by('-total_weight')

        tier_map = dict(SkillConfig.TIER_CHOICES)
        result = []
        for t in tiers:
            result.append({
                'key': t['tier'],
                'label': tier_map.get(t['tier'], t['tier']),
                'count': t['count'],
                'total_weight': t['total_weight'] or 0,
            })

        categories = SkillConfig.objects.values('category').distinct()

        return Response({
            'success': True,
            'data': {
                'tiers': result,
                'categories': list(categories.values_list('category', flat=True)),
                'scenarios': list(SkillConfig.objects.values_list('main_scenario', flat=True).distinct()),
                'monetization_types': [m[0] for m in SkillConfig.MONETIZATION_CHOICES],
                'total_skills': SkillConfig.objects.filter(status='online').count(),
            },
        })

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        total = SkillConfig.objects.count()
        online = SkillConfig.objects.filter(status='online').count()
        by_tier = SkillConfig.objects.values('tier').annotate(count=models.Count('id'))
        by_monetization = SkillConfig.objects.values('monetization_type').annotate(count=models.Count('id'))

        return Response({
            'success': True,
            'data': {
                'total': total,
                'online': online,
                'by_tier': list(by_tier),
                'by_monetization': list(by_monetization),
            },
        })

    @action(detail=False, methods=['post'], url_path='batch-import')
    def batch_import(self, request):
        skills_data = request.data.get('skills', [])
        overwrite = request.data.get('overwrite', False)

        if not isinstance(skills_data, list) or len(skills_data) == 0:
            return Response(
                {'success': False, 'message': 'skills参数必须是非空数组'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_count = 0
        updated_count = 0
        errors = []

        for idx, skill_data in enumerate(skills_data):
            try:
                skill_id = skill_data.get('id') or skill_data.get('skill_id')

                defaults = {
                    'name': skill_data.get('name', ''),
                    'category': skill_data.get('category', ''),
                    'main_scenario': skill_data.get('main_scenario', skill_data.get('mainScenario', '')),
                    'keywords': skill_data.get('keywords', []),
                    'weight': int(skill_data.get('weight', 10)),
                    'dev_days': int(skill_data.get('dev_days', skill_data.get('devDays', 3))),
                    'monetization_type': skill_data.get('monetization_type', skill_data.get('monetizationType', 'free+pay')),
                    'tier': skill_data.get('tier', 'core'),
                    'icon_name': skill_data.get('icon_name', skill_data.get('icon', 'Zap')),
                    'icon_color': skill_data.get('icon_color', skill_data.get('color', '#165DFF')),
                    'description': skill_data.get('description', ''),
                    'status': skill_data.get('status', 'online'),
                    'sort_order': int(skill_data.get('sort_order', skill_data.get('id', 0))),
                    'is_recommended': bool(skill_data.get('is_recommended', False)),
                    'is_hot': bool(skill_data.get('is_hot', False)),
                    'is_new': bool(skill_data.get('is_new', True)),
                }

                if skill_id:
                    obj, created = SkillConfig.objects.update_or_create(id=skill_id, defaults=defaults)
                else:
                    name = defaults['name']
                    obj, created = SkillConfig.objects.update_or_create(name=name, defaults=defaults)

                if created:
                    created_count += 1
                else:
                    updated_count += 1

            except Exception as e:
                errors.append({'index': idx, 'error': str(e), 'data': skill_data.get('name', 'unknown')})

        return Response({
            'success': True,
            'message': f'批量导入完成: 新增{created_count}个, 更新{updated_count}个',
            'data': {
                'created': created_count,
                'updated': updated_count,
                'total': len(skills_data),
                'errors': errors[:20],
                'error_count': len(errors),
            },
        })

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        try:
            obj = self.get_object()
            new_status = request.data.get('status')
            if new_status and new_status in dict(SkillConfig.STATUS_CHOICES):
                obj.status = new_status
                obj.save()
            return Response({
                'success': True,
                'message': f'状态已更新为: {obj.get_status_display()}',
                'data': {'id': obj.id, 'status': obj.status},
            })
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=['post'], url_path='batch-toggle')
    def batch_toggle(self, request):
        ids = request.data.get('ids', [])
        new_status = request.data.get('status', 'offline')

        if not isinstance(ids, list) or len(ids) == 0:
            return Response(
                {'success': False, 'message': 'ids参数必须是非空数组'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated = SkillConfig.objects.filter(id__in=ids).update(status=new_status)

        return Response({
            'success': True,
            'message': f'已更新 {updated} 个技能状态',
            'data': {'updated_count': updated, 'new_status': new_status},
        })

    @action(detail=False, methods=['delete'], url_path='batch-delete')
    def batch_delete(self, request):
        ids = request.data.get('ids', [])

        if not isinstance(ids, list) or len(ids) == 0:
            return Response(
                {'success': False, 'message': 'ids参数必须是非空数组'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted, _ = SkillConfig.objects.filter(id__in=ids).delete()

        return Response({
            'success': True,
            'message': f'已删除 {deleted} 个技能配置',
            'data': {'deleted_count': deleted},
        })

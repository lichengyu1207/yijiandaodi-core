from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from datetime import timedelta

from .data_classification_models import (
    DataSensitivityLevel, DataCategory, DataFieldTag,
    DataClassificationRecord, DataExportApproval, DataProtectionOfficer,
)
from .data_classification_serializers import (
    DataSensitivityLevelSerializer, DataCategorySerializer,
    DataFieldTagSerializer, DataClassificationRecordSerializer,
    DataExportApprovalSerializer, DataProtectionOfficerSerializer,
)


class DataSensitivityLevelViewSet(viewsets.ModelViewSet):
    queryset = DataSensitivityLevel.objects.filter(is_active=True)
    serializer_class = DataSensitivityLevelSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'], url_path='overview')
    def overview(self, request):
        levels = self.get_queryset()
        return Response({
            'success': True,
            'data': {
                'total_levels': levels.count(),
                'levels': DataSensitivityLevelSerializer(levels, many=True).data,
                'level_distribution': {
                    level.code: {
                        'name': level.name,
                        'color': level.color,
                        'field_count': DataFieldTag.objects.filter(sensitivity_level=level).count(),
                    }
                    for level in levels
                }
            }
        })


class DataCategoryViewSet(viewsets.ModelViewSet):
    queryset = DataCategory.objects.filter(is_active=True)
    serializer_class = DataCategorySerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'], url_path='tree')
    def tree(self, request):
        categories = self.get_queryset()
        from collections import defaultdict
        by_type = defaultdict(list)
        for cat in categories:
            by_type[cat.category_type].append(DataCategorySerializer(cat).data)

        result = []
        for type_code, type_label in DataCategory.CATEGORY_TYPE_CHOICES:
            if type_code in by_type:
                result.append({
                    'type_code': type_code,
                    'type_name': type_label,
                    'categories': by_type[type_code],
                    'count': len(by_type[type_code]),
                })
        return Response({'success': True, 'data': result})


class DataFieldTagViewSet(viewsets.ModelViewSet):
    queryset = DataFieldTag.objects.all()
    serializer_class = DataFieldTagSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'], url_path='by-pii-type')
    def by_pii_type(self, request):
        tags = self.get_queryset()
        from collections import defaultdict
        by_pii = defaultdict(list)
        for tag in tags:
            by_pii[tag.pii_type].append(DataFieldTagSerializer(tag).data)

        result = []
        for pii_code, pii_label in DataFieldTag.PII_TYPES:
            if pii_code in by_pii:
                result.append({
                    'pii_type': pii_code,
                    'pii_name': pii_label,
                    'fields': by_pii[pii_code],
                    'count': len(by_pii[pii_code]),
                })
        return Response({'success': True, 'data': result})

    @action(detail=False, methods=['post'], url_path='batch-tag')
    def batch_tag(self, request):
        tags_data = request.data.get('tags', [])
        created_count = 0
        for tag_data in tags_data:
            field_path = tag_data.get('field_path')
            if not field_path:
                continue
            DataFieldTag.objects.update_or_create(
                field_path=field_path,
                defaults={
                    'field_label': tag_data.get('field_label', ''),
                    'pii_type': tag_data.get('pii_type', 'other_sensitive'),
                    'sensitivity_level_id': tag_data.get('sensitivity_level_id'),
                    'data_category_id': tag_data.get('data_category_id'),
                    'mask_rule': tag_data.get('mask_rule', 'partial'),
                    'legal_basis': tag_data.get('legal_basis', ''),
                }
            )
            created_count += 1
        return Response({
            'success': True,
            'message': f'成功创建/更新 {created_count} 个字段标签',
            'data': {'created_count': created_count}
        })


class DataClassificationRecordViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DataClassificationRecordSerializer

    def get_queryset(self):
        qs = DataClassificationRecord.objects.all()
        action_type = self.request.query_params.get('action_type')
        level = self.request.query_params.get('level')
        object_type = self.request.query_params.get('object_type')
        days = self.request.query_params.get('days')

        if action_type:
            qs = qs.filter(action_type=action_type)
        if level:
            qs = qs.filter(sensitivity_level__code=level)
        if object_type:
            qs = qs.filter(object_type__icontains=object_type)
        if days:
            since = timezone.now() - timedelta(days=int(days))
            qs = qs.filter(created_at__gte=since)

        return qs.order_by('-created_time')[:500]

    @action(detail=False, methods=['get'], url_path='statistics')
    def statistics(self, request):
        from django.db.models import Count
        thirty_days_ago = timezone.now() - timedelta(days=30)

        stats = {
            'total_records': DataClassificationRecord.objects.count(),
            'recent_30_days': DataClassificationRecord.objects.filter(created_at__gte=thirty_days_ago).count(),
            'by_action_type': list(
                DataClassificationRecord.objects.values('action_type')
                .annotate(count=Count('id'))
                .order_by('-count')[:10]
            ),
            'by_level': list(
                DataClassificationRecord.objects.values(
                    'sensitivity_level__code',
                    'sensitivity_level__name'
                ).annotate(count=Count('id')).order_by('-count')[:10]
            ),
            'by_object_type': list(
                DataClassificationRecord.objects.values('object_type')
                .annotate(count=Count('id'))
                .order_by('-count')[:15]
            ),
            'auto_classified_rate': round(
                DataClassificationRecord.objects.filter(
                    action_type='auto_classified',
                    auto_classification_score__gte=0.8
                ).count() / max(DataClassificationRecord.objects.filter(
                    action_type='auto_classified'
                ).count(), 1) * 100, 1
            ) if DataClassificationRecord.objects.filter(action_type='auto_classified').exists() else 0,
        }

        return Response({'success': True, 'data': stats})

    @action(detail=False, methods=['post'], url_path='classify-object')
    def classify_object(self, request):
        object_type = request.data.get('object_type')
        object_id = request.data.get('object_id')
        level_code = request.data.get('level_code')
        category_code = request.data.get('category_code')
        reason = request.data.get('reason', '')

        if not all([object_type, object_id, level_code]):
            return Response({
                'success': False,
                'message': '缺少必要参数: object_type, object_id, level_code'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            level = DataSensitivityLevel.objects.get(code=level_code)
        except DataSensitivityLevel.DoesNotExist:
            return Response({
                'success': False,
                'message': f'敏感级别不存在: {level_code}'
            }, status=status.HTTP_404_NOT_FOUND)

        category = None
        if category_code:
            try:
                category = DataCategory.objects.get(code=category_code)
            except DataCategory.DoesNotExist:
                pass

        record = DataClassificationRecord.objects.create(
            object_type=object_type,
            object_id=int(object_id),
            object_repr=request.data.get('object_repr', '')[:300],
            sensitivity_level=level,
            data_category=category,
            action_type='manual_classified' if not request.data.get('is_auto') else 'auto_classified',
            operator=request.user if request.user.is_authenticated else None,
            operator_role=getattr(request.user, 'role', '') or '',
            reason=reason,
            ip_address=self._get_client_ip(request),
            auto_classification_score=request.data.get('confidence_score'),
            classification_rules_matched=request.data.get('matched_rules', []),
        )

        return Response({
            'success': True,
            'message': '数据分级成功',
            'data': DataClassificationRecordSerializer(record).data
        })

    def _get_client_ip(self, request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '')


class DataExportApprovalViewSet(viewsets.ModelViewSet):
    queryset = DataExportApproval.objects.all()
    serializer_class = DataExportApprovalSerializer

    def get_permissions(self):
        if self.action in ('create', 'my_requests'):
            return [IsAuthenticated()]
        elif self.action in ('approve', 'reject', 'list'):
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        max_level = 'L1'
        for obj_type in self.request.data.get('object_types', []):
            tags = DataFieldTag.objects.filter(field_path__startswith=obj_type)
            for t in tags:
                if t.sensitivity_level and t.sensitivity_level.code > max_level:
                    max_level = t.sensitivity_level.code

        serializer.save(
            requester=self.request.user,
            max_sensitivity_level=max_level,
            ip_address=self._get_client_ip(self.request),
        )

    @action(detail=False, methods=['get'], url_path='my-requests')
    def my_requests(self, request):
        approvals = self.get_queryset().filter(requester=request.user)
        return Response({
            'success': True,
            'data': DataExportApprovalSerializer(approvals, many=True).data
        })

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        approval = self.get_object()
        if not request.user.is_staff:
            return Response({'success': False, 'message': '无审批权限'}, status=status.HTTP_403_FORBIDDEN)
        approval.status = 'approved'
        approval.approver = request.user
        approval.approval_comment = request.data.get('comment', '')
        approval.approved_at = timezone.now()
        approval.expires_at = timezone.now() + timedelta(hours=24)
        approval.save()

        DataClassificationRecord.objects.create(
            object_type='DataExportApproval',
            object_id=approval.id,
            object_repr=f'导出审批#{approval.id}',
            sensitivity_level_id=approval.max_sensitivity_level or 1,
            action_type='access_granted',
            operator=request.user,
            operator_role=request.user.role,
            reason=f'批准导出: {approval.purpose[:100]}',
            ip_address=self._get_client_ip(request),
        )
        return Response({'success': True, 'message': '已批准导出申请'})

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        approval = self.get_object()
        if not request.user.is_staff:
            return Response({'success': False, 'message': '无审批权限'}, status=status.HTTP_403_FORBIDDEN)
        approval.status = 'rejected'
        approval.approver = request.user
        approval.approval_comment = request.data.get('comment', '')
        approval.save()

        DataClassificationRecord.objects.create(
            object_type='DataExportApproval',
            object_id=approval.id,
            object_repr=f'导出审批#{approval.id}拒绝',
            action_type='access_denied',
            operator=request.user,
            operator_role=request.user.role,
            reason=request.data.get('comment', ''),
            ip_address=self._get_client_ip(request),
        )
        return Response({'success': True, 'message': '已拒绝导出申请'})

    def _get_client_ip(self, request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '')


class DataProtectionOfficerViewSet(viewsets.ModelViewSet):
    queryset = DataProtectionOfficer.objects.all()
    serializer_class = DataProtectionOfficerSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'], url_path='active-dpo')
    def active_dpo(self, request):
        dpos = DataProtectionOfficer.objects.filter(is_active=True).select_related('user')
        return Response({
            'success': True,
            'data': DataProtectionOfficerSerializer(dpos, many=True).data
        })


class DataComplianceDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        total_fields = DataFieldTag.objects.count()
        pii_fields = DataFieldTag.objects.exclude(pii_type='other_sensitive').count()
        encrypted_fields = DataFieldTag.objects.filter(is_encrypted_at_rest=True).count()

        level_stats = {}
        for level in DataSensitivityLevel.objects.filter(is_active=True):
            count = DataFieldTag.objects.filter(sensitivity_level=level).count()
            level_stats[level.code] = {
                'name': level.name,
                'color': level.color,
                'field_count': count,
                'encryption_required': level.encryption_required,
                'export_approval_required': level.export_approval_required,
            }

        recent_records = DataClassificationRecord.objects.filter(
            created_at__gte=thirty_days_ago
        ).count()

        pending_exports = DataExportApproval.objects.filter(
            status='pending'
        ).count()

        active_dpo_count = DataProtectionOfficer.objects.filter(is_active=True).count()

        categories_with_compliance = DataCategory.objects.filter(
            compliance_requirements__len__gt=0
        ).count()

        return Response({
            'success': True,
            'data': {
                'summary': {
                    'total_tagged_fields': total_fields,
                    'pii_field_count': pii_fields,
                    'pii_coverage_pct': round(pii_fields / max(total_fields, 1) * 100, 1),
                    'encrypted_field_count': encrypted_fields,
                    'recent_classification_actions': recent_records,
                    'pending_export_approvals': pending_exports,
                    'active_dpo_count': active_dpo_count,
                    'categories_with_compliance_rules': categories_with_compliance,
                },
                'level_breakdown': level_stats,
                'compliance_status': {
                    'has_dpo_appointed': active_dpo_count > 0,
                    'classification_system_active': DataSensitivityLevel.objects.filter(is_active=True).exists() > 3,
                    'export_approval_enabled': DataSensitivityLevel.objects.filter(export_approval_required=True).exists(),
                    'audit_logging_enabled': DataSensitivityLevel.objects.filter(access_log_required=True).exists(),
                    'retention_policy_set': DataSensitivityLevel.objects.filter(retention_days__gt=0).exists(),
                },
                'legal_basises': list(
                    DataFieldTag.objects.exclude(legal_basis='')
                    .values_list('legal_basis', flat=True)
                    .distinct()[:20]
                ),
            }
        })

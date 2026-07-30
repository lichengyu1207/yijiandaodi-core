import re
import time
import hashlib
import json
from datetime import datetime, timedelta
from django.db.models import Q, Count, Sum
from django.utils import timezone
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter

from .risk_control_models import RegexRule, ContentAuditLog, RegexTestCase
from .risk_control_serializers import (
    RegexRuleSerializer,
    RegexRuleCreateSerializer,
    RegexRuleTestSerializer,
    ContentAuditLogSerializer,
    TextCheckRequestSerializer,
    TextCheckResponseSerializer,
    BatchImportSerializer,
    RegexTestCaseSerializer,
    StatisticsSerializer,
)


class RegexRuleViewSet(viewsets.ModelViewSet):
    """正则规则管理 API"""
    queryset = RegexRule.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'pattern', 'description']
    ordering_fields = ['sort_order', 'match_count', 'created_at', 'severity']
    ordering = ['sort_order', 'id']

    def get_serializer_class(self):
        if self.action in ('create',):
            return RegexRuleCreateSerializer
        return RegexRuleSerializer

    def get_queryset(self):
        queryset = RegexRule.objects.all()
        category = self.request.query_params.get('category')
        severity = self.request.query_params.get('severity')
        is_enabled = self.request.query_params.get('is_enabled')
        action_type = self.request.query_params.get('action')
        if category:
            queryset = queryset.filter(category=category)
        if severity:
            queryset = queryset.filter(severity=severity)
        if is_enabled is not None:
            queryset = queryset.filter(is_enabled=is_enabled.lower() == 'true')
        if action_type:
            queryset = queryset.filter(action=action_type)
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True)
        data = {
            'success': True,
            'count': queryset.count(),
            'data': serializer.data,
        }
        if page is not None:
            data = self.get_paginated_response(serializer.data).data
            data['success'] = True
        return Response(data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            serializer.validated_data['created_by'] = user.id
        instance = serializer.save()
        return Response({
            'success': True,
            'message': '规则创建成功',
            'data': RegexRuleSerializer(instance).data,
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'success': True,
            'message': '规则更新成功',
            'data': RegexRuleSerializer(instance).data,
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.name
        instance.delete()
        return Response({
            'success': True,
            'message': f'规则「{name}」已删除',
        })

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """获取分类统计"""
        categories = [
            {'value': 'sensitive_word', 'label': '敏感词'},
            {'value': 'spam', 'label': '垃圾广告'},
            {'value': 'political', 'label': '政治敏感'},
            {'value': 'pornography', 'label': '色情低俗'},
            {'value': 'violence', 'label': '暴力恐吓'},
            {'value': 'personal_info', 'label': '个人信息'},
        ]
        counts = dict(
            RegexRule.objects.values_list('category')
            .annotate(count=Count('id'))
            .values_list('category', 'count')
        )
        for cat in categories:
            cat['count'] = counts.get(cat['value'], 0)
        return Response({'success': True, 'data': categories})

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """统计概览"""
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        total_rules = RegexRule.objects.count()
        enabled_rules = RegexRule.objects.filter(is_enabled=True).count()
        by_category = dict(
            RegexRule.objects.values_list('category')
            .annotate(count=Count('id')).values_list('category', 'count')
        )
        by_severity = dict(
            RegexRule.objects.values_list('severity')
            .annotate(count=Count('id')).values_list('severity', 'count')
        )
        total_matches = RegexRule.objects.aggregate(total=Sum('match_count'))['total'] or 0
        total_audits = ContentAuditLog.objects.count()
        today_audits = ContentAuditLog.objects.filter(created_at__gte=today_start).count()
        blocked_count = ContentAuditLog.objects.filter(result='blocked').count()
        passed_count = ContentAuditLog.objects.filter(result='passed').count()
        data = {
            'total_rules': total_rules,
            'enabled_rules': enabled_rules,
            'disabled_rules': total_rules - enabled_rules,
            'by_category': by_category,
            'by_severity': by_severity,
            'total_matches': total_matches,
            'total_audits': total_audits,
            'today_audits': today_audits,
            'blocked_count': blocked_count,
            'passed_count': passed_count,
        }
        serializer = StatisticsSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        return Response({'success': True, 'data': serializer.validated_data})

    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """测试单条规则的匹配效果"""
        rule = self.get_object()
        serializer = RegexRuleTestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        text = serializer.validated_data['text']
        result = rule.test_pattern(text)
        return Response({'success': True, 'rule_id': rule.id, 'rule_name': rule.name, 'data': result})

    @action(detail=False, methods=['post'])
    def test_raw(self, request):
        """测试原始正则表达式（不需要保存的规则）"""
        serializer = RegexRuleTestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        text = serializer.validated_data['text']
        if serializer.validated_data.get('rule_id'):
            try:
                rule = RegexRule.objects.get(id=serializer.validated_data['rule_id'])
                pattern = rule.pattern
                name = rule.name
                rule_id = rule.id
            except RegexRule.DoesNotExist:
                return Response({'success': False, 'message': '规则不存在'}, status=status.HTTP_404_NOT_FOUND)
        else:
            pattern = serializer.validated_data['pattern']
            name = '临时测试'
            rule_id = None
        try:
            compiled = re.compile(pattern)
            matches = compiled.findall(text)
            matched_obj = compiled.search(text)
            result = {
                'valid': True,
                'matched': len(matches) > 0,
                'match_count': len(matches),
                'matches': matches[:50],
                'matched_text': matched_obj.group() if matched_obj else '',
                'position': list(matched_obj.span()) if matched_obj else None,
            }
        except re.error as e:
            result = {
                'valid': False,
                'error': str(e),
                'matched': False,
                'match_count': 0,
                'matches': [],
                'matched_text': '',
                'position': None,
            }
        return Response({
            'success': True,
            'rule_id': rule_id,
            'rule_name': name,
            'pattern': pattern,
            'data': result,
        })

    @action(detail=False, methods=['post'])
    def batch_toggle(self, request):
        """批量启用/禁用"""
        ids = request.data.get('ids', [])
        is_enabled = request.data.get('is_enabled', True)
        if not ids:
            return Response({'success': False, 'message': '请选择要操作的规则'}, status=status.HTTP_400_BAD_REQUEST)
        updated = RegexRule.objects.filter(id__in=ids).update(is_enabled=is_enabled)
        action_text = '启用' if is_enabled else '禁用'
        return Response({
            'success': True,
            'message': f'已{action_text} {updated} 条规则',
            'updated_count': updated,
        })

    @action(detail=False, methods=['post'])
    def batch_delete(self, request):
        """批量删除"""
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'success': False, 'message': '请选择要删除的规则'}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = RegexRule.objects.filter(id__in=ids).delete()
        return Response({
            'success': True,
            'message': f'已删除 {deleted} 条规则',
            'deleted_count': deleted,
        })

    @action(detail=False, methods=['post'])
    def batch_import(self, request):
        """批量导入规则"""
        serializer = BatchImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rules_data = serializer.validated_data['rules']
        overwrite = serializer.validated_data.get('overwrite', False)
        created = 0
        updated = 0
        errors = []
        for i, rule_data in enumerate(rules_data):
            try:
                existing = RegexRule.objects.filter(name=rule_data['name']).first()
                if existing and overwrite:
                    for key, value in rule_data.items():
                        if key != 'name' and hasattr(existing, key):
                            setattr(existing, key, value)
                    existing.save()
                    updated += 1
                elif existing:
                    errors.append(f'第{i+1}条: 规则「{rule_data["name"]}」已存在，未设置覆盖')
                else:
                    RegexRule.objects.create(**rule_data)
                    created += 1
            except Exception as e:
                errors.append(f'第{i+1}条: {str(e)}')
        return Response({
            'success': True,
            'message': f'导入完成：新增{created}条，更新{updated}条，失败{len(errors)}条',
            'created': created,
            'updated': updated,
            'errors': errors,
        })

    @action(detail=False, methods=['get'])
    def export(self, request):
        """导出所有规则（JSON格式）"""
        queryset = RegexRule.objects.all()
        category = request.query_params.get('category')
        only_enabled = request.query_params.get('only_enabled')
        if category:
            queryset = queryset.filter(category=category)
        if only_enabled == 'true':
            queryset = queryset.filter(is_enabled=True)
        serializer = RegexRuleSerializer(queryset, many=True)
        return Response({
            'success': True,
            'exported_at': timezone.now().isoformat(),
            'total': queryset.count(),
            'data': serializer.data,
        })


class ContentAuditLogViewSet(viewsets.GenericViewSet,
                             mixins.ListModelMixin,
                             mixins.RetrieveModelMixin,
                             mixins.DestroyModelMixin):
    """内容审核日志 API"""
    queryset = ContentAuditLog.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = ContentAuditLogSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['content', 'username']
    ordering_fields = ['created_at', 'risk_level', 'total_matches', 'processing_time_ms']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = ContentAuditLog.objects.all()
        result = self.request.query_params.get('result')
        risk_level = self.request.query_params.get('risk_level')
        source = self.request.query_params.get('source')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if result:
            queryset = queryset.filter(result=result)
        if risk_level:
            queryset = queryset.filter(risk_level=risk_level)
        if source:
            queryset = queryset.filter(source=source)
        if date_from:
            try:
                dt = datetime.strptime(date_from, '%Y-%m-%d')
                queryset = queryset.filter(created_at__gte=dt)
            except ValueError:
                pass
        if date_to:
            try:
                dt = datetime.strptime(date_to, '%Y-%m-%d') + timedelta(days=1)
                queryset = queryset.filter(created_at__lt=dt)
            except ValueError:
                pass
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True)
        data = {
            'success': True,
            'count': queryset.count(),
            'data': serializer.data,
        }
        if page is not None:
            data = self.get_paginated_response(serializer.data).data
            data['success'] = True
        return Response(data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response({'success': True, 'message': '日志已删除'})

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """审核日志统计"""
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today_start - timedelta(days=7)
        total = ContentAuditLog.objects.count()
        today_total = ContentAuditLog.objects.filter(created_at__gte=today_start).count()
        week_total = ContentAuditLog.objects.filter(created_at__gte=week_ago).count()
        by_result = dict(
            ContentAuditLog.objects.values_list('result')
            .annotate(count=Count('id')).values_list('result', 'count')
        )
        by_risk = dict(
            ContentAuditLog.objects.values_list('risk_level')
            .annotate(count=Count('id')).values_list('risk_level', 'count')
        )
        by_source = dict(
            ContentAuditLog.objects.values_list('source')
            .annotate(count=Count('id'))[:10].values_list('source', 'count')
        )
        trend_7d = []
        for i in range(7):
            d = (today_start - timedelta(days=6-i)).strftime('%Y-%m-%d')
            day_start = datetime.strptime(d, '%Y-%m-%d')
            day_end = day_start + timedelta(days=1)
            c = ContentAuditLog.objects.filter(
                created_at__gte=day_start, created_at__lt=day_end
            ).count()
            blocked = ContentAuditLog.objects.filter(
                created_at__gte=day_start, created_at__lt=day_end, result='blocked'
            ).count()
            trend_7d.append({'date': d, 'total': c, 'blocked': blocked})
        return Response({
            'success': True,
            'data': {
                'total': total,
                'today_total': today_total,
                'week_total': week_total,
                'by_result': by_result,
                'by_risk': by_risk,
                'by_source': by_source,
                'trend_7d': trend_7d,
            }
        })


class TextCheckView:
    """文本内容检测引擎"""

    @staticmethod
    def check_content(content, source='web'):
        start_time = time.time()
        rules = RegexRule.objects.filter(is_enabled=True).order_by('-severity', 'sort_order')
        matched_rules = []
        total_matches = 0
        highest_severity = 'low'
        severity_rank = {'low': 1, 'medium': 2, 'high': 3, 'critical': 4}
        for rule in rules:
            try:
                compiled = re.compile(rule.pattern)
                matches = compiled.findall(content)
                if matches:
                    match_info = {
                        'rule_id': rule.id,
                        'rule_name': rule.name,
                        'category': rule.category,
                        'category_display': rule.get_category_display(),
                        'severity': rule.severity,
                        'action': rule.action,
                        'match_count': len(matches),
                        'matches': matches[:10],
                        'pattern': rule.pattern,
                    }
                    matched_rules.append(match_info)
                    total_matches += len(matches)
                    if severity_rank.get(rule.severity, 0) > severity_rank.get(highest_severity, 0):
                        highest_severity = rule.severity
                    RegexRule.objects.filter(id=rule.id).update(match_count=F('match_count') + 1)
            except re.error:
                continue
        processing_time = int((time.time() - start_time) * 1000)
        if highest_severity in ('critical', 'high'):
            result = 'blocked'
            action_taken = 'block'
        elif matched_rules:
            result = 'warning'
            action_taken = 'warn'
        else:
            result = 'passed'
            action_taken = 'pass'
        content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()
        log = ContentAuditLog.objects.create(
            content=content[:2000],
            content_hash=content_hash,
            source=source,
            result=result,
            risk_level=highest_severity,
            total_matches=total_matches,
            matched_rules=matched_rules,
            action_taken=action_taken,
            processing_time_ms=processing_time,
        )
        return {
            'result': result,
            'risk_level': highest_severity,
            'total_matches': total_matches,
            'matched_rules': matched_rules,
            'processing_time_ms': processing_time,
            'log_id': log.id,
            'message': '检测通过' if result == 'passed' else f'发现{total_matches}处风险内容',
        }


from django.db.models import F


class CheckContentViewSet(viewsets.GenericViewSet):
    """内容检测接口"""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def check(self, request):
        """检测文本内容"""
        serializer = TextCheckRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data['content']
        source = serializer.validated_data.get('source', 'web')
        result = TextCheckView.check_content(content, source)
        response_serializer = TextCheckResponseSerializer(data=result)
        response_serializer.is_valid(raise_exception=True)
        return Response({'success': True, 'data': response_serializer.validated_data})

    @action(detail=False, methods=['post'])
    def quick_check(self, request):
        """快速检测（轻量版，不记录日志）"""
        content = request.data.get('content', '')
        if not content:
            return Response({'success': False, 'message': '请提供待检测内容'}, status=status.HTTP_400_BAD_REQUEST)
        rules = RegexRule.objects.filter(is_enabled=True).order_by('-severity', 'sort_order')
        matched = []
        total = 0
        for rule in rules:
            try:
                m = re.findall(rule.pattern, content)
                if m:
                    matched.append({
                        'rule_name': rule.name,
                        'category': rule.get_category_display(),
                        'severity': rule.severity,
                        'action': rule.action,
                        'count': len(m),
                    })
                    total += len(m)
            except re.error:
                continue
        risk = 'critical' if any(r['severity'] == 'critical' for r in matched) else \
               'high' if any(r['severity'] == 'high' for r in matched) else \
               'medium' if matched else 'low'
        return Response({
            'success': True,
            'data': {
                'result': 'blocked' if risk in ('critical', 'high') else ('warning' if matched else 'passed'),
                'risk_level': risk,
                'total_matches': total,
                'matched_rules': matched,
                'message': f'检测到{total}处风险' if matched else '内容安全',
            }
        })


class RegexTestCaseViewSet(viewsets.ModelViewSet):
    """正则测试用例管理"""
    queryset = RegexTestCase.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = RegexTestCaseSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        rule_id = request.query_params.get('rule_id')
        if rule_id:
            queryset = queryset.filter(rule_id=rule_id)
        serializer = self.get_serializer(queryset, many=True)
        return Response({'success': True, 'count': queryset.count(), 'data': serializer.data})

    @action(detail=False, methods=['post'])
    def run_all(self, request):
        """运行所有活跃测试用例"""
        cases = RegexTestCase.objects.filter(status='active').select_related('rule')
        results = []
        passed = 0
        failed = 0
        error = 0
        for case in cases:
            if not case.rule:
                results.append({'case_id': case.id, 'status': 'error', 'reason': '无关联规则'})
                error += 1
                continue
            try:
                test_result = case.rule.test_pattern(case.test_text)
                actual_match = test_result.get('matched', False)
                actual_hits = test_result.get('match_count', 0)
                case.actual_match = actual_match
                case.actual_hits = actual_hits
                case.save(update_fields=['actual_match', 'actual_hits'])
                if actual_match == case.expected_match:
                    passed += 1
                    case_status = 'pass'
                else:
                    failed += 1
                    case_status = 'fail'
                results.append({
                    'case_id': case.id,
                    'rule_name': case.rule.name,
                    'test_text': case.test_text[:50],
                    'expected': case.expected_match,
                    'actual': actual_match,
                    'status': case_status,
                })
            except Exception as e:
                error += 1
                results.append({'case_id': case.id, 'status': 'error', 'reason': str(e)})
        return Response({
            'success': True,
            'summary': {'total': cases.count(), 'passed': passed, 'failed': failed, 'error': error},
            'results': results,
        })

import json
from datetime import date, timedelta, datetime as dt
from django.db.models import Q, Count, Sum, F
from django.utils import timezone
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter

from .security_center_models import SecurityScore, SecurityAlert, SecurityReport
from .security_center_serializers import (
    SecurityScoreSerializer,
    SecurityAlertSerializer,
    SecurityAlertUpdateSerializer,
    SecurityReportSerializer,
    DashboardSummarySerializer,
    UnifiedLogEntrySerializer,
)


class DashboardViewSet(viewsets.GenericViewSet):
    """安全仪表盘 API"""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def summary(self, request):
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = (today_start - timedelta(days=7)).date()

        try:
            from auth_app.security_test_models import SecurityVulnerability
            vuln_stats = {
                'total': SecurityVulnerability.objects.count(),
                'open': SecurityVulnerability.objects.filter(status='open').count(),
                'critical': SecurityVulnerability.objects.filter(severity='critical', status__in=['open', 'in_progress']).count(),
                'high': SecurityVulnerability.objects.filter(severity='high', status__in=['open', 'in_progress']).count(),
            }
        except Exception:
            vuln_stats = {'total': 0, 'open': 0, 'critical': 0, 'high': 0}

        try:
            from auth_app.risk_control_models import ContentAuditLog
            audit_stats = {
                'today_total': ContentAuditLog.objects.filter(created_at__gte=today_start).count(),
                'week_total': ContentAuditLog.objects.filter(created_at__gte=week_ago).count(),
                'blocked_today': ContentAuditLog.objects.filter(result='blocked', created_at__gte=today_start).count(),
                'warning_today': ContentAuditLog.objects.filter(result='warning', created_at__gte=today_start).count(),
                'passed_today': ContentAuditLog.objects.filter(result='passed', created_at__gte=today_start).count(),
            }
        except Exception:
            audit_stats = {'today_total': 0, 'week_total': 0, 'blocked_today': 0, 'warning_today': 0, 'passed_today': 0}

        try:
            from auth_app.rbac_models import OperationLog
            op_log_count = OperationLog.objects.filter(created_at__gte=today_start).count()
        except Exception:
            op_log_count = 0

        try:
            from content_app.rag_models import RAGOperationLog
            rag_log_count = RAGOperationLog.objects.filter(created_at__gte=today_start).count()
        except Exception:
            rag_log_count = 0

        try:
            from auth_app.risk_control_models import RegexRule
            active_rules = RegexRule.objects.filter(is_enabled=True).count()
        except Exception:
            active_rules = 0

        alert_stats = {
            'active': SecurityAlert.objects.filter(status='active').count(),
            'critical': SecurityAlert.objects.filter(status='active', severity='critical').count(),
            'high': SecurityAlert.objects.filter(status='active', severity='high').count(),
        }

        total_events = audit_stats['today_total'] + op_log_count + rag_log_count
        score = self._calculate_score(vuln_stats, audit_stats, alert_stats)

        recent_alerts = list(
            SecurityAlert.objects.filter(status='active')
            .order_by('-triggered_at')[:5]
            .values('id', 'title', 'severity', 'category', 'triggered_at')
        )

        trend_7d = []
        for i in range(7):
            d = (today_start - timedelta(days=6-i)).strftime('%Y-%m-%d')
            day_start = dt.strptime(d, '%Y-%m-%d')
            day_end = day_start + timedelta(days=1)
            try:
                blocked = ContentAuditLog.objects.filter(
                    created_at__gte=day_start, created_at__lt=day_end, result='blocked'
                ).count()
            except Exception:
                blocked = 0
            try:
                ops = OperationLog.objects.filter(
                    created_at__gte=day_start, created_at__lt=day_end
                ).count()
            except Exception:
                ops = 0
            trend_7d.append({
                'date': d,
                'events': ops + blocked,
                'blocked': blocked,
            })

        by_category = {
            'vulns_open': vuln_stats['open'],
            'alerts_active': alert_stats['active'],
            'audits_blocked_today': audit_stats['blocked_today'],
            'operations_today': op_log_count,
        }

        data = {
            'security_score': score['total'],
            'score_level': score['level'],
            'today_events': total_events,
            'open_alerts': alert_stats['active'],
            'critical_alerts': alert_stats['critical'],
            'unresolved_vulns': vuln_stats['open'],
            'today_blocked': audit_stats['blocked_today'],
            'today_audits': audit_stats['today_total'],
            'active_rules': active_rules,
            'recent_alerts': recent_alerts,
            'trend_7d': trend_7d,
            'by_category': by_category,
        }
        serializer = DashboardSummarySerializer(data=data)
        serializer.is_valid(raise_exception=True)

        latest_score = SecurityScore.objects.first()
        if not latest_score or abs(latest_score.total_score - score['total']) > 2:
            SecurityScore.objects.create(
                total_score=score['total'],
                level=score['level'],
                vulnerability_score=score.get('vuln_deduction', 0),
                risk_score=score.get('risk_deduction', 0),
                audit_score=score.get('audit_deduction', 0),
                open_vulns=vuln_stats['open'],
                critical_vulns=vuln_stats['critical'],
                high_risk_events=audit_stats['blocked_today'] + audit_stats['warning_today'],
                blocked_content=audit_stats['blocked_today'],
                failed_tests=0,
                details=data,
            )

        return Response({'success': True, 'data': serializer.validated_data})

    def _calculate_score(self, vuln_stats, audit_stats, alert_stats):
        base = 100
        vuln_deduction = min(vuln_stats['open'] * 3 + vuln_stats['critical'] * 15 + vuln_stats['high'] * 8, 40)
        risk_deduction = min(audit_stats['blocked_today'] * 2 + audit_stats['warning_today'], 20)
        alert_deduction = min(alert_stats['critical'] * 10 + alert_stats['high'] * 5, 25)
        total = base - vuln_deduction - risk_deduction - alert_deduction
        total = max(total, 0)
        if total >= 85:
            level = 'excellent'
        elif total >= 70:
            level = 'good'
        elif total >= 50:
            level = 'warning'
        elif total >= 30:
            level = 'danger'
        else:
            level = 'critical'
        return {
            'total': total,
            'level': level,
            'vuln_deduction': vuln_deduction,
            'risk_deduction': risk_deduction,
            'audit_deduction': alert_deduction,
        }

    @action(detail=False, methods=['get'])
    def score_history(self, request):
        scores = SecurityScore.objects.all()[:30]
        data = SecurityScoreSerializer(scores, many=True).data
        return Response({'success': True, 'data': data})


class UnifiedLogCenterViewSet(viewsets.GenericViewSet):
    """统一审计日志中心"""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def unified(self, request):
        log_type = request.query_params.get('log_type', '')
        source = request.query_params.get('source', '')
        user_query = request.query_params.get('user', '')
        result = request.query_params.get('result', '')
        date_from = request.query_params.get('date_from', '')
        date_to = request.query_params.get('date_to', '')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        search = request.query_params.get('search', '')

        all_logs = []

        if not log_type or log_type == 'operation':
            all_logs.extend(self._get_operation_logs(source, user_query, result, date_from, date_to, search))
        if not log_type or log_type == 'content_audit':
            all_logs.extend(self._get_audit_logs(source, user_query, result, date_from, date_to, search))
        if not log_type or log_type == 'rag':
            all_logs.extend(self._get_rag_logs(source, user_query, result, date_from, date_to, search))
        if not log_type or log_type == 'permission':
            all_logs.extend(self._get_permission_logs(source, user_query, result, date_from, date_to, search))

        all_logs.sort(key=lambda x: x['created_at'], reverse=True)
        total = len(all_logs)
        start = (page - 1) * page_size
        paginated = all_logs[start:start + page_size]

        return Response({
            'success': True,
            'count': total,
            'data': paginated,
        })

    def _get_operation_logs(self, source, user_q, result, df, dt, search):
        try:
            from auth_app.rbac_views import _create_operation_log
            from auth_app.rbac_models import OperationLog
            qs = OperationLog.objects.all()
            if user_q:
                qs = qs.filter(Q(username__icontains=user_q) | Q(user_id__icontains=user_q))
            if result:
                qs = qs.filter(operation_result=result)
            if search:
                qs = qs.filter(Q(module__icontains=search) | Q(action__icontains=search) | Q(detail__icontains=search))
            if df:
                try: qs = qs.filter(created_at__gte=dt.strptime(df, '%Y-%m-%d'))
                except: pass
            if dt:
                try: qs = qs.filter(created_at__lt=dt.strptime(dt, '%Y-%m-%d') + timedelta(days=1))
                except: pass
            return [{
                'id': f'op_{log.id}', 'log_type': 'operation', 'source': 'RBAC',
                'user': log.username or f'#{log.user_id}',
                'action': f'{log.module}/{log.action}',
                'detail': log.detail[:200] if log.detail else '',
                'result': log.operation_result or 'success',
                'ip_address': str(log.ip_address) if log.ip_address else '',
                'created_at': log.created_at.isoformat(),
            } for log in qs]
        except Exception:
            return []

    def _get_audit_logs(self, source, user_q, result, df, dt, search):
        try:
            from auth_app.risk_control_models import ContentAuditLog
            qs = ContentAuditLog.objects.all()
            if user_q:
                qs = qs.filter(Q(username__icontains=user_q))
            if result:
                qs = qs.filter(result=result)
            if source:
                qs = qs.filter(source=source)
            if search:
                qs = qs.filter(content__icontains=search)
            if df:
                try: qs = qs.filter(created_at__gte=dt.strptime(df, '%Y-%m-%d'))
                except: pass
            if dt:
                try: qs = qs.filter(created_at__lt=dt.strptime(dt, '%Y-%m-%d') + timedelta(days=1))
                except: pass
            return [{
                'id': f'audit_{log.id}', 'log_type': 'content_audit', 'source': log.source,
                'user': log.username_display,
                'action': '内容审核',
                'detail': log.content[:200] if log.content else '',
                'result': log.result,
                'risk_level': log.risk_level,
                'ip_address': str(log.ip_address) if log.ip_address else '',
                'created_at': log.created_at.isoformat(),
            } for log in qs]
        except Exception:
            return []

    def _get_rag_logs(self, source, user_q, result, df, dt, search):
        try:
            from content_app.rag_models import RAGOperationLog
            qs = RAGOperationLog.objects.all()
            if user_q:
                qs = qs.filter(Q(username__icontains=user_q))
            if result:
                qs = qs.filter(status=result)
            if search:
                qs = qs.filter(Q(action__icontains=search) | Q(target_name__icontains=search))
            if df:
                try: qs = qs.filter(created_at__gte=dt.strptime(df, '%Y-%m-%d'))
                except: pass
            if dt:
                try: qs = qs.filter(created_at__lt=dt.strptime(dt, '%Y-%m-%d') + timedelta(days=1))
                except: pass
            return [{
                'id': f'rag_{log.id}', 'log_type': 'rag', 'source': 'RAG',
                'user': log.username or f'#{log.user_id}',
                'action': log.get_action_display() if hasattr(log, 'get_action_display') else log.action,
                'detail': log.target_name[:200] if log.target_name else '',
                'result': log.status or 'success',
                'ip_address': str(log.ip_address) if log.ip_address else '',
                'created_at': log.created_at.isoformat(),
            } for log in qs]
        except Exception:
            return []

    def _get_permission_logs(self, source, user_q, result, df, dt, search):
        try:
            from auth_app.rbac_models import PermissionAuditLog
            qs = PermissionAuditLog.objects.all()
            if user_q:
                qs = qs.filter(Q(username__icontains=user_q))
            if search:
                qs = qs.filter(Q(target_name__icontains=search) | Q(action__icontains=search))
            if df:
                try: qs = qs.filter(created_at__gte=dt.strptime(df, '%Y-%m-%d'))
                except: pass
            if dt:
                try: qs = qs.filter(created_at__lt=dt.strptime(dt, '%Y-%m-%d') + timedelta(days=1))
                except: pass
            return [{
                'id': f'perm_{log.id}', 'log_type': 'permission', 'source': '权限',
                'user': log.username or f'#{log.user_id}',
                'action': log.action,
                'detail': log.target_name[:200] if log.target_name else '',
                'result': log.status or 'success',
                'ip_address': str(log.ip_address) if log.ip_address else '',
                'created_at': log.created_at.isoformat(),
            } for log in qs]
        except Exception:
            return []


class SecurityAlertViewSet(viewsets.ModelViewSet):
    """安全告警管理"""
    queryset = SecurityAlert.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['title', 'description']
    ordering_fields = ['triggered_at', 'severity']
    ordering = ['-triggered_at']

    def get_serializer_class(self):
        if self.action in ('update', 'partial_update'):
            return SecurityAlertUpdateSerializer
        return SecurityAlertSerializer

    def get_queryset(self):
        queryset = SecurityAlert.objects.all()
        severity = self.request.query_params.get('severity')
        status_f = self.request.query_params.get('status')
        category = self.request.query_params.get('category')
        if severity:
            queryset = queryset.filter(severity=severity)
        if status_f:
            queryset = queryset.filter(status=status_f)
        if category:
            queryset = queryset.filter(category=category)
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

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        total = SecurityAlert.objects.count()
        by_severity = dict(
            SecurityAlert.objects.values_list('severity')
            .annotate(count=Count('id')).values_list('severity', 'count')
        )
        by_status = dict(
            SecurityAlert.objects.values_list('status')
            .annotate(count=Count('id')).values_list('status', 'count')
        )
        by_category = dict(
            SecurityAlert.objects.values_list('category')
            .annotate(count=Count('id'))[:10].values_list('category', 'count')
        )
        return Response({
            'success': True,
            'data': {
                'total': total,
                'active': SecurityAlert.objects.filter(status='active').count(),
                'by_severity': by_severity,
                'by_status': by_status,
                'by_category': by_category,
            }
        })

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        alert.status = 'acknowledged'
        assignee_id = request.user.id if hasattr(request.user, 'id') else None
        assignee_name = str(request.user) if request.user and hasattr(request.user, '__str__') else ''
        if request.data.get('assignee_name'):
            assignee_name = request.data['assignee_name']
        alert.assignee_id = assignee_id
        alert.assignee_name = assignee_name
        alert.save(update_fields=['status', 'assignee_id', 'assignee_name', 'updated_at'])
        return Response({'success': True, 'message': '已确认'})

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        alert.status = 'resolved'
        alert.resolved_by = request.user.id if hasattr(request.user, 'id') else None
        alert.resolved_at = timezone.now()
        alert.resolution_note = request.data.get('note', '')
        alert.save(update_fields=['status', 'resolved_by', 'resolved_at', 'resolution_note', 'updated_at'])
        return Response({'success': True, 'message': '已解决'})

    @action(detail=False, methods=['post'])
    def batch_resolve(self, request):
        ids = request.data.get('ids', [])
        note = request.data.get('note', '')
        updated = SecurityAlert.objects.filter(id__in=ids).update(
            status='resolved',
            resolved_at=timezone.now(),
            resolution_note=note,
        )
        return Response({'success': True, 'message': f'已解决 {updated} 条告警'})


class SecurityReportViewSet(viewsets.GenericViewSet,
                            mixins.ListModelMixin,
                            mixins.RetrieveModelMixin,
                            mixins.DestroyModelMixin):
    """安全报表"""
    queryset = SecurityReport.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = SecurityReportSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        report_type = request.query_params.get('report_type')
        if report_type:
            queryset = queryset.filter(report_type=report_type)
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

    @action(detail=False, methods=['post'])
    def generate(self, request):
        report_type = request.data.get('report_type', 'daily')
        period_days = int(request.data.get('period_days', 7))
        title = request.data.get('title', '')

        now = timezone.now().date()
        period_end = now
        period_start = now - timedelta(days=period_days - 1)

        if not title:
            type_labels = {'daily': '日报', 'weekly': '周报', 'monthly': '月报'}
            title = f"安全{type_labels.get(report_type, '')} ({period_start} ~ {period_end})"

        summary_data = {}
        try:
            from auth_app.security_test_models import SecurityVulnerability
            summary_data['vulnerabilities'] = {
                'total': SecurityVulnerability.objects.count(),
                'open': SecurityVulnerability.objects.filter(status='open').count(),
                'fixed_this_period': SecurityVulnerability.objects.filter(
                    status='fixed', fixed_at__gte=period_start
                ).count(),
            }
        except Exception:
            pass

        try:
            from auth_app.risk_control_models import ContentAuditLog
            summary_data['content_audits'] = {
                'total': ContentAuditLog.objects.filter(
                    created_at__date__gte=period_start,
                    created_at__date__lte=period_end
                ).count(),
                'blocked': ContentAuditLog.objects.filter(
                    result='blocked',
                    created_at__date__gte=period_start,
                    created_at__date__lte=period_end
                ).count(),
                'passed': ContentAuditLog.objects.filter(
                    result='passed',
                    created_at__date__gte=period_start,
                    created_at__date__lte=period_end
                ).count(),
            }
        except Exception:
            pass

        try:
            from auth_app.rbac_models import OperationLog
            summary_data['operations'] = {
                'total': OperationLog.objects.filter(
                    created_at__date__gte=period_start,
                    created_at__date__lte=period_end
                ).count(),
            }
        except Exception:
            pass

        try:
            summary_data['alerts'] = {
                'total': SecurityAlert.objects.filter(
                    triggered_at__date__gte=period_start,
                    triggered_at__date__lte=period_end
                ).count(),
                'resolved': SecurityAlert.objects.filter(
                    triggered_at__date__gte=period_start,
                    triggered_at__date__lte=period_end,
                    status='resolved'
                ).count(),
            }
        except Exception:
            pass

        report = SecurityReport.objects.create(
            report_type=report_type,
            title=title,
            status='completed',
            period_start=period_start,
            period_end=period_end,
            summary=summary_data,
            detail_data={},
            created_by=request.user.id if hasattr(request.user, 'id') else None,
        )

        serializer = SecurityReportSerializer(report)
        return Response({
            'success': True,
            'message': '报表生成成功',
            'data': serializer.data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def export(self, request):
        report_id = request.query_params.get('report_id')
        if report_id:
            try:
                report = SecurityReport.objects.get(id=report_id)
            except SecurityReport.DoesNotExist:
                return Response({'success': False, 'message': '报表不存在'}, status=status.HTTP_404_NOT_FOUND)
        else:
            report_type = request.query_params.get('report_type', 'daily')
            period_days = int(request.query_params.get('period_days', 7))
            now = timezone.now().date()
            period_start = now - timedelta(days=period_days - 1)

            summary_data = {}
            try:
                from auth_app.security_test_models import SecurityVulnerability
                summary_data['vulnerabilities'] = {
                    'total': SecurityVulnerability.objects.count(),
                    'open': SecurityVulnerability.objects.filter(status='open').count(),
                }
            except Exception:
                pass
            try:
                from auth_app.risk_control_models import ContentAuditLog
                summary_data['audits'] = {
                    'total': ContentAuditLog.objects.filter(created_at__date__gte=period_start).count(),
                    'blocked': ContentAuditLog.objects.filter(result='blocked', created_at__date__gte=period_start).count(),
                }
            except Exception:
                pass

            export_data = {
                'export_type': report_type,
                'period_start': str(period_start),
                'period_end': str(now),
                'generated_at': timezone.now().isoformat(),
                'summary': summary_data,
            }
            return Response({'success': True, 'data': export_data})

        export_data = {
            'report_id': report.id,
            'title': report.title,
            'report_type': report.report_type,
            'period_start': str(report.period_start),
            'period_end': str(report.period_end),
            'summary': report.summary,
            'detail_data': report.detail_data,
            'created_at': report.created_at.isoformat(),
        }
        return Response({'success': True, 'data': export_data})

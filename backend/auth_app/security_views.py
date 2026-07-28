import time
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from .security_models import AgentSecurityRule, AgentRiskLog
from .security_serializers import (
    AgentSecurityRuleSerializer,
    AgentSecurityRuleUpdateSerializer,
    AgentRiskLogSerializer,
    SecurityCheckRequestSerializer,
    SecurityCheckResponseSerializer,
)
from .security_service import SecurityChecker


class AgentSecurityRuleViewSet(viewsets.ModelViewSet):
    """安全规则管理 API"""
    queryset = AgentSecurityRule.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return AgentSecurityRuleUpdateSerializer
        return AgentSecurityRuleSerializer

    def list(self, request, *args, **kwargs):
        """获取规则列表（支持按类型筛选）"""
        queryset = self.get_queryset()

        rule_type = request.query_params.get('rule_type')
        is_enabled = request.query_params.get('is_enabled')

        if rule_type:
            queryset = queryset.filter(rule_type=rule_type)
        if is_enabled is not None:
            queryset = queryset.filter(is_enabled=is_enabled.lower() == 'true')

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data,
        })

    def create(self, request, *args, **kwargs):
        """创建新规则"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # 自动设置创建人
        user_id = getattr(request.user, 'id', None) or 0
        serializer.validated_data['created_by'] = user_id

        self.perform_create(serializer)
        return Response({
            'success': True,
            'message': '安全规则创建成功',
            'data': serializer.data,
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """更新规则"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response({
            'success': True,
            'message': '安全规则更新成功',
            'data': serializer.data,
        })

    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        """切换规则启用/禁用状态"""
        rule = self.get_object()
        rule.is_enabled = not rule.is_enabled
        rule.save(update_fields=['is_enabled'])

        return Response({
            'success': True,
            'message': f'规则已{"启用" if rule.is_enabled else "禁用"}',
            'data': {
                'id': rule.id,
                'is_enabled': rule.is_enabled,
            }
        })

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """获取规则统计信息"""
        stats = {
            'total_rules': AgentSecurityRule.objects.count(),
            'enabled_rules': AgentSecurityRule.objects.filter(is_enabled=True).count(),
            'by_type': {},
            'by_severity': {},
        }

        # 按类型统计
        for rule_type, _ in AgentSecurityRule.RULE_TYPE_CHOICES:
            count = AgentSecurityRule.objects.filter(rule_type=rule_type).count()
            stats['by_type'][rule_type] = count

        # 按严重程度统计
        for severity, _ in AgentSecurityRule.SEVERITY_CHOICES:
            count = AgentSecurityRule.objects.filter(severity=severity).count()
            stats['by_severity'][severity] = count

        return Response({'success': True, 'data': stats})


class AgentRiskLogViewSet(mixins.ListModelMixin,
                           mixins.RetrieveModelMixin,
                           viewsets.GenericViewSet):
    """风控日志查询 API（只读）"""
    queryset = AgentRiskLog.objects.all()
    serializer_class = AgentRiskLogSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """获取风控日志列表（支持多条件筛选）"""
        queryset = self.get_queryset()

        # 筛选条件
        risk_level = request.query_params.get('risk_level')
        log_status = request.query_params.get('status')
        user_id = request.query_params.get('user_id')
        session_id = request.query_params.get('session_id')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        if risk_level:
            queryset = queryset.filter(risk_level=risk_level)
        if log_status:
            queryset = queryset.filter(status=log_status)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if session_id:
            queryset = queryset.filter(session_id=session_id)
        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)

        # 排序
        ordering = request.query_params.get('ordering', '-created_at')
        queryset = queryset.order_by(ordering)

        # 分页
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data,
        })

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """获取风险统计摘要"""
        from django.db.models import Count
        from datetime import datetime, timedelta

        now = datetime.now()

        stats = {
            'total_logs': AgentRiskLog.objects.count(),
            'today_logs': AgentRiskLog.objects.filter(
                created_at__date=now.date()
            ).count(),
            'week_logs': AgentRiskLog.objects.filter(
                created_at__gte=now - timedelta(days=7)
            ).count(),
            'by_risk_level': {},
            'by_status': {},
            'top_rules': [],
        }

        # 按风险等级统计
        for level, _ in AgentRiskLog.RISK_LEVEL_CHOICES:
            stats['by_risk_level'][level] = AgentRiskLog.objects.filter(
                risk_level=level
            ).count()

        # 按状态统计
        for st, _ in AgentRiskLog.STATUS_CHOICES:
            stats['by_status'][st] = AgentRiskLog.objects.filter(
                status=st
            ).count()

        # Top 10 触发最多的规则
        top_rules = AgentRiskLog.objects.values('rule__name').annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        stats['top_rules'] = list(top_rules)

        return Response({'success': True, 'data': stats})


class SecurityCheckViewSet(viewsets.GenericViewSet):
    """安全检测 API（公开接口，用于前端实时检测）"""
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'])
    def check_content(self, request):
        """
        检测内容安全性（提示词注入 + 敏感内容过滤）

        Request Body:
        {
            "content": "待检测的文本",
            "session_id": "会话ID（可选）",
            "agent_role": "agent角色（可选）",
            "user_id": 1
        }
        """
        serializer = SecurityCheckRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        content = serializer.validated_data['content']
        session_id = serializer.validated_data.get('session_id', '')
        agent_role = serializer.validated_data.get('agent_role', '')
        user_id = serializer.validated_data.get('user_id', 0)

        # 获取客户端IP
        ip_address = self._get_client_ip(request)

        # 执行安全检测
        result = SecurityChecker.check_content(
            content=content,
            user_id=user_id,
            session_id=session_id,
            agent_role=agent_role,
            ip_address=ip_address,
        )

        response_serializer = SecurityCheckResponseSerializer(result)
        return Response({
            'success': True,
            'data': response_serializer.data,
        })

    @action(detail=False, methods=['post'])
    def check_tool_permission(self, request):
        """
        检查工具调用权限

        Request Body:
        {
            "tool_name": "exec_command",
            "operation": "write",
            "user_id": 1,
            "agent_role": "analyst"
        }
        """
        tool_name = request.data.get('tool_name', '')
        operation = request.data.get('operation', '')
        user_id = request.data.get('user_id', 0)
        agent_role = request.data.get('agent_role', '')

        if not tool_name:
            return Response({
                'success': False,
                'message': '工具名称不能为空'
            }, status=status.HTTP_400_BAD_REQUEST)

        result = SecurityChecker.check_tool_permission(
            tool_name=tool_name,
            operation=operation,
            user_id=user_id,
            agent_role=agent_role,
            ip_address=self._get_client_ip(request),
        )

        if result['allowed']:
            return Response({
                'success': True,
                'data': {
                    'allowed': True,
                    'message': '工具调用权限验证通过'
                }
            })
        else:
            return Response({
                'success': False,
                'data': {
                    'allowed': False,
                    'reason': result['reason'],
                    'message': '工具调用被拦截'
                }
            }, status=status.HTTP_403_FORBIDDEN)

    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '')

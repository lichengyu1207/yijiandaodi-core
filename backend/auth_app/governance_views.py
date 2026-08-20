"""
合规治理层 API 视图

提供Agent合规性评分、治理健康度监控、策略版本管理的REST API接口
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission, SAFE_METHODS
from django.utils import timezone
from django.db.models import Count, Avg
from datetime import timedelta

from .governance_models import AgentComplianceScore, GovernanceHealth, StrategyVersion
from .governance_serializers import (
    AgentComplianceScoreSerializer,
    AgentComplianceScoreDetailSerializer,
    AgentComplianceScoreUpdateSerializer,
    GovernanceHealthSerializer,
    StrategyVersionSerializer,
    StrategyVersionDeploySerializer,
    GovernanceDashboardSerializer
)


class IsStaffOrReadOnly(BasePermission):
    """写操作（非安全方法）仅允许管理员/员工"""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_staff or request.user.is_superuser)
        )


class AgentComplianceScoreViewSet(viewsets.ModelViewSet):
    """
    Agent合规性评分API视图集
    
    提供合规性评分的CRUD操作和统计分析功能
    """
    
    queryset = AgentComplianceScore.objects.select_related('agent').all()
    permission_classes = [IsAuthenticated, IsStaffOrReadOnly]
    
    def get_serializer_class(self):
        """根据动作选择序列化器"""
        if self.action == 'retrieve':
            return AgentComplianceScoreDetailSerializer
        return AgentComplianceScoreSerializer
    
    def get_queryset(self):
        """支持按风险等级、评分范围等筛选"""
        queryset = super().get_queryset()
        
        # 按风险等级筛选
        risk_level = self.request.query_params.get('risk_level')
        if risk_level:
            queryset = queryset.filter(risk_level=risk_level)
        
        # 按评分范围筛选
        min_score = self.request.query_params.get('min_score')
        if min_score:
            queryset = queryset.filter(overall_score__gte=float(min_score))
        
        max_score = self.request.query_params.get('max_score')
        if max_score:
            queryset = queryset.filter(overall_score__lte=float(max_score))
        
        # 按Agent ID搜索
        agent_id = self.request.query_params.get('agent_id')
        if agent_id:
            queryset = queryset.filter(agent__agent_id__icontains=agent_id)
        
        # 按活跃状态筛选
        is_active = self.request.query_params.get('is_active')
        if is_active:
            last_24h = timezone.now() - timedelta(hours=24)
            if is_active.lower() == 'true':
                queryset = queryset.filter(last_operation_at__gte=last_24h)
            else:
                queryset = queryset.filter(last_operation_at__lt=last_24h)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """获取合规性评分统计"""
        queryset = self.get_queryset()
        
        # 总体统计
        total_count = queryset.count()
        avg_score = queryset.aggregate(avg=Avg('overall_score'))['avg'] or 0
        
        # 风险等级分布
        risk_distribution = dict(
            queryset.values('risk_level').annotate(count=Count('id')).values_list('risk_level', 'count')
        )
        
        # 评分分布（按区间）
        score_distribution = {
            'excellent': queryset.filter(overall_score__gte=90).count(),
            'good': queryset.filter(overall_score__range=[75, 89.9]).count(),
            'fair': queryset.filter(overall_score__range=[60, 74.9]).count(),
            'poor': queryset.filter(overall_score__range=[40, 59.9]).count(),
            'critical': queryset.filter(overall_score__lt=40).count()
        }
        
        # 维度平均分
        dimension_scores = queryset.aggregate(
            avg_authentication=Avg('authentication_score'),
            avg_permission=Avg('permission_score'),
            avg_behavior=Avg('behavior_score'),
            avg_audit=Avg('audit_score')
        )
        
        return Response({
            'total_count': total_count,
            'average_score': round(avg_score, 2),
            'risk_distribution': risk_distribution,
            'score_distribution': score_distribution,
            'dimension_scores': {
                'authentication': round(dimension_scores['avg_authentication'] or 0, 2),
                'permission': round(dimension_scores['avg_permission'] or 0, 2),
                'behavior': round(dimension_scores['avg_behavior'] or 0, 2),
                'audit': round(dimension_scores['avg_audit'] or 0, 2)
            }
        })
    
    @action(detail=True, methods=['post'])
    def update_scores(self, request, pk=None):
        """更新Agent评分"""
        score = self.get_object()
        serializer = AgentComplianceScoreUpdateSerializer(data=request.data)
        
        if serializer.is_valid():
            # 更新评分
            if 'authentication_score' in serializer.validated_data:
                score.authentication_score = serializer.validated_data['authentication_score']
            if 'permission_score' in serializer.validated_data:
                score.permission_score = serializer.validated_data['permission_score']
            if 'behavior_score' in serializer.validated_data:
                score.behavior_score = serializer.validated_data['behavior_score']
            if 'audit_score' in serializer.validated_data:
                score.audit_score = serializer.validated_data['audit_score']
            
            # 重新计算综合评分和风险等级
            score.update_scores()
            
            return Response({
                'success': True,
                'message': '评分更新成功',
                'data': AgentComplianceScoreSerializer(score).data
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def record_violation(self, request, pk=None):
        """记录违规行为"""
        score = self.get_object()
        violation_type = request.data.get('violation_type', 'general')
        severity = request.data.get('severity', 'medium')
        
        # 根据严重程度扣分
        deduction_map = {
            'low': 5,
            'medium': 10,
            'high': 20,
            'critical': 30
        }
        
        deduction = deduction_map.get(severity, 10)
        score.record_violation(deduction)
        
        return Response({
            'success': True,
            'message': f'已记录违规行为，扣分：{deduction}',
            'data': AgentComplianceScoreSerializer(score).data
        })


class GovernanceHealthViewSet(viewsets.ReadOnlyModelViewSet):
    """
    治理健康度监控API视图集
    
    提供健康度快照查询和仪表板数据
    """
    
    queryset = GovernanceHealth.objects.all().order_by('-snapshot_time')
    serializer_class = GovernanceHealthSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """支持按时间范围筛选"""
        queryset = super().get_queryset()
        
        # 按时间范围筛选
        start_time = self.request.query_params.get('start_time')
        end_time = self.request.query_params.get('end_time')
        
        if start_time:
            queryset = queryset.filter(snapshot_time__gte=start_time)
        if end_time:
            queryset = queryset.filter(snapshot_time__lte=end_time)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """获取最新的健康度快照"""
        try:
            latest_health = GovernanceHealth.objects.latest('snapshot_time')
            serializer = self.get_serializer(latest_health)
            return Response(serializer.data)
        except GovernanceHealth.DoesNotExist:
            return Response({
                'error': '暂无健康度快照数据'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['post'])
    def take_snapshot(self, request):
        """拍摄健康度快照"""
        try:
            snapshot = GovernanceHealth.take_snapshot()
            serializer = self.get_serializer(snapshot)
            return Response({
                'success': True,
                'message': '快照拍摄成功',
                'data': serializer.data
            })
        except Exception as e:
            return Response({
                'error': f'快照拍摄失败：{str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """获取治理仪表板数据"""
        try:
            # 获取最新健康度
            latest_health = GovernanceHealth.objects.latest('snapshot_time')
        except GovernanceHealth.DoesNotExist:
            latest_health = None
        
        # 获取Agent统计
        agent_scores = AgentComplianceScore.objects.select_related('agent').all()
        
        # 总体统计
        total_agents = agent_scores.count()
        active_agents = agent_scores.filter(
            last_operation_at__gte=timezone.now() - timedelta(hours=24)
        ).count()
        
        compliant_agents = agent_scores.filter(overall_score__gte=75).count()
        high_risk_agents = agent_scores.filter(
            overall_score__lt=50
        ).count()
        
        # 评分分布
        score_distribution = {
            'excellent': agent_scores.filter(overall_score__gte=90).count(),
            'good': agent_scores.filter(overall_score__range=[75, 89.9]).count(),
            'fair': agent_scores.filter(overall_score__range=[60, 74.9]).count(),
            'poor': agent_scores.filter(overall_score__range=[40, 59.9]).count(),
            'critical': agent_scores.filter(overall_score__lt=40).count()
        }
        
        # 风险分布
        risk_distribution = dict(
            agent_scores.values('risk_level').annotate(
                count=Count('id')
            ).values_list('risk_level', 'count')
        )
        
        # 合规趋势（最近7天）
        trend_data = []
        for i in range(7):
            date = timezone.now() - timedelta(days=6-i)
            snapshot = GovernanceHealth.objects.filter(
                snapshot_time__date=date.date()
            ).first()
            
            if snapshot:
                trend_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'health_score': snapshot.health_score,
                    'compliance_rate': snapshot.compliance_rate
                })
        
        # 构建响应数据
        dashboard_data = {
            'health_score': latest_health.health_score if latest_health else 0,
            'health_status': {
                'status': 'good' if (latest_health and latest_health.health_score >= 75) else 'fair',
                'message': '系统健康度良好' if (latest_health and latest_health.health_score >= 75) else '系统健康度一般',
                'color': 'blue' if (latest_health and latest_health.health_score >= 75) else 'orange'
            },
            'total_agents': total_agents,
            'active_agents': active_agents,
            'compliant_agents': compliant_agents,
            'high_risk_agents': high_risk_agents,
            'score_distribution': score_distribution,
            'risk_distribution': risk_distribution,
            'compliance_trend': trend_data,
            'timestamp': timezone.now()
        }
        
        serializer = GovernanceDashboardSerializer(dashboard_data)
        return Response(serializer.data)


class StrategyVersionViewSet(viewsets.ModelViewSet):
    """
    策略版本管理API视图集
    
    提供策略版本的CRUD操作、部署和回滚功能
    """
    
    queryset = StrategyVersion.objects.select_related('strategy', 'deployed_by').all()
    serializer_class = StrategyVersionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """支持按状态、策略筛选"""
        queryset = super().get_queryset()
        
        # 按状态筛选
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # 按策略筛选
        strategy_id = self.request.query_params.get('strategy_id')
        if strategy_id:
            queryset = queryset.filter(strategy_id=strategy_id)
        
        # 只显示激活的
        is_active = self.request.query_params.get('is_active')
        if is_active:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def deploy(self, request, pk=None):
        """部署策略版本"""
        version = self.get_object()
        serializer = StrategyVersionDeploySerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                version.deploy(
                    user=request.user,
                    rollout_percentage=serializer.validated_data.get('rollout_percentage', 100),
                    rollout_agents=serializer.validated_data.get('rollout_agents', [])
                )
                
                return Response({
                    'success': True,
                    'message': f'策略版本 {version.version} 已成功部署',
                    'data': StrategyVersionSerializer(version).data
                })
            except Exception as e:
                return Response({
                    'error': f'部署失败：{str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def rollback(self, request, pk=None):
        """回滚策略版本"""
        version = self.get_object()
        
        try:
            previous_version = version.rollback(user=request.user)
            
            return Response({
                'success': True,
                'message': f'已回滚到版本 {previous_version.version}',
                'data': StrategyVersionSerializer(previous_version).data
            })
        except Exception as e:
            return Response({
                'error': f'回滚失败：{str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """获取所有激活的策略版本"""
        active_versions = self.get_queryset().filter(
            is_active=True,
            status='production'
        )
        
        serializer = self.get_serializer(active_versions, many=True)
        return Response(serializer.data)
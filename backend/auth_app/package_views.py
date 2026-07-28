from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone

from .mall_models import ScenarioPackage, EnterpriseAuditService, EnterpriseAuditContract, Product, Order
from .package_serializers import (
    ScenarioPackageSerializer, ScenarioPackageCreateSerializer,
    EnterpriseAuditServiceSerializer, EnterpriseAuditContractSerializer,
    EnterpriseAuditInquirySerializer,
)
import uuid


class ScenarioPackageViewSet(viewsets.ModelViewSet):
    queryset = ScenarioPackage.objects.filter(is_active=True).select_related('s_scenario', 'a_scenario').prefetch_related('b_scenarios')
    serializer_class = ScenarioPackageSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'], url_path='featured')
    def featured(self, request):
        featured = self.get_queryset().filter(is_featured=True)[:4]
        return Response({'success': True, 'data': ScenarioPackageSerializer(featured, many=True).data})

    @action(detail=False, methods=['get'], url_path='tier-overview')
    def tier_overview(self, request):
        from collections import defaultdict
        by_type = defaultdict(list)
        for pkg in self.get_queryset():
            by_type[pkg.package_type].append(ScenarioPackageSerializer(pkg).data)

        result = []
        for ptype in ['combo_sab', 'combo_sa', 'combo_sb', 'combo_ab']:
            items = by_type.get(ptype, [])
            if items:
                result.append({
                    'package_type': ptype,
                    'label': dict(ScenarioPackage.PACKAGE_TYPE_CHOICES).get(pte, '') or '',
                    'packages': items,
                    'count': len(items),
                })
        return Response({'success': True, 'data': result})

    @action(detail=True, methods=['post'], url_path='purchase')
    def purchase(self, request, pk=None):
        package = self.get_object()
        serializer = ScenarioPackageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        selected_b_id = serializer.validated_data.get('selected_b_id')

        order_no = f'PKG{timezone.now().strftime("%Y%m%d%H%M%S")}{uuid.uuid4().hex[:6].upper()}'
        total_amount = package.package_price

        items = [
            {'type': 's_scenario', 'id': package.s_scenario_id, 'title': package.s_scenario.title if package.s_scenario else '', 'price': str(package.s_scenario.price) if package.s_scenario else '0'},
            {'type': 'a_scenario', 'id': package.a_scenario_id, 'title': package.a_scenario.title if package.a_scenario else '', 'price': str(package.a_scenario.price) if package.a_scenario else '0'},
        ]
        if selected_b_id:
            items.append({'type': 'b_scenario', 'id': selected_b_id.id, 'title': selected_b_id.title, 'price': str(selected_b_id.price)})
            total_amount += selected_b_id.price

        order = Order.objects.create(
            order_no=order_no,
            user_id=request.user,
            total_amount=total_amount,
            pay_amount=total_amount,
            status='pending',
            items=items,
            remark=f'场景联动套餐: {package.name}',
        )

        package.sales_count += 1
        package.save(update_fields=['sales_count'])

        return Response({
            'success': True,
            'message': '套餐订单已创建',
            'data': {
                'order_no': order_no,
                'order_id': order.id,
                'amount': str(total_amount),
                'package_name': package.name,
                'discount_percent': package.discount_percent,
                'saved_amount': str(package.saved_amount),
            }
        })


class EnterpriseAuditServiceViewSet(viewsets.ModelViewSet):
    queryset = EnterpriseAuditService.objects.filter(is_active=True)
    serializer_class = EnterpriseAuditServiceSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'], url_path='pricing-matrix')
    def pricing_matrix(self, request):
        services = self.get_queryset()
        matrix = {}
        for svc in services:
            tier = svc.audit_tier
            scope = svc.scope
            key = f'{tier}_{scope}'
            matrix[key] = {
                'id': svc.id,
                'name': svc.name,
                'base_price': str(svc.base_price),
                'min_price': str(svc.min_price),
                'profit_margin': svc.profit_margin,
                'audit_days': svc.audit_days,
                'deliverables': svc.deliverables,
                'includes_remediation': svc.includes_remediation,
                'includes_certification': svc.includes_certification,
                'includes_training': svc.includes_training,
            }

        tiers_info = {}
        for tcode, tname in EnterpriseAuditService.AUDIT_TIER_CHOICES:
            tiers_info[tcode] = {'name': tname, 'services': []}
        for s in services:
            if s.audit_tier in tiers_info:
                tiers_info[s.audit_tier]['services'].append({
                    'id': s.id, 'name': s.name, 'scope': s.get_scope_display(),
                    'price': str(s.base_price), 'margin': f'{s.profit_margin}%'
                })

        return Response({
            'success': True,
            'data': {'matrix': matrix, 'tiers': tiers_info}
        })

    @action(detail=False, methods=['post'], url_path='submit-inquiry')
    def submit_inquiry(self, request):
        serializer = EnterpriseAuditInquirySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        service = serializer.validated_data['service_id']
        contract_no = f'AUD{timezone.now().strftime("%Y%m%d")}{uuid.uuid4().hex[:8].upper()}'

        contract = EnterpriseAuditContract.objects.create(
            service=service,
            company_name=serializer.validated_data['company_name'],
            contact_person=serializer.validated_data['contact_person'],
            contact_phone=serializer.validated_data['contact_phone'],
            contact_email=serializer.validated_data['contact_email'],
            contract_no=contract_no,
            final_price=service.base_price,
            actual_profit_margin=service.profit_margin,
            status='inquiry',
            start_date=timezone.now().date(),
            user=request.user if request.user.is_authenticated else None,
            special_requirements=serializer.validated_data.get('requirements', ''),
        )

        return Response({
            'success': True,
            'message': '审计服务咨询已提交，我们将在24小时内联系您',
            'data': EnterpriseAuditContractSerializer(contract).data
        })

    @action(detail=True, methods=['post'], url_path='update-contract-status')
    def update_contract_status(self, request, pk=None):
        if not request.user.is_staff:
            return Response({'success': False, 'message': '需要管理员权限'}, status=status.HTTP_403_FORBIDDEN)
        contract = self.get_object()
        new_status = request.data.get('status')
        valid_statuses = [c[0] for c in EnterpriseAuditContract.STATUS_CHOICES]
        if new_status not in valid_statuses:
            return Response({'success': False, 'message': f'无效状态: {new_status}'}, status=status.HTTP_400_BAD_REQUEST)
        contract.status = new_status
        final_price = request.data.get('final_price')
        if final_price:
            contract.final_price = float(final_price)
        admin_note = request.data.get('admin_note', '')
        if admin_note:
            contract.admin_note = admin_note
        if new_status == 'signed':
            from datetime import date
            contract.signed_at = date.today()
        if new_status == 'completed':
            from datetime import date
            contract.completed_at = date.today()
        contract.save()
        return Response({'success': True, 'message': f'合同状态已更新为: {contract.get_status_display()}'})

    @action(detail=False, methods=['get'], url_path='contracts')
    def contracts(self, request):
        if not request.user.is_staff:
            return Response({'success': False, 'message': '需要管理员权限'}, status=status.HTTP_403_FORBIDDEN)
        qs = EnterpriseAuditContract.objects.all().select_related('service')[:50]
        return Response({'success': True, 'data': EnterpriseAuditContractSerializer(qs, many=True).data})

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        from django.db.models import Sum, Count
        total_contracts = EnterpriseAuditContract.objects.count()
        total_value = EnterpriseAuditContract.objects.aggregate(
            v=Sum('final_price'))['v'] or 0
        by_status = list(
            EnterpriseAuditContract.objects.values('status')
            .annotate(c=Count('id')).order_by('-c')
        )
        by_tier = list(
            EnterpriseAuditContract.objects.values('service__audit_tier')
            .annotate(c=Count('id'), value=Sum('final_price')).order_by('-value')
        )

        return Response({
            'success': True,
            'data': {
                'total_contracts': total_contracts,
                'total_pipeline_value': str(total_value),
                'avg_contract_value': str(round(total_value / max(total_contracts, 1), 2)),
                'by_status': by_status,
                'by_tier': by_tier,
            }
        })

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission
from django.utils import timezone
from django.db.models import Sum, Count, Q, F, DecimalField, Avg
from django.db.models.functions import Coalesce
from decimal import Decimal
import uuid
import hashlib
import time

from .enterprise_models import (
    EnterpriseAccount, EnterpriseMember, EnterpriseAPIKey,
    EnterpriseBatchRecharge, EnterpriseUsageLog, SoftwareCopyrightApplication
)


class IsEnterpriseOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_staff:
            return True
        if isinstance(obj, EnterpriseAccount):
            return obj.admin_user == user
        if hasattr(obj, 'enterprise'):
            ent = obj.enterprise
            try:
                member = EnterpriseMember.objects.get(enterprise=ent, user=user)
                return member.role in ['owner', 'admin']
            except EnterpriseMember.DoesNotExist:
                return False
        return False


class IsEnterpriseMember(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        ent_id = request.query_params.get('enterprise_id') or request.data.get('enterprise')
        if ent_id:
            return EnterpriseMember.objects.filter(
                enterprise_id=ent_id, user=request.user, status='active'
            ).exists()
        return EnterpriseMember.objects.filter(user=request.user, status='active').exists()


class EnterpriseAdminViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def get_enterprise(self, request):
        user = request.user
        try:
            return EnterpriseAccount.objects.get(admin_user=user)
        except EnterpriseAccount.DoesNotExist:
            try:
                mem = EnterpriseMember.objects.filter(user=user).select_related('enterprise').first()
                return mem.enterprise if mem else None
            except Exception:
                return None

    @action(detail=False, methods=['get'])
    def my_enterprise(self, request):
        enterprise = self.get_enterprise(request)
        if not enterprise:
            return Response({'success': False, 'message': '未找到企业账号', 'data': None}, status=404)
        
        members = EnterpriseMember.objects.filter(enterprise=enterprise).select_related('user')\
            .only('user__username', 'role', 'status', 'department', 'position', 'created_at')
        api_keys = EnterpriseAPIKey.objects.filter(enterprise=enterprise)\
            .only('name', 'key_type', 'is_active', 'total_calls', 'last_used_at', 'created_at')
        
        data = {
            'id': enterprise.id,
            'name': enterprise.name,
            'company_name': enterprise.company_name,
            'plan_type': enterprise.plan_type,
            'plan_display': enterprise.get_plan_type_display(),
            'status': enterprise.status,
            'status_display': enterprise.get_status_display(),
            'contact_person': enterprise.contact_person,
            'contact_phone': enterprise.contact_phone,
            'contact_email': enterprise.contact_email,
            'balance': str(enterprise.balance),
            'total_recharged': str(enterprise.total_recharged),
            'total_spent': str(enterprise.total_spent),
            'api_calls_limit': enterprise.api_calls_limit,
            'api_calls_used': enterprise.api_calls_used,
            'api_calls_remaining': enterprise.api_calls_remaining,
            'members_limit': enterprise.members_limit,
            'concurrent_sessions': enterprise.concurrent_sessions,
            'paid_until': enterprise.paid_until.isoformat() if enterprise.paid_until else None,
            'trial_ends_at': enterprise.trial_ends_at.isoformat() if enterprise.trial_ends_at else None,
            'auto_renew': enterprise.auto_renew,
            'member_count': members.count(),
            'active_member_count': members.filter(status='active').count(),
            'api_key_count': api_keys.count(),
            'active_api_key_count': api_keys.filter(is_active=True).count(),
            'members': [{
                'id': m.id,
                'username': m.user.username,
                'role': m.role,
                'role_display': m.get_role_display(),
                'status': m.status,
                'department': m.department,
                'position': m.position,
                'joined_at': m.created_at.isoformat() if m.created_at else None,
            } for m in members[:20]],
            'api_keys': [{
                'id': k.id,
                'name': k.name,
                'key_type': k.key_type,
                'key_preview': f'{k.key_prefix}****{k.key_last_4}',
                'is_active': k.is_active,
                'total_calls': k.total_calls,
                'last_used_at': k.last_used_at.isoformat() if k.last_used_at else None,
                'created_at': k.created_at.isoformat() if k.created_at else None,
            } for k in api_keys[:10]],
            'created_at': enterprise.created_at.isoformat() if enterprise.created_at else None,
        }
        return Response({'success': True, 'message': 'ok', 'data': data})

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        enterprise = self.get_enterprise(request)
        if not enterprise:
            return Response({'success': False, 'message': '未找到企业账号', 'data': None}, status=404)

        today = timezone.now()
        month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        usage_qs = EnterpriseUsageLog.objects.filter(enterprise=enterprise)
        today_usage = usage_qs.filter(created_at__date=today.date())
        month_usage = usage_qs.filter(created_at__gte=month_start)

        today_stats = today_usage.values('resource_type').annotate(
            total_quantity=Sum('quantity'),
            total_cost=Sum('cost'),
            call_count=Count('id'),
        )

        month_stats = month_usage.values('resource_type').annotate(
            total_quantity=Sum('quantity'),
            total_cost=Sum('cost'),
            call_count=Count('id'),
        )

        daily_trend = usage_qs.filter(created_at__gte=today - timezone.timedelta(days=30))\
            .values('created_at__date').annotate(
                calls=Count('id'),
                cost=Sum('cost'),
            ).order_by('created_at__date')

        top_endpoints = usage_qs.values('endpoint', 'method').annotate(
            calls=Count('id'),
            avg_time=Avg('response_time_ms'),
        ).order_by('-calls')[:10]

        active_members = EnterpriseMember.objects.filter(
            enterprise=enterprise, status='active'
        ).select_related('user').only('user__username', 'role', 'last_login_at')

        recent_logs = usage_qs.select_related('api_key', 'member__user')\
            .order_by('-created_at')[:20]

        data = {
            'overview': {
                'balance': str(enterprise.balance),
                'api_calls_used': enterprise.api_calls_used,
                'api_calls_limit': enterprise.api_calls_limit,
                'api_usage_pct': round(enterprise.api_calls_used / max(enterprise.api_calls_limit, 1) * 100, 1),
                'member_count': active_members.count(),
                'members_limit': enterprise.members_limit,
                'active_keys': EnterpriseAPIKey.objects.filter(enterprise=enterprise, is_active=True).count(),
            },
            'today': {s['resource_type']: {'calls': s['call_count'], 'quantity': s['total_quantity'], 'cost': str(s['total_cost'] or 0)} for s in today_stats},
            'month': {s['resource_type']: {'calls': s['call_count'], 'quantity': s['total_quantity'], 'cost': str(s['total_cost'] or 0)} for s in month_stats},
            'daily_trend': [{'date': str(d['created_at__date']), 'calls': d['calls'], 'cost': str(d['cost'] or 0)} for d in daily_trend],
            'top_endpoints': [{'endpoint': e['endpoint'], 'method': e['method'], 'calls': e['calls'], 'avg_ms': round(e['avg_time'] or 0, 1)} for e in top_endpoints],
            'active_members': [{
                'username': m.user.username,
                'role': m.role,
                'role_display': m.get_role_display(),
                'last_login': m.last_login_at.isoformat() if m.last_login_at else None,
            } for m in active_members],
            'recent_logs': [{
                'id': l.id,
                'resource_type': l.resource_type,
                'endpoint': l.endpoint,
                'method': l.method,
                'status_code': l.status_code,
                'response_time_ms': l.response_time_ms,
                'cost': str(l.cost),
                'created_at': l.created_at.isoformat() if l.created_at else None,
                'api_key_name': l.api_key.name if l.api_key else None,
                'member_username': l.member.user.username if l.member and l.member.user else None,
            } for l in recent_logs],
        }
        return Response({'success': True, 'message': 'ok', 'data': data})

    @action(detail=False, methods=['post'])
    def create_enterprise(self, request):
        data = request.data
        name = data.get('name', '').strip()
        if not name:
            return Response({'success': False, 'message': '企业名称不能为空'}, status=400)

        existing = EnterpriseAccount.objects.filter(admin_user=request.user).first()
        if existing:
            return Response({'success': False, 'message': '您已有一个企业账号', 'data': {'id': existing.id}}, status=400)

        plan_type = data.get('plan_type', 'starter')
        trial_days = 14 if plan_type == 'starter' else 30

        enterprise = EnterpriseAccount.objects.create(
            name=name,
            company_name=data.get('company_name', ''),
            contact_person=data.get('contact_person', request.user.username),
            contact_phone=data.get('contact_phone', ''),
            contact_email=data.get('contact_email', ''),
            business_license=data.get('business_license', ''),
            tax_id=data.get('tax_id', ''),
            admin_user=request.user,
            plan_type=plan_type,
            status='trial',
            trial_ends_at=timezone.now() + timezone.timedelta(days=trial_days),
            paid_until=timezone.now() + timezone.timedelta(days=trial_days),
        )

        EnterpriseMember.objects.create(
            enterprise=enterprise,
            user=request.user,
            role='owner',
            status='active',
            department='管理',
            position='创始人',
        )

        return Response({
            'success': True,
            'message': f'企业账号创建成功，{trial_days}天试用已开启',
            'data': {'id': enterprise.id, 'name': enterprise.name, 'trial_ends_at': enterprise.trial_ends_at.isoformat()}
        })

    @action(detail=False, methods=['post'])
    def add_member(self, request):
        enterprise = self.get_enterprise(request)
        if not enterprise:
            return Response({'success': False, 'message': '未找到企业账号'}, status=404)

        current_member = EnterpriseMember.objects.filter(enterprise=enterprise, user=request.user).first()
        if current_member and current_member.role not in ['owner', 'admin']:
            return Response({'success': False, 'message': '只有管理员可以添加成员'}, status=403)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        username_or_email = request.data.get('username', '').strip()
        if not username_or_email:
            return Response({'success': False, 'message': '请输入用户名或邮箱'}, status=400)

        try:
            target_user = User.objects.filter(Q(username=username_or_email) | Q(email=username_or_email)).first()
            if not target_user:
                return Response({'success': False, 'message': '用户不存在，请先注册'}, status=404)
        except Exception:
            return Response({'success': False, 'message': '查询用户失败'}, status=500)

        existing = EnterpriseMember.objects.filter(enterprise=enterprise, user=target_user).first()
        if existing:
            if existing.status == 'removed':
                existing.status = 'pending'
                existing.role = request.data.get('role', 'developer')
                existing.department = request.data.get('department', '')
                existing.position = request.data.get('position', '')
                existing.invited_by = request.user
                existing.save()
                return Response({'success': True, 'message': '成员已重新邀请', 'data': {'member_id': existing.id}})
            return Response({'success': False, 'message': '该用户已是企业成员'}, status=400)

        current_count = EnterpriseMember.objects.filter(enterprise=enterprise).exclude(status='removed').count()
        if current_count >= enterprise.members_limit:
            return Response({'success': False, 'message': f'成员数已达上限({enterprise.members_limit}人)，请升级套餐'}, status=400)

        member = EnterpriseMember.objects.create(
            enterprise=enterprise,
            user=target_user,
            role=request.data.get('role', 'developer'),
            status='pending',
            department=request.data.get('department', ''),
            position=request.data.get('position', ''),
            invited_by=request.user,
        )

        return Response({
            'success': True,
            'message': f'已邀请 {target_user.username} 加入企业',
            'data': {'member_id': member.id, 'username': target_user.username, 'role': member.role}
        })

    @action(detail=False, methods=['post'])
    def remove_member(self, request):
        enterprise = self.get_enterprise(request)
        if not enterprise:
            return Response({'success': False, 'message': '未找到企业账号'}, status=404)

        member_id = request.data.get('member_id')
        if not member_id:
            return Response({'success': False, 'message': '缺少member_id'}, status=400)

        try:
            member = EnterpriseMember.objects.get(id=member_id, enterprise=enterprise)
        except EnterpriseMember.DoesNotExist:
            return Response({'success': False, 'message': '成员不存在'}, status=404)

        if member.user == request.user:
            return Response({'success': False, 'message': '不能移除自己'}, status=400)

        if member.role == 'owner':
            return Response({'success': False, 'message': '不能移除企业创始人'}, status=400)

        member.status = 'removed'
        member.save()

        return Response({'success': True, 'message': f'已移除成员 {member.user.username}'})

    @action(detail=False, methods=['post'])
    def update_member_role(self, request):
        enterprise = self.get_enterprise(request)
        if not enterprise:
            return Response({'success': False, 'message': '未找到企业账号'}, status=404)

        member_id = request.data.get('member_id')
        new_role = request.data.get('role', '')
        if not member_id or new_role not in ['owner', 'admin', 'developer', 'analyst', 'viewer']:
            return Response({'success': False, 'message': '参数错误'}, status=400)

        try:
            member = EnterpriseMember.objects.get(id=member_id, enterprise=enterprise)
        except EnterpriseMember.DoesNotExist:
            return Response({'success': False, 'message': '成员不存在'}, status=404)

        member.role = new_role
        member.save()
        return Response({'success': True, 'message': f'{member.user.username} 角色已更新为 {member.get_role_display()}'})

    @action(detail=False, methods=['get'])
    def list_members(self, request):
        enterprise = self.get_enterprise(request)
        if not enterprise:
            return Response({'success': False, 'message': '未找到企业账号'}, status=404)

        members = EnterpriseMember.objects.filter(enterprise=enterprise).exclude(status='removed')\
            .select_related('user').order_by('role', '-created_at')

        role_filter = request.query_params.get('role')
        if role_filter:
            members = members.filter(role=role_filter)

        data = [{
            'id': m.id,
            'user_id': m.user.id,
            'username': m.user.username,
            'email': getattr(m.user, 'email', ''),
            'role': m.role,
            'role_display': m.get_role_display(),
            'status': m.status,
            'status_display': m.get_status_display(),
            'department': m.department,
            'position': m.position,
            'api_daily_limit': m.api_daily_limit,
            'api_monthly_limit': m.api_monthly_limit,
            'last_login_at': m.last_login_at.isoformat() if m.last_login_at else None,
            'invited_by_username': m.invited_by.username if m.invited_by else None,
            'joined_at': m.created_at.isoformat() if m.created_at else None,
            'is_self': m.user == request.user,
        } for m in members]

        return Response({'success': True, 'message': 'ok', 'data': data, 'total': len(data)})

    @action(detail=False, methods=['post'])
    def create_api_key(self, request):
        enterprise = self.get_enterprise(request)
        if not enterprise:
            return Response({'success': False, 'message': '未找到企业账号'}, status=404)

        name = request.data.get('name', '').strip()
        key_type = request.data.get('key_type', 'production')
        if not name:
            return Response({'success': False, 'message': '密钥名称不能为空'}, status=400)

        key_count = EnterpriseAPIKey.objects.filter(enterprise=enterprise).count()
        if key_count >= 20:
            return Response({'success': False, 'message': '每个企业最多创建20个API密钥'}, status=400)

        obj, raw_key = EnterpriseAPIKey.generate_key(
            enterprise=enterprise,
            name=name,
            key_type=key_type,
            created_by=request.user,
            rate_limit_per_minute=int(request.data.get('rate_limit', 120)),
            daily_quota=int(request.data.get('daily_quota', 5000)),
            monthly_quota=int(request.data.get('monthly_quota', 50000)),
            allowed_endpoints=request.data.get('allowed_endpoints', []),
            ip_restrictions=request.data.get('ip_restrictions', ''),
        )

        return Response({
            'success': True,
            'message': 'API密钥创建成功（请立即保存密钥，关闭后无法再次查看）',
            'data': {
                'key_id': obj.id,
                'name': obj.name,
                'key': raw_key,
                'key_preview': f'{obj.key_prefix}****{obj.key_last_4}',
                'key_type': obj.key_type,
            }
        })

    @action(detail=False, methods=['get'])
    def list_api_keys(self, request):
        enterprise = self.get_enterprise(request)
        if not enterprise:
            return Response({'success': False, 'message': '未找到企业账号'}, status=404)

        keys = EnterpriseAPIKey.objects.filter(enterprise=enterprise).order_by('-created_at')
        data = [{
            'id': k.id,
            'name': k.name,
            'key_type': k.key_type,
            'key_type_display': k.get_key_type_display(),
            'key_preview': f'{k.key_prefix}****{k.key_last_4}',
            'is_active': k.is_active,
            'rate_limit_per_minute': k.rate_limit_per_minute,
            'daily_quota': k.daily_quota,
            'monthly_quota': k.monthly_quota,
            'total_calls': k.total_calls,
            'last_used_at': k.last_used_at.isoformat() if k.last_used_at else None,
            'expires_at': k.expires_at.isoformat() if k.expires_at else None,
            'ip_restrictions': k.ip_restrictions,
            'created_at': k.created_at.isoformat() if k.created_at else None,
        } for k in keys]
        return Response({'success': True, 'message': 'ok', 'data': data, 'total': len(data)})

    @action(detail=False, methods=['post'])
    def revoke_api_key(self, request):
        enterprise = self.get_enterprise(request)
        if not enterprise:
            return Response({'success': False, 'message': '未找到企业账号'}, status=404)

        key_id = request.data.get('key_id')
        if not key_id:
            return Response({'success': False, 'message': '缺少key_id'}, status=400)

        try:
            key = EnterpriseAPIKey.objects.get(id=key_id, enterprise=enterprise)
        except EnterpriseAPIKey.DoesNotExist:
            return Response({'success': False, 'message': '密钥不存在'}, status=404)

        key.is_active = False
        key.save()
        return Response({'success': True, 'message': f'密钥 [{key.name}] 已禁用'})

    @action(detail=False, methods=['post'])
    def submit_recharge(self, request):
        enterprise = self.get_enterprise(request)
        if not enterprise:
            return Response({'success': False, 'message': '未找到企业账号'}, status=404)

        amount = request.data.get('amount')
        recharge_type = request.data.get('recharge_type', 'balance')
        payment_method = request.data.get('payment_method', 'bank_transfer')

        if not amount:
            return Response({'success': False, 'message': '请输入充值金额'}, status=400)

        try:
            amount_decimal = Decimal(str(amount))
            if amount_decimal < Decimal('100'):
                return Response({'success': False, 'message': '最低充值金额为100元'}, status=400)
            if amount_decimal > Decimal('500000'):
                return Response({'success': False, 'message': '单次充值上限50万元'}, status=400)
        except Exception:
            return Response({'success': False, 'message': '金额格式错误'}, status=400)

        transaction_no = f"RC{timezone.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"

        recharge = EnterpriseBatchRecharge.objects.create(
            enterprise=enterprise,
            recharge_type=recharge_type,
            amount=amount_decimal,
            api_calls_added=int(request.data.get('api_calls_added', 0)),
            days_added=int(request.data.get('days_added', 0)),
            payment_method=payment_method,
            transaction_no=transaction_no,
            invoice_requested=request.data.get('invoice_requested', False),
            operator=request.user,
        )

        return Response({
            'success': True,
            'message': '充值申请已提交，请等待审核',
            'data': {
                'recharge_id': recharge.id,
                'transaction_no': recharge.transaction_no,
                'amount': str(recharge.amount),
                'status': recharge.status,
            }
        })

    @action(detail=False, methods=['get'])
    def recharge_history(self, request):
        enterprise = self.get_enterprise(request)
        if not enterprise:
            return Response({'success': False, 'message': '未找到企业账号'}, status=404)

        recharges = EnterpriseBatchRecharge.objects.filter(enterprise=enterprise).order_by('-created_at')
        data = [{
            'id': r.id,
            'recharge_type': r.recharge_type,
            'recharge_type_display': r.get_recharge_type_display(),
            'amount': str(r.amount),
            'payment_method': r.payment_method,
            'transaction_no': r.transaction_no,
            'status': r.status,
            'status_display': r.get_status_display(),
            'invoice_requested': r.invoice_requested,
            'invoice_no': r.invoice_no,
            'reviewed_by': r.reviewed_by,
            'review_remark': r.review_remark,
            'created_at': r.created_at.isoformat() if r.created_at else None,
            'processed_at': r.processed_at.isoformat() if r.processed_at else None,
        } for r in recharges]
        return Response({'success': True, 'message': 'ok', 'data': data, 'total': len(data)})

    @action(detail=False, methods=['get'])
    def usage_logs(self, request):
        enterprise = self.get_enterprise(request)
        if not enterprise:
            return Response({'success': False, 'message': '未找到企业账号'}, status=404)

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        resource_type = request.query_params.get('resource_type', '')

        qs = EnterpriseUsageLog.objects.filter(enterprise=enterprise)
        if resource_type:
            qs = qs.filter(resource_type=resource_type)

        total = qs.count()
        start = (page - 1) * page_size
        logs = qs.select_related('api_key', 'member__user').order_by('-created_at')[start:start + page_size]

        data = [{
            'id': l.id,
            'resource_type': l.resource_type,
            'resource_type_display': l.get_resource_type_display(),
            'endpoint': l.endpoint,
            'method': l.method,
            'quantity': l.quantity,
            'cost': str(l.cost),
            'request_id': l.request_id,
            'response_time_ms': l.response_time_ms,
            'status_code': l.status_code,
            'ip_address': l.ip_address,
            'api_key_name': l.api_key.name if l.api_key else None,
            'member_username': l.member.user.username if l.member and l.member.user else None,
            'created_at': l.created_at.isoformat() if l.created_at else None,
        } for l in logs]

        return Response({
            'success': True,
            'message': 'ok',
            'data': data,
            'pagination': {'page': page, 'page_size': page_size, 'total': total}
        })


class EnterpriseSuperAdminViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def list_all_enterprises(self, request):
        if not request.user.is_staff:
            return Response({'success': False, 'message': '需要管理员权限'}, status=403)

        enterprises = EnterpriseAccount.objects.all().order_by('-created_at')
        status_filter = request.query_params.get('status')
        plan_filter = request.query_params.get('plan_type')
        if status_filter:
            enterprises = enterprises.filter(status=status_filter)
        if plan_filter:
            enterprises = enterprises.filter(plan_type=plan_filter)

        data = [{
            'id': e.id,
            'name': e.name,
            'company_name': e.company_name,
            'plan_type': e.plan_type,
            'plan_display': e.get_plan_type_display(),
            'status': e.status,
            'status_display': e.get_status_display(),
            'contact_person': e.contact_person,
            'contact_phone': e.contact_phone,
            'contact_email': e.contact_email,
            'balance': str(e.balance),
            'total_recharged': str(e.total_recharged),
            'total_spent': str(e.total_spent),
            'api_calls_used': e.api_calls_used,
            'api_calls_limit': e.api_calls_limit,
            'member_count': EnterpriseMember.objects.filter(enterprise=e).exclude(status='removed').count(),
            'admin_username': e.admin_user.username if e.admin_user else None,
            'paid_until': e.paid_until.isoformat() if e.paid_until else None,
            'created_at': e.created_at.isoformat() if e.created_at else None,
        } for e in enterprises[:50]]
        return Response({'success': True, 'message': 'ok', 'data': data})

    @action(detail=False, methods=['post'])
    def approve_recharge(self, request):
        if not request.user.is_staff:
            return Response({'success': False, 'message': '需要管理员权限'}, status=403)

        recharge_id = request.data.get('recharge_id')
        remark = request.data.get('remark', '')
        if not recharge_id:
            return Response({'success': False, 'message': '缺少recharge_id'}, status=400)

        try:
            recharge = EnterpriseBatchRecharge.objects.select_related('enterprise').get(id=recharge_id)
        except EnterpriseBatchRecharge.DoesNotExist:
            return Response({'success': False, 'message': '充值记录不存在'}, status=404)

        if recharge.status != 'pending':
            return Response({'success': False, 'message': f'当前状态为{recharge.get_status_display()}，无法操作'}, status=400)

        recharge.status = 'approved'
        recharge.reviewed_by = request.user.username
        recharge.review_remark = remark
        recharge.processed_at = timezone.now()
        recharge.save()

        enterprise = recharge.enterprise
        if recharge.recharge_type == 'balance':
            enterprise.balance += recharge.amount
            enterprise.total_recharged += recharge.amount
        elif recharge.recharge_type == 'api_quota':
            enterprise.api_calls_limit += recharge.api_calls_added
        elif recharge.recharge_type in ['plan_upgrade', 'extension']:
            if recharge.days_added > 0 and enterprise.paid_until:
                enterprise.paid_until = enterprise.paid_until + timezone.timedelta(days=recharge.days_added)
        enterprise.save()

        recharge.status = 'completed'
        recharge.save()

        EnterpriseUsageLog.objects.create(
            enterprise=enterprise,
            resource_type='api_call' if recharge.recharge_type == 'api_quota' else 'member_seat',
            endpoint='/api/enterprise/recharge/approve',
            method='POST',
            quantity=1,
            cost=recharge.amount if recharge.recharge_type == 'balance' else Decimal('0'),
            request_id=recharge.transaction_no,
            extra_data={'recharge_id': recharge.id, 'type': recharge.recharge_type},
        )

        return Response({
            'success': True,
            'message': f'审核通过：{enterprise.name} ¥{recharge.amount}',
            'data': {'new_balance': str(enterprise.balance)}
        })

    @action(detail=False, methods=['post'])
    def reject_recharge(self, request):
        if not request.user.is_staff:
            return Response({'success': False, 'message': '需要管理员权限'}, status=403)

        recharge_id = request.data.get('recharge_id')
        remark = request.data.get('remark', '')
        if not recharge_id:
            return Response({'success': False, 'message': '缺少recharge_id'}, status=400)

        try:
            recharge = EnterpriseBatchRecharge.objects.get(id=recharge_id)
        except EnterpriseBatchRecharge.DoesNotExist:
            return Response({'success': False, 'message': '充值记录不存在'}, status=404)

        recharge.status = 'rejected'
        recharge.reviewed_by = request.user.username
        recharge.review_remark = remark
        recharge.processed_at = timezone.now()
        recharge.save()

        return Response({'success': True, 'message': f'已拒绝充值申请: {recharge.transaction_no}'})


class SoftwareCopyrightViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def list_applications(self, request):
        apps = SoftwareCopyrightApplication.objects.all().order_by('-created_at')
        status_filter = request.query_params.get('status')
        if status_filter:
            apps = apps.filter(status=status_filter)

        data = [{
            'id': a.id,
            'software_name': a.software_name,
            'software_type': a.software_type,
            'software_type_display': a.get_software_type_display(),
            'version': a.version,
            'status': a.status,
            'status_display': a.get_status_display(),
            'applicant_name': a.applicant_name,
            'applicant_type': a.applicant_type,
            'lines_of_code': a.lines_of_code,
            'tech_stack': a.tech_stack,
            'development_start_date': str(a.development_start_date) if a.development_start_date else None,
            'registration_number': a.registration_number,
            'certificate_number': a.certificate_number,
            'submit_to': a.submit_to,
            'submit_to_display': a.get_submit_to_display() if hasattr(a, 'get_submit_to_display') else a.submit_to,
            'created_at': a.created_at.isoformat() if a.created_at else None,
            'updated_at': a.updated_at.isoformat() if a.updated_at else None,
        } for a in apps]
        return Response({'success': True, 'message': 'ok', 'data': data, 'total': len(data)})

    @action(detail=False, methods=['post'])
    def create_application(self, request):
        data = request.data
        required = ['software_name', 'software_type', 'applicant_name']
        for field in required:
            if not data.get(field):
                return Response({'success': False, 'message': f'{field} 不能为空'}, status=400)

        app = SoftwareCopyrightApplication.objects.create(
            software_name=data['software_name'],
            software_type=data['software_type'],
            version=data.get('version', 'V1.0'),
            description=data.get('description', ''),
            tech_stack=data.get('tech_stack', 'Python/Django/React/TypeScript'),
            lines_of_code=int(data.get('lines_of_code', 0)),
            development_start_date=data.get('development_start_date'),
            first_public_date=data.get('first_public_date'),
            applicant_name=data['applicant_name'],
            applicant_type=data.get('applicant_type', 'corporate'),
            applicant_id=data.get('applicant_id', ''),
            submit_to=data.get('submit_to', 'csdncc'),
            documents=data.get('documents', []),
            source_code_repo=data.get('source_code_repo', ''),
            screenshots=data.get('screenshots', []),
        )
        return Response({
            'success': True,
            'message': '软著申请草稿已创建',
            'data': {'id': app.id, 'software_name': app.software_name, 'status': app.status}
        })

    @action(detail=False, methods=['post'])
    def submit_application(self, request):
        app_id = request.data.get('id')
        if not app_id:
            return Response({'success': False, 'message': '缺少id'}, status=400)

        try:
            app = SoftwareCopyrightApplication.objects.get(id=app_id)
        except SoftwareCopyrightApplication.DoesNotExist:
            return Response({'success': False, 'message': '申请不存在'}, status=404)

        if app.status != 'draft':
            return Response({'success': False, 'message': f'当前状态为{app.get_status_display()}，无法提交'}, status=400)

        app.status = 'submitted'
        app.registration_number = f"SR{timezone.now().strftime('%Y%m%d')}{str(app.id).zfill(6)}"
        app.save()

        return Response({
            'success': True,
            'message': f'软著申请已提交，登记号: {app.registration_number}',
            'data': {'registration_number': app.registration_number, 'status': app.status}
        })


def verify_api_key(key_string):
    if not key_string or not key_string.startswith('yjd_'):
        return None, 'invalid_key_format'
    import hashlib
    key_hash = hashlib.sha256(key_string.encode()).hexdigest()
    try:
        api_key = EnterpriseAPIKey.objects.select_related('enterprise').get(
            key_hash=key_hash, is_active=True
        )
        if api_key.expires_at and api_key.expires_at < timezone.now():
            return None, 'key_expired'
        return api_key, None
    except EnterpriseAPIKey.DoesNotExist:
        return None, 'key_not_found'


def check_rate_limit(api_key):
    from django.utils.timezone import now
    one_min_ago = now() - timezone.timedelta(minutes=1)
    recent_calls = EnterpriseUsageLog.objects.filter(
        api_key=api_key, created_at__gte=one_min_ago
    ).count()
    if recent_calls >= api_key.rate_limit_per_minute:
        return False, 'rate_limit_exceeded'

    today = now().date()
    today_calls = EnterpriseUsageLog.objects.filter(
        api_key=api_key, created_at__date=today
    ).aggregate(total=Sum('quantity'))['total'] or 0
    if today_calls >= api_key.daily_quota:
        return False, 'daily_quota_exceeded'

    this_month = today.replace(day=1)
    month_calls = EnterpriseUsageLog.objects.filter(
        api_key=api_key, created_at__gte=this_month
    ).aggregate(total=Sum('quantity'))['total'] or 0
    if month_calls >= api_key.monthly_quota:
        return False, 'monthly_quota_exceeded'

    return True, None


def log_api_call(api_key, enterprise, endpoint, method, status_code, response_time_ms, request_id=None, cost=Decimal('0'), member=None, quantity=1, extra_data=None):
    EnterpriseUsageLog.objects.create(
        enterprise=enterprise,
        member=member,
        api_key=api_key,
        resource_type='api_call',
        endpoint=endpoint,
        method=method,
        quantity=quantity,
        cost=cost,
        request_id=request_id or str(uuid.uuid4()),
        response_time_ms=response_time_ms,
        status_code=status_code,
        extra_data=extra_data or {},
    )
    if api_key:
        api_key.total_calls = F('total_calls') + 1
        api_key.last_used_at = timezone.now()
        api_key.save(update_fields=['total_calls', 'last_used_at'])
    if enterprise:
        EnterpriseAccount.objects.filter(pk=enterprise.pk).update(api_calls_used=F('api_calls_used') + quantity)

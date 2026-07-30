import uuid
from django.db.models import Q, F, Sum, Count
from django.utils import timezone
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.filters import SearchFilter, OrderingFilter

from .mall_models import (
    Product,
    Order,
    PaymentRecord,
    WithdrawalRecord,
    HotContentTemplate,
    UserFeedback,
    BusinessInquiry,
)
from .mall_serializers import (
    ProductSerializer,
    ProductListSerializer,
    OrderSerializer,
    OrderCreateSerializer,
    PaymentRecordSerializer,
    WithdrawalCreateSerializer,
    WithdrawalSerializer,
    HotContentTemplateSerializer,
    UserFeedbackSerializer,
    FeedbackCreateSerializer,
    BusinessInquirySerializer,
    BusinessInquiryCreateSerializer,
    CourseProductSerializer,
)


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = ProductSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['title', 'description', 'tags']
    ordering_fields = ['price', 'sales_count', 'view_count', 'sort_order', 'created_at']
    ordering = ['-sort_order', '-created_at']

    def get_queryset(self):
        qs = Product.objects.all()
        category = self.request.query_params.get('category')
        status_param = self.request.query_params.get('status')
        is_hot = self.request.query_params.get('is_hot')
        is_recommend = self.request.query_params.get('is_recommend')
        if category:
            qs = qs.filter(category=category)
        if status_param:
            qs = qs.filter(status=status_param)
        if is_hot is not None:
            qs = qs.filter(is_hot=is_hot.lower() == 'true')
        if is_recommend is not None:
            qs = qs.filter(is_recommend=is_recommend.lower() == 'true')
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        serializer = ProductListSerializer(page or queryset, many=True)
        data = {
            'success': True,
            'count': queryset.count(),
            'data': serializer.data,
        }
        if page is not None:
            data = self.get_paginated_response(serializer.data).data
            data['success'] = True
        return Response(data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        Product.objects.filter(id=instance.id).update(view_count=F('view_count') + 1)
        serializer = self.get_serializer(instance)
        return Response({'success': True, 'data': serializer.data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if request.user and hasattr(request.user, 'id'):
            serializer.validated_data['created_by_id'] = request.user.id
        instance = serializer.save()
        return Response({
            'success': True,
            'message': '产品创建成功',
            'data': ProductSerializer(instance).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='my-products')
    def my_products(self, request):
        """我的发布产品"""
        user_id = getattr(request.user, 'id', None)
        if not user_id:
            return Response({'success': False, 'message': '未登录'}, status=status.HTTP_401_UNAUTHORIZED)
        qs = Product.objects.filter(created_by_id=user_id).order_by('-created_at')
        page = self.paginate_queryset(qs)
        serializer = ProductSerializer(page or qs, many=True)
        data = {
            'success': True,
            'count': qs.count(),
            'data': serializer.data,
        }
        if page is not None:
            data = self.get_paginated_response(serializer.data).data
            data['success'] = True
        return Response(data)

    @action(detail=False, methods=['get'], url_path='hot-products', permission_classes=[AllowAny])
    def hot_products(self, request):
        """爆款推荐（公开接口）"""
        qs = Product.objects.filter(
            Q(is_hot=True) | Q(is_recommend=True),
            status='on_sale'
        ).order_by('-sales_count', '-view_count')[:20]
        serializer = ProductListSerializer(qs, many=True)
        return Response({'success': True, 'data': serializer.data})

    @action(detail=False, methods=['get'], url_path='categories', permission_classes=[AllowAny])
    def categories(self, request):
        """分类统计（公开接口）"""
        from django.db.models.functions import Coalesce
        stats = Product.objects.filter(status='on_sale').values('category').annotate(
            count=Count('id'),
            total_sales=Coalesce(Sum('sales_count'), 0),
        ).order_by('-count')
        result = []
        for s in stats:
            result.append({
                'category': s['category'],
                'category_name': dict(Product.CATEGORY_CHOICES).get(s['category'], s['category']),
                'count': s['count'],
                'total_sales': s['total_sales'],
            })
        return Response({'success': True, 'data': result})

    @action(detail=False, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request):
        """上架/下架"""
        product_id = request.data.get('product_id')
        if not product_id:
            return Response({'success': False, 'message': '缺少product_id'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'success': False, 'message': '产品不存在'}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_staff and getattr(product, 'created_by_id', None) != request.user.id:
            return Response({'success': False, 'message': '无权操作此产品'}, status=status.HTTP_403_FORBIDDEN)
        if product.status == 'on_sale':
            product.status = 'off_sale'
        elif product.status == 'off_sale':
            product.status = 'on_sale'
        else:
            product.status = 'on_sale'
        product.save(update_fields=['status', 'updated_at'])
        return Response({
            'success': True,
            'message': f'已{product.get_status_display()}',
            'data': {'product_id': product.id, 'status': product.status},
        })

    @action(detail=False, methods=['get'], url_path='courses', permission_classes=[AllowAny])
    def courses(self, request):
        courses = Product.objects.filter(category='course', status='on_sale').order_by('-sort_order', '-sales_count')
        serializer = CourseProductSerializer(courses, many=True)
        return Response({
            'success': True,
            'count': courses.count(),
            'data': serializer.data,
        })

    @action(detail=True, methods=['get'], url_path='course-detail', permission_classes=[AllowAny])
    def course_detail(self, request, pk=None):
        try:
            course = Product.objects.get(pk=pk, category='course')
        except Product.DoesNotExist:
            return Response({'success': False, 'message': '课程不存在'}, status=404)
        Product.objects.filter(id=course.id).update(view_count=F('view_count') + 1)
        serializer = CourseProductSerializer(course)
        return Response({'success': True, 'data': serializer.data})


class OrderViewSet(viewsets.GenericViewSet,
                   mixins.ListModelMixin,
                   mixins.RetrieveModelMixin):
    queryset = Order.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        user_id = getattr(self.request.user, 'id', None)
        return Order.objects.filter(user_id=user_id).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        status_param = request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True)
        data = {
            'success': True,
            'count': queryset.count(),
            'results': serializer.data,
        }
        if page is not None:
            data = self.get_paginated_response(serializer.data).data
            data['success'] = True
        return Response(data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({'success': True, 'data': serializer.data})

    @action(detail=False, methods=['get'], url_path='my-orders')
    def my_orders(self, request):
        """我的订单（同list，支持更多筛选）"""
        return self.list(request)

    @action(detail=False, methods=['post'], url_path='create-order')
    def create_order(self, request):
        """创建订单"""
        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        items_data = serializer.validated_data['items']
        user_id = getattr(request.user, 'id', None)
        if not user_id:
            return Response({'success': False, 'message': '未登录'}, status=status.HTTP_401_UNAUTHORIZED)

        order_items = []
        total_amount = 0
        for item in items_data:
            try:
                product = Product.objects.get(id=item['product_id'], status='on_sale')
            except Product.DoesNotExist:
                return Response({
                    'success': False,
                    'message': f"产品ID {item['product_id']} 不存在或已下架"
                }, status=status.HTTP_400_BAD_REQUEST)
            quantity = int(item['quantity'])
            if product.stock != -1 and product.stock < quantity:
                return Response({
                    'success': False,
                    'message': f'产品"{product.title}"库存不足'
                }, status=status.HTTP_400_BAD_REQUEST)
            item_total = float(product.price) * quantity
            total_amount += item_total
            order_items.append({
                'product_id': product.id,
                'title': product.title,
                'price': str(product.price),
                'quantity': quantity,
                'item_total': str(item_total),
            })

        order_no = f'MALL{timezone.now().strftime("%Y%m%d%H%M%S")}{uuid.uuid4().hex[:8].upper()}'
        order = Order.objects.create(
            order_no=order_no,
            user_id=user_id,
            total_amount=total_amount,
            pay_amount=total_amount,
            status='pending',
            items=order_items,
            remark=serializer.validated_data.get('remark', ''),
            pay_method=serializer.validated_data.get('pay_method', 'balance'),
        )
        return Response({
            'success': True,
            'message': '订单创建成功',
            'data': OrderSerializer(order).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='cancel')
    def cancel(self, request):
        """取消订单"""
        order_id = request.data.get('order_id') or request.data.get('id')
        if not order_id:
            return Response({'success': False, 'message': '缺少order_id'}, status=status.HTTP_400_BAD_REQUEST)
        user_id = getattr(request.user, 'id', None)
        try:
            order = Order.objects.get(id=order_id, user_id=user_id)
        except Order.DoesNotExist:
            return Response({'success': False, 'message': '订单不存在'}, status=status.HTTP_404_NOT_FOUND)
        if order.status not in ['pending', 'paid']:
            return Response({'success': False, 'message': '当前状态不允许取消'}, status=status.HTTP_400_BAD_REQUEST)
        order.status = 'cancelled'
        order.save(update_fields=['status', 'updated_at'])
        return Response({
            'success': True,
            'message': '订单已取消',
            'data': {'order_id': order.id, 'status': order.status},
        })

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """订单统计"""
        user_id = getattr(request.user, 'id', None)
        if not user_id:
            return Response({'success': False, 'message': '未登录'}, status=status.HTTP_401_UNAUTHORIZED)
        total_orders = Order.objects.filter(user_id=user_id).count()
        total_spent = Order.objects.filter(
            user_id=user_id, status__in=['paid', 'shipped', 'completed']
        ).aggregate(total=Sum('pay_amount'))['total'] or 0
        pending_count = Order.objects.filter(user_id=user_id, status='pending').count()
        completed_count = Order.objects.filter(user_id=user_id, status='completed').count()
        return Response({
            'success': True,
            'data': {
                'total_orders': total_orders,
                'total_spent': str(total_spent),
                'pending_count': pending_count,
                'completed_count': completed_count,
            },
        })


class PaymentViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PaymentRecordSerializer

    @action(detail=False, methods=['post'], url_path='create-payment')
    def create_payment(self, request):
        """创建支付记录"""
        order_id = request.data.get('order_id')
        method = request.data.get('method', 'balance')
        if not order_id:
            return Response({'success': False, 'message': '缺少order_id'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({'success': False, 'message': '订单不存在'}, status=status.HTTP_404_NOT_FOUND)
        if order.status != 'pending':
            return Response({'success': False, 'message': '订单状态异常'}, status=status.HTTP_400_BAD_REQUEST)
        payment = PaymentRecord.objects.create(
            order_id=order,
            amount=order.pay_amount,
            method=method,
            status='pending',
        )
        return Response({
            'success': True,
            'message': '支付记录创建成功',
            'data': PaymentRecordSerializer(payment).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='callback')
    def callback(self, request):
        """支付回调（模拟）"""
        if not request.user.is_staff:
            return Response({'success': False, 'message': '无权操作'}, status=status.HTTP_403_FORBIDDEN)
        payment_id = request.data.get('payment_id')
        trade_no = request.data.get('trade_no', f'SIM{uuid.uuid4().hex[:16].upper()}')
        if not payment_id:
            return Response({'success': False, 'message': '缺少payment_id'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            payment = PaymentRecord.objects.get(id=payment_id)
        except PaymentRecord.DoesNotExist:
            return Response({'success': False, 'message': '支付记录不存在'}, status=status.HTTP_404_NOT_FOUND)
        if payment.status == 'success':
            return Response({'success': False, 'message': '该支付已完成'}, status=status.HTTP_400_BAD_REQUEST)
        now = timezone.now()
        payment.status = 'success'
        payment.trade_no = trade_no
        payment.pay_time = now
        payment.callback_data = request.data
        payment.save(update_fields=['status', 'trade_no', 'pay_time', 'callback_data'])
        order = payment.order_id
        order.status = 'paid'
        order.pay_time = now
        order.pay_method = payment.method
        order.save(update_fields=['status', 'pay_time', 'pay_method', 'updated_at'])
        for item in (order.items or []):
            Product.objects.filter(id=item.get('product_id')).update(
                sales_count=F('sales_count') + item.get('quantity', 1),
                stock=F('stock') - item.get('quantity', 1),
            )
        return Response({
            'success': True,
            'message': '支付成功',
            'data': PaymentRecordSerializer(payment).data,
        })

    @action(detail=False, methods=['get'], url_path='my-payments')
    def my_payments(self, request):
        """我的支付记录"""
        user_id = getattr(request.user, 'id', None)
        if not user_id:
            return Response({'success': False, 'message': '未登录'}, status=status.HTTP_401_UNAUTHORIZED)
        order_ids = Order.objects.filter(user_id=user_id).values_list('id', flat=True)
        qs = PaymentRecord.objects.filter(order_id__in=order_ids).order_by('-created_at')
        page = self.paginate_queryset(qs)
        serializer = PaymentRecordSerializer(page or qs, many=True)
        data = {
            'success': True,
            'count': qs.count(),
            'results': serializer.data,
        }
        if page is not None:
            data = self.get_paginated_response(serializer.data).data
            data['success'] = True
        return Response(data)


class WithdrawalViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='apply')
    def apply(self, request):
        """申请提现"""
        serializer = WithdrawalCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_id = getattr(request.user, 'id', None)
        if not user_id:
            return Response({'success': False, 'message': '未登录'}, status=status.HTTP_401_UNAUTHORIZED)
        record = WithdrawalRecord.objects.create(
            user_id=user_id,
            amount=serializer.validated_data['amount'],
            account_type=serializer.validated_data['account_type'],
            account_no=serializer.validated_data['account_no'],
            account_name=serializer.validated_data['account_name'],
            status='pending',
        )
        return Response({
            'success': True,
            'message': '提现申请已提交',
            'data': WithdrawalSerializer(record).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='my-withdrawals')
    def my_withdrawals(self, request):
        """我的提现记录"""
        user_id = getattr(request.user, 'id', None)
        if not user_id:
            return Response({'success': False, 'message': '未登录'}, status=status.HTTP_401_UNAUTHORIZED)
        qs = WithdrawalRecord.objects.filter(user_id=user_id).order_by('-created_at')
        page = self.paginate_queryset(qs)
        serializer = WithdrawalSerializer(page or qs, many=True)
        data = {
            'success': True,
            'count': qs.count(),
            'results': serializer.data,
        }
        if page is not None:
            data = self.get_paginated_response(serializer.data).data
            data['success'] = True
        return Response(data)

    @action(detail=False, methods=['get'], url_path='admin-list')
    def admin_list(self, request):
        """管理员查看所有提现"""
        if not request.user.is_staff:
            return Response({'success': False, 'message': '需要管理员权限'}, status=status.HTTP_403_FORBIDDEN)
        qs = WithdrawalRecord.objects.all().order_by('-created_at')
        status_param = request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        page = self.paginate_queryset(qs)
        serializer = WithdrawalSerializer(page or qs, many=True)
        data = {
            'success': True,
            'count': qs.count(),
            'results': serializer.data,
        }
        if page is not None:
            data = self.get_paginated_response(serializer.data).data
            data['success'] = True
        return Response(data)

    @action(detail=False, methods=['post'], url_path='handle')
    def handle(self, request):
        """管理员审批提现"""
        if not request.user.is_staff:
            return Response({'success': False, 'message': '需要管理员权限'}, status=status.HTTP_403_FORBIDDEN)
        withdrawal_id = request.data.get('withdrawal_id') or request.data.get('id')
        action_type = request.data.get('action')
        remark = request.data.get('remark', '')
        if not withdrawal_id:
            return Response({'success': False, 'message': '缺少withdrawal_id'}, status=status.HTTP_400_BAD_REQUEST)
        if action_type not in ['approve', 'reject']:
            return Response({'success': False, 'message': 'action必须为approve或reject'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            record = WithdrawalRecord.objects.get(id=withdrawal_id)
        except WithdrawalRecord.DoesNotExist:
            return Response({'success': False, 'message': '提现记录不存在'}, status=status.HTTP_404_NOT_FOUND)
        if record.status != 'pending':
            return Response({'success': False, 'message': '当前状态无法操作'}, status=status.HTTP_400_BAD_REQUEST)
        now = timezone.now()
        if action_type == 'approve':
            record.status = 'completed'
        else:
            record.status = 'rejected'
        record.handle_remark = remark
        record.handled_at = now
        record.save(update_fields=['status', 'handle_remark', 'handled_at'])
        return Response({
            'success': True,
            'message': f'已{"通过" if action_type == "approve" else "拒绝"}提现申请',
            'data': WithdrawalSerializer(record).data,
        })


class HotContentViewSet(viewsets.ModelViewSet):
    queryset = HotContentTemplate.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = HotContentTemplateSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['title', 'description', 'category']
    ordering_fields = ['usage_count', 'rating', 'created_at']
    ordering = ['-usage_count', '-rating']

    def get_queryset(self):
        qs = HotContentTemplate.objects.all()
        category = self.request.query_params.get('category')
        is_public = self.request.query_params.get('is_public')
        if category:
            qs = qs.filter(category__icontains=category)
        if is_public is not None:
            qs = qs.filter(is_public=is_public.lower() == 'true')
        return qs

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
        if request.user and hasattr(request.user, 'id'):
            serializer.validated_data['creator_id_id'] = request.user.id
        instance = serializer.save()
        return Response({
            'success': True,
            'message': '模板创建成功',
            'data': HotContentTemplateSerializer(instance).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='trending', permission_classes=[AllowAny])
    def trending(self, request):
        """热门爆款模板（公开接口）"""
        qs = HotContentTemplate.objects.filter(
            is_public=True
        ).order_by('-usage_count', '-rating')[:20]
        serializer = HotContentTemplateSerializer(qs, many=True)
        return Response({'success': True, 'data': serializer.data})

    @action(detail=True, methods=['get'], url_path='use-template')
    def use_template(self, request, pk=None):
        """使用模板（增加使用次数）"""
        try:
            template = HotContentTemplate.objects.get(pk=pk)
        except HotContentTemplate.DoesNotExist:
            return Response({'success': False, 'message': '模板不存在'}, status=status.HTTP_404_NOT_FOUND)
        HotContentTemplate.objects.filter(pk=pk).update(usage_count=F('usage_count') + 1)
        template.refresh_from_db()
        return Response({
            'success': True,
            'message': '模板使用次数+1',
            'data': HotContentTemplateSerializer(template).data,
        })


class FeedbackViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def create(self, request):
        """提交反馈"""
        serializer = FeedbackCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_id = getattr(request.user, 'id', None)
        if not user_id:
            return Response({'success': False, 'message': '未登录'}, status=status.HTTP_401_UNAUTHORIZED)

        feedback = UserFeedback.objects.create(
            user_id=user_id,
            **serializer.validated_data,
        )

        return Response({
            'success': True,
            'message': '反馈提交成功',
            'data': UserFeedbackSerializer(feedback).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='my')
    def my(self, request):
        """我的反馈列表"""
        user_id = getattr(request.user, 'id', None)
        if not user_id:
            return Response({'success': False, 'message': '未登录'}, status=status.HTTP_401_UNAUTHORIZED)

        qs = UserFeedback.objects.filter(user_id=user_id).order_by('-created_at')
        page = self.paginate_queryset(qs)
        serializer = UserFeedbackSerializer(page or qs, many=True)
        data = {
            'success': True,
            'count': qs.count(),
            'results': serializer.data,
        }
        if page is not None:
            data = self.get_paginated_response(serializer.data).data
            data['success'] = True
        return Response(data)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """反馈统计（管理员）"""
        total_feedbacks = UserFeedback.objects.count()
        avg_rating = UserFeedback.objects.aggregate(avg=Avg('rating'))['avg'] or 0

        type_stats = UserFeedback.objects.values('feedback_type').annotate(
            count=Count('id'),
            avg_rating=Avg('rating'),
        ).order_by('-count')

        rating_distribution = UserFeedback.objects.values('rating').annotate(
            count=Count('id'),
        ).order_by('rating')

        unresolved_count = UserFeedback.objects.filter(is_resolved=False).count()
        resolved_count = UserFeedback.objects.filter(is_resolved=True).count()

        recent_feedbacks = UserFeedback.objects.order_by('-created_at')[:10]

        return Response({
            'success': True,
            'data': {
                'total_feedbacks': total_feedbacks,
                'avg_rating': round(float(avg_rating), 2),
                'unresolved_count': unresolved_count,
                'resolved_count': resolved_count,
                'resolution_rate': round((resolved_count / max(total_feedbacks, 1)) * 100, 2),
                'type_breakdown': [
                    {
                        'type': stat['feedback_type'],
                        'type_name': dict(UserFeedback.FEEDBACK_TYPE).get(stat['feedback_type'], stat['feedback_type']),
                        'count': stat['count'],
                        'avg_rating': round(float(stat['avg_rating']), 2) if stat['avg_rating'] else 0,
                    }
                    for stat in type_stats
                ],
                'rating_distribution': [
                    {'rating': r['rating'], 'count': r['count']}
                    for r in rating_distribution
                ],
                'recent_feedbacks': UserFeedbackSerializer(recent_feedbacks, many=True).data,
            },
        })


class BusinessInquiryViewSet(viewsets.ViewSet):

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]

    def create(self, request):
        serializer = BusinessInquiryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user if request.user and request.user.is_authenticated else None

        inquiry = BusinessInquiry.objects.create(
            user=user,
            **serializer.validated_data,
        )

        return Response({
            'success': True,
            'message': '提交成功，我们会尽快联系您',
            'data': BusinessInquirySerializer(inquiry).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='admin-list')
    def admin_list(self, request):
        qs = BusinessInquiry.objects.all().order_by('-created_at')
        inquiry_type = request.query_params.get('inquiry_type')
        status_param = request.query_params.get('status')
        if inquiry_type:
            qs = qs.filter(inquiry_type=inquiry_type)
        if status_param:
            qs = qs.filter(status=status_param)
        page = self.paginate_queryset(qs)
        serializer = BusinessInquirySerializer(page or qs, many=True)
        data = {
            'success': True,
            'count': qs.count(),
            'results': serializer.data,
        }
        if page is not None:
            data = self.get_paginated_response(serializer.data).data
            data['success'] = True
        return data

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        if not request.user.is_staff:
            return Response({'success': False, 'message': '需要管理员权限'}, status=status.HTTP_403_FORBIDDEN)
        total = BusinessInquiry.objects.count()
        pending = BusinessInquiry.objects.filter(status='pending').count()
        type_stats = BusinessInquiry.objects.values('inquiry_type').annotate(
            count=Count('id'),
        ).order_by('-count')
        recent = BusinessInquiry.objects.all()[:10]
        return Response({
            'success': True,
            'data': {
                'total_inquiries': total,
                'pending_count': pending,
                'type_breakdown': [
                    {'type': s['inquiry_type'], 'type_name': dict(BusinessInquiry.INQUIRY_TYPE_CHOICES).get(s['inquiry_type'], s['inquiry_type']), 'count': s['count']}
                    for s in type_stats
                ],
                'recent_inquiries': BusinessInquirySerializer(recent, many=True).data,
            },
        })

    @action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        if not request.user.is_staff:
            return Response({'success': False, 'message': '需要管理员权限'}, status=status.HTTP_403_FORBIDDEN)
        try:
            inquiry = BusinessInquiry.objects.get(pk=pk)
        except BusinessInquiry.DoesNotExist:
            return Response({'success': False, 'message': '记录不存在'}, status=404)
        new_status = request.data.get('status')
        admin_note = request.data.get('admin_note', '')
        if new_status not in [s[0] for s in BusinessInquiry.STATUS_CHOICES]:
            return Response({'success': False, 'message': '无效的状态值'}, status=400)
        inquiry.status = new_status
        if admin_note:
            inquiry.admin_note = admin_note
        inquiry.save(update_fields=['status', 'admin_note', 'updated_at'])
        return Response({
            'success': True,
            'message': f'状态已更新为{inquiry.get_status_display()}',
            'data': BusinessInquirySerializer(inquiry).data,
        })

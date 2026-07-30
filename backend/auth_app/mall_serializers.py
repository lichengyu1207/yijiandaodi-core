from rest_framework import serializers
from .mall_models import (
    Product,
    Order,
    PaymentRecord,
    WithdrawalRecord,
    HotContentTemplate,
    UserFeedback,
    BusinessInquiry,
)


class ProductSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'description', 'category', 'category_display',
            'price', 'original_price', 'cover_image', 'images', 'tags',
            'is_hot', 'is_recommend', 'stock', 'sales_count', 'view_count',
            'status', 'status_display', 'created_by', 'sort_order',
            'created_at', 'updated_at',
        ]


class ProductListSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'category', 'category_display',
            'price', 'original_price', 'cover_image',
            'is_hot', 'is_recommend', 'sales_count', 'status',
            'created_at',
        ]


class OrderSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    pay_method_display = serializers.CharField(source='get_pay_method_display', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_no', 'user_id', 'total_amount', 'pay_amount',
            'status', 'status_display', 'pay_method', 'pay_method_display',
            'pay_time', 'shipping_info', 'remark', 'items',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'order_no', 'user_id', 'created_at']


class OrderCreateSerializer(serializers.Serializer):
    items = serializers.ListField()
    remark = serializers.CharField(required=False, default='', allow_blank=True, max_length=500)
    pay_method = serializers.ChoiceField(choices=['wechat', 'alipay', 'balance'], required=False, default='balance')

    def validate_items(self, value):
        if not isinstance(value, list) or len(value) == 0:
            raise serializers.ValidationError('订单项不能为空')
        for item in value:
            if not isinstance(item, dict):
                raise serializers.ValidationError('每个订单项必须是对象')
            if 'product_id' not in item:
                raise serializers.ValidationError('订单项缺少product_id')
            if 'quantity' not in item:
                raise serializers.ValidationError('订单项缺少quantity')
            try:
                qty = int(item['quantity'])
                if qty <= 0:
                    raise serializers.ValidationError('数量必须大于0')
            except (ValueError, TypeError):
                raise serializers.ValidationError('数量必须是正整数')
        return value


class PaymentRecordSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PaymentRecord
        fields = [
            'id', 'order_id', 'trade_no', 'amount', 'method', 'method_display',
            'status', 'status_display', 'pay_time', 'callback_data', 'created_at',
        ]
        read_only_fields = ['id', 'trade_no', 'pay_time', 'callback_data', 'created_at']


class WithdrawalCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    account_type = serializers.ChoiceField(choices=['bank', 'alipay', 'wechat'])
    account_no = serializers.CharField(max_length=64)
    account_name = serializers.CharField(max_length=100)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('提现金额必须大于0')
        return value


class WithdrawalSerializer(serializers.ModelSerializer):
    account_type_display = serializers.CharField(source='get_account_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = WithdrawalRecord
        fields = [
            'id', 'user_id', 'amount', 'account_type', 'account_type_display',
            'account_no', 'account_name', 'status', 'status_display',
            'handle_remark', 'created_at', 'handled_at',
        ]
        read_only_fields = ['id', 'user_id', 'status', 'handle_remark', 'created_at', 'handled_at']


class HotContentTemplateSerializer(serializers.ModelSerializer):
    creator_name = serializers.CharField(source='creator_id.username', default='', read_only=True)

    class Meta:
        model = HotContentTemplate
        fields = [
            'id', 'title', 'category', 'description', 'template_content',
            'usage_count', 'rating', 'is_public', 'creator_id', 'creator_name',
            'created_at',
        ]


class UserFeedbackSerializer(serializers.ModelSerializer):
    rating_display = serializers.CharField(source='get_rating_display', read_only=True)
    feedback_type_display = serializers.CharField(source='get_feedback_type_display', read_only=True)
    username = serializers.CharField(source='user.username', default='', read_only=True)

    class Meta:
        model = UserFeedback
        fields = [
            'id', 'user', 'username', 'rating', 'rating_display',
            'feedback_type', 'feedback_type_display', 'content',
            'session_id', 'agent_response_time_ms', 'query_text',
            'agent_answer_preview', 'is_resolved', 'admin_reply',
            'created_at',
        ]
        read_only_fields = ['id', 'user', 'created_at']


class FeedbackCreateSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5, default=5)
    feedback_type = serializers.ChoiceField(choices=[
        ('general', '综合反馈'),
        ('agent_quality', 'Agent回答质量'),
        ('agent_speed', 'Agent响应速度'),
        ('product_suggestion', '产品建议'),
        ('bug_report', '问题反馈'),
    ], default='general')
    content = serializers.CharField(required=False, default='', allow_blank=True, max_length=2000)
    session_id = serializers.CharField(required=False, default='', allow_blank=True, max_length=64)
    agent_response_time_ms = serializers.IntegerField(required=False, allow_null=True)
    query_text = serializers.CharField(required=False, default='', allow_blank=True, max_length=2000)
    agent_answer_preview = serializers.CharField(required=False, default='', allow_blank=True, max_length=500)


class BusinessInquirySerializer(serializers.ModelSerializer):
    inquiry_type_display = serializers.CharField(source='get_inquiry_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    username = serializers.CharField(source='user.username', default='', read_only=True)

    class Meta:
        model = BusinessInquiry
        fields = [
            'id', 'inquiry_type', 'inquiry_type_display', 'status', 'status_display',
            'company', 'contact_name', 'phone', 'email', 'requirement',
            'ad_type', 'budget', 'kol_target', 'platform', 'followers', 'cooperation_intent',
            'user', 'username', 'admin_note', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'user', 'admin_note', 'created_at', 'updated_at']


class BusinessInquiryCreateSerializer(serializers.Serializer):
    inquiry_type = serializers.ChoiceField(choices=[
        ('enterprise_rag', '企业RAG部署咨询'),
        ('enterprise_agent', '企业Agent开发咨询'),
        ('ad_cooperation', '广告合作咨询'),
        ('kol_cooperation', 'KOL合作申请'),
    ])
    company = serializers.CharField(required=False, default='', allow_blank=True, max_length=200)
    contact_name = serializers.CharField(max_length=100)
    phone = serializers.CharField(required=False, default='', allow_blank=True, max_length=30)
    email = serializers.EmailField(required=False, default='', allow_blank=True)
    requirement = serializers.CharField(required=False, default='', allow_blank=True, max_length=2000)
    ad_type = serializers.CharField(required=False, default='', allow_blank=True, max_length=50)
    budget = serializers.CharField(required=False, default='', allow_blank=True, max_length=50)
    kol_target = serializers.CharField(required=False, default='', allow_blank=True, max_length=100)
    platform = serializers.CharField(required=False, default='', allow_blank=True, max_length=50)
    followers = serializers.CharField(required=False, default='', allow_blank=True, max_length=50)
    cooperation_intent = serializers.CharField(required=False, default='', allow_blank=True, max_length=2000)


class CourseProductSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'description', 'category', 'category_display',
            'price', 'original_price', 'cover_image', 'images', 'tags',
            'course_meta', 'is_hot', 'is_recommend', 'sales_count',
            'view_count', 'status', 'created_at',
        ]

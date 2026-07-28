from rest_framework import serializers
from .mall_models import ScenarioPackage, EnterpriseAuditService, EnterpriseAuditContract, Product


class ScenarioPackageSerializer(serializers.ModelSerializer):
    s_scenario_name = serializers.CharField(source='s_scenario.title', read_only=True)
    s_scenario_price = serializers.DecimalField(source='s_scenario.price', max_digits=10, decimal_places=2, read_only=True)
    a_scenario_name = serializers.CharField(source='a_scenario.title', read_only=True)
    a_scenario_price = serializers.DecimalField(source='a_scenario.price', max_digits=10, decimal_places=2, read_only=True)
    b_scenarios_list = serializers.SerializerMethodField()
    savings_display = serializers.SerializerMethodField()

    class Meta:
        model = ScenarioPackage
        fields = '__all__'

    def get_b_scenarios_list(self, obj):
        return [{'id': p.id, 'title': p.title, 'price': str(p.price)} for p in obj.b_scenarios.all()]

    def get_savings_display(self, obj):
        if obj.original_total_price and obj.package_price:
            saved = obj.original_total_price - obj.package_price
            return {'saved': str(saved), 'percent': obj.discount_percent}
        return None


class ScenarioPackageCreateSerializer(serializers.Serializer):
    package_id = serializers.PrimaryKeyRelatedField(queryset=ScenarioPackage.objects.filter(is_active=True))
    selected_b_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), required=False)
    notes = serializers.CharField(required=False, default='', max_length=500)


class EnterpriseAuditServiceSerializer(serializers.ModelSerializer):
    tier_display = serializers.CharField(source='get_audit_tier_display', read_only=True)
    scope_display = serializers.CharField(source='get_scope_display', read_only=True)

    class Meta:
        model = EnterpriseAuditService
        fields = '__all__'


class EnterpriseAuditContractSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source='service.name', read_only=True)
    service_tier = serializers.CharField(source='service.get_audit_tier_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    duration_days = serializers.SerializerMethodField()

    class Meta:
        model = EnterpriseAuditContract
        fields = '__all__'
        read_only_fields = ['contract_no', 'status', 'created_at', 'updated_at']

    def get_duration_days(self, obj):
        if obj.start_date and obj.end_date:
            return (obj.end_date - obj.start_date).days
        return None


class EnterpriseAuditInquirySerializer(serializers.Serializer):
    service_id = serializers.PrimaryKeyRelatedField(queryset=EnterpriseAuditService.objects.filter(is_active=True))
    company_name = serializers.CharField(max_length=200)
    contact_person = serializers.CharField(max_length=100)
    contact_phone = serializers.CharField(max_length=30)
    contact_email = serializers.EmailField()
    employee_count = serializers.CharField(max_length=50, required=False, default='')
    industry = serializers.CharField(max_length=50, required=False, default='')
    requirements = serializers.CharField(required=False, default='', max_length=2000)

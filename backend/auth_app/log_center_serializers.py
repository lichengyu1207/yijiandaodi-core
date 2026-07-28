from rest_framework import serializers
from .models import LoginLog as LoginLogModel
from .rbac_models import OperationLog
from .log_center_models import PermissionInterceptLog


class LoginLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = LoginLogModel
        fields = [
            'id', 'user', 'username', 'ip_address', 'device_info',
            'login_time', 'logout_time', 'status', 'status_display',
            'message', 'session_id',
        ]
        read_only_fields = fields


class OperationLogSerializer(serializers.ModelSerializer):
    result_display = serializers.CharField(source='get_result_display', read_only=True)
    role_display = serializers.CharField(source='role_name', read_only=True)

    class Meta:
        model = OperationLog
        fields = [
            'id', 'operator', 'operator_name', 'role_name', 'role_display',
            'module', 'action', 'method', 'url', 'ip_address',
            'request_data', 'response_code', 'result', 'result_display',
            'duration', 'message', 'created_at',
        ]
        read_only_fields = fields


class PermissionInterceptLogSerializer(serializers.ModelSerializer):
    intercept_type_display = serializers.CharField(source='get_intercept_type_display', read_only=True)
    username = serializers.SerializerMethodField()

    class Meta:
        model = PermissionInterceptLog
        fields = [
            'id', 'user', 'username', 'intercept_type', 'intercept_type_display',
            'target_resource', 'request_method', 'request_url',
            'ip_address', 'user_agent', 'detail', 'created_at',
        ]
        read_only_fields = fields

    def get_username(self, obj):
        if obj.user:
            return obj.user.username
        return obj.username or 'Anonymous'

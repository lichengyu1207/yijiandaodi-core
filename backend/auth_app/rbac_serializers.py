from rest_framework import serializers
from .rbac_models import Role, Permission, Menu, OperationLog, PermissionAuditLog
from .models import User


class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Permission.objects.all(),
        required=False
    )

    class Meta:
        model = Role
        fields = ['id', 'name', 'code', 'description', 'data_scope', 'status',
                  'sort_order', 'permissions', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class PermissionSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = ['id', 'name', 'code', 'perm_type', 'parent', 'path', 'method',
                  'component', 'icon', 'sort_order', 'visible', 'status', 'children', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_children(self, obj):
        children = obj.children.filter(status=True).order_by('sort_order', 'id')
        return PermissionSerializer(children, many=True).data


class MenuSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = Menu
        fields = ['id', 'name', 'code', 'menu_type', 'parent', 'path', 'component',
                  'icon', 'permission', 'sort_order', 'visible', 'status', 'children',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_children(self, obj):
        children = obj.children.filter(status=True).order_by('sort_order', 'id')
        return MenuSerializer(children, many=True).data


class OperationLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='operator.username', read_only=True, default='')

    class Meta:
        model = OperationLog
        fields = ['id', 'operator', 'username', 'module', 'action', 'method', 'url',
                  'request_data', 'ip_address', 'response_code', 'result', 'message',
                  'duration', 'created_at']
        read_only_fields = ['id', 'created_at']


class PermissionAuditLogSerializer(serializers.ModelSerializer):
    operator_username = serializers.CharField(source='operator.username', read_only=True, default='')

    class Meta:
        model = PermissionAuditLog
        fields = ['id', 'operator', 'operator_username', 'target_type', 'target_id',
                  'target_name', 'action', 'detail_before', 'detail_after',
                  'ip_address', 'created_at']
        read_only_fields = ['id', 'created_at']


class CreateUserSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(max_length=128, write_only=True,
                                     style={'input_type': 'password'})
    role_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=[]
    )

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('用户名已存在')
        return value

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError('密码长度不能少于8位')
        return value


class ResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(max_length=128, write_only=True,
                                         style={'input_type': 'password'})

    def validate_new_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError('密码长度不能少于8位')
        return value

from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, LoginLog
import re


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, error_messages={'required': '用户名不能为空'})
    password = serializers.CharField(
        max_length=128,
        write_only=True,
        style={'input_type': 'password'},
        error_messages={'required': '密码不能为空'}
    )
    confirm_password = serializers.CharField(
        max_length=128,
        write_only=True,
        style={'input_type': 'password'},
        error_messages={'required': '请确认密码'}
    )
    email = serializers.EmailField(required=False, allow_blank=True, default='')

    def validate_username(self, value):
        if len(value) < 3:
            raise serializers.ValidationError('用户名长度不能少于3个字符')
        if not re.match(r'^[a-zA-Z0-9_\u4e00-\u9fa5]+$', value):
            raise serializers.ValidationError('用户名只能包含字母、数字、下划线和中文')
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('该用户名已被注册')
        return value

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError('密码长度不能少于8位')
        return value

    def validate(self, attrs):
        if attrs.get('password') != attrs.get('confirm_password'):
            raise serializers.ValidationError({'confirm_password': '两次输入的密码不一致'})
        return attrs


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, error_messages={'required': '用户名不能为空'})
    password = serializers.CharField(
        max_length=128,
        write_only=True,
        style={'input_type': 'password'},
        error_messages={'required': '密码不能为空'}
    )

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        user = authenticate(username=username, password=password)

        if not user:
            raise serializers.ValidationError('用户名或密码错误')

        if not user.is_active:
            raise serializers.ValidationError('该账户已被禁用，请联系管理员')

        attrs['user'] = user
        return attrs


class UserSerializer(serializers.ModelSerializer):
    is_creator = serializers.SerializerMethodField()
    is_developer = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'avatar', 'role', 'date_joined', 'last_login', 'is_creator', 'is_developer']
        read_only_fields = ['id', 'date_joined', 'last_login', 'is_creator', 'is_developer']

    def get_is_creator(self, obj):
        """判断用户是否是创作者（有 CreatorProfile 且 tip_enabled=True）"""
        try:
            from content_app.tipping_models import CreatorProfile
            profile = CreatorProfile.objects.filter(user=obj, tip_enabled=True).first()
            return profile is not None
        except Exception:
            return False

    def get_is_developer(self, obj):
        """判断用户是否是API开发者（有 DeveloperAccount 且 status=active）"""
        try:
            profile = obj.developer_account if hasattr(obj, 'developer_account') else None
            return profile is not None and profile.status == 'active'
        except Exception:
            return False


class UserInfoSerializer(serializers.ModelSerializer):
    is_creator = serializers.SerializerMethodField()
    is_developer = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'avatar', 'role', 'date_joined', 'last_login', 'is_creator', 'is_developer']

    def get_is_creator(self, obj):
        """判断用户是否是创作者"""
        try:
            from content_app.tipping_models import CreatorProfile
            profile = CreatorProfile.objects.filter(user=obj).first()
            return profile is not None
        except Exception:
            return False

    def get_is_developer(self, obj):
        """判断用户是否是API开发者"""
        try:
            profile = obj.developer_account if hasattr(obj, 'developer_account') else None
            return profile is not None and profile.status == 'active'
        except Exception:
            return False


class LoginLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = LoginLog
        fields = ['id', 'user', 'username', 'ip_address', 'user_agent', 'login_time', 'status']
        read_only_fields = ['id', 'user', 'login_time']

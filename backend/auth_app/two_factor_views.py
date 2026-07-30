"""
双因子认证视图
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate

from .two_factor_models import TwoFactorAuth, TwoFactorAttempt
from .two_factor_serializers import (
    TwoFactorSetupSerializer,
    TwoFactorVerifySerializer,
    TwoFactorEnableSerializer,
    TwoFactorDisableSerializer,
    TwoFactorStatusSerializer
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def two_factor_status(request):
    """获取双因子认证状态"""
    try:
        two_factor = request.user.two_factor
        serializer = TwoFactorStatusSerializer(two_factor)
        return Response({
            'success': True,
            'data': serializer.data
        })
    except TwoFactorAuth.DoesNotExist:
        return Response({
            'success': True,
            'data': {
                'is_enabled': False,
                'created_at': None,
                'last_used_at': None
            }
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def two_factor_setup(request):
    """设置双因子认证（生成二维码和密钥）"""
    serializer = TwoFactorSetupSerializer(data=request.data, context={'request': request})

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user

    # 获取或创建双因子认证配置
    two_factor, created = TwoFactorAuth.objects.get_or_create(user=user)

    # 生成TOTP密钥
    secret = two_factor.generate_totp_secret()

    # 生成二维码
    qr_code = two_factor.generate_qr_code(user.email)

    # 生成备用码
    backup_codes = two_factor.generate_backup_codes()

    return Response({
        'success': True,
        'data': {
            'secret': secret,
            'qr_code': qr_code,
            'backup_codes': backup_codes,
            'manual_entry_key': secret
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def two_factor_enable(request):
    """启用双因子认证"""
    serializer = TwoFactorEnableSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    code = serializer.validated_data['code']
    enable_backup_codes = serializer.validated_data.get('enable_backup_codes', True)

    try:
        two_factor = user.two_factor
    except TwoFactorAuth.DoesNotExist:
        return Response({
            'success': False,
            'error': '请先设置双因子认证'
        }, status=status.HTTP_400_BAD_REQUEST)

    # 验证TOTP代码
    if not two_factor.verify_totp(code):
        # 记录失败尝试
        TwoFactorAttempt.log_attempt(
            user=user,
            attempt_type='totp',
            is_success=False,
            request=request
        )
        return Response({
            'success': False,
            'error': '验证码错误'
        }, status=status.HTTP_400_BAD_REQUEST)

    # 启用双因子认证
    two_factor.is_enabled = True
    two_factor.save()

    # 记录成功尝试
    TwoFactorAttempt.log_attempt(
        user=user,
        attempt_type='totp',
        is_success=True,
        request=request
    )

    return Response({
        'success': True,
        'message': '双因子认证已启用',
        'backup_codes': two_factor.backup_codes if enable_backup_codes else None
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def two_factor_verify(request):
    """验证双因子认证代码"""
    serializer = TwoFactorVerifySerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    code = serializer.validated_data['code']

    try:
        two_factor = user.two_factor
    except TwoFactorAuth.DoesNotExist:
        return Response({
            'success': False,
            'error': '未启用双因子认证'
        }, status=status.HTTP_400_BAD_REQUEST)

    if not two_factor.is_enabled:
        return Response({
            'success': False,
            'error': '双因子认证未启用'
        }, status=status.HTTP_400_BAD_REQUEST)

    # 检查频率限制
    if not TwoFactorAttempt.check_rate_limit(user):
        return Response({
            'success': False,
            'error': '验证尝试次数过多，请稍后再试'
        }, status=status.HTTP_429_TOO_MANY_REQUESTS)

    # 验证TOTP代码
    if two_factor.verify_totp(code):
        TwoFactorAttempt.log_attempt(
            user=user,
            attempt_type='totp',
            is_success=True,
            request=request
        )
        return Response({
            'success': True,
            'message': '验证成功'
        })

    # 验证备用码
    if two_factor.verify_backup_code(code):
        TwoFactorAttempt.log_attempt(
            user=user,
            attempt_type='backup',
            is_success=True,
            request=request
        )
        return Response({
            'success': True,
            'message': '验证成功',
            'backup_codes_remaining': len(two_factor.backup_codes)
        })

    # 验证失败
    TwoFactorAttempt.log_attempt(
        user=user,
        attempt_type='totp',
        is_success=False,
        request=request
    )

    return Response({
        'success': False,
        'error': '验证码错误'
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def two_factor_disable(request):
    """禁用双因子认证"""
    serializer = TwoFactorDisableSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    password = serializer.validated_data['password']
    code = serializer.validated_data.get('code')

    # 验证密码
    if not authenticate(username=user.username, password=password):
        return Response({
            'success': False,
            'error': '密码错误'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        two_factor = user.two_factor
    except TwoFactorAuth.DoesNotExist:
        return Response({
            'success': True,
            'message': '双因子认证未启用'
        })

    # 如果已启用，需要验证代码
    if two_factor.is_enabled and code:
        if not two_factor.verify_totp(code):
            return Response({
                'success': False,
                'error': '验证码错误'
            }, status=status.HTTP_400_BAD_REQUEST)

    # 禁用双因子认证
    two_factor.is_enabled = False
    two_factor.save()

    return Response({
        'success': True,
        'message': '双因子认证已禁用'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def two_factor_regenerate_backup_codes(request):
    """重新生成备用码"""
    user = request.user

    try:
        two_factor = user.two_factor
        if not two_factor.is_enabled:
            return Response({
                'success': False,
                'error': '请先启用双因子认证'
            }, status=status.HTTP_400_BAD_REQUEST)

        backup_codes = two_factor.generate_backup_codes()

        return Response({
            'success': True,
            'backup_codes': backup_codes
        })
    except TwoFactorAuth.DoesNotExist:
        return Response({
            'success': False,
            'error': '未设置双因子认证'
        }, status=status.HTTP_400_BAD_REQUEST)
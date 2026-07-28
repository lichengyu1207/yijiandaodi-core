"""
授权码验证API
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.utils import timezone
from django.shortcuts import get_object_or_404
import logging
import hashlib

from .license_models import LicenseKey, LicenseVerificationLog

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
def activate_license(request):
    """
    激活授权码
    """
    license_key = request.data.get('license_key', '').strip().upper()
    device_fingerprint = request.data.get('device_fingerprint', '')

    if not license_key:
        return Response({'error': '请输入授权码'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        license = LicenseKey.objects.get(license_key=license_key)
    except LicenseKey.DoesNotExist:
        return Response({'error': '授权码不存在'}, status=status.HTTP_404_NOT_FOUND)

    # 激活授权码
    success, message = license.activate(device_fingerprint=device_fingerprint)

    if success:
        # 记录验证日志
        LicenseVerificationLog.objects.create(
            license_key=license,
            device_fingerprint=device_fingerprint,
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            success=True
        )

        return Response({
            'success': True,
            'message': message,
            'license': {
                'license_type': license.license_type,
                'expires_at': license.expires_at.isoformat() if license.expires_at else None,
                'valid_days': license.valid_days,
                'watermark_code': license.watermark_code
            }
        })
    else:
        # 记录失败日志
        LicenseVerificationLog.objects.create(
            license_key=license,
            device_fingerprint=device_fingerprint,
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            success=False,
            error_message=message
        )

        return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_license(request):
    """
    验证授权码（插件启动时调用）
    """
    license_key = request.data.get('license_key', '').strip().upper()
    device_fingerprint = request.data.get('device_fingerprint', '')

    if not license_key:
        return Response({'valid': False, 'error': '请输入授权码'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        license = LicenseKey.objects.get(license_key=license_key)
    except LicenseKey.DoesNotExist:
        return Response({'valid': False, 'error': '授权码不存在'}, status=status.HTTP_404_NOT_FOUND)

    # 验证授权码
    valid, message = license.verify(device_fingerprint=device_fingerprint)

    # 记录验证日志
    LicenseVerificationLog.objects.create(
        license_key=license,
        device_fingerprint=device_fingerprint,
        ip_address=request.META.get('REMOTE_ADDR'),
        user_agent=request.META.get('HTTP_USER_AGENT', ''),
        success=valid,
        error_message='' if valid else message
    )

    if valid:
        return Response({
            'valid': True,
            'message': message,
            'license': {
                'license_type': license.license_type,
                'expires_at': license.expires_at.isoformat() if license.expires_at else None,
                'days_remaining': (license.expires_at - timezone.now()).days if license.expires_at else 0,
                'watermark_code': license.watermark_code
            }
        })
    else:
        return Response({'valid': False, 'error': message}, status=status.HTTP_403_FORBIDDEN)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_licenses(request):
    """
    获取我的授权码列表（管理员）
    """
    user = request.user

    if not user.is_staff:
        return Response({'error': '无权限'}, status=status.HTTP_403_FORBIDDEN)

    licenses = LicenseKey.objects.all().order_by('-created_at')

    license_list = []
    for lic in licenses:
        license_list.append({
            'id': str(lic.id),
            'license_key': lic.license_key,
            'license_type': lic.license_type,
            'status': lic.status,
            'status_display': lic.get_status_display(),
            'user': lic.user.username if lic.user else None,
            'device_fingerprint': lic.device_fingerprint,
            'expires_at': lic.expires_at.isoformat() if lic.expires_at else None,
            'verify_count': lic.verify_count,
            'watermark_code': lic.watermark_code,
            'created_at': lic.created_at.isoformat(),
        })

    return Response({
        'success': True,
        'licenses': license_list,
        'total': licenses.count()
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_license(request):
    """
    生成授权码（管理员）
    """
    user = request.user

    if not user.is_staff:
        return Response({'error': '无权限'}, status=status.HTTP_403_FORBIDDEN)

    license_type = request.data.get('license_type', 'beta')
    valid_days = request.data.get('valid_days', 30)
    count = request.data.get('count', 1)
    note = request.data.get('note', '')

    if count > 100:
        return Response({'error': '一次最多生成100个授权码'}, status=status.HTTP_400_BAD_REQUEST)

    licenses = []
    for _ in range(count):
        license = LicenseKey.objects.create(
            license_key=LicenseKey.generate_key(),
            license_type=license_type,
            valid_days=valid_days,
            watermark_code=LicenseKey.generate_watermark(),
            note=note,
            created_by=user
        )
        licenses.append({
            'license_key': license.license_key,
            'watermark_code': license.watermark_code
        })

    return Response({
        'success': True,
        'message': f'成功生成 {len(licenses)} 个授权码',
        'licenses': licenses
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def revoke_license(request, license_id):
    """
    撤销授权码（管理员）
    """
    user = request.user

    if not user.is_staff:
        return Response({'error': '无权限'}, status=status.HTTP_403_FORBIDDEN)

    license = get_object_or_404(LicenseKey, id=license_id)
    license.revoke()

    return Response({
        'success': True,
        'message': '授权码已撤销'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def track_watermark(request, watermark_code):
    """
    通过水印码追踪授权码（管理员）
    """
    user = request.user

    if not user.is_staff:
        return Response({'error': '无权限'}, status=status.HTTP_403_FORBIDDEN)

    try:
        license = LicenseKey.objects.get(watermark_code=watermark_code)

        return Response({
            'success': True,
            'license': {
                'license_key': license.license_key,
                'license_type': license.license_type,
                'status': license.status,
                'user': license.user.username if license.user else None,
                'note': license.note,
                'created_at': license.created_at.isoformat(),
                'activated_at': license.activated_at.isoformat() if license.activated_at else None,
                'verify_count': license.verify_count,
            }
        })
    except LicenseKey.DoesNotExist:
        return Response({
            'success': False,
            'error': '水印码不存在'
        }, status=status.HTTP_404_NOT_FOUND)
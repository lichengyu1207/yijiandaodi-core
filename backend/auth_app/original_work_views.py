"""
原创作品审核API
"""

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import models
import logging

from .authentication import CookieJWTAuthentication
from .original_work_models import OriginalWork, OriginalWorkEvidence
from .extension_sync_models import ExtensionSession

logger = logging.getLogger(__name__)


# ===== 用户端API =====

@api_view(['POST'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def upload_work(request):
    """
    上传作品申请原创声明
    """
    user = request.user

    title = request.data.get('title', '').strip()
    work_type = request.data.get('work_type', 'ai_dialog')
    description = request.data.get('description', '')
    content = request.data.get('content', '')
    session_id = request.data.get('session_id', '')

    if not title:
        return Response({'error': '请填写作品标题'}, status=status.HTTP_400_BAD_REQUEST)

    if not content and not session_id:
        return Response({'error': '请提供作品内容或选择录制会话'}, status=status.HTTP_400_BAD_REQUEST)

    # 创建作品
    work = OriginalWork.objects.create(
        user=user,
        title=title,
        work_type=work_type,
        description=description,
        content=content,
        session_id=session_id,
        status='pending'
    )

    # 生成内容哈希
    work.generate_content_hash()

    # 如果有会话ID，关联证据链
    if session_id:
        try:
            session = ExtensionSession.objects.get(session_id=session_id, user=user)
            work.evidence_chain = {
                'session_id': session_id,
                'start_time': session.start_time.isoformat() if session.start_time else None,
                'end_time': session.end_time.isoformat() if session.end_time else None,
                'operations_count': session.operations.count() if hasattr(session, 'operations') else 0,
                'fingerprints_count': session.fingerprints.count() if hasattr(session, 'fingerprints') else 0,
            }
            work.save()
        except ExtensionSession.DoesNotExist:
            logger.warning(f"会话不存在: {session_id}")

    work.save()

    return Response({
        'success': True,
        'message': '作品已提交，等待审核',
        'work': {
            'id': str(work.id),
            'title': work.title,
            'status': work.status,
            'created_at': work.created_at.isoformat(),
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def my_works(request):
    """
    获取我的作品列表
    """
    user = request.user

    works = OriginalWork.objects.filter(user=user).order_by('-created_at')

    work_list = []
    for work in works:
        work_list.append({
            'id': str(work.id),
            'title': work.title,
            'work_type': work.work_type,
            'status': work.status,
            'status_display': work.get_status_display(),
            'declaration_number': work.declaration_number,
            'created_at': work.created_at.isoformat(),
            'reviewed_at': work.reviewed_at.isoformat() if work.reviewed_at else None,
        })

    return Response({
        'success': True,
        'works': work_list,
        'total': works.count()
    })


@api_view(['GET'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def work_detail(request, work_id):
    """
    获取作品详情
    """
    user = request.user

    work = get_object_or_404(OriginalWork, id=work_id, user=user)

    evidences = []
    for ev in work.evidences.all():
        evidences.append({
            'type': ev.evidence_type,
            'data': ev.evidence_data,
            'timestamp': ev.timestamp.isoformat(),
            'fingerprint': ev.fingerprint,
        })

    return Response({
        'success': True,
        'work': {
            'id': str(work.id),
            'title': work.title,
            'work_type': work.work_type,
            'work_type_display': work.get_work_type_display(),
            'description': work.description,
            'content': work.content,
            'content_hash': work.content_hash,
            'status': work.status,
            'status_display': work.get_status_display(),
            'declaration_number': work.declaration_number,
            'declaration_issued_at': work.declaration_issued_at.isoformat() if work.declaration_issued_at else None,
            'review_note': work.review_note,
            'reviewed_at': work.reviewed_at.isoformat() if work.reviewed_at else None,
            'created_at': work.created_at.isoformat(),
            'updated_at': work.updated_at.isoformat(),
            'evidence_chain': work.evidence_chain,
            'evidences': evidences,
        }
    })


@api_view(['GET'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def declaration_certificate(request, work_id):
    """
    获取原创声明证书（仅审核通过的作品）
    """
    user = request.user

    work = get_object_or_404(OriginalWork, id=work_id, user=user)

    if work.status != 'approved':
        return Response({
            'error': '作品尚未审核通过，无法获取证书'
        }, status=status.HTTP_400_BAD_REQUEST)

    # 生成证书HTML
    certificate_html = generate_certificate_html(work)

    return Response({
        'success': True,
        'certificate': {
            'declaration_number': work.declaration_number,
            'title': work.title,
            'author': user.username,
            'work_type': work.get_work_type_display(),
            'content_hash': work.content_hash,
            'issued_at': work.declaration_issued_at.isoformat() if work.declaration_issued_at else None,
            'html': certificate_html,
        }
    })


def generate_certificate_html(work):
    """生成原创声明证书HTML"""
    user = work.user

    return f'''
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>原创声明证书 - {work.title}</title>
    <style>
        body {{ font-family: "Microsoft YaHei", Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; background: #f5f5f5; }}
        .certificate {{ background: white; padding: 60px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 3px solid #165DFF; }}
        .header {{ text-align: center; margin-bottom: 40px; }}
        .title {{ font-size: 32px; color: #165DFF; font-weight: bold; margin-bottom: 10px; }}
        .subtitle {{ font-size: 18px; color: #666; }}
        .seal {{ width: 120px; height: 120px; border: 4px solid #ef4444; border-radius: 50%; margin: 30px auto; display: flex; align-items: center; justify-content: center; color: #ef4444; font-weight: bold; font-size: 16px; text-align: center; }}
        .info-table {{ width: 100%; margin: 30px 0; }}
        .info-table td {{ padding: 12px 0; border-bottom: 1px dashed #ddd; }}
        .info-table td:first-child {{ width: 120px; color: #666; font-weight: 500; }}
        .info-table td:last-child {{ color: #333; font-weight: 600; }}
        .hash-box {{ background: #f0f9ff; padding: 15px; border-radius: 8px; font-family: monospace; word-break: break-all; margin: 20px 0; border-left: 4px solid #165DFF; }}
        .footer {{ text-align: center; margin-top: 40px; color: #999; font-size: 14px; }}
        .footer a {{ color: #165DFF; text-decoration: none; }}
    </style>
</head>
<body>
    <div class="certificate">
        <div class="header">
            <div class="title">原创声明证书</div>
            <div class="subtitle">ORIGINAL DECLARATION CERTIFICATE</div>
        </div>

        <div class="seal">一鉴到底<br>原创认证</div>

        <table class="info-table">
            <tr><td>声明编号</td><td>{work.declaration_number}</td></tr>
            <tr><td>作品标题</td><td>{work.title}</td></tr>
            <tr><td>作品类型</td><td>{work.get_work_type_display()}</td></tr>
            <tr><td>作者</td><td>{user.username}</td></tr>
            <tr><td>签发日期</td><td>{work.declaration_issued_at.strftime('%Y年%m月%d日') if work.declaration_issued_at else '--'}</td></tr>
        </table>

        <div class="hash-box">
            <div style="color: #666; margin-bottom: 8px;">内容哈希指纹 (SHA-256)</div>
            {work.content_hash}
        </div>

        <p style="color: #333; line-height: 1.8; margin: 20px 0;">
            兹证明上述作品由 <strong>{user.username}</strong> 于 <strong>{work.created_at.strftime('%Y年%m月%d日 %H:%M')}</strong> 首次创作完成，
            经一鉴到底平台审核，符合原创声明条件，特此认证。
        </p>

        <p style="color: #666; font-size: 13px; margin-top: 30px;">
            本证书基于可信时间戳和哈希指纹技术，确保创作过程不可篡改。
            可通过访问 <a href="https://yijiandaodi.com/verify/{work.declaration_number}" target="_blank">yijiandaodi.com/verify/{work.declaration_number}</a> 验证证书真伪。
        </p>

        <div class="footer">
            <a href="https://yijiandaodi.com" target="_blank">一鉴到底</a> · AI替你干事，我们替你守住成果
        </div>
    </div>
</body>
</html>
'''


# ===== 管理员API =====

@api_view(['GET'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def admin_work_list(request):
    """
    管理员获取待审核作品列表
    """
    user = request.user

    # 检查是否是管理员
    if not user.is_staff:
        return Response({'error': '无权限'}, status=status.HTTP_403_FORBIDDEN)

    status_filter = request.query_params.get('status', 'pending')

    works = OriginalWork.objects.filter(status=status_filter).order_by('-created_at')

    work_list = []
    for work in works:
        work_list.append({
            'id': str(work.id),
            'title': work.title,
            'work_type': work.work_type,
            'user': work.user.username,
            'status': work.status,
            'created_at': work.created_at.isoformat(),
        })

    return Response({
        'success': True,
        'works': work_list,
        'total': works.count()
    })


@api_view(['POST'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def admin_review_work(request, work_id):
    """
    管理员审核作品
    """
    user = request.user

    # 检查是否是管理员
    if not user.is_staff:
        return Response({'error': '无权限'}, status=status.HTTP_403_FORBIDDEN)

    work = get_object_or_404(OriginalWork, id=work_id)

    action = request.data.get('action')  # approve 或 reject
    note = request.data.get('note', '')

    if action not in ['approve', 'reject']:
        return Response({'error': '无效的操作'}, status=status.HTTP_400_BAD_REQUEST)

    if action == 'approve':
        work.status = 'approved'
        work.reviewed_at = timezone.now()
        work.declaration_issued_at = timezone.now()
        work.generate_declaration_number()
    else:
        work.status = 'rejected'

    work.reviewer = user
    work.review_note = note
    work.save()

    return Response({
        'success': True,
        'message': '审核完成',
        'work': {
            'id': str(work.id),
            'status': work.status,
            'declaration_number': work.declaration_number,
        }
    })


# ===== 公开验证API =====

@api_view(['GET'])
@permission_classes([AllowAny])
def verify_declaration(request, declaration_number):
    """
    公开验证原创声明
    无需登录，任何人都可以验证
    """
    try:
        work = OriginalWork.objects.get(declaration_number=declaration_number, status='approved')

        return Response({
            'success': True,
            'valid': True,
            'declaration': {
                'number': work.declaration_number,
                'title': work.title,
                'author': work.user.username,
                'work_type': work.get_work_type_display(),
                'content_hash': work.content_hash,
                'issued_at': work.declaration_issued_at.isoformat() if work.declaration_issued_at else None,
            }
        })
    except OriginalWork.DoesNotExist:
        return Response({
            'success': False,
            'valid': False,
            'error': '声明编号不存在或无效'
        }, status=status.HTTP_404_NOT_FOUND)
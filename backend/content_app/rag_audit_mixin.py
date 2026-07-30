import time
from django.utils import timezone


class RAGAuditMixin:
    """RAG操作审计日志混入类"""

    @staticmethod
    def log_operation(request, action, target_type='', target_id=None, target_name='',
                       status='success', detail=None, error_msg='', duration_ms=0):
        from .rag_models import RAGOperationLog

        try:
            user = getattr(request, 'user', None)
            user_id = user.id if user and user.is_authenticated else None
            username = str(user) if user and user.is_authenticated else ''

            log = RAGOperationLog.objects.create(
                action=action,
                target_type=target_type,
                target_id=target_id,
                target_name=target_name[:300] if target_name else '',
                user_id=user_id,
                username=username,
                ip_address=RAGAuditMixin._get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
                request_detail=detail or {},
                status=status,
                error_message=error_msg,
                duration_ms=int(duration_ms),
            )
            return log.id
        except Exception as e:
            print(f'[RAG Audit Log Error] {e}')
            return None

    @staticmethod
    def _get_client_ip(request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '')

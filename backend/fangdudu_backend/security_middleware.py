import time
import logging
from django.utils.deprecation import MiddlewareMixin
from django.core.cache import cache

logger = logging.getLogger('security_audit')

SENSITIVE_PATHS = {'/api/auth/login/', '/api/auth/register/', '/api/auth/change-password/',
                   '/api/auth/delete-account/', '/api/payment/', '/api/open/',
                   '/api/data-classification/', '/api/mall/'}

PII_PATTERNS = ['password', 'old_password', 'new_password', 'token', 'refresh_token',
                'secret', 'api_key', 'credit_card', 'id_card', 'phone']

DC_PROTECTED_PREFIXES = [
    ('/api/payment/', 'L3'),
    ('/api/mall/orders/', 'L3'),
    ('/api/mall/user-center/', 'L3'),
    ('/api/open/', 'L4'),
    ('/api/data-classification/', 'L3'),
    ('/api/auth/users/', 'L2'),
]


class SecurityAuditMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request._audit_start_time = time.time()
        self._check_data_classification_access(request)

    def _check_data_classification_access(self, request):
        path = request.path
        for prefix, required_level in DC_PROTECTED_PREFIXES:
            if path.startswith(prefix) and hasattr(request, 'user') and request.user.is_authenticated:
                user_role = getattr(request.user, 'role', 'viewer')
                level_role_map = {
                    'L1': ['viewer', 'editor', 'admin', 'super_admin'],
                    'L2': ['viewer', 'editor', 'admin', 'super_admin'],
                    'L3': ['admin', 'super_admin'],
                    'L4': ['super_admin'],
                }
                allowed_roles = level_role_map.get(required_level, [])
                if user_role not in allowed_roles:
                    from django.http import JsonResponse
                    return JsonResponse({
                        'success': False,
                        'message': f'数据分级访问拒绝: 需要{required_level}级别权限',
                        'code': f'DC_ACCESS_DENIED_{required_level}'
                    }, status=403)
        return None

    def process_response(self, request, response):
        try:
            path = request.path
            method = request.method

            if method not in ('GET', 'POST', 'PUT', 'DELETE', 'PATCH'):
                return response

            duration_ms = round((time.time() - getattr(request, '_audit_start_time', time.time())) * 1000)
            status_code = response.status_code
            user_id = getattr(request.user, 'id', None) if hasattr(request, 'user') and request.user.is_authenticated else None
            user_role = getattr(request.user, 'role', '') if (hasattr(request, 'user') and hasattr(request.user, 'role')) else ''

            ip = self._get_client_ip(request)

            dc_level = self._detect_data_classification_level(path)

            log_data = {
                'method': method,
                'path': path[:200],
                'status_code': status_code,
                'duration_ms': duration_ms,
                'ip': ip[:45] if ip else '',
                'user_id': user_id,
                'user_role': user_role,
                'dc_level': dc_level,
                'user_agent': (request.META.get('HTTP_USER_AGENT', '') or '')[:200],
            }

            if any(sp in path for sp in SENSITIVE_PATHS) or dc_level:
                safe_body = {}
                if hasattr(request, 'data') and request.data:
                    for k, v in request.data.items():
                        if any(pii in k.lower() for pii in PII_PATTERNS):
                            safe_body[k] = '[REDACTED]'
                        elif isinstance(v, str) and len(v) > 100:
                            safe_body[k] = v[:100] + '...'
                        else:
                            safe_body[k] = v
                    log_data['body_keys'] = list(safe_body.keys())

                if status_code >= 400 or dc_level in ('L3', 'L4'):
                    logger.warning(
                        f"[SECURITY][L{dc_level or '-'}] {method} {path} | "
                        f"status={status_code} | role={user_role or 'anon'} | "
                        f"ip={log_data['ip']} | {duration_ms}ms"
                    )
                else:
                    logger.info(
                        f"[AUDIT][L{dc_level or '-'}] {method} {path} | "
                        f"status={status_code} | role={user_role or 'anon'} | "
                        f"ip={log_data['ip']} | {duration_ms}ms"
                    )

            if status_code == 429:
                logger.warning(f"[RATE_LIMIT] {method} {path} | ip={log_data['ip']} - Too many requests")

            if status_code == 403:
                logger.warning(f"[FORBIDDEN] {method} {path} | ip={log_data['ip']} - Access denied")

            if status_code == 401:
                logger.info(f"[UNAUTH] {method} {path} | ip={log_data['ip']} - Unauthorized")

        except Exception as e:
            logger.error(f"[AUDIT_ERROR] Failed to audit: {str(e)}")

        return response

    def _get_client_ip(self, request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '')

    def _detect_data_classification_level(self, path):
        for prefix, level in DC_PROTECTED_PREFIXES:
            if path.startswith(prefix):
                return level
        return ''

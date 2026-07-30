"""
请求追踪中间件
- 生成唯一Request ID
- 记录请求开始/结束时间
- 计算响应时间
- 记录到日志中心
"""

import uuid
import time
import logging
import json
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger('tracing')


class TracingMiddleware(MiddlewareMixin):
    """
    请求追踪中间件
    """

    def process_request(self, request):
        # 生成Request ID
        request.request_id = str(uuid.uuid4())

        # 记录请求开始时间
        request.start_time = time.time()

        # 记录请求信息
        log_data = {
            'request_id': request.request_id,
            'method': request.method,
            'path': request.path,
            'user_id': request.user.id if hasattr(request, 'user') and request.user.is_authenticated else None,
            'ip': self.get_client_ip(request),
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
            'action': 'request_start',
            'timestamp': time.time()
        }

        logger.info(json.dumps(log_data))

        # 添加到请求头，便于前端追踪
        request.META['HTTP_X_REQUEST_ID'] = request.request_id

    def process_response(self, request, response):
        # 计算响应时间
        duration = time.time() - request.start_time

        # 记录响应信息
        log_data = {
            'request_id': request.request_id,
            'status_code': response.status_code,
            'duration_ms': round(duration * 1000, 2),
            'action': 'request_end',
            'timestamp': time.time()
        }

        logger.info(json.dumps(log_data))

        # 添加Request ID到响应头
        response['X-Request-ID'] = request.request_id

        return response

    def process_exception(self, request, exception):
        # 记录异常信息
        log_data = {
            'request_id': request.request_id,
            'exception': str(exception),
            'exception_type': type(exception).__name__,
            'action': 'request_exception',
            'timestamp': time.time()
        }

        logger.error(json.dumps(log_data))

    def get_client_ip(self, request):
        """获取客户端IP"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return request.META.get('REMOTE_ADDR')
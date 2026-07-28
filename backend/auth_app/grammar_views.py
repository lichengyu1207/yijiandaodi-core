import json
import time
import asyncio

from django.views import View
from django.http import JsonResponse
from django.core.cache import cache
from rest_framework import status

from .services.grammar_checker import grammar_checker_service


class GrammarCheckView(View):
    """语法检查API - POST /api/grammar/check/"""

    async def post(self, request):
        try:
            data = json.loads(request.body) if request.body else {}
        except Exception:
            data = {}

        text = (data.get('text') or data.get('original_text', '')).strip()

        if not text:
            return JsonResponse({
                'success': False,
                'message': '请提供待检测文本',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)

        if len(text) < 5:
            return JsonResponse({
                'success': False,
                'message': '文本长度不足（至少5字符）',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'grammar_check_{hash(text)}'
        cached = cache.get(cache_key)
        if cached:
            return JsonResponse({
                'success': True,
                'message': '检测完成（缓存）',
                'data': cached
            })

        start_time = time.time()
        try:
            result = await grammar_checker_service.check_grammar(text)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'检测失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_REQUEST)

        processing_time = int((time.time() - start_time) * 1000)
        result['processing_time_ms'] = processing_time

        cache.set(cache_key, result, timeout=300)

        return JsonResponse({
            'success': True,
            'message': '语法纠错检测完成',
            'data': result
        })


class GrammarImproveView(View):
    """文本改进API - POST /api/grammar/improve/"""

    async def post(self, request):
        try:
            data = json.loads(request.body) if request.body else {}
        except Exception:
            data = {}

        text = (data.get('text') or data.get('original_text', '')).strip()
        mode = data.get('mode', 'fluency')

        valid_modes = ['fluency', 'conciseness', 'vocabulary']
        if mode not in valid_modes:
            mode = 'fluency'

        if not text:
            return JsonResponse({
                'success': False,
                'message': '请提供待改进文本',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)

        if len(text) < 5:
            return JsonResponse({
                'success': False,
                'message': '文本长度不足（至少5字符）',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)

        start_time = time.time()
        try:
            result = await grammar_checker_service.improve_text(text, mode)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'改进失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_REQUEST)

        result['processing_time_ms'] = int((time.time() - start_time) * 1000)

        mode_labels = {
            'fluency': '流畅性优化',
            'conciseness': '简洁性优化',
            'vocabulary': '词汇升级'
        }

        return JsonResponse({
            'success': True,
            'message': f'{mode_labels.get(mode, "优化")}完成',
            'data': result
        })


class GrammarStyleView(View):
    """文风分析API - POST /api/grammar/style/"""

    async def post(self, request):
        try:
            data = json.loads(request.body) if request.body else {}
        except Exception:
            data = {}

        text = (data.get('text') or data.get('original_text', '')).strip()

        if not text:
            return JsonResponse({
                'success': False,
                'message': '请提供待分析文本',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)

        if len(text) < 10:
            return JsonResponse({
                'success': False,
                'message': '文本长度不足（至少10字符以获得准确分析结果）',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)

        start_time = time.time()
        try:
            result = await grammar_checker_service.analyze_style(text)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'分析失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_REQUEST)

        result['processing_time_ms'] = int((time.time() - start_time) * 1000)

        return JsonResponse({
            'success': True,
            'message': '文风分析完成',
            'data': result
        })
